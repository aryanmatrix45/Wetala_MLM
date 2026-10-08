import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// All admin product routes strictly require SuperAdmin authentication
router.use(authenticate, requireSuperAdmin);

// Create product
router.post('/', ProductController.adminCreateProduct);

// Upload product image
router.post('/upload-image', ProductController.adminUploadImage);

// List products (with pagination, search, status filter, category filter)
router.get('/', ProductController.adminGetProducts);

// Get product details by ID or slug
router.get('/:id', ProductController.adminGetProductById);

// Update product
router.put('/:id', ProductController.adminUpdateProduct);

// Delete product
router.delete('/:id', ProductController.adminDeleteProduct);

// Activate/Deactivate product
router.patch('/:id/status', ProductController.adminUpdateProductStatus);

export default router;
