import { Router } from 'express';
import { SponsorController } from '../controllers/sponsor.controller';

const router = Router();

router.get('/tree', SponsorController.getTree);
router.get('/directs/:memberId', SponsorController.getDirectReferrals);
router.get('/income/summary/:memberId', SponsorController.getSponsorIncomeSummary);
router.get('/income/history/:memberId', SponsorController.getSponsorIncomeHistory);

export default router;
