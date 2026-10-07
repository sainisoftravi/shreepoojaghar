import { Router } from 'express';
import * as productController from '../controllers/product.controller.js';
import { validateProduct } from '../validators/product.validator.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';

const router = Router();

// Reads
router.get('/', authenticate, productController.getAllProducts);
router.get('/low-stock', authenticate, productController.getLowStockProducts);
router.get('/barcode/:barcode', authenticate, productController.getProductByBarcode);
router.get('/:id', authenticate, productController.getProductById);

// Writes (Admin only)
router.post('/', authenticate, authorize('ADMIN'), validateProduct, productController.createProduct);
router.put('/:id', authenticate, authorize('ADMIN'), validateProduct, productController.updateProduct);
router.post('/:id/image', authenticate, authorize('ADMIN'), upload.single('image'), productController.uploadProductImage);
router.delete('/:id', authenticate, authorize('ADMIN'), productController.deleteProduct);

export default router;
