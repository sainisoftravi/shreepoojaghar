import crypto from 'crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';

const getMasterKey = () => {
  const keyHex = process.env.PII_ENCRYPTION_KEY;
  if (!/^[0-9a-f]{64}$/i.test(keyHex || '')) {
    throw new Error('PII_ENCRYPTION_KEY must be configured as a 64-character hex key');
  }
  return Buffer.from(keyHex, 'hex');
};

const deriveKey = (purpose) => crypto
  .createHmac('sha256', getMasterKey())
  .update(`shree-pooja-ghar:${purpose}:v1`)
  .digest();

export const assertPiiEncryptionKey = () => {
  getMasterKey();
};

export const isPiiEncrypted = (value) => typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);

export const encryptPii = (value) => {
  if (value === null || value === undefined) return value;
  const text = String(value);
  if (isPiiEncrypted(text)) return text;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}:${authTag.toString('base64url')}:${ciphertext.toString('base64url')}`;
};

export const decryptPii = (value) => {
  if (value === null || value === undefined || !isPiiEncrypted(value)) return value;

  try {
    const [ivText, authTagText, ciphertextText] = value.slice(ENCRYPTED_PREFIX.length).split(':');
    if (!ivText || !authTagText || ciphertextText === undefined) {
      return value;
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', getMasterKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTagText, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    // Graceful fallback if key changed or data authentication tag fails
    return value;
  }
};

export const getCustomerPhoneLookup = (normalizedPhone) => crypto
  .createHmac('sha256', deriveKey('customer-phone-lookup'))
  .update(String(normalizedPhone || ''))
  .digest('hex');

export const hashCheckoutRequest = (serializedRequest) => crypto
  .createHmac('sha256', deriveKey('checkout-request-hash'))
  .update(serializedRequest)
  .digest('hex');

export const getUserEmailLookup = (email) => {
  if (!email) return null;
  return crypto
    .createHmac('sha256', deriveKey('user-email-lookup'))
    .update(String(email).trim().toLowerCase())
    .digest('hex');
};

export const getBarcodeLookup = (barcode) => {
  if (!barcode) return null;
  return crypto
    .createHmac('sha256', deriveKey('barcode-lookup'))
    .update(String(barcode).trim())
    .digest('hex');
};

export const decryptUser = (user) => {
  if (!user) return user;
  const { emailLookup, ...publicUser } = user;
  return {
    ...publicUser,
    name: decryptPii(user.name),
    email: decryptPii(user.email),
  };
};

export const decryptCategory = (category) => {
  if (!category) return category;
  return {
    ...category,
    nameEn: decryptPii(category.nameEn),
    nameHi: decryptPii(category.nameHi),
  };
};

export const decryptProductUnit = (unit) => {
  if (!unit) return unit;
  const { barcodeLookup, ...rest } = unit;
  return {
    ...rest,
    nameEn: decryptPii(unit.nameEn),
    nameHi: decryptPii(unit.nameHi),
    barcode: decryptPii(unit.barcode),
  };
};

export const decryptProductBatch = (batch) => {
  if (!batch) return batch;
  return {
    ...batch,
    vendor: decryptPii(batch.vendor),
  };
};

export const decryptProduct = (product) => {
  if (!product) return product;
  const { barcodeLookup, ...rest } = product;
  return {
    ...rest,
    nameEn: decryptPii(product.nameEn),
    nameHi: decryptPii(product.nameHi),
    barcode: decryptPii(product.barcode),
    ...(product.category ? { category: decryptCategory(product.category) } : {}),
    ...(product.units ? { units: product.units.map(decryptProductUnit) } : {}),
    ...(product.batches ? { batches: product.batches.map(decryptProductBatch) } : {}),
  };
};

export const decryptCustomerPii = (customer) => {
  if (!customer) return customer;
  const { phoneLookup, ...publicCustomer } = customer;
  return {
    ...publicCustomer,
    phone: decryptPii(customer.phone),
    name: decryptPii(customer.name),
    firstName: decryptPii(customer.firstName),
  };
};

export const decryptInvoiceItem = (item) => {
  if (!item) return item;
  return {
    ...item,
    productName: decryptPii(item.productName),
    unitName: decryptPii(item.unitName),
    product: item.product ? decryptProduct(item.product) : item.product,
  };
};

export const decryptInvoicePii = (invoice) => {
  if (!invoice) return invoice;
  return {
    ...invoice,
    customerPhone: decryptPii(invoice.customerPhone),
    customerName: decryptPii(invoice.customerName),
    ...(invoice.customer ? { customer: decryptCustomerPii(invoice.customer) } : {}),
    ...(invoice.items ? { items: invoice.items.map(decryptInvoiceItem) } : {}),
  };
};

