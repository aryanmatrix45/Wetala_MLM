import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// Protected with SuperAdmin authorization
router.use(authenticate, requireSuperAdmin);

// Create category
router.post('/', CategoryController.adminCreateCategory);

// List categories
router.get('/', CategoryController.adminGetCategories);

// Get category details
router.get('/:id', CategoryController.adminGetCategoryById);

// Update category
router.put('/:id', CategoryController.adminUpdateCategory);

// Delete category (with safety checks)
router.delete('/:id', CategoryController.adminDeleteCategory);

// Toggle / set status
router.patch('/:id/status', CategoryController.adminUpdateCategoryStatus);

export default router;
