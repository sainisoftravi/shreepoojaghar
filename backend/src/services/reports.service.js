import { PrismaClient } from '@prisma/client';
import { decryptCustomerPii, decryptInvoicePii } from '../utils/customer-privacy.js';

const prisma = new PrismaClient();

/**
 * Get daily summary for a given date (defaults to today).
 * Uses locked invoice costs — never recalculates from product data.
 */
export const getDailySummary = async (dateStr) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));

  const invoices = await prisma.salesInvoice.findMany({
    where: {
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  });

  const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
  const totalProfit = invoices.reduce((sum, inv) => sum + Number(inv.totalProfit), 0);
  const invoiceCount = invoices.length;
  const marginPercentage = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

  // Payment mode breakdown
  const paymentBreakdown = invoices.reduce((acc, inv) => {
    acc[inv.paymentMode] = (acc[inv.paymentMode] || 0) + Number(inv.totalAmount);
    return acc;
  }, {});

  return {
    date: startOfDay.toISOString().split('T')[0],
    totalSales: parseFloat(totalSales.toFixed(2)),
    totalProfit: parseFloat(totalProfit.toFixed(2)),
    marginPercentage: parseFloat(marginPercentage.toFixed(2)),
    invoiceCount,
    paymentBreakdown,
  };
};

/**
 * Dashboard overview — today's stats + low stock + top sellers
 */
export const getDashboard = async () => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  // Today's invoices
  const [invoices, totalCustomers, recentInvoices] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: { createdAt: { gte: startOfDay, lte: endOfDay } },
    }),
    prisma.customer.count(),
    prisma.salesInvoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true, phone: true } } },
    }),
  ]);

  const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
  const totalProfit = invoices.reduce((sum, inv) => sum + Number(inv.totalProfit), 0);
  const invoiceCount = invoices.length;
  const marginPercentage = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

  // Low stock products
  const products = await prisma.product.findMany({
    include: {
      category: { select: { nameEn: true } },
      batches: { where: { currentStock: { gt: 0 } } },
    },
  });

  const lowStock = products
    .map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      category: p.category.nameEn,
      totalStock: p.batches.reduce((s, b) => s + b.currentStock, 0),
      minAlertQty: p.minAlertQty,
    }))
    .filter((p) => p.totalStock <= p.minAlertQty);

  // Top selling products (by quantity sold)
  const topSellers = await prisma.invoiceItem.groupBy({
    by: ['productId', 'productName'],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 5,
  });

  return {
    today: {
      totalSales: parseFloat(totalSales.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      marginPercentage: parseFloat(marginPercentage.toFixed(2)),
      invoiceCount,
    },
    totalCustomers,
    recentInvoices: recentInvoices.map(decryptInvoicePii),
    lowStock,
    topSellers: topSellers.map((t) => ({
      productId: t.productId,
      productName: t.productName,
      totalQtySold: t._sum.quantity,
    })),
  };
};

/**
 * Customer lifetime value report
 */
export const getCustomerLTV = async ({ limit = 20, page = 1 } = {}) => {
  const skip = (page - 1) * limit;
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { lifetimeSpend: 'desc' },
      skip,
      take: limit,
    }),
    prisma.customer.count(),
  ]);

  return { customers: customers.map(decryptCustomerPii), total, page, limit };
};
