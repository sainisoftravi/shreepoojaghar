import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import {
  decryptCustomerPii,
  decryptInvoicePii,
  encryptPii,
  getCustomerPhoneLookup,
  hashCheckoutRequest,
} from '../utils/customer-privacy.js';

const Decimal = Prisma.Decimal;
import { computeFIFO, calcLineProfit } from './fifo.service.js';
import { generateInvoiceNumber } from '../utils/invoiceNumber.js';
import { normalizePhone } from '../utils/phone.js';
import { NotFoundError, AppError, ValidationError, ConflictError } from '../utils/AppError.js';
import { roundMoney } from '../utils/unit.utils.js';
import { logger } from '../config/logger.js';
import { invalidateProductCache } from './product.service.js';

const prisma = new PrismaClient();

/**
 * Computes deterministic request hash for idempotency cart payload check.
 */
const serializeRequestForHash = (items, customerName = '', phone = '', paymentMode = '', discountType = 'AMOUNT', discountValue = 0) => {
  const sortedLines = items
    .map((i) => ({
      productId: i.productId,
      unitId: i.unitId || '',
      qtyInUnit: Number(i.qtyInUnit ?? i.qty ?? 1),
    }))
    .sort((a, b) => (a.productId + a.unitId).localeCompare(b.productId + b.unitId));

  const requestPayload = {
    customerName: customerName.trim(),
    phone: phone.trim(),
    paymentMode: paymentMode.trim(),
    lines: sortedLines,
  };
  if (Number(discountValue) > 0) {
    requestPayload.discountType = discountType;
    requestPayload.discountValue = Number(discountValue);
  }
  return JSON.stringify(requestPayload);
};

export const computeRequestHash = (items, customerName = '', phone = '', paymentMode = '', discountType = 'AMOUNT', discountValue = 0) => {
  return hashCheckoutRequest(serializeRequestForHash(items, customerName, phone, paymentMode, discountType, discountValue));
};

const computeLegacyRequestHash = (items, customerName = '', phone = '', paymentMode = '', discountType = 'AMOUNT', discountValue = 0) => {
  return crypto.createHash('sha256')
    .update(serializeRequestForHash(items, customerName, phone, paymentMode, discountType, discountValue))
    .digest('hex');
};

const matchesRequestHash = (savedHash, currentHash, legacyHash) => (
  !savedHash || savedHash === currentHash || savedHash === legacyHash
);

const presentCheckoutResult = (result) => ({
  ...result,
  invoice: decryptInvoicePii(result.invoice),
  ...(result.customer ? { customer: decryptCustomerPii(result.customer) } : {}),
});

const requestHashError = () => new ConflictError('Idempotency key reused with different cart request payload');

const requireMatchingRequestHash = (invoice, currentHash, legacyHash) => {
  if (!matchesRequestHash(invoice.requestHash, currentHash, legacyHash)) throw requestHashError();
};

/**
 * POS Checkout — Multi-Unit, Idempotent, FOR UPDATE Locked FIFO Transaction Engine.
 */
export const checkout = async ({ idempotencyKey, customerName, phone, paymentMode, items, discountType = 'AMOUNT', discountValue = 0 }) => {
  const normalizedPhone = normalizePhone(phone);

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('Cart cannot be empty');
  }

  const normalizedDiscountType = String(discountType || 'AMOUNT').toUpperCase();
  if (!['AMOUNT', 'PERCENT'].includes(normalizedDiscountType)) {
    throw new ValidationError('Discount type must be amount or percentage');
  }
  let discountValueDec;
  try {
    discountValueDec = new Decimal((discountValue ?? 0).toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  } catch {
    throw new ValidationError('Discount must be a valid number');
  }
  if (!discountValueDec.isFinite() || discountValueDec.isNegative()) {
    throw new ValidationError('Discount must be zero or greater');
  }
  if (normalizedDiscountType === 'PERCENT' && discountValueDec.gt(100)) {
    throw new ValidationError('Percentage discount cannot exceed 100%');
  }

  const currentRequestHash = computeRequestHash(items, customerName, phone, paymentMode, normalizedDiscountType, discountValueDec.toNumber());
  const legacyRequestHash = computeLegacyRequestHash(items, customerName, phone, paymentMode, normalizedDiscountType, discountValueDec.toNumber());

  // Fast check idempotency before transaction
  if (idempotencyKey) {
    const existingInvoice = await prisma.salesInvoice.findUnique({
      where: { idempotencyKey },
      include: { items: true },
    });
    if (existingInvoice) {
      requireMatchingRequestHash(existingInvoice, currentRequestHash, legacyRequestHash);
      logger.info({ idempotencyKey, invoiceNo: existingInvoice.invoiceNo }, 'Idempotent checkout hit: returning existing invoice');
      return presentCheckoutResult({ invoice: existingInvoice, isDuplicate: true });
    }
  }

  const executeTx = async (attempt = 1) => {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // Set lock timeout
          await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5000ms'");

          // Re-check idempotency key inside transaction
          if (idempotencyKey) {
            const existingTxInvoice = await tx.salesInvoice.findUnique({
              where: { idempotencyKey },
              include: { items: true },
            });
            if (existingTxInvoice) {
              requireMatchingRequestHash(existingTxInvoice, currentRequestHash, legacyRequestHash);
              return { invoice: existingTxInvoice, isDuplicate: true };
            }
          }

          // Sort product IDs deterministically to prevent deadlocks
          const rawProductIds = [...new Set(items.map((i) => i.productId))].sort();

          // 1. Pessimistic Row Lock on Products in deterministic order (ORDER BY id ASC)
          const lockedProducts = await tx.$queryRaw`
            SELECT id, name_en, base_unit, allow_decimal_qty, low_stock_threshold, total_stock_base
            FROM products
            WHERE id IN (${Prisma.join(rawProductIds)})
            ORDER BY id ASC
            FOR UPDATE
          `;

          if (!lockedProducts || lockedProducts.length !== rawProductIds.length) {
            const foundIds = lockedProducts.map((p) => p.id);
            const missing = rawProductIds.filter((id) => !foundIds.includes(id));
            throw new NotFoundError(`Products not found: ${missing.join(', ')}`);
          }

          // Fetch product units
          const units = await tx.productUnit.findMany({
            where: { productId: { in: rawProductIds } },
          });

          const productMap = {};
          for (const p of lockedProducts) {
            productMap[p.id] = {
              ...p,
              nameEn: p.name_en,
              baseUnit: p.base_unit,
              allowDecimalQty: p.allow_decimal_qty,
              lowStockThreshold: p.low_stock_threshold,
              totalStockBase: p.total_stock_base,
              units: units.filter((u) => u.productId === p.id),
            };
          }

          const lineItems = [];
          let totalAmountDec = new Decimal(0);
          let totalProfitDec = new Decimal(0);

          // 2. Process each item line
          for (const item of items) {
            const product = productMap[item.productId];

            let unit = null;
            if (item.unitId) {
              unit = product.units.find((u) => u.id === item.unitId);
            }
            if (!unit && item.unitName) {
              unit = product.units.find((u) => u.nameEn === item.unitName);
            }
            if (!unit) {
              unit = product.units.find((u) => u.isSellUnit) || product.units[0];
            }
            if (unit && !unit.isSellUnit) {
              throw new ValidationError(`${unit.nameEn} is not configured as a selling unit for ${product.nameEn}`);
            }

            const factorToBaseDec = new Decimal(unit ? unit.factorToBase.toString() : '1.0');
            const qtyInUnitDec = new Decimal((item.qtyInUnit ?? item.qty ?? 1).toString());

            if (qtyInUnitDec.lte(0)) {
              throw new ValidationError(`Quantity for ${product.nameEn} must be greater than 0`);
            }

            if (!product.allowDecimalQty && !qtyInUnitDec.isInteger()) {
              throw new ValidationError(`Decimal quantity not allowed for ${product.nameEn}`);
            }

            // minQty & qtyStep validation
            if (unit) {
              const minQtyDec = new Decimal((unit.minQty || 1).toString());
              const qtyStepDec = new Decimal((unit.qtyStep || 1).toString());

              if (qtyInUnitDec.lt(minQtyDec)) {
                throw new ValidationError(`Minimum quantity for ${unit.nameEn} is ${minQtyDec}`);
              }

              const stepRemainder = qtyInUnitDec.mod(qtyStepDec);
              if (!stepRemainder.eq(0) && !stepRemainder.eq(qtyStepDec)) {
                throw new ValidationError(`Quantity for ${unit.nameEn} must be a multiple of step size ${qtyStepDec}`);
              }
            }

            const qtyBaseDec = qtyInUnitDec.mul(factorToBaseDec);

            // Stored unit selling price (priceOverride wins if present, else stored unit.sellingPrice)
            let unitPriceDec = new Decimal(0);
            if (unit) {
              if (unit.priceOverride !== null && unit.priceOverride !== undefined && new Decimal(unit.priceOverride.toString()).gt(0)) {
                unitPriceDec = new Decimal(unit.priceOverride.toString());
              } else {
                unitPriceDec = new Decimal(unit.sellingPrice.toString());
              }
            }
            if (unitPriceDec.eq(0) && item.salePrice !== undefined) {
              const fallbackPrice = item.regularPrice ?? item.salePrice;
              unitPriceDec = new Decimal(fallbackPrice.toString());
            }
            const lineTotalDec = unitPriceDec.mul(qtyInUnitDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

            // FIFO stock allocation
            const { allocations, totalCogs } = await computeFIFO(
              product.id,
              qtyBaseDec,
              tx,
              product.nameEn
            );

            const totalCogsDec = new Decimal(totalCogs.toString());
            const lineProfitDec = lineTotalDec.minus(totalCogsDec);

            totalAmountDec = totalAmountDec.add(lineTotalDec);
            totalProfitDec = totalProfitDec.add(lineProfitDec);

            lineItems.push({
              product,
              unit,
              unitName: unit ? unit.nameEn : product.baseUnit,
              factorToBase: factorToBaseDec.toNumber(),
              qtyInUnit: qtyInUnitDec.toNumber(),
              qtyBase: qtyBaseDec.toNumber(),
              unitPrice: unitPriceDec.toNumber(),
              grossLineTotal: lineTotalDec.toNumber(),
              discountAmount: 0,
              lineTotal: lineTotalDec.toNumber(),
              cogs: totalCogsDec.toNumber(),
              grossProfit: lineProfitDec.toNumber(),
              profit: lineProfitDec.toNumber(),
              allocations,
            });
          }

          const subtotalDec = totalAmountDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          const discountAmountDec = normalizedDiscountType === 'PERCENT'
            ? subtotalDec.mul(discountValueDec).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
            : discountValueDec;
          if (discountAmountDec.gt(subtotalDec)) {
            throw new ValidationError('Cart discount cannot exceed the subtotal');
          }

          let remainingDiscountDec = discountAmountDec;
          lineItems.forEach((line, index) => {
            const isLastLine = index === lineItems.length - 1;
            const calculatedDiscountDec = isLastLine
              ? remainingDiscountDec
              : subtotalDec.isZero()
                ? new Decimal(0)
                : discountAmountDec
                  .mul(new Decimal(line.grossLineTotal.toString()))
                  .div(subtotalDec)
                  .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            const allocatedDiscountDec = Decimal.min(calculatedDiscountDec, remainingDiscountDec);

            line.discountAmount = allocatedDiscountDec.toNumber();
            line.lineTotal = new Decimal(line.grossLineTotal.toString()).minus(allocatedDiscountDec).toNumber();
            line.profit = new Decimal(line.grossProfit.toString()).minus(allocatedDiscountDec).toNumber();
            remainingDiscountDec = remainingDiscountDec.minus(allocatedDiscountDec);
          });

          totalAmountDec = subtotalDec.minus(discountAmountDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          totalProfitDec = lineItems.reduce(
            (sum, line) => sum.add(new Decimal(line.profit.toString())),
            new Decimal(0)
          ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

          // 3. Atomically update stock batches and products
          for (const line of lineItems) {
            for (const alloc of line.allocations) {
              await tx.productBatch.update({
                where: { id: alloc.batchId },
                data: {
                  qtyRemainingBase: { decrement: alloc.qtyBase },
                  currentStock: { decrement: Math.round(alloc.qtyBase) },
                },
              });
            }

            const updatedProduct = await tx.product.update({
              where: { id: line.product.id },
              data: {
                totalStockBase: { decrement: line.qtyBase },
              },
            });

            const threshold = Number(updatedProduct.lowStockThreshold) > 0
              ? Number(updatedProduct.lowStockThreshold)
              : Number(updatedProduct.minAlertQty || 0);

            if (Number(updatedProduct.totalStockBase) <= threshold) {
              logger.warn(
                { productId: updatedProduct.id, name: updatedProduct.nameEn, stockBase: updatedProduct.totalStockBase, threshold },
                '⚠️ Low Stock Warning triggered'
              );
            }
          }

          // 4. Generate unique invoice number
          const invoiceNo = await generateInvoiceNumber(tx);

          // 5. Create SalesInvoice + InvoiceItems + BatchAllocations
          const invoice = await tx.salesInvoice.create({
            data: {
              invoiceNo,
              idempotencyKey: idempotencyKey || null,
              requestHash: currentRequestHash,
              customerName: encryptPii(customerName),
              customerPhone: encryptPii(normalizedPhone),
              subtotal: subtotalDec.toFixed(2),
              discountAmount: discountAmountDec.toFixed(2),
              totalAmount: totalAmountDec.toFixed(2),
              totalProfit: totalProfitDec.toFixed(2),
              paymentMode,
              waStatus: 'PENDING',
              items: {
                create: lineItems.map((line) => ({
                  productId: line.product.id,
                  productName: line.product.nameEn,
                  unitName: line.unitName,
                  factorToBase: line.factorToBase,
                  qtyInUnit: line.qtyInUnit,
                  qtyBase: line.qtyBase,
                  unitPrice: line.unitPrice,
                  grossLineTotal: line.grossLineTotal,
                  discountAmount: line.discountAmount,
                  lineTotal: line.lineTotal,
                  cogs: line.cogs,
                  profit: line.profit,
                  batchId: line.allocations[0]?.batchId || '',
                  quantity: Math.round(line.qtyInUnit),
                  unitCost: roundMoney(line.cogs / (line.qtyInUnit || 1)),
                  unitSalePrice: line.unitPrice,
                  lineProfit: line.profit,
                  allocations: {
                    create: line.allocations.map((alloc) => ({
                      batchId: alloc.batchId,
                      qtyBase: alloc.qtyBase,
                      costPerBase: alloc.costPerBase,
                    })),
                  },
                })),
              },
            },
            include: {
              items: {
                include: { allocations: true },
              },
            },
          });

          // 6. Upsert Customer if phone provided
          let customer = null;
          if (normalizedPhone) {
            const firstProduct = lineItems[0]?.product;
            const lastCategory = firstProduct?.categoryId || null;

            customer = await tx.customer.upsert({
              where: { phoneLookup: getCustomerPhoneLookup(normalizedPhone) },
              update: {
                name: encryptPii(customerName),
                lifetimeSpend: { increment: totalAmountDec.toNumber() },
                totalOrders: { increment: 1 },
                lastPurchase: new Date(),
                lastCategory,
              },
              create: {
                phone: encryptPii(normalizedPhone),
                phoneLookup: getCustomerPhoneLookup(normalizedPhone),
                name: encryptPii(customerName),
                firstName: encryptPii(customerName?.split(' ')[0] || null),
                lifetimeSpend: totalAmountDec.toNumber(),
                totalOrders: 1,
                lastPurchase: new Date(),
                lastCategory,
              },
            });

            await tx.salesInvoice.update({
              where: { id: invoice.id },
              data: { customerId: customer.id },
            });
          }

          logger.info(
            { invoiceNo, totalAmount: totalAmountDec.toFixed(2), totalProfit: totalProfitDec.toFixed(2), itemsCount: lineItems.length },
            '✅ Multi-Unit POS Checkout completed successfully'
          );

          return { invoice, customer };
        },
        {
          isolationLevel: 'Serializable',
          timeout: 15000,
        }
      );

      // Invalidate POS product cache strictly POST-COMMIT
      invalidateProductCache();

      return result;
    } catch (err) {
      if ((err.code === '40P01' || err.message?.includes('deadlock') || err.message?.includes('serialization')) && attempt < 3) {
        logger.warn({ attempt }, 'Deadlock/Serialization conflict caught, retrying transaction...');
        await new Promise((res) => setTimeout(res, 50 * attempt));
        return executeTx(attempt + 1);
      }
      throw err;
    }
  };

  try {
    return presentCheckoutResult(await executeTx(1));
  } catch (err) {
    // Catch idempotency key unique constraint violation OUTSIDE the aborted transaction
    if (idempotencyKey && (err.code === 'P2002' || err.message?.includes('idempotency_key'))) {
      const existingInvoice = await prisma.salesInvoice.findUnique({
        where: { idempotencyKey },
        include: { items: true },
      });
      if (existingInvoice) {
        requireMatchingRequestHash(existingInvoice, currentRequestHash, legacyRequestHash);
        return presentCheckoutResult({ invoice: existingInvoice, isDuplicate: true });
      }
    }
    throw err;
  }
};
