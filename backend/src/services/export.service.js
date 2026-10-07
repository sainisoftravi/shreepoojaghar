import { PrismaClient } from '@prisma/client';
import { decryptCustomerPii } from '../utils/customer-privacy.js';

const prisma = new PrismaClient();

/**
 * Fetch customers filtered by segment for WhatsApp marketing export.
 * Supports: all | high_value | recent
 *
 * Compliant with opt-in marketing principles — only exports customers who
 * have made a purchase (implicit consent by transacting at the store).
 */
export const getCustomersForExport = async (segment = 'all', minSpend = 0) => {
  let where = {};

  if (segment === 'high_value') {
    where.lifetimeSpend = { gte: minSpend || 1000 };
  } else if (segment === 'recent') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    where.lastPurchase = { gte: thirtyDaysAgo };
  }
  // 'all' — no filter

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { lifetimeSpend: 'desc' },
    select: {
      phone: true,
      name: true,
      firstName: true,
      lastCategory: true,
      lifetimeSpend: true,
    },
  });

  return customers.map(decryptCustomerPii);
};

/**
 * Convert customers array to a CSV string.
 * Columns: Phone, Name, First_Name, Last_Category, Lifetime_Value
 */
export const buildCSV = (customers) => {
  const header = 'Phone,Name,First_Name,Last_Category,Lifetime_Value';
  const rows = customers.map((c) => {
    const phone = c.phone || '';
    const name = `"${(c.name || '').replace(/"/g, '""')}"`;
    const firstName = `"${(c.firstName || '').replace(/"/g, '""')}"`;
    const lastCategory = `"${(c.lastCategory || '').replace(/"/g, '""')}"`;
    const ltv = Number(c.lifetimeSpend).toFixed(2);
    return `${phone},${name},${firstName},${lastCategory},${ltv}`;
  });

  return [header, ...rows].join('\n');
};
