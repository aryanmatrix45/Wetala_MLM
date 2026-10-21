/**
 * Team Performance Bonus rules: RP from lifetime BV (1,250 BV = 1 RP), slab qualification for
 * balanced Left:Right RP, pools of turnover x percent split equally among members who first
 * qualify in the period, per-slab lifetime caps, idempotent payouts and concurrent-run safety.
 *
 * The pure rules always run. The database tests need a local replica set (transactions):
 *   MONGODB_URI="mongodb://127.0.0.1:27027/wetala_tpb_test?replicaSet=rs0" npx tsx tests/teamPerformanceBonus.test.ts
 * Without MONGODB_URI only the pure rules run and the database tests are skipped.
 */
import mongoose from 'mongoose';
import { Member } from '../src/models/Member.model';
import { BinaryVolume } from '../src/models/BinaryVolume.model';
import { BVLedger } from '../src/models/BVLedger.model';
import { Wallet } from '../src/models/Wallet.model';
import { WalletTransaction } from '../src/models/WalletTransaction.model';
import { CommissionLedger } from '../src/models/CommissionLedger.model';
import { AuditLog } from '../src/models/AuditLog.model';
import { TeamPerformanceBonusConfig } from '../src/models/TeamPerformanceBonusConfig.model';
import { MemberRewardPoints } from '../src/models/MemberRewardPoints.model';
import { TeamPerformanceBonusQualification } from '../src/models/TeamPerformanceBonusQualification.model';
import { TeamPerformanceBonusLifetime } from '../src/models/TeamPerformanceBonusLifetime.model';
import { TeamPerformanceBonusPayout } from '../src/models/TeamPerformanceBonusPayout.model';
import { CompanyTurnoverPeriod } from '../src/models/CompanyTurnoverPeriod.model';
import {
  TeamPerformanceBonusService,
  TeamPerformanceBonusError,
  calculateRP,
  planSlabSettlement,
  lifetimeKey,
  validateConfigInput,
} from '../src/services/compensation/TeamPerformanceBonusService';
import { TEAM_PERFORMANCE_BONUS_DEFAULTS, BV_SOURCE_TYPE } from '../src/config/constants';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DOMAIN = '@test-tpb.com';
const ACTOR = { email: `admin${DOMAIN}`, role: 'superadmin' };
const PERIOD_A = { periodStart: '2026-01-05', periodEnd: '2026-01-11' };
const PERIOD_B = { periodStart: '2026-01-12', periodEnd: '2026-01-18' };
const PERIOD_C = { periodStart: '2026-01-19', periodEnd: '2026-01-25' };

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

// ---------------------------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------------------------

function runPureTests() {
  console.log('\nRP conversion (1,250 BV = 1 RP)');
  assert(calculateRP(1249, 1250) === 0, 'BV below one unit gives 0 RP');
  assert(calculateRP(1250, 1250) === 1, '1,250 BV gives 1 RP');
  assert(calculateRP(12500, 1250) === 10, '12,500 BV gives 10 RP (the 10:10 slab)');
  assert(calculateRP(12499, 1250) === 9, 'one BV short of 10 RP stays at 9 RP');
  assert(calculateRP(-5, 1250) === 0 && calculateRP(NaN, 1250) === 0, 'negative and NaN BV count as 0 RP');

  console.log('\nSettlement split');
  const slabs = [{ slabId: 'S3', percent: 3, lifetimeLimit: 10000 }];
  const twoMembers = [
    { qualificationId: 'q1', memberId: 'A', slabId: 'S3' },
    { qualificationId: 'q2', memberId: 'B', slabId: 'S3' },
  ];
  const equal = planSlabSettlement({ turnover: 100000, slabs, qualifications: twoMembers, paidPaiseByKey: new Map() });
  assert(equal.slabs[0].poolPaise === 300000, 'pool = turnover x percent (3% of ₹1,00,000 = ₹3,000)');
  assert(equal.slabs[0].sharePaise === 150000, 'two equal members each get ₹1,500');
  assert(equal.totalDistributedPaise === 300000 && equal.totalUndistributedPaise === 0, 'nothing is left over');

  const thirds = planSlabSettlement({
    turnover: 1000,
    slabs: [{ slabId: 'S3', percent: 100, lifetimeLimit: 10000 }],
    qualifications: [
      { qualificationId: 'q1', memberId: 'A', slabId: 'S3' },
      { qualificationId: 'q2', memberId: 'B', slabId: 'S3' },
      { qualificationId: 'q3', memberId: 'C', slabId: 'S3' },
    ],
    paidPaiseByKey: new Map(),
  });
  assert(thirds.slabs[0].sharePaise === 33333, 'three-way split rounds each share down to whole paise');
  assert(thirds.totalUndistributedPaise === 1, 'the rounding paisa stays with the company');
  assert(thirds.totalDistributedPaise <= thirds.totalPoolPaise, 'never pays more than the pool');

  console.log('\nLifetime caps');
  const capped = planSlabSettlement({
    turnover: 100000,
    slabs,
    qualifications: [
      { qualificationId: 'q1', memberId: 'A', slabId: 'S3' },
      { qualificationId: 'q2', memberId: 'B', slabId: 'S3' },
    ],
    paidPaiseByKey: new Map([[lifetimeKey('A', 'S3'), 999000]]), // A has ₹9,990 of ₹10,000
  });
  const payoutA = capped.slabs[0].payouts.find((p) => p.memberId === 'A');
  const payoutB = capped.slabs[0].payouts.find((p) => p.memberId === 'B');
  assert(payoutA?.plannedPaise === 1000, 'member nearly at the cap is paid only the ₹10 left');
  assert(payoutB?.plannedPaise === 150000, 'the other member is paid the full share');
  assert(capped.slabs[0].undistributedPaise === 149000, 'the capped amount stays with the company');

  const exhausted = planSlabSettlement({
    turnover: 100000,
    slabs,
    qualifications: [{ qualificationId: 'q1', memberId: 'A', slabId: 'S3' }],
    paidPaiseByKey: new Map([[lifetimeKey('A', 'S3'), 1000000]]),
  });
  assert(exhausted.slabs[0].payouts.length === 0, 'a member at the cap gets no payout');
  assert(exhausted.slabs[0].eligibleCount === 1, 'a capped member still counts as eligible in the split');

  console.log('\nSlabs are independent');
  const multi = planSlabSettlement({
    turnover: 100000,
    slabs: [
      { slabId: 'S10', percent: 3, lifetimeLimit: 10000 },
      { slabId: 'S100', percent: 2, lifetimeLimit: 30000 },
    ],
    qualifications: [
      { qualificationId: 'a10', memberId: 'A', slabId: 'S10' },
      { qualificationId: 'a100', memberId: 'A', slabId: 'S100' },
    ],
    paidPaiseByKey: new Map([[lifetimeKey('A', 'S10'), 1000000]]), // capped on S10 only
  });
  assert(multi.slabs[0].payouts.length === 0, 'cap on one slab does not block another slab');
  assert(multi.slabs[1].payouts[0]?.plannedPaise === 200000, 'the second slab pays its own 2% pool');

  console.log('\nInsufficient pool');
  const noTurnover = planSlabSettlement({ turnover: 0, slabs, qualifications: twoMembers, paidPaiseByKey: new Map() });
  assert(noTurnover.totalDistributedPaise === 0, 'zero turnover pays nothing');
  assert(noTurnover.totalUndistributedPaise === 0, 'zero turnover leaves nothing to distribute');

  console.log('\nInvariant over random inputs');
  let violations = 0;
  for (let i = 0; i < 300; i++) {
    const turnover = Math.round(Math.random() * 5_000_000) / 100;
    const count = Math.floor(Math.random() * 12);
    const quals = Array.from({ length: count }, (_, k) => ({ qualificationId: `r${i}-${k}`, memberId: `M${k}`, slabId: 'S' }));
    const paid = new Map(quals.map((q) => [lifetimeKey(q.memberId, 'S'), Math.floor(Math.random() * 2_000_000)]));
    const plan = planSlabSettlement({
      turnover,
      slabs: [{ slabId: 'S', percent: Math.floor(Math.random() * 4) + 1, lifetimeLimit: 15000 }],
      qualifications: quals,
      paidPaiseByKey: paid,
    });
    const paidOut = plan.slabs[0].payouts.reduce((s, p) => s + p.plannedPaise, 0);
    const overCap = plan.slabs[0].payouts.some((p) => p.plannedPaise + p.lifetimeBeforePaise > 1500000);
    if (paidOut > plan.totalPoolPaise || overCap || plan.totalUndistributedPaise < 0) violations++;
  }
  assert(violations === 0, 'payouts never exceed the pool or any lifetime cap (300 random cases)', violations);

  console.log('\nSuperAdmin config validation');
  const defaults = validateConfigInput({ rpBvUnit: 1250, slabs: TEAM_PERFORMANCE_BONUS_DEFAULTS.SLABS });
  assert(defaults.slabs.length === 6, 'the six default slabs validate');
  assert(defaults.slabs[5].lifetimeLimit === 1500000 && defaults.slabs[5].leftRp === 25000, 'default 25,000:25,000 slab matches the image');
  const rejects = (input: any, pattern: RegExp, name: string) => {
    try {
      validateConfigInput(input);
      assert(false, name, 'accepted');
    } catch (error: any) {
      assert(error instanceof TeamPerformanceBonusError && pattern.test(error.message), name, error.message);
    }
  };
  const one = { slabId: 'X', leftRp: 10, rightRp: 10, percent: 3, lifetimeLimit: 10000 };
  rejects({ rpBvUnit: 0, slabs: [one] }, /RP conversion/, 'rejects a zero BV-per-RP conversion');
  rejects({ rpBvUnit: 1250, slabs: [] }, /At least one slab/, 'rejects an empty slab list');
  rejects({ rpBvUnit: 1250, slabs: [one, one] }, /used more than once/, 'rejects duplicate slab IDs');
  rejects({ rpBvUnit: 1250, slabs: [{ ...one, percent: 101 }] }, /between 0 and 100/, 'rejects a percentage above 100');
  rejects({ rpBvUnit: 1250, slabs: [{ ...one, leftRp: 0 }] }, /whole numbers/, 'rejects a zero RP requirement');
  rejects({ rpBvUnit: 1250, slabs: [{ ...one, lifetimeLimit: -1 }] }, /lifetime limit/, 'rejects a negative lifetime limit');
}

// ---------------------------------------------------------------------------------------------
// Database rules
// ---------------------------------------------------------------------------------------------

async function wipe() {
  await Promise.all(
    [
      Member, BinaryVolume, BVLedger, Wallet, WalletTransaction, CommissionLedger, AuditLog, TeamPerformanceBonusConfig,
      MemberRewardPoints, TeamPerformanceBonusQualification, TeamPerformanceBonusLifetime, TeamPerformanceBonusPayout,
      CompanyTurnoverPeriod,
    ].map((m: any) => m.deleteMany({}))
  );
}

let mobileSeq = 0;
const makeMember = (memberId: string, extra: Record<string, unknown> = {}) =>
  Member.create({
    memberId, name: `Member ${memberId}`, email: `${memberId.toLowerCase()}${DOMAIN}`, mobile: `94444${String(++mobileSeq).padStart(5, '0')}`,
    password: 'password123', sponsorId: '', status: 'active', isActive: true, ...extra,
  });

/** Sets the lifetime leg BV the binary tree holds for a member (what the engine maintains) */
const setLegs = (memberId: string, leftTotalBV: number, rightTotalBV: number) =>
  BinaryVolume.updateOne({ memberId }, { $set: { userId: memberId, leftTotalBV, rightTotalBV } }, { upsert: true });

const walletBalance = async (memberId: string) => (await Wallet.findOne({ memberId }))?.availableBalance || 0;

async function runDatabaseTests() {
  console.log('\nDatabase: qualification');
  await wipe();
  // Two balanced 10:10 members and one unequal member (10 RP left, 9 RP right)
  await makeMember('TP001', { isBinaryActive: true, personalBv: 1250 });
  await makeMember('TP002', { sponsorId: 'TP001', parentId: 'TP001', position: 'LEFT', binaryParentId: 'TP001', binaryPosition: 'LEFT', isBinaryActive: true, personalBv: 1250 });
  await makeMember('TP003', { sponsorId: 'TP001', parentId: 'TP001', position: 'RIGHT', binaryParentId: 'TP001', binaryPosition: 'RIGHT', isBinaryActive: true, personalBv: 1250 });
  await setLegs('TP001', 12500, 12500);
  await setLegs('TP002', 12500, 12500);
  await setLegs('TP003', 12500, 12499);
  await TeamPerformanceBonusService.getConfig();

  await TeamPerformanceBonusService.evaluateMember('TP001');
  await TeamPerformanceBonusService.evaluateMember('TP001');
  const tp001Quals = await TeamPerformanceBonusQualification.countDocuments({ memberId: 'TP001', slabId: 'TPB-10' });
  assert(tp001Quals === 1, 'repeated evaluation writes the 10:10 qualification once');

  await TeamPerformanceBonusService.evaluateMember('TP002');
  const unequal = await TeamPerformanceBonusService.evaluateMember('TP003');
  assert(unequal?.rightRP === 9 && unequal?.leftRP === 10, 'unequal team: 10 RP left, 9 RP right');
  assert((await TeamPerformanceBonusQualification.countDocuments({ memberId: 'TP003' })) === 0, 'unequal team does not qualify for 10:10');

  console.log('\nDatabase: settlement');
  const planned = await TeamPerformanceBonusService.previewSettlement({ ...PERIOD_A, overrideTurnover: 100000 });
  const slab10 = planned.slabs.find((s) => s.slabId === 'TPB-10');
  assert(planned.totalPool === 12000, 'pool total = 12% of turnover across all six slabs (3+3+2+2+1+1)');
  assert(slab10?.eligibleCount === 2 && slab10?.equalShare === 1500, 'two members share the 10:10 pool equally');
  assert(planned.turnoverSource === 'OVERRIDE', 'preview reports an overridden turnover');
  assert((await CompanyTurnoverPeriod.countDocuments()) === 0, 'preview writes no settlement');

  const first = await TeamPerformanceBonusService.executeSettlement({ ...PERIOD_A, overrideTurnover: 100000 }, ACTOR);
  assert(!first.alreadySettled && first.period.status === 'COMPLETED', 'first run settles the period');
  assert((await walletBalance('TP001')) === 1500 && (await walletBalance('TP002')) === 1500, 'each qualifier is credited ₹1,500');
  assert((await walletBalance('TP003')) === 0, 'the unequal member is credited nothing');
  assert((await CommissionLedger.countDocuments({ type: 'TEAM_PERFORMANCE_BONUS' })) === 2, 'one income ledger row per payout');

  const again = await TeamPerformanceBonusService.executeSettlement({ ...PERIOD_A, overrideTurnover: 100000 }, ACTOR);
  assert(again.alreadySettled === true, 'repeating a settled period reports alreadySettled');
  assert((await walletBalance('TP001')) === 1500, 'repeating a settlement does not pay twice');
  assert((await TeamPerformanceBonusPayout.countDocuments({ periodId: first.period.periodId })) === 2, 'still exactly two payouts');

  console.log('\nDatabase: concurrent settlement');
  await makeMember('TP004', { sponsorId: 'TP001', parentId: 'TP002', position: 'LEFT', binaryParentId: 'TP002', binaryPosition: 'LEFT', isBinaryActive: true, personalBv: 1250 });
  await setLegs('TP004', 12500, 12500);
  await Promise.all([
    TeamPerformanceBonusService.executeSettlement({ ...PERIOD_B, overrideTurnover: 100000 }, ACTOR),
    TeamPerformanceBonusService.executeSettlement({ ...PERIOD_B, overrideTurnover: 100000 }, ACTOR),
    TeamPerformanceBonusService.executeSettlement({ ...PERIOD_B, overrideTurnover: 100000 }, ACTOR),
  ]);
  const periodBPayouts = await TeamPerformanceBonusPayout.find({ periodId: `TPB-PERIOD-${PERIOD_B.periodStart}-${PERIOD_B.periodEnd}`, slabId: 'TPB-10' }).lean();
  assert(periodBPayouts.length === 1, 'three concurrent runs make exactly one payout for the new 10:10 qualifier');
  assert((await walletBalance('TP004')) === 3000, 'concurrent runs credit the member once (₹3,000 sole-member share)');
  assert((await CommissionLedger.countDocuments({ memberId: 'TP004', type: 'TEAM_PERFORMANCE_BONUS' })) === 1, 'one income ledger row, not three');

  console.log('\nDatabase: lifetime cap exhaustion');
  // TP006 has ₹9,990 of the ₹10,000 10:10 lifetime limit and qualifies now; TP005 is a fresh qualifier
  await makeMember('TP005', { sponsorId: 'TP001', parentId: 'TP002', position: 'RIGHT', binaryParentId: 'TP002', binaryPosition: 'RIGHT', isBinaryActive: true, personalBv: 1250 });
  await makeMember('TP006', { sponsorId: 'TP001', parentId: 'TP003', position: 'LEFT', binaryParentId: 'TP003', binaryPosition: 'LEFT', isBinaryActive: true, personalBv: 1250 });
  await setLegs('TP005', 12500, 12500);
  await setLegs('TP006', 12500, 12500);
  await TeamPerformanceBonusLifetime.create({ memberId: 'TP006', slabId: 'TPB-10', paidPaise: 999000 });
  await TeamPerformanceBonusService.evaluateMember('TP005');
  await TeamPerformanceBonusService.evaluateMember('TP006');
  const capRun = await TeamPerformanceBonusService.executeSettlement({ ...PERIOD_C, overrideTurnover: 100000 }, ACTOR);
  const payoutFresh = await TeamPerformanceBonusPayout.findOne({ memberId: 'TP005', slabId: 'TPB-10' }).lean();
  const payoutCapped = await TeamPerformanceBonusPayout.findOne({ memberId: 'TP006', slabId: 'TPB-10' }).lean();
  assert(payoutFresh?.actualPayout === 1500, 'fresh 10:10 member is paid the full equal share (₹1,500 of ₹3,000 across two)');
  assert(payoutCapped?.actualPayout === 10, 'member at ₹9,990 of ₹10,000 is paid only the ₹10 left');
  const cappedStatus = await TeamPerformanceBonusService.getMemberStatus('TP006');
  assert(cappedStatus.slabs.find((s) => s.slabId === 'TPB-10')?.remainingLifetime === 0, 'capped member shows zero remaining lifetime on that slab');
  assert(capRun.period.slabResults.find((s) => s.slabId === 'TPB-10')?.undistributed === 1490, 'the capped ₹1,490 stays with the company');

  console.log('\nDatabase: configuration and audit');
  const cfg = await TeamPerformanceBonusService.updateConfig(
    { rpBvUnit: 1250, slabs: [{ slabId: 'TPB-10', leftRp: 10, rightRp: 10, percent: 4, lifetimeLimit: 20000, isActive: false }] },
    ACTOR
  );
  assert(cfg.slabs.length === 1 && cfg.slabs[0].isActive === false, 'SuperAdmin can deactivate and edit slabs without code changes');
  assert((await AuditLog.countDocuments({ action: 'TEAM_PERFORMANCE_BONUS_CONFIG_UPDATED' })) === 1, 'configuration change is audit logged');
  await expectError(
    () => TeamPerformanceBonusService.previewSettlement({ periodStart: '2999-01-01', periodEnd: '2999-01-07' }),
    /has not finished/,
    'an unfinished period cannot be settled'
  );
  await expectError(
    () => TeamPerformanceBonusService.previewSettlement({ periodStart: '2026-02-10', periodEnd: '2026-02-01' }),
    /start on or before/,
    'a period must end after it starts'
  );
  await expectError(
    () => TeamPerformanceBonusService.previewSettlement({ periodStart: 'Jan 5', periodEnd: '2026-01-11' }),
    /YYYY-MM-DD/,
    'period dates must be ISO dates'
  );
}

async function main() {
  runPureTests();

  if (!MONGODB_URI) {
    console.log('\nMONGODB_URI not set: database tests skipped.');
  } else {
    if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGODB_URI)) {
      console.error('Refusing to run: set MONGODB_URI to a local replica-set test database (mongodb://127.0.0.1:...).');
      process.exit(1);
    }
    await mongoose.connect(MONGODB_URI);
    await Promise.all([
      Member.init(), BinaryVolume.init(), Wallet.init(), WalletTransaction.init(), CommissionLedger.init(),
      TeamPerformanceBonusPayout.init(), CompanyTurnoverPeriod.init(), TeamPerformanceBonusQualification.init(),
      TeamPerformanceBonusLifetime.init(), MemberRewardPoints.init(), TeamPerformanceBonusConfig.init(), AuditLog.init(),
    ]);
    try {
      await runDatabaseTests();
    } finally {
      await wipe();
      await mongoose.disconnect();
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
