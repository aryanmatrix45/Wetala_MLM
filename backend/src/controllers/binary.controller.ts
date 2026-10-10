import { Request, Response } from 'express';
import { BinaryTreeService } from '../services/tree/BinaryTreeService';
import { BinaryVolume } from '../models/BinaryVolume.model';
import { Member } from '../models/Member.model';
import { CommissionLedger } from '../models/CommissionLedger.model';
import { BVLedger } from '../models/BVLedger.model';
import { HTTP_STATUS, BINARY_POSITION, BinaryPosition, ROLES, COMMISSION_TYPE } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';
import { CompensationEngine } from '../services/compensation/CompensationEngine';
import { BinaryBonusService } from '../services/compensation/BinaryBonusService';
import { AdminNotification } from '../models/AdminNotification.model';

export const BinaryController = {
  /**
   * Get visual binary tree hierarchy
   * GET /api/binary/tree?root=MEM0001&depth=6
   */
  async getTree(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      let requestedRoot = (req.query.root as string)?.trim().toUpperCase();
      const rawDepth = req.query.depth as string;
      let depth = 10;
      if (rawDepth) {
        if (rawDepth === 'all' || rawDepth === 'full') {
          depth = 25;
        } else {
          const parsed = parseInt(rawDepth, 10);
          if (!isNaN(parsed) && parsed > 0) {
            depth = Math.min(parsed, 25);
          }
        }
      }

      // If user is a Regular Member (RM), enforce downline-only visibility (cannot view upline/ancestors)
      if (user && user.role === ROLES.MEMBER && user.memberId) {
        const userMemberId = user.memberId.toUpperCase().trim();
        if (!requestedRoot) {
          requestedRoot = userMemberId;
        } else if (requestedRoot !== userMemberId) {
          const isDownline = await BinaryTreeService.isDescendantOf(requestedRoot, userMemberId);
          if (!isDownline) {
            res.status(HTTP_STATUS.FORBIDDEN).json({
              status: false,
              message: 'Access restricted: You can only view your own downline team tree.',
            });
            return;
          }
        }
      }

      // If no root determined yet (e.g. Admin or public), default to company root
      if (!requestedRoot) {
        const firstMember = await Member.findOne().sort({ createdAt: 1 });
        requestedRoot = firstMember ? firstMember.memberId : 'MEM0001';
      }

      const tree = await BinaryTreeService.getBinaryTree(requestedRoot, depth);
      if (!tree) {
        // Fallback to first member if requestedRoot not found
        const firstMember = await Member.findOne().sort({ createdAt: 1 });
        if (firstMember && (!user || user.role !== ROLES.MEMBER)) {
          const fallbackTree = await BinaryTreeService.getBinaryTree(firstMember.memberId, depth);
          res.status(HTTP_STATUS.OK).json({ status: true, data: fallbackTree });
          return;
        }
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: `Binary tree root ${requestedRoot} not found.` });
        return;
      }

      res.status(HTTP_STATUS.OK).json({ status: true, data: tree });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Get extreme bottom-left and bottom-right nodes from root
   * GET /api/binary/extremes?root=MEM0001
   */
  async getExtremes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      let requestedRoot = (req.query.root as string)?.trim().toUpperCase();

      if (user && user.role === ROLES.MEMBER && user.memberId) {
        const userMemberId = user.memberId.toUpperCase().trim();
        if (!requestedRoot) {
          requestedRoot = userMemberId;
        } else if (requestedRoot !== userMemberId) {
          const isDownline = await BinaryTreeService.isDescendantOf(requestedRoot, userMemberId);
          if (!isDownline) {
            res.status(HTTP_STATUS.FORBIDDEN).json({
              status: false,
              message: 'Access restricted: You can only view your own downline.',
            });
            return;
          }
        }
      }

      if (!requestedRoot) {
        const firstMember = await Member.findOne().sort({ createdAt: 1 });
        requestedRoot = firstMember ? firstMember.memberId : 'MEM0001';
      }

      const extremes = await BinaryTreeService.getTreeExtremes(requestedRoot);
      res.status(HTTP_STATUS.OK).json({ status: true, data: extremes });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Validate binary placement before registration
   * POST /api/binary/validate-placement
   */
  async validatePlacement(req: Request, res: Response): Promise<void> {
    try {
      const { parentId, parentMemberId, position, candidateMemberId } = req.body;
      const targetParent = (parentId || parentMemberId || '').trim();
      if (!targetParent || !position) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Both parentId and position (LEFT or RIGHT) are required.',
        });
        return;
      }

      const result = await BinaryTreeService.validatePlacement(
        targetParent,
        position.toUpperCase() as BinaryPosition,
        candidateMemberId
      );

      if (!result.isValid) {
        res.status(HTTP_STATUS.CONFLICT).json({ status: false, message: result.error });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Placement on ${position.toUpperCase()} under ${targetParent} is valid.`,
        parent: {
          memberId: result.parent?.memberId,
          name: result.parent?.name,
        },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Get dynamic binary volume, matching cycles, and daily cap summary for a member
   * GET /api/binary/volume/:memberId
   */
  async getVolume(req: Request, res: Response): Promise<void> {
    try {
      const cleanId = (req.params.memberId || '').toUpperCase().trim();
      if (!cleanId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Member ID is required' });
        return;
      }

      const member = await Member.findOne({ memberId: cleanId });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Member not found' });
        return;
      }

      const rules = await CompensationEngine.getActiveRules();

      // Automatically evaluate binary cycles according to admin rules if eligible
      await BinaryBonusService.calculateBinaryIncomeForMember(cleanId, rules);

      // Fetch updated BinaryVolume
      const vol = await BinaryVolume.findOne({ memberId: cleanId });

      // Fetch level-order downline member IDs for Left and Right legs
      const { leftMemberIds, rightMemberIds } = await BinaryTreeService.getMemberLegsLevelOrder(cleanId);

      const consumedSet = new Set<string>(vol?.consumedBinaryMemberIds || []);
      const unusedLeft = leftMemberIds.filter((id) => !consumedSet.has(id));
      const unusedRight = rightMemberIds.filter((id) => !consumedSet.has(id));

      const pairBvUnit = rules.binaryBonus.pairBvUnit || 1250;
      const ratePerCycle = rules.binaryBonus.rateInRupees || 250;

      // Commissions from database
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [allBinaryComms, todayBinaryComms] = await Promise.all([
        CommissionLedger.find({
          memberId: cleanId,
          type: COMMISSION_TYPE.BINARY_BONUS,
          status: { $in: ['APPROVED', 'PAID'] },
        }),
        CommissionLedger.find({
          memberId: cleanId,
          type: COMMISSION_TYPE.BINARY_BONUS,
          status: { $in: ['APPROVED', 'PAID'] },
          createdAt: { $gte: todayStart, $lte: todayEnd },
        }),
      ]);

      const totalBinaryIncome = allBinaryComms.reduce((sum, c) => sum + (c.grossAmount || c.payableAmount || 0), 0);
      const earnedToday = todayBinaryComms.reduce((sum, c) => sum + (c.grossAmount || c.payableAmount || 0), 0);
      const dailyCap = (member.dailyCapping && member.dailyCapping > 0) ? member.dailyCapping : 4000;
      const dailyCapUtilization = Math.min(100, Math.round((earnedToday / (dailyCap || 1)) * 100));
      const remainingCap = Math.max(0, dailyCap - earnedToday);

      const matchedCycles = vol?.payoutCount || member.matchedPairs || 0;
      const matchedBV = vol?.matchedTotalBV || 0;
      const leftTotalBV = vol?.leftTotalBV || member.leftBv || 0;
      const rightTotalBV = vol?.rightTotalBV || member.rightBv || 0;
      const leftAvailableBV = vol?.leftAvailableBV || 0;
      const rightAvailableBV = vol?.rightAvailableBV || 0;
      const reservedBV = vol?.reservedBV || 0;
      const reservedSide = vol?.reservedSide || null;
      const payoutCount = vol?.payoutCount || 0;
      const carryLeftBV = vol?.leftCarryForwardBV ?? leftAvailableBV;
      const carryRightBV = vol?.rightCarryForwardBV ?? rightAvailableBV;

      const isCapExceeded = Boolean(earnedToday > dailyCap && dailyCap > 0);
      if (isCapExceeded) {
        try {
          const existingNotif = await AdminNotification.findOne({
            recipientId: cleanId,
            type: 'SYSTEM_ALERT',
            title: 'Capping Limits Exceeded',
            createdAt: { $gte: todayStart },
          });
          if (!existingNotif) {
            await AdminNotification.create({
              notificationId: `NOTIF-CAP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
              type: 'SYSTEM_ALERT',
              title: 'Capping Limits Exceeded',
              message: `Daily capping limit (₹${dailyCap.toLocaleString()}/day) exceeded! Upgrade your package to earn more binary income.`,
              recipientRole: 'member',
              recipientId: cleanId,
              senderId: 'SYSTEM',
              senderName: 'Binary Engine',
              isRead: false,
              metadata: {
                earnedToday,
                dailyCap,
                action: 'UPGRADE_PACKAGE',
              },
            });
          }
        } catch (e: any) {
          console.error('Error creating capping notification in getVolume:', e.message);
        }
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          memberId: cleanId,
          memberName: member.name,
          leftTotalBV,
          rightTotalBV,
          leftAvailableBV,
          rightAvailableBV,
          reservedBV,
          reservedSide,
          payoutCount,
          leftMemberCount: leftMemberIds.length,
          rightMemberCount: rightMemberIds.length,
          unusedLeftCount: unusedLeft.length,
          unusedRightCount: unusedRight.length,
          matchedCycles,
          matchedBV,
          carryLeftBV,
          carryRightBV,
          ratePerCycle,
          totalBinaryIncome,
          earnedToday,
          dailyCap,
          dailyCapUtilization,
          remainingCap,
          isCapExceeded,
          consumedMemberIdsCount: vol?.consumedBinaryMemberIds?.length || 0,
          lastMatchedAt: vol?.lastMatchedAt || null,
        },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Find available placement slot under given member (auto-calculated balanced level-order)
   * GET /api/binary/available-placement/:memberId
   */
  async findAvailablePlacement(req: Request, res: Response): Promise<void> {
    try {
      const { memberId } = req.params;
      const result = await BinaryTreeService.findNextAutoPlacement(memberId);
      res.status(HTTP_STATUS.OK).json({ status: true, data: result });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Rebalance entire binary tree in database to balanced level-order
   * POST /api/binary/rebalance
   */
  async rebalance(req: Request, res: Response): Promise<void> {
    try {
      const result = await BinaryTreeService.rebalanceEntireTree();
      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Successfully reorganized ${result.count} members into balanced level-order binary tree.`,
        data: result.tree,
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Get Business Volume (BV) audit ledger and consumption history for a member
   * GET /api/binary/ledger/:memberId?page=1&limit=50&leg=LEFT|RIGHT
   */
  async getLedger(req: Request, res: Response): Promise<void> {
    try {
      const cleanId = (req.params.memberId || '').toUpperCase().trim();
      const { page = 1, limit = 50, leg } = req.query;

      const member = await Member.findOne({ memberId: cleanId });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Member not found' });
        return;
      }

      const vol = await BinaryVolume.findOne({ memberId: cleanId });
      const query: any = { memberId: cleanId };
      if (leg) {
        query.position = String(leg).toUpperCase();
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [records, total] = await Promise.all([
        BVLedger.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
        BVLedger.countDocuments(query),
      ]);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        summary: {
          memberId: cleanId,
          memberName: member.name,
          leftTotalBV: vol?.leftTotalBV || member.leftBv || 0,
          rightTotalBV: vol?.rightTotalBV || member.rightBv || 0,
          leftAvailableBV: vol?.leftAvailableBV || 0,
          rightAvailableBV: vol?.rightAvailableBV || 0,
          leftCarryForwardBV: vol?.leftCarryForwardBV ?? (vol?.leftAvailableBV || 0),
          rightCarryForwardBV: vol?.rightCarryForwardBV ?? (vol?.rightAvailableBV || 0),
          reservedBV: vol?.reservedBV || 0,
          reservedSide: vol?.reservedSide || null,
          consumedTotalBV: vol?.consumedTotalBV || vol?.matchedTotalBV || 0,
          payoutCount: vol?.payoutCount || member.matchedPairs || 0,
          dailyCapping: member.dailyCapping || 4000,
        },
        data: records,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Admin manual trigger for daily binary settlement
   * POST /api/binary/settle-daily
   */
  async settleDaily(req: Request, res: Response): Promise<void> {
    try {
      const { date } = req.body;
      const targetDate = date ? new Date(date) : new Date();
      const { DailyBinarySettlementService } = await import('../services/compensation/DailyBinarySettlementService');
      const summary = await DailyBinarySettlementService.executeDailySettlement(targetDate, (req as any).user?.email || 'ADMIN');
      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Daily binary settlement completed for ${summary.date}. Processed ${summary.details.length} earners.`,
        data: summary,
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },
};
