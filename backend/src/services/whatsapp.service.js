import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';
import { generateReceiptPDF, generateThermalReceiptPDF } from './receipt.service.js';
import { decryptProduct, decryptCustomerPii } from '../utils/customer-privacy.js';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

/**
 * Lightweight WhatsApp Service powered by @whiskeysockets/baileys
 * Pure WebSocket implementation — zero Chromium/browser overhead, uses ~35MB RAM.
 */

export let waStatus = 'INITIALIZING'; // INITIALIZING, QR_READY, CONNECTED, DISCONNECTED
export let connectedPhone = null;
export let waQrCode = null;

let sock = null;
let saveCreds = null;
const readyWaiters = new Set();

const AUTH_DIR = path.resolve(process.cwd(), '.baileys_auth');

const clearAuthDir = () => {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      for (const file of fs.readdirSync(AUTH_DIR)) {
        fs.rmSync(path.join(AUTH_DIR, file), { recursive: true, force: true });
      }
    }
  } catch (err) {
    logger.warn({ err: err?.message }, 'Failed to clear auth directory files');
  }
};

export const initWhatsApp = async () => {
  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds: sc } = await useMultiFileAuthState(AUTH_DIR);
    saveCreds = sc;

    const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
      version: [2, 3000, 1015901307],
      isLatest: true,
    }));
    logger.info({ version, isLatest }, 'Starting Baileys WhatsApp client');

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info('WhatsApp QR code ready');
        waQrCode = qr;
        waStatus = 'QR_READY';
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        logger.warn({ statusCode, shouldReconnect }, 'WhatsApp connection closed');

        waStatus = 'DISCONNECTED';
        waQrCode = null;
        connectedPhone = null;

        if (shouldReconnect) {
          logger.info('Reconnecting to WhatsApp in 5s...');
          setTimeout(initWhatsApp, 5000);
        }
      } else if (connection === 'open') {
        logger.info('✅ WhatsApp Client is connected and ready!');
        waStatus = 'CONNECTED';
        waQrCode = null;
        const rawId = sock?.user?.id || '';
        connectedPhone = rawId.split(':')[0] || rawId.split('@')[0] || null;

        for (const resolve of readyWaiters) resolve();
        readyWaiters.clear();
      }
    });
  } catch (err) {
    logger.error({ err: err.message }, 'WhatsApp Client initialization warning — server will continue running');
    waStatus = 'DISCONNECTED';
    setTimeout(initWhatsApp, 15000);
  }
};

// Start Baileys socket on startup
initWhatsApp();

export const requestPairingCode = async (phone) => {
  if (waStatus === 'CONNECTED') throw new Error('WhatsApp is already connected');
  if (!phone) throw new Error('Phone number is required');

  const cleanPhone = String(phone).replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    throw new Error('Please enter a valid phone number with country code (e.g. 917877496745)');
  }

  try {
    if (!sock || waStatus === 'DISCONNECTED') {
      logger.info('WhatsApp socket disconnected. Reinitializing before pairing...');
      await initWhatsApp();
      await new Promise((r) => setTimeout(r, 2500));
    }

    logger.info(`Requesting WhatsApp pairing code for phone: ${cleanPhone}`);
    return await sock.requestPairingCode(cleanPhone);
  } catch (err) {
    logger.warn({ err: err.message }, 'Pairing code request failed, resetting stale session and retrying...');
    try {
    clearAuthDir();
    } catch (_) {}

    await initWhatsApp();
    await new Promise((r) => setTimeout(r, 3000));

    if (!sock) {
      throw new Error('Failed to reconnect to WhatsApp server. Please try again.');
    }

    return await sock.requestPairingCode(cleanPhone);
  }
};

export const getWhatsAppStatus = () => {
  return {
    status: waStatus,
    connectedPhone,
    qr: waQrCode,
  };
};

export const logoutWhatsApp = async () => {
  try {
    if (sock) {
      await sock.logout().catch(() => {});
      try { sock.end?.(); } catch (_) {}
      sock = null;
    }
  } catch (e) {
    logger.error({ err: e }, 'Error logging out from WhatsApp');
  }
  waStatus = 'DISCONNECTED';
  connectedPhone = null;
  waQrCode = null;
  clearAuthDir();
  setTimeout(initWhatsApp, 1500);
};

export const refreshWhatsAppQR = async () => {
  try {
    if (sock) {
      try { sock.end?.(); } catch (_) {}
      sock = null;
    }
  } catch (_) {}
  waStatus = 'DISCONNECTED';
  waQrCode = null;
  connectedPhone = null;
  clearAuthDir();
  await initWhatsApp();
  for (let i = 0; i < 20; i++) {
    if (waQrCode) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  return {
    status: waStatus,
    qr: waQrCode,
  };
};

export const waitForWhatsAppClientReady = async () => {
  if (waStatus === 'CONNECTED') return;

  logger.info('WhatsApp invoice is waiting for client to connect');
  await new Promise((resolve) => {
    const resolveWhenReady = () => {
      readyWaiters.delete(resolveWhenReady);
      resolve();
    };
    readyWaiters.add(resolveWhenReady);
    if (waStatus === 'CONNECTED') resolveWhenReady();
  });
};

const buildReceiptCaption = (invoice) => {
  const date = new Date(invoice.createdAt || Date.now()).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const lines = [
    '🙏 *Shree Pooja Ghar - Purchase invoice*',
    `Invoice: ${invoice.invoiceNo}`,
    `Date: ${date}`,
    `Customer: ${invoice.customerName || 'Guest Customer'}`,
    `Subtotal: ₹${Number(invoice.subtotal ?? invoice.totalAmount).toFixed(2)}`,
  ];
  if (Number(invoice.discountAmount || 0) > 0) {
    lines.push(`Cart discount: −₹${Number(invoice.discountAmount).toFixed(2)}`);
  }
  lines.push(
    `Total: ₹${Number(invoice.totalAmount).toFixed(2)}`,
    `Payment: ${invoice.paymentMode || 'Other'}`,
    '',
    'Your itemized PDF invoice is attached. Thank you for shopping with us.'
  );
  return lines.join('\n');
};

const getWhatsAppRecipientJid = (phone) => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;

  if (digits.length < 11 || digits.length > 15) {
    throw new Error('Customer phone number is not a valid WhatsApp number');
  }
  return `${digits}@s.whatsapp.net`;
};

export const sendWhatsAppInvoice = async (invoice) => {
  const mockMode = process.env.NODE_ENV === 'test' || process.env.WHATSAPP_PROVIDER === 'mock';
  if (!mockMode) await waitForWhatsAppClientReady();

  logger.info({ invoiceNo: invoice.invoiceNo }, 'Generating thermal PDF receipt...');

  let pdfBuffer;
  try {
    pdfBuffer = await generateThermalReceiptPDF(invoice);
  } catch (err) {
    logger.error({ err, invoiceNo: invoice.invoiceNo }, 'Thermal PDF generation failed');
    throw err;
  }

  if (mockMode) {
    const filepath = path.join(process.cwd(), `receipt_${invoice.invoiceNo}.pdf`);
    fs.writeFileSync(filepath, pdfBuffer);
    logger.info({ filepath }, '[MOCK] Receipt PDF saved locally');
    return;
  }

  const recipientJid = getWhatsAppRecipientJid(invoice.customerPhone);
  const caption = buildReceiptCaption(invoice);
  const safeBuffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

  await sock.sendMessage(recipientJid, {
    document: safeBuffer,
    mimetype: 'application/pdf',
    fileName: `Invoice_${invoice.invoiceNo}.pdf`,
    caption,
  });

  logger.info({ invoiceNo: invoice.invoiceNo, recipientJid }, '✅ WhatsApp invoice PDF sent successfully');
};

// ─── Product Arrival Broadcast ───────────────────────────────────────────────

const buildProductBroadcastCaption = ({ customerName, product, type = 'NEW_PRODUCT' }) => {
  const storeName = process.env.STORE_NAME || 'श्री पूजा घर (Shree Pooja Ghar)';
  const storeAddress = process.env.STORE_ADDRESS || 'अजमेर, राजस्थान';
  const storePhone = process.env.STORE_PHONE || connectedPhone || '';

  const nameHi = product.nameHi ? product.nameHi.trim() : '';
  const nameEn = product.nameEn ? product.nameEn.trim() : '';
  const displayName = nameHi && nameEn && nameHi !== nameEn 
    ? `${nameHi} (${nameEn})` 
    : (nameHi || nameEn);

  const headline = type === 'NEW_BATCH' 
    ? '✨ *नया स्टॉक आ चुका है!*' 
    : '✨ *नया सामान दुकान पर उपलब्ध है!*';

  const customerGreeting = customerName && customerName.trim() && customerName !== 'Guest Customer'
    ? `नमस्ते *${customerName.trim()}* जी! 🙏`
    : 'नमस्ते! 🙏';

  const lines = [
    `🌸 *${storeName}* 🌸`,
    '',
    customerGreeting,
    '',
    headline,
    `📦 *${displayName}*`,
    '',
    '✅ शुद्ध एवं प्रामाणिक पूजा सामग्री अब उपलब्ध है। आज ही दुकान पर पधारें या संपर्क करें!',
    '',
    `📍 *पता:* ${storeAddress}`,
    `📞 *संपर्क / WhatsApp:* ${storePhone}`,
  ];

  return lines.join('\n');
};

export const broadcastProductArrival = async ({ productId, type = 'NEW_PRODUCT' }) => {
  const mockMode = process.env.NODE_ENV === 'test' || process.env.WHATSAPP_PROVIDER === 'mock';
  if (!mockMode) await waitForWhatsAppClientReady();

  // 1. Fetch product
  const rawProduct = await prisma.product.findUnique({
    where: { id: productId },
    include: { units: true, category: true },
  });
  if (!rawProduct) {
    logger.warn({ productId }, 'Product not found for WhatsApp broadcast');
    return;
  }
  const product = decryptProduct(rawProduct);

  // 2. Fetch all registered customers
  const rawCustomers = await prisma.customer.findMany({
    select: { id: true, name: true, phone: true, firstName: true },
  });

  const customers = rawCustomers
    .map((c) => decryptCustomerPii(c))
    .filter((c) => c && c.phone && String(c.phone).replace(/\D/g, '').length >= 10);

  logger.info(
    { productId, product: product.nameEn, totalCustomers: customers.length },
    'Starting product arrival WhatsApp broadcast'
  );

  if (customers.length === 0) {
    logger.info('No customers found with valid phone numbers for broadcast');
    return;
  }

  // 3. Check for product image (supports Cloudinary HTTPS URL or local file)
  let imageBuffer = null;
  if (product.imageUrl) {
    if (product.imageUrl.startsWith('http://') || product.imageUrl.startsWith('https://')) {
      try {
        const resp = await fetch(product.imageUrl);
        if (resp.ok) {
          const arrayBuffer = await resp.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
        } else {
          logger.warn({ status: resp.status, url: product.imageUrl }, 'Failed to download product image from remote URL');
        }
      } catch (err) {
        logger.warn({ err: err.message, url: product.imageUrl }, 'Could not fetch remote product image for broadcast');
      }
    } else {
      const cleanPath = product.imageUrl.replace(/^\//, '');
      const fullPath = path.resolve(process.cwd(), cleanPath);
      if (fs.existsSync(fullPath)) {
        try {
          imageBuffer = fs.readFileSync(fullPath);
        } catch (err) {
          logger.warn({ err: err.message, fullPath }, 'Could not read product image file for broadcast');
        }
      }
    }
  }

  // 4. Send to each customer with 4-second delay
  let sentCount = 0;
  let failCount = 0;

  for (const customer of customers) {
    try {
      const recipientJid = getWhatsAppRecipientJid(customer.phone);
      const customerName = customer.name || customer.firstName || 'Customer';
      const caption = buildProductBroadcastCaption({ customerName, product, type });

      if (mockMode) {
        logger.info({ customerName, phone: customer.phone }, '[MOCK] Broadcast simulated');
      } else {
        if (imageBuffer) {
          await sock.sendMessage(recipientJid, {
            image: imageBuffer,
            caption,
          });
        } else {
          await sock.sendMessage(recipientJid, {
            text: caption,
          });
        }
      }

      sentCount++;
      logger.info(
        { customerName, phone: customer.phone, sentCount, total: customers.length },
        'WhatsApp broadcast sent to customer'
      );

      // Safe pacing: 4 seconds between messages to protect WhatsApp number
      await new Promise((resolve) => setTimeout(resolve, 4000));
    } catch (err) {
      failCount++;
      logger.error({ err: err.message, customerId: customer.id }, 'Failed to send broadcast to customer');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  logger.info(
    { productId, sentCount, failCount, total: customers.length },
    'WhatsApp product broadcast completed'
  );
};
