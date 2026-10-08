import { Router } from 'express';
import { SubcategoryController } from '../controllers/subcategory.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// Protected with SuperAdmin authorization
router.use(authenticate, requireSuperAdmin);

// Create subcategory
router.post('/', SubcategoryController.adminCreateSubcategory);

// List subcategories (supports ?categoryId=<ID>)
router.get('/', SubcategoryController.adminGetSubcategories);

// Get subcategory details
router.get('/:id', SubcategoryController.adminGetSubcategoryById);

// Update subcategory
router.put('/:id', SubcategoryController.adminUpdateSubcategory);

// Delete subcategory (with safety checks)
router.delete('/:id', SubcategoryController.adminDeleteSubcategory);

// Toggle / set status
router.patch('/:id/status', SubcategoryController.adminUpdateSubcategoryStatus);

export default router;
