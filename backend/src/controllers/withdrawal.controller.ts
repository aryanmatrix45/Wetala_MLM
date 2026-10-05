import { Response } from 'express';
import mongoose from 'mongoose';
import { WithdrawalRequest, IWithdrawalRequest } from '../models/WithdrawalRequest.model';
import { AdminNotification } from '../models/AdminNotification.model';
import { Wallet } from '../models/Wallet.model';
import { Member } from '../models/Member.model';
import { WalletTransaction } from '../models/WalletTransaction.model';
import { AuditLog } from '../models/AuditLog.model';
import { WalletService } from '../services/WalletService';
import { DecimalUtil } from '../utils/decimal';
import { HTTP_STATUS, ROLES } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

const getWithdrawalQuery = (id: string) => {
  return mongoose.Types.ObjectId.isValid(id)
    ? { $or: [{ requestId: id }, { _id: id }] }
    : { requestId: id };
};

const getNotificationQuery = (id: string) => {
  return mongoose.Types.ObjectId.isValid(id)
    ? { $or: [{ notificationId: id }, { _id: id }] }
    : { notificationId: id };
};

export const WithdrawalController = {
  /**
   * Member submits a new withdrawal request
   * POST /api/withdrawals/request
   */
  async submitRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({ status: false, message: 'Authentication required' });
        return;
      }

      // Member ID from authenticated session, or body if admin simulating
      const targetMemberId = (user.role === ROLES.MEMBER ? user.memberId : req.body.memberId || user.memberId)?.toUpperCase();
      if (!targetMemberId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Member ID is missing from user profile' });
        return;
      }

      const { amount, note } = req.body;
      const numAmount = Number(amount);

      if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Please enter a valid withdrawal amount greater than ₹0' });
        return;
      }

      // Fetch member & wallet
      const member = await Member.findOne({ memberId: targetMemberId });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: `Member ${targetMemberId} not found` });
        return;
      }

      const wallet = await WalletService.getOrCreateWallet(targetMemberId, member._id.toString());
      const availableBalance = wallet.availableBalance ?? DecimalUtil.fromPaise(wallet.availableBalanceInPaise ?? 0);

      // Check against current pending/approved requests
      const activeRequests = await WithdrawalRequest.find({
        memberId: targetMemberId,
        status: { $in: ['PENDING', 'APPROVED'] }
      });
      const pendingSum = activeRequests.reduce((sum, r) => sum + (r.requestedAmount || 0), 0);
      const effectiveAvailable = Math.max(0, availableBalance - pendingSum);

      if (numAmount > availableBalance) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: `Requested amount (₹${numAmount.toLocaleString()}) cannot exceed your available payout balance of ₹${availableBalance.toLocaleString()}.`
        });
        return;
      }

      if (numAmount > effectiveAvailable) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: `You currently have ₹${pendingSum.toLocaleString()} in pending/approved requests. Your remaining requestable balance is ₹${effectiveAvailable.toLocaleString()}.`
        });
        return;
      }

      const requestId = `WR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Create Withdrawal Request with status PENDING.
      // NOTE: NEVER deduct balance at this point!
      const withdrawalRequest = await WithdrawalRequest.create({
        requestId,
        memberId: targetMemberId,
        memberName: member.name,
        requestedAmount: numAmount,
        status: 'PENDING',
        note: (note || '').trim(),
        requestedAt: new Date(),
        statusHistory: [
          {
            status: 'PENDING',
            changedAt: new Date(),
            changedBy: targetMemberId,
            note: (note || '').trim() || 'Withdrawal request created'
          }
        ]
      });

      // Send notification/message to Admin
      await AdminNotification.create({
        notificationId: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        type: 'WITHDRAWAL_REQUEST',
        title: 'New Withdrawal Request',
        message: `${member.name} (${targetMemberId}) submitted a withdrawal request for ₹${numAmount.toLocaleString()}.`,
        senderId: targetMemberId,
        senderName: member.name,
        recipientRole: 'admin',
        recipientId: 'admin',
        referenceId: requestId,
        amount: numAmount,
        isRead: false,
        metadata: {
          note: (note || '').trim(),
          availableBalance,
          requestedAmount: numAmount
        }
      });

      // Audit Log
      await AuditLog.create({
        logId: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        action: 'WITHDRAWAL_REQUESTED',
        entity: 'WITHDRAWAL_REQUEST',
        entityId: requestId,
        performedBy: targetMemberId,
        performedByRole: 'member',
        newValues: {
          requestedAmount: numAmount,
          status: 'PENDING',
          note: (note || '').trim()
        }
      });

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: 'Withdrawal request submitted successfully and forwarded to administration for review.',
        data: withdrawalRequest
      });
    } catch (error: any) {
      console.error('[WithdrawalController.submitRequest] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Member views their own withdrawal requests
   * GET /api/withdrawals/my-requests
   */
  async getMyRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({ status: false, message: 'Authentication required' });
        return;
      }

      const memberId = (user.role === ROLES.MEMBER ? user.memberId : req.query.memberId as string || user.memberId)?.toUpperCase();
      if (!memberId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Member ID not specified' });
        return;
      }

      const requests = await WithdrawalRequest.find({ memberId }).sort({ requestedAt: -1 });

      const member = await Member.findOne({ memberId });
      const wallet = member ? await WalletService.getOrCreateWallet(memberId, member._id.toString()) : null;

      const summary = {
        availablePayout: wallet ? wallet.availableBalance : 0,
        totalPayout: wallet ? wallet.totalEarned : (member?.totalIncome || 0),
        totalWithdrawn: wallet ? wallet.withdrawnAmount : 0,
        totalPending: requests
          .filter(r => r.status === 'PENDING' || r.status === 'APPROVED')
          .reduce((sum, r) => sum + r.requestedAmount, 0),
        requestsCount: requests.length,
        pendingCount: requests.filter(r => r.status === 'PENDING').length,
        approvedCount: requests.filter(r => r.status === 'APPROVED').length,
        paidCount: requests.filter(r => r.status === 'PAID').length,
        rejectedCount: requests.filter(r => r.status === 'REJECTED').length,
      };

      res.status(HTTP_STATUS.OK).json({
        status: true,
        summary,
        data: requests
      });
    } catch (error: any) {
      console.error('[WithdrawalController.getMyRequests] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Get member payout balance summary
   * GET /api/withdrawals/balance-summary/:memberId?
   */
  async getBalanceSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const memberId = (req.params.memberId || req.user?.memberId || 'MEM0001').toUpperCase();
      const member = await Member.findOne({ memberId });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Member not found' });
        return;
      }

      const wallet = await WalletService.getOrCreateWallet(memberId, member._id.toString());
      const activeRequests = await WithdrawalRequest.find({
        memberId,
        status: { $in: ['PENDING', 'APPROVED'] }
      });
      const pendingSum = activeRequests.reduce((sum, r) => sum + (r.requestedAmount || 0), 0);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          memberId,
          memberName: member.name,
          availablePayout: wallet.availableBalance,
          totalPayout: wallet.totalEarned,
          withdrawnAmount: wallet.withdrawnAmount,
          pendingAmount: pendingSum,
          effectiveAvailable: Math.max(0, wallet.availableBalance - pendingSum),
          pendingRequestsCount: activeRequests.length
        }
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Admin views all withdrawal requests
   * GET /api/withdrawals/admin/all
   */
  async getAllRequestsAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { status, search, limit = 100, page = 1 } = req.query;

      const query: any = {};
      if (status && status !== 'ALL') {
        query.status = (status as string).toUpperCase();
      }

      if (search) {
        const regex = new RegExp(String(search).trim(), 'i');
        query.$or = [
          { memberId: regex },
          { memberName: regex },
          { requestId: regex },
          { paymentReference: regex }
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [requests, totalCount] = await Promise.all([
        WithdrawalRequest.find(query).sort({ requestedAt: -1 }).skip(skip).limit(Number(limit)),
        WithdrawalRequest.countDocuments(query)
      ]);

      // All-time aggregated KPIs
      const all = await WithdrawalRequest.find();
      const kpis = {
        totalRequests: all.length,
        pendingCount: all.filter(r => r.status === 'PENDING').length,
        approvedCount: all.filter(r => r.status === 'APPROVED').length,
        paidCount: all.filter(r => r.status === 'PAID').length,
        rejectedCount: all.filter(r => r.status === 'REJECTED').length,
        totalRequestedAmount: all.reduce((sum, r) => sum + (r.requestedAmount || 0), 0),
        totalPaidAmount: all.filter(r => r.status === 'PAID').reduce((sum, r) => sum + (r.paidAmount || r.requestedAmount || 0), 0),
        totalPendingAmount: all.filter(r => r.status === 'PENDING' || r.status === 'APPROVED').reduce((sum, r) => sum + (r.requestedAmount || 0), 0),
      };

      res.status(HTTP_STATUS.OK).json({
        status: true,
        kpis,
        total: totalCount,
        data: requests
      });
    } catch (error: any) {
      console.error('[WithdrawalController.getAllRequestsAdmin] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Admin approves a withdrawal request
   * POST /api/withdrawals/admin/:id/approve
   * Note: NEVER deduct balance at this point!
   */
  async approveRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { approvedAmount, adminNote } = req.body;
      const adminIdentifier = req.user?.email || req.user?.id || 'ADMIN';

      const request = await WithdrawalRequest.findOne(getWithdrawalQuery(id));

      if (!request) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Withdrawal request not found' });
        return;
      }

      if (request.status !== 'PENDING') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: `Cannot approve request with current status '${request.status}'. Only PENDING requests can be approved.`
        });
        return;
      }

      const finalApprovedAmount = approvedAmount ? Number(approvedAmount) : request.requestedAmount;

      request.status = 'APPROVED';
      request.approvedAmount = finalApprovedAmount;
      request.approvedAt = new Date();
      request.processedBy = adminIdentifier;
      if (adminNote) {
        request.adminNote = adminNote.trim();
      }

      request.statusHistory.push({
        status: 'APPROVED',
        changedAt: new Date(),
        changedBy: adminIdentifier,
        note: adminNote?.trim() || `Approved for ₹${finalApprovedAmount.toLocaleString()}`
      });

      await request.save();

      // Create notification for member
      await AdminNotification.create({
        notificationId: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        type: 'WITHDRAWAL_APPROVED',
        title: 'Withdrawal Request Approved',
        message: `Your withdrawal request (${request.requestId}) for ₹${finalApprovedAmount.toLocaleString()} has been approved. Payment will be disbursed soon.`,
        senderId: 'admin',
        senderName: 'Administration',
        recipientRole: 'member',
        recipientId: request.memberId,
        referenceId: request.requestId,
        amount: finalApprovedAmount,
        isRead: false
      });

      // Audit Log
      await AuditLog.create({
        logId: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        action: 'WITHDRAWAL_APPROVED',
        entity: 'WITHDRAWAL_REQUEST',
        entityId: request.requestId,
        performedBy: adminIdentifier,
        performedByRole: 'admin',
        oldValues: { status: 'PENDING' },
        newValues: { status: 'APPROVED', approvedAmount: finalApprovedAmount, adminNote }
      });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Withdrawal request ${request.requestId} approved successfully.`,
        data: request
      });
    } catch (error: any) {
      console.error('[WithdrawalController.approveRequest] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Admin rejects a withdrawal request
   * POST /api/withdrawals/admin/:id/reject
   */
  async rejectRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { adminNote } = req.body;
      const adminIdentifier = req.user?.email || req.user?.id || 'ADMIN';

      const request = await WithdrawalRequest.findOne(getWithdrawalQuery(id));

      if (!request) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Withdrawal request not found' });
        return;
      }

      if (request.status === 'PAID') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Cannot reject a request that has already been marked as PAID.'
        });
        return;
      }

      if (request.status === 'REJECTED') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Request is already rejected.'
        });
        return;
      }

      const previousStatus = request.status;
      request.status = 'REJECTED';
      request.rejectedAt = new Date();
      request.processedBy = adminIdentifier;
      request.adminNote = (adminNote || 'Rejected by administration').trim();

      request.statusHistory.push({
        status: 'REJECTED',
        changedAt: new Date(),
        changedBy: adminIdentifier,
        note: request.adminNote
      });

      await request.save();

      // Notify member
      await AdminNotification.create({
        notificationId: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        type: 'WITHDRAWAL_REJECTED',
        title: 'Withdrawal Request Rejected',
        message: `Your withdrawal request (${request.requestId}) of ₹${request.requestedAmount.toLocaleString()} was rejected: ${request.adminNote}`,
        senderId: 'admin',
        senderName: 'Administration',
        recipientRole: 'member',
        recipientId: request.memberId,
        referenceId: request.requestId,
        amount: request.requestedAmount,
        isRead: false
      });

      // Audit Log
      await AuditLog.create({
        logId: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        action: 'WITHDRAWAL_REJECTED',
        entity: 'WITHDRAWAL_REQUEST',
        entityId: request.requestId,
        performedBy: adminIdentifier,
        performedByRole: 'admin',
        oldValues: { status: previousStatus },
        newValues: { status: 'REJECTED', adminNote: request.adminNote }
      });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Withdrawal request ${request.requestId} has been rejected.`,
        data: request
      });
    } catch (error: any) {
      console.error('[WithdrawalController.rejectRequest] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Admin marks a request as PAID
   * POST /api/withdrawals/admin/:id/pay
   * Requirements:
   * 1. Deducts actual paid amount from member's Total Payout/Available Payout balance.
   * 2. Prevents duplicate payment / double deduction if called twice.
   * 3. Performs balance deduction and status update atomically.
   * 4. Maintains audit trail.
   */
  async markAsPaid(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { paidAmount, paymentReference, adminNote } = req.body;
      const adminIdentifier = req.user?.email || req.user?.id || 'ADMIN';

      if (!paymentReference || !String(paymentReference).trim()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Payment reference or Transaction ID is required to mark as paid.'
        });
        return;
      }

      // Check request existence and verify current status is not PAID or REJECTED
      const existingRequest = await WithdrawalRequest.findOne(getWithdrawalQuery(id));

      if (!existingRequest) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Withdrawal request not found.' });
        return;
      }

      if (existingRequest.status === 'PAID') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: `This request has already been paid on ${existingRequest.paidAt ? new Date(existingRequest.paidAt).toLocaleDateString() : 'earlier'} (Ref: ${existingRequest.paymentReference}). Double payment prevented.`
        });
        return;
      }

      if (existingRequest.status === 'REJECTED') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Cannot mark a rejected request as paid. Please approve the request first.'
        });
        return;
      }

      const finalPaidAmount = paidAmount !== undefined && paidAmount !== null && Number(paidAmount) > 0
        ? Number(paidAmount)
        : (existingRequest.approvedAmount || existingRequest.requestedAmount);

      const targetMemberId = existingRequest.memberId;
      const member = await Member.findOne({ memberId: targetMemberId });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: `Member ${targetMemberId} not found.` });
        return;
      }

      const wallet = await WalletService.getOrCreateWallet(targetMemberId, member._id.toString());
      const currentAvailable = wallet.availableBalance ?? DecimalUtil.fromPaise(wallet.availableBalanceInPaise ?? 0);

      if (currentAvailable < finalPaidAmount) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: `Member's available payout balance (₹${currentAvailable.toLocaleString()}) is less than the paid amount (₹${finalPaidAmount.toLocaleString()}).`
        });
        return;
      }

      // Atomic conditional update on WithdrawalRequest to prevent race condition duplicate processing
      const updatedRequest = await WithdrawalRequest.findOneAndUpdate(
        {
          _id: existingRequest._id,
          status: { $in: ['APPROVED', 'PENDING'] }
        },
        {
          $set: {
            status: 'PAID',
            paidAmount: finalPaidAmount,
            paymentReference: String(paymentReference).trim(),
            paidAt: new Date(),
            processedBy: adminIdentifier,
            adminNote: adminNote ? adminNote.trim() : existingRequest.adminNote
          },
          $push: {
            statusHistory: {
              status: 'PAID',
              changedAt: new Date(),
              changedBy: adminIdentifier,
              note: `Paid ₹${finalPaidAmount.toLocaleString()} via Ref: ${paymentReference}`
            }
          }
        },
        { new: true }
      );

      if (!updatedRequest) {
        res.status(HTTP_STATUS.CONFLICT).json({
          status: false,
          message: 'Withdrawal request state changed concurrently or was already paid. Payment prevented.'
        });
        return;
      }

      // Deduct balance atomically from Wallet
      try {
        const amountInPaise = DecimalUtil.toPaise(finalPaidAmount);
        const balanceBeforeInPaise = wallet.availableBalanceInPaise || DecimalUtil.toPaise(wallet.availableBalance);
        const balanceAfterInPaise = balanceBeforeInPaise - amountInPaise;

        wallet.availableBalanceInPaise = balanceAfterInPaise;
        wallet.availableBalance = DecimalUtil.fromPaise(balanceAfterInPaise);

        const withdrawnInPaise = (wallet.withdrawnAmountInPaise || DecimalUtil.toPaise(wallet.withdrawnAmount)) + amountInPaise;
        wallet.withdrawnAmountInPaise = withdrawnInPaise;
        wallet.withdrawnAmount = DecimalUtil.fromPaise(withdrawnInPaise);

        const totalPaidInPaise = (wallet.totalPaidInPaise || DecimalUtil.toPaise(wallet.totalPaid)) + amountInPaise;
        wallet.totalPaidInPaise = totalPaidInPaise;
        wallet.totalPaid = DecimalUtil.fromPaise(totalPaidInPaise);

        await wallet.save();

        // Create immutable audit transaction
        await WalletTransaction.create({
          transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          walletId: wallet.walletId,
          userId: member._id.toString(),
          memberId: targetMemberId,
          type: 'DEBIT',
          amount: finalPaidAmount,
          amountInPaise,
          balanceBefore: DecimalUtil.fromPaise(balanceBeforeInPaise),
          balanceBeforeInPaise,
          balanceAfter: DecimalUtil.fromPaise(balanceAfterInPaise),
          balanceAfterInPaise,
          referenceType: 'WITHDRAWAL',
          referenceId: updatedRequest.requestId,
          description: `Withdrawal payout disbursed. Ref: ${paymentReference.trim()}`
        });

        // Safely synchronize member's walletBalance
        await Member.updateOne(
          { memberId: targetMemberId },
          { $set: { walletBalance: wallet.availableBalance } }
        );
      } catch (deductErr: any) {
        // Rollback request status in the rare event wallet save fails
        await WithdrawalRequest.updateOne(
          { _id: updatedRequest._id },
          {
            $set: { status: existingRequest.status, paidAmount: undefined, paidAt: undefined },
            $push: {
              statusHistory: {
                status: existingRequest.status,
                changedAt: new Date(),
                changedBy: 'SYSTEM_ROLLBACK',
                note: `Rollback due to wallet debit error: ${deductErr.message}`
              }
            }
          }
        );
        throw deductErr;
      }

      // Notify Member
      await AdminNotification.create({
        notificationId: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        type: 'WITHDRAWAL_PAID',
        title: 'Payout Disbursed to Bank',
        message: `₹${finalPaidAmount.toLocaleString()} has been transferred. Transaction Ref: ${paymentReference.trim()}.`,
        senderId: 'admin',
        senderName: 'Administration',
        recipientRole: 'member',
        recipientId: targetMemberId,
        referenceId: updatedRequest.requestId,
        amount: finalPaidAmount,
        isRead: false,
        metadata: {
          paymentReference: paymentReference.trim(),
          paidAmount: finalPaidAmount
        }
      });

      // Audit Log
      await AuditLog.create({
        logId: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        action: 'WITHDRAWAL_PAID',
        entity: 'WITHDRAWAL_REQUEST',
        entityId: updatedRequest.requestId,
        performedBy: adminIdentifier,
        performedByRole: 'admin',
        newValues: {
          status: 'PAID',
          paidAmount: finalPaidAmount,
          paymentReference: paymentReference.trim(),
          remainingWalletBalance: wallet.availableBalance
        }
      });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Withdrawal request ${updatedRequest.requestId} marked as PAID. ₹${finalPaidAmount.toLocaleString()} deducted from member's available payout.`,
        data: {
          request: updatedRequest,
          memberBalance: {
            availablePayout: wallet.availableBalance,
            totalWithdrawn: wallet.withdrawnAmount
          }
        }
      });
    } catch (error: any) {
      console.error('[WithdrawalController.markAsPaid] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Get Admin notifications / messages
   * GET /api/withdrawals/notifications/admin
   */
  async getAdminNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { limit = 50 } = req.query;
      const notifications = await AdminNotification.find({ recipientRole: 'admin' })
        .sort({ createdAt: -1 })
        .limit(Number(limit));

      const unreadCount = await AdminNotification.countDocuments({ recipientRole: 'admin', isRead: false });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        unreadCount,
        data: notifications
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Get Member notifications / messages
   * GET /api/withdrawals/notifications/member/:memberId?
   */
  async getMemberNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const targetMemberId = (req.params.memberId || req.user?.memberId)?.toUpperCase();
      if (!targetMemberId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Member ID required' });
        return;
      }

      const notifications = await AdminNotification.find({
        recipientId: targetMemberId
      })
        .sort({ createdAt: -1 })
        .limit(30);

      const unreadCount = await AdminNotification.countDocuments({
        recipientId: targetMemberId,
        isRead: false
      });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        unreadCount,
        data: notifications
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Mark notification as read
   * PUT /api/withdrawals/notifications/:id/read
   */
  async markNotificationAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await AdminNotification.findOneAndUpdate(
        getNotificationQuery(id),
        { $set: { isRead: true } }
      );
      res.status(HTTP_STATUS.OK).json({ status: true, message: 'Marked as read' });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  }
};
