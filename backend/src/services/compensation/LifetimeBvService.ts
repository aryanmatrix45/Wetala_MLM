import { Member } from '../../models/Member.model';
import { BVLedger } from '../../models/BVLedger.model';
import { BVTransaction } from '../../models/BVTransaction.model';
import { Purchase } from '../../models/Purchase.model';
import { BV_OWNER_TYPE, BV_TXN_STATUS, BV_TXN_TYPE } from '../../config/constants';

/**
 * Lifetime BV for the welcome bonus: all BV that ever came into a member's account, counted once.
 *
 *   + approved package / product orders paid by bank / UPI (the member's personal BV ledger credits)
 *   + BV transferred in by the Super Admin or another member
 *   + BV put on the member directly without a ledger row (e.g. the root member's opening package)
 *   - orders that were refunded and transfers the Super Admin reversed
 *
 * Orders paid from the BV Wallet add nothing: that BV was already counted when it arrived. Welcome
 * bonus credits add nothing, so the bonus never raises its own cap. Spending BV, transferring it out
 * and the binary activation lock never lower it.
 *
 * Worked out from the ledgers rather than stored, so it can be taken as of any moment (a settlement
 * week's end) and needs no backfill.
 */
export class LifetimeBvService {
  static async compute(options: { asOf?: Date; memberIds?: string[] } = {}): Promise<Map<string, number>> {
    const asOf = options.asOf || new Date();
    const memberFilter = options.memberIds ? { $in: options.memberIds } : { $exists: true };
    const amount = { $subtract: [{ $ifNull: ['$earnedBV', 0] }, { $ifNull: ['$consumedBV', 0] }] };

    const [ledgerRows, transferRows, members] = await Promise.all([
      // The member's own ledger rows have no leg: order credits and their refund reversals
      BVLedger.aggregate([
        { $match: { memberId: memberFilter, position: null } },
        { $lookup: { from: Purchase.collection.name, localField: 'referenceId', foreignField: 'purchaseId', as: 'order' } },
        { $addFields: { paidWithBv: { $in: ['BV_WALLET', '$order.paymentMethod'] } } },
        {
          $group: {
            _id: '$memberId',
            // Everything on the ledger, to find personal BV that was set without a ledger row
            recorded: { $sum: amount },
            counted: {
              $sum: {
                $cond: [{ $and: [{ $not: ['$paidWithBv'] }, { $lte: ['$createdAt', asOf] }] }, amount, 0],
              },
            },
          },
        },
      ]),
      // A reversed transfer is no longer COMPLETED, so it drops out here
      BVTransaction.aggregate([
        {
          $match: {
            type: BV_TXN_TYPE.TRANSFER,
            status: BV_TXN_STATUS.COMPLETED,
            recipientType: BV_OWNER_TYPE.MEMBER,
            recipientId: memberFilter,
            createdAt: { $lte: asOf },
          },
        },
        { $group: { _id: '$recipientId', total: { $sum: '$amount' } } },
      ]),
      Member.find({ memberId: memberFilter, createdAt: { $lte: asOf } }).select('memberId personalBv').lean(),
    ]);

    const ledgerByMember = new Map(ledgerRows.map((r) => [r._id as string, r]));
    const transfersByMember = new Map(transferRows.map((r) => [r._id as string, r.total as number]));

    const result = new Map<string, number>();
    for (const m of members) {
      const ledger = ledgerByMember.get(m.memberId);
      const unrecorded = Math.max(0, (m.personalBv || 0) - (ledger?.recorded || 0));
      const total = (ledger?.counted || 0) + (transfersByMember.get(m.memberId) || 0) + unrecorded;
      result.set(m.memberId, Math.max(0, total));
    }
    return result;
  }

  static async forMember(memberId: string, asOf?: Date): Promise<number> {
    const id = memberId.toUpperCase();
    const result = await this.compute({ asOf, memberIds: [id] });
    return result.get(id) || 0;
  }
}

export default LifetimeBvService;
