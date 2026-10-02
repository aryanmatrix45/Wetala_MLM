import mongoose, { Document, Schema } from 'mongoose';

export interface ICompensationRule extends Document {
  ruleSetId: string;
  version: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  
  // 1. Welcome Bonus (4% on every new package, requires 1 Left & 1 Right complete, capped at active package)
  welcomeBonus: {
    isEnabled: boolean;
    requiresLeftAndRight: boolean;
    ratePercent: number; // 4%
    limitMode: 'ACTIVE_PACKAGE' | 'FIXED';
    fixedAmount?: number;
    notes?: string;
  };
  
  // 2. Binary Bonus (20% standard, first pair 1:2 or 2:1, subsequent 1:1, daily cap ₹4,000 to ₹16,000 by package)
  binaryBonus: {
    isEnabled: boolean;
    standardBinaryRate: number; // 20% = 0.20
    specialBinaryRate: number;   // 25% = 0.25 (optional override)
    isSpecialRateEnabled: boolean;
    calculationBase: 'BV' | 'PURCHASE_VALUE';
    volumeCarryForwardMode: 'CARRY_FORWARD' | 'FLUSH';
    dailyBinaryPayoutCap: number; // ₹4,000 base
    excessCapPolicy: 'FLUSH' | 'HOLD' | 'CARRY_FORWARD';
    firstPairRatio: '1:1' | '1:2_or_2:1';
    subsequentPairRatio: '1:1';
  };
  
  // 3. Team Bonus Tiers (Repurchase CTO Volume: 1k=15%, 2.5k=10%, 7.5k=7%, 20k=6%, 35k=5%, 70k=4%, 150k=3%, 300k=2%)
  teamBonus: {
    isEnabled: boolean;
    calculationBase: 'MATCHED_BV' | 'LEFT_BV' | 'RIGHT_BV' | 'TOTAL_TEAM_BV' | 'PURCHASE_VALUE';
    tiers: Array<{
      tierId: string;
      leftVolume: number;
      rightVolume: number;
      rate: number; // e.g. 0.15 for 15%
    }>;
  };
  
  // 4. Self Purchase Bonus (8% on self purchase)
  selfPurchaseBonus: {
    isEnabled: boolean;
    ratePercent: number; // 8% = 0.08
    calculationBase: 'PURCHASE_VALUE' | 'BV' | 'QUALIFYING_VALUE';
  };
  
  // 5. Sponsor Binary Income (20% on all earnings of direct team, uncapped)
  sponsorBinaryBonus: {
    isEnabled: boolean;
    sponsorBinaryRate: number; // 20% = 0.20
    sponsorDepth: number; // direct = 1
    calculationBase: 'BINARY_COMMISSION' | 'BV' | 'DOWNSTREAM_PURCHASE';
    maxPayout?: number;
  };
  
  // 6. Team Performance Bonus (6 Slabs: 10:10 @ 3% max 10k, up to 25,000:25,000 @ 1% max 15L)
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
  
  // 8. Franchise / Stock Point (50k=5%, 100k=8%, 500k=10%, 1M=12%, upline=2%)
  franchisePolicy: {
    isEnabled: boolean;
    incentiveType: 'MARGIN' | 'DISCOUNT' | 'COMMISSION' | 'STOCK_INCENTIVE';
    tiers: Array<{
      threshold: number;
      rate: number; // e.g. 0.05
    }>;
    uplineBonusRate: number; // 0.02 (2%)
  };
  
  // 9. Upline Bonus (2% flat)
  uplineBonus: {
    isEnabled: boolean;
    uplineBonusRate: number; // 2% = 0.02
    maxUplineLevels: number;
    calculationBase: 'PURCHASE_VALUE' | 'BV';
  };
  
  // 10. Royalty
  royalty: {
    isEnabled: boolean;
    poolPercent: number;
    eligibleRanks: string[];
    minTeamVolume: number;
    notes: string;
  };
  
  // 11. Consultancy Bonus (2,500 DP Product for 3 months -> 4th month free product)
  consultancyBonus: {
    isEnabled: boolean;
    qualifyingAmount: number; // 2500 DP
    productQuantity: number;
    qualifyingMonths: number; // 3
    freeProductMonth: number; // 4
    notes: string;
  };
  
  // 12. Retail Profit (Up to 50%)
  retailProfit: {
    isEnabled: boolean;
    maxPercentage: number; // 50%
    calculationBase: 'COST_PRICE' | 'SELLING_PRICE' | 'MRP' | 'CONFIGURED_BASE';
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
      requiresLeftAndRight: { type: Boolean, default: true },
      ratePercent: { type: Number, default: 4 }, // 4%
      limitMode: { type: String, default: 'ACTIVE_PACKAGE' },
      fixedAmount: { type: Number, default: 0 },
      notes: { type: String, default: '4% on every new package. Requires 1 Left + 1 Right complete. Capped at active package.' },
    },
    binaryBonus: {
      isEnabled: { type: Boolean, default: true },
      standardBinaryRate: { type: Number, default: 0.20 }, // 20%
      specialBinaryRate: { type: Number, default: 0.25 },   // 25% (optional override)
      isSpecialRateEnabled: { type: Boolean, default: false },
      calculationBase: { type: String, default: 'BV' },
      volumeCarryForwardMode: { type: String, default: 'CARRY_FORWARD' },
      dailyBinaryPayoutCap: { type: Number, default: 4000 },
      excessCapPolicy: { type: String, default: 'FLUSH' },
      firstPairRatio: { type: String, default: '1:2_or_2:1' },
      subsequentPairRatio: { type: String, default: '1:1' },
    },
    teamBonus: {
      isEnabled: { type: Boolean, default: true },
      calculationBase: { type: String, default: 'MATCHED_BV' },
      tiers: [
        {
          tierId: String,
          leftVolume: Number,
          rightVolume: Number,
          rate: Number,
        },
      ],
    },
    selfPurchaseBonus: {
      isEnabled: { type: Boolean, default: true },
      ratePercent: { type: Number, default: 0.08 }, // 8%
      calculationBase: { type: String, default: 'BV' },
    },
    sponsorBinaryBonus: {
      isEnabled: { type: Boolean, default: true },
      sponsorBinaryRate: { type: Number, default: 0.20 }, // 20%
      sponsorDepth: { type: Number, default: 1 },
      calculationBase: { type: String, default: 'BINARY_COMMISSION' },
      maxPayout: Number,
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
    franchisePolicy: {
      isEnabled: { type: Boolean, default: true },
      incentiveType: { type: String, default: 'MARGIN' },
      tiers: [
        {
          threshold: Number,
          rate: Number,
        },
      ],
      uplineBonusRate: { type: Number, default: 0.02 }, // 2%
    },
    uplineBonus: {
      isEnabled: { type: Boolean, default: true },
      uplineBonusRate: { type: Number, default: 0.02 }, // 2%
      maxUplineLevels: { type: Number, default: 1 },
      calculationBase: { type: String, default: 'BV' },
    },
    royalty: {
      isEnabled: { type: Boolean, default: false },
      poolPercent: { type: Number, default: 0 },
      eligibleRanks: { type: [String], default: [] },
      minTeamVolume: { type: Number, default: 0 },
      notes: { type: String, default: 'TODO: Confirm exact Royalty pool formula with business owner.' },
    },
    consultancyBonus: {
      isEnabled: { type: Boolean, default: false },
      qualifyingAmount: { type: Number, default: 2500 },
      productQuantity: { type: Number, default: 1 },
      qualifyingMonths: { type: Number, default: 3 },
      freeProductMonth: { type: Number, default: 4 },
      notes: { type: String, default: 'TODO: Confirm exact Consultancy Bonus rules with business owner.' },
    },
    retailProfit: {
      isEnabled: { type: Boolean, default: true },
      maxPercentage: { type: Number, default: 50 },
      calculationBase: { type: String, default: 'MRP' },
    },
  },
  {
    timestamps: true,
  }
);

export const CompensationRule = mongoose.model<ICompensationRule>('CompensationRule', compensationRuleSchema);
export default CompensationRule;
