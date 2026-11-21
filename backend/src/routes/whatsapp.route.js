import express from 'express';
import { getStatus, pairPhone, logout, broadcastProduct, refreshQr } from '../controllers/whatsapp.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/status', authenticate, authorize('ADMIN'), getStatus);
router.post('/refresh-qr', authenticate, authorize('ADMIN'), refreshQr);
router.post('/pair', authenticate, authorize('ADMIN'), pairPhone);
router.post('/logout', authenticate, authorize('ADMIN'), logout);
router.post('/broadcast', authenticate, authorize('ADMIN'), broadcastProduct);

export default router;
