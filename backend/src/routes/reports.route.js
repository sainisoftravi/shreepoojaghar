import { Router } from 'express';
import * as reportsController from '../controllers/reports.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// All reports are Admin-only
router.get('/dashboard', authenticate, authorize('ADMIN'), reportsController.getDashboard);
router.get('/daily', authenticate, authorize('ADMIN'), reportsController.getDailySummary);
router.get('/range', authenticate, authorize('ADMIN'), reportsController.getCustomRangeSummary);
router.get('/customers/ltv', authenticate, authorize('ADMIN'), reportsController.getCustomerLTV);

export default router;
