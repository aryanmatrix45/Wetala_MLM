import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Member } from '../src/models/Member.model';
import { WelcomeBonusService } from '../src/services/compensation/WelcomeBonusService';
import { BVService } from '../src/services/BVService';
import { BV_SOURCE_TYPE, BINARY_POSITION } from '../src/config/constants';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wetala_mlm';

async function runTest() {
  console.log('\n=============================================================');
  console.log(' TESTING WELCOME BONUS DIRECT SPONSORSHIP & DYNAMIC 2X CAP');
  console.log('=============================================================\n');

  await mongoose.connect(MONGODB_URI);

  let passed = 0;
  let failed = 0;
  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // Clean test data
    await Member.deleteMany({ email: { $regex: /@wb-test\.com$/i } });

    // 1. Create Sponsor Member with 100 BV
    const sponsor = await Member.create({
      memberId: 'MEM_WB_01',
      name: 'Welcome Sponsor',
      email: 'sponsor@wb-test.com',
      mobile: '9888800001',
      password: 'password123',
      sponsorId: '',
      parentId: '',
      position: BINARY_POSITION.LEFT,
      status: 'active',
      isActive: true,
      isBinaryActive: true,
      personalBv: 1250,
      qualifyingBv: 1250,
      welcomeBonusCap: 2500,
      welcomeBonusEarned: 0,
    });

    // TEST 1: Sponsor has NO direct referrals yet
    let eligibility = await WelcomeBonusService.checkMemberEligibility(sponsor);
    assert(!eligibility.isEligible, '1. Sponsor with no referrals is Ineligible');
    assert(!eligibility.hasLeftWing && !eligibility.hasRightWing, '2. Both Left and Right wings are false');

    // TEST 2: Add a SPILLOVER child in left leg (sponsored by someone else, not this member)
    await Member.create({
      memberId: 'MEM_WB_SPILL',
      name: 'Spillover Child',
      email: 'spillover@wb-test.com',
      mobile: '9888800002',
      password: 'password123',
      sponsorId: 'SOMEONE_ELSE', // NOT sponsored by MEM_WB_01
      parentId: sponsor.memberId, // Placed under sponsor
      position: BINARY_POSITION.LEFT,
      binaryPosition: BINARY_POSITION.LEFT,
      status: 'active',
      isActive: true,
      isBinaryActive: true,
      personalBv: 500,
    });

    eligibility = await WelcomeBonusService.checkMemberEligibility(sponsor);
    assert(!eligibility.hasLeftWing, '3. Spillover under parentId does NOT count for Left Wing (strictly direct only)');

    // TEST 3: Add directly sponsored child in LEFT wing (with 100 BV from products)
    await Member.create({
      memberId: 'MEM_WB_DIR_L',
      name: 'Direct Left Child',
      email: 'direct_left@wb-test.com',
      mobile: '9888800003',
      password: 'password123',
      sponsorId: sponsor.memberId, // Directly sponsored!
      position: BINARY_POSITION.LEFT,
      binaryPosition: BINARY_POSITION.LEFT,
      status: 'active',
      isActive: true,
      isBinaryActive: true,
      personalBv: 100, // 100 BV purchased
    });

    eligibility = await WelcomeBonusService.checkMemberEligibility(sponsor);
    assert(eligibility.hasLeftWing, '4. Direct referral with 100 BV satisfies Left Wing');
    assert(!eligibility.hasRightWing && !eligibility.isEligible, '5. Still Ineligible because Right Wing is missing');

    // TEST 4: Add directly sponsored child in RIGHT wing (with 2500 BV from package)
    await Member.create({
      memberId: 'MEM_WB_DIR_R',
      name: 'Direct Right Child',
      email: 'direct_right@wb-test.com',
      mobile: '9888800004',
      password: 'password123',
      sponsorId: sponsor.memberId, // Directly sponsored!
      position: BINARY_POSITION.RIGHT,
      binaryPosition: BINARY_POSITION.RIGHT,
      status: 'active',
      isActive: true,
      isBinaryActive: true,
      personalBv: 2500, // 2500 BV purchased
    });

    eligibility = await WelcomeBonusService.checkMemberEligibility(sponsor);
    assert(eligibility.hasRightWing, '6. Direct referral with 2500 BV satisfies Right Wing');
    assert(eligibility.isEligible, '7. Member is now 100% ELIGIBLE for Welcome Bonus!');

    // TEST 5: Dynamic 2x Cap Expansion when member buys additional products
    assert(eligibility.welcomeBonusCap === 2500, '8. Initial Cap is 2,500 BV (1250 * 2)');

    // Member buys 500 BV products
    await BVService.creditPersonalBV(
      sponsor.memberId,
      sponsor._id.toString(),
      500,
      BV_SOURCE_TYPE.REPURCHASE,
      'PUR-TEST-01',
      'Product Repurchase 500 BV'
    );

    const refreshedSponsor = await Member.findOne({ memberId: sponsor.memberId });
    const expandedEligibility = await WelcomeBonusService.checkMemberEligibility(refreshedSponsor!);
    assert(
      expandedEligibility.welcomeBonusCap === 3500,
      '9. Cap dynamically expands to 3,500 BV after purchasing 500 BV products (1750 * 2)',
      `Actual cap: ${expandedEligibility.welcomeBonusCap}`
    );

    // Clean test data
    await Member.deleteMany({ email: { $regex: /@wb-test\.com$/i } });

    console.log(`\n=============================================================`);
    console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`=============================================================\n`);
  } finally {
    await mongoose.disconnect();
  }
}

runTest().catch(console.error);
