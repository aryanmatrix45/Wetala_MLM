import mongoose, { Document, Schema } from 'mongoose';

export interface ICompensationRule extends Document {
  ruleSetId: string;
  version: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  
  // 1. Welcome Bonus (4% company weekly GBV pool divided equally among eligible members with 2x max cap)
  welcomeBonus: {
    isEnabled: boolean;
    ratePercent: number; // e.g. 4%
    maxMultiplier: number; // e.g. 2x, 3x, 4x
    settlementFrequency: 'WEEKLY' | 'DAILY' | 'MONTHLY';
    limitMode?: 'ACTIVE_PACKAGE' | 'FIXED' | 'MULTIPLIER';
    fixedAmount?: number;
    minLifetimeBv?: number; // BV received in the member's lifetime (orders + transfers in), e.g. 1250
    minSponsoredCount?: number; // directly sponsored binary-active members (100 BV+), placed anywhere, e.g. 2
    notes?: string;
  };
  
  // 2. Binary Bonus (₹ rate per pair, 1:1 then 2:1/1:2, package daily capping)
  binaryBonus: {
    isEnabled: boolean;
    rateInRupees?: number;      // e.g. ₹250 per pair
    pairBvUnit?: number;        // e.g. 1250 BV per pair
    minPersonalBvRequired?: number; // Minimum 100 BV required for binary participation
    standardBinaryRate?: number;
    specialBinaryRate?: number;
    isSpecialRateEnabled?: boolean;
    calculationBase?: 'BV' | 'PURCHASE_VALUE';
    volumeCarryForwardMode?: 'CARRY_FORWARD' | 'FLUSH'; // FLUSH: BV that has not paired by IST midnight is cleared
    dailyBinaryPayoutCap?: number;
    excessCapPolicy?: 'FLUSH' | 'HOLD' | 'CARRY_FORWARD';
    firstPairRatio?: string; // '2:1_or_1:2' (2500:1250 or 1250:2500)
    subsequentPairRatio?: string; // '1:1' (1250:1250)
    firstPayoutDominantBv?: number; // 2500
    firstPayoutOppositeBv?: number; // 1250
    secondPayoutNewBv?: number; // 1250
  };
  
  // 5. Sponsor Income: 20% of each direct's daily binary income (as credited), paid on top, uncapped
  sponsorBinaryBonus: {
    isEnabled: boolean;
    sponsorBinaryRate: number; // 20% = 0.20
    sponsorDepth: number; // direct = 1
    calculationBase: 'BINARY_COMMISSION' | 'BV' | 'DOWNSTREAM_PURCHASE';
  };
  
  // 6. Team Performance Bonus (6 Slabs: 10:10 @ 3% max 10k, up to 25,000:25,000 @ 1% max 15L)
  //    DEPRECATED: superseded by TeamPerformanceBonusConfig and no longer read by the engine.
  teamPerformanceBonus: {
    isEnabled: boolean;
    calculationBase: 'CTO_POOL' | 'DIRECT';
    tiers: Array<{
      tierId: string;
      pairCount: number;
      leftThreshold: number;
      rightThreshold: number;
      royaltyBonusPercent: number; // e.g. 3 for 3%
      limitAmount: number; // e.g. 10000, 30000, 100000, 300000, 500000, 1500000
    }>;
    notes?: string;
  };
  
  // 7. Rank and Reward (15 Ranks: Fresher ₹1k up to Triple Kohinoor ₹2 Crore)
  rewards: {
    isEnabled: boolean;
    tiers: Array<{
      tierId: string;
      rankName: string;
      teamTarget: number;
      leftRequirement: number;
      rightRequirement: number;
      rewardAmount: number;
      rewardTitle: string;
    }>;
  };
  
  // 13. Payout Deductions (Admin configurable, can be set to anything including 0%)
  payoutDeductions: {
    isEnabled: boolean;
    tdsPercent: number;      // e.g. 5 or 0
    adminFeePercent: number; // e.g. 5 or 0
    notes?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const compensationRuleSchema = new Schema<ICompensationRule>(
  {
    ruleSetId: {
      type: String,
      required: true,
      index: true,
      default: 'DEFAULT_RULES',
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    effectiveTo: {
      type: Date,
    },
    welcomeBonus: {
      isEnabled: { type: Boolean, default: true },
      ratePercent: { type: Number, default: 4 },
      maxMultiplier: { type: Number, default: 2 },
      settlementFrequency: { type: String, default: 'WEEKLY' },
      limitMode: { type: String, default: 'MULTIPLIER' },
      fixedAmount: { type: Number, default: 0 },
      minLifetimeBv: { type: Number, default: 1250 },
      minSponsoredCount: { type: Number, default: 2 },
      notes: { type: String, default: 'Company Weekly GBV pool divided equally among eligible members, capped at multiplier times lifetime BV.' },
    },
    binaryBonus: {
      isEnabled: { type: Boolean, default: true },
      standardBinaryRate: { type: Number, default: 0.20 }, // 20%
      rateInRupees: { type: Number, default: 250 },        // ₹250 per pair
      pairBvUnit: { type: Number, default: 1250 },         // 1250 BV per pair
      minPersonalBvRequired: { type: Number, default: 100 }, // 100 BV threshold
      specialBinaryRate: { type: Number, default: 0.25 },   // 25% (optional override)
      isSpecialRateEnabled: { type: Boolean, default: false },
      calculationBase: { type: String, default: 'BV' },
      volumeCarryForwardMode: { type: String, enum: ['CARRY_FORWARD', 'FLUSH'], default: 'FLUSH' },
      excessCapPolicy: { type: String, default: 'FLUSH' },
      firstPairRatio: { type: String, default: '2:1_or_1:2' },
      subsequentPairRatio: { type: String, default: '1:1' },
      firstPayoutDominantBv: { type: Number, default: 2500 },
      firstPayoutOppositeBv: { type: Number, default: 1250 },
      secondPayoutNewBv: { type: Number, default: 1250 },
    },
    sponsorBinaryBonus: {
      isEnabled: { type: Boolean, default: true },
      sponsorBinaryRate: { type: Number, default: 0.20 }, // 20%
      sponsorDepth: { type: Number, default: 1 },
      calculationBase: { type: String, default: 'BINARY_COMMISSION' },
    },
    teamPerformanceBonus: {
      isEnabled: { type: Boolean, default: true },
      calculationBase: { type: String, default: 'CTO_POOL' },
      tiers: [
        {
          tierId: String,
          pairCount: Number,
          leftThreshold: Number,
          rightThreshold: Number,
          royaltyBonusPercent: Number,
          limitAmount: Number,
        },
      ],
      notes: { type: String, default: 'Equally distributed CTO pool bonus across qualifiers based on Left:Right balanced pair slabs.' },
    },
    rewards: {
      isEnabled: { type: Boolean, default: true },
      tiers: [
        {
          tierId: String,
          rankName: String,
          teamTarget: Number,
          leftRequirement: Number,
          rightRequirement: Number,
          rewardAmount: Number,
          rewardTitle: String,
        },
      ],
    },
    payoutDeductions: {
      // No TDS or admin fee is deducted from any income (DeductionUtil always returns 0)
      isEnabled: { type: Boolean, default: false },
      tdsPercent: { type: Number, default: 0 },
      adminFeePercent: { type: Number, default: 0 },
      notes: { type: String, default: 'No TDS or admin fee: the full income amount is credited to the wallet.' },
    },
  },
  {
    timestamps: true,
  }
);

export const CompensationRule = mongoose.model<ICompensationRule>('CompensationRule', compensationRuleSchema);
export default CompensationRule;
