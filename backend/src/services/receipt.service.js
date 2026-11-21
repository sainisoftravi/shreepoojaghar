import PDFDocument from 'pdfkit';
import { logger } from '../config/logger.js';
import { decryptPii } from '../utils/customer-privacy.js';
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

const formatMoney = (value) => `Rs ${Number(value || 0).toFixed(2)}`;

const getItemGrossTotal = (item) => {
  const grossLineTotal = Number(item.grossLineTotal);
  if (item.grossLineTotal !== undefined && item.grossLineTotal !== null && Number.isFinite(grossLineTotal)) {
    return grossLineTotal;
  }
  const lineTotal = Number(item.lineTotal);
  return Number.isFinite(lineTotal)
    ? lineTotal
    : Number(item.unitPrice ?? item.unitSalePrice ?? 0) * Number(item.qtyInUnit ?? item.quantity ?? 1);
};

const getInvoiceSubtotal = (invoice, items) => {
  const subtotal = Number(invoice.subtotal);
  return invoice.subtotal !== undefined && invoice.subtotal !== null && Number.isFinite(subtotal)
    ? subtotal
    : items.reduce((sum, item) => sum + getItemGrossTotal(item), 0);
};

/**
 * Generate lightweight A4 PDF Receipt using PDFKit (No Chromium / Puppeteer — uses ~5MB RAM)
 */
export const generateReceiptPDF = async (invoice) => {
  return new Promise((resolve, reject) => {
    try {
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
      const paymentMode = paymentLabels[String(invoice.paymentMode || '').toUpperCase()] || invoice.paymentMode || 'Cash';

      const storeName = process.env.STORE_NAME || 'Shree Pooja Ghar';
      const storeAddress = process.env.STORE_ADDRESS || 'Ajmer, Rajasthan, India';
      const storePhone = process.env.STORE_PHONE ? `Phone: ${process.env.STORE_PHONE}` : '';
      const customerName = invoice.customerName || invoice.customer?.name || 'Guest Customer';
      const customerPhone = invoice.customerPhone || invoice.customer?.phone || 'Not provided';
      const invoiceNo = invoice.invoiceNo || 'N/A';

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Header Banner
      doc.rect(40, 40, 515, 6).fill('#ea580c'); // Orange top accent

      // Store Title
      doc.fillColor('#0f172a').fontSize(22).font('Helvetica-Bold').text(storeName, 40, 60);
      doc.fillColor('#64748b').fontSize(9).font('Helvetica')
        .text(storeAddress, 40, 88)
        .text(storePhone, 40, 102);

      // Invoice Tag
      doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold')
        .text('TAX INVOICE', 380, 60, { align: 'right' });
      doc.fillColor('#64748b').fontSize(9).font('Helvetica')
        .text(`Invoice #: ${invoiceNo}`, 380, 82, { align: 'right' })
        .text(`Date: ${dateLabel} ${timeLabel}`, 380, 96, { align: 'right' })
        .text(`Payment: ${paymentMode}`, 380, 110, { align: 'right' });

      // Divider line
      doc.moveTo(40, 130).lineTo(555, 130).strokeColor('#e2e8f0').lineWidth(1).stroke();

      // Customer Info Box
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text('BILLED TO:', 40, 142);
      doc.fillColor('#334155').fontSize(11).font('Helvetica-Bold').text(customerName, 40, 156);
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text(`Mobile: ${customerPhone}`, 40, 172);

      // Items Table Header
      const tableTop = 205;
      doc.rect(40, tableTop, 515, 24).fill('#f8fafc');
      doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold')
        .text('ITEM DESCRIPTION', 50, tableTop + 7)
        .text('QTY', 310, tableTop + 7, { width: 50, align: 'right' })
        .text('PRICE', 380, tableTop + 7, { width: 70, align: 'right' })
        .text('TOTAL', 470, tableTop + 7, { width: 75, align: 'right' });

      // Table Rows
      let y = tableTop + 30;
      doc.font('Helvetica').fontSize(9).fillColor('#1e293b');

      items.forEach((item) => {
        const qty = Number(item.qtyInUnit ?? item.quantity ?? 1);
        const unitName = item.unitName ? ` (${item.unitName})` : '';
        const unitPrice = Number(item.unitPrice ?? item.unitSalePrice ?? 0);
        const lineTotal = getItemGrossTotal(item);

        doc.fillColor('#0f172a').font('Helvetica-Bold')
          .text(decryptPii(item.productName) || 'Product', 50, y, { width: 250 });
        doc.fillColor('#475569').font('Helvetica')
          .text(`${qty}${unitName}`, 310, y, { width: 50, align: 'right' })
          .text(`Rs ${unitPrice.toFixed(2)}`, 380, y, { width: 70, align: 'right' })
          .text(`Rs ${lineTotal.toFixed(2)}`, 470, y, { width: 75, align: 'right' });

        y += 22;

        // Draw light row divider
        doc.moveTo(40, y - 4).lineTo(555, y - 4).strokeColor('#f1f5f9').lineWidth(0.5).stroke();
      });

      // Bottom Totals
      y += 10;
      doc.moveTo(330, y).lineTo(555, y).strokeColor('#cbd5e1').lineWidth(1).stroke();
      y += 8;

      doc.fillColor('#64748b').font('Helvetica').fontSize(9)
        .text('Subtotal:', 340, y, { width: 100, align: 'left' })
        .text(formatMoney(subtotal), 450, y, { width: 95, align: 'right' });

      if (discountAmount > 0) {
        y += 16;
        doc.fillColor('#16a34a').font('Helvetica').fontSize(9)
          .text('Discount:', 340, y, { width: 100, align: 'left' })
          .text(`- ${formatMoney(discountAmount)}`, 450, y, { width: 95, align: 'right' });
      }

      y += 18;
      doc.rect(330, y - 4, 225, 26).fill('#f1f5f9');
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11)
        .text('TOTAL AMOUNT:', 340, y + 3, { width: 110, align: 'left' })
        .text(formatMoney(total), 450, y + 3, { width: 95, align: 'right' });

      // Footer note
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
        .text('Thank you for shopping with us! Have a blessed day. 🙏', 40, 745, { align: 'center', width: 515 })
        .text('This is a computer-generated invoice and does not require a signature.', 40, 758, { align: 'center', width: 515 });

      doc.end();
    } catch (err) {
      logger.error({ err }, 'Failed to generate PDF with PDFKit');
      reject(err);
    }
  });
};

/**
 * Generate 80mm thermal receipt HTML
 */
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
        <span class="item-name">${escapeHtml(decryptPii(item.productName) || 'Product')}${item.unitName ? `<small class="item-unit">${escapeHtml(decryptPii(item.unitName))}</small>` : ''}</span>
        <span class="item-qty">${quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</span>
        <span class="item-amount">${amount.toFixed(2)}</span>
      </div>`;
  }).join('');

  return `<!doctype html>
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
      <div class="center brand">${storeName}</div>
      <div class="center store-details">${storeAddress}${storePhone}</div>
      <div class="center receipt-title">RETAIL INVOICE</div>
      <section class="meta">
        <div>Invoice: <strong>${invoiceNo}</strong></div>
        <div>Date: ${date} ${time}</div>
        <div>Payment Mode: ${paymentMode}</div>
      </section>
      <div class="customer">Customer: <strong>${customerName}</strong><br>Mobile: ${customerPhone}</div>
      <div class="rule"></div>
      <div class="items-heading"><span>Item</span><span class="item-qty">Qty</span><span class="item-amount">Amt</span></div>
      <section class="items">${itemRows || '<div class="item-row"><span class="item-name">No items</span><span></span><span></span></div>'}</section>
      <div class="rule"></div>
      <section class="totals">
        <div class="totals-row"><span>Subtotal</span><strong>Rs ${subtotal.toFixed(2)}</strong></div>
        ${discountAmount > 0 ? `<div class="totals-row"><span>Discount</span><strong>- Rs ${discountAmount.toFixed(2)}</strong></div>` : ''}
        <div class="totals-row total"><span>TOTAL</span><strong>Rs ${total.toFixed(2)}</strong></div>
        <div class="totals-row payment"><span>${paymentMode}</span><strong>Rs ${total.toFixed(2)}</strong></div>
      </section>
      <footer class="footer center">
        <div>Thank you for shopping with us!</div>
        <div style="font-size: 7.5pt; margin-top: 4px; color: #444;">This is a computer-generated invoice and does not require a signature.</div>
      </footer>
    </body>
    </html>`;
};

/**
 * Generate 80mm thermal receipt PDF using PDFKit
 */
export const generateThermalReceiptPDF = async (invoice) => {
  return new Promise((resolve, reject) => {
    try {
      const createdAt = new Date(invoice.createdAt || Date.now());
      const date = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
      const dateStr = date.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
      });
      const timeStr = date.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
      });

      const items = Array.isArray(invoice.items) ? invoice.items : [];
      const subtotal = getInvoiceSubtotal(invoice, items);
      const discountAmount = Number(invoice.discountAmount || 0);
      const total = Number(invoice.totalAmount || 0);
      const paymentLabels = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', KHATA: 'Khata' };
      const paymentMode = paymentLabels[String(invoice.paymentMode || '').toUpperCase()] || invoice.paymentMode || 'Cash';

      const storeName = process.env.STORE_NAME || 'SHREE POOJA GHAR';
      const storeAddress = process.env.STORE_ADDRESS || 'Ajmer, Rajasthan, India';
      const customerName = invoice.customerName || invoice.customer?.name || 'Guest Customer';
      const customerPhone = invoice.customerPhone || invoice.customer?.phone || 'Not provided';
      const invoiceNo = invoice.invoiceNo || 'N/A';

      // Dynamic receipt height based on item count
      const calculatedHeight = Math.max(340, 260 + (items.length * 28));
      const pageWidth = 226.77; // 80mm in points

      const doc = new PDFDocument({
        size: [pageWidth, calculatedHeight],
        margins: { top: 10, bottom: 10, left: 10, right: 10 },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const printableWidth = pageWidth - 20; // 206.77 pt

      let y = 12;

      // Brand
      doc.font('Courier-Bold').fontSize(11).fillColor('#000000')
        .text(storeName.toUpperCase(), 10, y, { align: 'center', width: printableWidth });
      y += 14;

      // Address
      doc.font('Courier').fontSize(8).fillColor('#000000')
        .text(storeAddress, 10, y, { align: 'center', width: printableWidth });
      y += 14;

      // Receipt Title
      doc.font('Courier-Bold').fontSize(9.5)
        .text('RETAIL INVOICE', 10, y, { align: 'center', width: printableWidth });
      y += 15;

      // Metadata
      doc.font('Courier').fontSize(8);
      doc.text(`Invoice: ${invoiceNo}`, 10, y);
      y += 11;
      doc.text(`Date: ${dateStr} ${timeStr}`, 10, y);
      y += 11;
      doc.text(`Payment Mode: ${paymentMode}`, 10, y);
      y += 11;
      doc.text(`Customer: ${customerName}`, 10, y);
      y += 11;
      doc.text(`Mobile: ${customerPhone}`, 10, y);
      y += 12;

      // Helper dashed line
      const drawDashedLine = (currY) => {
        doc.moveTo(10, currY).lineTo(pageWidth - 10, currY)
          .dash(2, { space: 2 }).strokeColor('#000000').lineWidth(0.75).stroke().undash();
      };

      drawDashedLine(y);
      y += 4;

      // Table Header: Item (left), Qty (col 2), Amt (col 3)
      doc.font('Courier-Bold').fontSize(8);
      doc.text('Item', 10, y, { width: 110 });
      doc.text('Qty', 120, y, { width: 35, align: 'right' });
      doc.text('Amt', 160, y, { width: 46, align: 'right' });
      y += 11;

      drawDashedLine(y);
      y += 4;

      // Items
      doc.font('Courier').fontSize(8);
      items.forEach((item) => {
        const qty = Number(item.qtyInUnit ?? item.quantity ?? 1);
        const unitName = item.unitName ? String(decryptPii(item.unitName)) : '';
        const lineTotal = getItemGrossTotal(item);
        const pName = decryptPii(item.productName) || 'Product';

        doc.text(pName, 10, y, { width: 110 });
        doc.text(String(qty), 120, y, { width: 35, align: 'right' });
        doc.text(lineTotal.toFixed(2), 160, y, { width: 46, align: 'right' });
        y += 10;

        if (unitName) {
          doc.fontSize(7.5).fillColor('#333333').text(unitName, 10, y, { width: 110 });
          doc.fontSize(8).fillColor('#000000');
          y += 9;
        }
      });

      y += 2;
      drawDashedLine(y);
      y += 5;

      // Subtotal
      doc.text('Subtotal', 10, y);
      doc.text(`Rs ${subtotal.toFixed(2)}`, 120, y, { width: 86, align: 'right' });
      y += 11;

      if (discountAmount > 0) {
        doc.text('Discount', 10, y);
        doc.text(`- Rs ${discountAmount.toFixed(2)}`, 120, y, { width: 86, align: 'right' });
        y += 11;
      }

      // Divider
      doc.moveTo(10, y).lineTo(pageWidth - 10, y).strokeColor('#000000').lineWidth(0.8).stroke();
      y += 4;

      // TOTAL
      doc.font('Courier-Bold').fontSize(9);
      doc.text('TOTAL', 10, y);
      doc.text(`Rs ${total.toFixed(2)}`, 120, y, { width: 86, align: 'right' });
      y += 13;

      doc.moveTo(10, y).lineTo(pageWidth - 10, y).strokeColor('#000000').lineWidth(0.8).stroke();
      y += 5;

      // Payment line
      doc.font('Courier').fontSize(8.5);
      doc.text(paymentMode, 10, y);
      doc.text(`Rs ${total.toFixed(2)}`, 120, y, { width: 86, align: 'right' });
      y += 16;

      // Footer
      doc.font('Courier').fontSize(7.5).fillColor('#222222')
        .text('Thank you for shopping with us!', 10, y, { align: 'center', width: printableWidth });
      y += 10;
      doc.fontSize(6.5).fillColor('#444444')
        .text('This is a computer-generated invoice and does not require a signature.', 10, y, { align: 'center', width: printableWidth });

      doc.end();
    } catch (err) {
      logger.error({ err }, 'Failed to generate thermal PDF');
      reject(err);
    }
  });
};
