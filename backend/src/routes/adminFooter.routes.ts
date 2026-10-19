import { Router } from 'express';
import { FooterController } from '../controllers/footer.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// SuperAdmin authentication required for all management endpoints
router.use(authenticate, requireSuperAdmin);

// Fetch footer configuration for admin
router.get('/', FooterController.adminGetFooter);

// Update footer configuration
router.put('/', FooterController.adminUpdateFooter);

// Reset footer configuration to factory defaults
router.post('/reset', FooterController.adminResetFooter);

export default router;
