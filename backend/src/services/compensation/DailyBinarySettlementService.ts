import crypto from 'crypto';
import mongoose from 'mongoose';
import { Member } from '../../models/Member.model';
import { BinaryVolume } from '../../models/BinaryVolume.model';
import { BVLedger } from '../../models/BVLedger.model';
import { CommissionLedger } from '../../models/CommissionLedger.model';
import { WalletTransaction } from '../../models/WalletTransaction.model';
import { AdminNotification } from '../../models/AdminNotification.model';
import { BinaryDailyClosing, IBinaryDailyClosing } from '../../models/BinaryDailyClosing.model';
import { BinarySettlementRun, IBinarySettlementRun, IBinarySettlementTotals } from '../../models/BinarySettlementRun.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { CompensationEngine } from './CompensationEngine';
import { BinaryBonusService } from './BinaryBonusService';
import { CapService } from './CapService';
import { applyDailyCap, computeMatches, matchRulesFrom, BinaryMatchState } from './BinaryMatchingEngine';
import { WalletService } from '../WalletService';
import { AuditService } from '../AuditService';
import { DecimalUtil } from '../../utils/decimal';
import { BusinessDate } from '../../utils/businessDate';
import {
  BINARY_POSITION,
  BINARY_SETTLEMENT,
  BV_SETTLEMENT_STATUS,
  BV_SOURCE_TYPE,
  COMMISSION_TYPE,
} from '../../config/constants';

export class BinarySettlementError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'BinarySettlementError';
    this.statusCode = statusCode;
  }
}

const randomCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();

/**
 * Daily binary settlement.
 *
 * After an IST business day ends, every member with unsettled team BV or unmatched carry forward
 * gets one BinaryDailyClosing for that day:
 *   available = carry forward + that day's new team BV (net of reversals)
 *   matches   = computeMatches(available)            (only when binary active and sponsor qualified)
 *   credited  = min(matches x ₹250, daily cap)       (the rest is flushed, its BV is still used)
 * The closing, the BinaryVolume carry forward, the settled ledger rows and the commission are
 * written in one transaction; the wallet credit follows and is retried until it succeeds.
 * A member who does not qualify keeps all BV as carry forward; nothing is flushed.
 */
export class DailyBinarySettlementService {
  private static timerHandle: NodeJS.Timeout | null = null;

  /** Closes one business day for one member. Returns the existing closing if the day is already closed. */
  static async settleMember(
    memberId: string,
    businessDate: string,
    rules: ICompensationRule
  ): Promise<IBinaryDailyClosing | null> {
    const existing = await BinaryDailyClosing.findOne({ memberId, businessDate });
    if (existing) return existing;

    const member = await Member.findOne({ memberId });
    if (!member) return null;

    const [vol, pending] = await Promise.all([
      BinaryVolume.findOne({ memberId }),
      BinaryBonusService.getPendingVolume(memberId, businessDate),
    ]);
    const opening = BinaryBonusService.snapshotOf(vol);
    const available: BinaryMatchState = {
      ...opening,
      left: Math.max(0, opening.left + pending.left),
      right: Math.max(0, opening.right + pending.right),
    };

    const matchRules = matchRulesFrom(rules);
    const possible = computeMatches(available, matchRules);

    // Only look up qualification when there is something to pay
    let isSelfActive = Boolean(member.isBinaryActive);
    let isSponsorQualified = false;
    let result = null as ReturnType<typeof computeMatches> | null;
    if (possible.matches > 0 && rules.binaryBonus?.isEnabled !== false) {
      const qualification = await BinaryBonusService.getQualification(member);
      isSelfActive = qualification.isSelfActive;
      isSponsorQualified = qualification.isSponsorQualified;
      if (isSelfActive && isSponsorQualified) result = possible;
    }

    // Nothing arrived and nothing can be paid: no closing for this day
    if (pending.rowIds.length === 0 && !result) return null;

    const closingState = result ? result.state : available;
    const generatedAmount = result?.generatedAmount || 0;
    const dailyCap = generatedAmount > 0 ? await CapService.getDailyCap(memberId) : 0;
    const { creditedAmount, flushedAmount } = applyDailyCap(generatedAmount, dailyCap);
    const status: IBinaryDailyClosing['status'] = result ? 'PAID' : possible.matches > 0 ? 'NOT_QUALIFIED' : 'NO_MATCH';
    const closingId = `BINC-${businessDate.replace(/-/g, '')}-${memberId}-${randomCode()}`;
    const commissionLedgerId = creditedAmount > 0 ? `COMM-BIN-${businessDate.replace(/-/g, '')}-${memberId}-${randomCode()}` : undefined;
    const userId = member._id.toString();

    let closing: IBinaryDailyClosing | null = null;
    try {
      closing = (await mongoose.connection.transaction(async (session) => {
        const [created] = await BinaryDailyClosing.create(
          [
            {
              closingId,
              memberId,
              userId,
              memberName: member.name,
              businessDate,
              opening,
              newLeftBV: pending.left,
              newRightBV: pending.right,
              closing: closingState,
              isSelfActive,
              isSponsorQualified,
              matches: result?.matches || 0,
              leftBVUsed: result?.leftBVUsed || 0,
              rightBVUsed: result?.rightBVUsed || 0,
              cycles: result?.cycles || [],
              ratePerMatch: matchRules.ratePerMatch,
              generatedAmount,
              dailyCap,
              creditedAmount,
              flushedAmount,
              commissionLedgerId,
              walletCredited: creditedAmount === 0,
              status,
            },
          ],
          { session }
        );

        // Carry forward moves only if nobody else changed it since we read it
        const volFilter: Record<string, unknown> = vol
          ? { memberId, leftAvailableBV: vol.leftAvailableBV, rightAvailableBV: vol.rightAvailableBV, payoutCount: vol.payoutCount }
          : { memberId };
        const volUpdate = {
          $set: {
            userId,
            leftAvailableBV: closingState.left,
            rightAvailableBV: closingState.right,
            leftCarryForwardBV: closingState.left,
            rightCarryForwardBV: closingState.right,
            reservedBV: closingState.reservedBV,
            reservedSide: closingState.reservedSide,
            payoutCount: closingState.payoutCount,
            lastSettledDate: businessDate,
            ...(result ? { lastMatchedAt: new Date() } : {}),
            ...(result?.cycles.some((c) => c.stage === 'FIRST_PAYOUT') && !vol?.firstPayoutAt ? { firstPayoutAt: new Date() } : {}),
            ...(result?.cycles.some((c) => c.stage === 'SECOND_PAYOUT') && !vol?.secondPayoutAt ? { secondPayoutAt: new Date() } : {}),
          },
          $inc: {
            matchedTotalBV: (result?.leftBVUsed || 0) + (result?.rightBVUsed || 0),
            consumedTotalBV: (result?.leftBVUsed || 0) + (result?.rightBVUsed || 0),
          },
        };
        const updatedVol = await BinaryVolume.findOneAndUpdate(volFilter, volUpdate, { session, upsert: !vol, returnDocument: 'after' });
        if (!updatedVol) throw new Error('Binary volume changed during settlement; retry.');

        if (pending.rowIds.length > 0) {
          await BVLedger.updateMany(
            { _id: { $in: pending.rowIds }, settlementStatus: BV_SETTLEMENT_STATUS.PENDING },
            { $set: { settlementStatus: BV_SETTLEMENT_STATUS.SETTLED, settledInDate: businessDate } },
            { session }
          );
        }

        if (result) {
          // One MATCHED row per leg for the day: BV used, kept for the 2nd payout, and what carries forward
          const flushNote = flushedAmount > 0 ? `; ₹${flushedAmount} flushed above the ₹${dailyCap} daily cap` : '';
          const legRows = (['LEFT', 'RIGHT'] as const).map((leg) => {
            const isLeft = leg === 'LEFT';
            const used = isLeft ? result!.leftBVUsed : result!.rightBVUsed;
            const before = isLeft ? available.left : available.right;
            const after = isLeft ? closingState.left : closingState.right;
            const keptHere = closingState.reservedSide === leg ? closingState.reservedBV : 0;
            return {
              ledgerId: `BV-MATCH-${businessDate.replace(/-/g, '')}-${memberId}-${leg[0]}-${randomCode()}`,
              userId,
              memberId,
              sourceType: BV_SOURCE_TYPE.MATCHED,
              referenceId: closingId,
              position: isLeft ? BINARY_POSITION.LEFT : BINARY_POSITION.RIGHT,
              openingBV: before,
              earnedBV: 0,
              consumedBV: used,
              reservedBV: keptHere,
              carriedForwardBV: after,
              flushedBV: 0,
              closingBV: after,
              payoutSequence: closingState.payoutCount,
              businessDate,
              description: `Binary closing ${businessDate}: ${result!.matches} match(es), ${used} BV used on ${leg} leg${keptHere ? `, ${keptHere} BV kept for the 2nd payout` : ''}${flushNote}`,
              isImmutable: true,
            };
          });
          await BVLedger.create(legRows, { session, ordered: true });

          await Member.updateOne({ memberId }, { $set: { matchedPairs: closingState.payoutCount } }, { session });
        }

        if (commissionLedgerId) {
          const paise = DecimalUtil.toPaise(creditedAmount);
          await CommissionLedger.create(
            [
              {
                ledgerId: commissionLedgerId,
                userId,
                memberId,
                type: COMMISSION_TYPE.BINARY_BONUS,
                sourceEventId: `BINARY-DAILY-${businessDate}`,
                grossAmount: creditedAmount,
                grossAmountInPaise: paise,
                tdsDeduction: 0,
                tdsDeductionInPaise: 0,
                adminFee: 0,
                adminFeeInPaise: 0,
                payableAmount: creditedAmount,
                payableAmountInPaise: paise,
                status: 'APPROVED',
                calculationDetails: {
                  calculationBase: 'DAILY_BINARY_CLOSING',
                  businessDate,
                  closingId,
                  cycles: result?.cycles || [],
                  cyclesCount: result?.matches || 0,
                  rateApplied: matchRules.ratePerMatch,
                  totalGeneratedIncome: generatedAmount,
                  dailyCapAmount: dailyCap,
                  excessAmount: flushedAmount,
                  excessPolicyApplied: 'FLUSH',
                  payoutCount: closingState.payoutCount,
                  leftAvailableBV: closingState.left,
                  rightAvailableBV: closingState.right,
                  reservedBV: closingState.reservedBV,
                  reservedSide: closingState.reservedSide,
                  notes: `Binary income for ${businessDate}: ${result?.matches || 0} match(es) x ₹${matchRules.ratePerMatch} = ₹${generatedAmount}. Credited ₹${creditedAmount}${flushedAmount > 0 ? `, flushed ₹${flushedAmount} above the daily cap` : ''}.`,
                },
                isReversed: false,
              },
            ],
            { session }
          );
        }

        return created;
      })) as IBinaryDailyClosing;
    } catch (error: any) {
      // Another worker closed the same member-day first
      if (error?.code === 11000 && error?.keyPattern?.memberId) {
        return BinaryDailyClosing.findOne({ memberId, businessDate });
      }
      throw error;
    }

    if (closing && creditedAmount > 0) {
      await this.creditWallet(closing);
    }
    if (closing && flushedAmount > 0) {
      await this.notifyCapExceeded(closing);
    }
    return closing;
  }

  /** Pays a closing's credited amount into the wallet, once. Safe to call again after a failure. */
  static async creditWallet(closing: IBinaryDailyClosing): Promise<void> {
    if (closing.walletCredited || closing.creditedAmount <= 0 || !closing.commissionLedgerId) return;
    try {
      const alreadyPaid = await WalletTransaction.exists({ referenceId: closing.commissionLedgerId, memberId: closing.memberId });
      if (!alreadyPaid) {
        await WalletService.creditCommission(
          closing.memberId,
          closing.creditedAmount,
          closing.commissionLedgerId,
          `Binary income for ${closing.businessDate}: ${closing.matches} match(es)` +
            (closing.flushedAmount > 0 ? ` (₹${closing.flushedAmount} flushed above the daily cap)` : '')
        );
      }
      await BinaryDailyClosing.updateOne({ _id: closing._id }, { $set: { walletCredited: true } });
      closing.walletCredited = true;
    } catch (error: any) {
      console.error(`[DailyBinarySettlement] Wallet credit failed for ${closing.memberId} on ${closing.businessDate}:`, error.message);
    }
  }

  private static async notifyCapExceeded(closing: IBinaryDailyClosing): Promise<void> {
    try {
      await AdminNotification.create({
        notificationId: `NOTIF-CAP-${Date.now()}-${randomCode()}`,
        type: 'SYSTEM_ALERT',
        title: 'Capping Limits Exceeded',
        message: `On ${closing.businessDate} you earned ₹${closing.generatedAmount.toLocaleString('en-IN')} in binary income, above your daily cap of ₹${closing.dailyCap.toLocaleString('en-IN')}. ₹${closing.flushedAmount.toLocaleString('en-IN')} was flushed. Upgrade your package to raise your cap.`,
        recipientRole: 'member',
        recipientId: closing.memberId,
        senderId: 'SYSTEM',
        senderName: 'Binary Engine',
        amount: closing.flushedAmount,
        isRead: false,
        metadata: {
          businessDate: closing.businessDate,
          perDayIncome: closing.generatedAmount,
          dailyCap: closing.dailyCap,
          excessAmount: closing.flushedAmount,
          action: 'UPGRADE_PACKAGE',
        },
      });
    } catch (error: any) {
      console.error('[DailyBinarySettlement] Failed to create capping notification:', error.message);
    }
  }

  /** Members that may need a closing for the date: unsettled team BV, or unmatched carry forward */
  private static async membersToEvaluate(businessDate: string): Promise<string[]> {
    const [withPending, withCarry] = await Promise.all([
      BVLedger.distinct('memberId', {
        settlementStatus: BV_SETTLEMENT_STATUS.PENDING,
        businessDate: { $lte: businessDate },
      }),
      BinaryVolume.distinct('memberId', {
        $or: [{ leftAvailableBV: { $gt: 0 } }, { rightAvailableBV: { $gt: 0 } }, { reservedBV: { $gt: 0 } }],
      }),
    ]);
    return Array.from(new Set<string>([...withPending, ...withCarry])).sort();
  }

  static async summarizeDate(businessDate: string): Promise<IBinarySettlementTotals> {
    const [row] = await BinaryDailyClosing.aggregate([
      { $match: { businessDate } },
      {
        $group: {
          _id: null,
          closings: { $sum: 1 },
          qualifiedMembers: { $sum: { $cond: ['$isSponsorQualified', 1, 0] } },
          earners: { $sum: { $cond: [{ $gt: ['$creditedAmount', 0] }, 1, 0] } },
          matches: { $sum: '$matches' },
          newLeftBV: { $sum: '$newLeftBV' },
          newRightBV: { $sum: '$newRightBV' },
          generatedAmount: { $sum: '$generatedAmount' },
          creditedAmount: { $sum: '$creditedAmount' },
          flushedAmount: { $sum: '$flushedAmount' },
        },
      },
    ]);
    return {
      membersEvaluated: 0,
      closings: row?.closings || 0,
      qualifiedMembers: row?.qualifiedMembers || 0,
      earners: row?.earners || 0,
      matches: row?.matches || 0,
      newLeftBV: row?.newLeftBV || 0,
      newRightBV: row?.newRightBV || 0,
      generatedAmount: row?.generatedAmount || 0,
      creditedAmount: row?.creditedAmount || 0,
      flushedAmount: row?.flushedAmount || 0,
    };
  }

  /** Takes the run lock for a date. Returns null if another process is running it right now. */
  private static async acquireRun(businessDate: string, triggeredBy: string): Promise<IBinarySettlementRun | null> {
    const now = new Date();
    try {
      return await BinarySettlementRun.findOneAndUpdate(
        {
          businessDate,
          $or: [{ status: { $ne: 'RUNNING' } }, { heartbeatAt: { $lt: new Date(now.getTime() - BINARY_SETTLEMENT.STALE_RUN_MS) } }],
        },
        {
          $set: { status: 'RUNNING', triggeredBy, startedAt: now, heartbeatAt: now, failures: [], error: '' },
          $inc: { attempts: 1 },
          $setOnInsert: { businessDate },
        },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (error: any) {
      if (error?.code === 11000) return null; // a fresh RUNNING lock is held elsewhere
      throw error;
    }
  }

  /**
   * Settles one finished IST business day for every member. Idempotent: members already closed for
   * the date are skipped, and unpaid wallet credits from earlier attempts are retried.
   */
  static async executeDailySettlement(businessDate: string, triggeredBy: string = 'SYSTEM_CRON'): Promise<IBinarySettlementRun> {
    if (!BusinessDate.isValid(businessDate)) {
      throw new BinarySettlementError('Date must be in YYYY-MM-DD format.');
    }
    if (businessDate >= BusinessDate.today()) {
      throw new BinarySettlementError(`Only finished days can be settled. ${businessDate} has not ended yet (IST).`);
    }

    const run = await this.acquireRun(businessDate, triggeredBy);
    if (!run) {
      throw new BinarySettlementError(`Settlement for ${businessDate} is already running.`, 409);
    }

    const failures: Array<{ memberId: string; message: string }> = [];
    try {
      const rules = await CompensationEngine.getActiveRules();
      const memberIds = await this.membersToEvaluate(businessDate);
      console.log(`[DailyBinarySettlement] Settling ${businessDate}: ${memberIds.length} member(s) to evaluate (${triggeredBy}).`);

      for (let i = 0; i < memberIds.length; i++) {
        try {
          await this.settleMember(memberIds[i], businessDate, rules);
        } catch (error: any) {
          failures.push({ memberId: memberIds[i], message: error.message || String(error) });
          console.error(`[DailyBinarySettlement] ${memberIds[i]} failed for ${businessDate}:`, error.message);
        }
        if (i % 25 === 24) {
          await BinarySettlementRun.updateOne({ _id: run._id }, { $set: { heartbeatAt: new Date() } });
        }
      }

      // Retry wallet credits that did not go through on an earlier attempt
      const unpaid = await BinaryDailyClosing.find({ businessDate, walletCredited: false, creditedAmount: { $gt: 0 } });
      for (const closing of unpaid) await this.creditWallet(closing);

      const totals = { ...(await this.summarizeDate(businessDate)), membersEvaluated: memberIds.length };
      const finished = await BinarySettlementRun.findOneAndUpdate(
        { _id: run._id },
        { $set: { status: 'COMPLETED', completedAt: new Date(), heartbeatAt: new Date(), totals, failures } },
        { returnDocument: 'after' }
      );

      console.log(
        `[DailyBinarySettlement] ${businessDate} done: ${totals.earners} earner(s), ₹${totals.creditedAmount} credited, ` +
          `₹${totals.flushedAmount} flushed, ${failures.length} failure(s).`
      );
      try {
        await AuditService.log({
          action: 'DAILY_BINARY_SETTLEMENT',
          entity: 'COMPENSATION_RULE',
          entityId: rules._id.toString(),
          performedBy: triggeredBy,
          newValues: { businessDate, ...totals, failures: failures.length },
        });
      } catch (error: any) {
        console.error('[DailyBinarySettlement] Failed to write audit log:', error.message);
      }
      return finished!;
    } catch (error: any) {
      await BinarySettlementRun.updateOne(
        { _id: run._id },
        { $set: { status: 'FAILED', error: error.message || String(error), failures, heartbeatAt: new Date() } }
      );
      throw error;
    }
  }

  /** Settles every finished day since the last completed run (up to MAX_CATCH_UP_DAYS back), oldest first. */
  static async catchUp(triggeredBy: string): Promise<void> {
    const yesterday = BusinessDate.addDays(BusinessDate.today(), -1);
    const earliest = BusinessDate.addDays(yesterday, -(BINARY_SETTLEMENT.MAX_CATCH_UP_DAYS - 1));
    const lastCompleted = await BinarySettlementRun.findOne({ status: 'COMPLETED' }).sort({ businessDate: -1 });

    let date = lastCompleted ? BusinessDate.addDays(lastCompleted.businessDate, 1) : yesterday;
    if (date < earliest) date = earliest;

    for (; date <= yesterday; date = BusinessDate.addDays(date, 1)) {
      const existing = await BinarySettlementRun.findOne({ businessDate: date });
      if (existing?.status === 'COMPLETED') continue;
      try {
        await this.executeDailySettlement(date, triggeredBy);
      } catch (error: any) {
        console.error(`[DailyBinarySettlement] ${date}: ${error.message}`);
        // Days must close in order: stop here and try again on the next schedule
        if (!(error instanceof BinarySettlementError)) return;
      }
    }
  }

  /**
   * Settles missed days on startup, then the previous day a few minutes after every IST midnight.
   * Safe under PM2 cluster mode: each date's run lock lets only one worker settle it.
   */
  static startDailyScheduler(): void {
    this.stopDailyScheduler();

    const scheduleNextRun = () => {
      const delayMs = BusinessDate.msUntilNextDay() + BINARY_SETTLEMENT.RUN_DELAY_MS;
      console.log(`[DailyBinarySettlement] Next settlement in ${(delayMs / 60000).toFixed(1)} minutes.`);
      this.timerHandle = setTimeout(async () => {
        try {
          await this.catchUp('SCHEDULED_MIDNIGHT_CRON');
        } catch (error: any) {
          console.error('[DailyBinarySettlement] Scheduled settlement error:', error.message);
        } finally {
          scheduleNextRun();
        }
      }, delayMs);
    };

    this.catchUp('STARTUP_CATCH_UP').catch((error) =>
      console.error('[DailyBinarySettlement] Startup catch-up error:', error.message)
    );
    scheduleNextRun();
  }

  static stopDailyScheduler(): void {
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
  }
}
