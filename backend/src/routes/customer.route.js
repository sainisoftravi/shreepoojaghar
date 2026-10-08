import { Router } from 'express';
import * as customerController from '../controllers/customer.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, authorize('ADMIN'), customerController.listCustomers);
router.get('/:phone', authenticate, customerController.getCustomerByPhone);

export default router;
