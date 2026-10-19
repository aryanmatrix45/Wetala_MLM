import { Router } from 'express';
import { FooterController } from '../controllers/footer.controller';

const router = Router();

// Public / Member read-only route for footer details
router.get('/', FooterController.getFooter);

export default router;
