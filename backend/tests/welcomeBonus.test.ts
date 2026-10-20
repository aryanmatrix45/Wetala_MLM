/**
 * Welcome bonus rules: lifetime BV (orders + transfers in, BV-paid orders not counted twice), two
 * directly sponsored members placed anywhere, the weekly 4% pool split equally, the exact 2x lifetime
 * cap, settling only finished weeks as of their end, and never paying a week twice.
 *
 * Runs the services against a local replica set (transactions are required):
 *   MONGODB_URI="mongodb://127.0.0.1:27027/wetala_wb_test?replicaSet=rs0" npx tsx tests/welcomeBonus.test.ts
 */
import mongoose from 'mongoose';
import { Member } from '../src/models/Member.model';
import { Purchase } from '../src/models/Purchase.model';
import { BVLedger } from '../src/models/BVLedger.model';
import { BVWallet } from '../src/models/BVWallet.model';
import { BVTransaction } from '../src/models/BVTransaction.model';
import { BVWalletLedger } from '../src/models/BVWalletLedger.model';
import { BinaryVolume } from '../src/models/BinaryVolume.model';
import { CompensationRule } from '../src/models/CompensationRule.model';
import { AdminNotification } from '../src/models/AdminNotification.model';
import { WelcomeBonusSettlement } from '../src/models/WelcomeBonusSettlement.model';
import { WelcomeBonusTransaction } from '../src/models/WelcomeBonusTransaction.model';
import { BVWalletService, ADMIN_BV_OWNER } from '../src/services/BVWalletService';
import { WelcomeBonusService } from '../src/services/compensation/WelcomeBonusService';
import { LifetimeBvService } from '../src/services/compensation/LifetimeBvService';
import { GrossVolumeService } from '../src/services/GrossVolumeService';
import { BusinessDate } from '../src/utils/businessDate';
import { BV_SOURCE_TYPE } from '../src/config/constants';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DOMAIN = '@test-wb.com';
const DAY_MS = 24 * 60 * 60 * 1000;
const LONG_AGO = new Date(Date.now() - 30 * DAY_MS);
const ACTOR = { role: 'superadmin', email: `admin${DOMAIN}` };

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: unknown) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ''}`);
    failed++;
  }
}

async function expectError(fn: () => Promise<unknown>, pattern: RegExp, testName: string) {
  try {
    await fn();
    assert(false, testName, 'no error');
  } catch (error: any) {
    assert(pattern.test(error?.message || ''), testName, error?.message);
  }
}

// This suite owns the whole test database
async function wipe() {
  await Promise.all(
    [
      Member, Purchase, BVLedger, BVWallet, BVTransaction, BVWalletLedger, BinaryVolume, CompensationRule,
      AdminNotification, WelcomeBonusSettlement, WelcomeBonusTransaction,
    ].map((m: any) => m.deleteMany({}))
  );
}

let mobileSeq = 0;
const makeMember = (memberId: string, extra: Record<string, unknown> = {}) =>
  Member.create({
    memberId, name: `Member ${memberId}`, email: `${memberId.toLowerCase()}${DOMAIN}`, mobile: `93333${String(++mobileSeq).padStart(5, '0')}`,
    password: 'password123', sponsorId: '', status: 'active', isActive: true, ...extra,
  });

const sendFromAdmin = (recipientId: string, amount: number) =>
  BVWalletService.transfer({ sender: ADMIN_BV_OWNER, recipientId, amount, title: 'Funding', note: '', actor: ACTOR });

/** A personal BV credit from an approved order, the way the compensation engine records it */
async function orderCredit(memberId: string, purchaseId: string, bv: number, paymentMethod: string) {
  await Purchase.create({
    purchaseId, transactionId: `TX-${purchaseId}`, userId: memberId, memberId, type: 'REPURCHASE',
    items: [{ itemId: 'I1', itemType: 'PRODUCT', name: 'Item', quantity: 1, unitPrice: 0, unitPriceInPaise: 0, unitBV: bv, totalPrice: 0, totalPriceInPaise: 0, totalBV: bv }],
    totalAmount: 0, totalAmountInPaise: 0, totalBV: bv, paymentMethod,
  });
  await BVLedger.create({
    ledgerId: `LG-${purchaseId}`, userId: memberId, memberId, sourceType: BV_SOURCE_TYPE.REPURCHASE, referenceId: purchaseId,
    openingBV: 0, earnedBV: bv, consumedBV: 0, carriedForwardBV: 0, flushedBV: 0, closingBV: bv, description: 'Test order', isImmutable: true,
  });
  await Member.updateOne({ memberId }, { $inc: { personalBv: bv } });
}

async function runTests() {
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGODB_URI)) {
    console.error('Refusing to run: set MONGODB_URI to a local replica-set test database (mongodb://127.0.0.1:...).');
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  for (const name of ['bvwallets', 'bvtransactions', 'bvwalletledgers', 'purchases', 'welcomebonussettlements']) {
    await mongoose.connection.db!.dropCollection(name).catch(() => {});
  }
  await Promise.all([BVWallet.init(), BVTransaction.init(), BVWalletLedger.init(), Purchase.init(), Member.init(), WelcomeBonusSettlement.init(), WelcomeBonusTransaction.init()]);

  try {
    await wipe();
    await BVWalletService.generate({ amount: 100000, title: 'Stock', note: 'Test', actor: ACTOR });

    // A: 1,250 BV transferred in; sponsors two members, both placed on the LEFT
    await makeMember('WB00001');
    await makeMember('WB00002', { sponsorId: 'WB00001', parentId: 'WB00001', position: 'LEFT', personalBv: 100 });
    await makeMember('WB00003', { sponsorId: 'WB00001', parentId: 'WB00002', position: 'LEFT', personalBv: 100 });
    await sendFromAdmin('WB00001', 1250);
    // D: two sponsored members but only 1,000 BV in its lifetime
    await makeMember('WB00004');
    await makeMember('WB00005', { sponsorId: 'WB00004', personalBv: 100 });
    await makeMember('WB00006', { sponsorId: 'WB00004', personalBv: 100 });
    await sendFromAdmin('WB00004', 1000);
    // G: 1,250 BV from a bank-paid order plus a 1,250 BV order paid from the BV Wallet; 2,400 already earned
    await makeMember('WB00007', { welcomeBonusEarned: 2400 });
    await makeMember('WB00008', { sponsorId: 'WB00007', position: 'LEFT', personalBv: 100 });
    await makeMember('WB00009', { sponsorId: 'WB00007', position: 'RIGHT', personalBv: 100 });
    await orderCredit('WB00007', 'PUR-WB-CASH', 1250, 'BANK_TRANSFER');
    await orderCredit('WB00007', 'PUR-WB-BV', 1250, 'BV_WALLET');
    // H: plenty of BV, one active sponsored member and one inactive one
    await makeMember('WB00010');
    await makeMember('WB00011', { sponsorId: 'WB00010', personalBv: 100 });
    await makeMember('WB00015', { sponsorId: 'WB00010', isActive: false, personalBv: 100 });
    await sendFromAdmin('WB00010', 3000);
    // J: 1,250 BV; one sponsored member is binary-active, the other registered without reaching 100 BV
    await makeMember('WB00017');
    await makeMember('WB00018', { sponsorId: 'WB00017', personalBv: 100 });
    await makeMember('WB00019', { sponsorId: 'WB00017' });
    await sendFromAdmin('WB00017', 1250);
    // I: qualifies only this week (BV received now)
    await makeMember('WB00012');
    await makeMember('WB00013', { sponsorId: 'WB00012', personalBv: 100 });
    await makeMember('WB00014', { sponsorId: 'WB00012', personalBv: 100 });

    // Everything above happened a month ago
    await Promise.all([
      Member.collection.updateMany({}, { $set: { createdAt: LONG_AGO } }),
      Member.collection.updateMany({ binaryActivatedAt: { $ne: null } }, { $set: { binaryActivatedAt: LONG_AGO } }),
      BVTransaction.collection.updateMany({}, { $set: { createdAt: LONG_AGO } }),
      BVLedger.collection.updateMany({}, { $set: { createdAt: LONG_AGO } }),
    ]);
    await sendFromAdmin('WB00012', 1250);
    // J's second binary-active sponsored member joined long ago but reached 100 BV only this week
    await makeMember('WB00020', { sponsorId: 'WB00017', personalBv: 100 });
    await Member.collection.updateOne({ memberId: 'WB00020' }, { $set: { createdAt: LONG_AGO } });

    console.log('\n--- Lifetime BV ---');
    const lifetime = await LifetimeBvService.compute();
    assert(lifetime.get('WB00001') === 1250, 'Transferred-in BV counts toward lifetime BV', lifetime.get('WB00001'));
    assert(lifetime.get('WB00007') === 1250, 'A BV-paid order is not counted again on top of the BV that paid for it', lifetime.get('WB00007'));
    const a = await Member.findOne({ memberId: 'WB00001' });
    assert((a?.activationLockedBV || 0) === 100 && lifetime.get('WB00001') === 1250,
      'The 100 BV binary activation lock does not lower lifetime BV', { locked: a?.activationLockedBV });

    console.log('\n--- Eligibility ---');
    const lastWeek = WelcomeBonusService.lastFinishedWeek();
    const preview = await WelcomeBonusService.previewWeeklySettlement({ weekStart: lastWeek.weekStart, overrideGBV: 100000 });
    const evalOf = (id: string) => preview.allEvaluations.find((e) => e.memberId === id);
    assert(evalOf('WB00001')?.isEligible === true && evalOf('WB00001')?.sponsoredCount === 2,
      'Two sponsored members on the same wing qualify', evalOf('WB00001'));
    assert(evalOf('WB00004')?.isEligible === false && /lifetime/.test(evalOf('WB00004')?.ineligibleReason || ''),
      'Under 1,250 lifetime BV is not eligible', evalOf('WB00004')?.ineligibleReason);
    assert(evalOf('WB00010')?.isEligible === false && evalOf('WB00010')?.sponsoredCount === 1,
      'An inactive sponsored member does not count', evalOf('WB00010'));
    assert(evalOf('WB00017')?.isEligible === false && evalOf('WB00017')?.sponsoredCount === 1 && /binary/.test(evalOf('WB00017')?.ineligibleReason || ''),
      'A sponsored member below 100 BV (binary not active) does not count', evalOf('WB00017'));
    assert((await WelcomeBonusService.checkMemberEligibility('WB00017')).sponsoredCount === 2,
      'A sponsored member who reached 100 BV after the week ended counts only from then on');
    assert(evalOf('WB00012')?.isEligible === false, 'BV received after the week ended does not count for that week', evalOf('WB00012'));
    assert((await WelcomeBonusService.checkMemberEligibility('WB00012')).isEligible === true, '...but the member is eligible now');
    assert(preview.totalWelcomeBonusPool === 4000 && preview.eligibleMemberCount === 2 && preview.equalMemberShare === 2000,
      '4% of 1,00,000 BV = 4,000 BV, split equally between 2 eligible members', preview);

    console.log('\n--- Settlement ---');
    await expectError(() => WelcomeBonusService.executeWeeklySettlement({ weekStart: WelcomeBonusService.currentWeek().weekStart }),
      /not finished/, 'A week still running cannot be settled');
    await expectError(() => WelcomeBonusService.executeWeeklySettlement({ weekStart: BusinessDate.addDays(lastWeek.weekStart, 2) }),
      /Monday/, 'The week must be picked by its Monday');

    let result = await WelcomeBonusService.executeWeeklySettlement({ overrideGBV: 100000 });
    const paid = (id: string) => result.transactions.find((t) => t.memberId === id)?.actualPayout || 0;
    assert(result.settlement.weekStart === lastWeek.weekStart, 'Settles the last finished week by default', result.settlement.weekStart);
    assert(paid('WB00001') === 2000, 'Eligible member gets the equal share', paid('WB00001'));
    assert(paid('WB00007') === 100, 'A member near the cap gets only what is left of 2x', paid('WB00007'));
    assert(result.settlement.totalAmountDistributed === 2100 && result.settlement.totalAmountUndistributed === 1900,
      'Settlement totals', { d: result.settlement.totalAmountDistributed, u: result.settlement.totalAmountUndistributed });
    assert((await Member.findOne({ memberId: 'WB00007' }))?.welcomeBonusEarned === 2500, 'Capped member lands exactly on 2x (2,500)');
    const walletA = (await BVWallet.findOne({ ownerId: 'WB00001' }))?.availableBV || 0;

    result = await WelcomeBonusService.executeWeeklySettlement({ overrideGBV: 100000 });
    assert(result.alreadySettled && (await BVWallet.findOne({ ownerId: 'WB00001' }))?.availableBV === walletA,
      'Running the same week again pays nothing extra');

    const weekBefore = BusinessDate.addDays(lastWeek.weekStart, -7);
    result = await WelcomeBonusService.executeWeeklySettlement({ weekStart: weekBefore, overrideGBV: 100000 });
    assert(result.transactions.length === 1 && paid('WB00001') === 500,
      'Next settlement: cap-reached member is left out, the other is paid only up to 2x', result.transactions.map((t) => [t.memberId, t.actualPayout]));
    assert((await Member.findOne({ memberId: 'WB00001' }))?.welcomeBonusEarned === 2500, 'Lifetime welcome bonus is exactly 2x lifetime BV');
    const unsettled = await WelcomeBonusService.getUnsettledWeeks();
    assert(!unsettled.some((w) => w.weekStart === lastWeek.weekStart || w.weekStart === weekBefore), 'Settled weeks drop off the list to settle');

    console.log('\n--- Weekly gross BV ---');
    const order = await Purchase.create({
      purchaseId: 'PUR-WB-GBV', transactionId: 'TX-PUR-WB-GBV', userId: 'WB00001', memberId: 'WB00001', type: 'REPURCHASE',
      items: [{ itemId: 'I1', itemType: 'PRODUCT', name: 'Item', quantity: 1, unitPrice: 100, unitPriceInPaise: 10000, unitBV: 500, totalPrice: 100, totalPriceInPaise: 10000, totalBV: 500 }],
      totalAmount: 100, totalAmountInPaise: 10000, totalBV: 500, status: 'COMPLETED', paymentStatus: 'PAID', completedAt: new Date(),
    });
    await Purchase.collection.updateOne({ _id: order._id }, { $set: { createdAt: new Date(lastWeek.periodStart.getTime() + DAY_MS) } });
    const lastWeekGbv = await GrossVolumeService.forPeriod(lastWeek.periodStart, lastWeek.periodEnd);
    const thisWeekGbv = await GrossVolumeService.forPeriod(WelcomeBonusService.currentWeek().periodStart, new Date());
    assert(lastWeekGbv.bv === 0 && thisWeekGbv.bv === 500, 'An order counts once, in the week it was completed', { lastWeekGbv, thisWeekGbv });

    console.log('\n--- Switched off ---');
    await WelcomeBonusService.getActiveRules();
    await CompensationRule.updateMany({}, { $set: { 'welcomeBonus.isEnabled': false } });
    await expectError(() => WelcomeBonusService.executeWeeklySettlement({ weekStart: BusinessDate.addDays(weekBefore, -7) }),
      /switched off/, 'Nothing is paid while the welcome bonus is switched off');
  } finally {
    await wipe();
    await mongoose.disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
