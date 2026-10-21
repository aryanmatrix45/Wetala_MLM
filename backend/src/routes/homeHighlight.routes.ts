import { Router } from 'express';
import { HomeHighlightController } from '../controllers/homeHighlight.controller';

const router = Router();

// Public / Member: section settings and active highlight cards
router.get('/', HomeHighlightController.getPublicHighlights);

export default router;
