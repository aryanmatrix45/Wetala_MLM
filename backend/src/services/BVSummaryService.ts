import { Member } from '../models/Member.model';
import { BVLedger } from '../models/BVLedger.model';
import { BVWallet } from '../models/BVWallet.model';
import { BinaryVolume } from '../models/BinaryVolume.model';
import { Purchase } from '../models/Purchase.model';
import { BV_SOURCE_TYPE, BV_WALLET, HTTP_STATUS } from '../config/constants';
import { BVWalletError, BVWalletService } from './BVWalletService';

/**
 * Member "Total Business Volume" for the dashboard:
 *
 *   Total BV = personal BV (earned from approved orders, paid in cash or BV)
 *            + BV Wallet balance (spendable: transfers received, welcome bonus, refunds, minus spending)
 *
 * Team (left/right) volume is reported separately and never added, so a purchase is not counted
 * again for every upline member.
 */
export class BVSummaryService {
  static async getSummary(memberIdInput: string) {
    const memberId = memberIdInput.trim().toUpperCase();
    // Catch up members whose wallet balance already qualifies (e.g. BV received before activation existed)
    await BVWalletService.activateFromWalletIfEligible(memberId);
    const member = await Member.findOne({ memberId }).select(
      'memberId name personalBv isBinaryActive activationSource welcomeBonusEarned welcomeBonusCap'
    );
    if (!member) throw new BVWalletError('Member not found.', HTTP_STATUS.NOT_FOUND);

    // The member's own BV ledger rows have no leg; rows with a leg are upline (team) credits
    const personalRows = await BVLedger.aggregate([
      { $match: { memberId, position: null } },
      { $group: { _id: '$sourceType', net: { $sum: { $subtract: ['$earnedBV', '$consumedBV'] } } } },
    ]);
    const net = (...types: string[]) => personalRows.filter((r) => types.includes(r._id)).reduce((sum, r) => sum + (r.net || 0), 0);
    const packageBV = net(BV_SOURCE_TYPE.JOINING_PACKAGE);
    const purchaseBV = net(BV_SOURCE_TYPE.REPURCHASE, BV_SOURCE_TYPE.RETAIL);
    const refundsBV = net(BV_SOURCE_TYPE.REVERSAL, BV_SOURCE_TYPE.ADJUSTMENT);
    const personalBV = member.personalBv || 0;
    // BV set directly on the member without a ledger row (e.g. the root member's opening balance)
    const otherBV = personalBV - (packageBV + purchaseBV + refundsBV);

    const [wallet, volume, pendingOrders] = await Promise.all([
      BVWallet.findOne({ ownerId: memberId }).lean(),
      BinaryVolume.findOne({ memberId }).lean(),
      Purchase.aggregate([
        { $match: { memberId, paymentMethod: 'BV_WALLET', approvalStage: 'PAYMENT_SUBMITTED' } },
        { $group: { _id: null, count: { $sum: 1 }, bv: { $sum: '$bvAmount' } } },
      ]),
    ]);
    const walletBV = wallet?.availableBV || 0;
    const totalBV = personalBV + walletBV;

    return {
      memberId,
      name: member.name,
      totalBV,
      personal: {
        total: personalBV,
        package: packageBV,
        purchases: purchaseBV,
        refunds: refundsBV,
        other: otherBV,
      },
      wallet: {
        available: walletBV,
        received: wallet?.totalReceived || 0,
        sent: wallet?.totalSent || 0,
        welcomeBonus: wallet?.totalWelcomeBonus || 0,
        spentOnOrders: wallet?.totalSpent || 0,
        pendingOrders: pendingOrders[0]?.count || 0,
        pendingOrderBV: pendingOrders[0]?.bv || 0,
      },
      team: {
        left: volume?.leftTotalBV || 0,
        right: volume?.rightTotalBV || 0,
      },
      welcomeBonus: {
        earned: member.welcomeBonusEarned || 0,
        cap: member.welcomeBonusCap || 0,
      },
      binary: {
        isActive: Boolean(member.isBinaryActive),
        activationSource: member.activationSource || '',
        activationBV: BV_WALLET.ACTIVATION_BV,
      },
    };
  }
}

export default BVSummaryService;
