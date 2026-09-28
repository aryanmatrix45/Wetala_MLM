import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/', ProductController.getProducts);
router.post('/', authenticate, ProductController.createProduct);

export default router;
