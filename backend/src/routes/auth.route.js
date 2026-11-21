import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validateLogin } from '../validators/auth.validator.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/public-key', authController.getPublicKey);
router.post('/login', validateLogin, authController.login);
router.get('/me', authenticate, authController.getMe);

export default router;
