import { Router } from 'express';
import { AboutSectionController } from '../controllers/aboutSection.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// SuperAdmin authentication required for all management endpoints
router.use(authenticate, requireSuperAdmin);

// Get all about sections
router.get('/', AboutSectionController.adminGetSections);

// Create new about section
router.post('/', AboutSectionController.adminCreateSection);

// Update about section
router.put('/:id', AboutSectionController.adminUpdateSection);

// Toggle active/inactive status
router.patch('/:id/status', AboutSectionController.adminToggleStatus);

// Delete about section
router.delete('/:id', AboutSectionController.adminDeleteSection);

export default router;
