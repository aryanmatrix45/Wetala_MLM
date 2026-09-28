import { BinaryVolume } from '../../models/BinaryVolume.model';
import { Member } from '../../models/Member.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { BVLedger } from '../../models/BVLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { CapService } from './CapService';
import { WalletService } from '../WalletService';
import { DecimalUtil } from '../../utils/decimal';
import {
  COMMISSION_TYPE,
  BV_SOURCE_TYPE,
  VOLUME_CARRY_FORWARD_MODE,
} from '../../config/constants';

export class BinaryBonusService {
  /**
   * Process binary matching and commission for a specific member
   */
  static async processMemberBinaryBonus(
    memberId: string,
    rules: ICompensationRule,
    sourceEventId: string,
    sourcePurchaseId?: string
  ): Promise<ICommissionLedger | null> {
    if (!rules.binaryBonus.isEnabled) {
      return null;
    }

    const member = await Member.findOne({ memberId });
    if (!member || !member.isActive || member.status === 'blocked') {
      return null;
    }

    const vol = await BinaryVolume.findOne({ memberId });
    if (!vol) {
      return null;
    }

    const leftAvailable = vol.leftAvailableBV || 0;
    const rightAvailable = vol.rightAvailableBV || 0;

    // Minimum matching: need volume on both sides
    const matchedBV = DecimalUtil.min(leftAvailable, rightAvailable);
    if (matchedBV <= 0) {
      return null;
    }

    // Determine binary rate: standard (20%) or special (25%)
    const binaryRate = rules.binaryBonus.isSpecialRateEnabled
      ? rules.binaryBonus.specialBinaryRate
      : rules.binaryBonus.standardBinaryRate;

    // Raw commission = matchedBV * rate
    // Note: If rate is 0.20, matchedBV of 1000 => ₹200
    const rawCommission = DecimalUtil.multiplyRate(matchedBV, binaryRate);

    // Apply daily cap via CapService
    const capResult = await CapService.calculateCappedCommission(
      memberId,
      rawCommission,
      rules,
      new Date()
    );

    // If payable amount is 0 due to capping, we still match or handle volume as configured
    // Update available volume and matching
    vol.leftAvailableBV = DecimalUtil.sub(vol.leftAvailableBV, matchedBV);
    vol.rightAvailableBV = DecimalUtil.sub(vol.rightAvailableBV, matchedBV);
    vol.matchedTotalBV = DecimalUtil.add(vol.matchedTotalBV, matchedBV);
    vol.lastMatchedAt = new Date();

    // Volume carry forward vs flush handling
    if (rules.binaryBonus.volumeCarryForwardMode === VOLUME_CARRY_FORWARD_MODE.FLUSH) {
      vol.leftAvailableBV = 0;
      vol.rightAvailableBV = 0;
    }

    await vol.save();

    // Record BV Ledger entry for consumed/matched volume
    await BVLedger.create({
      ledgerId: `BV-MATCH-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      userId: member._id.toString(),
      memberId,
      sourceType: BV_SOURCE_TYPE.MATCHED,
      referenceId: sourceEventId,
      openingBV: leftAvailable + rightAvailable,
      earnedBV: 0,
      consumedBV: matchedBV * 2, // both sides
      carriedForwardBV: vol.leftAvailableBV + vol.rightAvailableBV,
      flushedBV: rules.binaryBonus.volumeCarryForwardMode === VOLUME_CARRY_FORWARD_MODE.FLUSH ? (leftAvailable + rightAvailable - matchedBV * 2) : 0,
      closingBV: vol.leftAvailableBV + vol.rightAvailableBV,
      description: `Binary matching: ${matchedBV} BV matched at ${(binaryRate * 100).toFixed(0)}% rate`,
      isImmutable: true,
    });

    if (capResult.payableAmount <= 0) {
      return null;
    }

    // Calculate statutory deductions (e.g. TDS 5%, Admin fee 5%)
    const tdsDeduction = DecimalUtil.multiplyPercent(capResult.payableAmount, 5);
    const adminFee = DecimalUtil.multiplyPercent(capResult.payableAmount, 5);
    const netPayable = DecimalUtil.sub(capResult.payableAmount, DecimalUtil.add(tdsDeduction, adminFee));

    const ledgerId = `COMM-BIN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Create auditable commission ledger entry
    const commission = await CommissionLedger.create({
      ledgerId,
      userId: member._id.toString(),
      memberId,
      type: COMMISSION_TYPE.BINARY_BONUS,
      sourceEventId,
      sourcePurchaseId,
      grossAmount: capResult.rawAmount,
      grossAmountInPaise: DecimalUtil.toPaise(capResult.rawAmount),
      tdsDeduction,
      tdsDeductionInPaise: DecimalUtil.toPaise(tdsDeduction),
      adminFee,
      adminFeeInPaise: DecimalUtil.toPaise(adminFee),
      payableAmount: netPayable,
      payableAmountInPaise: DecimalUtil.toPaise(netPayable),
      status: 'APPROVED',
      calculationDetails: {
        sourcePurchaseId,
        sourceEventId,
        calculationBase: rules.binaryBonus.calculationBase,
        baseBV: matchedBV,
        rateApplied: binaryRate,
        percentageApplied: binaryRate * 100,
        leftVolume: leftAvailable,
        rightVolume: rightAvailable,
        matchedVolume: matchedBV,
        rawCommission: capResult.rawAmount,
        dailyCapAmount: capResult.capAmount,
        alreadyEarnedToday: capResult.alreadyEarnedToday,
        dailyCapRemaining: capResult.remainingCap,
        excessAmount: capResult.excessAmount,
        excessPolicyApplied: capResult.excessPolicy,
        notes: `Binary Matching: ${matchedBV} BV @ ${(binaryRate * 100)}%. Daily cap: ₹${capResult.capAmount}.`,
      },
      isReversed: false,
    });

    // Credit to member wallet with transaction reference
    await WalletService.creditCommission(
      memberId,
      netPayable,
      ledgerId,
      `Binary Matching Bonus (${matchedBV} BV @ ${(binaryRate * 100)}%)`
    );

    return commission;
  }
}
