import { Router } from 'express';
import { SponsorController } from '../controllers/sponsor.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/tree', SponsorController.getTree);
router.get('/directs/:memberId', SponsorController.getDirectReferrals);
// Sponsor income: login required; members see only their own
router.get('/income/summary/:memberId', authenticate, SponsorController.getSponsorIncomeSummary);
router.get('/income/history/:memberId', authenticate, SponsorController.getSponsorIncomeHistory);

export default router;
