import { Router } from 'express';
import { SliderController } from '../controllers/slider.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// All admin slider routes strictly require SuperAdmin authentication
router.use(authenticate, requireSuperAdmin);

// List all sliders (with type, status, and search filters)
router.get('/', SliderController.adminGetSliders);

// Create single slider
router.post('/', SliderController.adminCreateSlider);

// Bulk upload multiple sliders
router.post('/bulk', SliderController.adminBulkCreateSliders);

// Reorder sliders
router.put('/reorder', SliderController.adminReorderSliders);

// Update slider details
router.put('/:id', SliderController.adminUpdateSlider);

// Quick toggle active / inactive status
router.patch('/:id/status', SliderController.adminUpdateStatus);

// Delete slider
router.delete('/:id', SliderController.adminDeleteSlider);

export default router;
