import { Router } from 'express';
import {
  JOINING_PACKAGES,
  REPURCHASE_SLABS,
  FRANCHISE_SLABS,
  REWARD_MILESTONES,
  PayoutRequest
} from '../mockData';
import { Member } from '../models/Member.model';
import { Package } from '../models/Package.model';
import { HTTP_STATUS, BINARY_POSITION } from '../config/constants';
import { BinaryTreeService } from '../services/tree/BinaryTreeService';

const router = Router();

// In-memory fallback/mock seed list
const initialSeedMembers = [
  { memberId: 'MEM0126', name: 'Amit Kumar', email: 'amit@example.com', mobile: '9876543210', password: 'Password@123', sponsorId: 'MEM0005', placementId: 'MEM0002', position: 'left' as const, packageName: 'Premium', joinDate: '12 Sep 2025', status: 'active' as const, leftBv: 25000, rightBv: 22500, matchedPairs: 9, totalIncome: 45000, walletBalance: 12500 },
  { memberId: 'MEM0125', name: 'Priya Singh', email: 'priya@example.com', mobile: '8765432109', password: 'Password@123', sponsorId: 'MEM0003', placementId: 'MEM0002', position: 'right' as const, packageName: 'Basic', joinDate: '12 Sep 2025', status: 'active' as const, leftBv: 12500, rightBv: 15000, matchedPairs: 5, totalIncome: 25000, walletBalance: 8000 },
  { memberId: 'MEM0124', name: 'Neha Verma', email: 'neha@example.com', mobile: '9654321098', password: 'Password@123', sponsorId: 'MEM0005', placementId: 'MEM0001', position: 'left' as const, packageName: 'Premium', joinDate: '11 Sep 2025', status: 'active' as const, leftBv: 30000, rightBv: 35000, matchedPairs: 12, totalIncome: 60000, walletBalance: 18500 },
  { memberId: 'MEM0123', name: 'Suresh Yadav', email: 'suresh@example.com', mobile: '9123456789', password: 'Password@123', sponsorId: 'MEM0001', placementId: 'MEM0001', position: 'right' as const, packageName: 'Basic', joinDate: '11 Sep 2025', status: 'inactive' as const, leftBv: 5000, rightBv: 2500, matchedPairs: 1, totalIncome: 5000, walletBalance: 2000 },
  { memberId: 'MEM0122', name: 'Manish Jain', email: 'manish@example.com', mobile: '9988776655', password: 'Password@123', sponsorId: 'MEM0008', placementId: 'MEM0003', position: 'left' as const, packageName: 'Premium', joinDate: '10 Sep 2025', status: 'active' as const, leftBv: 17500, rightBv: 12500, matchedPairs: 5, totalIncome: 25000, walletBalance: 7500 },
  { memberId: 'MEM0121', name: 'Pooja Sharma', email: 'pooja@example.com', mobile: '8877665544', password: 'Password@123', sponsorId: 'MEM0003', placementId: 'MEM0003', position: 'right' as const, packageName: 'Basic', joinDate: '10 Sep 2025', status: 'active' as const, leftBv: 10000, rightBv: 8500, matchedPairs: 3, totalIncome: 15000, walletBalance: 5200 },
  { memberId: 'MEM0120', name: 'Ramesh Kumar', email: 'ramesh@example.com', mobile: '7766544332', password: 'Password@123', sponsorId: 'MEM0005', placementId: 'MEM0004', position: 'left' as const, packageName: 'Premium', joinDate: '09 Sep 2025', status: 'active' as const, leftBv: 45000, rightBv: 50000, matchedPairs: 18, totalIncome: 90000, walletBalance: 24000 },
  { memberId: 'MEM0119', name: 'Sunita Devi', email: 'sunita@example.com', mobile: '9987655443', password: 'Password@123', sponsorId: 'MEM0008', placementId: 'MEM0004', position: 'right' as const, packageName: 'Basic', joinDate: '09 Sep 2025', status: 'inactive' as const, leftBv: 3000, rightBv: 1500, matchedPairs: 0, totalIncome: 0, walletBalance: 0 },
  { memberId: 'MEM0118', name: 'Amit Sharma', email: 'amitsharma@example.com', mobile: '8876543221', password: 'Password@123', sponsorId: 'MEM0001', placementId: 'MEM0005', position: 'left' as const, packageName: 'Premium', joinDate: '08 Sep 2025', status: 'active' as const, leftBv: 22500, rightBv: 20000, matchedPairs: 8, totalIncome: 40000, walletBalance: 6400 },
  { memberId: 'MEM0117', name: 'Rajesh Meena', email: 'rajesh@example.com', mobile: '7765432110', password: 'Password@123', sponsorId: 'MEM0003', placementId: 'MEM0005', position: 'right' as const, packageName: 'Basic', joinDate: '08 Sep 2025', status: 'active' as const, leftBv: 15000, rightBv: 12500, matchedPairs: 5, totalIncome: 25000, walletBalance: 4800 },
  { memberId: 'MEM0001', name: 'Rohit Sharma', email: 'rohit@wetala.com', mobile: '9812345670', password: 'Password@123', sponsorId: 'ADMIN', placementId: 'ROOT', position: 'left' as const, packageName: 'Elite', joinDate: '01 Sep 2025', status: 'active' as const, leftBv: 125000, rightBv: 118000, matchedPairs: 45, totalIncome: 125000, walletBalance: 35000 },
];

const seedMembersIfEmpty = async () => {
  try {
    const count = await Member.countDocuments();
    if (count === 0) {
      for (const item of initialSeedMembers) {
        await Member.create({
          ...item,
          binaryParentId: item.placementId,
          binaryPosition: item.position === 'right' ? 'RIGHT' : 'LEFT',
        });
      }
      console.log(`[WetalaMLM] Successfully seeded ${initialSeedMembers.length} initial members with passwords.`);
    }
  } catch (err) {
    console.error('[WetalaMLM] Error auto-seeding members:', err);
  }
};

// Seed asynchronously only if explicitly invoked
// seedMembersIfEmpty();

let payouts: PayoutRequest[] = [
  { id: 'pay-1', memberId: 'MEM0120', memberName: 'Ramesh Kumar', amount: 12500, tdsDeduction: 625, adminFee: 625, netPayable: 11250, requestDate: '12 Sep 2025', status: 'paid' },
  { id: 'pay-2', memberId: 'MEM0119', memberName: 'Sunita Devi', amount: 8000, tdsDeduction: 400, adminFee: 400, netPayable: 7200, requestDate: '11 Sep 2025', status: 'paid' },
  { id: 'pay-3', memberId: 'MEM0118', memberName: 'Amit Sharma', amount: 6400, tdsDeduction: 320, adminFee: 320, netPayable: 5760, requestDate: '10 Sep 2025', status: 'pending' },
  { id: 'pay-4', memberId: 'MEM0121', memberName: 'Pooja Singh', amount: 5200, tdsDeduction: 260, adminFee: 260, netPayable: 4680, requestDate: '10 Sep 2025', status: 'paid' },
  { id: 'pay-5', memberId: 'MEM0117', memberName: 'Rajesh Meena', amount: 4800, tdsDeduction: 240, adminFee: 240, netPayable: 4320, requestDate: '09 Sep 2025', status: 'paid' }
];

// Dashboard Overview Metrics
router.get('/dashboard/stats', async (_req, res) => {
  try {
    const totalMembers = await Member.countDocuments();
    const activeMembers = await Member.countDocuments({ status: 'active' });
    const inactiveMembers = await Member.countDocuments({ status: 'inactive' });
    const activePercent = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;

    res.json({
      totalMembers: totalMembers,
      newRegistrations: totalMembers,
      registrationsToday: 0,
      totalIncomeMonth: 0,
      totalPayoutMonth: 0,
      quickStats: {
        activeMembers: activeMembers,
        activePercent: activePercent,
        inactiveMembers: inactiveMembers,
        repurchaseBv: 0,
        repurchasePercent: 0,
        activeFranchises: 0,
        franchisePercent: 0,
        pendingPayouts: 0
      }
    });
  } catch (error: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: error.message || 'Failed to fetch dashboard stats'
    });
  }
});

// Member List from MongoDB
router.get('/members', async (_req, res) => {
  try {
    const members = await Member.find().sort({ createdAt: -1 });
    
    // Map to client contract
    const mapped = members.map(m => ({
      id: m._id.toString(),
      memberId: m.memberId,
      name: m.name,
      email: m.email,
      mobile: m.mobile,
      dob: m.dob || '',
      sponsorId: m.sponsorId,
      placementId: m.placementId,
      position: m.position,
      packageName: m.packageName,
      joinDate: m.joinDate,
      status: m.status,
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
router.post('/members', async (req, res) => {
  try {
    const {
      name,
      email,
      mobile,
      dob,
      password,
      confirmPassword,
      sponsorId,
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

    // 3. Sponsor ID validation
    if (!sponsorId || !sponsorId.trim()) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: 'Sponsor ID is required. Please provide ADMIN or an existing Member ID.'
      });
      return;
    }

    const totalCount = await Member.countDocuments();
    let finalParentId = '';
    let finalPos = position === 'right' ? BINARY_POSITION.RIGHT : BINARY_POSITION.LEFT;
    let finalSponsorId = sponsorId.trim().toUpperCase();

    if (totalCount === 0) {
      // First member in system: root node
      if (finalSponsorId !== 'ADMIN') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'The initial member must have sponsor ID "ADMIN".'
        });
        return;
      }
      finalParentId = '';
    } else {
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

      // Resolve placement: if ADMIN, ROOT, or empty, auto-place under root member spillover
      const rawPlacement = placementId && placementId.trim() ? placementId.trim().toUpperCase() : '';
      if (!rawPlacement || rawPlacement === 'ADMIN' || rawPlacement === 'ROOT') {
        const root = await Member.findOne().sort({ createdAt: 1 });
        if (root) {
          const spillover = await BinaryTreeService.findAvailablePlacement(root.memberId, finalPos);
          finalParentId = spillover.parentId;
          finalPos = spillover.position;
        }
      } else {
        finalParentId = rawPlacement;
        const placementCheck = await BinaryTreeService.validatePlacement(finalParentId, finalPos);
        if (!placementCheck.isValid) {
          res.status(HTTP_STATUS.CONFLICT).json({ status: false, message: placementCheck.error });
          return;
        }
      }
    }

    // 4. Resolve Dynamic Package from MongoDB
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

    if (!selectedPackage) {
      selectedPackage = await Package.findOne({ isActive: true }).sort({ packageNumber: 1, price: 1 });
    }

    const finalPackageName = selectedPackage ? selectedPackage.name : (packageName || 'Package 1');
    const finalPackageId = selectedPackage ? selectedPackage.packageId : 'PKG-1';
    const finalPackageBv = selectedPackage ? selectedPackage.bv : 1250;
    const finalPackageRp = selectedPackage ? selectedPackage.rp : 1;
    const finalDailyCapping = selectedPackage ? selectedPackage.dailyCapping : 4000;

    // 5. Generate Sequential Unique Member ID
    const newMemberId = await Member.generateNextMemberId();

    // 6. Create and Save Member in MongoDB (password automatically hashed by pre-save hook)
    const newMember = await Member.create({
      memberId: newMemberId,
      name: name.trim(),
      email: cleanEmail,
      mobile: mobile.trim(),
      dob: dob ? dob.trim() : '',
      password,
      sponsorId: finalSponsorId,
      binaryParentId: finalParentId,
      placementId: finalParentId,
      binaryPosition: finalPos,
      position: position === 'right' ? 'right' : 'left',
      joiningPackageId: finalPackageId,
      packageName: finalPackageName,
      packageBv: finalPackageBv,
      packageRp: finalPackageRp,
      dailyCapping: finalDailyCapping,
      status: 'active',
      leftBv: 0,
      rightBv: 0,
      matchedPairs: 0,
      totalIncome: 0,
      walletBalance: 0
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: `Member ${newMember.name} registered successfully with ID: ${newMember.memberId}`,
      member: {
        id: newMember._id.toString(),
        memberId: newMember.memberId,
        name: newMember.name,
        email: newMember.email,
        mobile: newMember.mobile,
        dob: newMember.dob,
        sponsorId: newMember.sponsorId,
        placementId: newMember.placementId,
        position: newMember.position,
        packageName: newMember.packageName,
        joinDate: newMember.joinDate,
        status: newMember.status,
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

// Binary Tree Hierarchy
router.get('/genealogy/tree', async (_req, res) => {
  try {
    const rootMember = await Member.findOne().sort({ createdAt: 1 });
    const members = await Member.find().limit(20);

    const treeData = {
      memberId: rootMember ? rootMember.memberId : 'MEM0001',
      name: rootMember ? rootMember.name : 'Vijay Kumar (Top Root)',
      package: rootMember ? rootMember.packageName : 'Royal',
      leftBv: 125000,
      rightBv: 118000,
      leftCount: 450,
      rightCount: 412,
      left: {
        memberId: members[1] ? members[1].memberId : 'MEM0002',
        name: members[1] ? members[1].name : 'Amit Kumar',
        package: 'Premium',
        leftBv: 62000,
        rightBv: 58000,
        leftCount: 220,
        rightCount: 210,
        left: {
          memberId: 'MEM0004',
          name: 'Neha Verma',
          package: 'Basic',
          leftBv: 25000,
          rightBv: 30000,
          leftCount: 95,
          rightCount: 110,
        },
        right: {
          memberId: 'MEM0005',
          name: 'Suresh Yadav',
          package: 'Standard',
          leftBv: 37000,
          rightBv: 28000,
          leftCount: 125,
          rightCount: 100,
        }
      },
      right: {
        memberId: members[2] ? members[2].memberId : 'MEM0003',
        name: members[2] ? members[2].name : 'Priya Singh',
        package: 'Premium',
        leftBv: 56000,
        rightBv: 60000,
        leftCount: 200,
        rightCount: 202,
        left: {
          memberId: 'MEM0006',
          name: 'Manish Jain',
          package: 'Basic',
          leftBv: 26000,
          rightBv: 24000,
          leftCount: 98,
          rightCount: 88,
        },
        right: {
          memberId: 'MEM0007',
          name: 'Pooja Sharma',
          package: 'Standard',
          leftBv: 30000,
          rightBv: 36000,
          leftCount: 102,
          rightCount: 114,
        }
      }
    };

    res.json(treeData);
  } catch (error: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: error.message || 'Failed to fetch genealogy tree'
    });
  }
});

// Packages & Slabs
router.get('/packages', async (_req, res) => {
  try {
    const dbPackages = await Package.find({ isActive: true }).sort({ packageNumber: 1, price: 1 });
    const formattedJoining = dbPackages.length > 0 ? dbPackages.map(p => ({
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
    })) : JOINING_PACKAGES;

    res.json({
      joiningPackages: formattedJoining,
      repurchaseSlabs: REPURCHASE_SLABS,
      franchiseSlabs: FRANCHISE_SLABS,
      rewardMilestones: REWARD_MILESTONES
    });
  } catch (err: any) {
    res.json({
      joiningPackages: JOINING_PACKAGES,
      repurchaseSlabs: REPURCHASE_SLABS,
      franchiseSlabs: FRANCHISE_SLABS,
      rewardMilestones: REWARD_MILESTONES
    });
  }
});

// Payouts List
router.get('/payouts', (_req, res) => {
  res.json(payouts);
});

// Process Payout Action
router.post('/payouts/:id/action', (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'pay' or 'reject'
  
  const payout = payouts.find(p => p.id === id);
  if (!payout) {
    return res.status(404).json({ error: 'Payout request not found' });
  }

  payout.status = action === 'pay' ? 'paid' : 'rejected';
  res.json({ success: true, payout });
});

export default router;
