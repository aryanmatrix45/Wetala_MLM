import { Router } from 'express';
import { CompensationController } from '../controllers/compensation.controller';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

// Compensation Rules (Public/Member Read-Only, Admin CRUD)
router.get('/rules', CompensationController.getRules);
router.put('/rules', authenticate, requireAdmin, CompensationController.updateRules);

// Compensation Simulator (Admin Only)
router.post('/simulate', authenticate, requireAdmin, CompensationController.simulateCompensation);

// Commission Explanation API
router.get('/commission/:commissionId', CompensationController.getCommissionExplanation);

// Commission Ledger List
router.get('/commissions', CompensationController.getCommissions);

export default router;
