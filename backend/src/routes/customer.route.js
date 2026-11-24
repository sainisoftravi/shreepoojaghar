import { Router } from 'express';
import * as customerController from '../controllers/customer.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// Customer list & lookup
router.get('/', authenticate, authorize('ADMIN'), customerController.listCustomers);
router.get('/:phone', authenticate, customerController.getCustomerByPhone);

// Customer management (Admin only)
router.post('/', authenticate, authorize('ADMIN'), customerController.createCustomer);
router.put('/:id', authenticate, authorize('ADMIN'), customerController.updateCustomer);
router.delete('/:id', authenticate, authorize('ADMIN'), customerController.deleteCustomer);

export default router;
