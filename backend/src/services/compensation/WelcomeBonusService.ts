import { Member } from '../../models/Member.model';
import { CompensationRule, ICompensationRule } from '../../models/CompensationRule.model';
import { WelcomeBonusSettlement, IWelcomeBonusSettlement } from '../../models/WelcomeBonusSettlement.model';
import { WelcomeBonusTransaction, IWelcomeBonusTransaction } from '../../models/WelcomeBonusTransaction.model';
import { BVWalletService, runInTransaction } from '../BVWalletService';
import { GrossVolumeService } from '../GrossVolumeService';
import { LifetimeBvService } from './LifetimeBvService';
import { DecimalUtil } from '../../utils/decimal';
import { BusinessDate } from '../../utils/businessDate';
import { BV_OWNER_TYPE, HTTP_STATUS, WELCOME_BONUS_DEFAULTS } from '../../config/constants';
import { canEarnBonus } from '../../utils/binaryEligibility';

/**
 * Welcome bonus: every week the company puts a share (4%) of its gross BV into a pool, split equally
 * among the eligible members and credited to their BV Wallets.
 *
 * A member is eligible when:
 *  1. the account is active;
 *  2. it has received at least 1,250 BV in its lifetime (orders and transfers in, see LifetimeBvService);
 *  3. it has directly sponsored at least 2 members whose binary status is active (100 BV or more),
 *     placed anywhere in the tree;
 *  4. its welcome bonus so far is below 2x its lifetime BV. The last payment is cut so the total
 *     lands exactly on 2x.
 * The member's own binary activation (100 BV lock) plays no part in its lifetime BV.
 *
 * Weeks run Monday to Sunday in IST. The Super Admin settles a week once it has finished; eligibility
 * is taken as of that Sunday 23:59:59 IST.
 */

export class WelcomeBonusError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = HTTP_STATUS.BAD_REQUEST) {
    super(message);
    this.name = 'WelcomeBonusError';
    this.statusCode = statusCode;
  }
}

export interface WelcomeBonusConfig {
  isEnabled: boolean;
  ratePercent: number;
  maxMultiplier: number;
  minLifetimeBv: number;
  minSponsoredCount: number;
  settlementFrequency: string;
}

export interface WeekPeriod {
  weekStart: string; // IST Monday, 'YYYY-MM-DD'
  periodStart: Date;
  periodEnd: Date;
  settlementId: string;
}

export interface MemberEligibilityResult {
  memberId: string;
  name: string;
  email: string;
  lifetimeBv: number;
  sponsoredCount: number;
  welcomeBonusCap: number;
  welcomeBonusEarned: number;
  remainingCap: number;
  isEligible: boolean;
  ineligibleReason?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const formatDate = (d?: Date | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const positive = (value: unknown, fallback: number) => (typeof value === 'number' && value > 0 ? value : fallback);
const nonNegative = (value: unknown, fallback: number) => (typeof value === 'number' && value >= 0 ? value : fallback);

export class WelcomeBonusService {
  /**
   * Helper to get active rules
   */
  static async getActiveRules(): Promise<ICompensationRule> {
    let rule = await CompensationRule.findOne({ isActive: true }).sort({ version: -1 });
    if (!rule) {
      rule = await CompensationRule.findOne().sort({ version: -1 });
    }
    if (!rule) {
      rule = await CompensationRule.create({
        ruleSetId: 'DEFAULT_RULES',
        version: 1,
        isActive: true,
        welcomeBonus: {
          isEnabled: true,
          ratePercent: WELCOME_BONUS_DEFAULTS.RATE_PERCENT,
          maxMultiplier: WELCOME_BONUS_DEFAULTS.MAX_MULTIPLIER,
          minLifetimeBv: WELCOME_BONUS_DEFAULTS.MIN_LIFETIME_BV,
          minSponsoredCount: WELCOME_BONUS_DEFAULTS.MIN_SPONSORED_COUNT,
          settlementFrequency: 'WEEKLY',
        },
      });
    }
    return rule;
  }

  static async getConfig(): Promise<WelcomeBonusConfig> {
    const rules = await this.getActiveRules();
    const c: any = rules.welcomeBonus || {};
    return {
      isEnabled: c.isEnabled !== false,
      ratePercent: positive(c.ratePercent, WELCOME_BONUS_DEFAULTS.RATE_PERCENT),
      maxMultiplier: positive(c.maxMultiplier, WELCOME_BONUS_DEFAULTS.MAX_MULTIPLIER),
      minLifetimeBv: nonNegative(c.minLifetimeBv, WELCOME_BONUS_DEFAULTS.MIN_LIFETIME_BV),
      minSponsoredCount: nonNegative(c.minSponsoredCount, WELCOME_BONUS_DEFAULTS.MIN_SPONSORED_COUNT),
      settlementFrequency: c.settlementFrequency || 'WEEKLY',
    };
  }

  // ---------------------------------------------------------------------------
  // Weeks
  // ---------------------------------------------------------------------------

  /** The IST week (Monday 00:00 to Sunday 23:59:59.999) that starts on the given Monday */
  static getWeek(weekStart: string): WeekPeriod {
    return {
      weekStart,
      periodStart: BusinessDate.startOf(weekStart),
      periodEnd: BusinessDate.endOf(BusinessDate.addDays(weekStart, 6)),
      settlementId: `WB-${weekStart}`,
    };
  }

  static currentWeek(now: Date = new Date()): WeekPeriod {
    return this.getWeek(BusinessDate.weekStartOf(BusinessDate.of(now)));
  }

  static lastFinishedWeek(now: Date = new Date()): WeekPeriod {
    return this.getWeek(BusinessDate.addDays(this.currentWeek(now).weekStart, -7));
  }

  /** A week picked by the admin ('YYYY-MM-DD' Monday); the last finished week when none is given */
  static parseWeek(value: unknown): WeekPeriod {
    if (value === undefined || value === null || value === '') return this.lastFinishedWeek();
    if (!BusinessDate.isValid(value) || BusinessDate.weekStartOf(value) !== value) {
      throw new WelcomeBonusError('Pick the Monday the week starts on (YYYY-MM-DD).');
    }
    return this.getWeek(value);
  }

  /**
   * The settlement already made for a week. Settlements made before weeks were keyed have no
   * weekStart; they started on that Monday in the server's timezone, so they are matched by start time.
   */
  static async findSettlementForWeek(week: WeekPeriod): Promise<IWelcomeBonusSettlement | null> {
    return WelcomeBonusSettlement.findOne({
      $or: [
        { weekStart: week.weekStart },
        {
          weekStart: { $exists: false },
          periodStart: {
            $gte: new Date(week.periodStart.getTime() - DAY_MS / 2),
            $lt: new Date(week.periodStart.getTime() + DAY_MS),
          },
        },
      ],
    });
  }

  /** Recently finished weeks that have not been settled, newest first */
  static async getUnsettledWeeks(now: Date = new Date()): Promise<WeekPeriod[]> {
    const weeks: WeekPeriod[] = [];
    let week = this.lastFinishedWeek(now);
    for (let i = 0; i < WELCOME_BONUS_DEFAULTS.SETTLEABLE_WEEKS; i++) {
      if (!(await this.findSettlementForWeek(week))) weeks.push(week);
      week = this.getWeek(BusinessDate.addDays(week.weekStart, -7));
    }
    return weeks;
  }

  // ---------------------------------------------------------------------------
  // Eligibility
  // ---------------------------------------------------------------------------

  /** Evaluates members as of a moment: lifetime BV and sponsored members are counted up to then */
  static async evaluateMembers(
    asOf: Date,
    config: WelcomeBonusConfig,
    memberIds?: string[]
  ): Promise<MemberEligibilityResult[]> {
    const [members, lifetimeBv, sponsorRows] = await Promise.all([
      Member.find({ ...(memberIds ? { memberId: { $in: memberIds } } : {}), createdAt: { $lte: asOf } })
        .select('memberId name email status isActive welcomeBonusEarned isBinaryActive personalBv parentId sponsorId')
        .sort({ createdAt: 1 })
        .lean(),
      LifetimeBvService.compute({ asOf, memberIds }),
      // Directly sponsored members, wherever they were placed in the tree, whose binary status was
      // active (100 BV reached) by then. Members activated before the date was recorded have none.
      Member.aggregate([
        {
          $match: {
            sponsorId: memberIds ? { $in: memberIds } : { $nin: [null, ''] },
            status: 'active',
            isActive: true,
            isBinaryActive: true,
            createdAt: { $lte: asOf },
            $or: [{ binaryActivatedAt: { $lte: asOf } }, { binaryActivatedAt: null }],
          },
        },
        { $group: { _id: '$sponsorId', count: { $sum: 1 } } },
      ]),
    ]);
    const sponsoredByMember = new Map(sponsorRows.map((r) => [r._id as string, r.count as number]));

    return members.map((m) => {
      const memberLifetimeBv = lifetimeBv.get(m.memberId) || 0;
      const sponsoredCount = sponsoredByMember.get(m.memberId) || 0;
      const welcomeBonusCap = memberLifetimeBv * config.maxMultiplier;
      const welcomeBonusEarned = m.welcomeBonusEarned || 0;
      const remainingCap = Math.max(0, welcomeBonusCap - welcomeBonusEarned);

      let ineligibleReason = '';
      if (!m.isActive || m.status !== 'active') {
        ineligibleReason = 'Member account is inactive';
      } else if (!canEarnBonus(m)) {
        ineligibleReason = 'Member is not binary active (100 BV) or not placed in the binary tree';
      } else if (memberLifetimeBv < config.minLifetimeBv) {
        ineligibleReason = `Needs at least ${config.minLifetimeBv} BV in its lifetime (has ${memberLifetimeBv} BV)`;
      } else if (sponsoredCount < config.minSponsoredCount) {
        ineligibleReason = `Needs at least ${config.minSponsoredCount} directly sponsored members with active binary status (has ${sponsoredCount})`;
      } else if (remainingCap <= 0) {
        ineligibleReason = `Maximum ${config.maxMultiplier}× Welcome Bonus cap reached`;
      }

      return {
        memberId: m.memberId,
        name: m.name,
        email: m.email,
        lifetimeBv: memberLifetimeBv,
        sponsoredCount,
        welcomeBonusCap,
        welcomeBonusEarned,
        remainingCap,
        isEligible: !ineligibleReason,
        ineligibleReason: ineligibleReason || undefined,
      };
    });
  }

  static async checkMemberEligibility(memberId: string, asOf: Date = new Date()): Promise<MemberEligibilityResult> {
    const id = memberId.toUpperCase();
    const config = await this.getConfig();
    const [result] = await this.evaluateMembers(asOf, config, [id]);
    if (!result) throw new WelcomeBonusError(`Member ${id} not found`, HTTP_STATUS.NOT_FOUND);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Settlement
  // ---------------------------------------------------------------------------

  /**
   * Works out a week's pool and payouts. For a week still running, figures are as of now (a projection).
   */
  static async planWeek(week: WeekPeriod, config: WelcomeBonusConfig, overrideGBV?: number) {
    const asOf = new Date(Math.min(week.periodEnd.getTime(), Date.now()));
    const companyGrossBusinessVolume =
      typeof overrideGBV === 'number' && overrideGBV >= 0
        ? overrideGBV
        : (await GrossVolumeService.forPeriod(week.periodStart, asOf)).bv;
    const totalWelcomeBonusPool = DecimalUtil.round((companyGrossBusinessVolume * config.ratePercent) / 100);

    const allEvaluations = await this.evaluateMembers(asOf, config);
    const eligible = allEvaluations.filter((e) => e.isEligible);
    // Paid into the BV Wallet, which holds whole BV only: shares are rounded down and any
    // remainder stays undistributed
    const equalMemberShare = eligible.length > 0 ? Math.floor(totalWelcomeBonusPool / eligible.length) : 0;

    const payouts = eligible.map((e) => ({
      memberId: e.memberId,
      name: e.name,
      lifetimeBv: e.lifetimeBv,
      sponsoredCount: e.sponsoredCount,
      welcomeBonusCap: e.welcomeBonusCap,
      welcomeBonusEarned: e.welcomeBonusEarned,
      plannedPayout: Math.min(equalMemberShare, Math.floor(e.remainingCap)),
    }));
    const projectedDistributed = payouts.reduce((sum, p) => sum + p.plannedPayout, 0);

    return {
      ...week,
      companyGrossBusinessVolume,
      welcomeBonusRate: config.ratePercent,
      totalWelcomeBonusPool,
      eligibleMemberCount: eligible.length,
      equalMemberShare,
      projectedDistributed,
      projectedUndistributed: Math.max(0, DecimalUtil.round(totalWelcomeBonusPool - projectedDistributed)),
      payouts,
      allEvaluations,
    };
  }

  /**
   * Preview of a week's settlement (default: the last finished week)
   */
  static async previewWeeklySettlement(options: { weekStart?: unknown; overrideGBV?: number } = {}) {
    const config = await this.getConfig();
    const week = this.parseWeek(options.weekStart);
    const [plan, existing] = await Promise.all([
      this.planWeek(week, config, options.overrideGBV),
      this.findSettlementForWeek(week),
    ]);

    return {
      settlementId: existing?.settlementId || plan.settlementId,
      weekStart: plan.weekStart,
      periodStart: plan.periodStart,
      periodEnd: plan.periodEnd,
      isWeekFinished: plan.periodEnd.getTime() < Date.now(),
      companyGrossBusinessVolume: plan.companyGrossBusinessVolume,
      welcomeBonusRate: plan.welcomeBonusRate,
      totalWelcomeBonusPool: plan.totalWelcomeBonusPool,
      eligibleMemberCount: plan.eligibleMemberCount,
      equalMemberShare: plan.equalMemberShare,
      projectedDistributed: plan.projectedDistributed,
      projectedUndistributed: plan.projectedUndistributed,
      isAlreadyProcessed: !!existing,
      existingSettlementStatus: existing ? existing.status : null,
      projectedPayouts: plan.payouts.map((p) => ({
        ...p,
        remainingCap: Math.max(0, p.welcomeBonusCap - p.welcomeBonusEarned),
        equalMemberShare: plan.equalMemberShare,
        actualPayout: p.plannedPayout,
        isCapped: p.plannedPayout < plan.equalMemberShare,
      })),
      allEvaluations: plan.allEvaluations,
    };
  }

  /**
   * Settles a finished week (default: the last finished week). The pool, eligible members and each
   * payout are fixed on the settlement record before anyone is paid, so a run that stops partway is
   * finished by running it again with the same figures. A member is never paid twice for a week.
   */
  static async executeWeeklySettlement(options: { weekStart?: unknown; overrideGBV?: number } = {}): Promise<{
    settlement: IWelcomeBonusSettlement;
    transactions: IWelcomeBonusTransaction[];
    alreadySettled: boolean;
  }> {
    const config = await this.getConfig();
    if (!config.isEnabled) {
      throw new WelcomeBonusError('The welcome bonus is switched off in Income Settings.');
    }
    const week = this.parseWeek(options.weekStart);
    if (week.periodEnd.getTime() >= Date.now()) {
      throw new WelcomeBonusError(
        `The week starting ${week.weekStart} has not finished yet. It can be settled from ${BusinessDate.addDays(week.weekStart, 7)}.`
      );
    }

    let settlement = await this.findSettlementForWeek(week);
    if (settlement?.status === 'COMPLETED') {
      const transactions = await WelcomeBonusTransaction.find({ settlementId: settlement.settlementId });
      return { settlement, transactions, alreadySettled: true };
    }

    if (!settlement) {
      const plan = await this.planWeek(week, config, options.overrideGBV);
      try {
        settlement = await WelcomeBonusSettlement.create({
          settlementId: plan.settlementId,
          weekStart: plan.weekStart,
          periodStart: plan.periodStart,
          periodEnd: plan.periodEnd,
          companyGrossBusinessVolume: plan.companyGrossBusinessVolume,
          welcomeBonusRate: plan.welcomeBonusRate,
          totalWelcomeBonusPool: plan.totalWelcomeBonusPool,
          eligibleMemberCount: plan.eligibleMemberCount,
          equalMemberShare: plan.equalMemberShare,
          totalAmountDistributed: 0,
          totalAmountUndistributed: plan.totalWelcomeBonusPool,
          maxMultiplier: config.maxMultiplier,
          minLifetimeBv: config.minLifetimeBv,
          minSponsoredCount: config.minSponsoredCount,
          payouts: plan.payouts,
          status: 'PENDING',
          processedAt: new Date(),
        });
      } catch (error: any) {
        // A concurrent run created it first; carry on with its figures
        if (error?.code !== 11000) throw error;
        settlement = await this.findSettlementForWeek(week);
        if (!settlement) throw error;
      }
    }

    const settlementId = settlement.settlementId;
    const transactions: IWelcomeBonusTransaction[] = [];

    for (const planned of settlement.payouts) {
      const { memberId } = planned;
      if (planned.plannedPayout <= 0) continue;

      const existingTx = await WelcomeBonusTransaction.findOne({ memberId, settlementId });
      if (existingTx) {
        transactions.push(existingTx);
        continue;
      }

      await BVWalletService.ensureWallet({ ownerType: BV_OWNER_TYPE.MEMBER, ownerId: memberId });

      // The settlement record, the member's earned total and the BV Wallet credit commit together
      let tx: IWelcomeBonusTransaction | null;
      try {
        tx = await runInTransaction(async (session) => {
          const member = await Member.findOne({ memberId }).select('name welcomeBonusEarned').session(session);
          if (!member) return null;
          // Never past the cap, even if another week was settled after this plan was made
          const earned = member.welcomeBonusEarned || 0;
          const remainingCap = Math.max(0, Math.floor(planned.welcomeBonusCap - earned));
          const actualPayout = Math.min(planned.plannedPayout, remainingCap);
          if (actualPayout <= 0) return null;

          const [created] = await WelcomeBonusTransaction.create(
            [
              {
                transactionId: `WBTX-${settlementId}-${memberId}`,
                memberId,
                settlementId,
                companyGrossBusinessVolume: settlement!.companyGrossBusinessVolume,
                bonusRate: settlement!.welcomeBonusRate,
                totalBonusPool: settlement!.totalWelcomeBonusPool,
                eligibleMemberCount: settlement!.eligibleMemberCount,
                equalMemberShare: settlement!.equalMemberShare,
                previousWelcomeBonusEarned: earned,
                welcomeBonusCap: planned.welcomeBonusCap,
                remainingCap,
                actualPayout,
              },
            ],
            { session }
          );
          await Member.updateOne({ memberId }, { $inc: { welcomeBonusEarned: actualPayout } }, { session });
          await BVWalletService.creditWelcomeBonus(session, {
            memberId,
            memberName: member.name || memberId,
            settlementId,
            amount: actualPayout,
          });
          return created;
        });
      } catch (error: any) {
        // A concurrent run already paid this member for this settlement
        if (error?.code === 11000) {
          const paid = await WelcomeBonusTransaction.findOne({ memberId, settlementId });
          if (paid) {
            transactions.push(paid);
            continue;
          }
        }
        throw error;
      }

      if (!tx) continue;
      transactions.push(tx);
      await BVWalletService.activateFromWalletIfEligible(memberId);
    }

    const totalDistributed = transactions.reduce((sum, t) => sum + (t.actualPayout || 0), 0);
    settlement.totalAmountDistributed = totalDistributed;
    settlement.totalAmountUndistributed = Math.max(
      0,
      DecimalUtil.round(settlement.totalWelcomeBonusPool - totalDistributed)
    );
    settlement.status = 'COMPLETED';
    settlement.processedAt = new Date();
    await settlement.save();

    return { settlement, transactions, alreadySettled: false };
  }

  // ---------------------------------------------------------------------------
  // Dashboards
  // ---------------------------------------------------------------------------

  private static activeRulesView(config: WelcomeBonusConfig) {
    return {
      ratePercent: config.ratePercent,
      maxMultiplier: config.maxMultiplier,
      minLifetimeBv: config.minLifetimeBv,
      minSponsoredCount: config.minSponsoredCount,
      settlementFrequency: config.settlementFrequency,
      isEnabled: config.isEnabled,
    };
  }

  private static async mapTransactions(rows: IWelcomeBonusTransaction[]) {
    const memberIds = [...new Set(rows.map((h) => h.memberId))];
    const members = await Member.find({ memberId: { $in: memberIds } }).select('memberId name');
    const memberNameMap = new Map(members.map((m) => [m.memberId, m.name]));
    return rows.map((h) => ({
      transactionId: h.transactionId,
      settlementId: h.settlementId,
      memberId: h.memberId,
      memberName: memberNameMap.get(h.memberId) || h.memberId,
      companyGrossBusinessVolume: h.companyGrossBusinessVolume,
      bonusRate: h.bonusRate,
      totalBonusPool: h.totalBonusPool,
      eligibleMemberCount: h.eligibleMemberCount,
      equalMemberShare: h.equalMemberShare,
      actualPayout: h.actualPayout,
      previousWelcomeBonusEarned: h.previousWelcomeBonusEarned,
      welcomeBonusCap: h.welcomeBonusCap,
      date: formatDate(h.createdAt),
      status: 'Credited',
    }));
  }

  /**
   * Get Welcome Bonus status & live details for Member Dashboard. Pool figures are a projection for
   * the week in progress.
   */
  static async getMemberDashboardStatus(memberId: string) {
    const member = await Member.findOne({ memberId }).select('memberId name');
    if (!member) {
      throw new WelcomeBonusError(`Member ${memberId} not found`, HTTP_STATUS.NOT_FOUND);
    }

    const config = await this.getConfig();
    const plan = await this.planWeek(this.currentWeek(), config);
    const eligibility = plan.allEvaluations.find((e) => e.memberId === member.memberId);
    if (!eligibility) throw new WelcomeBonusError(`Member ${memberId} not found`, HTTP_STATUS.NOT_FOUND);

    const history = await this.mapTransactions(
      await WelcomeBonusTransaction.find({ memberId: member.memberId }).sort({ createdAt: -1 })
    );

    let statusDisplay: 'Eligible' | 'Cap Reached' | 'Ineligible' = 'Eligible';
    if (eligibility.welcomeBonusCap > 0 && eligibility.remainingCap <= 0) {
      statusDisplay = 'Cap Reached';
    } else if (!eligibility.isEligible) {
      statusDisplay = 'Ineligible';
    }

    return {
      memberId: member.memberId,
      name: member.name,
      activeRules: this.activeRulesView(config),
      lifetimeBv: eligibility.lifetimeBv,
      sponsoredCount: eligibility.sponsoredCount,
      qualifyingBusinessVolume: eligibility.lifetimeBv,
      maximumWelcomeBonus: eligibility.welcomeBonusCap,
      totalWelcomeBonusEarned: eligibility.welcomeBonusEarned,
      remainingBonus: eligibility.remainingCap,
      weekStart: plan.weekStart,
      currentWeeklyCompanyGBV: plan.companyGrossBusinessVolume,
      welcomeBonusPool: plan.totalWelcomeBonusPool,
      eligibleMembers: plan.eligibleMemberCount,
      thisWeeksShare: plan.equalMemberShare,
      status: statusDisplay,
      ineligibleReason: eligibility.ineligibleReason,
      history,
    };
  }

  /**
   * Get Welcome Bonus Governance & Live Engine Overview for Super Admin / Admin
   */
  static async getAdminDashboardSummary() {
    const config = await this.getConfig();
    const [plan, allSettlements, recentTransactions, unsettledWeeks] = await Promise.all([
      this.planWeek(this.currentWeek(), config),
      WelcomeBonusSettlement.find().sort({ periodStart: -1 }).select('-payouts'),
      WelcomeBonusTransaction.find().sort({ createdAt: -1 }).limit(100),
      this.getUnsettledWeeks(),
    ]);
    const completed = allSettlements.filter((s) => s.status === 'COMPLETED');
    const totalPaidOutLifetime = completed.reduce((sum, s) => sum + (s.totalAmountDistributed || 0), 0);
    const lastSettlement = completed[0] || null;

    return {
      activeRules: this.activeRulesView(config),
      weekStart: plan.weekStart,
      currentWeeklyCompanyGBV: plan.companyGrossBusinessVolume,
      welcomeBonusPool: plan.totalWelcomeBonusPool,
      eligibleMembersCount: plan.eligibleMemberCount,
      projectedShare: plan.equalMemberShare,
      totalPaidOutLifetime,
      totalSettlementsCount: completed.length,
      // Finished weeks waiting to be settled, newest first
      unsettledWeeks: unsettledWeeks.map((w) => ({
        weekStart: w.weekStart,
        weekEnd: BusinessDate.addDays(w.weekStart, 6),
      })),
      lastSettlement: lastSettlement
        ? {
            settlementId: lastSettlement.settlementId,
            date: formatDate(lastSettlement.processedAt),
            totalAmountDistributed: lastSettlement.totalAmountDistributed,
            eligibleMemberCount: lastSettlement.eligibleMemberCount,
            companyGrossBusinessVolume: lastSettlement.companyGrossBusinessVolume,
            bonusRate: lastSettlement.welcomeBonusRate,
            totalPool: lastSettlement.totalWelcomeBonusPool,
          }
        : null,
      recentSettlements: allSettlements.slice(0, 10).map((s) => ({
        settlementId: s.settlementId,
        weekStart: s.weekStart || BusinessDate.of(s.periodStart),
        date: formatDate(s.processedAt),
        companyGrossBusinessVolume: s.companyGrossBusinessVolume,
        welcomeBonusRate: s.welcomeBonusRate,
        totalWelcomeBonusPool: s.totalWelcomeBonusPool,
        eligibleMemberCount: s.eligibleMemberCount,
        equalMemberShare: s.equalMemberShare,
        totalAmountDistributed: s.totalAmountDistributed,
        status: s.status,
      })),
      eligibleMembersList: plan.payouts.map((p) => ({
        memberId: p.memberId,
        name: p.name,
        lifetimeBv: p.lifetimeBv,
        sponsoredCount: p.sponsoredCount,
        welcomeBonusCap: p.welcomeBonusCap,
        welcomeBonusEarned: p.welcomeBonusEarned,
        remainingCap: Math.max(0, p.welcomeBonusCap - p.welcomeBonusEarned),
      })),
      history: await this.mapTransactions(recentTransactions),
    };
  }
}
