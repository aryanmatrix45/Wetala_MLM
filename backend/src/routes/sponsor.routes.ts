import { Router } from 'express';
import { SponsorController } from '../controllers/sponsor.controller';

const router = Router();

router.get('/tree', SponsorController.getTree);
router.get('/directs/:memberId', SponsorController.getDirectReferrals);

export default router;
