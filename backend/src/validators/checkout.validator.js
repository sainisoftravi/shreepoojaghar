import { z } from 'zod';
import { ValidationError } from '../utils/AppError.js';
import { PAYMENT_MODES } from '../constants/index.js';

const checkoutItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  unitId: z.union([z.string().uuid(), z.literal('')]).optional(),
  // The current multi-unit cart sends qtyInUnit. Keep qty accepted for older clients.
  qtyInUnit: z.number().positive().optional(),
  qty: z.number().positive().optional(),
  salePrice: z.number().nonnegative('Sale price cannot be negative'),
  regularPrice: z.number().nonnegative('Regular price cannot be negative').optional(),
}).superRefine((item, ctx) => {
  if (item.qtyInUnit === undefined && item.qty === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['qtyInUnit'],
      message: 'Quantity is required',
    });
  }
});

export const checkoutSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  phone: z
    .string()
    .regex(/^\+?[0-9\s\-().]{7,15}$/, 'Invalid phone number format'),
  paymentMode: z.enum(PAYMENT_MODES, {
    errorMap: () => ({
      message: `Payment mode must be one of: ${PAYMENT_MODES.join(', ')}`,
    }),
  }),
  items: z
    .array(checkoutItemSchema)
    .min(1, 'At least one item is required'),
  discountType: z.enum(['PERCENT', 'AMOUNT']).optional(),
  discountValue: z.number().finite().min(0, 'Discount cannot be negative').optional(),
}).superRefine((checkout, ctx) => {
  if (checkout.discountType === 'PERCENT' && Number(checkout.discountValue || 0) > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountValue'],
      message: 'Percentage discount cannot exceed 100%',
    });
  }
});

export const validateCheckout = (req, res, next) => {
  try {
    checkoutSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => e.message).join(', ');
      next(new ValidationError(messages));
    } else {
      next(error);
    }
  }
};
