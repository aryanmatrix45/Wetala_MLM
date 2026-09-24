// MLM Joining Packages (from Notebook Page 1)
export interface JoiningPackage {
  id: string;
  name: string;
  price: number; // ₹ 3000, 6500, 15000, 35000
  bv: number;    // 1250, 2500, 5000, 12500 BV
  dailyCapping: number; // e.g. 4000
  description?: string;
}

export const JOINING_PACKAGES: JoiningPackage[] = [
  { id: 'pkg-1', name: 'Starter', price: 3000, bv: 1250, dailyCapping: 4000, description: 'Basic Entry Package' },
  { id: 'pkg-2', name: 'Executive', price: 6500, bv: 2500, dailyCapping: 4000, description: 'Standard Growth Package' },
  { id: 'pkg-3', name: 'Premium', price: 15000, bv: 5000, dailyCapping: 8000, description: 'Advanced Business Package' },
  { id: 'pkg-4', name: 'Elite', price: 35000, bv: 12500, dailyCapping: 15000, description: 'Master Networker Package' },
];

export type BinaryPosition = 'left' | 'right';
export type MemberStatus = 'active' | 'inactive' | 'blocked';
export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'rejected';

// Member Definition
export interface Member {
  id: string;
  memberId: string; // e.g. MEM0126
  name: string;
  email: string;
  mobile: string;
  sponsorId: string; // Direct Referrer
  placementId?: string; // Binary Parent
  position?: BinaryPosition;
  packageId?: string;
  packageName?: string;
  joinDate: string;
  status: MemberStatus;
  leftBv: number;
  rightBv: number;
  matchedPairs: number;
  totalIncome: number;
  walletBalance: number;
}

// Income Types from Notebook
export enum IncomeType {
  WELCOME_REWARD = 'WELCOME_REWARD',         // 4% Company Turnover
  BINARY_INCOME = 'BINARY_INCOME',           // 1:2 / 2:1 then 1:1, 20%
  SPONSOR_BINARY = 'SPONSOR_BINARY',         // 20% on Direct's binary
  TEAM_PERFORMANCE = 'TEAM_PERFORMANCE',     // Milestone volume (10:10, 100:100, etc.)
  RANK_REWARD = 'RANK_REWARD',               // Pair rewards (5:5, 10:10, up to 40k:40k)
  REPURCHASE_TEAM = 'REPURCHASE_TEAM',       // 15% down to 2% on product repurchase BV
  CONSULTANCY_BONUS = 'CONSULTANCY_BONUS',   // 2000 DP 3 mo -> 4th mo free
  FRANCHISE_BONUS = 'FRANCHISE_BONUS'        // Stock point 5% to 12% + 2% upline
}

// Binary Matching Rules (Notebook Page 1)
export interface BinaryRuleConfig {
  firstPairRatio: '1:2_or_2:1';
  subsequentPairRatio: '1:1';
  binaryPercentage: number; // 20%
  dailyCappingAmount: number; // 4000
  welcomeTurnoverPercent: number; // 4%
  sponsorBinaryPercent: number; // 20%
}

// Team Re-Purchase Slabs (Notebook Page 2)
export interface RepurchaseSlab {
  leftBv: number;
  rightBv: number;
  percentage: number;
}

export const REPURCHASE_SLABS: RepurchaseSlab[] = [
  { leftBv: 1000, rightBv: 1000, percentage: 15 },
  { leftBv: 2500, rightBv: 2500, percentage: 10 },
  { leftBv: 7500, rightBv: 7500, percentage: 7 },
  { leftBv: 20000, rightBv: 20000, percentage: 6 },
  { leftBv: 35000, rightBv: 35000, percentage: 5 },
  { leftBv: 70000, rightBv: 70000, percentage: 4 },
  { leftBv: 150000, rightBv: 150000, percentage: 3 },
  { leftBv: 300000, rightBv: 300000, percentage: 2 }
];

// Franchise / Stock Point Slabs (Notebook Page 2)
export interface FranchiseSlab {
  investment: number;
  marginPercent: number;
  uplineBonusPercent: number;
}

export const FRANCHISE_SLABS: FranchiseSlab[] = [
  { investment: 50000, marginPercent: 5, uplineBonusPercent: 2 },
  { investment: 100000, marginPercent: 8, uplineBonusPercent: 2 },
  { investment: 500000, marginPercent: 10, uplineBonusPercent: 2 },
  { investment: 1000000, marginPercent: 12, uplineBonusPercent: 2 }
];

// Reward Milestones (Notebook Page 3)
export interface RewardMilestone {
  leftPairs: number;
  rightPairs: number;
  rewardAmount: number;
  rewardTitle: string;
}

export const REWARD_MILESTONES: RewardMilestone[] = [
  { leftPairs: 5, rightPairs: 5, rewardAmount: 1000, rewardTitle: 'Bronze Achiever' },
  { leftPairs: 10, rightPairs: 10, rewardAmount: 2000, rewardTitle: 'Silver Achiever' },
  { leftPairs: 50, rightPairs: 50, rewardAmount: 10000, rewardTitle: 'Gold Executive' },
  { leftPairs: 100, rightPairs: 100, rewardAmount: 25000, rewardTitle: 'Star Director' },
  { leftPairs: 250, rightPairs: 250, rewardAmount: 60000, rewardTitle: 'Ruby Director' },
  { leftPairs: 500, rightPairs: 500, rewardAmount: 150000, rewardTitle: 'Emerald Director' },
  { leftPairs: 1000, rightPairs: 1000, rewardAmount: 350000, rewardTitle: 'Diamond' },
  { leftPairs: 2500, rightPairs: 2500, rewardAmount: 900000, rewardTitle: 'Blue Diamond' },
  { leftPairs: 5000, rightPairs: 5000, rewardAmount: 2000000, rewardTitle: 'Black Diamond' },
  { leftPairs: 10000, rightPairs: 10000, rewardAmount: 4500000, rewardTitle: 'Crown Ambassador' },
  { leftPairs: 20000, rightPairs: 20000, rewardAmount: 10000000, rewardTitle: 'Universal Crown' },
  { leftPairs: 40000, rightPairs: 40000, rewardAmount: 25000000, rewardTitle: 'President Club' }
];

// Payout Transaction
export interface PayoutRequest {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  tdsDeduction: number;
  adminFee: number;
  netPayable: number;
  requestDate: string;
  status: PayoutStatus;
}
