import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database';
import { Member } from '../src/models/Member.model';
import { BinaryVolume } from '../src/models/BinaryVolume.model';
import { BVLedger } from '../src/models/BVLedger.model';
import { CommissionLedger } from '../src/models/CommissionLedger.model';
import { Wallet } from '../src/models/Wallet.model';
import { WalletTransaction } from '../src/models/WalletTransaction.model';
import { WalletService } from '../src/services/WalletService';
import { BinaryBonusService } from '../src/services/compensation/BinaryBonusService';
import { SponsorBonusService } from '../src/services/compensation/SponsorBonusService';
import { CompensationEngine } from '../src/services/compensation/CompensationEngine';
import { COMMISSION_TYPE, BINARY_POSITION } from '../src/config/constants';

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

async function runSponsorBinaryIncomeRuleTest() {
  console.log('\n=============================================================');
  console.log('   RUNNING SPONSOR BINARY INCOME RULE VERIFICATION TEST      ');
  console.log('=============================================================\n');

  await connectDB();

  const rules = await CompensationEngine.getActiveRules();
  const arianId = 'TEST-ARIAN-TOP';
  const intermediaryId = 'TEST-INTERMEDIARY';
  const downlineId = 'TEST-DOWNLINE-DEEP';
  const downlineLeftChild = 'TEST-DL-LEFT';
  const downlineRightChild = 'TEST-DL-RIGHT';

  const allTestIds = [arianId, intermediaryId, downlineId, downlineLeftChild, downlineRightChild];

  // 1. Clean previous test data
  await Member.deleteMany({
    $or: [
      { memberId: /^TEST-/ },
      { binaryParentId: /^TEST-/ },
      { parentId: /^TEST-/ },
      { sponsorId: /^TEST-/ },
      { memberId: { $in: allTestIds } },
      { binaryParentId: { $in: allTestIds } },
      { parentId: { $in: allTestIds } },
      { sponsorId: { $in: allTestIds } }
    ]
  });
  await BinaryVolume.deleteMany({ memberId: { $in: allTestIds } });
  await BVLedger.deleteMany({ memberId: { $in: allTestIds } });
  await CommissionLedger.deleteMany({ memberId: { $in: allTestIds } });
  await Wallet.deleteMany({ memberId: { $in: allTestIds } });
  await WalletTransaction.deleteMany({ memberId: { $in: allTestIds } });

  try {
    // 2. Setup Arian (Top Sponsor)
    const arian = await Member.create({
      memberId: arianId,
      name: 'Arian Top Sponsor',
      email: 'arian.test@example.com',
      mobile: '9999900001',
      password: 'TestPass123!',
      isActive: true,
      status: 'active',
      role: 'member',
      personalBv: 500,
      packageBv: 2500,
      packageName: 'Gold',
      dailyCapping: 5000,
    });

    await WalletService.getOrCreateWallet(arianId, arian._id.toString());

    // 3. Setup Intermediary Member (Spillover parent in binary tree, placed under Arian)
    const intermediary = await Member.create({
      memberId: intermediaryId,
      name: 'Intermediary Spillover',
      email: 'inter.test@example.com',
      mobile: '9999900002',
      password: 'TestPass123!',
      sponsorId: arianId,
      parentId: arianId,
      binaryPosition: BINARY_POSITION.LEFT,
      isActive: true,
      status: 'active',
      role: 'member',
      personalBv: 200,
    });

    // 4. Setup Downline Member:
    // Sponsored by ARIAN, but placed at a DEEP position under Intermediary in binary tree!
    const downline = await Member.create({
      memberId: downlineId,
      name: 'Deep Downline Sponsored by Arian',
      email: 'deep.downline@example.com',
      mobile: '9999900003',
      password: 'TestPass123!',
      sponsorId: arianId, // Sponsored by ARIAN!
      parentId: intermediaryId, // Placed deep under Intermediary in binary tree
      binaryPosition: BINARY_POSITION.LEFT,
      isActive: true,
      status: 'active',
      role: 'member',
      personalBv: 200,
      packageBv: 2500,
      packageName: 'Gold',
      dailyCapping: 5000,
    });

    await WalletService.getOrCreateWallet(downlineId, downline._id.toString());

    // 5. Downline's personally sponsored members on Left and Right to satisfy binary qualification
    await Member.create({
      memberId: downlineLeftChild,
      name: 'DL Left Sponsor Direct',
      email: 'dl.left@example.com',
      mobile: '9999900004',
      password: 'TestPass123!',
      sponsorId: downlineId,
      parentId: downlineId,
      binaryPosition: BINARY_POSITION.LEFT,
      isActive: true,
      status: 'active',
      personalBv: 200,
    });

    await Member.create({
      memberId: downlineRightChild,
      name: 'DL Right Sponsor Direct',
      email: 'dl.right@example.com',
      mobile: '9999900005',
      password: 'TestPass123!',
      sponsorId: downlineId,
      parentId: downlineId,
      position: BINARY_POSITION.RIGHT,
      binaryPosition: BINARY_POSITION.RIGHT,
      isActive: true,
      status: 'active',
      personalBv: 200,
    });

    // 6. Provide binary volume to Downline: 2500 BV Left, 2500 BV Right (completes First Payout 2:1/1:2 + Second Payout 1:1)
    await BinaryVolume.create({
      userId: downline._id.toString(),
      memberId: downlineId,
      leftAvailableBV: 2500,
      rightAvailableBV: 2500,
      leftTotalBV: 2500,
      rightTotalBV: 2500,
      reservedBV: 0,
      payoutCount: 0,
    });

    console.log('✓ Test hierarchy created:');
    console.log(`  Top Sponsor: ${arianId}`);
    console.log(`  Binary Parent: ${intermediaryId}`);
    console.log(`  Downline: ${downlineId} (Sponsor: ${arianId}, Binary Parent: ${intermediaryId})`);

    // 7. Calculate Binary Income for Downline
    console.log('\n--- Step 1: Processing Binary Matching for Downline ---');
    const binaryResult = await BinaryBonusService.calculateBinaryIncomeForMember(
      downlineId,
      rules,
      new Date(),
      'TEST-BINARY-EVENT-001'
    );

    console.log(`Downline Cycles Completed: ${binaryResult.cyclesCount}`);
    console.log(`Downline Total Binary Income: ₹${binaryResult.totalGeneratedIncome}`);
    console.log(`Downline Payable Binary Income: ₹${binaryResult.payableIncome}`);

    assert(binaryResult.totalGeneratedIncome > 0, 'Downline should generate binary income');
    assertEqual(binaryResult.totalGeneratedIncome, 500, 'Downline should generate ₹500 (2 cycles @ ₹250)');
    assertEqual(binaryResult.payableIncome, 500, 'Downline payable binary income should be ₹500');

    // Verify Downline was NOT deducted 20%: Downline receives their full ₹500 gross minus standard deductions
    const downlineLedger = await CommissionLedger.findOne({
      memberId: downlineId,
      type: COMMISSION_TYPE.BINARY_BONUS,
    });
    assert(!!downlineLedger, 'Downline commission ledger should exist');
    assertEqual(downlineLedger!.grossAmount, 500, 'Downline gross binary amount must be ₹500 (100% full amount, NOT reduced by 20%)');

    // 8. Verify Arian's Sponsor Binary Income
    console.log('\n--- Step 2: Verifying Sponsor Binary Income for Arian ---');
    const arianSponsorLedger = await CommissionLedger.findOne({
      memberId: arianId,
      type: COMMISSION_TYPE.SPONSOR_BINARY_BONUS,
    });

    assert(!!arianSponsorLedger, 'Arian should have received SPONSOR_BINARY_BONUS');
    const expectedSponsorGross = 500 * (rules.sponsorBinaryBonus.sponsorBinaryRate || 0.20); // 20% of ₹500 = ₹100
    assertEqual(arianSponsorLedger!.grossAmount, expectedSponsorGross, `Arian gross sponsor bonus should be 20% of ₹500 = ₹${expectedSponsorGross}`);
    assertEqual(arianSponsorLedger!.calculationDetails?.sourceMemberId, downlineId, 'Source member must be the downline');
    console.log(`✓ Arian received ₹${arianSponsorLedger!.grossAmount} Gross Sponsor Bonus (Net: ₹${arianSponsorLedger!.payableAmount})`);

    // 9. Verify Arian's Wallet & Total Payout
    console.log('\n--- Step 3: Verifying Arian Wallet & Total Payout ---');
    const arianWallet = await Wallet.findOne({ memberId: arianId });
    assert(!!arianWallet, 'Arian wallet must exist');
    assertEqual(arianWallet!.availableBalance, arianSponsorLedger!.payableAmount, 'Arian wallet balance must match net payable sponsor bonus');
    assertEqual(arianWallet!.totalEarned, arianSponsorLedger!.payableAmount, 'Arian total earned must match net payable sponsor bonus');
    console.log(`✓ Arian Wallet updated: Balance = ₹${arianWallet!.availableBalance}, Total Earned = ₹${arianWallet!.totalEarned}`);

    // 10. Test Idempotency: Re-triggering for same source event should NOT duplicate
    console.log('\n--- Step 4: Testing Idempotency Safeguard ---');
    const repeatBonus = await SponsorBonusService.processSponsorBonus(
      downlineId,
      500,
      rules,
      downlineLedger!.ledgerId
    );
    const totalSponsorLedgers = await CommissionLedger.countDocuments({
      memberId: arianId,
      type: COMMISSION_TYPE.SPONSOR_BINARY_BONUS,
    });
    assertEqual(totalSponsorLedgers, 1, 'Idempotency test failed: Duplicate commission ledger was created');
    console.log('✓ Idempotency confirmed: No duplicate sponsor bonuses created');

    console.log('\n=============================================================');
    console.log('   ALL SPONSOR BINARY INCOME RULE TESTS PASSED SUCCESSFULLY!  ');
    console.log('=============================================================\n');
  } finally {
    // Cleanup test data
    await Member.deleteMany({
      $or: [
        { memberId: /^TEST-/ },
        { binaryParentId: /^TEST-/ },
        { parentId: /^TEST-/ },
        { sponsorId: /^TEST-/ },
        { memberId: { $in: allTestIds } },
        { binaryParentId: { $in: allTestIds } },
        { parentId: { $in: allTestIds } },
        { sponsorId: { $in: allTestIds } }
      ]
    });
    await BinaryVolume.deleteMany({ memberId: { $in: allTestIds } });
    await BVLedger.deleteMany({ memberId: { $in: allTestIds } });
    await CommissionLedger.deleteMany({ memberId: { $in: allTestIds } });
    await Wallet.deleteMany({ memberId: { $in: allTestIds } });
    await WalletTransaction.deleteMany({ memberId: { $in: allTestIds } });
    await disconnectDB();
  }
}

runSponsorBinaryIncomeRuleTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
