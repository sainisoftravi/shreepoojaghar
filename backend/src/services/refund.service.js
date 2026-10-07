import { PrismaClient, Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/AppError.js';
import { generateInvoiceNumber } from '../utils/invoiceNumber.js';
import { logger } from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Partial / Full Refund Service with LIFO Stock Restoration, Request Idempotency, and Khata Balance Reversal.
 *
 * @param {object} params
 * @param {string} params.invoiceItemId
 * @param {number} params.qtyInUnit - Quantity in unit to refund
 * @param {string} [params.idempotencyKey]
 * @param {object} [params.user] - User executing refund (Admin check)
 * @returns {object} - Refund result
 */
export const processRefund = async ({ invoiceItemId, qtyInUnit, idempotencyKey, user }) => {
  // Permission check: Admin only unless configured
  if (user && user.role && user.role !== 'ADMIN') {
    throw new ForbiddenError('Only Admin can process refunds');
  }

  // Fast check idempotency
  if (idempotencyKey) {
    const existingRefund = await prisma.salesInvoiceRefund.findUnique({
      where: { idempotencyKey },
    });
    if (existingRefund) {
      logger.info({ idempotencyKey, refundNo: existingRefund.refundNo }, 'Idempotent refund hit: returning existing refund');
      return { refund: existingRefund, isDuplicate: true };
    }
  }

  const requestedQtyUnitDec = new Decimal(qtyInUnit ? qtyInUnit.toString() : '0');
  if (requestedQtyUnitDec.lte(0)) {
    throw new ValidationError('Refund quantity must be greater than 0');
  }

  const result = await prisma.$transaction(
    async (tx) => {
      // Re-check idempotency key inside transaction
      if (idempotencyKey) {
        const existingTxRefund = await tx.salesInvoiceRefund.findUnique({
          where: { idempotencyKey },
        });
        if (existingTxRefund) {
          return { refund: existingTxRefund, isDuplicate: true };
        }
      }

      // Lock InvoiceItem FOR UPDATE
      const lockedItems = await tx.$queryRaw`
        SELECT id, invoice_id, product_id, factor_to_base, qty_in_unit, qty_base, refunded_qty_base,
               unit_price, gross_line_total, discount_amount, line_total, cogs, profit
        FROM invoice_items
        WHERE id = ${invoiceItemId}
        FOR UPDATE
      `;

      if (!lockedItems || lockedItems.length === 0) {
        throw new NotFoundError('Invoice item not found');
      }

      const item = lockedItems[0];

      const factorToBaseDec = new Decimal(item.factor_to_base.toString());
      const itemQtyBaseDec = new Decimal(item.qty_base.toString());
      const alreadyRefundedBaseDec = new Decimal(item.refunded_qty_base.toString());
      const availableToRefundBaseDec = itemQtyBaseDec.minus(alreadyRefundedBaseDec);

      const refundQtyBaseDec = requestedQtyUnitDec.mul(factorToBaseDec);

      if (refundQtyBaseDec.gt(availableToRefundBaseDec.add(0.0001))) {
        throw new ValidationError(
          `Refund quantity exceeds available balance. Sold: ${(itemQtyBaseDec.div(factorToBaseDec)).toFixed(3)}, Already Refunded: ${(alreadyRefundedBaseDec.div(factorToBaseDec)).toFixed(3)}, Max Refundable: ${(availableToRefundBaseDec.div(factorToBaseDec)).toFixed(3)}`
        );
      }

      const isFinalPartialRefund = refundQtyBaseDec.gte(availableToRefundBaseDec.minus(0.0001));

      // Unit price snapshot from line item
      const itemLineTotalDec = new Decimal(item.line_total.toString());
      const itemGrossLineTotalDec = new Decimal(item.gross_line_total.toString());
      const itemDiscountDec = new Decimal(item.discount_amount.toString());
      const itemCogsDec = new Decimal(item.cogs.toString());
      const itemProfitDec = new Decimal(item.profit.toString());

      let refundAmountDec = new Decimal(0);
      let subtotalRefundDec = new Decimal(0);
      let discountReversedDec = new Decimal(0);
      let cogsReversedDec = new Decimal(0);
      let profitReversedDec = new Decimal(0);

      if (isFinalPartialRefund) {
        // Residual handling: put rounding residual on final partial refund to sum exactly to line total
        const previousRefunds = await tx.salesInvoiceRefund.findMany({
          where: { invoiceItemId },
        });

        const prevRefundSum = previousRefunds.reduce(
          (acc, r) => ({
            amount: acc.amount.add(new Decimal(r.refundAmount.toString())),
            subtotal: acc.subtotal.add(new Decimal(r.subtotalAmount.toString())),
            discount: acc.discount.add(new Decimal(r.discountReversed.toString())),
            cogs: acc.cogs.add(new Decimal(r.cogsReversed.toString())),
            profit: acc.profit.add(new Decimal(r.profitReversed.toString())),
          }),
          { amount: new Decimal(0), subtotal: new Decimal(0), discount: new Decimal(0), cogs: new Decimal(0), profit: new Decimal(0) }
        );

        refundAmountDec = itemLineTotalDec.minus(prevRefundSum.amount);
        subtotalRefundDec = itemGrossLineTotalDec.minus(prevRefundSum.subtotal);
        discountReversedDec = itemDiscountDec.minus(prevRefundSum.discount);
        cogsReversedDec = itemCogsDec.minus(prevRefundSum.cogs);
        profitReversedDec = itemProfitDec.minus(prevRefundSum.profit);
      } else {
        // Proportional refund
        const proportionDec = refundQtyBaseDec.div(itemQtyBaseDec);
        subtotalRefundDec = itemGrossLineTotalDec.mul(proportionDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        discountReversedDec = itemDiscountDec.mul(proportionDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        refundAmountDec = subtotalRefundDec.minus(discountReversedDec);
        cogsReversedDec = itemCogsDec.mul(proportionDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        profitReversedDec = refundAmountDec.minus(cogsReversedDec);
      }

      // Fetch batch allocations for LIFO stock restoration
      const allocations = await tx.invoiceItemBatchAllocation.findMany({
        where: { invoiceItemId },
        orderBy: { createdAt: 'desc' }, // LIFO order
      });

      let remainingRefundBaseDec = new Decimal(refundQtyBaseDec.toString());

      if (allocations && allocations.length > 0) {
        // Restore stock LIFO into last consumed batches
        for (const alloc of allocations) {
          if (remainingRefundBaseDec.lte(0)) break;

          const allocQtyBaseDec = new Decimal(alloc.qtyBase.toString());
          const restoreQtyBaseDec = Decimal.min(remainingRefundBaseDec, allocQtyBaseDec);

          await tx.productBatch.update({
            where: { id: alloc.batchId },
            data: {
              qtyRemainingBase: { increment: restoreQtyBaseDec.toNumber() },
              currentStock: { increment: Math.round(restoreQtyBaseDec.toNumber()) },
            },
          });

          remainingRefundBaseDec = remainingRefundBaseDec.minus(restoreQtyBaseDec);
        }
      } else {
        // Legacy fallback: restore stock to latest active batch of the product
        const latestBatch = await tx.productBatch.findFirst({
          where: { productId: item.product_id },
          orderBy: { receivedAt: 'desc' },
        });

        if (latestBatch) {
          await tx.productBatch.update({
            where: { id: latestBatch.id },
            data: {
              qtyRemainingBase: { increment: refundQtyBaseDec.toNumber() },
              currentStock: { increment: Math.round(refundQtyBaseDec.toNumber()) },
            },
          });
        }
      }

      // Restore Product totalStockBase
      await tx.product.update({
        where: { id: item.product_id },
        data: {
          totalStockBase: { increment: refundQtyBaseDec.toNumber() },
        },
      });

      // Update InvoiceItem refundedQtyBase
      await tx.invoiceItem.update({
        where: { id: invoiceItemId },
        data: {
          refundedQtyBase: { increment: refundQtyBaseDec.toNumber() },
        },
      });

      // Fetch SalesInvoice for Khata balance adjustment
      const invoice = await tx.salesInvoice.findUnique({
        where: { id: item.invoice_id },
      });

      // Adjust Khata / Customer credit balance if sale was on KHATA
      if (invoice.paymentMode === 'KHATA' && invoice.customerId) {
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: {
            lifetimeSpend: { decrement: refundAmountDec.toNumber() },
          },
        });
      }

      // Update Invoice totals
      await tx.salesInvoice.update({
        where: { id: item.invoice_id },
        data: {
          totalAmount: { decrement: refundAmountDec.toNumber() },
          subtotal: { decrement: subtotalRefundDec.toNumber() },
          discountAmount: { decrement: discountReversedDec.toNumber() },
          totalProfit: { decrement: profitReversedDec.toNumber() },
        },
      });

      // Generate refund number
      const refundNo = `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Create SalesInvoiceRefund record
      const refund = await tx.salesInvoiceRefund.create({
        data: {
          invoiceId: item.invoice_id,
          invoiceItemId: item.id,
          idempotencyKey: idempotencyKey || null,
          refundNo,
          qtyInUnit: requestedQtyUnitDec.toNumber(),
          qtyBase: refundQtyBaseDec.toNumber(),
          refundAmount: refundAmountDec.toFixed(2),
          subtotalAmount: subtotalRefundDec.toFixed(2),
          discountReversed: discountReversedDec.toFixed(2),
          cogsReversed: cogsReversedDec.toFixed(2),
          profitReversed: profitReversedDec.toFixed(2),
        },
      });

      logger.info(
        { refundNo, invoiceId: item.invoice_id, refundAmount: refundAmountDec.toFixed(2) },
        '✅ Refund processed successfully'
      );

      return { refund };
    },
    {
      isolationLevel: 'Serializable',
      timeout: 15000,
    }
  );

  return result;
};
