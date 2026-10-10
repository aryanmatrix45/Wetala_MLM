import { Router } from 'express';
import mongoose from 'mongoose';
import { Member } from '../models/Member.model';
import { Package } from '../models/Package.model';
import { CommissionLedger } from '../models/CommissionLedger.model';
import { Purchase } from '../models/Purchase.model';
import { HTTP_STATUS, BINARY_POSITION, BinaryPosition, ROLES } from '../config/constants';
import { BinaryTreeService } from '../services/tree/BinaryTreeService';
import { optionalAuthenticate, authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { WalletService } from '../services/WalletService';
import { BVService } from '../services/BVService';

const router = Router();

// Dashboard Overview Metrics - Fetches 100% dynamically from MongoDB
router.get('/dashboard/stats', async (_req, res) => {
  try {
    const [members, packages, commissions, purchases] = await Promise.all([
      Member.find().sort({ createdAt: -1 }),
      Package.find(),
      CommissionLedger.find(),
      Purchase.find(),
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

    // Calculate total price of all joined members (Total Joining Revenue)
    // and total business volume (BV) generated across the network strictly from DB
    let totalPackagePrice = 0;
    let totalBusinessVolume = 0;
    for (const m of members) {
      const pkgKey = (m.joiningPackageId || m.packageName || '').toLowerCase().trim();
      const price = pkgPriceMap.get(pkgKey) || 0;
      const bv = m.packageBv || pkgBvMap.get(pkgKey) || 0;
      totalPackagePrice += price;
      totalBusinessVolume += bv;
    }

    // Add purchases / repurchase BV strictly from DB
    if (purchases && purchases.length > 0) {
      for (const p of purchases) {
        totalBusinessVolume += (p.totalBV || 0);
      }
    }

    // Calculate current weekly settlement period (Mon 00:00 to Sun 23:59:59)
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    let weeklyPackagePrice = 0;
    let weeklyGrossBusinessVolume = 0;
    for (const m of members) {
      const d = m.createdAt || m.joinedAt;
      if (d && new Date(d) >= weekStart) {
        const pkgKey = (m.joiningPackageId || m.packageName || '').toLowerCase().trim();
        const price = pkgPriceMap.get(pkgKey) || 0;
        const bv = m.packageBv || pkgBvMap.get(pkgKey) || 0;
        weeklyPackagePrice += price;
        weeklyGrossBusinessVolume += bv;
      }
    }

    let repurchaseTurnover = 0;
    let repurchaseBv = 0;
    if (purchases && purchases.length > 0) {
      for (const p of purchases) {
        repurchaseTurnover += (p.totalAmount || 0);
        repurchaseBv += (p.totalBV || 0);
        const d = p.createdAt;
        if (d && new Date(d) >= weekStart) {
          weeklyGrossBusinessVolume += (p.totalBV || 0);
          weeklyPackagePrice += (p.totalAmount || 0);
        }
      }
    }

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
      const bv = m.packageBv || pkgBvMap.get(pkgKey) || 0;
      return {
        id: m.memberId,
        name: m.name,
        package: m.packageName || 'Package',
        packagePrice: price,
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
      totalIncomeMonth: totalPackagePrice,
      totalPackagePrice,
      totalJoiningRevenue: totalPackagePrice,
      totalGrossValue: totalPackagePrice,
      totalBusinessVolume,
      totalBV: totalBusinessVolume,
      weeklyGrossBusinessVolume,
      weeklyGrossRevenue: weeklyPackagePrice,
      weeklyGrossValue: weeklyPackagePrice,
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

// Member List from MongoDB (Role-scoped: Regular members only see members they added or sponsored)
router.get('/members', optionalAuthenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    let query: any = {};

    // If authenticated as a Regular Member:
    // Only see members they personally added (addedBy) or personally sponsored (sponsorId)
    if (user && user.role === ROLES.MEMBER && user.memberId) {
      const userMemberId = user.memberId.toUpperCase().trim();
      query = {
        $or: [
          { addedBy: userMemberId },
          { sponsorId: userMemberId },
        ],
      };
    } else {
      // Super Admin / Admin: can filter by status / approvalStatus
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

// Register New Member with Password & Unique validation
router.post('/members', optionalAuthenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      name,
      email,
      mobile,
      dob,
      password,
      confirmPassword,
      sponsorId,
      parentId,
      placementId,
      position,
      packageName,
      packageId,
      package: pkgInput
    } = req.body;

    // 1. Mandatory field checks
    if (!name || !name.trim()) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: 'Full Name is required.'
      });
      return;
    }

    if (!mobile || !mobile.trim()) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: 'Mobile Number is required.'
      });
      return;
    }

    if (!email || !email.trim()) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: 'Email ID is required.'
      });
      return;
    }

    if (!password) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: 'Password is required.'
      });
      return;
    }

    if (password.length < 6) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: 'Password must be at least 6 characters long.'
      });
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: 'Password and Confirm Password do not match.'
      });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanMobile = mobile.replace(/[^0-9]/g, '');

    // 2. Uniqueness Checks
    const existingEmail = await Member.findOne({ email: cleanEmail });
    if (existingEmail) {
      res.status(HTTP_STATUS.CONFLICT).json({
        status: false,
        message: `A member with email "${cleanEmail}" already exists. Email must be unique.`
      });
      return;
    }

    const existingMobile = await Member.findOne({
      $or: [{ mobile: cleanMobile }, { mobile: mobile.trim() }]
    });
    if (existingMobile) {
      res.status(HTTP_STATUS.CONFLICT).json({
        status: false,
        message: `A member with mobile number "${mobile.trim()}" already exists. Mobile must be unique.`
      });
      return;
    }

    // 3. Sponsor ID and Binary Placement (Distinct relationships)
    const totalCount = await Member.countDocuments();
    let finalParentId = '';
    let finalPos: BinaryPosition = BINARY_POSITION.LEFT;
    let finalSponsorId = (sponsorId || '').trim().toUpperCase();

    const requestedParentId = (parentId || placementId || '').trim().toUpperCase();
    const rawPosition = (position || '').trim().toUpperCase();
    const isManualPlacement = Boolean(
      requestedParentId && (rawPosition === 'LEFT' || rawPosition === 'RIGHT')
    );

    if (totalCount === 0) {
      // First member in system: ROOT NODE of the MLM tree
      // No sponsor ID required; defaults to 'ADMIN' as root placeholder
      finalSponsorId = finalSponsorId || 'ADMIN';
      finalParentId = '';
      finalPos = BINARY_POSITION.LEFT;
    } else {
      // All subsequent members strictly require a sponsor ID
      if (!finalSponsorId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Sponsor ID is required. Please provide ADMIN or an existing Member ID.'
        });
        return;
      }
      // Validate sponsor ID: can be 'ADMIN' or an existing member
      if (finalSponsorId !== 'ADMIN') {
        const sponsorExists = await Member.findOne({ memberId: finalSponsorId });
        if (!sponsorExists) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: `Sponsor ID "${finalSponsorId}" does not exist. Please enter a valid Member ID or ADMIN.`
          });
          return;
        }
      }

      if (isManualPlacement) {
        // Manual placement: explicitly provided parentId and position
        const targetPos: BinaryPosition = rawPosition === 'RIGHT' ? BINARY_POSITION.RIGHT : BINARY_POSITION.LEFT;
        const validation = await BinaryTreeService.validatePlacement(requestedParentId, targetPos);
        if (!validation.isValid) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: validation.error || `Position ${targetPos} under parent ${requestedParentId} is not available.`
          });
          return;
        }
        finalParentId = requestedParentId;
        finalPos = targetPos;
      } else {
        // Auto-placement: Calculate balanced level-order binary placement under the sponsor
        const placementRoot = (finalSponsorId && finalSponsorId !== 'ADMIN') ? finalSponsorId : '';
        const autoPlacement = await BinaryTreeService.findNextAutoPlacement(placementRoot);
        finalParentId = autoPlacement.parentId;
        finalPos = autoPlacement.position;
      }
    }

    // 4. Resolve Dynamic Package from MongoDB (only if explicitly specified)
    const targetPkgIdentifier = packageId || packageName || pkgInput;
    let selectedPackage = null;
    if (targetPkgIdentifier) {
      selectedPackage = await Package.findOne({
        $or: [
          { packageId: targetPkgIdentifier },
          { name: targetPkgIdentifier },
          { name: new RegExp(`^${targetPkgIdentifier}$`, 'i') },
        ],
        isActive: true,
      });
    }

    const finalPackageName = selectedPackage ? selectedPackage.name : null;
    const finalPackageId = selectedPackage ? selectedPackage.packageId : null;
    const finalPackageBv = selectedPackage ? selectedPackage.bv : 0;
    const finalPackageRp = selectedPackage ? selectedPackage.rp : 0;
    const finalDailyCapping = selectedPackage ? (selectedPackage.dailyCapping || 0) : 0;

    // 5. Generate Sequential Unique Member ID
    const newMemberId = await Member.generateNextMemberId();

    // 6. Creator tracking & Approval determination
    const reqUser = req.user;
    let addedBy = 'ADMIN';
    let approvalStatus: 'pending' | 'approved' = 'pending';
    let memberStatus: 'active' | 'pending' = 'pending';
    let isActive = false;

    if (totalCount === 0) {
      // The initial root member is automatically activated and approved
      addedBy = 'ADMIN';
      approvalStatus = 'approved';
      memberStatus = 'active';
      isActive = true;
    } else if (reqUser && (reqUser.role === ROLES.ADMIN || reqUser.role === ROLES.SUPERADMIN)) {
      addedBy = 'ADMIN';
      approvalStatus = 'approved';
      memberStatus = 'active';
      isActive = true;
    } else if (reqUser && reqUser.role === ROLES.MEMBER && reqUser.memberId) {
      addedBy = reqUser.memberId.toUpperCase().trim();
      approvalStatus = 'pending';
      memberStatus = 'pending';
      isActive = false;
    } else {
      // Direct self-registration / unauthenticated
      addedBy = finalSponsorId || 'SYSTEM';
      approvalStatus = 'pending';
      memberStatus = 'pending';
      isActive = false;
    }

    // 7. Create and Save Member in MongoDB (password automatically hashed by pre-save hook)
    const newMember = await Member.create({
      memberId: newMemberId,
      name: name.trim(),
      email: cleanEmail,
      mobile: mobile.trim(),
      dob: dob ? dob.trim() : '',
      password,
      sponsorId: finalSponsorId,
      parentId: finalParentId,
      position: finalPos,
      binaryParentId: finalParentId,
      placementId: finalParentId,
      binaryPosition: finalPos,
      joiningPackageId: finalPackageId,
      packageName: finalPackageName,
      packageBv: finalPackageBv,
      packageRp: finalPackageRp,
      dailyCapping: finalDailyCapping,
      status: memberStatus,
      approvalStatus,
      addedBy,
      isActive,
      personalBv: 0,
      isBinaryActive: false,
      leftBv: 0,
      rightBv: 0,
      matchedPairs: 0,
      totalIncome: 0,
      walletBalance: 0
    });

    if (isActive) {
      await WalletService.getOrCreateWallet(newMember.memberId, newMember._id.toString()).catch(() => null);
      await BVService.getOrCreateBinaryVolume(newMember.memberId, newMember._id.toString()).catch(() => null);
    }

    const successMessage = approvalStatus === 'pending'
      ? `Member ${newMember.name} added successfully with ID: ${newMember.memberId}. The request has been forwarded to Super Admin for approval. Login will be enabled once approved, and binary tree participation requires minimum 100 BV.`
      : `Member ${newMember.name} registered successfully with ID: ${newMember.memberId}. Account can log in. Binary income participation requires minimum 100 BV.`;

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      status: true,
      message: successMessage,
      member: {
        id: newMember._id.toString(),
        memberId: newMember.memberId,
        name: newMember.name,
        email: newMember.email,
        mobile: newMember.mobile,
        dob: newMember.dob,
        sponsorId: newMember.sponsorId,
        parentId: newMember.parentId,
        placementId: newMember.placementId,
        position: newMember.position,
        binaryParentId: newMember.binaryParentId,
        binaryPosition: newMember.binaryPosition,
        packageName: newMember.packageName,
        joinDate: newMember.joinDate,
        status: newMember.status,
        approvalStatus: newMember.approvalStatus,
        addedBy: newMember.addedBy,
        walletBalance: newMember.walletBalance
      }
    });
  } catch (error: any) {
    console.error('[POST /api/members] Error creating member:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: error.message || 'Failed to register new member'
    });
  }
});

// ==========================================
// Super Admin Member Request Endpoints
// ==========================================

// GET all pending member requests for Super Admin
router.get('/admin/member-requests', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== ROLES.ADMIN && req.user?.role !== ROLES.SUPERADMIN) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        status: false,
        message: 'Access restricted to administrators only.'
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
    if (req.user?.role !== ROLES.ADMIN && req.user?.role !== ROLES.SUPERADMIN) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        status: false,
        message: 'Access restricted to administrators only.'
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
        const auto = await BinaryTreeService.findNextAutoPlacement(placementRoot);
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
    member.isBinaryActive = (member.personalBv || 0) >= 100;
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
    if (req.user?.role !== ROLES.ADMIN && req.user?.role !== ROLES.SUPERADMIN) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        status: false,
        message: 'Access restricted to administrators only.'
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
