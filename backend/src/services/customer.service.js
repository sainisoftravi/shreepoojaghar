import { PrismaClient } from '@prisma/client';
import { decryptCustomerPii, decryptInvoicePii, getCustomerPhoneLookup } from '../utils/customer-privacy.js';
import { normalizePhone } from '../utils/phone.js';

const prisma = new PrismaClient();

export const listCustomers = async ({ page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      skip,
      take: limit,
      orderBy: { lifetimeSpend: 'desc' },
    }),
    prisma.customer.count(),
  ]);
  return { customers: customers.map(decryptCustomerPii), total, page, limit };
};

export const getCustomerByPhone = async (phone) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  const customer = await prisma.customer.findUnique({
    where: { phoneLookup: getCustomerPhoneLookup(normalizedPhone) },
    include: {
      invoices: {
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!customer) return null;
  return {
    ...decryptCustomerPii(customer),
    invoices: customer.invoices.map(decryptInvoicePii),
  };
};
