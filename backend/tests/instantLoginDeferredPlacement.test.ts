import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Member } from '../src/models/Member.model';
import { BinaryTreeService } from '../src/services/tree/BinaryTreeService';
import { BVService } from '../src/services/BVService';
import { AuthController } from '../src/controllers/auth.controller';
import { BINARY_POSITION, BV_SOURCE_TYPE } from '../src/config/constants';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wetala_mlm';

class MockResponse {
  statusCode: number = 200;
  responseData: any = null;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(data: any) {
    this.responseData = data;
    return this;
  }
}

async function runTests() {
  console.log('\n=============================================================');
  console.log(' RUNNING INSTANT LOGIN & DEFERRED PLACEMENT TEST SUITE');
  console.log('=============================================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('[MongoDB] Connected successfully');

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
    // Clean up test records
    await Member.deleteMany({ email: { $regex: /@test-deferred\.com$/i } });

    // Step 1: Ensure Root Member exists
    let root = await Member.findOne({ $or: [{ sponsorId: '' }, { sponsorId: { $exists: false } }] });
    if (!root) {
      root = await Member.create({
        memberId: 'MEM0001',
        name: 'Aryan Root',
        email: 'root@test-deferred.com',
        mobile: '9999900001',
        password: 'password123',
        role: 'member',
        sponsorId: '',
        parentId: '',
        position: BINARY_POSITION.LEFT,
        status: 'active',
        approvalStatus: 'approved',
        isActive: true,
        isBinaryActive: true,
        personalBv: 1250,
      });
    }

    // TEST 1: Register new member without approval gate
    const regReq: any = {
      body: {
        name: 'Vikram Deferred',
        email: 'vikram@test-deferred.com',
        mobile: '9999900002',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        sponsorId: root.memberId,
        position: 'LEFT',
      },
    };
    const regRes = new MockResponse();
    await AuthController.register(regReq, regRes as any);

    assert(regRes.statusCode === 201 && regRes.responseData.status === true, '1. Member registers successfully with 201 Created');
    
    const newMemberId = regRes.responseData.memberId;
    const memberDoc = await Member.findOne({ memberId: newMemberId });

    assert(memberDoc !== null, '2. Member document exists in MongoDB');
    assert(memberDoc?.status === 'active' && memberDoc?.approvalStatus === 'approved' && memberDoc?.isActive === true, '3. Member is immediately active and approved (no approval gate)');
    assert(!memberDoc?.parentId && memberDoc?.isBinaryActive === false, '4. Member has NO parentId (deferred binary placement) and is not binary active yet');
    assert(memberDoc?.preferredLeg === BINARY_POSITION.LEFT, '5. Preferred leg (LEFT) is recorded for activation');

    // TEST 2A: Attempting to log in with Member ID or Phone is rejected
    const memberIdLoginReq: any = {
      body: {
        email: newMemberId, // Attempting to use Member ID
        password: 'Password@123',
      },
    };
    const memberIdLoginRes = new MockResponse();
    await AuthController.login(memberIdLoginReq, memberIdLoginRes as any);
    assert(
      memberIdLoginRes.statusCode === 400 && memberIdLoginRes.responseData.status === false,
      '6. Sign in with Member ID is strictly rejected (Email ID required)'
    );

    // TEST 2B: Instant login strictly with Email ID and password succeeds
    const emailLoginReq: any = {
      body: {
        email: 'vikram@test-deferred.com',
        password: 'Password@123',
      },
    };
    const emailLoginRes = new MockResponse();
    await AuthController.login(emailLoginReq, emailLoginRes as any);

    assert(emailLoginRes.statusCode === 200 && emailLoginRes.responseData.status === true, '7. Member logs in immediately with Email ID and password');
    assert(typeof emailLoginRes.responseData.token === 'string' && emailLoginRes.responseData.token.length > 20, '8. Valid JWT token is returned on email login');

    // TEST 3: Binary tree does NOT show unplaced member
    const treeBefore = await BinaryTreeService.getBinaryTree(root.memberId);
    let foundInTree = false;
    function checkNode(n: any) {
      if (!n) return;
      if (n.memberId === newMemberId) foundInTree = true;
      if (n.leftNode) checkNode(n.leftNode);
      if (n.rightNode) checkNode(n.rightNode);
    }
    checkNode(treeBefore);
    assert(!foundInTree, '8. Unplaced member (0 BV) does NOT occupy a slot in the binary tree');

    // TEST 4: Credit 100 BV (package activation) triggers placement
    await BVService.creditPersonalBV(
      newMemberId,
      memberDoc!._id.toString(),
      100,
      BV_SOURCE_TYPE.JOINING_PACKAGE,
      'PKG-ACTIVATE-01',
      'Activation Package 100 BV'
    );

    const activatedDoc = await Member.findOne({ memberId: newMemberId });
    assert(activatedDoc?.isBinaryActive === true, '9. Member isBinaryActive is now true after reaching 100 BV');
    assert(Boolean(activatedDoc?.parentId), '10. Member now has parentId assigned under sponsor extreme leg', `parentId: ${activatedDoc?.parentId}`);
    assert(activatedDoc?.position === BINARY_POSITION.LEFT, '11. Member placed on their chosen preferred leg (LEFT)');

    // TEST 5: Binary tree now displays the member
    const treeAfter = await BinaryTreeService.getBinaryTree(root.memberId, 100);
    let foundAfter = false;
    function checkNodeAfter(n: any) {
      if (!n) return;
      if (n.memberId === newMemberId) foundAfter = true;
      if (n.leftNode) checkNodeAfter(n.leftNode);
      if (n.rightNode) checkNodeAfter(n.rightNode);
    }
    checkNodeAfter(treeAfter);
    assert(foundAfter, '12. Placed member is now visibly present in the binary tree');

    // Clean up test documents
    await Member.deleteMany({ email: { $regex: /@test-deferred\.com$/i } });

    console.log('\n=============================================================');
    console.log(`TEST SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log('=============================================================\n');

  } catch (err) {
    console.error('Fatal error during test run:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log('[MongoDB] Connection closed cleanly');
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
