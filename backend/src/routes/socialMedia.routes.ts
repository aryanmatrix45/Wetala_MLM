import { Router } from 'express';
import { SocialMediaController } from '../controllers/socialMedia.controller';

const router = Router();

// Public / Member read-only route for active social links
router.get('/', SocialMediaController.getPublicLinks);

export default router;
