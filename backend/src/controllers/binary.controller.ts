import { Request, Response } from 'express';
import { BinaryTreeService } from '../services/tree/BinaryTreeService';
import { BinaryVolume } from '../models/BinaryVolume.model';
import { Member } from '../models/Member.model';
import { HTTP_STATUS, BINARY_POSITION, BinaryPosition, ROLES } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

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
   * Get binary volume summary for a member
   * GET /api/binary/volume/:memberId
   */
  async getVolume(req: Request, res: Response): Promise<void> {
    try {
      const { memberId } = req.params;
      const vol = await BinaryVolume.findOne({ memberId: memberId.toUpperCase() });
      if (!vol) {
        res.status(HTTP_STATUS.OK).json({
          status: true,
          data: {
            memberId,
            leftTotalBV: 0,
            rightTotalBV: 0,
            leftAvailableBV: 0,
            rightAvailableBV: 0,
            matchedTotalBV: 0,
          },
        });
        return;
      }
      res.status(HTTP_STATUS.OK).json({ status: true, data: vol });
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
};
