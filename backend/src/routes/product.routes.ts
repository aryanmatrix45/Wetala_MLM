import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';

const router = Router();

// Member / Public Products (Only ACTIVE products returned)
router.get('/', ProductController.getProducts);
router.get('/:slug', ProductController.getProductBySlug);

export default router;
