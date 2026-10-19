import { Router } from 'express';
import { SocialMediaController } from '../controllers/socialMedia.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// SuperAdmin authentication required for all management endpoints
router.use(authenticate, requireSuperAdmin);

// Fetch all social links
router.get('/', SocialMediaController.adminGetLinks);

// Bulk update social links
router.put('/bulk', SocialMediaController.adminBulkUpdateLinks);

// Create single social link
router.post('/', SocialMediaController.adminCreateLink);

// Update single social link
router.put('/:id', SocialMediaController.adminUpdateLink);

// Toggle active/inactive status
router.patch('/:id/status', SocialMediaController.adminToggleStatus);

// Delete social link
router.delete('/:id', SocialMediaController.adminDeleteLink);

export default router;
