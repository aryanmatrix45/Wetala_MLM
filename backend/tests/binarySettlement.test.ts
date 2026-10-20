/**
 * Daily binary settlement end to end: team BV waiting per IST day, sponsor qualification at any
 * depth, sequential payouts across days, carry forward, the daily cap with flush, no deductions,
 * one wallet credit per day, idempotent re-runs, and access control on the binary income API.
 *
 * Runs the real Express app over HTTP against a local replica set (transactions are required):
 *   MONGODB_URI="mongodb://127.0.0.1:27027/wetala_binary_test?replicaSet=rs0" npx tsx tests/binarySettlement.test.ts
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
import { DailyBinarySettlementService } from '../src/services/compensation/DailyBinarySettlementService';
import { BusinessDate } from '../src/utils/businessDate';
import { BV_SOURCE_TYPE, COMMISSION_TYPE } from '../src/config/constants';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DOMAIN = '@test-binary.com';

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

async function call(method: string, url: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${url}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
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
const closingOf = (memberId: string, businessDate: string) => BinaryDailyClosing.findOne({ memberId, businessDate });

async function runTests() {
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGODB_URI)) {
    console.error('Refusing to run: set MONGODB_URI to a local replica-set test database (mongodb://127.0.0.1:...).');
    process.exit(1);
  }
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'binary_test_secret';
  const secret = process.env.JWT_SECRET;

  await mongoose.connect(MONGODB_URI);
  await Promise.all([Member.init(), BinaryDailyClosing.init(), BinarySettlementRun.init(), BVLedger.init(), BinaryVolume.init()]);
  const server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    await wipe();

    const makeMember = async (memberId: string, extra: Record<string, unknown> = {}) => {
      const m = await Member.create({
        memberId, name: `Member ${memberId}`, email: `${memberId.toLowerCase()}${DOMAIN}`, mobile: `93333${memberId.slice(-5)}`,
        password: 'password123', kyc: { status: 'approved' }, personalBv: 200, ...extra,
      });
      return { member: m, token: jwt.sign({ id: m._id.toString(), email: m.email, role: 'member', memberId }, secret) };
    };

    // ROOT sponsors L and R directly. Under L: LL (sponsored by ROOT, so it counts for ROOT's left)
    // and LR (sponsored by L). Under R: RR, sponsored by ROOT two levels down.
    // L has a sponsored member only on its right, so L does not qualify.
    const ROOT = await makeMember('BS00001', { sponsorId: '', personalBv: 1250 });
    const L = await makeMember('BS00002', { sponsorId: 'BS00001', parentId: 'BS00001', position: 'LEFT' });
    await makeMember('BS00003', { sponsorId: 'BS00001', parentId: 'BS00001', position: 'RIGHT' });
    await makeMember('BS00004', { sponsorId: 'BS00001', parentId: 'BS00002', position: 'LEFT' });
    await makeMember('BS00005', { sponsorId: 'BS00002', parentId: 'BS00002', position: 'RIGHT' });
    await makeMember('BS00006', { sponsorId: 'BS00001', parentId: 'BS00003', position: 'RIGHT' });
    const adminToken = jwt.sign({ id: 'admin', email: `admin${DOMAIN}`, role: 'superadmin' }, secret);

    const today = BusinessDate.today();
    const day = (n: number) => BusinessDate.addDays(today, -n);
    const [D1, D2, D3, D4, D5] = [day(6), day(5), day(4), day(3), day(2)];

    console.log('\n--- Day 1: first payout 2:1 (2700 left, 1250 right) ---');
    await addBV('BS00004', 2700, D1); // left of ROOT, also left of L
    await addBV('BS00006', 1250, D1); // right of ROOT
    let r = await call('GET', `/api/binary/today/BS00001`, undefined, ROOT.token);
    assert(r.status === 200 && r.data.data.newLeftBV === 2700 && r.data.data.newRightBV === 1250 && r.data.data.matches === 1,
      'Live preview shows waiting BV and the expected match', r.data.data);
    assert((await walletBalance('BS00001')) === 0, 'Nothing is paid before the day is settled');

    const run1 = await DailyBinarySettlementService.executeDailySettlement(D1, 'TEST');
    let c = await closingOf('BS00001', D1);
    assert(run1.status === 'COMPLETED' && c?.matches === 1 && c?.creditedAmount === 250, 'Day 1 pays ₹250', c);
    assert(c?.closing.left === 200 && c?.closing.right === 0 && c?.closing.reservedBV === 2500 && c?.closing.reservedSide === 'LEFT',
      '200 left carries forward; 2500 left kept for the 2nd payout', c?.closing);
    assert((await walletBalance('BS00001')) === 250, '₹250 credited to the wallet with no TDS or admin fee');
    const comm = await CommissionLedger.findOne({ memberId: 'BS00001', type: COMMISSION_TYPE.BINARY_BONUS });
    assert(comm?.grossAmount === 250 && comm?.payableAmount === 250 && comm?.tdsDeduction === 0 && comm?.adminFee === 0,
      'Commission ledger: gross = payable = ₹250, zero deductions', comm);
    assert((await BVLedger.countDocuments({ memberId: 'BS00001', settlementStatus: 'PENDING' })) === 0, "The day's team BV is marked settled");

    const lClosing = await closingOf('BS00002', D1);
    assert(lClosing?.status === 'NOT_QUALIFIED' || lClosing?.status === 'NO_MATCH', 'L (no sponsored member on its left) earns nothing', lClosing?.status);
    assert((await walletBalance('BS00002')) === 0 && (await BinaryVolume.findOne({ memberId: 'BS00002' }))?.leftAvailableBV === 2700,
      "A member who doesn't qualify keeps the BV as carry forward; nothing is flushed");

    console.log('\n--- Re-running a settled day changes nothing ---');
    await DailyBinarySettlementService.executeDailySettlement(D1, 'TEST');
    assert((await walletBalance('BS00001')) === 250 && (await BinaryDailyClosing.countDocuments({ memberId: 'BS00001', businessDate: D1 })) === 1,
      'Same day settled twice pays once');

    console.log('\n--- Day 2: second payout (kept 2500 left + 1300 new right) ---');
    await addBV('BS00006', 1300, D2);
    await DailyBinarySettlementService.executeDailySettlement(D2, 'TEST');
    c = await closingOf('BS00001', D2);
    assert(c?.creditedAmount === 250 && c?.cycles[0]?.stage === 'SECOND_PAYOUT', 'Day 2 pays ₹250 (2nd payout)', c?.cycles);
    assert(c?.closing.left === 200 && c?.closing.right === 50 && c?.closing.reservedBV === 0, '50 right carries forward', c?.closing);

    console.log('\n--- Day 3: 1:1 payout (1300 : 1300) ---');
    await addBV('BS00004', 1100, D3);
    await addBV('BS00006', 1250, D3);
    await DailyBinarySettlementService.executeDailySettlement(D3, 'TEST');
    c = await closingOf('BS00001', D3);
    assert(c?.creditedAmount === 250 && c?.closing.left === 50 && c?.closing.right === 50, 'Day 3 pays ₹250, 50 : 50 carries forward', c?.closing);
    assert((await walletBalance('BS00001')) === 750, 'Wallet total ₹750 after three days');

    console.log('\n--- Day 4: daily cap ₹4,000 with flush ---');
    await addBV('BS00004', 17 * 1250, D4);
    await addBV('BS00006', 17 * 1250, D4);
    await DailyBinarySettlementService.executeDailySettlement(D4, 'TEST');
    c = await closingOf('BS00001', D4);
    assert(c?.matches === 17 && c?.generatedAmount === 4250 && c?.dailyCap === 4000 && c?.creditedAmount === 4000 && c?.flushedAmount === 250,
      '17 matches: ₹4,000 paid, ₹250 flushed', c);
    assert(c?.closing.left === 50 && c?.closing.right === 50, 'Flushed BV is still used up, not carried forward', c?.closing);
    assert((await walletBalance('BS00001')) === 4750, 'Wallet credited exactly the capped amount');
    assert(!!(await AdminNotification.findOne({ recipientId: 'BS00001', title: 'Capping Limits Exceeded' })), 'Member is told about the flush');

    console.log('\n--- Bigger package raises the cap ---');
    await Member.updateOne({ memberId: 'BS00001' }, { $set: { dailyCapping: 8000 } });
    await addBV('BS00004', 20 * 1250, D5);
    await addBV('BS00006', 20 * 1250, D5);
    // Two workers at once: the run lock lets only one settle, and the day is paid once
    const results = await Promise.allSettled([
      DailyBinarySettlementService.executeDailySettlement(D5, 'WORKER-1'),
      DailyBinarySettlementService.executeDailySettlement(D5, 'WORKER-2'),
    ]);
    assert(results.some((x) => x.status === 'fulfilled'), 'One worker completes the day', results.map((x) => x.status));
    c = await closingOf('BS00001', D5);
    assert(c?.creditedAmount === 5000 && c?.dailyCap === 8000 && c?.flushedAmount === 0, '₹5,000 paid under an ₹8,000 cap', c);
    assert((await walletBalance('BS00001')) === 9750 && (await WalletTransaction.countDocuments({ memberId: 'BS00001' })) === 5,
      'One wallet credit per settled day');

    console.log('\n--- Settlement rules ---');
    let err: any = null;
    try {
      await DailyBinarySettlementService.executeDailySettlement(today, 'TEST');
    } catch (e) {
      err = e;
    }
    assert(!!err && /not ended/.test(err.message), 'The current day cannot be settled before it ends', err?.message);

    await addBV('BS00004', 1250, today);
    r = await call('GET', `/api/binary/today/BS00001`, undefined, ROOT.token);
    assert(r.data.data.newLeftBV === 1250 && r.data.data.opening.left === 50, "Today's BV waits on top of the carry forward", r.data.data);
    // L now has BV on both legs, but its only sponsored member is on the right
    await addBV('BS00005', 1250, day(1));
    await DailyBinarySettlementService.executeDailySettlement(day(1), 'TEST');
    assert((await BVLedger.countDocuments({ memberId: 'BS00001', settlementStatus: 'PENDING', businessDate: today })) === 1,
      "Settling yesterday leaves today's BV waiting");
    const lDay = await closingOf('BS00002', day(1));
    const lVol = await BinaryVolume.findOne({ memberId: 'BS00002' });
    assert(lDay?.status === 'NOT_QUALIFIED' && lDay?.isSponsorQualified === false && lDay?.flushedAmount === 0 && lVol?.rightAvailableBV === 1250,
      'Sponsor rule: matches possible but no sponsored member on the left, so nothing paid and BV kept', { status: lDay?.status, right: lVol?.rightAvailableBV });

    console.log('\n--- API access ---');
    r = await call('GET', '/api/binary/daily/BS00001', undefined, ROOT.token);
    assert(r.status === 200 && r.data.totals.creditedAmount === 9750 && r.data.totals.flushedAmount === 250,
      'Member sees daily history with totals', r.data.totals);
    r = await call('GET', '/api/binary/daily/BS00001', undefined, L.token);
    assert(r.status === 403, "Members cannot see their upline's income", r.status);
    r = await call('GET', '/api/binary/daily/BS00004', undefined, ROOT.token);
    assert(r.status === 200, "Members can see their downline's income", r.status);
    r = await call('GET', '/api/binary/volume/BS00001');
    assert(r.status === 401, 'Binary volume requires login', r.status);
    r = await call('POST', '/api/binary/settle-daily', { date: day(1) }, ROOT.token);
    assert(r.status === 403, 'Members cannot run the settlement', r.status);
    r = await call('POST', '/api/binary/rebalance', {}, ROOT.token);
    assert(r.status === 403, 'Members cannot rebalance the tree', r.status);
    r = await call('POST', '/api/binary/settle-daily', { date: today }, adminToken);
    assert(r.status === 400, 'Super Admin cannot settle a day that has not ended', r.data);
    r = await call('GET', `/api/binary/settlements/${D4}`, undefined, adminToken);
    assert(r.status === 200 && r.data.data.totals.flushedAmount === 250 && r.data.data.closings[0].memberId === 'BS00001',
      'Super Admin sees one day with totals and member closings', r.data.data?.totals);
    r = await call('GET', '/api/binary/leaderboard?period=month', undefined, L.token);
    const top = r.data.data?.leaders?.[0];
    assert(r.status === 200 && top?.creditedAmount === 9750 && top?.memberId === undefined && top?.memberName === 'Member B.',
      'Leaderboard ranks earners and masks other members for members', top);
  } finally {
    await wipe();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Test run crashed:', error);
  process.exit(1);
});
