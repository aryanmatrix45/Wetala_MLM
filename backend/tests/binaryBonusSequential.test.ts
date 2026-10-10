import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database';
import { Member } from '../src/models/Member.model';
import { BinaryVolume } from '../src/models/BinaryVolume.model';
import { BVLedger } from '../src/models/BVLedger.model';
import { CommissionLedger } from '../src/models/CommissionLedger.model';
import { CompensationEvent } from '../src/models/CompensationEvent.model';
import { Purchase } from '../src/models/Purchase.model';
import { BinaryBonusService } from '../src/services/compensation/BinaryBonusService';
import { CompensationEngine } from '../src/services/compensation/CompensationEngine';
import { BVService } from '../src/services/BVService';
import { BINARY_POSITION, BV_SOURCE_TYPE, PURCHASE_TYPE } from '../src/config/constants';

interface TestCase {
  name: string;
  fn: () => Promise<void>;
}

const tests: TestCase[] = [];
function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn });
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message} (Expected: ${expected}, Got: ${actual})`);
  }
}

let mobileCounter = Math.floor(Math.random() * 100000);
function getUniqueMobile() {
  mobileCounter++;
  const timeSuffix = String(Date.now()).slice(-5);
  return `9${timeSuffix}${String(mobileCounter).slice(-4)}`;
}

// Helper to create or reset a test member with sponsor-qualified Left and Right downlines
async function setupTestMember(prefix: string) {
  const rootId = `TEST-${prefix}-ROOT`;
  const leftChildId = `TEST-${prefix}-L1`;
  const rightChildId = `TEST-${prefix}-R1`;

  // Clean previous records for this prefix
  const allIds = [rootId, leftChildId, rightChildId];
  await Member.deleteMany({ memberId: { $in: allIds } });
  await BinaryVolume.deleteMany({ memberId: { $in: allIds } });
  await BVLedger.deleteMany({ memberId: { $in: allIds } });
  await CommissionLedger.deleteMany({ memberId: { $in: allIds } });
  await CompensationEvent.deleteMany({ memberId: { $in: allIds } });

  // 1. Root member
  const root = await Member.create({
    memberId: rootId,
    name: `Root Member ${prefix}`,
    email: `${prefix.toLowerCase()}_root_${Date.now()}@test.com`,
    mobile: getUniqueMobile(),
    password: 'password123',
    sponsorId: 'ADMIN',
    parentId: '',
    position: undefined,
    role: 'member',
    rank: 'Distributor',
    status: 'active',
    approvalStatus: 'approved',
    isActive: true,
    isBinaryActive: true,
    personalBv: 100,
    dailyCapping: 4000,
    joinedAt: new Date(),
    joinDate: '2026-01-01',
  });

  // 2. Left child personally sponsored by Root and placed on Root's LEFT
  await Member.create({
    memberId: leftChildId,
    name: `Left Child ${prefix}`,
    email: `${prefix.toLowerCase()}_left_${Date.now()}@test.com`,
    mobile: getUniqueMobile(),
    password: 'password123',
    sponsorId: rootId, // Sponsored by Root
    parentId: rootId,   // Placed under Root
    position: BINARY_POSITION.LEFT,
    binaryPosition: BINARY_POSITION.LEFT,
    role: 'member',
    status: 'active',
    approvalStatus: 'approved',
    isActive: true,
    isBinaryActive: true,
    personalBv: 100,
    joinedAt: new Date(),
    joinDate: '2026-01-01',
  });

  // 3. Right child personally sponsored by Root and placed on Root's RIGHT
  await Member.create({
    memberId: rightChildId,
    name: `Right Child ${prefix}`,
    email: `${prefix.toLowerCase()}_right_${Date.now()}@test.com`,
    mobile: getUniqueMobile(),
    password: 'password123',
    sponsorId: rootId, // Sponsored by Root
    parentId: rootId,   // Placed under Root
    position: BINARY_POSITION.RIGHT,
    binaryPosition: BINARY_POSITION.RIGHT,
    role: 'member',
    status: 'active',
    approvalStatus: 'approved',
    isActive: true,
    isBinaryActive: true,
    personalBv: 100,
    joinedAt: new Date(),
    joinDate: '2026-01-01',
  });

  const vol = await BinaryVolume.create({
    memberId: rootId,
    userId: root._id.toString(),
    leftTotalBV: 0,
    rightTotalBV: 0,
    matchedTotalBV: 0,
    leftAvailableBV: 0,
    rightAvailableBV: 0,
    leftCarryForwardBV: 0,
    rightCarryForwardBV: 0,
    payoutCount: 0,
    reservedSide: null,
    reservedBV: 0,
    consumedBinaryMemberIds: [],
  });

  return { root, vol, rootId, leftChildId, rightChildId };
}

// ==========================================
// TEST CASES
// ==========================================

test('1. First payout with 2,500 BV on left and 1,250 BV on right', async () => {
  const { root, vol, rootId } = await setupTestMember('TC1');
  const rules = await CompensationEngine.getActiveRules();

  // Set Left 2500, Right 1250
  vol.leftTotalBV = 2500;
  vol.leftAvailableBV = 2500;
  vol.rightTotalBV = 1250;
  vol.rightAvailableBV = 1250;
  await vol.save();

  const result = await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  assertEqual(result.totalGeneratedIncome, 250, 'Total generated income should be 250');
  assertEqual(result.cycles.length, 1, 'Should have 1 cycle');
  assertEqual(result.cycles[0].stage, 'FIRST_PAYOUT', 'Stage should be FIRST_PAYOUT');
  assertEqual(result.cycles[0].ratio, '2:1', 'Ratio should be 2:1');
  assertEqual(result.payoutCount, 1, 'Payout count should be 1');
  assertEqual(result.reservedBV, 2500, 'Left 2500 BV should be reserved');
  assertEqual(result.reservedSide, 'LEFT', 'Reserved side should be LEFT');
  assertEqual(result.leftAvailableBV, 0, 'Left available should be 0 (2500 moved to reserved)');
  assertEqual(result.rightAvailableBV, 0, 'Right available should be 0 (1250 consumed)');

  // Verify BVLedger entries created
  const ledgers = await BVLedger.find({ memberId: rootId, payoutSequence: 1 });
  assert(ledgers.length >= 2, 'Should create BVLedger entries for consumed and reserved volume');
});

test('2. First payout with 2,500 BV on right and 1,250 BV on left', async () => {
  const { vol, rootId } = await setupTestMember('TC2');
  const rules = await CompensationEngine.getActiveRules();

  // Set Left 1250, Right 2500
  vol.leftTotalBV = 1250;
  vol.leftAvailableBV = 1250;
  vol.rightTotalBV = 2500;
  vol.rightAvailableBV = 2500;
  await vol.save();

  const result = await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  assertEqual(result.totalGeneratedIncome, 250, 'Total generated income should be 250');
  assertEqual(result.cycles[0].stage, 'FIRST_PAYOUT', 'Stage should be FIRST_PAYOUT');
  assertEqual(result.cycles[0].ratio, '1:2', 'Ratio should be 1:2');
  assertEqual(result.payoutCount, 1, 'Payout count should be 1');
  assertEqual(result.reservedBV, 2500, 'Right 2500 BV should be reserved');
  assertEqual(result.reservedSide, 'RIGHT', 'Reserved side should be RIGHT');
  assertEqual(result.leftAvailableBV, 0, 'Left available should be 0 (1250 consumed)');
  assertEqual(result.rightAvailableBV, 0, 'Right available should be 0 (2500 moved to reserved)');
});

test('3. Preservation of 2,500 BV after the first payout', async () => {
  const { vol, rootId } = await setupTestMember('TC3');
  const rules = await CompensationEngine.getActiveRules();

  // Trigger first payout
  vol.leftAvailableBV = 2500;
  vol.rightAvailableBV = 1250;
  await vol.save();
  await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  // Re-read BinaryVolume directly from DB
  const updatedVol = await BinaryVolume.findOne({ memberId: rootId });
  assert(updatedVol !== null, 'BinaryVolume must exist');
  assertEqual(updatedVol!.reservedBV, 2500, 'Reserved BV must remain 2500');
  assertEqual(updatedVol!.reservedSide, 'LEFT', 'Reserved side must be LEFT');
  assertEqual(updatedVol!.leftAvailableBV, 0, 'Available BV cannot include reserved BV');
  assertEqual(updatedVol!.payoutCount, 1, 'Payout count must remain 1');

  // Running calculate again without new volume should not produce another payout
  const rerun = await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);
  assertEqual(rerun.totalGeneratedIncome, 0, 'Rerun without new volume should produce 0 payout');
  assertEqual(rerun.reservedBV, 2500, 'Reserved BV must still be 2500');
});

test('4. Second payout triggered by an additional 1,250 BV on the opposite side', async () => {
  const { vol, rootId } = await setupTestMember('TC4');
  const rules = await CompensationEngine.getActiveRules();

  // 1st payout: Left 2500, Right 1250
  vol.leftAvailableBV = 2500;
  vol.rightAvailableBV = 1250;
  await vol.save();
  await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  // Now an additional 1250 BV arrives on Right
  const volAfterFirst = await BinaryVolume.findOne({ memberId: rootId });
  volAfterFirst!.rightAvailableBV += 1250;
  await volAfterFirst!.save();

  // Run second payout
  const result2 = await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  assertEqual(result2.totalGeneratedIncome, 250, 'Second payout should generate 250');
  assertEqual(result2.cycles[0].stage, 'SECOND_PAYOUT', 'Cycle stage should be SECOND_PAYOUT');
  assertEqual(result2.payoutCount, 2, 'Payout count should advance to 2');
  assertEqual(result2.reservedBV, 0, 'Reserved BV should now be consumed (0)');
  assertEqual(result2.reservedSide, null, 'Reserved side should be null');
  assertEqual(result2.rightAvailableBV, 0, 'Right available should be 0');

  // Verify BVLedger record for 2nd payout
  const ledger2 = await BVLedger.findOne({ memberId: rootId, payoutSequence: 2 });
  assert(ledger2 !== null, 'BVLedger for second payout must exist');
});

test('5. Correct behavior when required second-side BV has not yet arrived (< 1,250 BV)', async () => {
  const { vol, rootId } = await setupTestMember('TC5');
  const rules = await CompensationEngine.getActiveRules();

  // 1st payout: Left 2500, Right 1250
  vol.leftAvailableBV = 2500;
  vol.rightAvailableBV = 1250;
  await vol.save();
  await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  // Only 500 BV arrives on Right (not enough, needs 1250)
  const volAfterFirst = await BinaryVolume.findOne({ memberId: rootId });
  volAfterFirst!.rightAvailableBV = 500;
  await volAfterFirst!.save();

  const result = await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  assertEqual(result.totalGeneratedIncome, 0, 'No payout should be generated');
  assertEqual(result.payoutCount, 1, 'Payout count must remain 1');
  assertEqual(result.reservedBV, 2500, 'Reserved BV must remain 2500');
  assertEqual(result.reservedSide, 'LEFT', 'Reserved side must remain LEFT');
  assertEqual(result.rightAvailableBV, 500, 'Right available BV must remain 500');
});

test('6. Third payout using 1,250:1,250', async () => {
  const { vol, rootId } = await setupTestMember('TC6');
  const rules = await CompensationEngine.getActiveRules();

  // Simulate completion of 1st and 2nd payout
  vol.payoutCount = 2;
  vol.reservedBV = 0;
  vol.reservedSide = null;
  vol.leftAvailableBV = 1250;
  vol.rightAvailableBV = 1250;
  await vol.save();

  const result = await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  assertEqual(result.totalGeneratedIncome, 250, 'Third payout should generate 250');
  assertEqual(result.cycles[0].stage, 'SUBSEQUENT', 'Stage should be SUBSEQUENT');
  assertEqual(result.cycles[0].ratio, '1:1', 'Ratio should be 1:1');
  assertEqual(result.payoutCount, 3, 'Payout count should be 3');
  assertEqual(result.leftAvailableBV, 0, 'Left available should be 0');
  assertEqual(result.rightAvailableBV, 0, 'Right available should be 0');
});

test('7. Repeated subsequent payouts using 1,250:1,250', async () => {
  const { vol, rootId } = await setupTestMember('TC7');
  const rules = await CompensationEngine.getActiveRules();

  // Already completed 2 payouts
  vol.payoutCount = 2;
  vol.leftAvailableBV = 2500;
  vol.rightAvailableBV = 2500;
  await vol.save();

  const result = await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  assertEqual(result.totalGeneratedIncome, 500, 'Should generate 2 cycles @ 250 = 500');
  assertEqual(result.cycles.length, 2, 'Should complete 2 cycles');
  assertEqual(result.cycles[0].stage, 'SUBSEQUENT', 'Cycle 1 stage should be SUBSEQUENT');
  assertEqual(result.cycles[1].stage, 'SUBSEQUENT', 'Cycle 2 stage should be SUBSEQUENT');
  assertEqual(result.payoutCount, 4, 'Payout count should be 4 (2 + 2)');
  assertEqual(result.leftAvailableBV, 0, 'Left available should be 0');
  assertEqual(result.rightAvailableBV, 0, 'Right available should be 0');
});

test('8. Carry-forward of excess BV in Stage 3', async () => {
  const { vol, rootId } = await setupTestMember('TC8');
  const rules = await CompensationEngine.getActiveRules();

  // Stage 3 member with 3,000 Left and 1,250 Right
  vol.payoutCount = 2;
  vol.leftAvailableBV = 3000;
  vol.rightAvailableBV = 1250;
  await vol.save();

  const result = await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  assertEqual(result.totalGeneratedIncome, 250, 'Should complete 1 cycle @ 250');
  assertEqual(result.payoutCount, 3, 'Payout count should be 3');
  assertEqual(result.leftAvailableBV, 1750, 'Left available should carry forward 1750 (3000 - 1250)');
  assertEqual(result.rightAvailableBV, 0, 'Right available should be 0 (1250 - 1250)');
});

test('9. Newly generated BV propagating correctly to uplines', async () => {
  const { rootId, leftChildId } = await setupTestMember('TC9');

  // Purchase of 1250 BV by LeftChild
  const ancestors = await BVService.distributeVolumeToAncestors(
    leftChildId,
    1250,
    BV_SOURCE_TYPE.REPURCHASE,
    'TEST-PURCHASE-TC9'
  );

  assert(ancestors.length >= 1, 'Should find at least 1 binary ancestor');
  const rootAncestor = ancestors.find((a) => a.ancestorMemberId === rootId);
  assert(rootAncestor !== undefined, 'Root must be in binary ancestors');
  assertEqual(rootAncestor!.leg, BINARY_POSITION.LEFT, 'Leg of origin should be LEFT');

  const rootVol = await BinaryVolume.findOne({ memberId: rootId });
  assertEqual(rootVol!.leftTotalBV, 1250, 'Root leftTotalBV must receive 1250');
  assertEqual(rootVol!.leftAvailableBV, 1250, 'Root leftAvailableBV must receive 1250');
});

test('10. Prevention of duplicate BV allocation and duplicate payouts (Idempotency)', async () => {
  const { rootId, leftChildId } = await setupTestMember('TC10');

  // Create a purchase record
  const purchaseId = `PURCHASE-IDEMP-TC10`;
  await Purchase.deleteOne({ purchaseId });
  const purchase = await Purchase.create({
    purchaseId,
    userId: leftChildId,
    memberId: leftChildId,
    transactionId: 'TX-IDEMP-TC10',
    paymentStatus: 'PAID',
    type: PURCHASE_TYPE.JOINING,
    totalAmount: 3000,
    totalAmountInPaise: 300000,
    totalBV: 1250,
    status: 'COMPLETED',
  });

  // 1st run
  const res1 = await CompensationEngine.processPurchaseCompleted(purchaseId);
  assertEqual(res1.isSuccess, true, 'First run must succeed');
  assertEqual(Boolean(res1.isIdempotentSkip), false, 'First run should not be idempotent skip');

  // 2nd run with the exact same purchaseId
  const res2 = await CompensationEngine.processPurchaseCompleted(purchaseId);
  assertEqual(res2.isSuccess, true, 'Second run must succeed');
  assertEqual(Boolean(res2.isIdempotentSkip), true, 'Second run MUST be skipped by idempotency guard');

  await Purchase.deleteOne({ purchaseId });
});

test('11. Correct sponsor/member eligibility checks', async () => {
  const prefix = 'TC11';
  const rootId = `TEST-${prefix}-ROOT`;
  const leftChildId = `TEST-${prefix}-L1`;
  const rightChildId = `TEST-${prefix}-R1`;

  await Member.deleteMany({ memberId: { $in: [rootId, leftChildId, rightChildId] } });
  await BinaryVolume.deleteMany({ memberId: { $in: [rootId, leftChildId, rightChildId] } });

  // Root with no direct referrals
  const root = await Member.create({
    memberId: rootId,
    name: 'Unqualified Root',
    email: `unqual_root_${Date.now()}@test.com`,
    mobile: getUniqueMobile(),
    password: 'password123',
    sponsorId: 'ADMIN',
    role: 'member',
    status: 'active',
    approvalStatus: 'approved',
    isActive: true,
    isBinaryActive: true,
    personalBv: 100,
    dailyCapping: 4000,
    joinedAt: new Date(),
    joinDate: '2026-01-01',
  });

  // Left child sponsored by SOMEONE ELSE (not root)
  await Member.create({
    memberId: leftChildId,
    name: 'Left Child Other Sponsor',
    email: `left_other_${Date.now()}@test.com`,
    mobile: getUniqueMobile(),
    password: 'password123',
    sponsorId: 'SOMEONE_ELSE', // NOT rootId
    parentId: rootId,
    position: BINARY_POSITION.LEFT,
    role: 'member',
    status: 'active',
    approvalStatus: 'approved',
    isActive: true,
    joinedAt: new Date(),
    joinDate: '2026-01-01',
  });

  // Right child also sponsored by SOMEONE ELSE
  await Member.create({
    memberId: rightChildId,
    name: 'Right Child Other Sponsor',
    email: `right_other_${Date.now()}@test.com`,
    mobile: getUniqueMobile(),
    password: 'password123',
    sponsorId: 'SOMEONE_ELSE', // NOT rootId
    parentId: rootId,
    position: BINARY_POSITION.RIGHT,
    role: 'member',
    status: 'active',
    approvalStatus: 'approved',
    isActive: true,
    joinedAt: new Date(),
    joinDate: '2026-01-01',
  });

  const vol = await BinaryVolume.create({
    memberId: rootId,
    userId: root._id.toString(),
    leftAvailableBV: 2500,
    rightAvailableBV: 1250,
    payoutCount: 0,
    reservedBV: 0,
  });

  const rules = await CompensationEngine.getActiveRules();
  const result = await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  assertEqual(result.isSponsorQualified, false, 'Member without directs on both sides must be unqualified');
  assertEqual(result.totalGeneratedIncome, 0, 'Unqualified member cannot earn binary income');
  assertEqual(result.payoutCount, 0, 'Payout count must remain 0');
});

test('12. Existing daily cap enforcement', async () => {
  const { vol, rootId, root } = await setupTestMember('TC12');
  const rules = await CompensationEngine.getActiveRules();

  // Root daily cap = ₹500 (2 cycles max)
  root.dailyCapping = 500;
  await root.save();

  // Volume for 5 cycles: member in Stage 3 with 6,250 on both sides = 5 cycles @ 250 = ₹1,250
  vol.payoutCount = 2;
  vol.leftAvailableBV = 6250;
  vol.rightAvailableBV = 6250;
  await vol.save();

  const result = await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  assertEqual(result.totalGeneratedIncome, 1250, 'Total generated should be 1250 (5 * 250)');
  assertEqual(result.payableIncome, 500, 'Payable income must be capped at 500');
  assertEqual(result.excessAmount, 750, 'Excess amount must be 750 (1250 - 500)');
});

test('13. Concurrent / Multi-stage sequential purchase processing', async () => {
  const { vol, rootId } = await setupTestMember('TC13');
  const rules = await CompensationEngine.getActiveRules();

  // Member receives 2500 Left and 2500 Right in one go
  vol.leftAvailableBV = 2500;
  vol.rightAvailableBV = 2500;
  await vol.save();

  // Should process Stage 1 (2500:1250, Left reserved) AND immediately proceed to Stage 2 (1250 Right matches reserved 2500 Left)
  const result = await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  assertEqual(result.totalGeneratedIncome, 500, 'Should generate 500 across 2 sequential payouts');
  assertEqual(result.cycles.length, 2, 'Should execute 2 sequential cycles');
  assertEqual(result.cycles[0].stage, 'FIRST_PAYOUT', 'First cycle should be FIRST_PAYOUT');
  assertEqual(result.cycles[1].stage, 'SECOND_PAYOUT', 'Second cycle should be SECOND_PAYOUT');
  assertEqual(result.payoutCount, 2, 'Payout count should be 2');
  assertEqual(result.reservedBV, 0, 'Reserved BV should be consumed');
  assertEqual(result.leftAvailableBV, 0, 'Left available should be 0');
  assertEqual(result.rightAvailableBV, 0, 'Right available should be 0');
});

test('14. Verification that reserved BV cannot be consumed by an unrelated cycle', async () => {
  const { vol, rootId } = await setupTestMember('TC14');
  const rules = await CompensationEngine.getActiveRules();

  // Stage 1 completed: Left 2500 is reserved, Right 0
  vol.payoutCount = 1;
  vol.reservedSide = 'LEFT';
  vol.reservedBV = 2500;
  vol.leftAvailableBV = 1250; // New BV arrived on Left
  vol.rightAvailableBV = 0;   // Still 0 on Right
  await vol.save();

  const result = await BinaryBonusService.calculateBinaryIncomeForMember(rootId, rules);

  assertEqual(result.totalGeneratedIncome, 0, 'No payout should occur because Right has 0 BV');
  assertEqual(result.reservedBV, 2500, 'Reserved 2500 BV must remain untouched');
  assertEqual(result.reservedSide, 'LEFT', 'Reserved side must remain LEFT');
  assertEqual(result.leftAvailableBV, 1250, 'New Left BV must remain available and not merged with reserved');
  assertEqual(result.payoutCount, 1, 'Payout count must remain 1');
});

// ==========================================
// TEST RUNNER
// ==========================================

async function runAllTests() {
  console.log('\n=============================================================');
  console.log('       RUNNING SEQUENTIAL BINARY BONUS TEST SUITE             ');
  console.log('=============================================================\n');

  await connectDB();

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  [PASS] ${t.name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] ${t.name}`);
      console.error(`         Error: ${err.message}\n`);
      failed++;
    }
  }

  console.log('\n=============================================================');
  console.log(`TEST SUMMARY: Total: ${tests.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('=============================================================\n');

  await disconnectDB();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch(async (e) => {
  console.error('Fatal test runner error:', e);
  await disconnectDB();
  process.exit(1);
});
