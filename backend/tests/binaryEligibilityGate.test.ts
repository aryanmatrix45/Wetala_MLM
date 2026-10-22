/**
 * Binary eligibility gate: other income (team performance, rank rewards, sponsor, welcome bonus) is
 * paid only to members who are active, not blocked, binary active (100 BV reached) and placed in the binary tree. Members who are not binary active do not
 * sit in the tree, and new people are placed under the nearest placed member above them.
 *
 * The pure rules always run. The database tests need a local replica set:
 *   MONGODB_URI="mongodb://127.0.0.1:27027/wetala_gate_test?replicaSet=rs0" npx tsx tests/binaryEligibilityGate.test.ts
 */
import mongoose from 'mongoose';
import { Member } from '../src/models/Member.model';
import { BinaryVolume } from '../src/models/BinaryVolume.model';
import { TeamPerformanceBonusQualification } from '../src/models/TeamPerformanceBonusQualification.model';
import { MemberRewardPoints } from '../src/models/MemberRewardPoints.model';
import { TeamPerformanceBonusConfig } from '../src/models/TeamPerformanceBonusConfig.model';
import { TeamPerformanceBonusService } from '../src/services/compensation/TeamPerformanceBonusService';
import { BinaryTreeService } from '../src/services/tree/BinaryTreeService';
import { canEarnBonus, isBinaryActive, isInBinaryTree, referralBlockReason } from '../src/utils/binaryEligibility';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DOMAIN = '@test-gate.com';

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

function runPureTests() {
  console.log('\nEligibility rule (pure)');
  const placedActive = { isActive: true, status: 'active', isBinaryActive: true, personalBv: 100, parentId: 'ROOT', sponsorId: 'ROOT' };
  assert(canEarnBonus(placedActive), 'binary active and placed in the tree can earn');
  assert(canEarnBonus({ ...placedActive, personalBv: 100, isBinaryActive: false }), '100 BV personal volume counts as binary active (existing rule)');
  assert(!canEarnBonus({ ...placedActive, personalBv: 99, isBinaryActive: false }), '99 BV is not binary active');
  assert(!canEarnBonus({ ...placedActive, isBinaryActive: false, personalBv: 0 }), 'not binary active cannot earn');
  assert(!canEarnBonus({ ...placedActive, parentId: '', sponsorId: 'ROOT' }), 'binary active but not placed in the tree cannot earn');
  assert(canEarnBonus({ ...placedActive, parentId: '', sponsorId: '' }), 'the root (no sponsor) is in the tree and can earn');
  assert(!canEarnBonus({ ...placedActive, isActive: false }), 'inactive account cannot earn');
  assert(!canEarnBonus({ ...placedActive, status: 'blocked' }), 'blocked account cannot earn');
  assert(!canEarnBonus(null) && !canEarnBonus(undefined), 'missing member cannot earn');
  assert(isBinaryActive({ isBinaryActive: false, personalBv: 150 }) && isInBinaryTree({ parentId: '', sponsorId: '' }), 'helpers agree with the rule');
  assert(!isInBinaryTree({ parentId: '', sponsorId: 'ROOT' }), 'a sponsored member with no binary parent is outside the tree');

  console.log('\nReferral rule (pure)');
  assert(referralBlockReason(placedActive) === null, 'a binary-active member in the tree can refer');
  assert(referralBlockReason({ ...placedActive, isBinaryActive: false, personalBv: 99 }) !== null, 'not binary active cannot refer');
  assert(referralBlockReason({ ...placedActive, parentId: '' }) !== null, 'binary active but not yet placed cannot refer');
  assert(referralBlockReason({ ...placedActive, status: 'blocked' }) !== null && referralBlockReason({ ...placedActive, isActive: false }) !== null,
    'blocked or inactive accounts cannot refer');
  assert(referralBlockReason({ isActive: false, isBinaryActive: false, personalBv: 0, parentId: '', sponsorId: '' }) === null,
    'the root can always refer, with no BV');
  assert(referralBlockReason(null) !== null, 'missing sponsor cannot refer');
}

let mobileSeq = 0;
const makeMember = (memberId: string, extra: Record<string, unknown> = {}) =>
  Member.create({
    memberId, name: `Member ${memberId}`, email: `${memberId.toLowerCase()}${DOMAIN}`, mobile: `95555${String(++mobileSeq).padStart(5, '0')}`,
    password: 'password123', sponsorId: '', status: 'active', isActive: true, ...extra,
  });

async function runDatabaseTests() {
  await Promise.all(
    [Member, BinaryVolume, TeamPerformanceBonusQualification, MemberRewardPoints, TeamPerformanceBonusConfig].map((m: any) => m.deleteMany({}))
  );

  console.log('\nDatabase: team performance bonus gate');
  // Root MEM-G1 is placed. G2 has the volume for 10:10 but is not binary active. G3 is binary active.
  await makeMember('GT001', { isBinaryActive: true, personalBv: 1250, parentId: '', sponsorId: '' });
  await makeMember('GT002', { sponsorId: 'GT001', isBinaryActive: false, personalBv: 0, parentId: '' });
  await BinaryVolume.create({ memberId: 'GT002', userId: 'GT002', leftTotalBV: 12500, rightTotalBV: 12500 });
  await TeamPerformanceBonusService.getConfig();

  await TeamPerformanceBonusService.evaluateMember('GT002');
  assert(
    (await TeamPerformanceBonusQualification.countDocuments({ memberId: 'GT002' })) === 0,
    'a member who is not binary active does not qualify, even with the volume'
  );

  // Activation and placement under the root's LEFT leg
  await Member.updateOne({ memberId: 'GT002' }, { $set: { isBinaryActive: true, personalBv: 100, parentId: 'GT001', position: 'LEFT', binaryParentId: 'GT001', binaryPosition: 'LEFT' } });
  await TeamPerformanceBonusService.evaluateMember('GT002');
  assert(
    (await TeamPerformanceBonusQualification.countDocuments({ memberId: 'GT002' })) >= 1,
    'once binary active and placed in the tree, the same volume qualifies'
  );

  console.log('\nDatabase: placing new people');
  // GT005 is sponsored by the root and has 20 BV, so it is not in the tree.
  // GT006 is sponsored by GT005 and prefers LEFT.
  await makeMember('GT005', { sponsorId: 'GT001', isBinaryActive: false, personalBv: 20, parentId: '' });
  await makeMember('GT006', { sponsorId: 'GT005', preferredLeg: 'LEFT', parentId: '', isBinaryActive: false, personalBv: 0 });
  const notYet = await BinaryTreeService.placeMemberInBinaryTree('GT006');
  assert(notYet === null, 'a member with no 100 BV cannot be placed in the tree');
  const unplacedFlag = await Member.findOne({ memberId: 'GT006' }).lean();
  assert(!unplacedFlag?.parentId && unplacedFlag?.isBinaryActive === false, 'an unplaced member stays inactive and outside the tree');

  // GT006 reaches 100 BV and is placed. Its sponsor GT005 is not in the tree, so the nearest placed upline is used.
  await Member.updateOne({ memberId: 'GT006' }, { $set: { isBinaryActive: true, personalBv: 100 } });
  const under = await BinaryTreeService.placeMemberInBinaryTree('GT006');
  assert(!!under && under.parentId !== 'GT005', 'a new person is placed under a placed member, never an unplaced sponsor');
  const placed = await Member.findOne({ memberId: 'GT006' }).lean();
  assert(!!placed?.parentId && placed.isBinaryActive === true, 'after reaching 100 BV the new person is in the tree');
  const parent = await Member.findOne({ memberId: placed?.parentId }).lean();
  assert(!!parent && (!!parent.parentId || parent.memberId === 'GT001'), 'the new person sits under a placed member');
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
    try {
      await runDatabaseTests();
    } finally {
      await Promise.all(
        [Member, BinaryVolume, TeamPerformanceBonusQualification, MemberRewardPoints, TeamPerformanceBonusConfig].map((m: any) => m.deleteMany({}))
      );
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
