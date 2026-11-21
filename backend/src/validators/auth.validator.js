import { z } from 'zod';
import { ValidationError } from '../utils/AppError.js';

export const loginSchema = z.union([
  z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
  z.object({
    encryptedPayload: z.string().min(1, 'Encrypted payload is required'),
  }),
]);

export const validateLogin = (req, res, next) => {
  try {
    loginSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => err.message).join(', ');
      next(new ValidationError(messages));
    } else {
      next(error);
    }
  }
};
