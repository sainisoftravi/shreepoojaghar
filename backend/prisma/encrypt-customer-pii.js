import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  assertPiiEncryptionKey,
  decryptPii,
  encryptPii,
  getCustomerPhoneLookup,
  isPiiEncrypted,
} from '../src/utils/customer-privacy.js';
import { normalizePhone } from '../src/utils/phone.js';

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

const pages = async (model, args, transform) => {
  let cursor;
  let changed = 0;

  while (true) {
    const rows = await model.findMany({
      ...args,
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;

    const updates = rows
      .map((row) => ({ id: row.id, data: transform(row) }))
      .filter((entry) => entry.data);

    if (updates.length > 0) {
      await prisma.$transaction(updates.map(({ id, data }) => model.update({ where: { id }, data })));
      changed += updates.length;
    }

    cursor = rows[rows.length - 1].id;
  }

  return changed;
};

const main = async () => {
  assertPiiEncryptionKey();

  const encryptedCustomers = await pages(
    prisma.customer,
    {
      where: {
        OR: [
          { phoneLookup: null },
          { phone: { not: { startsWith: 'enc:v1:' } } },
          { name: { not: { startsWith: 'enc:v1:' } } },
          { firstName: { not: { startsWith: 'enc:v1:' } } },
        ],
      },
    },
    (customer) => {
      const currentPhone = decryptPii(customer.phone);
      const normalizedPhone = normalizePhone(currentPhone) || currentPhone;
      const phoneLookup = customer.phoneLookup || getCustomerPhoneLookup(normalizedPhone);
      const data = {};

      if (!isPiiEncrypted(customer.phone) || currentPhone !== normalizedPhone) data.phone = encryptPii(normalizedPhone);
      if (!customer.phoneLookup) data.phoneLookup = phoneLookup;
      if (customer.name !== null && !isPiiEncrypted(customer.name)) data.name = encryptPii(customer.name);
      if (customer.firstName !== null && !isPiiEncrypted(customer.firstName)) data.firstName = encryptPii(customer.firstName);

      return Object.keys(data).length ? data : null;
    }
  );

  const encryptedInvoices = await pages(
    prisma.salesInvoice,
    {
      where: {
        OR: [
          { customerPhone: { not: { startsWith: 'enc:v1:' } } },
          { customerName: { not: { startsWith: 'enc:v1:' } } },
        ],
      },
    },
    (invoice) => {
      const data = {};
      if (invoice.customerPhone !== null && !isPiiEncrypted(invoice.customerPhone)) {
        data.customerPhone = encryptPii(invoice.customerPhone);
      }
      if (invoice.customerName !== null && !isPiiEncrypted(invoice.customerName)) {
        data.customerName = encryptPii(invoice.customerName);
      }
      return Object.keys(data).length ? data : null;
    }
  );

  console.info(`Customer PII encryption complete. Updated ${encryptedCustomers} customers and ${encryptedInvoices} invoices.`);
};

main()
  .catch(() => {
    console.error('Customer PII encryption failed. Check the configured key, database connection, and applied migrations.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
