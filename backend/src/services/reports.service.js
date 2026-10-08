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
 * Get custom range summary with daily breakdowns and top sellers.
 */
export const getCustomRangeSummary = async (startDate, endDate) => {
  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(0, 0, 0, 0);
  
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  const [invoices, topSellersRaw] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.invoiceItem.groupBy({
      by: ['productId', 'productName'],
      _sum: { quantity: true },
      where: {
        invoice: {
          createdAt: { gte: start, lte: end }
        }
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10, // top 10 sellers in range
    })
  ]);

  const topSellers = topSellersRaw.map(t => ({
    productId: t.productId,
    productName: t.productName,
    totalQtySold: t._sum.quantity,
  }));

  const dailyMap = {};
  
  let current = new Date(start);
  while (current <= end) {
    const dayStr = new Date(current.getTime() - (current.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    dailyMap[dayStr] = {
      date: dayStr,
      totalSales: 0,
      totalProfit: 0,
      invoiceCount: 0
    };
    current.setDate(current.getDate() + 1);
  }

  let totalSalesAggregate = 0;
  let totalProfitAggregate = 0;

  invoices.forEach(inv => {
    const dayStr = new Date(inv.createdAt.getTime() - (inv.createdAt.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    if (dailyMap[dayStr]) {
      dailyMap[dayStr].totalSales += Number(inv.totalAmount);
      dailyMap[dayStr].totalProfit += Number(inv.totalProfit);
      dailyMap[dayStr].invoiceCount += 1;
    } else {
      dailyMap[dayStr] = {
        date: dayStr,
        totalSales: Number(inv.totalAmount),
        totalProfit: Number(inv.totalProfit),
        invoiceCount: 1
      };
    }
    totalSalesAggregate += Number(inv.totalAmount);
    totalProfitAggregate += Number(inv.totalProfit);
  });

  const dailyData = Object.values(dailyMap).map(d => ({
    ...d,
    totalSales: parseFloat(d.totalSales.toFixed(2)),
    totalProfit: parseFloat(d.totalProfit.toFixed(2))
  })).sort((a, b) => a.date.localeCompare(b.date));

  const marginPercentage = totalSalesAggregate > 0 ? (totalProfitAggregate / totalSalesAggregate) * 100 : 0;

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    totalSales: parseFloat(totalSalesAggregate.toFixed(2)),
    totalProfit: parseFloat(totalProfitAggregate.toFixed(2)),
    marginPercentage: parseFloat(marginPercentage.toFixed(2)),
    invoiceCount: invoices.length,
    dailyData,
    topSellers
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
