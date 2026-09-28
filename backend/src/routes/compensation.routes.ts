import { Router } from 'express';
import { CompensationController } from '../controllers/compensation.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Compensation Rules
router.get('/rules', CompensationController.getRules);
router.put('/rules', authenticate, CompensationController.updateRules);

// Compensation Simulator (Admin Only)
router.post('/simulate', CompensationController.simulateCompensation);

// Commission Explanation API
router.get('/commission/:commissionId', CompensationController.getCommissionExplanation);

// Commission Ledger List
router.get('/commissions', CompensationController.getCommissions);

export default router;
