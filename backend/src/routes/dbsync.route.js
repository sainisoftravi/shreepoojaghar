import { Router } from 'express';
import * as dbsyncController from '../controllers/dbsync.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// All DB sync routes are Admin-only
router.get('/credentials', authenticate, authorize('ADMIN'), dbsyncController.getCredentials);
router.post('/credentials', authenticate, authorize('ADMIN'), dbsyncController.saveCredentials);
router.post('/test', authenticate, authorize('ADMIN'), dbsyncController.testConnection);
router.post('/push', authenticate, authorize('ADMIN'), dbsyncController.pushToSupabase);
router.post('/pull', authenticate, authorize('ADMIN'), dbsyncController.pullFromSupabase);

export default router;
