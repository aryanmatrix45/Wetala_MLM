/**
 * One-off cleanup: removes every welcome bonus paid under the old rupee-wallet rules and resets
 * all members' welcome bonus totals to 0, so the BV-based welcome bonus starts from a clean slate.
 *
 * For each member it removes the welcome bonus commission ledger rows and their wallet credit
 * transactions, subtracts the amount from the rupee wallet (available balance and total earned) and
 * from Member.totalIncome, then deletes all welcome bonus settlements and settlement transactions.
 *
 * If a member already withdrew part of that money, their wallet would go negative; it is set to 0
 * instead and the shortfall is reported.
 *
 *   npx tsx scripts/resetWelcomeBonus.ts          # preview only, changes nothing
 *   npx tsx scripts/resetWelcomeBonus.ts --yes    # apply
 */
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

import { CommissionLedger } from '../src/models/CommissionLedger.model';
import { Wallet } from '../src/models/Wallet.model';
import { WalletTransaction } from '../src/models/WalletTransaction.model';
import { Member } from '../src/models/Member.model';
import { WelcomeBonusTransaction } from '../src/models/WelcomeBonusTransaction.model';
import { WelcomeBonusSettlement } from '../src/models/WelcomeBonusSettlement.model';
import { COMMISSION_TYPE } from '../src/config/constants';

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

async function run() {
  const apply = process.argv.includes('--yes');
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wetala_mlm';
  console.log('[Connecting to]', uri.includes('@') ? uri.split('@')[1] : uri);
  await mongoose.connect(uri);

  const ledgers = await CommissionLedger.find({ type: COMMISSION_TYPE.WELCOME_BONUS }).lean();
  const ledgerIds = ledgers.map((l) => l.ledgerId);
  const byMember = new Map<string, number>();
  for (const l of ledgers) {
    const paise = l.payableAmountInPaise ?? Math.round((l.payableAmount || 0) * 100);
    byMember.set(l.memberId, (byMember.get(l.memberId) || 0) + paise);
  }

  const [settlements, settlementTxns, walletTxns, membersWithEarned] = await Promise.all([
    WelcomeBonusSettlement.countDocuments(),
    WelcomeBonusTransaction.countDocuments(),
    WalletTransaction.countDocuments({ referenceId: { $in: ledgerIds } }),
    Member.countDocuments({ welcomeBonusEarned: { $gt: 0 } }),
  ]);

  console.log(`\nWelcome bonus commission rows: ${ledgers.length} across ${byMember.size} member(s)`);
  console.log(`Wallet credit transactions:   ${walletTxns}`);
  console.log(`Settlements / settlement txns: ${settlements} / ${settlementTxns}`);
  console.log(`Members with welcome bonus earned > 0: ${membersWithEarned}\n`);

  const plan: Array<{ memberId: string; paise: number; availableAfter: number; shortfall: number }> = [];
  for (const [memberId, paise] of byMember) {
    const wallet = await Wallet.findOne({ memberId }).lean();
    const available = wallet?.availableBalanceInPaise ?? Math.round((wallet?.availableBalance || 0) * 100);
    const after = available - paise;
    plan.push({ memberId, paise, availableAfter: Math.max(0, after), shortfall: after < 0 ? -after : 0 });
    console.log(
      `  ${memberId.padEnd(10)} remove ${rupees(paise).padStart(14)}  wallet ${rupees(available)} -> ${rupees(Math.max(0, after))}` +
        (after < 0 ? `   (already withdrawn: ${rupees(-after)} cannot be taken back)` : '')
    );
  }

  if (!apply) {
    console.log('\nPreview only. Re-run with --yes to apply.');
    await mongoose.disconnect();
    return;
  }

  for (const item of plan) {
    const wallet = await Wallet.findOne({ memberId: item.memberId });
    if (wallet) {
      const earned = (wallet.totalEarnedInPaise ?? Math.round((wallet.totalEarned || 0) * 100)) - item.paise;
      wallet.availableBalanceInPaise = item.availableAfter;
      wallet.availableBalance = item.availableAfter / 100;
      wallet.totalEarnedInPaise = Math.max(0, earned);
      wallet.totalEarned = Math.max(0, earned) / 100;
      await wallet.save();
    }
    const member = await Member.findOne({ memberId: item.memberId }).select('totalIncome');
    const income = Math.max(0, Math.round(((member?.totalIncome || 0) * 100) - item.paise) / 100);
    await Member.updateOne({ memberId: item.memberId }, { $set: { totalIncome: income, walletBalance: item.availableAfter / 100 } });
  }

  const removedWalletTxns = await WalletTransaction.deleteMany({ referenceId: { $in: ledgerIds } });
  const removedLedgers = await CommissionLedger.deleteMany({ type: COMMISSION_TYPE.WELCOME_BONUS });
  const removedSettlementTxns = await WelcomeBonusTransaction.deleteMany({});
  const removedSettlements = await WelcomeBonusSettlement.deleteMany({});
  const resetMembers = await Member.updateMany({ welcomeBonusEarned: { $ne: 0 } }, { $set: { welcomeBonusEarned: 0 } });

  console.log('\nApplied:');
  console.log(`  wallet credit transactions removed: ${removedWalletTxns.deletedCount}`);
  console.log(`  commission rows removed:            ${removedLedgers.deletedCount}`);
  console.log(`  settlement transactions removed:    ${removedSettlementTxns.deletedCount}`);
  console.log(`  settlements removed:                ${removedSettlements.deletedCount}`);
  console.log(`  members reset to 0 earned:          ${resetMembers.modifiedCount}`);
  const shortfalls = plan.filter((p) => p.shortfall > 0);
  if (shortfalls.length) {
    console.log(`\n  ${shortfalls.length} member(s) had already withdrawn part of their welcome bonus; their wallets were set to ₹0.`);
  }
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error during welcome bonus reset:', err);
  process.exit(1);
});
