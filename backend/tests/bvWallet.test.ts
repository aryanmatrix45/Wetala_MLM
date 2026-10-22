/**
 * BV Wallet API tests: generation, instant transfers (member <-> member, member <-> Super Admin),
 * repeat-send warning, duplicate/concurrency guards, admin reversal, history, authorization and
 * reconciliation.
 *
 * Runs the real Express app over HTTP. Transfers use MongoDB transactions, so the database must be
 * a replica set, and because the test wipes BV Wallet collections it only runs against a local one:
 *   mongod --replSet rs0 --port 27027 --dbpath <dir>   (then rs.initiate() once)
 *   MONGODB_URI="mongodb://127.0.0.1:27027/wetala_bv_test?replicaSet=rs0" npx tsx tests/bvWallet.test.ts
 */
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'net';
import app from '../src/app';
import { Admin } from '../src/models/Admin.model';
import { Member } from '../src/models/Member.model';
import { AdminNotification } from '../src/models/AdminNotification.model';
import { BVWallet } from '../src/models/BVWallet.model';
import { BVTransaction } from '../src/models/BVTransaction.model';
import { BVWalletLedger } from '../src/models/BVWalletLedger.model';
import { BVWalletService } from '../src/services/BVWalletService';
import { BVRate } from '../src/models/BVRate.model';
import { CompanyEarning } from '../src/models/CompanyEarning.model';
import { BVReturnRequest } from '../src/models/BVReturnRequest.model';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DOMAIN = '@test-bv.com';
const ADMIN_PASSWORD = 'AdminPass@123';

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

const key = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

async function cleanup() {
  await Promise.all([
    BVWallet.deleteMany({}),
    BVTransaction.deleteMany({}),
    BVWalletLedger.deleteMany({}),
    BVRate.deleteMany({}),
    CompanyEarning.deleteMany({}),
    BVReturnRequest.deleteMany({}),
  ]);
  await AdminNotification.deleteMany({ type: { $regex: /^BV_/ } });
  await Member.deleteMany({ email: { $regex: /@test-bv\.com$/i } });
  await Admin.deleteMany({ email: { $regex: /@test-bv\.com$/i } });
}

async function runTests() {
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGODB_URI)) {
    console.error('Refusing to run: set MONGODB_URI to a local replica-set test database (mongodb://127.0.0.1:...).');
    process.exit(1);
  }
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'bv_test_secret';
  const secret = process.env.JWT_SECRET;

  await mongoose.connect(MONGODB_URI);
  // Start from fresh collections so indexes always match the current schemas
  for (const name of ['bvwallets', 'bvtransactions', 'bvwalletledgers', 'bvrates', 'companyearnings', 'bvreturnrequests']) {
    await mongoose.connection.db!.dropCollection(name).catch(() => {});
  }
  await Promise.all([
    BVWallet.init(),
    BVTransaction.init(),
    BVWalletLedger.init(),
    BVRate.init(),
    CompanyEarning.init(),
    BVReturnRequest.init(),
    Member.init(),
    AdminNotification.init(),
  ]);
  const server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    await cleanup();

    const admin = await Admin.create({
      firstName: 'Bv', lastName: 'Admin', phone: '9000000000', email: `admin${DOMAIN}`, password: ADMIN_PASSWORD,
    });
    const adminToken = jwt.sign({ id: admin._id.toString(), email: admin.email, role: 'superadmin' }, secret);

    const makeMember = async (memberId: string, name: string, mobile: string, extra: Record<string, unknown> = {}) => {
      const m = await Member.create({
        memberId, name, email: `${memberId.toLowerCase()}${DOMAIN}`, mobile, password: 'password123', sponsorId: 'ADMIN',
        kyc: { status: 'approved' }, ...extra,
      });
      return { member: m, token: jwt.sign({ id: m._id.toString(), email: m.email, role: 'member', memberId }, secret) };
    };
    const A = await makeMember('TBV001', 'Asha Verma', '9111100001');
    const B = await makeMember('TBV002', 'Bharat Rao', '9111100002');
    const C = await makeMember('TBV003', 'Chitra Noor', '9111100003', { kyc: { status: 'not_submitted' } });
    await makeMember('TBV004', 'Blocked Person', '9111100004', { status: 'blocked' });

    const wallet = async (token: string) => (await call('GET', '/api/bv-wallet/me', undefined, token)).data.data;
    const send = (token: string, body: Record<string, unknown>) =>
      call('POST', '/api/bv-wallet/transfers', { title: 'Test transfer', requestKey: key(), ...body }, token);
    const adminSend = (body: Record<string, unknown>) => send(adminToken, { operatorName: 'Ravi', ...body });

    console.log('\n--- Generation ---');
    let r = await call('POST', '/api/bv-wallet/admin/generate', { amount: 100, title: 'x', note: 'y', operatorName: 'Op', password: 'p' }, A.token);
    assert(r.status === 403, 'Member cannot generate BV', r.data);
    r = await call('POST', '/api/bv-wallet/admin/generate', { amount: 10000, title: 'Opening stock', note: 'Initial', password: ADMIN_PASSWORD }, adminToken);
    assert(r.status === 400 && /operator/i.test(r.data.message), 'Generation requires operator name', r.data);
    r = await call('POST', '/api/bv-wallet/admin/generate', { amount: 10000, title: 'Opening stock', note: 'Initial', operatorName: 'Ravi', password: 'wrong' }, adminToken);
    assert(r.status === 403 && /password/i.test(r.data.message), 'Generation rejects wrong password', r.data);
    r = await call('POST', '/api/bv-wallet/admin/generate', { amount: 10.5, title: 'Opening stock', note: 'Initial', operatorName: 'Ravi', password: ADMIN_PASSWORD }, adminToken);
    assert(r.status === 400, 'Generation rejects fractional BV', r.data);
    r = await call('POST', '/api/bv-wallet/admin/generate', { amount: 10000, title: 'Opening stock', note: '', operatorName: 'Ravi', password: ADMIN_PASSWORD }, adminToken);
    assert(r.status === 400 && /Note/.test(r.data.message), 'Generation requires a note', r.data);
    r = await call('POST', '/api/bv-wallet/admin/generate', { amount: 10000, title: 'Opening stock', note: 'Initial allocation', operatorName: 'Ravi', password: ADMIN_PASSWORD }, adminToken);
    assert(r.status === 201 && r.data.data.availableBV === 10000, 'Admin generates 10,000 BV', r.data);
    assert(r.data.data.transaction.type === 'GENERATION' && r.data.data.transaction.status === 'COMPLETED' && !!r.data.data.transaction.createdAt,
      'Generation recorded as completed with timestamp', r.data.data.transaction);
    assert(r.data.data.transaction.initiatedBy?.operatorName === 'Ravi', 'Operator name recorded on generation');

    console.log('\n--- Super Admin -> member (instant) ---');
    r = await send(adminToken, { recipientId: 'TBV001', amount: 2000 });
    assert(r.status === 400 && /operator/i.test(r.data.message), 'Admin transfer requires operator name', r.data);
    r = await adminSend({ recipientId: 'ADMIN', amount: 1 });
    assert(r.status === 400 && /yourself/.test(r.data.message), 'Admin cannot send to Super Admin', r.data);
    r = await adminSend({ recipientId: 'TBV001', amount: 2000 });
    assert(r.status === 409 && /BV rate/.test(r.data.message), 'Admin cannot sell BV before a BV rate is set', r.data);
    await BVRate.create({ rateId: 'RATE-TEST-1', ratePaise: 100, setBy: { email: admin.email, operatorName: 'Ravi' } });

    r = await adminSend({ recipientId: 'TBV001', amount: 2000, note: 'Welcome' });
    const t1 = r.data.data?.transaction?.transactionId;
    assert(r.status === 201 && r.data.data.transaction.status === 'COMPLETED' && r.data.data.availableBV === 8000,
      'Transfer completes immediately; admin left with 8,000 BV', r.data);
    assert(r.data.data.pin === undefined, 'No PIN is issued');
    let w = await wallet(A.token);
    // Reaching 100 BV activates binary income and locks 100 BV out of the wallet (once)
    assert(w.availableBV === 1900 && w.totalReceived === 2000 && w.totalActivationLocked === 100,
      'Member credited 2,000 BV immediately; 100 BV locked for binary activation', w);
    assert(w.lockedBV === undefined, 'No on-hold balance exists', w);

    const notif = await AdminNotification.findOne({ referenceId: t1, recipientId: 'TBV001' }).lean();
    assert(notif?.type === 'BV_RECEIVED' && /2,000 BV/.test(notif.message), 'Recipient is notified of BV received', notif);
    r = await call('GET', '/api/withdrawals/notifications/member/TBV001', undefined, B.token);
    assert(r.status === 403, "Member cannot read another member's notifications", r.data);

    console.log('\n--- Recipient lookup ---');
    r = await call('GET', '/api/bv-wallet/recipients/search?q=TBV001', undefined, B.token);
    assert(r.status === 200 && r.data.data.length === 1 && r.data.data[0].name === 'Asha Verma', 'Search by Member ID', r.data);
    assert(r.data.data[0].mobile === '••••••0001' && r.data.data[0].email === 't***@test-bv.com', 'Search results are masked', r.data.data[0]);
    r = await call('GET', `/api/bv-wallet/recipients/search?q=${encodeURIComponent(`tbv001${DOMAIN}`)}`, undefined, B.token);
    assert(r.data.data?.[0]?.memberId === 'TBV001', 'Search by email', r.data);
    r = await call('GET', '/api/bv-wallet/recipients/search?q=9111100001', undefined, B.token);
    assert(r.data.data?.[0]?.memberId === 'TBV001', 'Search by mobile', r.data);
    r = await call('GET', '/api/bv-wallet/recipients/search?q=asha', undefined, B.token);
    assert(r.data.data?.[0]?.memberId === 'TBV001', 'Search by partial name', r.data);
    r = await call('GET', '/api/bv-wallet/recipients/search?q=TBV00', undefined, A.token);
    const ids = (r.data.data || []).map((m: any) => m.memberId);
    assert(!ids.includes('TBV001') && !ids.includes('TBV004') && ids.includes('TBV002'), 'Search excludes self and blocked members', ids);
    r = await call('GET', '/api/bv-wallet/recipients/search?q=Super Admin', undefined, A.token);
    assert(r.status === 200 && r.data.data.length === 0, 'Super Admin is not returned by search', r.data);
    r = await call('GET', '/api/bv-wallet/recipients/ADMIN', undefined, A.token);
    assert(r.status === 404, 'The Super Admin is not a transfer recipient (returns go through a request)', r.data);
    r = await call('GET', '/api/bv-wallet/recipients/TBV004', undefined, A.token);
    assert(r.status === 404, 'Blocked member cannot be a recipient', r.data);

    console.log('\n--- Member -> member and member -> Super Admin ---');
    r = await send(A.token, { recipientId: 'TBV001', amount: 1 });
    assert(r.status === 400 && /yourself/.test(r.data.message), 'Self-transfer blocked', r.data);
    r = await send(A.token, { recipientId: 'TBV004', amount: 1 });
    assert(r.status === 404, 'Transfer to blocked member blocked', r.data);
    r = await send(A.token, { recipientId: 'TBV002', amount: 5000 });
    assert(r.status === 400 && /Insufficient/.test(r.data.message), 'Insufficient balance rejected', r.data);
    r = await send(A.token, { recipientId: 'TBV002', amount: 0 });
    assert(r.status === 400, 'Zero amount rejected', r.data);
    r = await send(A.token, { recipientId: 'TBV002', amount: 100001 });
    assert(r.status === 400 && /cannot exceed/.test(r.data.message), 'Member per-transfer limit enforced', r.data);
    // KYC requirement is disabled during development (see BVWalletService.transfer)
    r = await send(C.token, { recipientId: 'TBV001', amount: 1 });
    assert(!/KYC/.test(r.data.message || ''), 'Sender without approved KYC is not blocked by KYC', r.data);

    r = await send(A.token, { recipientId: 'TBV002', amount: 500 });
    assert(r.status === 201 && r.data.data.availableBV === 1400, 'Member sends 500 BV to member instantly', r.data);
    w = await wallet(B.token);
    assert(w.availableBV === 400 && w.totalActivationLocked === 100, 'Recipient member credited immediately (100 BV locked at activation)', w);

    r = await send(B.token, { recipientId: 'ADMIN', amount: 200, title: 'Return' });
    assert(r.status === 400 && /Return BV/.test(r.data.message), 'Member cannot transfer BV straight to the Super Admin', r.data);
    w = await wallet(adminToken);
    assert(w.availableBV === 8000 && w.totalReceived === 0, 'Super Admin wallet unchanged', w);

    console.log('\n--- Repeat warning & duplicates ---');
    r = await send(A.token, { recipientId: 'TBV002', amount: 500 });
    assert(r.status === 409 && r.data.possibleDuplicate === true, 'Same amount to same recipient within 2 minutes needs confirmation', r.data);
    assert((await wallet(A.token)).availableBV === 1400, 'Unconfirmed repeat does not move BV');
    r = await send(A.token, { recipientId: 'TBV002', amount: 500, confirmRepeat: true });
    assert(r.status === 201 && r.data.data.availableBV === 900, 'Confirmed repeat goes through', r.data);

    const sameKey = key();
    const dupResults = await Promise.all(
      Array.from({ length: 5 }, () => send(A.token, { recipientId: 'TBV002', amount: 10, requestKey: sameKey, confirmRepeat: true }))
    );
    assert(dupResults.filter((x) => x.status === 201).length === 1 && dupResults.every((x) => x.data.status === true),
      'Same request key sends exactly once', dupResults.map((x) => x.status));
    assert((await BVTransaction.countDocuments({ requestKey: sameKey })) === 1, 'Only one transaction stored for a repeated key');
    assert((await wallet(A.token)).availableBV === 890, 'Balance debited once for a repeated key');

    console.log('\n--- Concurrency ---');
    const balance = (await wallet(A.token)).availableBV;
    const chunk = Math.floor(balance / 3);
    const spend = await Promise.all(
      Array.from({ length: 10 }, () => send(A.token, { recipientId: 'TBV002', amount: chunk, confirmRepeat: true }))
    );
    const okSends = spend.filter((x) => x.status === 201).length;
    w = await wallet(A.token);
    assert(okSends === Math.floor(balance / chunk), `10 parallel sends of ${chunk} from ${balance}: only ${Math.floor(balance / chunk)} succeed`, spend.map((x) => x.status));
    assert(w.availableBV === balance - okSends * chunk && w.availableBV >= 0, 'No overspend', w);

    console.log('\n--- Freeze ---');
    r = await call('POST', '/api/bv-wallet/admin/wallets/TBV001/freeze', { frozen: true, reason: 'Investigation' }, adminToken);
    assert(r.status === 200 && r.data.data.isFrozen === true, 'Admin freezes a wallet', r.data);
    r = await send(A.token, { recipientId: 'TBV002', amount: 1 });
    assert(r.status === 403 && /frozen/.test(r.data.message), 'Frozen wallet cannot send', r.data);
    r = await adminSend({ recipientId: 'TBV001', amount: 5 });
    assert(r.status === 201, 'Frozen wallet can still receive', r.data);
    r = await call('POST', '/api/bv-wallet/admin/wallets/TBV001/freeze', { frozen: true }, A.token);
    assert(r.status === 403, 'Member cannot freeze wallets', r.data);
    await call('POST', '/api/bv-wallet/admin/wallets/TBV001/freeze', { frozen: false }, adminToken);

    console.log('\n--- Reversal (Super Admin) ---');
    const before = { a: (await wallet(A.token)).availableBV, b: (await wallet(B.token)).availableBV };
    r = await send(A.token, { recipientId: 'TBV002', amount: 3, title: 'Wrong person' });
    const wrongTxn = r.data.data.transaction.transactionId;
    const reverse = (id: string, body: Record<string, unknown> = {}, token = adminToken) =>
      call('POST', `/api/bv-wallet/admin/transactions/${id}/reverse`, { reason: 'Sent to wrong member', operatorName: 'Ravi', password: ADMIN_PASSWORD, ...body }, token);

    r = await reverse(wrongTxn, {}, A.token);
    assert(r.status === 403, 'Member cannot reverse a transfer', r.data);
    r = await reverse(wrongTxn, { password: 'wrong' });
    assert(r.status === 403, 'Reversal requires the admin password', r.data);
    r = await reverse(wrongTxn, { reason: '' });
    assert(r.status === 400 && /Reason/.test(r.data.message), 'Reversal requires a reason', r.data);
    r = await reverse(wrongTxn);
    assert(r.status === 200 && r.data.data.reversal.type === 'REVERSAL' && r.data.data.reversal.reversalOf === wrongTxn,
      'Admin reverses a transfer with a linked REVERSAL transaction', r.data);
    assert(r.data.data.original.status === 'REVERSED' && r.data.data.original.amount === 3, 'Original is marked reversed with its amount unchanged', r.data.data.original);
    w = await wallet(A.token);
    const wb = await wallet(B.token);
    assert(w.availableBV === before.a && wb.availableBV === before.b, 'Reversal restores both balances', { w, wb, before });
    r = await reverse(wrongTxn);
    assert(r.status === 409, 'A transfer cannot be reversed twice', r.data);
    const reversedNotices = await AdminNotification.countDocuments({ type: 'BV_TRANSFER_REVERSED' });
    assert(reversedNotices === 2, 'Both members are notified of the reversal', reversedNotices);

    const genTxn = (await BVTransaction.findOne({ type: 'GENERATION' }))!.transactionId;
    r = await reverse(genTxn);
    assert(r.status === 400 && /Only transfers/.test(r.data.message), 'Generations cannot be reversed', r.data);

    // Recipient has already spent the BV -> reversal refused, nothing changes
    r = await adminSend({ recipientId: 'TBV003', amount: 50 });
    const spentTxn = r.data.data.transaction.transactionId;
    await send(C.token, { recipientId: 'TBV002', amount: 50 });
    r = await reverse(spentTxn);
    assert(r.status === 400 && /only has 0 BV/.test(r.data.message), 'Reversal refused when the recipient no longer has the BV', r.data);
    assert((await BVTransaction.findOne({ transactionId: spentTxn }))?.status === 'COMPLETED', 'Refused reversal leaves the transfer completed');

    console.log('\n--- History ---');
    r = await call('GET', '/api/bv-wallet/transactions?limit=100', undefined, B.token);
    assert(r.status === 200 && r.data.data.every((t: any) => t.sender.id === 'TBV002' || t.recipient?.id === 'TBV002'), 'Member history only shows own transactions', r.data.total);
    assert(!r.data.data.some((t: any) => t.type === 'GENERATION'), 'Member history excludes admin generation');
    assert(r.data.data.every((t: any) => t.initiatedBy === undefined), 'Member history hides audit details');
    assert(r.data.data.some((t: any) => t.type === 'REVERSAL' && t.direction === 'SENT'), 'Reversal appears in the history of the member it was taken from');
    r = await call('GET', '/api/bv-wallet/transactions?direction=RECEIVED', undefined, A.token);
    assert(r.data.data.length > 0 && r.data.data.every((t: any) => t.direction === 'RECEIVED'), 'History filters by direction', r.data.data.map((t: any) => t.direction));
    r = await call('GET', '/api/bv-wallet/transactions?direction=RECEIVED', undefined, adminToken);
    assert(r.status === 200 && r.data.data.length === 0, 'Super Admin received nothing from members', r.data);

    r = await call('GET', '/api/bv-wallet/admin/transactions?limit=100', undefined, A.token);
    assert(r.status === 403, 'Member cannot view all transactions', r.data);
    r = await call('GET', '/api/bv-wallet/admin/transactions?limit=100', undefined, adminToken);
    assert(r.status === 200 && r.data.total === (await BVTransaction.countDocuments()), 'Admin sees all transactions', r.data.total);
    r = await call('GET', '/api/bv-wallet/admin/transactions?status=REVERSED', undefined, adminToken);
    assert(r.data.data.length === 1 && r.data.data[0].transactionId === wrongTxn, 'Admin filters by status', r.data);
    r = await call('GET', '/api/bv-wallet/admin/wallets/TBV001', undefined, adminToken);
    assert(r.status === 200 && r.data.data.member.name === 'Asha Verma', "Admin views a member's wallet", r.data);

    console.log('\n--- Balances & isolation ---');
    r = await call('GET', '/api/bv-wallet/admin/overview', undefined, adminToken);
    assert(r.status === 200 && r.data.data.reconciliation.ok === true, 'Reconciliation passes after all scenarios', r.data.data?.reconciliation);
    const all = await BVWallet.find().lean();
    const lockedAtActivation = r.data.data.reconciliation.totalActivationLocked;
    assert(all.reduce((s, x) => s + x.availableBV, 0) + lockedAtActivation === 10000 && r.data.data.totalGenerated === 10000,
      'All 10,000 BV is accounted for across wallets and activation locks', { lockedAtActivation });
    const [memberA, memberB] = await Promise.all([Member.findOne({ memberId: 'TBV001' }), Member.findOne({ memberId: 'TBV002' })]);
    assert(memberA?.personalBv === 0 && memberB?.personalBv === 0, 'Wallet BV does not change earned personal BV');
    assert(memberA?.isBinaryActive === true && memberA?.activationSource === 'BV_WALLET', 'Holding wallet BV activates binary participation');

    // Tamper with a balance and confirm reconciliation catches it
    await BVWallet.updateOne({ ownerId: 'TBV002' }, { $inc: { availableBV: 7 } });
    const tampered = await BVWalletService.reconcile();
    assert(!tampered.ok && tampered.issues.some((i) => i.includes('BVW-TBV002')), 'Reconciliation detects a tampered balance', tampered.issues);
  } finally {
    await cleanup();
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
