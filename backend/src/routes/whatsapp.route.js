import express from 'express';
import { getStatus, pairPhone, logout } from '../controllers/whatsapp.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/status', authenticate, authorize('ADMIN'), getStatus);
router.post('/pair', authenticate, authorize('ADMIN'), pairPhone);
router.post('/logout', authenticate, authorize('ADMIN'), logout);

export default router;
