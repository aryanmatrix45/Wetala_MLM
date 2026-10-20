import { Router } from 'express';
import { KycController } from '../controllers/kyc.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// Member: view and submit / update own KYC
router.get('/me', authenticate, KycController.getMyKyc);
router.put('/me', authenticate, KycController.submitMyKyc);

// Private KYC document images (owner or Super Admin only)
router.get('/files/:key', authenticate, KycController.getKycFile);

// Super Admin: view and verify a member's KYC
router.get('/members/:memberId', authenticate, requireSuperAdmin, KycController.getMemberKyc);
router.patch('/members/:memberId/review', authenticate, requireSuperAdmin, KycController.reviewMemberKyc);

export default router;
