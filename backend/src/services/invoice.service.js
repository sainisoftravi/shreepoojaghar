import { PrismaClient } from '@prisma/client';
import { decryptInvoicePii, getCustomerPhoneLookup } from '../utils/customer-privacy.js';
import { normalizePhone } from '../utils/phone.js';

const prisma = new PrismaClient();

export const getInvoiceById = async (id) => {
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id },
    include: { items: true, customer: true },
  });
  return decryptInvoicePii(invoice);
};

export const getInvoiceByNumber = async (invoiceNo) => {
  const invoice = await prisma.salesInvoice.findUnique({
    where: { invoiceNo },
    include: { items: true, customer: true },
  });
  return decryptInvoicePii(invoice);
};

export const listInvoices = async ({ page = 1, limit = 20, phone } = {}) => {
  const skip = (page - 1) * limit;
  let where = {};
  
  if (phone) {
    const normalized = normalizePhone(phone);
    if (normalized) {
      where = {
        customer: {
          phoneLookup: getCustomerPhoneLookup(normalized),
        }
      };
    }
  }

  const [invoices, total] = await Promise.all([
    prisma.salesInvoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true, phone: true } } },
    }),
    prisma.salesInvoice.count({ where }),
  ]);
  return { invoices: invoices.map(decryptInvoicePii), total, page, limit };
};

export const markWaQueued = async (invoiceId) => {
  return await prisma.salesInvoice.update({
    where: { id: invoiceId },
    data: { waStatus: 'QUEUED' },
  });
};

export const claimWhatsAppRetry = async (invoiceId) => {
  const result = await prisma.salesInvoice.updateMany({
    where: { id: invoiceId, waStatus: { in: ['FAILED', 'PENDING'] } },
    data: { waStatus: 'QUEUED' },
  });
  return result.count === 1;
};

export const markWaSent = async (invoiceId) => {
  return await prisma.salesInvoice.update({
    where: { id: invoiceId },
    data: { waStatus: 'SENT' },
  });
};

export const markWaFailed = async (invoiceId) => {
  return await prisma.salesInvoice.update({
    where: { id: invoiceId },
    data: { waStatus: 'FAILED' },
  });
};

/**
 * Cancels an invoice completely and restores base stock to exact original batches.
 */
export const cancelInvoice = async (invoiceId) => {
  return await prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: {
          include: { allocations: true },
        },
      },
    });

    if (!invoice) throw new Error('Invoice not found');

    // Restore stock for each line item using allocation records
    for (const item of invoice.items) {
      for (const alloc of item.allocations) {
        await tx.productBatch.update({
          where: { id: alloc.batchId },
          data: {
            qtyRemainingBase: { increment: alloc.qtyBase },
            currentStock: { increment: Math.round(Number(alloc.qtyBase)) },
          },
        });
      }

      await tx.product.update({
        where: { id: item.productId },
        data: {
          totalStockBase: { increment: item.qtyBase },
        },
      });
    }

    // Delete or mark invoice as cancelled
    const deletedInvoice = await tx.salesInvoice.delete({
      where: { id: invoiceId },
    });
    return decryptInvoicePii(deletedInvoice);
  });
};

/**
 * Refunds a specific line item in an invoice and restores base stock to exact original batches.
 */
export const refundInvoiceItem = async (invoiceItemId) => {
  return await prisma.$transaction(async (tx) => {
    const item = await tx.invoiceItem.findUnique({
      where: { id: invoiceItemId },
      include: { allocations: true, invoice: true },
    });

    if (!item) throw new Error('Invoice item not found');

    for (const alloc of item.allocations) {
      await tx.productBatch.update({
        where: { id: alloc.batchId },
        data: {
          qtyRemainingBase: { increment: alloc.qtyBase },
          currentStock: { increment: Math.round(Number(alloc.qtyBase)) },
        },
      });
    }

    await tx.product.update({
      where: { id: item.productId },
      data: {
        totalStockBase: { increment: item.qtyBase },
      },
    });

    // Update invoice total amount and total profit
    await tx.salesInvoice.update({
      where: { id: item.invoiceId },
      data: {
        totalAmount: { decrement: item.lineTotal },
        subtotal: { decrement: item.grossLineTotal },
        discountAmount: { decrement: item.discountAmount },
        totalProfit: { decrement: item.profit },
      },
    });

    return await tx.invoiceItem.delete({
      where: { id: invoiceItemId },
    });
  });
};
