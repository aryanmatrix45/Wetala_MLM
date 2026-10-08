import { Router } from 'express';
import { SubcategoryController } from '../controllers/subcategory.controller';

const router = Router();

// Member / Public: Get active subcategories (supports ?categoryId=<ID>)
router.get('/', SubcategoryController.getSubcategories);

export default router;
