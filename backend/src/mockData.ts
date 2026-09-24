export type BinaryPosition = 'left' | 'right';
export type MemberStatus = 'active' | 'inactive' | 'blocked';
export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export interface Member {
  id: string;
  memberId: string;
  name: string;
  email: string;
  mobile: string;
  sponsorId: string;
  placementId?: string;
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

export interface JoiningPackage {
  id: string;
  name: string;
  price: number;
  bv: number;
  dailyCapping: number;
  description?: string;
}

export const JOINING_PACKAGES: JoiningPackage[] = [
  { id: 'pkg-1', name: 'Starter', price: 3000, bv: 1250, dailyCapping: 4000, description: 'Basic Entry Package (Notebook P.1)' },
  { id: 'pkg-2', name: 'Executive', price: 6500, bv: 2500, dailyCapping: 4000, description: 'Standard Growth Package (Notebook P.1)' },
  { id: 'pkg-3', name: 'Premium', price: 15000, bv: 5000, dailyCapping: 8000, description: 'Advanced Business Package (Notebook P.1)' },
  { id: 'pkg-4', name: 'Elite', price: 35000, bv: 12500, dailyCapping: 15000, description: 'Master Networker Package (Notebook P.1)' },
];

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
