import { ClientSession } from 'mongoose';
import { Member } from '../../models/Member.model';
import { BinaryVolume } from '../../models/BinaryVolume.model';
import { CommissionLedger } from '../../models/CommissionLedger.model';
import {
  TeamPerformanceBonusConfig,
  ITeamPerformanceBonusConfig,
  ITeamPerformanceBonusSlab,
} from '../../models/TeamPerformanceBonusConfig.model';
import { MemberRewardPoints, IMemberRewardPoints } from '../../models/MemberRewardPoints.model';
import { TeamPerformanceBonusQualification } from '../../models/TeamPerformanceBonusQualification.model';
import { TeamPerformanceBonusLifetime } from '../../models/TeamPerformanceBonusLifetime.model';
import { CompanyTurnoverPeriod, ICompanyTurnoverPeriod } from '../../models/CompanyTurnoverPeriod.model';
import { TeamPerformanceBonusPayout } from '../../models/TeamPerformanceBonusPayout.model';
import { WalletService } from '../WalletService';
import { GrossVolumeService } from '../GrossVolumeService';
import { AuditService } from '../AuditService';
import { runInTransaction } from '../BVWalletService';
import { BusinessDate } from '../../utils/businessDate';
import { COMMISSION_TYPE, HTTP_STATUS, TEAM_PERFORMANCE_BONUS_DEFAULTS } from '../../config/constants';
import { canEarnBonus } from '../../utils/binaryEligibility';

export class TeamPerformanceBonusError extends Error {
  constructor(message: string, public statusCode: number = HTTP_STATUS.BAD_REQUEST) {
    super(message);
    this.name = 'TeamPerformanceBonusError';
  }
}

const CONFIG_ID = 'DEFAULT';
const MAX_TRANSACTION_ATTEMPTS = 5;

export interface SettlementActor {
  email: string;
  role: string;
}

// ---------------------------------------------------------------------------------------------
// Pure rules (no database access, unit tested in tests/teamPerformanceBonus.test.ts)
// ---------------------------------------------------------------------------------------------

/** RP = floor(BV / rpBvUnit). Negative or non-finite BV counts as zero. */
export const calculateRP = (businessVolume: number, rpBvUnit: number): number => {
  if (!Number.isFinite(businessVolume) || businessVolume <= 0) return 0;
  return Math.floor(businessVolume / rpBvUnit);
};

/** Lifetime paid for a member's slab, keyed `${memberId}|${slabId}`, in paise */
export const lifetimeKey = (memberId: string, slabId: string) => `${memberId}|${slabId}`;

export interface SettlementSlabInput {
  slabId: string;
  percent: number;
  lifetimeLimit: number; // INR
}

export interface SettlementQualificationInput {
  qualificationId: string;
  memberId: string;
  slabId: string;
}

export interface SlabPlanPayout {
  qualificationId: string;
  memberId: string;
  plannedPaise: number;
  lifetimeBeforePaise: number;
}

export interface SlabPlan {
  slabId: string;
  percent: number;
  lifetimeLimitPaise: number;
  poolPaise: number;
  eligibleCount: number;
  sharePaise: number;
  distributedPaise: number;
  undistributedPaise: number;
  qualificationIds: string[];
  payouts: SlabPlanPayout[];
}

export interface SettlementPlan {
  turnoverPaise: number;
  totalPoolPaise: number;
  totalDistributedPaise: number;
  totalUndistributedPaise: number;
  slabs: SlabPlan[];
}

/**
 * Splits each slab's pool equally among the members who first qualified for it in this period.
 * Money is worked in whole paise: pool = floor(turnover x percent), share = floor(pool / members).
 * Each member is paid min(share, remaining lifetime cap). Anything not paid stays with the company,
 * so the total paid can never exceed the pool.
 */
export const planSlabSettlement = (input: {
  turnover: number; // INR
  slabs: SettlementSlabInput[];
  qualifications: SettlementQualificationInput[];
  paidPaiseByKey: Map<string, number>;
}): SettlementPlan => {
  const turnoverPaise = Math.max(0, Math.round(input.turnover * 100));
  const slabs: SlabPlan[] = input.slabs.map((slab) => {
    const poolPaise = Math.floor((turnoverPaise * slab.percent) / 100);
    const qualifications = input.qualifications
      .filter((q) => q.slabId === slab.slabId)
      .sort((a, b) => (a.memberId === b.memberId ? a.qualificationId.localeCompare(b.qualificationId) : a.memberId.localeCompare(b.memberId)));
    const eligibleCount = qualifications.length;
    const sharePaise = eligibleCount > 0 ? Math.floor(poolPaise / eligibleCount) : 0;
    const lifetimeLimitPaise = Math.max(0, Math.round(slab.lifetimeLimit * 100));

    const payouts: SlabPlanPayout[] = [];
    for (const q of qualifications) {
      const lifetimeBeforePaise = input.paidPaiseByKey.get(lifetimeKey(q.memberId, slab.slabId)) || 0;
      const remainingPaise = Math.max(0, lifetimeLimitPaise - lifetimeBeforePaise);
      const plannedPaise = Math.min(sharePaise, remainingPaise);
      if (plannedPaise > 0) {
        payouts.push({ qualificationId: q.qualificationId, memberId: q.memberId, plannedPaise, lifetimeBeforePaise });
      }
    }

    const distributedPaise = payouts.reduce((sum, p) => sum + p.plannedPaise, 0);
    return {
      slabId: slab.slabId,
      percent: slab.percent,
      lifetimeLimitPaise,
      poolPaise,
      eligibleCount,
      sharePaise,
      distributedPaise,
      undistributedPaise: poolPaise - distributedPaise,
      qualificationIds: qualifications.map((q) => q.qualificationId),
      payouts,
    };
  });

  const totalPoolPaise = slabs.reduce((sum, s) => sum + s.poolPaise, 0);
  const totalDistributedPaise = slabs.reduce((sum, s) => sum + s.distributedPaise, 0);
  return {
    turnoverPaise,
    totalPoolPaise,
    totalDistributedPaise,
    totalUndistributedPaise: totalPoolPaise - totalDistributedPaise,
    slabs,
  };
};

const toInr = (paise: number) => paise / 100;

const slabToPlain = (s: ITeamPerformanceBonusSlab) => ({
  slabId: s.slabId,
  leftRp: s.leftRp,
  rightRp: s.rightRp,
  percent: s.percent,
  lifetimeLimit: s.lifetimeLimit,
  isActive: s.isActive,
});

/** Validates a SuperAdmin slab list. Returns a clean copy or throws a 400 error. */
export const validateConfigInput = (input: { rpBvUnit: unknown; slabs: unknown }) => {
  const rpBvUnit = Number(input.rpBvUnit);
  if (!Number.isInteger(rpBvUnit) || rpBvUnit < 1) {
    throw new TeamPerformanceBonusError('RP conversion must be a whole number of BV per reward point (at least 1).');
  }
  if (!Array.isArray(input.slabs) || input.slabs.length === 0) {
    throw new TeamPerformanceBonusError('At least one slab is required.');
  }

  const seen = new Set<string>();
  const slabs: ITeamPerformanceBonusSlab[] = input.slabs.map((raw: any, index: number) => {
    const slabId = typeof raw?.slabId === 'string' ? raw.slabId.trim() : '';
    if (!slabId) throw new TeamPerformanceBonusError(`Slab ${index + 1} needs a slabId.`);
    if (seen.has(slabId)) throw new TeamPerformanceBonusError(`Slab ID ${slabId} is used more than once.`);
    seen.add(slabId);

    const leftRp = Number(raw.leftRp);
    const rightRp = Number(raw.rightRp);
    if (!Number.isInteger(leftRp) || leftRp < 1 || !Number.isInteger(rightRp) || rightRp < 1) {
      throw new TeamPerformanceBonusError(`${slabId}: RP requirements must be whole numbers of at least 1.`);
    }
    const percent = Number(raw.percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new TeamPerformanceBonusError(`${slabId}: turnover percentage must be between 0 and 100.`);
    }
    const lifetimeLimit = Number(raw.lifetimeLimit);
    if (!Number.isFinite(lifetimeLimit) || lifetimeLimit < 0) {
      throw new TeamPerformanceBonusError(`${slabId}: lifetime limit must be zero or more.`);
    }
    return { slabId, leftRp, rightRp, percent, lifetimeLimit, isActive: raw.isActive !== false };
  });

  return { rpBvUnit, slabs };
};

export const periodIdFor = (periodStart: string, periodEnd: string) => `TPB-PERIOD-${periodStart}-${periodEnd}`;

const isRetryable = (error: any) =>
  error?.hasErrorLabel?.('TransientTransactionError') || error?.code === 112 /* WriteConflict */;

// ---------------------------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------------------------

export class TeamPerformanceBonusService {
  /** The one live configuration, created from the defaults the first time it is read */
  static async getConfig(): Promise<ITeamPerformanceBonusConfig> {
    const existing = await TeamPerformanceBonusConfig.findOne({ configId: CONFIG_ID });
    if (existing) return existing;
    try {
      return await TeamPerformanceBonusConfig.create({
        configId: CONFIG_ID,
        rpBvUnit: TEAM_PERFORMANCE_BONUS_DEFAULTS.RP_BV_UNIT,
        slabs: TEAM_PERFORMANCE_BONUS_DEFAULTS.SLABS,
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      return (await TeamPerformanceBonusConfig.findOne({ configId: CONFIG_ID }))!;
    }
  }

  /** SuperAdmin edit of the RP conversion and slabs. Logged with the old and new values. */
  static async updateConfig(input: { rpBvUnit: unknown; slabs: unknown }, actor: SettlementActor, ipAddress = '') {
    const clean = validateConfigInput(input);
    const config = await this.getConfig();
    const oldValues = { rpBvUnit: config.rpBvUnit, slabs: config.slabs.map(slabToPlain) };

    config.rpBvUnit = clean.rpBvUnit;
    config.slabs = clean.slabs as any;
    config.updatedBy = actor.email;
    await config.save();

    await AuditService.log({
      action: 'TEAM_PERFORMANCE_BONUS_CONFIG_UPDATED',
      entity: 'TeamPerformanceBonusConfig',
      entityId: CONFIG_ID,
      performedBy: actor.email,
      performedByRole: actor.role,
      oldValues,
      newValues: { rpBvUnit: config.rpBvUnit, slabs: config.slabs.map(slabToPlain) },
      ipAddress,
    });
    return config;
  }

  /**
   * Brings one member's RP up to date from the binary tree's lifetime leg volumes, then records a
   * qualification for every active slab the member now meets. Safe to call any number of times:
   * each (member, slab) qualification is written once.
   */
  static async evaluateMember(memberId: string, config?: ITeamPerformanceBonusConfig): Promise<IMemberRewardPoints | null> {
    const id = memberId.toUpperCase();
    const member = await Member.findOne({ memberId: id }).lean();
    if (!canEarnBonus(member)) return null;

    const cfg = config || (await this.getConfig());
    const volume = await BinaryVolume.findOne({ memberId: id }).lean();
    const leftBV = volume?.leftTotalBV || 0;
    const rightBV = volume?.rightTotalBV || 0;
    const leftRP = calculateRP(leftBV, cfg.rpBvUnit);
    const rightRP = calculateRP(rightBV, cfg.rpBvUnit);

    const now = new Date();
    for (const slab of cfg.slabs) {
      if (!slab.isActive) continue;
      if (leftRP < slab.leftRp || rightRP < slab.rightRp) continue;
      try {
        await TeamPerformanceBonusQualification.create({
          qualificationId: `TPBQ-${id}-${slab.slabId}`,
          memberId: id,
          slabId: slab.slabId,
          leftRp: slab.leftRp,
          rightRp: slab.rightRp,
          leftRP,
          rightRP,
          qualifiedAt: now,
        });
      } catch (error: any) {
        if (error?.code !== 11000) throw error; // already qualified
      }
    }

    // Highest slab reached on each side (reporting only; nothing is deducted)
    const reached = await TeamPerformanceBonusQualification.find({ memberId: id }).select('leftRp rightRp').lean();
    const leftConsumedRP = reached.reduce((max, q) => Math.max(max, q.leftRp), 0);
    const rightConsumedRP = reached.reduce((max, q) => Math.max(max, q.rightRp), 0);

    return MemberRewardPoints.findOneAndUpdate(
      { memberId: id },
      {
        $set: { leftBV, rightBV, leftRP, rightRP, leftConsumedRP, rightConsumedRP, rpBvUnit: cfg.rpBvUnit },
      },
      { upsert: true, returnDocument: 'after' }
    );
  }

  /** Runs evaluateMember for every member whose lifetime volumes could reach an active slab */
  static async evaluateAll(config?: ITeamPerformanceBonusConfig): Promise<number> {
    const cfg = config || (await this.getConfig());
    const active = cfg.slabs.filter((s) => s.isActive);
    if (active.length === 0) return 0;
    const lowestBV = Math.min(...active.map((s) => Math.max(s.leftRp, s.rightRp) * cfg.rpBvUnit));
    const candidates = await BinaryVolume.find({
      leftTotalBV: { $gte: lowestBV },
      rightTotalBV: { $gte: lowestBV },
    })
      .select('memberId')
      .lean();
    for (const candidate of candidates) {
      await this.evaluateMember(candidate.memberId, cfg);
    }
    return candidates.length;
  }

  /** Works out the period's turnover, pools and payouts without writing a settlement */
  static async planPeriod(options: { periodStart: unknown; periodEnd: unknown; overrideTurnover?: unknown }) {
    const { periodStart, periodEnd } = this.parsePeriod(options);
    const overrideTurnover =
      options.overrideTurnover === undefined || options.overrideTurnover === null || options.overrideTurnover === ''
        ? undefined
        : Number(options.overrideTurnover);
    if (overrideTurnover !== undefined && (!Number.isFinite(overrideTurnover) || overrideTurnover < 0)) {
      throw new TeamPerformanceBonusError('Turnover override must be zero or more.');
    }

    const config = await this.getConfig();
    await this.evaluateAll(config);
    const activeSlabs = config.slabs.filter((s) => s.isActive);
    const activeIds = activeSlabs.map((s) => s.slabId);

    let turnover = overrideTurnover;
    if (turnover === undefined) {
      const sales = await GrossVolumeService.forPeriod(BusinessDate.startOf(periodStart), BusinessDate.endOf(periodEnd));
      turnover = sales.revenue;
    }

    const qualifications = await TeamPerformanceBonusQualification.find({
      settlementPeriodId: null,
      slabId: { $in: activeIds },
    })
      .select('qualificationId memberId slabId')
      .lean();
    const memberIds = [...new Set(qualifications.map((q) => q.memberId))];
    const lifetime = await TeamPerformanceBonusLifetime.find({ memberId: { $in: memberIds }, slabId: { $in: activeIds } }).lean();
    const paidPaiseByKey = new Map(lifetime.map((l) => [lifetimeKey(l.memberId, l.slabId), l.paidPaise]));

    const plan = planSlabSettlement({
      turnover,
      slabs: activeSlabs.map((s) => ({ slabId: s.slabId, percent: s.percent, lifetimeLimit: s.lifetimeLimit })),
      qualifications,
      paidPaiseByKey,
    });

    return {
      periodId: periodIdFor(periodStart, periodEnd),
      periodStart,
      periodEnd,
      turnover,
      turnoverSource: overrideTurnover !== undefined ? ('OVERRIDE' as const) : ('AUTO' as const),
      ...plan,
    };
  }

  /** Read-only preview for the SuperAdmin, with member names */
  static async previewSettlement(options: { periodStart: unknown; periodEnd: unknown; overrideTurnover?: unknown }) {
    const plan = await this.planPeriod(options);
    const existing = await CompanyTurnoverPeriod.findOne({ periodId: plan.periodId }).lean();
    const memberIds = [...new Set(plan.slabs.flatMap((s) => s.payouts.map((p) => p.memberId)))];
    const members = await Member.find({ memberId: { $in: memberIds } }).select('memberId name').lean();
    const names = new Map(members.map((m) => [m.memberId, m.name]));

    return {
      periodId: plan.periodId,
      periodStart: plan.periodStart,
      periodEnd: plan.periodEnd,
      turnover: plan.turnover,
      turnoverSource: plan.turnoverSource,
      turnoverPaise: plan.turnoverPaise,
      totalPool: toInr(plan.totalPoolPaise),
      totalDistributed: toInr(plan.totalDistributedPaise),
      totalUndistributed: toInr(plan.totalUndistributedPaise),
      alreadySettled: existing?.status === 'COMPLETED',
      slabs: plan.slabs.map((s) => ({
        slabId: s.slabId,
        percent: s.percent,
        lifetimeLimit: toInr(s.lifetimeLimitPaise),
        pool: toInr(s.poolPaise),
        eligibleCount: s.eligibleCount,
        equalShare: toInr(s.sharePaise),
        distributed: toInr(s.distributedPaise),
        undistributed: toInr(s.undistributedPaise),
        payouts: s.payouts.map((p) => ({
          memberId: p.memberId,
          name: names.get(p.memberId) || '',
          plannedPayout: toInr(p.plannedPaise),
          lifetimeBefore: toInr(p.lifetimeBeforePaise),
        })),
      })),
    };
  }

  /**
   * Settles a finished period. The plan is written to the period record before any money moves,
   * so a run that stops partway can be repeated with the same figures. Every payout is idempotent
   * and every wallet credit is in the same transaction as its payout and lifetime counter.
   */
  static async executeSettlement(
    options: { periodStart: unknown; periodEnd: unknown; overrideTurnover?: unknown },
    actor: SettlementActor,
    ipAddress = ''
  ): Promise<{ period: ICompanyTurnoverPeriod; alreadySettled: boolean }> {
    const { periodStart, periodEnd } = this.parsePeriod(options);
    const periodId = periodIdFor(periodStart, periodEnd);

    let period = await CompanyTurnoverPeriod.findOne({ periodId });
    if (period?.status === 'COMPLETED') return { period, alreadySettled: true };

    if (!period) {
      const plan = await this.planPeriod(options);
      const config = await this.getConfig();
      const limitBySlab = new Map(config.slabs.map((s) => [s.slabId, s.lifetimeLimit]));
      try {
        period = await CompanyTurnoverPeriod.create({
          periodId,
          periodStart,
          periodEnd,
          turnoverRevenue: plan.turnover,
          turnoverSource: plan.turnoverSource,
          totalPool: toInr(plan.totalPoolPaise),
          totalDistributed: 0,
          totalUndistributed: toInr(plan.totalPoolPaise),
          slabResults: plan.slabs.map((s) => ({
            slabId: s.slabId,
            percent: s.percent,
            lifetimeLimit: limitBySlab.get(s.slabId) || 0,
            pool: toInr(s.poolPaise),
            eligibleCount: s.eligibleCount,
            equalShare: toInr(s.sharePaise),
            distributed: 0,
            undistributed: toInr(s.poolPaise),
            qualificationIds: s.qualificationIds,
            payouts: s.payouts.map((p) => ({
              qualificationId: p.qualificationId,
              memberId: p.memberId,
              plannedPayout: toInr(p.plannedPaise),
            })),
          })),
          status: 'PENDING',
          processedBy: actor.email,
          processedAt: new Date(),
        });
        await AuditService.log({
          action: 'TEAM_PERFORMANCE_BONUS_PERIOD_PLANNED',
          entity: 'CompanyTurnoverPeriod',
          entityId: periodId,
          performedBy: actor.email,
          performedByRole: actor.role,
          newValues: { turnover: plan.turnover, turnoverSource: plan.turnoverSource, totalPool: toInr(plan.totalPoolPaise) },
          ipAddress,
        });
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
        // A concurrent run planned it first: use the figures it froze
        period = await CompanyTurnoverPeriod.findOne({ periodId });
        if (!period) throw error;
        if (period.status === 'COMPLETED') return { period, alreadySettled: true };
      }
    }

    for (const slab of period.slabResults) {
      for (const planned of slab.payouts) {
        await this.payOne(periodId, slab.slabId, slab.lifetimeLimit, slab.pool, slab.eligibleCount, slab.equalShare, planned);
      }
    }

    const qualificationIds = period.slabResults.flatMap((s) => s.qualificationIds);
    if (qualificationIds.length > 0) {
      await TeamPerformanceBonusQualification.updateMany(
        { qualificationId: { $in: qualificationIds }, settlementPeriodId: null },
        { $set: { settlementPeriodId: periodId } }
      );
    }

    const payouts = await TeamPerformanceBonusPayout.find({ periodId }).lean();
    const paidBySlab = new Map<string, number>();
    for (const p of payouts) {
      paidBySlab.set(p.slabId, (paidBySlab.get(p.slabId) || 0) + toPaiseSafe(p.actualPayout));
    }
    let totalDistributedPaise = 0;
    for (const slab of period.slabResults) {
      const distributedPaise = paidBySlab.get(slab.slabId) || 0;
      slab.distributed = toInr(distributedPaise);
      slab.undistributed = toInr(toPaiseSafe(slab.pool) - distributedPaise);
      totalDistributedPaise += distributedPaise;
    }
    period.totalDistributed = toInr(totalDistributedPaise);
    period.totalUndistributed = toInr(toPaiseSafe(period.totalPool) - totalDistributedPaise);
    period.status = 'COMPLETED';
    period.processedAt = new Date();
    await period.save();

    await AuditService.log({
      action: 'TEAM_PERFORMANCE_BONUS_PERIOD_SETTLED',
      entity: 'CompanyTurnoverPeriod',
      entityId: periodId,
      performedBy: actor.email,
      performedByRole: actor.role,
      newValues: { totalPool: period.totalPool, totalDistributed: period.totalDistributed, payouts: payouts.length },
      ipAddress,
    });

    return { period, alreadySettled: false };
  }

  /** Pays one planned payout, capped at what the member has left on this slab. Safe to repeat. */
  private static async payOne(
    periodId: string,
    slabId: string,
    lifetimeLimit: number,
    pool: number,
    eligibleCount: number,
    equalShare: number,
    planned: { memberId: string; plannedPayout: number }
  ): Promise<void> {
    const memberId = planned.memberId.toUpperCase();
    const idempotencyKey = `TPB:${periodId}:${slabId}:${memberId}`;
    if (await TeamPerformanceBonusPayout.exists({ idempotencyKey })) return;

    const attempt = async () =>
      runInTransaction(async (session: ClientSession) => {
        const member = await Member.findOne({ memberId }).select('_id name').session(session);
        if (!member) return null;

        const lifetime = await TeamPerformanceBonusLifetime.findOneAndUpdate(
          { memberId, slabId },
          { $setOnInsert: { memberId, slabId, paidPaise: 0 } },
          { upsert: true, returnDocument: 'after', session }
        );
        const remainingPaise = Math.max(0, Math.round(lifetimeLimit * 100) - lifetime!.paidPaise);
        const actualPaise = Math.min(Math.round(planned.plannedPayout * 100), remainingPaise);
        if (actualPaise <= 0) return null;

        const actual = toInr(actualPaise);
        const ledgerId = `COMM-TPB-${periodId}-${slabId}-${memberId}`;
        const lifetimeBefore = lifetime!.paidPaise;

        await TeamPerformanceBonusLifetime.updateOne({ memberId, slabId }, { $inc: { paidPaise: actualPaise } }, { session });
        const [payout] = await TeamPerformanceBonusPayout.create(
          [
            {
              payoutId: `TPBP-${periodId}-${slabId}-${memberId}`,
              idempotencyKey,
              periodId,
              slabId,
              memberId,
              pool,
              eligibleCount,
              equalShare,
              lifetimeBefore: toInr(lifetimeBefore),
              lifetimeLimit,
              plannedPayout: planned.plannedPayout,
              actualPayout: actual,
              ledgerId,
            },
          ],
          { session }
        );
        await CommissionLedger.create(
          [
            {
              ledgerId,
              userId: member._id.toString(),
              memberId,
              type: COMMISSION_TYPE.TEAM_PERFORMANCE_BONUS,
              sourceEventId: periodId,
              grossAmount: actual,
              grossAmountInPaise: actualPaise,
              tdsDeduction: 0,
              tdsDeductionInPaise: 0,
              adminFee: 0,
              adminFeeInPaise: 0,
              payableAmount: actual,
              payableAmountInPaise: actualPaise,
              status: 'APPROVED',
              calculationDetails: {
                sourceEventId: periodId,
                tierApplied: slabId,
                notes: `Team Performance Bonus ${slabId} for ${periodId}`,
              },
              isReversed: false,
            },
          ],
          { session }
        );
        await WalletService.creditCommission(memberId, actual, ledgerId, `Team Performance Bonus (${slabId})`, session);
        return payout;
      });

    for (let tries = 1; ; tries++) {
      try {
        await attempt();
        return;
      } catch (error: any) {
        // Another run paid this member for this slab first
        if (error?.code === 11000) return;
        if (isRetryable(error) && tries < MAX_TRANSACTION_ATTEMPTS) continue;
        throw error;
      }
    }
  }

  /** Member dashboard: BV and RP, slab progress, qualifications, lifetime eligibility and payouts */
  static async getMemberStatus(memberId: string) {
    const id = memberId.toUpperCase();
    const config = await this.getConfig();
    const rp = (await this.evaluateMember(id, config)) || null;
    const volume = await BinaryVolume.findOne({ memberId: id }).select('leftTotalBV rightTotalBV').lean();

    const [qualifications, lifetime, payouts] = await Promise.all([
      TeamPerformanceBonusQualification.find({ memberId: id }).sort({ qualifiedAt: 1 }).lean(),
      TeamPerformanceBonusLifetime.find({ memberId: id }).lean(),
      TeamPerformanceBonusPayout.find({ memberId: id }).sort({ createdAt: -1 }).lean(),
    ]);
    const paidBySlab = new Map(lifetime.map((l) => [l.slabId, toInr(l.paidPaise)]));
    const qualifiedBySlab = new Map(qualifications.map((q) => [q.slabId, q]));

    const slabs = config.slabs.map((slab) => {
      const paid = paidBySlab.get(slab.slabId) || 0;
      const qualification = qualifiedBySlab.get(slab.slabId);
      return {
        slabId: slab.slabId,
        leftRp: slab.leftRp,
        rightRp: slab.rightRp,
        percent: slab.percent,
        lifetimeLimit: slab.lifetimeLimit,
        isActive: slab.isActive,
        leftProgress: Math.min(1, (rp?.leftRP || 0) / slab.leftRp),
        rightProgress: Math.min(1, (rp?.rightRP || 0) / slab.rightRp),
        qualified: !!qualification,
        qualifiedAt: qualification?.qualifiedAt || null,
        settled: !!qualification?.settlementPeriodId,
        paid,
        remainingLifetime: Math.max(0, toInr(Math.round(slab.lifetimeLimit * 100) - Math.round(paid * 100))),
      };
    });

    return {
      memberId: id,
      rpBvUnit: config.rpBvUnit,
      leftBV: volume?.leftTotalBV || 0,
      rightBV: volume?.rightTotalBV || 0,
      leftRP: rp?.leftRP || 0,
      rightRP: rp?.rightRP || 0,
      leftConsumedRP: rp?.leftConsumedRP || 0,
      rightConsumedRP: rp?.rightConsumedRP || 0,
      slabs,
      totalEarned: toInr(payouts.reduce((sum, p) => sum + toPaiseSafe(p.actualPayout), 0)),
      totalRemainingLifetime: toInr(
        slabs.filter((s) => s.isActive).reduce((sum, s) => sum + Math.round(s.remainingLifetime * 100), 0)
      ),
      payouts,
    };
  }

  /** Member-wise RP table for the SuperAdmin */
  static async listMemberRewardPoints(limit = 500) {
    return MemberRewardPoints.find().sort({ updatedAt: -1 }).limit(Math.min(limit, 2000)).lean();
  }

  static async listPeriods(limit = 100) {
    return CompanyTurnoverPeriod.find().sort({ periodStart: -1 }).limit(limit).lean();
  }

  static async getPeriod(periodId: string) {
    const period = await CompanyTurnoverPeriod.findOne({ periodId }).lean();
    if (!period) return null;
    const payouts = await TeamPerformanceBonusPayout.find({ periodId }).sort({ slabId: 1, memberId: 1 }).lean();
    return { period, payouts };
  }

  /** Validates period dates: IST calendar days, in order, and only once the period has finished */
  static parsePeriod(options: { periodStart: unknown; periodEnd: unknown }): { periodStart: string; periodEnd: string } {
    const { periodStart, periodEnd } = options;
    if (!BusinessDate.isValid(periodStart) || !BusinessDate.isValid(periodEnd)) {
      throw new TeamPerformanceBonusError('Period start and end must be dates in YYYY-MM-DD format.');
    }
    if (periodStart > periodEnd) {
      throw new TeamPerformanceBonusError('The period must start on or before it ends.');
    }
    if (periodEnd >= BusinessDate.today()) {
      throw new TeamPerformanceBonusError(`The period has not finished yet. It can be settled from ${BusinessDate.addDays(periodEnd, 1)}.`);
    }
    return { periodStart, periodEnd };
  }
}

const toPaiseSafe = (inr: number) => Math.round((inr || 0) * 100);

export default TeamPerformanceBonusService;
