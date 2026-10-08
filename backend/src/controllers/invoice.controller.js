import * as invoiceService from '../services/invoice.service.js';
import { whatsappQueue } from '../jobs/whatsapp.queue.js';
import { generateReceiptPDF, generateThermalReceiptHTML, generateThermalReceiptPDF } from '../services/receipt.service.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';

export const listInvoices = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const phone = req.query.phone;
    const data = await invoiceService.listInvoices({ page, limit, phone });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceByNumber(req.params.invoiceNo);
    if (!invoice) throw new NotFoundError('Invoice not found');
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

export const resendWhatsAppInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceByNumber(req.params.invoiceNo);
    if (!invoice) throw new NotFoundError('Invoice not found');
    if (!invoice.customerPhone?.trim()) {
      throw new ValidationError('This invoice does not have a WhatsApp phone number');
    }
    const claimed = await invoiceService.claimWhatsAppRetry(invoice.id);
    if (!claimed) throw new ConflictError('This invoice is already sent, queued, or cannot be retried');
    try {
      await whatsappQueue.add('send-invoice', {
        invoiceId: invoice.id,
      });
    } catch (error) {
      await invoiceService.markWaFailed(invoice.id).catch((statusError) =>
        logger.error({ err: statusError, invoiceId: invoice.id }, 'Failed to mark invoice WhatsApp status as FAILED')
      );
      throw error;
    }

    res.status(202).json({
      success: true,
      data: { invoiceNo: invoice.invoiceNo, waStatus: 'QUEUED' },
    });
  } catch (error) {
    next(error);
  }
};

export const getInvoicePdf = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceByNumber(req.params.invoiceNo);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const pdfBuffer = await generateReceiptPDF(invoice);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt_${invoice.invoiceNo}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

export const getThermalInvoicePdf = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceByNumber(req.params.invoiceNo);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const pdfBuffer = await generateThermalReceiptPDF(invoice);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="thermal_receipt_${invoice.invoiceNo}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

export const getThermalInvoiceHtml = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceByNumber(req.params.invoiceNo);
    if (!invoice) throw new NotFoundError('Invoice not found');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="thermal_receipt_${invoice.invoiceNo}.html"`);
    res.send(generateThermalReceiptHTML(invoice));
  } catch (error) {
    next(error);
  }
};
