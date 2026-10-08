import './whatsapp-webjs-media-fix.js';
import { logger } from '../config/logger.js';
import { generateReceiptPDF } from './receipt.service.js';
import fs from 'fs';
import path from 'path';

// Import after the compatibility patch so whatsapp-web.js injects the fixed Utils.js.
const { Client, LocalAuth, MessageMedia } = (await import('whatsapp-web.js')).default;

/**
 * WhatsApp Service — whatsapp-web.js
 *
 * Auth Strategy:
 *   - If WHATSAPP_PHONE_PAIR is set in .env, uses phone-number pairing (no QR scan needed).
 *     Set WHATSAPP_PHONE_PAIR to your full WhatsApp number with country code, e.g. 917877496745
 *   - Otherwise falls back to QR code in terminal.
 */

export let waStatus = 'INITIALIZING'; // INITIALIZING, QR_READY, CONNECTED, DISCONNECTED
export let connectedPhone = null;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  },
});

let isClientReady = false;
const readyWaiters = new Set();

client.on('qr', async (qr) => {
  logger.info('WhatsApp Client is waiting for pairing...');
  waStatus = 'QR_READY';
});

client.on('ready', () => {
  logger.info('✅ WhatsApp Client is ready!');
  isClientReady = true;
  waStatus = 'CONNECTED';
  connectedPhone = client.info?.wid?.user || null;
  for (const resolve of readyWaiters) resolve();
  readyWaiters.clear();
});

client.on('authenticated', () => {
  logger.info('WhatsApp Client authenticated successfully');
  waStatus = 'CONNECTED';
});

client.on('auth_failure', (msg) => {
  logger.error({ msg }, 'WhatsApp authentication failed');
  isClientReady = false;
  waStatus = 'DISCONNECTED';
});

client.on('disconnected', (reason) => {
  logger.warn({ reason }, 'WhatsApp client disconnected');
  isClientReady = false;
  waStatus = 'DISCONNECTED';
  connectedPhone = null;
});

export const requestPairingCode = async (phone) => {
  if (isClientReady) throw new Error('WhatsApp is already connected');
  logger.info(`Requesting WhatsApp pairing code for phone: ${phone}`);
  const code = await client.requestPairingCode(phone);
  return code;
};

export const getWhatsAppStatus = () => {
  return { status: waStatus, connectedPhone: client?.info?.wid?.user || connectedPhone };
};

export const logoutWhatsApp = async () => {
  if (client) {
    try {
      await client.logout();
    } catch (e) {
      logger.error({ err: e }, 'Error logging out');
    }
    waStatus = 'DISCONNECTED';
    isClientReady = false;
    connectedPhone = null;
    try {
      await client.destroy();
      client.initialize();
    } catch (e) {}
  }
};

const cleanupChromiumLocks = (dir) => {
  if (!fs.existsSync(dir)) return;
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        cleanupChromiumLocks(fullPath);
      } else if (file.name.includes('Singleton')) {
        try {
          fs.unlinkSync(fullPath);
          logger.info(`Cleaned stale Chromium lock file: ${file.name}`);
        } catch (e) {}
      }
    }
  } catch (err) {}
};

cleanupChromiumLocks('./.wwebjs_auth');

client.initialize().catch((err) => {
  logger.error({ err }, 'WhatsApp Client initialization warning — server will continue running');
});

export const waitForWhatsAppClientReady = async () => {
  if (isClientReady) return;

  logger.info('WhatsApp invoice is waiting for the client to connect');
  await new Promise((resolve) => {
    const resolveWhenReady = () => {
      readyWaiters.delete(resolveWhenReady);
      resolve();
    };
    readyWaiters.add(resolveWhenReady);
    // Recheck after registering so a ready event cannot be missed.
    if (isClientReady) resolveWhenReady();
  });
};

// ─── Receipt formatting ──────────────────────────────────────────────────────

const buildReceiptCaption = (invoice) => {
  const date = new Date(invoice.createdAt).toLocaleString('en-IN', {
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

const getWhatsAppChatId = (phone) => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;

  if (digits.length < 11 || digits.length > 15) {
    throw new Error('Customer phone number is not a valid WhatsApp number');
  }
  return `${digits}@c.us`;
};

// ─── Main export ─────────────────────────────────────────────────────────────

export const sendWhatsAppInvoice = async (invoice) => {
  const mockMode = process.env.NODE_ENV === 'test' || process.env.WHATSAPP_PROVIDER === 'mock';
  if (!mockMode) await waitForWhatsAppClientReady();

  logger.info({ invoiceNo: invoice.invoiceNo }, 'Generating PDF receipt...');

  let pdfBuffer;
  try {
    pdfBuffer = await generateReceiptPDF(invoice);
  } catch (err) {
    logger.error({ err, invoiceNo: invoice.invoiceNo }, 'PDF generation failed');
    throw err;
  }

  // Mock mode — save PDF locally
  if (mockMode) {
    const filepath = path.join(process.cwd(), `receipt_${invoice.invoiceNo}.pdf`);
    fs.writeFileSync(filepath, pdfBuffer);
    logger.info({ filepath }, '[MOCK] Receipt PDF saved locally');
    return;
  }

  // Normalize phone number for WhatsApp
  // Strip everything except digits
  const chatId = getWhatsAppChatId(invoice.customerPhone);

  const caption = buildReceiptCaption(invoice);

  // Convert pdfBuffer safely — Puppeteer may return Uint8Array instead of Buffer
  const safeBuffer = Buffer.isBuffer(pdfBuffer)
    ? pdfBuffer
    : Buffer.from(pdfBuffer);
  const base64Data = safeBuffer.toString('base64');

  // Send PDF as attachment
  const media = new MessageMedia(
    'application/pdf',
    base64Data,
    `Invoice_${invoice.invoiceNo}.pdf`
  );

  await client.sendMessage(chatId, media, { caption });

  logger.info(
    { invoiceNo: invoice.invoiceNo },
    '✅ WhatsApp invoice PDF sent'
  );
};
