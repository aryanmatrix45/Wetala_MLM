import { Router } from 'express';
import { HomeVideoController } from '../controllers/homeVideo.controller';

const router = Router();

// Public / Member get active video showcase
router.get('/', HomeVideoController.getPublicVideos);

export default router;
