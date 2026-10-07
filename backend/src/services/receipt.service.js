import puppeteer from 'puppeteer';
import { logger } from '../config/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`;
const getItemGrossTotal = (item) => {
  const grossLineTotal = Number(item.grossLineTotal);
  if (item.grossLineTotal !== undefined && item.grossLineTotal !== null && Number.isFinite(grossLineTotal)) {
    return grossLineTotal;
  }
  const lineTotal = Number(item.lineTotal);
  return Number.isFinite(lineTotal) ? lineTotal : Number(item.unitPrice ?? item.unitSalePrice ?? 0) * Number(item.qtyInUnit ?? item.quantity ?? 1);
};
const getInvoiceSubtotal = (invoice, items) => {
  const subtotal = Number(invoice.subtotal);
  return invoice.subtotal !== undefined && invoice.subtotal !== null && Number.isFinite(subtotal)
    ? subtotal
    : items.reduce((sum, item) => sum + getItemGrossTotal(item), 0);
};

export const generateReceiptPDF = async (invoice) => {
  const createdAt = new Date(invoice.createdAt || Date.now());
  const date = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
  const dateLabel = date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
  });
  const timeLabel = date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
  });
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotal = getInvoiceSubtotal(invoice, items);
  const discountAmount = Number(invoice.discountAmount || 0);
  const total = Number(invoice.totalAmount || 0);
  const paymentLabels = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', KHATA: 'Khata' };
  const paymentMode = paymentLabels[String(invoice.paymentMode || '').toUpperCase()] || 'Other';
  const storeName = escapeHtml(process.env.STORE_NAME || 'Shree Pooja Ghar');
  const storeAddress = escapeHtml(process.env.STORE_ADDRESS || 'Ajmer, Rajasthan, India');
  const storePhone = process.env.STORE_PHONE ? escapeHtml(process.env.STORE_PHONE) : '';
  const customerName = escapeHtml(invoice.customerName || 'Guest Customer');
  const customerPhone = escapeHtml(invoice.customerPhone || 'Not provided');
  const invoiceNo = escapeHtml(invoice.invoiceNo || 'N/A');
  const logoPath = path.resolve(__dirname, '../../assets/store-logo.png');
  const logo = fs.existsSync(logoPath)
    ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
    : '';

  const itemRows = items.map((item) => {
    const qty = Number(item.qtyInUnit ?? item.quantity ?? 1);
    const unitName = item.unitName ? ` ${escapeHtml(item.unitName)}` : '';
    const unitPrice = Number(item.unitPrice ?? item.unitSalePrice ?? 0);
    const lineTotal = getItemGrossTotal(item);

    return `
      <tr>
        <td class="product">${escapeHtml(item.productName || 'Product')}</td>
        <td class="quantity">${qty.toLocaleString('en-IN', { maximumFractionDigits: 3 })}${unitName}</td>
        <td class="money">${formatMoney(unitPrice)}</td>
        <td class="money">${formatMoney(lineTotal)}</td>
      </tr>`;
  }).join('');

  const html = `<!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: A4; margin: 30px 38px; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #17212b; background: #fff; font-family: "Noto Sans", "DejaVu Sans", Arial, sans-serif; font-size: 12px; }
        .top-rule { height: 5px; background: #b77928; margin: 0 0 27px; }
        .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 20px; border-bottom: 1px solid #d9dee4; }
        .brand { display: flex; align-items: center; gap: 15px; min-width: 0; }
        .logo { width: 76px; height: 76px; object-fit: contain; }
        .logo-fallback { width: 76px; height: 76px; display: flex; align-items: center; justify-content: center; border-radius: 14px; background: #fff7e8; color: #945b18; font-size: 28px; font-weight: 700; }
        .brand h1 { margin: 0 0 5px; color: #17212b; font-size: 21px; line-height: 1.2; }
        .brand p { margin: 3px 0; color: #5f6b76; font-size: 11px; }
        .invoice-heading { text-align: right; }
        .invoice-heading h2 { margin: 0 0 6px; color: #17212b; font-size: 26px; letter-spacing: 1.4px; }
        .invoice-heading p { margin: 4px 0; color: #5f6b76; font-size: 11px; }
        .section-title { margin: 0 0 11px; color: #75808a; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .details { display: flex; justify-content: space-between; gap: 28px; padding: 22px 0 26px; }
        .customer { flex: 1; }
        .customer-name { margin-bottom: 6px; color: #17212b; font-size: 15px; font-weight: 700; }
        .customer p { margin: 3px 0; color: #52606d; font-size: 11px; }
        .meta { width: 225px; padding: 12px 14px; border: 1px solid #e1e5e9; border-radius: 7px; background: #fafbfc; }
        .meta-row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; color: #58636e; font-size: 10px; }
        .meta-row strong { color: #17212b; text-align: right; font-size: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 0 0 18px; }
        thead { display: table-header-group; }
        th { padding: 11px 9px; background: #25313b; color: #fff; font-size: 9px; letter-spacing: .5px; text-align: left; text-transform: uppercase; }
        th:first-child { border-radius: 5px 0 0 5px; }
        th:last-child { border-radius: 0 5px 5px 0; }
        td { padding: 12px 9px; border-bottom: 1px solid #e6e9ec; color: #26323c; font-size: 11px; vertical-align: top; }
        td.product { width: 45%; font-weight: 600; overflow-wrap: anywhere; }
        td.quantity { width: 17%; color: #52606d; }
        th.money, td.money { width: 19%; text-align: right; white-space: nowrap; }
        .summary { display: flex; justify-content: flex-end; margin-top: 8px; page-break-inside: avoid; }
        .totals { width: 255px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 3px; color: #52606d; font-size: 11px; }
        .total-row.grand { margin-top: 5px; padding: 13px 14px; border-radius: 6px; background: #fff6e8; color: #17212b; font-size: 13px; font-weight: 700; }
        .total-row.grand strong { color: #945b18; font-size: 16px; }
        .bottom { display: flex; justify-content: space-between; align-items: flex-end; gap: 22px; margin-top: 30px; padding-top: 17px; border-top: 1px solid #d9dee4; page-break-inside: avoid; }
        .payment { color: #52606d; font-size: 10px; }
        .payment .section-title { margin-bottom: 7px; }
        .payment-pill { display: inline-block; padding: 7px 12px; border: 1px solid #e7c99d; border-radius: 20px; background: #fff8ed; color: #784b17; font-size: 11px; font-weight: 700; }
        .thanks { color: #66727d; font-size: 10px; text-align: right; }
        .thanks strong { display: block; margin-bottom: 4px; color: #25313b; font-size: 12px; }
        tr { page-break-inside: avoid; }
      </style>
    </head>
    <body>
      <div class="top-rule"></div>
      <header class="header">
        <div class="brand">
          ${logo ? `<img class="logo" src="${logo}" alt="${storeName} logo">` : '<div class="logo-fallback">ॐ</div>'}
          <div>
            <h1>${storeName}</h1>
            <p>${storeAddress}</p>
            ${storePhone ? `<p>Phone: ${storePhone}</p>` : ''}
          </div>
        </div>
        <div class="invoice-heading">
          <h2>INVOICE</h2>
          <p><strong>${invoiceNo}</strong></p>
          <p>${dateLabel} · ${timeLabel}</p>
        </div>
      </header>

      <section class="details">
        <div class="customer">
          <h3 class="section-title">Bill to</h3>
          <div class="customer-name">${customerName}</div>
          <p>Mobile: ${customerPhone}</p>
        </div>
        <div class="meta">
          <div class="meta-row"><span>Invoice number</span><strong>${invoiceNo}</strong></div>
          <div class="meta-row"><span>Invoice date</span><strong>${dateLabel}</strong></div>
          <div class="meta-row"><span>Payment method</span><strong>${paymentMode}</strong></div>
        </div>
      </section>

      <table>
        <thead><tr><th>Description</th><th>Qty</th><th class="money">Unit price</th><th class="money">Amount</th></tr></thead>
        <tbody>${itemRows || '<tr><td class="product">No items</td><td></td><td></td><td></td></tr>'}</tbody>
      </table>

      <section class="summary">
        <div class="totals">
          <div class="total-row"><span>Subtotal</span><strong>${formatMoney(subtotal)}</strong></div>
          ${discountAmount > 0 ? `<div class="total-row"><span>Cart discount</span><strong>−${formatMoney(discountAmount)}</strong></div>` : ''}
          <div class="total-row grand"><span>Total</span><strong>${formatMoney(total)}</strong></div>
        </div>
      </section>

      <footer class="bottom">
        <div class="payment">
          <h3 class="section-title">Payment method</h3>
          <span class="payment-pill">${paymentMode}</span>
        </div>
        <div class="thanks"><strong>Thank you for shopping with us.</strong>We appreciate your business.</div>
      </footer>
    </body>
    </html>`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '30px', bottom: '30px', left: '38px', right: '38px' },
    });
    // Ensure we always return a proper Node.js Buffer (Puppeteer may return Uint8Array)
    return Buffer.from(pdfBuffer);
  } catch (error) {
    logger.error({ err: error }, 'Failed to generate PDF receipt');
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

export const generateThermalReceiptHTML = (invoice) => {
  const createdAt = new Date(invoice.createdAt || Date.now());
  const date = createdAt.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const time = createdAt.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
  });
  const total = Number(invoice.totalAmount || 0);
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotal = getInvoiceSubtotal(invoice, items);
  const discountAmount = Number(invoice.discountAmount || 0);
  const storeName = escapeHtml(process.env.STORE_NAME || 'Shree Pooja Ghar');
  const storeAddress = process.env.STORE_ADDRESS
    ? `<div>${escapeHtml(process.env.STORE_ADDRESS)}</div>`
    : '<div>Ajmer, Rajasthan</div>';
  const storePhone = process.env.STORE_PHONE
    ? `<div>Phone: ${escapeHtml(process.env.STORE_PHONE)}</div>`
    : '';
  const customerName = escapeHtml(invoice.customerName || invoice.customer?.name || 'Guest Customer');
  const customerPhone = escapeHtml(invoice.customerPhone || invoice.customer?.phone || 'Not provided');
  const invoiceNo = escapeHtml(invoice.invoiceNo || 'N/A');
  const paymentLabels = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', KHATA: 'Khata' };
  const paymentMode = paymentLabels[String(invoice.paymentMode || '').toUpperCase()]
    || escapeHtml(invoice.paymentMode || 'Other');
  const itemRows = items.map((item) => {
    const quantity = Number(item.qtyInUnit ?? item.quantity ?? 1);
    const amount = getItemGrossTotal(item);
    return `
      <div class="item-row">
        <span class="item-name">${escapeHtml(item.productName || 'Product')}${item.unitName ? `<small class="item-unit">${escapeHtml(item.unitName)}</small>` : ''}</span>
        <span class="item-qty">${quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</span>
        <span class="item-amount">${amount.toFixed(2)}</span>
      </div>`;
  }).join('');

  const html = `<!doctype html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Retail Invoice ${invoiceNo}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 80mm; background: #fff; color: #000; }
        body { padding: 4mm; font-family: "DejaVu Sans Mono", "Courier New", monospace; font-size: 10pt; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .center { text-align: center; }
        .brand { font-size: 13pt; font-weight: 700; text-transform: uppercase; }
        .store-details { margin-top: 2px; font-size: 8.5pt; }
        .receipt-title { margin: 9px 0 7px; font-size: 10pt; font-weight: 700; }
        .meta { display: grid; grid-template-columns: 1fr; gap: 2px; font-size: 8.5pt; }
        .rule { border-top: 1px dashed #111; margin: 7px 0; }
        .customer { font-size: 8.5pt; overflow-wrap: anywhere; }
        .items-heading, .item-row { display: grid; grid-template-columns: minmax(0, 1fr) 52px 66px; gap: 4px; align-items: start; }
        .items-heading { padding-bottom: 4px; border-bottom: 1px dotted #111; font-weight: 700; }
        .item-row { padding: 3px 0; }
        .item-name { overflow-wrap: anywhere; }
        .item-unit { display: block; font-size: 8pt; }
        .item-qty, .item-amount { text-align: right; white-space: nowrap; }
        .totals { margin-top: 5px; }
        .totals-row { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
        .total { margin-top: 3px; padding-top: 5px; border-top: 1px solid #111; font-size: 11pt; font-weight: 700; }
        .payment { margin-top: 6px; }
        .footer { margin-top: 12px; font-size: 8.5pt; }
      </style>
    </head>
    <body>
      <header class="center">
        <div class="brand">${storeName}</div>
        <div class="store-details">${storeAddress}${storePhone}</div>
        <div class="receipt-title">RETAIL INVOICE</div>
      </header>

      <section class="meta">
        <div>Date: ${date}, ${time}</div>
        <div>Bill No: ${invoiceNo}</div>
        <div>Payment Mode: ${paymentMode}</div>
      </section>
      <div class="customer">Customer: <strong>${customerName}</strong><br>Mobile: ${customerPhone}</div>

      <div class="rule"></div>
      <div class="items-heading"><span>Item</span><span class="item-qty">Qty</span><span class="item-amount">Amt (Rs)</span></div>
      <section class="items">${itemRows || '<div class="item-row"><span class="item-name">No items</span><span></span><span></span></div>'}</section>
      <div class="rule"></div>

      <section class="totals">
        <div class="totals-row"><span>Subtotal</span><strong>Rs ${subtotal.toFixed(2)}</strong></div>
        ${discountAmount > 0 ? `<div class="totals-row"><span>Cart discount</span><strong>- Rs ${discountAmount.toFixed(2)}</strong></div>` : ''}
        <div class="totals-row total"><span>TOTAL</span><strong>Rs ${total.toFixed(2)}</strong></div>
        <div class="totals-row payment"><span>${paymentMode}</span><strong>Rs ${total.toFixed(2)}</strong></div>
      </section>
      <footer class="footer center">Thank you for shopping with us</footer>
    </body>
      </html>`;

  return html;
};

export const generateThermalReceiptPDF = async (invoice) => {
  const html = generateThermalReceiptHTML(invoice);

  let browser;
  try {
    browser = await puppeteer.launch({
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
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 302, height: 600 });
    await page.setContent(html, { waitUntil: 'load' });
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const pdfBuffer = await page.pdf({
      width: '80mm',
      height: `${bodyHeight}px`,
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return Buffer.from(pdfBuffer);
  } catch (error) {
    logger.error({ err: error }, 'Failed to generate thermal PDF receipt');
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
