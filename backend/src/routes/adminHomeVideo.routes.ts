import { Router } from 'express';
import { HomeVideoController } from '../controllers/homeVideo.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// SuperAdmin authentication required for all management endpoints
router.use(authenticate, requireSuperAdmin);

// Get all videos & settings
router.get('/', HomeVideoController.adminGetVideos);

// Update section header settings (CKEditor title and subtitle)
router.put('/settings', HomeVideoController.adminUpdateSettings);

// Create video
router.post('/', HomeVideoController.adminCreateVideo);

// Update video
router.put('/:id', HomeVideoController.adminUpdateVideo);

// Toggle video status
router.patch('/:id/status', HomeVideoController.adminToggleStatus);

// Delete video
router.delete('/:id', HomeVideoController.adminDeleteVideo);

export default router;
