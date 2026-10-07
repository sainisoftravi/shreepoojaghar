import * as checkoutService from '../services/checkout.service.js';
import { whatsappQueue } from '../jobs/whatsapp.queue.js';
import { logger } from '../config/logger.js';
import { markWaFailed, markWaQueued } from '../services/invoice.service.js';

export const posCheckout = async (req, res, next) => {
  try {
    const {
      customerName,
      phone,
      paymentMode,
      items,
      discountType = 'AMOUNT',
      discountValue = 0,
      idempotencyKey: bodyIdempotencyKey,
    } = req.body;
    const idempotencyKey = req.get('x-idempotency-key') || bodyIdempotencyKey;

    // Run the full checkout transaction
    const { invoice, isDuplicate } = await checkoutService.checkout({
      customerName,
      phone,
      paymentMode,
      items,
      discountType,
      discountValue,
      idempotencyKey,
    });

    // Queue WhatsApp message AFTER the DB transaction commits
    // WhatsApp failure must NEVER rollback the invoice
    const hasCustomerPhone = Boolean(invoice.customerPhone?.trim());
    let waStatus = isDuplicate ? invoice.waStatus || 'PENDING' : 'SKIPPED';
    if (!isDuplicate && hasCustomerPhone) {
      try {
        // Set status before enqueueing so a fast worker cannot overwrite SENT with QUEUED.
        await markWaQueued(invoice.id);
        await whatsappQueue.add('send-invoice', {
          invoiceId: invoice.id,
        });
        waStatus = 'QUEUED';
        logger.info({ invoiceId: invoice.id }, 'WhatsApp job queued');
      } catch (waErr) {
        // Log but do NOT fail the checkout response.
        logger.error({ err: waErr }, 'WhatsApp queue error — invoice still saved');
        waStatus = 'FAILED';
        await markWaFailed(invoice.id).catch((statusErr) =>
          logger.error({ err: statusErr }, 'Failed to update WA status to FAILED')
        );
      }
    }

    res.status(201).json({
      success: true,
      invoiceNo: invoice.invoiceNo,
      total: Number(invoice.totalAmount),
      subtotal: Number(invoice.subtotal),
      discountAmount: Number(invoice.discountAmount),
      profit: Number(invoice.totalProfit),
      waStatus,
    });
  } catch (error) {
    next(error);
  }
};
