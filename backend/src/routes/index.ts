import { Router } from 'express';
import authRoutes from './auth.routes';
import mlmRoutes from './mlm.routes';

const router = Router();

// Mount authentication routes
router.use('/auth', authRoutes);

// Mount MLM domain routes
router.use('/', mlmRoutes);

export default router;
