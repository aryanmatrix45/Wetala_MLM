import { Request, Response } from 'express';
import { SponsorTreeService } from '../services/tree/SponsorTreeService';
import { Member } from '../models/Member.model';
import { HTTP_STATUS } from '../config/constants';

export const SponsorController = {
  /**
   * Get unilevel sponsor referral tree
   * GET /api/sponsor/tree?root=MEM0001&depth=3
   */
  async getTree(req: Request, res: Response): Promise<void> {
    try {
      const rootId = (req.query.root as string) || 'MEM0001';
      const depth = parseInt((req.query.depth as string) || '3', 10);

      const tree = await SponsorTreeService.getSponsorTree(rootId, depth);
      if (!tree) {
        const firstMember = await Member.findOne().sort({ createdAt: 1 });
        if (firstMember) {
          const fallback = await SponsorTreeService.getSponsorTree(firstMember.memberId, depth);
          res.status(HTTP_STATUS.OK).json({ status: true, data: fallback });
          return;
        }
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Sponsor tree root not found.' });
        return;
      }

      res.status(HTTP_STATUS.OK).json({ status: true, data: tree });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Get direct referrals for a sponsor
   * GET /api/sponsor/directs/:memberId
   */
  async getDirectReferrals(req: Request, res: Response): Promise<void> {
    try {
      const { memberId } = req.params;
      const directs = await SponsorTreeService.getDirectReferrals(memberId);
      res.status(HTTP_STATUS.OK).json({ status: true, data: directs });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },
};
