import { Request, Response } from 'express';
import { Member } from '../models/Member.model';
import { Purchase } from '../models/Purchase.model';
import { CommissionLedger } from '../models/CommissionLedger.model';
import { AuditLog } from '../models/AuditLog.model';
import { BVLedger } from '../models/BVLedger.model';
import { HTTP_STATUS, PURCHASE_TYPE } from '../config/constants';

export const ReportController = {
  /**
   * Admin dashboard metrics overview
   * GET /api/reports/overview
   */
  async getOverview(_req: Request, res: Response): Promise<void> {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        totalUsers,
        activeUsers,
        inactiveUsers,
        purchases,
        commissions,
        todayCommissions,
        totalBvRecords,
      ] = await Promise.all([
        Member.countDocuments(),
        Member.countDocuments({ isActive: true, status: 'active' }),
        Member.countDocuments({ $or: [{ isActive: false }, { status: 'inactive' }] }),
        Purchase.find({ status: 'COMPLETED' }),
        CommissionLedger.find({ status: { $in: ['APPROVED', 'PAID'] } }),
        CommissionLedger.find({
          status: { $in: ['APPROVED', 'PAID'] },
          createdAt: { $gte: todayStart },
        }),
        BVLedger.find(),
      ]);

      const totalSales = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
      const totalBV = purchases.reduce((sum, p) => sum + p.totalBV, 0);
      const totalCommissionsAmount = commissions.reduce((sum, c) => sum + c.payableAmount, 0);
      const todayCommissionsAmount = todayCommissions.reduce((sum, c) => sum + c.payableAmount, 0);

      const joiningCount = purchases.filter(p => p.type === PURCHASE_TYPE.JOINING).length;
      const repurchaseVolume = purchases
        .filter(p => p.type === PURCHASE_TYPE.REPURCHASE)
        .reduce((sum, p) => sum + p.totalBV, 0);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          users: {
            total: totalUsers,
            active: activeUsers,
            inactive: inactiveUsers,
            activePercentage: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
          },
          financials: {
            totalSales,
            totalBV,
            totalCommissions: totalCommissionsAmount,
            todayCommissions: todayCommissionsAmount,
            joiningPackagesSold: joiningCount,
            repurchaseVolume,
          },
          bvLedgerCount: totalBvRecords.length,
        },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Get audit logs
   * GET /api/audit-logs
   */
  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const { entity, limit = 50, page = 1 } = req.query;
      const query: any = {};
      if (entity) query.entity = entity;

      const skip = (Number(page) - 1) * Number(limit);
      const [logs, total] = await Promise.all([
        AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
        AuditLog.countDocuments(query),
      ]);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: logs,
        pagination: { total, page: Number(page), limit: Number(limit) },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },
};
