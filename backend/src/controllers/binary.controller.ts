import { Request, Response } from 'express';
import { BinaryTreeService } from '../services/tree/BinaryTreeService';
import { BinaryVolume } from '../models/BinaryVolume.model';
import { Member } from '../models/Member.model';
import { HTTP_STATUS, BINARY_POSITION, BinaryPosition } from '../config/constants';

export const BinaryController = {
  /**
   * Get visual binary tree hierarchy
   * GET /api/binary/tree?root=MEM0001&depth=4
   */
  async getTree(req: Request, res: Response): Promise<void> {
    try {
      const rootId = (req.query.root as string) || 'MEM0001';
      const depth = parseInt((req.query.depth as string) || '4', 10);

      const tree = await BinaryTreeService.getBinaryTree(rootId, depth);
      if (!tree) {
        // Fallback to first member if MEM0001 not found
        const firstMember = await Member.findOne().sort({ createdAt: 1 });
        if (firstMember) {
          const fallbackTree = await BinaryTreeService.getBinaryTree(firstMember.memberId, depth);
          res.status(HTTP_STATUS.OK).json({ status: true, data: fallbackTree });
          return;
        }
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Binary tree root not found.' });
        return;
      }

      res.status(HTTP_STATUS.OK).json({ status: true, data: tree });
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
      const { parentMemberId, position, candidateMemberId } = req.body;
      if (!parentMemberId || !position) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Both parentMemberId and position (LEFT or RIGHT) are required.',
        });
        return;
      }

      const result = await BinaryTreeService.validatePlacement(
        parentMemberId,
        position.toUpperCase() as BinaryPosition,
        candidateMemberId
      );

      if (!result.isValid) {
        res.status(HTTP_STATUS.CONFLICT).json({ status: false, message: result.error });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Placement on ${position.toUpperCase()} under ${parentMemberId} is valid.`,
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
   * Find available placement slot under given member
   * GET /api/binary/available-placement/:memberId?leg=LEFT
   */
  async findAvailablePlacement(req: Request, res: Response): Promise<void> {
    try {
      const { memberId } = req.params;
      const leg = ((req.query.leg as string)?.toUpperCase() as BinaryPosition) || BINARY_POSITION.LEFT;
      const result = await BinaryTreeService.findAvailablePlacement(memberId, leg);
      res.status(HTTP_STATUS.OK).json({ status: true, data: result });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },
};
