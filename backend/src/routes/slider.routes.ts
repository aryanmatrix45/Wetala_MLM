import { Router } from 'express';
import { SliderController } from '../controllers/slider.controller';

const router = Router();

// Public / Member get active sliders (query ?type=parent or ?type=child)
router.get('/', SliderController.getSliders);

export default router;
