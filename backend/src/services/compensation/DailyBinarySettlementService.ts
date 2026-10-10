import { Member } from '../../models/Member.model';
import { CompensationEngine } from './CompensationEngine';
import { BinaryBonusService, BinaryIncomeCalculationResult } from './BinaryBonusService';
import { AuditService } from '../AuditService';

export interface DailySettlementSummary {
  date: string;
  totalMembersEvaluated: number;
  qualifiedMembersCount: number;
  payoutsGeneratedCount: number;
  totalGrossIncome: number;
  totalPayableIncome: number;
  totalExcessCapped: number;
  details: Array<{
    memberId: string;
    memberName: string;
    payoutCount: number;
    cyclesCompleted: number;
    grossIncome: number;
    payableIncome: number;
    excessAmount: number;
  }>;
}

export class DailyBinarySettlementService {
  private static timerHandle: NodeJS.Timeout | null = null;

  /**
   * Run daily binary calculation for every active member in the system
   */
  static async executeDailySettlement(targetDate: Date = new Date(), triggeredBy: string = 'SYSTEM_CRON'): Promise<DailySettlementSummary> {
    const rules = await CompensationEngine.getActiveRules();
    const activeMembers = await Member.find({
      isActive: true,
      status: { $nin: ['blocked', 'rejected'] },
    }).select('memberId name email role dailyCapping');

    const summary: DailySettlementSummary = {
      date: targetDate.toISOString().split('T')[0],
      totalMembersEvaluated: activeMembers.length,
      qualifiedMembersCount: 0,
      payoutsGeneratedCount: 0,
      totalGrossIncome: 0,
      totalPayableIncome: 0,
      totalExcessCapped: 0,
      details: [],
    };

    console.log(`[DailyBinarySettlement] Starting settlement for ${summary.date} (${activeMembers.length} members)...`);

    for (const member of activeMembers) {
      try {
        const result: BinaryIncomeCalculationResult = await BinaryBonusService.calculateBinaryIncomeForMember(
          member.memberId,
          rules,
          targetDate,
          `DAILY-SETTLE-${summary.date}`
        );

        if (result.isSponsorQualified) {
          summary.qualifiedMembersCount++;
        }

        if (result.totalGeneratedIncome > 0) {
          summary.payoutsGeneratedCount += result.cyclesCount;
          summary.totalGrossIncome += result.totalGeneratedIncome;
          summary.totalPayableIncome += result.payableIncome;
          summary.totalExcessCapped += result.excessAmount;

          summary.details.push({
            memberId: member.memberId,
            memberName: member.name,
            payoutCount: result.payoutCount,
            cyclesCompleted: result.cyclesCount,
            grossIncome: result.totalGeneratedIncome,
            payableIncome: result.payableIncome,
            excessAmount: result.excessAmount,
          });
        }
      } catch (err: any) {
        console.error(`[DailyBinarySettlement] Error processing member ${member.memberId}:`, err.message);
      }
    }

    console.log(
      `[DailyBinarySettlement] Completed for ${summary.date}: ` +
      `${summary.details.length} earners, ₹${summary.totalPayableIncome} payable, ₹${summary.totalExcessCapped} capped.`
    );

    // Audit log
    await AuditService.log({
      action: 'DAILY_BINARY_SETTLEMENT',
      entity: 'COMPENSATION_RULE',
      entityId: rules._id.toString(),
      performedBy: triggeredBy,
      newValues: {
        date: summary.date,
        totalEvaluated: summary.totalMembersEvaluated,
        earnersCount: summary.details.length,
        totalPayable: summary.totalPayableIncome,
        totalExcess: summary.totalExcessCapped,
      },
    });

    return summary;
  }

  /**
   * Schedule the automatic midnight daily settlement job (runs at 00:00 every day)
   */
  static startDailyScheduler(): void {
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
    }

    const scheduleNextRun = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setDate(now.getDate() + 1);
      nextMidnight.setHours(0, 0, 5, 0); // 00:00:05 next day

      const delayMs = nextMidnight.getTime() - now.getTime();
      console.log(`[DailyBinarySettlement] Next daily settlement scheduled in ${(delayMs / 1000 / 60).toFixed(1)} minutes (at ${nextMidnight.toISOString()})`);

      this.timerHandle = setTimeout(async () => {
        try {
          await this.executeDailySettlement(new Date(), 'SCHEDULED_MIDNIGHT_CRON');
        } catch (e: any) {
          console.error('[DailyBinarySettlement] Error during scheduled settlement:', e.message);
        } finally {
          scheduleNextRun();
        }
      }, delayMs);
    };

    scheduleNextRun();
  }

  static stopDailyScheduler(): void {
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
  }
}
