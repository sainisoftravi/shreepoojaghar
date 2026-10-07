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

  const [ivText, authTagText, ciphertextText] = value.slice(ENCRYPTED_PREFIX.length).split(':');
  if (!ivText || !authTagText || ciphertextText === undefined) {
    throw new Error('Stored customer data has an invalid encrypted format');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getMasterKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

export const getCustomerPhoneLookup = (normalizedPhone) => crypto
  .createHmac('sha256', deriveKey('customer-phone-lookup'))
  .update(String(normalizedPhone || ''))
  .digest('hex');

export const hashCheckoutRequest = (serializedRequest) => crypto
  .createHmac('sha256', deriveKey('checkout-request-hash'))
  .update(serializedRequest)
  .digest('hex');

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

export const decryptInvoicePii = (invoice) => {
  if (!invoice) return invoice;
  return {
    ...invoice,
    customerPhone: decryptPii(invoice.customerPhone),
    customerName: decryptPii(invoice.customerName),
    ...(invoice.customer ? { customer: decryptCustomerPii(invoice.customer) } : {}),
  };
};
