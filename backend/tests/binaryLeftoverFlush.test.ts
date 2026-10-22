/**
 * Leftover rule FLUSH: BV that has not made a pair by IST midnight is cleared, for members who do not
 * qualify too. Only the 2500 BV kept from the 1st payout for the 2nd payout survives the close.
 * Runs the business owner's worked example day by day, plus the go-live carry forward, the live
 * preview, the API totals and the settings validation.
 *
 * Runs the real Express app over HTTP against a local replica set (transactions are required):
 *   MONGODB_URI="mongodb://127.0.0.1:27027/wetala_flush_test?replicaSet=rs0" npx tsx tests/binaryLeftoverFlush.test.ts
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
import { AuditLog } from '../src/models/AuditLog.model';
import { BinaryDailyClosing } from '../src/models/BinaryDailyClosing.model';
import { BinarySettlementRun } from '../src/models/BinarySettlementRun.model';
import { BVService } from '../src/services/BVService';
import { CompensationEngine } from '../src/services/compensation/CompensationEngine';
import { DailyBinarySettlementService } from '../src/services/compensation/DailyBinarySettlementService';
import { BusinessDate } from '../src/utils/businessDate';
import { BV_SOURCE_TYPE } from '../src/config/constants';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DOMAIN = '@test-flush.com';

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
    [Member, Wallet, WalletTransaction, BinaryVolume, BVLedger, CommissionLedger, CompensationRule, AdminNotification, AuditLog, BinaryDailyClosing, BinarySettlementRun].map(
      (m: any) => m.deleteMany({})
    )
  );
}

let refCounter = 0;
/** Credits team BV from a downline member to all its uplines, dated on a given IST business day */
async function addBV(fromMemberId: string, bv: number, businessDate: string) {
  const ref = `FLUSH-ORDER-${++refCounter}`;
  await BVService.distributeVolumeToAncestors(fromMemberId, bv, BV_SOURCE_TYPE.REPURCHASE, ref);
  await BVLedger.updateMany({ referenceId: ref }, { $set: { businessDate } });
}

const walletBalance = async (memberId: string) => (await Wallet.findOne({ memberId }))?.availableBalance || 0;
const closingOf = (memberId: string, businessDate: string) => BinaryDailyClosing.findOne({ memberId, businessDate });
const cleared = (c: any) => [c?.clearedLeftBV, c?.clearedRightBV];

async function runTests() {
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGODB_URI)) {
    console.error('Refusing to run: set MONGODB_URI to a local replica-set test database (mongodb://127.0.0.1:...).');
    process.exit(1);
  }
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'flush_test_secret';
  const secret = process.env.JWT_SECRET;

  await mongoose.connect(MONGODB_URI);
  await Promise.all([Member.init(), BinaryDailyClosing.init(), BinarySettlementRun.init(), BVLedger.init(), BinaryVolume.init()]);
  const server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    await wipe();

    console.log('\n--- New rule sets clear leftover BV by default ---');
    const seeded = await CompensationEngine.getActiveRules();
    assert(seeded.binaryBonus.volumeCarryForwardMode === 'FLUSH', 'Default leftover rule is FLUSH', seeded.binaryBonus.volumeCarryForwardMode);

    const makeMember = async (memberId: string, extra: Record<string, unknown> = {}) => {
      const m = await Member.create({
        memberId, name: `Member ${memberId}`, email: `${memberId.toLowerCase()}${DOMAIN}`, mobile: `94444${memberId.slice(-5)}`,
        password: 'password123', kyc: { status: 'approved' }, personalBv: 200, ...extra,
      });
      return { member: m, token: jwt.sign({ id: m._id.toString(), email: m.email, role: 'member', memberId }, secret) };
    };

    // ROOT sponsors A (left) and B (right), so ROOT qualifies. AL sits under A on its left but is
    // sponsored by ROOT, so A has sponsored nobody and does not qualify.
    const ROOT = await makeMember('FL00001', { sponsorId: '', personalBv: 1250 });
    await makeMember('FL00002', { sponsorId: 'FL00001', parentId: 'FL00001', position: 'LEFT' });
    await makeMember('FL00003', { sponsorId: 'FL00001', parentId: 'FL00001', position: 'RIGHT' });
    await makeMember('FL00004', { sponsorId: 'FL00001', parentId: 'FL00002', position: 'LEFT' });
    const adminToken = jwt.sign({ id: 'admin', email: `admin${DOMAIN}`, role: 'superadmin' }, secret);

    const today = BusinessDate.today();
    const day = (n: number) => BusinessDate.addDays(today, -n);
    const [D1, D2, D3, D4, D5] = [day(6), day(5), day(4), day(3), day(2)];

    console.log('\n--- Day 1: 2700 left, 1500 right: 1st payout, 200 / 250 cleared ---');
    await addBV('FL00004', 2700, D1);
    await addBV('FL00003', 1500, D1);
    const run1 = await DailyBinarySettlementService.executeDailySettlement(D1, 'TEST');
    let c = await closingOf('FL00001', D1);
    assert(c?.matches === 1 && c?.creditedAmount === 250, 'Day 1 pays ₹250 (1st payout)', c);
    assert(JSON.stringify(cleared(c)) === '[200,250]', '200 left and 250 right not paired by midnight are cleared', cleared(c));
    assert(c?.closing.left === 0 && c?.closing.right === 0 && c?.closing.reservedBV === 2500 && c?.closing.reservedSide === 'LEFT',
      'Nothing carries forward except the 2500 kept for the 2nd payout', c?.closing);
    const legRows = await BVLedger.find({ memberId: 'FL00001', sourceType: BV_SOURCE_TYPE.MATCHED, businessDate: D1 }).sort({ position: 1 });
    assert(legRows.length === 2 && legRows[0].flushedBV === 200 && legRows[1].flushedBV === 250 && legRows.every((r) => r.carriedForwardBV === 0),
      'BV records show the cleared amount per leg', legRows.map((r) => ({ leg: r.position, flushed: r.flushedBV, carried: r.carriedForwardBV })));
    assert((await BVLedger.countDocuments({ settlementStatus: 'PENDING' })) === 0, 'Clearing rows are not picked up as new team BV');

    const a = await closingOf('FL00002', D1);
    const aVol = await BinaryVolume.findOne({ memberId: 'FL00002' });
    assert(a?.status === 'NO_MATCH' && a?.clearedLeftBV === 2700 && aVol?.leftAvailableBV === 0,
      "A member who doesn't qualify also has unpaired BV cleared", { status: a?.status, cleared: a?.clearedLeftBV, left: aVol?.leftAvailableBV });
    const aRow = await BVLedger.findOne({ memberId: 'FL00002', sourceType: BV_SOURCE_TYPE.FLUSHED, businessDate: D1 });
    assert(aRow?.flushedBV === 2700 && aRow?.position === 'LEFT' && aRow?.consumedBV === 0, 'A no-match day writes a FLUSHED BV record', aRow);
    assert(run1.totals.clearedLeftBV === 2900 && run1.totals.clearedRightBV === 250, 'Settlement run totals include cleared BV', run1.totals);

    console.log('\n--- Day 2: 1000 right only: short of 1250, cleared; the kept 2500 survives ---');
    await addBV('FL00003', 1000, D2);
    await DailyBinarySettlementService.executeDailySettlement(D2, 'TEST');
    c = await closingOf('FL00001', D2);
    assert(c?.matches === 0 && c?.creditedAmount === 0 && c?.clearedRightBV === 1000, 'No 2nd payout; the 1000 right is cleared', c);
    assert(c?.closing.reservedBV === 2500 && c?.closing.reservedSide === 'LEFT', 'Kept 2500 survives a midnight with no payout', c?.closing);

    console.log('\n--- Day 3: 1250 right: 2nd payout ---');
    await addBV('FL00003', 1250, D3);
    await DailyBinarySettlementService.executeDailySettlement(D3, 'TEST');
    c = await closingOf('FL00001', D3);
    assert(c?.creditedAmount === 250 && c?.cycles[0]?.stage === 'SECOND_PAYOUT' && JSON.stringify(cleared(c)) === '[0,0]',
      'Day 3 pays ₹250 (2nd payout), nothing left to clear', c);

    console.log('\n--- Day 4: 1400 left, 1500 right: 3rd payout, 150 / 250 cleared ---');
    await addBV('FL00004', 1400, D4);
    await addBV('FL00003', 1500, D4);
    await DailyBinarySettlementService.executeDailySettlement(D4, 'TEST');
    c = await closingOf('FL00001', D4);
    assert(c?.creditedAmount === 250 && c?.cycles[0]?.stage === 'SUBSEQUENT', 'Day 4 pays ₹250 (3rd payout)', c?.cycles);
    assert(JSON.stringify(cleared(c)) === '[150,250]' && c?.closing.left === 0 && c?.closing.right === 0,
      '150 left and 250 right cleared at midnight', { cleared: cleared(c), closing: c?.closing });
    assert((await walletBalance('FL00001')) === 750, 'Wallet total ₹750 for three payouts');

    console.log('\n--- Day 5: BV carried forward before the switch is cleared at the first midnight ---');
    await BinaryVolume.create({ memberId: 'FL00003', userId: 'FL00003', leftTotalBV: 900, leftAvailableBV: 900, leftCarryForwardBV: 900 });
    await DailyBinarySettlementService.executeDailySettlement(D5, 'TEST');
    const b = await closingOf('FL00003', D5);
    assert(b?.clearedLeftBV === 900 && (await BinaryVolume.findOne({ memberId: 'FL00003' }))?.leftAvailableBV === 0,
      'Old carry forward with no new BV is cleared', b);
    assert(!(await closingOf('FL00001', D5)), 'A member with nothing waiting gets no closing');
    const rootVol = await BinaryVolume.findOne({ memberId: 'FL00001' });
    assert(rootVol?.clearedTotalBV === 1850, 'Lifetime cleared BV is counted (200 + 250 + 1000 + 150 + 250)', rootVol?.clearedTotalBV);

    console.log('\n--- Live preview and API ---');
    await addBV('FL00004', 1000, today);
    let r = await call('GET', '/api/binary/today/FL00001', undefined, ROOT.token);
    assert(r.status === 200 && r.data.data.leftoverMode === 'FLUSH' && r.data.data.clearedLeftBV === 1000 && r.data.data.closing.left === 0,
      "Today's preview shows what will be cleared at midnight", r.data.data);
    r = await call('GET', '/api/binary/daily/FL00001', undefined, ROOT.token);
    assert(r.status === 200 && r.data.totals.clearedLeftBV === 350 && r.data.totals.clearedRightBV === 1500,
      'Daily history totals include cleared BV', r.data.totals);
    r = await call('GET', '/api/binary/ledger/FL00001', undefined, ROOT.token);
    assert(r.status === 200 && r.data.summary.leftoverMode === 'FLUSH' && r.data.summary.clearedTotalBV === 1850,
      'BV movements summary shows the rule and lifetime cleared BV', r.data.summary);
    r = await call('GET', '/api/binary/volume/FL00001', undefined, ROOT.token);
    assert(r.status === 200 && r.data.data.today.clearedLeftBV === 1000 && r.data.data.leftoverMode === 'FLUSH',
      'Dashboard volume includes today\'s clearing estimate', r.data.data?.today);

    console.log('\n--- Settings ---');
    const before = await CompensationEngine.getActiveRules();
    r = await call('PUT', '/api/compensation/rules', { ...before.toObject(), binaryBonus: { ...before.toObject().binaryBonus, volumeCarryForwardMode: 'SOMETIMES' } }, adminToken);
    const after = await CompensationEngine.getActiveRules();
    assert(r.status === 400 && after._id.toString() === before._id.toString(), 'An unknown leftover rule is refused and the active rules stay', r.data);
    r = await call('PUT', '/api/compensation/rules', { ...before.toObject(), binaryBonus: { ...before.toObject().binaryBonus, volumeCarryForwardMode: 'CARRY_FORWARD' } }, adminToken);
    assert(r.status === 200 && (await CompensationEngine.getActiveRules()).binaryBonus.volumeCarryForwardMode === 'CARRY_FORWARD',
      'Super Admin can switch back to carry forward', r.data?.message);
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
