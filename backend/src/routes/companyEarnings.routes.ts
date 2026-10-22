import { Router } from 'express';
import { CompanyEarningsController } from '../controllers/companyEarnings.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticate, requireSuperAdmin);

// Earnings: totals, entries and CSV export
router.get('/summary', CompanyEarningsController.getSummary);
router.get('/export', CompanyEarningsController.exportCsv);
router.get('/', CompanyEarningsController.list);

// BV rate (price of 1 BV when the Super Admin sells it)
router.get('/rate', CompanyEarningsController.getRate);
router.get('/rate/history', CompanyEarningsController.getRateHistory);
router.put('/rate', CompanyEarningsController.setRate);

export default router;
