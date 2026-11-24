import { PrismaClient } from '@prisma/client';
import { decryptCustomerPii, decryptInvoicePii, encryptPii, getCustomerPhoneLookup } from '../utils/customer-privacy.js';
import { normalizePhone } from '../utils/phone.js';
import { NotFoundError, ValidationError } from '../utils/AppError.js';

const prisma = new PrismaClient();

export const listCustomers = async ({ page = 1, limit = 100 } = {}) => {
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

export const createCustomer = async ({ name, phone }) => {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) throw new ValidationError('Customer name is required');

  const rawDigits = String(phone || '').replace(/\D/g, '');
  if (!rawDigits || rawDigits.length < 10) {
    throw new ValidationError('Please enter a valid 10-digit phone number');
  }

  const normalizedPhone = normalizePhone(phone);
  const phoneLookup = getCustomerPhoneLookup(normalizedPhone);

  const existing = await prisma.customer.findUnique({ where: { phoneLookup } });
  if (existing) {
    throw new ValidationError('A customer with this phone number already exists');
  }

  const customer = await prisma.customer.create({
    data: {
      phone: encryptPii(normalizedPhone),
      phoneLookup,
      name: encryptPii(trimmedName),
      firstName: encryptPii(trimmedName.split(/\s+/)[0] || null),
      totalOrders: 0,
      lifetimeSpend: 0,
    },
  });

  return decryptCustomerPii(customer);
};

export const updateCustomer = async (id, data) => {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new NotFoundError('Customer not found');

  const updateData = {};

  if (data.name !== undefined) {
    const trimmedName = String(data.name || '').trim();
    if (!trimmedName) {
      throw new ValidationError('Customer name cannot be empty');
    }
    const firstName = trimmedName.split(/\s+/)[0] || '';
    updateData.name = encryptPii(trimmedName);
    updateData.firstName = encryptPii(firstName);
  }

  if (data.phone !== undefined) {
    const rawDigits = String(data.phone || '').replace(/\D/g, '');
    if (!rawDigits || rawDigits.length < 10) {
      throw new ValidationError('Please enter a valid 10-digit phone number');
    }
    const normalizedPhone = normalizePhone(data.phone);
    const phoneLookup = getCustomerPhoneLookup(normalizedPhone);

    const existing = await prisma.customer.findFirst({
      where: {
        phoneLookup,
        NOT: { id },
      },
    });

    if (existing) {
      throw new ValidationError('Another customer with this phone number already exists');
    }

    updateData.phone = encryptPii(normalizedPhone);
    updateData.phoneLookup = phoneLookup;
  }

  const updated = await prisma.customer.update({
    where: { id },
    data: updateData,
  });

  return decryptCustomerPii(updated);
};

export const deleteCustomer = async (id) => {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new NotFoundError('Customer not found');

  return await prisma.$transaction(async (tx) => {
    // Unlink any invoices tied to this customer so financial records remain intact
    await tx.salesInvoice.updateMany({
      where: { customerId: id },
      data: { customerId: null },
    });

    return await tx.customer.delete({
      where: { id },
    });
  });
};
