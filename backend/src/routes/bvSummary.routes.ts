import { Router, Response } from 'express';
import { authenticate, requireSuperAdmin, AuthenticatedRequest } from '../middlewares/auth';
import { BVSummaryService } from '../services/BVSummaryService';
import { BVWalletError } from '../services/BVWalletService';
import { HTTP_STATUS } from '../config/constants';

const router = Router();

const sendSummary = async (res: Response, memberId: string) => {
  try {
    const data = await BVSummaryService.getSummary(memberId);
    res.status(HTTP_STATUS.OK).json({ status: true, data });
  } catch (error: any) {
    if (error instanceof BVWalletError) {
      res.status(error.statusCode).json({ status: false, message: error.message });
      return;
    }
    console.error('[BVSummary] Error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Could not load the BV summary.' });
  }
};

// Member: own Total Business Volume breakdown (member ID from the JWT)
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.memberId) {
    res.status(HTTP_STATUS.FORBIDDEN).json({ status: false, message: 'A member account is required.' });
    return;
  }
  await sendSummary(res, req.user.memberId);
});

// Super Admin: any member's breakdown
router.get('/:memberId', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  await sendSummary(res, req.params.memberId);
});

export default router;
