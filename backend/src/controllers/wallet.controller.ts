import { Request, Response } from 'express';
import { Wallet } from '../models/Wallet.model';
import { WalletTransaction } from '../models/WalletTransaction.model';
import { Member } from '../models/Member.model';
import { WalletService } from '../services/WalletService';
import { HTTP_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

export const WalletController = {
  /**
   * Get member wallet summary
   * GET /api/wallet/:memberId
   */
  async getWallet(req: Request, res: Response): Promise<void> {
    try {
      const { memberId } = req.params;
      const member = await Member.findOne({ memberId: memberId.toUpperCase() });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Member not found.' });
        return;
      }

      const wallet = await WalletService.getOrCreateWallet(member.memberId, member._id.toString());
      res.status(HTTP_STATUS.OK).json({ status: true, data: wallet });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Get wallet transaction history
   * GET /api/wallet/transactions/:memberId
   */
  async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { memberId } = req.params;
      const { limit = 50, page = 1 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const [txns, total] = await Promise.all([
        WalletTransaction.find({ memberId: memberId.toUpperCase() })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),
        WalletTransaction.countDocuments({ memberId: memberId.toUpperCase() }),
      ]);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: txns,
        pagination: { total, page: Number(page), limit: Number(limit) },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Request withdrawal from wallet
   * POST /api/wallet/withdraw
   */
  async requestWithdrawal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { memberId, amount, notes = 'Bank withdrawal' } = req.body;
      if (!memberId || !amount || amount <= 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Valid memberId and withdrawal amount are required.' });
        return;
      }

      const withdrawalId = `WTH-${Date.now().toString(36).toUpperCase()}`;
      const wallet = await WalletService.debitWallet(
        memberId.toUpperCase(),
        amount,
        'WITHDRAWAL',
        withdrawalId,
        notes
      );

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Withdrawal request for ₹${amount} processed successfully.`,
        data: {
          withdrawalId,
          amount,
          availableBalance: wallet.availableBalance,
        },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: error.message });
    }
  },
};
