import mongoose, { Document, Schema } from 'mongoose';

export interface ICompensationRule extends Document {
  ruleSetId: string;
  version: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  
  // 1. Welcome Bonus (Notes: "Company turns 4:1", "Limited only package")
  welcomeBonus: {
    isEnabled: boolean;
    companyRatio: string; // e.g. "4:1"
    applicablePackageIds: string[];
    ratePercent: number;
    fixedAmount: number;
    maxPayout: number;
    notes: string;
  };
  
  // 2. Binary Bonus (Notes: 20% standard, 25% special, ₹4000 daily cap)
  binaryBonus: {
    isEnabled: boolean;
    standardBinaryRate: number; // 20% = 0.20
    specialBinaryRate: number;   // 25% = 0.25 (disabled by default)
    isSpecialRateEnabled: boolean;
    calculationBase: 'BV' | 'PURCHASE_VALUE';
    volumeCarryForwardMode: 'CARRY_FORWARD' | 'FLUSH';
    dailyBinaryPayoutCap: number; // ₹4,000
    excessCapPolicy: 'FLUSH' | 'HOLD' | 'CARRY_FORWARD';
    firstPairRatio: '1:1' | '1:2_or_2:1';
    subsequentPairRatio: '1:1';
  };
  
  // 3. Team Bonus Tiers (Notes: 1000:1000=15%, 2500:2500=10%, etc.)
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
  
  // 4. Self Purchase Bonus (Notes: 8%)
  selfPurchaseBonus: {
    isEnabled: boolean;
    ratePercent: number; // 8% = 0.08
    calculationBase: 'PURCHASE_VALUE' | 'BV' | 'QUALIFYING_VALUE';
  };
  
  // 5. Sponsor Binary Income (Notes: 20%)
  sponsorBinaryBonus: {
    isEnabled: boolean;
    sponsorBinaryRate: number; // 20% = 0.20
    sponsorDepth: number; // direct = 1
    calculationBase: 'BINARY_COMMISSION' | 'BV' | 'DOWNSTREAM_PURCHASE';
    maxPayout?: number;
  };
  
  // 6. Team Performance Bonus (Notes: 10:10, 100:100, 1000:1000, 10000:10000)
  teamPerformanceBonus: {
    isEnabled: boolean;
    bonusRatePercent: number; // configurable, payout rate unclear in handwritten notes
    tiers: Array<{
      leftThreshold: number;
      rightThreshold: number;
      bonusAmount?: number;
    }>;
    notes: string;
  };
  
  // 7. Lifetime Rewards (Notes: 5:5=₹1000, 10:10=₹2000, subsequent tiers unclear)
  rewards: {
    isEnabled: boolean;
    tiers: Array<{
      tierId: string;
      leftRequirement: number;
      rightRequirement: number;
      rewardAmount: number | null; // null if unconfirmed
      rewardTitle: string;
    }>;
  };
  
  // 8. Franchise / Stock Policy (Notes: 50k=5%, 100k=8%, 500k=10%, 1M=12%, upline=2%)
  franchisePolicy: {
    isEnabled: boolean;
    incentiveType: 'MARGIN' | 'DISCOUNT' | 'COMMISSION' | 'STOCK_INCENTIVE';
    tiers: Array<{
      threshold: number;
      rate: number; // e.g. 0.05
    }>;
    uplineBonusRate: number; // 0.02
  };
  
  // 9. Upline Bonus (Notes: 2%)
  uplineBonus: {
    isEnabled: boolean;
    uplineBonusRate: number; // 2% = 0.02
    maxUplineLevels: number;
    calculationBase: 'PURCHASE_VALUE' | 'BV';
  };
  
  // 10. Royalty (Formula not specified in notes)
  royalty: {
    isEnabled: boolean;
    poolPercent: number;
    eligibleRanks: string[];
    minTeamVolume: number;
    notes: string;
  };
  
  // 11. Consultancy Bonus (Notes: ₹2500 per product, 3 mo, 4th mo free)
  consultancyBonus: {
    isEnabled: boolean;
    qualifyingAmount: number;
    productQuantity: number;
    qualifyingMonths: number;
    freeProductMonth: number;
    notes: string;
  };
  
  // 12. Retail Profit (Notes: up to 50%)
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
      unique: true,
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
      isEnabled: { type: Boolean, default: false },
      companyRatio: { type: String, default: '4:1' },
      applicablePackageIds: { type: [String], default: [] },
      ratePercent: { type: Number, default: 4 },
      fixedAmount: { type: Number, default: 0 },
      maxPayout: { type: Number, default: 0 },
      notes: { type: String, default: 'TODO: Confirm exact Welcome Bonus 4:1 rule with business owner.' },
    },
    binaryBonus: {
      isEnabled: { type: Boolean, default: true },
      standardBinaryRate: { type: Number, default: 0.20 }, // 20%
      specialBinaryRate: { type: Number, default: 0.25 },   // 25% (unclear condition in notes)
      isSpecialRateEnabled: { type: Boolean, default: false },
      calculationBase: { type: String, default: 'BV' },
      volumeCarryForwardMode: { type: String, default: 'CARRY_FORWARD' },
      dailyBinaryPayoutCap: { type: Number, default: 4000 },
      excessCapPolicy: { type: String, default: 'FLUSH' },
      firstPairRatio: { type: String, default: '1:1' },
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
      isEnabled: { type: Boolean, default: false },
      bonusRatePercent: { type: Number, default: 0 },
      tiers: [
        {
          leftThreshold: Number,
          rightThreshold: Number,
          bonusAmount: Number,
        },
      ],
      notes: { type: String, default: 'TODO: Confirm Team Performance Bonus payout formula with business owner.' },
    },
    rewards: {
      isEnabled: { type: Boolean, default: true },
      tiers: [
        {
          tierId: String,
          leftRequirement: Number,
          rightRequirement: Number,
          rewardAmount: { type: Number, default: null },
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
