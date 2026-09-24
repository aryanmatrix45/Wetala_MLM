import { Router } from 'express';
import {
  JOINING_PACKAGES,
  REPURCHASE_SLABS,
  FRANCHISE_SLABS,
  REWARD_MILESTONES,
  Member,
  PayoutRequest
} from '../mockData';

const router = Router();

// In-memory data store seeded with mockup data
let members: Member[] = [
  { id: '1', memberId: 'MEM0126', name: 'Amit Kumar', email: 'amit@example.com', mobile: '98765 43210', sponsorId: 'MEM0005', placementId: 'MEM0002', position: 'left', packageName: 'Premium', joinDate: '12 Sep 2025', status: 'active', leftBv: 25000, rightBv: 22500, matchedPairs: 9, totalIncome: 45000, walletBalance: 12500 },
  { id: '2', memberId: 'MEM0125', name: 'Priya Singh', email: 'priya@example.com', mobile: '87654 32109', sponsorId: 'MEM0003', placementId: 'MEM0002', position: 'right', packageName: 'Basic', joinDate: '12 Sep 2025', status: 'active', leftBv: 12500, rightBv: 15000, matchedPairs: 5, totalIncome: 25000, walletBalance: 8000 },
  { id: '3', memberId: 'MEM0124', name: 'Neha Verma', email: 'neha@example.com', mobile: '96543 21098', sponsorId: 'MEM0005', placementId: 'MEM0001', position: 'left', packageName: 'Premium', joinDate: '11 Sep 2025', status: 'active', leftBv: 30000, rightBv: 35000, matchedPairs: 12, totalIncome: 60000, walletBalance: 18500 },
  { id: '4', memberId: 'MEM0123', name: 'Suresh Yadav', email: 'suresh@example.com', mobile: '91234 56789', sponsorId: 'MEM0001', placementId: 'MEM0001', position: 'right', packageName: 'Basic', joinDate: '11 Sep 2025', status: 'inactive', leftBv: 5000, rightBv: 2500, matchedPairs: 1, totalIncome: 5000, walletBalance: 2000 },
  { id: '5', memberId: 'MEM0122', name: 'Manish Jain', email: 'manish@example.com', mobile: '99887 76655', sponsorId: 'MEM0008', placementId: 'MEM0003', position: 'left', packageName: 'Premium', joinDate: '10 Sep 2025', status: 'active', leftBv: 17500, rightBv: 12500, matchedPairs: 5, totalIncome: 25000, walletBalance: 7500 },
  { id: '6', memberId: 'MEM0121', name: 'Pooja Sharma', email: 'pooja@example.com', mobile: '88776 65544', sponsorId: 'MEM0003', placementId: 'MEM0003', position: 'right', packageName: 'Basic', joinDate: '10 Sep 2025', status: 'active', leftBv: 10000, rightBv: 8500, matchedPairs: 3, totalIncome: 15000, walletBalance: 5200 },
  { id: '7', memberId: 'MEM0120', name: 'Ramesh Kumar', email: 'ramesh@example.com', mobile: '77665 44332', sponsorId: 'MEM0005', placementId: 'MEM0004', position: 'left', packageName: 'Premium', joinDate: '09 Sep 2025', status: 'active', leftBv: 45000, rightBv: 50000, matchedPairs: 18, totalIncome: 90000, walletBalance: 24000 },
  { id: '8', memberId: 'MEM0119', name: 'Sunita Devi', email: 'sunita@example.com', mobile: '99876 55443', sponsorId: 'MEM0008', placementId: 'MEM0004', position: 'right', packageName: 'Basic', joinDate: '09 Sep 2025', status: 'inactive', leftBv: 3000, rightBv: 1500, matchedPairs: 0, totalIncome: 0, walletBalance: 0 },
  { id: '9', memberId: 'MEM0118', name: 'Amit Sharma', email: 'amitsharma@example.com', mobile: '88765 43221', sponsorId: 'MEM0001', placementId: 'MEM0005', position: 'left', packageName: 'Premium', joinDate: '08 Sep 2025', status: 'active', leftBv: 22500, rightBv: 20000, matchedPairs: 8, totalIncome: 40000, walletBalance: 6400 },
  { id: '10', memberId: 'MEM0117', name: 'Rajesh Meena', email: 'rajesh@example.com', mobile: '77654 32110', sponsorId: 'MEM0003', placementId: 'MEM0005', position: 'right', packageName: 'Basic', joinDate: '08 Sep 2025', status: 'active', leftBv: 15000, rightBv: 12500, matchedPairs: 5, totalIncome: 25000, walletBalance: 4800 }
];

let payouts: PayoutRequest[] = [
  { id: 'pay-1', memberId: 'MEM0120', memberName: 'Ramesh Kumar', amount: 12500, tdsDeduction: 625, adminFee: 625, netPayable: 11250, requestDate: '12 Sep 2025', status: 'paid' },
  { id: 'pay-2', memberId: 'MEM0119', memberName: 'Sunita Devi', amount: 8000, tdsDeduction: 400, adminFee: 400, netPayable: 7200, requestDate: '11 Sep 2025', status: 'paid' },
  { id: 'pay-3', memberId: 'MEM0118', memberName: 'Amit Sharma', amount: 6400, tdsDeduction: 320, adminFee: 320, netPayable: 5760, requestDate: '10 Sep 2025', status: 'pending' },
  { id: 'pay-4', memberId: 'MEM0121', memberName: 'Pooja Singh', amount: 5200, tdsDeduction: 260, adminFee: 260, netPayable: 4680, requestDate: '10 Sep 2025', status: 'paid' },
  { id: 'pay-5', memberId: 'MEM0117', memberName: 'Rajesh Meena', amount: 4800, tdsDeduction: 240, adminFee: 240, netPayable: 4320, requestDate: '09 Sep 2025', status: 'paid' }
];

// Dashboard Overview Metrics
router.get('/dashboard/stats', (_req, res) => {
  res.json({
    totalMembers: 1256,
    newRegistrations: 84,
    registrationsToday: 12,
    totalIncomeMonth: 186350,
    totalPayoutMonth: 173900,
    quickStats: {
      activeMembers: 892,
      activePercent: 71,
      repurchaseBv: 450000,
      repurchasePercent: 62,
      activeFranchises: 48,
      franchisePercent: 88,
      pendingPayouts: 3
    }
  });
});

// Member List
router.get('/members', (_req, res) => {
  res.json(members);
});

// Register New Member
router.post('/members', (req, res) => {
  const { name, email, mobile, sponsorId, placementId, position, packageName } = req.body;
  
  const newMemberId = `MEM${String(members.length + 127).padStart(4, '0')}`;
  const newMember: Member = {
    id: String(members.length + 1),
    memberId: newMemberId,
    name: name || 'New Distributor',
    email: email || `${newMemberId.toLowerCase()}@wetala.com`,
    mobile: mobile || '98000 00000',
    sponsorId: sponsorId || 'MEM0001',
    placementId: placementId || 'MEM0001',
    position: position || 'left',
    packageName: packageName || 'Basic',
    joinDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    status: 'active',
    leftBv: 0,
    rightBv: 0,
    matchedPairs: 0,
    totalIncome: 0,
    walletBalance: 0
  };

  members.unshift(newMember);
  res.status(201).json({ success: true, member: newMember });
});

// Binary Tree Hierarchy
router.get('/genealogy/tree', (_req, res) => {
  const treeData = {
    memberId: 'MEM0001',
    name: 'Vijay Kumar (Top Root)',
    package: 'Royal',
    leftBv: 125000,
    rightBv: 118000,
    leftCount: 450,
    rightCount: 412,
    left: {
      memberId: 'MEM0002',
      name: 'Amit Kumar',
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
      memberId: 'MEM0003',
      name: 'Priya Singh',
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
});

// Packages & Slabs
router.get('/packages', (_req, res) => {
  res.json({
    joiningPackages: JOINING_PACKAGES,
    repurchaseSlabs: REPURCHASE_SLABS,
    franchiseSlabs: FRANCHISE_SLABS,
    rewardMilestones: REWARD_MILESTONES
  });
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
