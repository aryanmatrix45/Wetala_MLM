/**
 * BV as a spendable balance: paying for packages and products with BV Wallet (Super Admin approval),
 * rejection and refund returning BV, refunds reversing earned BV, welcome bonus credited as BV,
 * binary activation from the wallet balance, the Total BV summary, and the access checks around them.
 *
 * Runs the real Express app over HTTP against a local replica set (transactions are required):
 *   MONGODB_URI="mongodb://127.0.0.1:27027/wetala_bv_test?replicaSet=rs0" npx tsx tests/bvPurchase.test.ts
 */
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'net';
import app from '../src/app';
import { Admin } from '../src/models/Admin.model';
import { Member } from '../src/models/Member.model';
import { Package } from '../src/models/Package.model';
import { Product } from '../src/models/Product.model';
import { Purchase } from '../src/models/Purchase.model';
import { Wallet } from '../src/models/Wallet.model';
import { BinaryVolume } from '../src/models/BinaryVolume.model';
import { BVLedger } from '../src/models/BVLedger.model';
import { CommissionLedger } from '../src/models/CommissionLedger.model';
import { CompensationEvent } from '../src/models/CompensationEvent.model';
import { AdminNotification } from '../src/models/AdminNotification.model';
import { BVWallet } from '../src/models/BVWallet.model';
import { BVTransaction } from '../src/models/BVTransaction.model';
import { BVWalletLedger } from '../src/models/BVWalletLedger.model';
import { WelcomeBonusSettlement } from '../src/models/WelcomeBonusSettlement.model';
import { WelcomeBonusTransaction } from '../src/models/WelcomeBonusTransaction.model';
import { WalletTransaction } from '../src/models/WalletTransaction.model';
import { BVWalletService } from '../src/services/BVWalletService';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DOMAIN = '@test-bvp.com';
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

// This suite owns the whole test database
async function wipe() {
  await Promise.all(
    [
      Member, Admin, Package, Product, Purchase, Wallet, WalletTransaction, BinaryVolume, BVLedger, CommissionLedger,
      CompensationEvent, AdminNotification, BVWallet, BVTransaction, BVWalletLedger, WelcomeBonusSettlement, WelcomeBonusTransaction,
    ].map((m: any) => m.deleteMany({}))
  );
}

async function runTests() {
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGODB_URI)) {
    console.error('Refusing to run: set MONGODB_URI to a local replica-set test database (mongodb://127.0.0.1:...).');
    process.exit(1);
  }
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'bv_test_secret';
  const secret = process.env.JWT_SECRET;

  await mongoose.connect(MONGODB_URI);
  for (const name of ['bvwallets', 'bvtransactions', 'bvwalletledgers', 'purchases']) {
    await mongoose.connection.db!.dropCollection(name).catch(() => {});
  }
  await Promise.all([BVWallet.init(), BVTransaction.init(), BVWalletLedger.init(), Purchase.init(), Member.init()]);
  const server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    await wipe();

    const admin = await Admin.create({ firstName: 'Bv', lastName: 'Admin', phone: '9000000001', email: `admin${DOMAIN}`, password: ADMIN_PASSWORD });
    const adminToken = jwt.sign({ id: admin._id.toString(), email: admin.email, role: 'superadmin' }, secret);

    const makeMember = async (memberId: string, extra: Record<string, unknown> = {}) => {
      const m = await Member.create({
        memberId, name: `Member ${memberId}`, email: `${memberId.toLowerCase()}${DOMAIN}`, mobile: `92222${memberId.slice(-5)}`,
        password: 'password123', kyc: { status: 'approved' }, ...extra,
      });
      return { member: m, token: jwt.sign({ id: m._id.toString(), email: m.email, role: 'member', memberId }, secret) };
    };
    // ROOT has two directly sponsored children, LEFT and RIGHT; NEWBIE is sponsored by LEFT and not yet placed
    const ROOT = await makeMember('BVP00001', { sponsorId: '', personalBv: 1250, packageBv: 1250 });
    const LEFT = await makeMember('BVP00002', { sponsorId: 'BVP00001', parentId: 'BVP00001', position: 'LEFT' });
    await makeMember('BVP00003', { sponsorId: 'BVP00001', parentId: 'BVP00001', position: 'RIGHT', personalBv: 200 });
    const NEWBIE = await makeMember('BVP00004', { sponsorId: 'BVP00002' });

    await Package.create({ packageId: 'PKG-BVP1', name: 'Test Package', price: 3000, priceInPaise: 300000, bv: 1250, rp: 1, isActive: true });
    const product = await Product.create({
      productId: 'PRD-BVP1', title: 'Test Product', name: 'Test Product', slug: 'test-product-bvp', sku: 'SKU-BVP1',
      categoryId: new mongoose.Types.ObjectId(), businessVolume: 600, bv: 600, price: 1500, stock: 10, stockQuantity: 10, status: 'ACTIVE', isActive: true,
    });

    const bvWallet = async (token: string) => (await call('GET', '/api/bv-wallet/me', undefined, token)).data.data;
    const leftVolume = async () => (await BinaryVolume.findOne({ memberId: 'BVP00001' }))?.leftTotalBV || 0;

    console.log('\n--- Setup: Super Admin funds a member ---');
    let r = await call('POST', '/api/bv-wallet/admin/generate', { amount: 20000, title: 'Stock', note: 'Test', operatorName: 'Ravi', password: ADMIN_PASSWORD }, adminToken);
    assert(r.status === 201, 'Admin generates 20,000 BV', r.data);
    r = await call('POST', '/api/bv-wallet/transfers', { recipientId: 'BVP00002', amount: 5000, title: 'Funding', requestKey: key(), operatorName: 'Ravi' }, adminToken);
    assert(r.status === 201, 'Admin sends 5,000 BV to member', r.data);

    console.log('\n--- Binary activation from the BV Wallet (D3) ---');
    let m = await Member.findOne({ memberId: 'BVP00002' });
    assert(m?.isBinaryActive === true && m?.activationSource === 'BV_WALLET' && (m?.personalBv || 0) === 0,
      'Receiving BV activates binary participation without any purchase', { active: m?.isBinaryActive, src: m?.activationSource });
    m!.name = 'Member BVP00002';
    await m!.save();
    assert((await Member.findOne({ memberId: 'BVP00002' }))?.isBinaryActive === true, 'Wallet activation survives later profile saves');
    assert(m?.activationLockedBV === 100 && m?.activationLockFromWalletBV === 100 && (await bvWallet(LEFT.token)).availableBV === 4900,
      'Activation locks 100 BV out of the wallet: 5,000 → 4,900', { locked: m?.activationLockedBV });
    assert((await leftVolume()) === 100, 'The locked 100 BV is credited once to the upline left leg', await leftVolume());

    r = await call('POST', '/api/bv-wallet/transfers', { recipientId: 'BVP00004', amount: 150, title: 'Starter', requestKey: key(), operatorName: 'Ravi' }, adminToken);
    m = await Member.findOne({ memberId: 'BVP00004' });
    assert(r.status === 201 && m?.isBinaryActive === true && !!m?.parentId, 'Unplaced member is activated and placed in the binary tree', { parentId: m?.parentId });
    assert((await leftVolume()) === 200, "Newbie's locked 100 BV also reaches the root's left leg", await leftVolume());

    console.log('\n--- Pay for a package with BV (waits for approval, D2) ---');
    const pkgKey = key();
    r = await call('POST', '/api/packages/buy', { packageId: 'PKG-BVP1', paymentMethod: 'BV_WALLET', requestKey: pkgKey }, LEFT.token);
    const pkgOrder = r.data.data?.purchase;
    assert(r.status === 200 && pkgOrder?.paymentMethod === 'BV_WALLET' && pkgOrder?.bvAmount === 1250 && pkgOrder?.approvalStage === 'PAYMENT_SUBMITTED',
      'Package (₹3,000 / 1,250 BV) is paid with its own 1,250 BV and waits for Super Admin', pkgOrder);
    assert((await bvWallet(LEFT.token)).availableBV === 3650, 'BV deducted at checkout: 4,900 → 3,650');
    assert((await Member.findOne({ memberId: 'BVP00002' }))?.personalBv === 0, 'No earned BV before approval');

    r = await call('POST', '/api/packages/buy', { packageId: 'PKG-BVP1', paymentMethod: 'BV_WALLET', requestKey: pkgKey }, LEFT.token);
    assert((await Purchase.countDocuments({ memberId: 'BVP00002' })) === 1 && (await bvWallet(LEFT.token)).availableBV === 3650,
      'Repeating the request does not charge again', r.data);

    r = await call('POST', `/api/purchases/${pkgOrder.purchaseId}/verify-and-pay`, {}, LEFT.token);
    assert(r.status === 403, 'Members cannot approve orders', r.data);
    r = await call('POST', `/api/purchases/${pkgOrder.purchaseId}/verify-and-pay`, {}, adminToken);
    m = await Member.findOne({ memberId: 'BVP00002' });
    assert(r.status === 200 && m?.personalBv === 1250 && m?.packageName === 'Test Package', 'Approval credits 1,250 personal BV and the package', { bv: m?.personalBv });
    assert((await leftVolume()) === 1450, 'Upline left leg receives 1,250 BV (on top of 200 activation BV)');
    r = await call('POST', `/api/purchases/${pkgOrder.purchaseId}/reject`, { reason: 'late' }, adminToken);
    assert(r.status === 400, 'An approved order cannot be rejected', r.data);

    console.log('\n--- Product orders: insufficient BV, reject, refund ---');
    const productItem = (quantity: number) => [{ itemType: 'PRODUCT', productId: product._id.toString(), quantity }];
    r = await call('POST', '/api/purchases/request', { items: productItem(7), paymentMethod: 'BV_WALLET', requestKey: key() }, LEFT.token);
    assert(r.status === 400 && /Insufficient/.test(r.data.message), 'Order above the BV balance (4,200 > 3,650) is refused', r.data);
    assert((await Purchase.countDocuments({ memberId: 'BVP00002' })) === 1, 'No order is created when BV is insufficient');

    r = await call('POST', '/api/purchases/request', { items: productItem(1), paymentMethod: 'BV_WALLET', requestKey: key() }, LEFT.token);
    const rejectOrder = r.data.data;
    assert(r.status === 201 && rejectOrder.bvAmount === 600 && (await bvWallet(LEFT.token)).availableBV === 3050,
      'Product (₹1,500 / 600 BV) is paid with its own 600 BV', r.data);
    r = await call('POST', `/api/purchases/${rejectOrder.purchaseId}/reject`, { reason: 'Out of stock' }, adminToken);
    assert(r.status === 200 && /600 BV returned/.test(r.data.message), 'Rejection returns the BV', r.data);
    assert((await bvWallet(LEFT.token)).availableBV === 3650, 'Wallet back to 3,650 BV');
    r = await call('POST', `/api/purchases/${rejectOrder.purchaseId}/reject`, { reason: 'again' }, adminToken);
    assert(r.status === 409, 'Rejecting twice is refused (no double refund)', r.data);
    r = await call('POST', `/api/purchases/${rejectOrder.purchaseId}/verify-and-pay`, {}, adminToken);
    assert(r.status === 400, 'A rejected order cannot be approved afterwards', r.data);
    assert((await bvWallet(LEFT.token)).availableBV === 3650, 'Balance unchanged by the refused actions');

    r = await call('POST', '/api/purchases/request', { items: productItem(1), paymentMethod: 'BV_WALLET', requestKey: key() }, LEFT.token);
    const refundOrder = r.data.data;
    r = await call('POST', `/api/purchases/${refundOrder.purchaseId}/verify-and-pay`, {}, adminToken);
    m = await Member.findOne({ memberId: 'BVP00002' });
    assert(r.status === 200 && m?.personalBv === 1850 && (await leftVolume()) === 2050, 'Approved product adds 600 personal and upline BV', { bv: m?.personalBv });
    assert((await Product.findById(product._id))?.stock === 9, 'Stock reduced once on approval');
    r = await call('POST', `/api/purchases/${refundOrder.purchaseId}/verify-and-pay`, {}, adminToken);
    assert((await Product.findById(product._id))?.stock === 9, 'Approving again does not reduce stock twice', r.data);

    r = await call('POST', `/api/purchases/${refundOrder.purchaseId}/refund`, { reason: 'Damaged' }, adminToken);
    m = await Member.findOne({ memberId: 'BVP00002' });
    assert(r.status === 200 && r.data.data.bvRefunded === 600 && r.data.data.personalBvReversed === 600, 'Refund returns 600 wallet BV and takes back 600 earned BV', r.data);
    assert(m?.personalBv === 1250 && (await leftVolume()) === 1450, 'Personal and upline BV reversed', { bv: m?.personalBv });
    assert((await bvWallet(LEFT.token)).availableBV === 3050 + 600, 'Wallet credited with the refunded BV');
    r = await call('POST', `/api/purchases/${refundOrder.purchaseId}/refund`, { reason: 'again' }, adminToken);
    assert(r.status === 409, 'Refunding twice is refused', r.data);

    console.log('\n--- Bank payment still works; members are limited to their own orders ---');
    r = await call('POST', '/api/purchases/request', { memberId: 'BVP00003', items: productItem(1) }, LEFT.token);
    assert(r.status === 201 && r.data.data.memberId === 'BVP00002' && r.data.data.approvalStage === 'REQUESTED' && r.data.data.paymentMethod === 'BANK_TRANSFER',
      'Bank order is created for the logged-in member only', r.data.data);
    r = await call('GET', '/api/purchases?memberId=BVP00003', undefined, LEFT.token);
    assert(r.status === 200 && r.data.data.every((p: any) => p.memberId === 'BVP00002'), "Members cannot list other members' orders");
    r = await call('GET', '/api/purchases/member/BVP00001/history', undefined, LEFT.token);
    assert(r.status === 403, "Members cannot read another member's purchase history", r.data);
    r = await call('POST', '/api/purchases/request', { items: productItem(1), paymentMethod: 'BV_WALLET', requestKey: key() }, adminToken);
    assert(r.status === 403, 'The Super Admin cannot pay with a member wallet', r.data);

    console.log('\n--- Welcome bonus is credited as BV (no rupees) ---');
    r = await call('POST', '/api/welcome-bonus/settle', { overrideGBV: 10000 });
    assert(r.status === 401, 'Settlement requires a login', r.status);
    r = await call('POST', '/api/welcome-bonus/settle', { overrideGBV: 10000 }, LEFT.token);
    assert(r.status === 403, 'Members cannot run a settlement', r.status);
    const rupeesBefore = (await Wallet.findOne({ memberId: 'BVP00001' }))?.availableBalanceInPaise || 0;
    // Settlement pays the last finished week, judged as of its end: the members must have joined by then
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await Member.collection.updateMany({}, { $set: { createdAt: monthAgo } });
    await Member.collection.updateMany({ binaryActivatedAt: { $ne: null } }, { $set: { binaryActivatedAt: monthAgo } });
    r = await call('POST', '/api/welcome-bonus/settle', { overrideGBV: 10000 }, adminToken);
    const rootWallet = await BVWallet.findOne({ ownerId: 'BVP00001' });
    assert(r.status === 200 && rootWallet?.availableBV === 400 && rootWallet?.totalWelcomeBonus === 400,
      'Eligible member receives 400 BV (4% of 10,000) in the BV Wallet', { status: r.status, wallet: rootWallet?.availableBV, msg: r.data.message });
    assert(((await Wallet.findOne({ memberId: 'BVP00001' }))?.availableBalanceInPaise || 0) === rupeesBefore, 'No rupees are credited for the welcome bonus');
    assert((await CommissionLedger.countDocuments({ type: 'WELCOME_BONUS' })) === 0, 'No rupee commission row is written');
    assert((await Member.findOne({ memberId: 'BVP00001' }))?.welcomeBonusEarned === 400, 'Welcome bonus earned (for the cap) is 400');
    assert((await AdminNotification.countDocuments({ type: 'BV_WELCOME_BONUS', recipientId: 'BVP00001' })) === 1, 'Member is notified of the welcome bonus');
    r = await call('POST', '/api/welcome-bonus/settle', { overrideGBV: 10000 }, adminToken);
    assert((await BVWallet.findOne({ ownerId: 'BVP00001' }))?.availableBV === 400, 'Running the same settlement again pays nothing extra');
    r = await call('GET', '/api/welcome-bonus/member-status/BVP00001', undefined, LEFT.token);
    assert(r.status === 200 && r.data.data?.memberId !== 'BVP00001', 'Members only see their own welcome bonus status', r.data.data?.memberId);

    console.log('\n--- Total Business Volume ---');
    r = await call('GET', '/api/bv-summary/me', undefined, LEFT.token);
    const s = r.data.data;
    assert(r.status === 200 && s.personal.total === 1250 && s.personal.package === 1250 && s.personal.purchases === 600 && s.personal.refunds === -600,
      'Personal BV breakdown: package 1,250, products 600, refunds −600', s?.personal);
    assert(s.wallet.available === 3650 && s.wallet.spentOnOrders === 1250 && s.totalBV === 4900, 'Total BV = 1,250 personal + 3,650 wallet', s);
    assert(s.binary.isActive === true && s.binary.lockedBV === 100 && s.binary.lockedFromWallet === 100 && s.team.left === 100,
      "Summary shows binary status, the activation lock, and team BV (newbie's 100) separately", s);
    r = await call('GET', '/api/bv-summary/me', undefined, ROOT.token);
    assert(r.data.data.wallet.welcomeBonus === 400 && r.data.data.team.left === 1450 && r.data.data.personal.other === 1250 &&
      r.data.data.binary.lockedFromPersonal === 100 && r.data.data.totalBV === 1250 + 400 - 100,
      'Welcome bonus BV and team BV appear for the upline; opening BV shown as "other"', r.data.data);
    r = await call('GET', '/api/bv-summary/BVP00001', undefined, LEFT.token);
    assert(r.status === 403, "Members cannot read another member's summary", r.status);

    // A member activated before the lock existed (no BV locked yet) who holds enough wallet BV
    r = await call('POST', '/api/bv-wallet/transfers', { recipientId: 'BVP00004', amount: 100, title: 'Top up', requestKey: key(), operatorName: 'Ravi' }, adminToken);
    await Member.updateOne(
      { memberId: 'BVP00004' },
      { $set: { activationLockedBV: 0, activationLockFromPersonalBV: 0, activationLockFromWalletBV: 0, activationBvDistributed: false } }
    );
    const NEWBIE_TOKEN = NEWBIE.token;
    r = await call('GET', '/api/bv-summary/me', undefined, NEWBIE_TOKEN);
    assert(r.status === 200 && r.data.data.binary.isActive === true && r.data.data.binary.lockedBV === 100 && r.data.data.totalBV === 50,
      'Loading the dashboard summary locks 100 BV for a member activated before the lock existed (150 → 50)', r.data.data);
    r = await call('GET', '/api/bv-summary/me', undefined, NEWBIE_TOKEN);
    assert(r.data.data.totalBV === 50, 'The lock is taken only once', r.data.data.totalBV);

    console.log('\n--- Balance check ---');
    const rec = await BVWalletService.reconcile();
    assert(rec.ok && rec.totalWelcomeBonus === 400 && rec.totalSpentOnOrders === 2450 && rec.totalRefunded === 1200,
      'All wallet BV = generated + welcome bonus + refunds − spent', rec);
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
