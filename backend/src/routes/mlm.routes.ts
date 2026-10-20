import { Router } from 'express';
import mongoose from 'mongoose';
import { Member } from '../models/Member.model';
import { Package } from '../models/Package.model';
import { CommissionLedger } from '../models/CommissionLedger.model';
import { Purchase } from '../models/Purchase.model';
import { HTTP_STATUS, BINARY_POSITION, BinaryPosition, ROLES, PURCHASE_STATUS, PURCHASE_TYPE } from '../config/constants';
import { BinaryTreeService } from '../services/tree/BinaryTreeService';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { WalletService } from '../services/WalletService';
import { BVService } from '../services/BVService';
import { GrossVolumeService } from '../services/GrossVolumeService';
import { BusinessDate } from '../utils/businessDate';

const router = Router();

// Dashboard Overview Metrics - Fetches 100% dynamically from MongoDB
router.get('/dashboard/stats', async (_req, res) => {
  try {
    const [members, packages, commissions, purchases] = await Promise.all([
      Member.find().sort({ createdAt: -1 }),
      Package.find(),
      CommissionLedger.find(),
      Purchase.find({
        $or: [
          { status: PURCHASE_STATUS.COMPLETED, paymentStatus: 'PAID' },
          { approvalStage: 'VERIFIED_AND_PAID', paymentStatus: 'PAID' },
        ],
      }),
    ]);

    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.status === 'active' || m.isActive).length;
    const inactiveMembers = totalMembers - activeMembers;
    const activePercent = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;

    // Build package price and BV lookup maps from database
    const pkgPriceMap = new Map<string, number>();
    const pkgBvMap = new Map<string, number>();
    packages.forEach(p => {
      const price = p.price || 0;
      const bv = p.bv || 0;
      if (p.packageId) {
        pkgPriceMap.set(p.packageId.toLowerCase().trim(), price);
        pkgBvMap.set(p.packageId.toLowerCase().trim(), bv);
      }
      if (p.name) {
        pkgPriceMap.set(p.name.toLowerCase().trim(), price);
        pkgBvMap.set(p.name.toLowerCase().trim(), bv);
      }
      if (p.badge) {
        pkgPriceMap.set(p.badge.toLowerCase().trim(), price);
        pkgBvMap.set(p.badge.toLowerCase().trim(), bv);
      }
    });

    // 1. Identify members who have an official paid JOINING purchase record
    const paidJoiningMemberIds = new Set(
      purchases
        .filter(p => p.type === PURCHASE_TYPE.JOINING)
        .map(p => p.memberId)
    );

    let totalJoiningPackagePrice = 0;
    let totalJoiningBV = 0;

    // A. Add paid joining purchases
    for (const p of purchases) {
      if (p.type === PURCHASE_TYPE.JOINING) {
        totalJoiningPackagePrice += (p.totalAmount || 0);
        totalJoiningBV += (p.totalBV || 0);
      }
    }

    // B. Add members who have an active/paid package directly on member record
    // but not already counted in paidJoiningMemberIds (e.g. root or direct admin assignment)
    for (const m of members) {
      if (paidJoiningMemberIds.has(m.memberId)) {
        continue;
      }
      if (m.packageBv && m.packageBv > 0) {
        const pkgKey = (m.joiningPackageId || m.packageName || '').toLowerCase().trim();
        const price = pkgPriceMap.get(pkgKey) || 0;
        totalJoiningPackagePrice += price;
        totalJoiningBV += m.packageBv;
      }
    }

    // 2. Add product repurchases strictly from paid purchases
    let repurchaseTurnover = 0;
    let repurchaseBv = 0;
    for (const p of purchases) {
      if (p.type !== PURCHASE_TYPE.JOINING) {
        repurchaseTurnover += (p.totalAmount || 0);
        repurchaseBv += (p.totalBV || 0);
      }
    }

    const totalPackagePrice = totalJoiningPackagePrice;
    const totalGrossValue = totalJoiningPackagePrice + repurchaseTurnover;
    const totalBusinessVolume = totalJoiningBV + repurchaseBv;

    // Current welcome bonus week (Monday to Sunday, IST), same figure the weekly settlement uses
    const weekStart = BusinessDate.startOf(BusinessDate.weekStartOf(BusinessDate.today()));
    const weekly = await GrossVolumeService.forPeriod(weekStart, new Date());
    const weeklyGrossBusinessVolume = weekly.bv;
    const weeklyGrossRevenue = weekly.revenue;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const registrationsToday = members.filter(m => {
      const d = m.createdAt || m.joinedAt;
      return d && new Date(d) >= todayStart;
    }).length;

    const rankAchievers = members.filter(m => m.rank && !['distributor', 'member', 'none', ''].includes(m.rank.toLowerCase().trim())).length;

    // Commissions / Payouts from database CommissionLedger
    const totalCommissionsPaid = commissions
      .filter(c => c.status === 'PAID' || c.status === 'APPROVED')
      .reduce((sum, c) => sum + (c.payableAmount || 0), 0);
    const pendingCommissions = commissions
      .filter(c => c.status === 'PENDING')
      .reduce((sum, c) => sum + (c.payableAmount || 0), 0);

    const totalPayoutAmount = totalCommissionsPaid;
    const pendingPayoutAmount = pendingCommissions;

    // Formatted recent real members from MongoDB
    const recentMembers = members.slice(0, 5).map(m => {
      const pkgKey = (m.joiningPackageId || m.packageName || '').toLowerCase().trim();
      const price = pkgPriceMap.get(pkgKey) || 0;
      const hasPaid = Boolean(m.packageBv && m.packageBv > 0) || paidJoiningMemberIds.has(m.memberId);
      const bv = hasPaid ? (m.packageBv || pkgBvMap.get(pkgKey) || 0) : 0;
      return {
        id: m.memberId,
        name: m.name,
        package: m.packageName || (hasPaid ? 'Package' : 'Unpaid / None'),
        packagePrice: hasPaid ? price : 0,
        bv: `${bv.toLocaleString()} BV`,
        date: m.joinDate || (m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''),
        status: m.status === 'active' || m.isActive ? 'Active' : 'Inactive',
        leg: (m.position || m.binaryPosition || 'LEFT').toUpperCase(),
      };
    });

    res.json({
      status: true,
      totalMembers,
      newRegistrations: totalMembers,
      registrationsToday,
      totalIncomeMonth: totalGrossValue,
      totalPackagePrice,
      totalJoiningRevenue: totalPackagePrice,
      totalGrossValue,
      totalBusinessVolume,
      totalBV: totalBusinessVolume,
      weeklyGrossBusinessVolume,
      weeklyGrossRevenue,
      weeklyGrossValue: weeklyGrossRevenue,
      totalPayoutMonth: totalPayoutAmount,
      pendingPayouts: pendingPayoutAmount,
      repurchaseTurnover,
      rankAchievers,
      recentMembers,
      quickStats: {
        activeMembers,
        activePercent,
        inactiveMembers,
        totalBusinessVolume,
        repurchaseBv,
        repurchasePercent: totalBusinessVolume > 0 ? Math.round((repurchaseBv / totalBusinessVolume) * 100) : 0,
        activeFranchises: 0,
        franchisePercent: 0,
        pendingPayouts: pendingPayoutAmount,
        repurchaseTurnover,
        rankAchievers,
      },
    });
  } catch (error: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: error.message || 'Failed to fetch dashboard stats'
    });
  }
});

// Member List from MongoDB (Role-scoped: Super Admin sees everyone, members see only their direct sponsorships)
router.get('/members', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    let query: any = {};

    if (user?.role !== ROLES.SUPERADMIN) {
      if (user?.role !== ROLES.MEMBER || !user.memberId) {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          status: false,
          message: 'Access denied.'
        });
        return;
      }
      // Regular Member: only members they directly sponsored
      query = { sponsorId: user.memberId.toUpperCase().trim() };
    } else {
      // Super Admin: can filter by status / approvalStatus
      if (req.query.approvalStatus) {
        query.approvalStatus = req.query.approvalStatus;
      }
      if (req.query.status) {
        query.status = req.query.status;
      }
    }

    const members = await Member.find(query).sort({ createdAt: -1 });
    
    // Map to client contract
    const mapped = members.map(m => ({
      id: m._id.toString(),
      memberId: m.memberId,
      name: m.name,
      email: m.email,
      mobile: m.mobile,
      dob: m.dob || '',
      sponsorId: m.sponsorId,
      parentId: m.parentId || m.binaryParentId || m.placementId || '',
      placementId: m.placementId,
      position: m.position,
      preferredLeg: m.preferredLeg || m.position,
      packageName: m.packageName,
      joinDate: m.joinDate,
      status: m.status,
      approvalStatus: m.approvalStatus || 'approved',
      addedBy: m.addedBy || 'ADMIN',
      approvedAt: m.approvedAt,
      approvedBy: m.approvedBy,
      rejectionReason: m.rejectionReason || '',
      isActive: m.isActive,
      personalBv: m.personalBv || 0,
      isBinaryActive: m.isBinaryActive || false,
      binaryActivatedAt: m.binaryActivatedAt,
      leftBv: m.leftBv,
      rightBv: m.rightBv,
      matchedPairs: m.matchedPairs,
      totalIncome: m.totalIncome,
      walletBalance: m.walletBalance
    }));

    res.json(mapped);
  } catch (error: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: error.message || 'Failed to fetch members'
    });
  }
});

// ==========================================
// Super Admin Member Request Endpoints
// ==========================================

// GET all pending member requests for Super Admin
router.get('/admin/member-requests', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== ROLES.SUPERADMIN) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        status: false,
        message: 'Access restricted to Super Admin only.'
      });
      return;
    }

    const pendingMembers = await Member.find({ approvalStatus: 'pending' }).sort({ createdAt: -1 });

    const requests = pendingMembers.map(m => ({
      id: m._id.toString(),
      memberId: m.memberId,
      name: m.name,
      email: m.email,
      mobile: m.mobile,
      dob: m.dob || '',
      sponsorId: m.sponsorId,
      parentId: m.parentId || m.binaryParentId || '',
      position: m.position,
      packageName: m.packageName,
      packageBv: m.packageBv,
      addedBy: m.addedBy || 'MEMBER',
      createdAt: m.createdAt,
      joinDate: m.joinDate,
      approvalStatus: m.approvalStatus,
      status: m.status,
    }));

    res.json({
      status: true,
      totalPending: requests.length,
      data: requests,
    });
  } catch (error: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: error.message || 'Failed to fetch pending member requests'
    });
  }
});

// Helper for approving member request
const handleApproveMember = async (req: AuthenticatedRequest, res: any) => {
  try {
    if (req.user?.role !== ROLES.SUPERADMIN) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        status: false,
        message: 'Access restricted to Super Admin only.'
      });
      return;
    }

    const { id } = req.params;
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
        { memberId: id.toUpperCase().trim() }
      ],
    });

    if (!member) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        status: false,
        message: `Member request not found for ID: ${id}`
      });
      return;
    }

    if (member.approvalStatus === 'approved' && member.isActive) {
      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Member ${member.name} (${member.memberId}) is already approved and active.`,
        data: member,
      });
      return;
    }

    // Check if placement is still valid; if occupied in meantime, auto-rebalance under sponsor
    if (member.parentId && member.position) {
      const targetPos: BinaryPosition = member.position === 'RIGHT' ? BINARY_POSITION.RIGHT : BINARY_POSITION.LEFT;
      const placementCheck = await BinaryTreeService.validatePlacement(member.parentId, targetPos, member.memberId);
      if (!placementCheck.isValid) {
        const placementRoot = (member.sponsorId && member.sponsorId !== 'ADMIN') ? member.sponsorId : '';
        const auto = await BinaryTreeService.findExtremeLegPlacement(placementRoot, targetPos);
        member.parentId = auto.parentId;
        member.binaryParentId = auto.parentId;
        member.placementId = auto.parentId;
        member.position = auto.position;
        member.binaryPosition = auto.position;
      }
    }

    member.approvalStatus = 'approved';
    member.status = 'active';
    member.isActive = true; // Enables login access
    member.isBinaryActive = (member.personalBv || 0) >= 100 || member.activationSource === 'BV_WALLET';
    member.approvedAt = new Date();
    member.approvedBy = req.user?.email || 'ADMIN';
    await member.save();

    // Initialize member financial and volume records
    await WalletService.getOrCreateWallet(member.memberId, member._id.toString()).catch(() => null);
    await BVService.getOrCreateBinaryVolume(member.memberId, member._id.toString()).catch(() => null);

    const binaryStatusMsg = member.isBinaryActive
      ? 'ID is active in the binary income tree.'
      : 'ID can now log in. Binary income tree participation will activate once account reaches minimum 100 BV.';

    res.json({
      status: true,
      message: `Member ${member.name} (${member.memberId}) has been accepted! ${binaryStatusMsg}`,
      data: member,
    });
  } catch (error: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: error.message || 'Failed to approve member request'
    });
  }
};

// Helper for rejecting member request
const handleRejectMember = async (req: AuthenticatedRequest, res: any) => {
  try {
    if (req.user?.role !== ROLES.SUPERADMIN) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        status: false,
        message: 'Access restricted to Super Admin only.'
      });
      return;
    }

    const { id } = req.params;
    const { reason } = req.body;
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
        { memberId: id.toUpperCase().trim() }
      ],
    });

    if (!member) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        status: false,
        message: `Member request not found for ID: ${id}`
      });
      return;
    }

    member.approvalStatus = 'rejected';
    member.status = 'rejected';
    member.isActive = false;
    member.rejectionReason = (reason || 'Rejected by Super Admin').trim();
    // Release binary tree slot so others can take it
    member.parentId = '';
    member.binaryParentId = '';
    member.placementId = '';
    await member.save();

    res.json({
      status: true,
      message: `Member request for ${member.name} (${member.memberId}) has been rejected.`,
      data: member,
    });
  } catch (error: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: error.message || 'Failed to reject member request'
    });
  }
};

router.put('/admin/member-requests/:id/approve', authenticate, handleApproveMember);
router.post('/admin/member-requests/:id/approve', authenticate, handleApproveMember);
router.put('/admin/member-requests/:id/reject', authenticate, handleRejectMember);
router.post('/admin/member-requests/:id/reject', authenticate, handleRejectMember);

// Binary Tree Hierarchy from Database
router.get('/genealogy/tree', async (req, res) => {
  try {
    const rootId = (req.query.memberId as string) || '';
    let targetMemberId = rootId;
    if (!targetMemberId) {
      const rootMember = await Member.findOne().sort({ createdAt: 1 });
      targetMemberId = rootMember ? rootMember.memberId : '';
    }
    if (!targetMemberId) {
      return res.json(null);
    }
    const tree = await BinaryTreeService.getBinaryTree(targetMemberId, 10);
    res.json(tree);
  } catch (error: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: error.message || 'Failed to fetch genealogy tree'
    });
  }
});

// Packages & Slabs from Database
router.get('/packages', async (_req, res) => {
  try {
    const dbPackages = await Package.find({ isActive: true }).sort({ packageNumber: 1, price: 1 });
    const formattedJoining = dbPackages.map(p => ({
      id: p.packageId,
      packageId: p.packageId,
      packageNumber: p.packageNumber,
      name: p.name,
      price: p.price,
      bv: p.bv,
      rp: p.rp,
      dailyCapping: p.dailyCapping,
      description: p.description,
      isActive: p.isActive,
    }));

    res.json({
      joiningPackages: formattedJoining,
      repurchaseSlabs: [],
      franchiseSlabs: [],
      rewardMilestones: []
    });
  } catch (err: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: err.message || 'Failed to fetch packages'
    });
  }
});

// Payouts List from Database CommissionLedger
router.get('/payouts', async (_req, res) => {
  try {
    const commissions = await CommissionLedger.find().sort({ createdAt: -1 });
    const members = await Member.find();
    const memberNameMap = new Map(members.map(m => [m.memberId, m.name]));

    const mapped = commissions.map(c => ({
      id: c.ledgerId || c._id.toString(),
      memberId: c.memberId,
      memberName: memberNameMap.get(c.memberId) || c.memberId,
      amount: c.grossAmount,
      tdsDeduction: c.tdsDeduction,
      adminFee: c.adminFee,
      netPayable: c.payableAmount,
      requestDate: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
      status: c.status.toLowerCase(),
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: err.message || 'Failed to fetch payouts'
    });
  }
});

// Process Payout Action in Database CommissionLedger
router.post('/payouts/:id/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'pay' or 'reject'
    
    const ledgerQuery = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ ledgerId: id }, { _id: id }] }
      : { ledgerId: id };

    const updated = await CommissionLedger.findOneAndUpdate(
      ledgerQuery,
      { status: action === 'pay' ? 'PAID' : 'REJECTED' },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Payout record not found in ledger' });
    }

    res.json({
      success: true,
      payout: {
        id: updated.ledgerId,
        memberId: updated.memberId,
        amount: updated.grossAmount,
        status: updated.status.toLowerCase()
      }
    });
  } catch (err: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: err.message || 'Failed to update payout'
    });
  }
});

export default router;
