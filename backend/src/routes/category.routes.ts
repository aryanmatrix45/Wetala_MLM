import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';

const router = Router();

// Member / Public: Get active categories
router.get('/', CategoryController.getCategories);

export default router;
