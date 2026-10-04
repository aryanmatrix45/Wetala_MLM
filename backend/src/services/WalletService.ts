import { Wallet, IWallet } from '../models/Wallet.model';
import { WalletTransaction } from '../models/WalletTransaction.model';
import { Member } from '../models/Member.model';
import { DecimalUtil } from '../utils/decimal';

export class WalletService {
  /**
   * Get or create wallet for a member
   */
  static async getOrCreateWallet(memberId: string, userId: string): Promise<IWallet> {
    let wallet = await Wallet.findOne({ memberId });
    if (!wallet) {
      wallet = await Wallet.create({
        walletId: `WLT-${memberId}`,
        userId,
        memberId,
        availableBalance: 0,
        availableBalanceInPaise: 0,
        pendingBalance: 0,
        pendingBalanceInPaise: 0,
        withdrawnAmount: 0,
        withdrawnAmountInPaise: 0,
        totalEarned: 0,
        totalEarnedInPaise: 0,
        totalPaid: 0,
        totalPaidInPaise: 0,
        totalAdjusted: 0,
        totalAdjustedInPaise: 0,
        isActive: true,
      });
    }
    return wallet;
  }

  /**
   * Credit commission payout to member's wallet with immutable transaction entry
   */
  static async creditCommission(
    memberId: string,
    amount: number,
    commissionLedgerId: string,
    description: string
  ): Promise<IWallet> {
    const member = await Member.findOne({ memberId });
    if (!member) {
      throw new Error(`Member ${memberId} not found.`);
    }

    const wallet = await this.getOrCreateWallet(memberId, member._id.toString());
    const amountInPaise = DecimalUtil.toPaise(amount);
    const balanceBeforeInPaise = wallet.availableBalanceInPaise || DecimalUtil.toPaise(wallet.availableBalance);
    const balanceAfterInPaise = balanceBeforeInPaise + amountInPaise;

    // Update wallet balances with decimal safety
    wallet.availableBalanceInPaise = balanceAfterInPaise;
    wallet.availableBalance = DecimalUtil.fromPaise(balanceAfterInPaise);

    const totalEarnedInPaise = (wallet.totalEarnedInPaise || DecimalUtil.toPaise(wallet.totalEarned)) + amountInPaise;
    wallet.totalEarnedInPaise = totalEarnedInPaise;
    wallet.totalEarned = DecimalUtil.fromPaise(totalEarnedInPaise);

    await wallet.save();

    // Create immutable audit transaction
    await WalletTransaction.create({
      transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      walletId: wallet.walletId,
      userId: member._id.toString(),
      memberId,
      type: 'CREDIT',
      amount,
      amountInPaise,
      balanceBefore: DecimalUtil.fromPaise(balanceBeforeInPaise),
      balanceBeforeInPaise,
      balanceAfter: DecimalUtil.fromPaise(balanceAfterInPaise),
      balanceAfterInPaise,
      referenceType: 'COMMISSION',
      referenceId: commissionLedgerId,
      description,
    });

    // Sync member summary balance safely without triggering full document re-validation
    await Member.updateOne(
      { memberId },
      {
        $set: {
          walletBalance: wallet.availableBalance,
          totalIncome: wallet.totalEarned,
        },
      }
    );

    return wallet;
  }

  /**
   * Debit from wallet (e.g. withdrawal or purchase payment)
   */
  static async debitWallet(
    memberId: string,
    amount: number,
    referenceType: 'WITHDRAWAL' | 'PURCHASE' | 'ADJUSTMENT',
    referenceId: string,
    description: string
  ): Promise<IWallet> {
    const member = await Member.findOne({ memberId });
    if (!member) {
      throw new Error(`Member ${memberId} not found.`);
    }

    const wallet = await this.getOrCreateWallet(memberId, member._id.toString());
    const amountInPaise = DecimalUtil.toPaise(amount);
    const balanceBeforeInPaise = wallet.availableBalanceInPaise || DecimalUtil.toPaise(wallet.availableBalance);

    if (balanceBeforeInPaise < amountInPaise) {
      throw new Error(`Insufficient wallet balance. Available: ₹${DecimalUtil.fromPaise(balanceBeforeInPaise)}, Requested: ₹${amount}`);
    }

    const balanceAfterInPaise = balanceBeforeInPaise - amountInPaise;
    wallet.availableBalanceInPaise = balanceAfterInPaise;
    wallet.availableBalance = DecimalUtil.fromPaise(balanceAfterInPaise);

    if (referenceType === 'WITHDRAWAL') {
      const withdrawnInPaise = (wallet.withdrawnAmountInPaise || DecimalUtil.toPaise(wallet.withdrawnAmount)) + amountInPaise;
      wallet.withdrawnAmountInPaise = withdrawnInPaise;
      wallet.withdrawnAmount = DecimalUtil.fromPaise(withdrawnInPaise);
    }

    await wallet.save();

    // Create immutable audit transaction
    await WalletTransaction.create({
      transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      walletId: wallet.walletId,
      userId: member._id.toString(),
      memberId,
      type: 'DEBIT',
      amount,
      amountInPaise,
      balanceBefore: DecimalUtil.fromPaise(balanceBeforeInPaise),
      balanceBeforeInPaise,
      balanceAfter: DecimalUtil.fromPaise(balanceAfterInPaise),
      balanceAfterInPaise,
      referenceType,
      referenceId,
      description,
    });

    member.walletBalance = wallet.availableBalance;
    await member.save();

    return wallet;
  }
}
