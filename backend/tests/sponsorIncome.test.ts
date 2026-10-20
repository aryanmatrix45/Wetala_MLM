/**
 * Sponsor income: the direct sponsor gets 20% of each sponsored member's daily binary income (as
 * credited, after the member's daily cap), paid on top in the daily binary settlement. The member's
 * own income is not reduced, a day is never paid twice, and members only see their own sponsor income.
 *
 * Runs the real Express app over HTTP against a local replica set (transactions are required):
 *   MONGODB_URI="mongodb://127.0.0.1:27027/wetala_sponsor_test?replicaSet=rs0" npx tsx tests/sponsorIncome.test.ts
 */
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'net';
import app from '../src/app';
import { Member } from '../src/models/Member.model';
import { Wallet } from '../src/models/Wallet.model';
import { WalletTransaction } from '../src/models/WalletTransaction.model';
import { BinaryVolume } from '../src/models/BinaryVolume.model';
import { BVLedger } from '../src/models/BVLedger.model';
import { CommissionLedger } from '../src/models/CommissionLedger.model';
import { CompensationRule } from '../src/models/CompensationRule.model';
import { AdminNotification } from '../src/models/AdminNotification.model';
import { BinaryDailyClosing } from '../src/models/BinaryDailyClosing.model';
import { BinarySettlementRun } from '../src/models/BinarySettlementRun.model';
import { BVService } from '../src/services/BVService';
import { CompensationEngine } from '../src/services/compensation/CompensationEngine';
import { DailyBinarySettlementService } from '../src/services/compensation/DailyBinarySettlementService';
import { SponsorBonusService } from '../src/services/compensation/SponsorBonusService';
import { BusinessDate } from '../src/utils/businessDate';
import { BV_SOURCE_TYPE, COMMISSION_TYPE } from '../src/config/constants';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DOMAIN = '@test-sponsor.com';

let baseUrl = '';
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

async function call(method: string, url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${url}`, { method, headers });
  return { status: res.status, data: (await res.json()) as any };
}

async function wipe() {
  await Promise.all(
    [Member, Wallet, WalletTransaction, BinaryVolume, BVLedger, CommissionLedger, CompensationRule, AdminNotification, BinaryDailyClosing, BinarySettlementRun].map(
      (m: any) => m.deleteMany({})
    )
  );
}

let refCounter = 0;
/** Credits team BV from a downline member to all its uplines, dated on a given IST business day */
async function addBV(fromMemberId: string, bv: number, businessDate: string) {
  const ref = `TEST-ORDER-${++refCounter}`;
  await BVService.distributeVolumeToAncestors(fromMemberId, bv, BV_SOURCE_TYPE.REPURCHASE, ref);
  await BVLedger.updateMany({ referenceId: ref }, { $set: { businessDate } });
}

const walletBalance = async (memberId: string) => (await Wallet.findOne({ memberId }))?.availableBalance || 0;
const sponsorRows = (memberId: string) =>
  CommissionLedger.find({ memberId, type: COMMISSION_TYPE.SPONSOR_BINARY_BONUS, isReversed: false });

async function runTests() {
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGODB_URI)) {
    console.error('Refusing to run: set MONGODB_URI to a local replica-set test database (mongodb://127.0.0.1:...).');
    process.exit(1);
  }
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'sponsor_test_secret';
  const secret = process.env.JWT_SECRET;

  await mongoose.connect(MONGODB_URI);
  await Promise.all([Member.init(), BinaryDailyClosing.init(), BinarySettlementRun.init(), BVLedger.init(), BinaryVolume.init(), CommissionLedger.init()]);
  const server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    await wipe();

    const makeMember = async (memberId: string, extra: Record<string, unknown> = {}) => {
      const m = await Member.create({
        memberId, name: `Member ${memberId}`, email: `${memberId.toLowerCase()}${DOMAIN}`, mobile: `94444${memberId.slice(-5)}`,
        password: 'password123', kyc: { status: 'approved' }, personalBv: 200, ...extra,
      });
      return { member: m, token: jwt.sign({ id: m._id.toString(), email: m.email, role: 'member', memberId }, secret) };
    };

    // S sponsors A (placed LEFT) and B (placed RIGHT). A and B each sponsor one member on each of their own legs.
    // B has a ₹100 daily cap.
    const S = await makeMember('SP00001', { sponsorId: '' });
    const A = await makeMember('SP00002', { sponsorId: 'SP00001', parentId: 'SP00001', position: 'LEFT' });
    await makeMember('SP00003', { sponsorId: 'SP00001', parentId: 'SP00001', position: 'RIGHT', dailyCapping: 100 });
    await makeMember('SP00004', { sponsorId: 'SP00002', parentId: 'SP00002', position: 'LEFT' });
    await makeMember('SP00005', { sponsorId: 'SP00002', parentId: 'SP00002', position: 'RIGHT' });
    await makeMember('SP00006', { sponsorId: 'SP00003', parentId: 'SP00003', position: 'LEFT' });
    await makeMember('SP00007', { sponsorId: 'SP00003', parentId: 'SP00003', position: 'RIGHT' });
    const adminToken = jwt.sign({ id: 'admin', email: `admin${DOMAIN}`, role: 'superadmin' }, secret);

    const D1 = BusinessDate.addDays(BusinessDate.today(), -3);

    console.log('\n--- Daily settlement pays sponsor income ---');
    // A and B each get a 2:1 first payout (₹250); S itself matches its two legs too
    await addBV('SP00004', 2500, D1);
    await addBV('SP00005', 1250, D1);
    await addBV('SP00006', 2500, D1);
    await addBV('SP00007', 1250, D1);
    const run = await DailyBinarySettlementService.executeDailySettlement(D1, 'TEST');

    const aClosing = await BinaryDailyClosing.findOne({ memberId: 'SP00002', businessDate: D1 });
    const bClosing = await BinaryDailyClosing.findOne({ memberId: 'SP00003', businessDate: D1 });
    const sClosing = await BinaryDailyClosing.findOne({ memberId: 'SP00001', businessDate: D1 });
    assert(aClosing?.creditedAmount === 250 && bClosing?.creditedAmount === 100 && bClosing?.flushedAmount === 150,
      'A is credited ₹250; B is credited ₹100 (its cap), ₹150 flushed', { a: aClosing?.creditedAmount, b: bClosing?.creditedAmount });
    assert((await walletBalance('SP00002')) === 250 && (await walletBalance('SP00003')) === 100,
      "The members' own income is not reduced");

    const rows = await sponsorRows('SP00001');
    const fromA = rows.find((r) => r.calculationDetails?.sourceMemberId === 'SP00002');
    const fromB = rows.find((r) => r.calculationDetails?.sourceMemberId === 'SP00003');
    assert(rows.length === 2 && fromA?.payableAmount === 50, 'S gets 20% of A\'s ₹250 = ₹50', rows.map((r) => [r.calculationDetails?.sourceMemberId, r.payableAmount]));
    assert(fromB?.payableAmount === 20, "S gets 20% of what B was actually credited (₹100), not of the flushed amount", fromB?.payableAmount);
    assert(fromA?.tdsDeduction === 0 && fromA?.adminFee === 0 && fromA?.calculationDetails?.businessDate === D1,
      'Sponsor income has no deductions and is tied to the business day');
    assert((await walletBalance('SP00001')) === (sClosing?.creditedAmount || 0) + 70,
      "S's wallet = its own binary income + ₹70 sponsor income", { wallet: await walletBalance('SP00001'), own: sClosing?.creditedAmount });
    assert(aClosing?.sponsorId === 'SP00001' && aClosing?.sponsorBonusAmount === 50 && aClosing?.sponsorWalletCredited === true,
      "The member's daily closing records the sponsor income and that it was paid", aClosing);
    assert(run.totals.sponsorBonusAmount === 70, 'Settlement totals include sponsor income', run.totals);
    assert(rows.every((r) => r.memberId === 'SP00001') && (await sponsorRows('SP00002')).length === 0,
      'Only the direct sponsor is paid (no levels above)');

    console.log('\n--- Re-running the day pays nothing extra ---');
    const sBefore = await walletBalance('SP00001');
    await DailyBinarySettlementService.executeDailySettlement(D1, 'TEST');
    assert((await walletBalance('SP00001')) === sBefore && (await sponsorRows('SP00001')).length === 2, 'Same day settled twice pays sponsor income once');

    console.log('\n--- Who gets sponsor income ---');
    const rules = await CompensationEngine.getActiveRules();
    const a = (await Member.findOne({ memberId: 'SP00002' }))!;
    let plan = await SponsorBonusService.planForDay(a, 1000, D1, rules);
    assert(plan?.sponsorId === 'SP00001' && plan?.amount === 200, '20% of ₹1,000 is ₹200 for the direct sponsor', plan);
    await Member.updateOne({ memberId: 'SP00001' }, { $set: { isActive: false } });
    plan = await SponsorBonusService.planForDay(a, 1000, D1, rules);
    assert(plan === null, 'An inactive sponsor gets nothing');
    await Member.updateOne({ memberId: 'SP00001' }, { $set: { isActive: true } });
    rules.sponsorBinaryBonus.isEnabled = false;
    assert((await SponsorBonusService.planForDay(a, 1000, D1, rules)) === null, 'Nothing is paid while sponsor income is switched off');
    const s = (await Member.findOne({ memberId: 'SP00001' }))!;
    assert((await SponsorBonusService.planForDay(s, 1000, D1, await CompensationEngine.getActiveRules())) === null,
      'A member without a sponsor pays no sponsor income');

    console.log('\n--- API ---');
    let r = await call('GET', '/api/sponsor/income/summary/SP00001', S.token);
    const directA = r.data.data?.directTeamBreakdown?.find((d: any) => d.memberId === 'SP00002');
    assert(r.status === 200 && r.data.data.kpis.totalNetCredited === 70 && r.data.data.kpis.thisMonth >= 0 && r.data.data.kpis.directTeamCount === 2,
      'Sponsor sees its total sponsor income and direct team', r.data.data?.kpis);
    assert(directA?.binaryEarnings === 250 && directA?.sponsorBonusGenerated === 50, 'Breakdown: A earned ₹250, generated ₹50 for S', directA);
    const payout = r.data.data.recentPayouts.find((p: any) => p.sourceMemberId === 'SP00003');
    assert(payout?.businessDate === D1 && payout?.baseAmount === 100 && payout?.ratePercent === 20 && payout?.netPayable === 20,
      'History row: day, their binary income, rate and sponsor income', payout);
    r = await call('GET', '/api/sponsor/income/summary/SP00001', A.token);
    assert(r.status === 403, "Members cannot read another member's sponsor income", r.status);
    r = await call('GET', '/api/sponsor/income/history/SP00001');
    assert(r.status === 401, 'Sponsor income needs a login', r.status);
    r = await call('GET', '/api/sponsor/income/history/SP00001', adminToken);
    assert(r.status === 200 && r.data.data.total === 2, 'The Super Admin can look at any member', r.data.data);
  } finally {
    await wipe();
    server.close();
    await mongoose.disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
