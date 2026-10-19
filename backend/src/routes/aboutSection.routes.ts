import { Router } from 'express';
import { AboutSectionController } from '../controllers/aboutSection.controller';

const router = Router();

// Public / Member get active about sections
router.get('/', AboutSectionController.getPublicSections);

export default router;
