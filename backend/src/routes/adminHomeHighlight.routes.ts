import { Router } from 'express';
import { HomeHighlightController } from '../controllers/homeHighlight.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// SuperAdmin authentication required for all management endpoints
router.use(authenticate, requireSuperAdmin);

// Get settings & all cards
router.get('/', HomeHighlightController.adminGetHighlights);

// Update section heading, subheading, visibility & scroll speed
router.put('/settings', HomeHighlightController.adminUpdateSettings);

// Create card
router.post('/', HomeHighlightController.adminCreateHighlight);

// Update card
router.put('/:id', HomeHighlightController.adminUpdateHighlight);

// Toggle card status
router.patch('/:id/status', HomeHighlightController.adminToggleStatus);

// Delete card
router.delete('/:id', HomeHighlightController.adminDeleteHighlight);

export default router;
