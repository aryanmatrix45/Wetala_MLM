/**
 * Super Admin earnings tests: the BV rate, BV sales (Super Admin -> member transfers), reversed
 * sales, member returns (request, cancel, reject, approve), welcome bonus BV kept apart from regular
 * BV, bank / UPI orders marked as paid and refunded, reporting, and access control.
 *
 * Runs the real Express app over HTTP against a local replica set (transactions are used):
 *   MONGODB_URI="mongodb://127.0.0.1:27027/wetala_earnings_test?replicaSet=rs0" npx tsx tests/companyEarnings.test.ts
 */
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'net';
import app from '../src/app';
import { Admin } from '../src/models/Admin.model';
import { Member } from '../src/models/Member.model';
import { Purchase } from '../src/models/Purchase.model';
import { AdminNotification } from '../src/models/AdminNotification.model';
import { BVWallet } from '../src/models/BVWallet.model';
import { BVTransaction } from '../src/models/BVTransaction.model';
import { BVWalletLedger } from '../src/models/BVWalletLedger.model';
import { BVRate } from '../src/models/BVRate.model';
import { CompanyEarning } from '../src/models/CompanyEarning.model';
import { BVReturnRequest } from '../src/models/BVReturnRequest.model';
import { CommissionLedger } from '../src/models/CommissionLedger.model';
import { BVWalletService, runInTransaction } from '../src/services/BVWalletService';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DOMAIN = '@test-earnings.com';
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
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    // CSV export
  }
  return { status: res.status, data, headers: res.headers };
}

const key = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// This suite owns the whole test database
async function wipe() {
  await Promise.all(
    [Member, Admin, Purchase, AdminNotification, BVWallet, BVTransaction, BVWalletLedger, BVRate, CompanyEarning, BVReturnRequest, CommissionLedger].map(
      (m: any) => m.deleteMany({})
    )
  );
}

const orderItems = (bv: number, price: number) => [
  {
    itemId: 'PRD-TEST',
    itemType: 'PRODUCT',
    name: 'Test product',
    quantity: 1,
    unitPrice: price,
    unitPriceInPaise: price * 100,
    unitBV: bv,
    totalPrice: price,
    totalPriceInPaise: price * 100,
    totalBV: bv,
  },
];

async function runTests() {
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGODB_URI)) {
    console.error('Refusing to run: set MONGODB_URI to a local replica-set test database (mongodb://127.0.0.1:...).');
    process.exit(1);
  }
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'earnings_test_secret';
  const secret = process.env.JWT_SECRET;

  await mongoose.connect(MONGODB_URI);
  for (const name of ['bvwallets', 'bvtransactions', 'bvwalletledgers', 'purchases', 'bvrates', 'companyearnings', 'bvreturnrequests']) {
    await mongoose.connection.db!.dropCollection(name).catch(() => {});
  }
  await Promise.all([
    BVWallet.init(),
    BVTransaction.init(),
    BVWalletLedger.init(),
    Purchase.init(),
    Member.init(),
    BVRate.init(),
    CompanyEarning.init(),
    BVReturnRequest.init(),
  ]);
  const server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    await wipe();

    const admin = await Admin.create({ firstName: 'Earn', lastName: 'Admin', phone: '9000000002', email: `admin${DOMAIN}`, password: ADMIN_PASSWORD });
    const adminToken = jwt.sign({ id: admin._id.toString(), email: admin.email, role: 'superadmin' }, secret);

    const makeMember = async (memberId: string, name: string, mobile: string) => {
      const m = await Member.create({
        memberId, name, email: `${memberId.toLowerCase()}${DOMAIN}`, mobile, password: 'password123', sponsorId: 'ADMIN', kyc: { status: 'approved' },
      });
      return { member: m, token: jwt.sign({ id: m._id.toString(), email: m.email, role: 'member', memberId }, secret) };
    };
    const A = await makeMember('TCE001', 'Anil Kumar', '9444400001');
    const B = await makeMember('TCE002', 'Bela Shah', '9444400002');

    const wallet = async (token: string) => (await call('GET', '/api/bv-wallet/me', undefined, token)).data.data;
    const send = (token: string, body: Record<string, unknown>) =>
      call('POST', '/api/bv-wallet/transfers', { title: 'Test transfer', requestKey: key(), confirmRepeat: true, ...body }, token);
    const adminSend = (body: Record<string, unknown>) => send(adminToken, { operatorName: 'Ravi', ...body });
    const setRate = (body: Record<string, unknown>, token = adminToken) =>
      call('PUT', '/api/company-earnings/rate', { operatorName: 'Ravi', password: ADMIN_PASSWORD, ...body }, token);
    const summary = async () => (await call('GET', '/api/company-earnings/summary', undefined, adminToken)).data.data;
    const entries = (type: string) => CompanyEarning.find({ type }).sort({ createdAt: 1 }).lean();

    await call('POST', '/api/bv-wallet/admin/generate', { amount: 20000, title: 'Stock', note: 'Opening stock', operatorName: 'Ravi', password: ADMIN_PASSWORD }, adminToken);

    console.log('\n--- Access control ---');
    let r = await call('GET', '/api/company-earnings/summary');
    assert(r.status === 401, 'Earnings need a login', r.status);
    r = await call('GET', '/api/company-earnings/summary', undefined, A.token);
    assert(r.status === 403, 'Members cannot see Super Admin earnings', r.status);
    r = await setRate({ rate: 1 }, A.token);
    assert(r.status === 403, 'Members cannot set the BV rate', r.status);
    r = await call('GET', '/api/payouts');
    assert(r.status === 401, 'Commission ledger needs a login', r.status);
    r = await call('POST', '/api/payouts/ANY/action', { action: 'pay' }, A.token);
    assert(r.status === 403, 'Members cannot mark commissions as paid', r.status);
    r = await call('GET', '/api/dashboard/stats');
    assert(r.status === 401, 'Dashboard stats need a login', r.status);
    r = await call('GET', '/api/reports/overview', undefined, A.token);
    assert(r.status === 403, 'Members cannot see the reports overview', r.status);
    await CommissionLedger.create([
      { ledgerId: 'COMM-T-A', userId: 'u', memberId: 'TCE001', type: 'BINARY_BONUS', sourceEventId: 'E1', grossAmount: 250, grossAmountInPaise: 25000, payableAmount: 250, payableAmountInPaise: 25000, status: 'APPROVED' },
      { ledgerId: 'COMM-T-B', userId: 'u', memberId: 'TCE002', type: 'BINARY_BONUS', sourceEventId: 'E2', grossAmount: 250, grossAmountInPaise: 25000, payableAmount: 250, payableAmountInPaise: 25000, status: 'APPROVED' },
    ]).catch(() => null);
    r = await call('GET', '/api/payouts', undefined, A.token);
    assert(r.status === 200 && Array.isArray(r.data) && r.data.every((p: any) => p.memberId === 'TCE001'), 'A member only sees its own commissions', r.data);

    console.log('\n--- BV rate ---');
    r = await adminSend({ recipientId: 'TCE001', amount: 100 });
    assert(r.status === 409 && /BV rate/.test(r.data.message), 'No BV can be sold before a rate is set', r.data);
    r = await setRate({ rate: 1.5, password: 'wrong' });
    assert(r.status === 403, 'Setting the rate needs the Super Admin password', r.data);
    r = await setRate({ rate: 1.5, operatorName: '' });
    assert(r.status === 400 && /operator/i.test(r.data.message), 'Setting the rate needs an operator name', r.data);
    for (const bad of [0, -2, 1.234, 'abc']) {
      r = await setRate({ rate: bad });
      assert(r.status === 400, `Rate ${JSON.stringify(bad)} is rejected`, r.data);
    }
    r = await setRate({ rate: 1.5, note: 'Launch price' });
    assert(r.status === 200 && r.data.data.rate === 1.5 && r.data.data.ratePaise === 150, 'Rate set to ₹1.50 per BV', r.data);
    r = await setRate({ rate: '1.50' });
    assert(r.status === 400 && /already/.test(r.data.message), 'Setting the same rate again is refused', r.data);

    console.log('\n--- BV sales ---');
    r = await adminSend({ recipientId: 'TCE001', amount: 2000, note: 'Paid by UPI' });
    const sale1 = r.data.data?.transaction;
    assert(r.status === 201 && sale1.rate === 1.5 && sale1.value === 3000, 'Sale records the rate and ₹ value (2,000 BV × ₹1.50 = ₹3,000)', r.data);
    let e = await entries('BV_SALE');
    assert(e.length === 1 && e[0].amountPaise === 300000 && e[0].bv === 2000 && e[0].ratePaise === 150 && e[0].memberId === 'TCE001' && e[0].performedBy.operatorName === 'Ravi',
      'One BV_SALE entry of +₹3,000 with operator', e);

    r = await setRate({ rate: 2 });
    assert(r.status === 200, 'Rate changed to ₹2.00', r.data);
    r = await adminSend({ recipientId: 'TCE001', amount: 1000 });
    const sale2 = r.data.data?.transaction;
    assert(r.status === 201 && sale2.value === 2000, 'New sale uses the new rate (1,000 BV × ₹2 = ₹2,000)', r.data);
    e = await entries('BV_SALE');
    assert(e.length === 2 && e[0].amountPaise === 300000 && e[1].amountPaise === 200000, 'Earlier sale keeps its old rate', e.map((x) => x.amountPaise));
    r = await call('GET', '/api/company-earnings/rate/history', undefined, adminToken);
    assert(r.status === 200 && r.data.data.length === 2 && r.data.data[0].rate === 2, 'Rate history lists both rates, newest first', r.data);

    let wa = await wallet(A.token);
    assert(wa.returns.purchasedBV === 3000 && wa.returns.purchasedValue === 5000, "Member's purchases recorded (3,000 BV for ₹5,000)", wa.returns);
    let wAdmin = await wallet(adminToken);
    assert(wAdmin.totalSold === 3000 && wAdmin.availableBV === 17000, 'Super Admin wallet shows 3,000 BV sold', wAdmin);
    // 100 BV locked from the wallet at binary activation
    assert(wa.availableBV === 2900 && wa.regularBV === 2900 && wa.bonusBV === 0, 'Member holds 2,900 regular BV after the activation lock', wa);

    console.log('\n--- Member -> member transfers earn nothing ---');
    r = await send(A.token, { recipientId: 'TCE002', amount: 500 });
    assert(r.status === 201 && r.data.data.transaction.value === null, 'Member transfer has no ₹ value', r.data);
    assert((await CompanyEarning.countDocuments()) === 2, 'No earnings entry for a member transfer');

    console.log('\n--- Welcome bonus BV stays with the member ---');
    await runInTransaction((session) =>
      BVWalletService.creditWelcomeBonus(session, { memberId: 'TCE002', memberName: 'Bela Shah', settlementId: 'WB-TEST-1', amount: 300 })
    );
    let wb = await wallet(B.token);
    // B received 500, locked 100 at activation, then 300 welcome bonus
    assert(wb.availableBV === 700 && wb.bonusBV === 300 && wb.regularBV === 400 && wb.sendableBV === 400, 'Welcome bonus kept apart: 400 regular + 300 bonus', wb);
    r = await send(B.token, { recipientId: 'TCE001', amount: 500 });
    assert(r.status === 400 && /up to 400 BV/.test(r.data.message) && /welcome bonus/.test(r.data.message), 'Welcome bonus BV cannot be transferred', r.data);
    assert((await wallet(B.token)).availableBV === 700, 'Refused transfer moves nothing');

    // BV-paid order spends welcome bonus first; refund puts it back where it came from
    const { purchase: bvOrder } = await BVWalletService.createPurchaseWithBV({
      purchase: {
        purchaseId: 'PUR-T-BV1', transactionId: 'TX-T-BV1', userId: B.member._id.toString(), memberId: 'TCE002', memberName: 'Bela Shah',
        type: 'REPURCHASE', items: orderItems(450, 900), totalAmount: 900, totalAmountInPaise: 90000, totalBV: 450,
      },
      memberId: 'TCE002',
      memberName: 'Bela Shah',
      actor: { role: 'member', email: `tce002${DOMAIN}` },
    });
    const payTxn = await BVTransaction.findOne({ type: 'PURCHASE', purchaseId: bvOrder.purchaseId });
    wb = await wallet(B.token);
    assert(payTxn?.bonusAmount === 300 && wb.bonusBV === 0 && wb.regularBV === 250, 'BV order uses 300 bonus BV first, then 150 regular', { bonus: payTxn?.bonusAmount, wb });
    r = await call('POST', `/api/purchases/${bvOrder.purchaseId}/verify-and-pay`, {}, adminToken);
    assert(r.status === 200, 'BV-paid order marked as paid', r.data);
    assert((await CompanyEarning.countDocuments({ type: 'ORDER_PAID' })) === 0, 'BV-paid order adds nothing to earnings (BV already sold)');
    r = await call('POST', `/api/purchases/${bvOrder.purchaseId}/refund`, { reason: 'Damaged' }, adminToken);
    wb = await wallet(B.token);
    assert(r.status === 200 && wb.bonusBV === 300 && wb.regularBV === 400, 'Refund returns 300 to bonus and 150 to regular', wb);
    assert((await CompanyEarning.countDocuments({ type: 'ORDER_REFUNDED' })) === 0, 'Refunding a BV-paid order changes no earnings');

    console.log('\n--- Bank / UPI orders ---');
    await Purchase.create({
      purchaseId: 'PUR-T-BANK1', transactionId: 'TX-T-BANK1', userId: A.member._id.toString(), memberId: 'TCE001', memberName: 'Anil Kumar',
      type: 'REPURCHASE', items: orderItems(650, 5000), totalAmount: 5000, totalAmountInPaise: 500000, totalBV: 650,
      paymentMethod: 'BANK_TRANSFER', paymentMode: 'UPI', paymentStatus: 'SUBMITTED', approvalStage: 'PAYMENT_SUBMITTED', utrNumber: 'UTR123456',
    });
    r = await call('POST', '/api/purchases/PUR-T-BANK1/verify-and-pay', {}, adminToken);
    e = await entries('ORDER_PAID');
    assert(r.status === 200 && e.length === 1 && e[0].amountPaise === 500000 && e[0].bv === 650 && e[0].paymentMode === 'UPI',
      'Mark as Paid adds the order total (+₹5,000), not BV × rate', e);
    r = await call('POST', '/api/purchases/PUR-T-BANK1/verify-and-pay', {}, adminToken);
    assert((await CompanyEarning.countDocuments({ type: 'ORDER_PAID' })) === 1, 'Marking paid twice counts the order once');
    r = await call('POST', '/api/purchases/PUR-T-BANK1/refund', { reason: 'Customer refund' }, adminToken);
    e = await entries('ORDER_REFUNDED');
    assert(r.status === 200 && e.length === 1 && e[0].amountPaise === -500000 && e[0].relatedEntryId === (await entries('ORDER_PAID'))[0].entryId,
      'Refund takes the order total back out (−₹5,000), linked to the payment', e);

    console.log('\n--- Returns to the company ---');
    wa = await wallet(A.token);
    // A bought 3,000 BV for ₹5,000 and holds 2,400 regular BV (100 locked at activation, 500 sent to B)
    assert(wa.returns.returnableBV === 2400 && wa.returns.returnableValue === 4000, 'A can return 2,400 BV worth ₹4,000 at its average price', wa.returns);
    r = await call('POST', '/api/bv-wallet/returns', { amount: 100, requestKey: key() }, B.token);
    assert(r.status === 400 && /no BV to return/.test(r.data.message), 'BV received from members or as welcome bonus cannot be returned', r.data);
    r = await call('POST', '/api/bv-wallet/returns', { amount: 2401, requestKey: key() }, A.token);
    assert(r.status === 400 && /up to 2,400 BV/.test(r.data.message), 'Cannot return more than the returnable BV', r.data);
    r = await call('POST', '/api/bv-wallet/returns', { amount: 10 }, adminToken);
    assert(r.status === 403, 'The Super Admin cannot file a return', r.data);

    // Request, then cancel
    const returnKey = key();
    r = await call('POST', '/api/bv-wallet/returns', { amount: 600, note: 'Not needed', requestKey: returnKey }, A.token);
    const req1 = r.data.data;
    assert(r.status === 201 && req1.status === 'PENDING' && req1.value === 1000, 'Return of 600 BV requested (value ₹1,000)', r.data);
    r = await call('POST', '/api/bv-wallet/returns', { amount: 600, requestKey: returnKey }, A.token);
    assert(r.status === 200 && r.data.duplicate === true && r.data.data.requestId === req1.requestId, 'Same request key does not file twice', r.data);
    wa = await wallet(A.token);
    assert(wa.availableBV === 1800 && wa.returns.pendingReturnBV === 600 && wa.returns.returnableBV === 1800, 'Requested BV is held from the wallet', wa);
    const adminNotice = await AdminNotification.findOne({ type: 'BV_RETURN_REQUESTED', recipientId: 'admin' });
    assert(!!adminNotice && adminNotice.message.includes(req1.requestId), 'Super Admin is notified of the return request');
    r = await call('POST', `/api/bv-wallet/returns/${req1.requestId}/cancel`, {}, B.token);
    assert(r.status === 404, "A member cannot cancel another member's return", r.data);
    r = await call('POST', `/api/bv-wallet/returns/${req1.requestId}/cancel`, {}, A.token);
    wa = await wallet(A.token);
    assert(r.status === 200 && r.data.data.status === 'CANCELLED' && wa.availableBV === 2400 && wa.returns.pendingReturnBV === 0, 'Cancelled return gives the BV back', wa);
    r = await call('POST', `/api/bv-wallet/returns/${req1.requestId}/cancel`, {}, A.token);
    assert(r.status === 409, 'A finished request cannot be cancelled again', r.data);

    // Request, then reject
    r = await call('POST', '/api/bv-wallet/returns', { amount: 300, requestKey: key() }, A.token);
    const req2 = r.data.data;
    r = await call('POST', `/api/bv-wallet/admin/returns/${req2.requestId}/reject`, { reason: '', operatorName: 'Ravi' }, adminToken);
    assert(r.status === 400 && /Reason/.test(r.data.message), 'Rejecting needs a reason', r.data);
    r = await call('POST', `/api/bv-wallet/admin/returns/${req2.requestId}/reject`, { reason: 'Refund not possible', operatorName: 'Ravi' }, adminToken);
    wa = await wallet(A.token);
    assert(r.status === 200 && r.data.data.status === 'REJECTED' && wa.availableBV === 2400, 'Rejected return gives the BV back', r.data);
    assert(!!(await AdminNotification.findOne({ type: 'BV_RETURN_REJECTED', recipientId: 'TCE001' })), 'Member is notified of the rejection');

    // Request, then approve
    r = await call('POST', '/api/bv-wallet/returns', { amount: 1200, requestKey: key() }, A.token);
    const req3 = r.data.data;
    assert(r.status === 201 && req3.value === 2000, 'Return of 1,200 BV requested (value ₹2,000)', r.data);
    r = await call('POST', `/api/bv-wallet/admin/returns/${req3.requestId}/approve`, { operatorName: 'Ravi', password: 'wrong' }, adminToken);
    assert(r.status === 403, 'Approving a return needs the Super Admin password', r.data);
    r = await call('POST', `/api/bv-wallet/admin/returns/${req3.requestId}/approve`, { operatorName: 'Ravi', password: ADMIN_PASSWORD }, A.token);
    assert(r.status === 403, 'Members cannot approve returns', r.data);
    r = await call('POST', `/api/bv-wallet/admin/returns/${req3.requestId}/approve`, { operatorName: 'Ravi', password: ADMIN_PASSWORD }, adminToken);
    assert(r.status === 200 && r.data.data.status === 'APPROVED', 'Super Admin approves the return', r.data);
    e = await entries('BV_RETURNED');
    assert(e.length === 1 && e[0].amountPaise === -200000 && e[0].bv === 1200 && e[0].sourceId === req3.requestId, 'Approved return deducts ₹2,000 from earnings', e);
    wAdmin = await wallet(adminToken);
    wa = await wallet(A.token);
    assert(wAdmin.availableBV === 18200 && wAdmin.totalReceived === 1200, 'Returned BV lands in the Super Admin wallet', wAdmin);
    assert(wa.availableBV === 1200 && wa.returns.returnedBV === 1200 && wa.returns.returnedValue === 2000 && wa.returns.returnableBV === 1200,
      "Member's returns recorded; 1,200 BV still returnable", wa.returns);
    r = await call('POST', `/api/bv-wallet/admin/returns/${req3.requestId}/approve`, { operatorName: 'Ravi', password: ADMIN_PASSWORD }, adminToken);
    assert(r.status === 409, 'A return cannot be approved twice', r.data);
    r = await call('GET', '/api/bv-wallet/returns', undefined, A.token);
    assert(r.status === 200 && r.data.data.length === 3 && r.data.data.every((x: any) => x.memberId === 'TCE001'), "Member sees its own return requests", r.data);
    r = await call('GET', '/api/bv-wallet/admin/returns?status=APPROVED', undefined, adminToken);
    assert(r.status === 200 && r.data.data.length === 1 && r.data.data[0].decidedBy?.operatorName === 'Ravi', 'Admin lists returns by status with the operator', r.data);

    console.log('\n--- Reversing sales ---');
    const reverse = (id: string) =>
      call('POST', `/api/bv-wallet/admin/transactions/${id}/reverse`, { reason: 'Sent by mistake', operatorName: 'Ravi', password: ADMIN_PASSWORD }, adminToken);
    // A holds 1,200 regular BV: reversing the 2,000 BV sale is impossible
    r = await reverse(sale1.transactionId);
    assert(r.status === 400, 'A sale cannot be reversed once the member no longer holds the BV', r.data);
    assert((await CompanyEarning.countDocuments({ type: 'BV_SALE_REVERSED' })) === 0, 'Refused reversal changes no earnings');
    r = await reverse(sale2.transactionId);
    e = await entries('BV_SALE_REVERSED');
    const sale2Entry = (await entries('BV_SALE'))[1];
    assert(r.status === 200 && e.length === 1 && e[0].amountPaise === -200000 && e[0].relatedEntryId === sale2Entry.entryId,
      'Reversing the 1,000 BV sale takes its ₹2,000 back out, linked to the sale', e);
    wa = await wallet(A.token);
    wAdmin = await wallet(adminToken);
    assert(wa.returns.purchasedBV === 2000 && wa.returns.purchasedValue === 3000 && wAdmin.totalSold === 2000, 'Purchases and BV sold go back down', { a: wa.returns, sold: wAdmin.totalSold });

    console.log('\n--- Reporting ---');
    const s = await summary();
    // +3,000 +2,000 -2,000 (sales) +5,000 -5,000 (order) -2,000 (return) = ₹1,000
    assert(s.total === 1000 && s.bvSales.amount === 3000 && s.bvSales.bv === 2000 && s.bvReturns.amount === -2000 && s.orders.amount === 0,
      'Summary: ₹1,000 net (₹3,000 BV sales − ₹2,000 returns; order paid and refunded)', s);
    assert(s.netBVSold === 800 && s.currentRate.rate === 2 && s.today === 1000 && s.thisMonth === 1000, 'Summary: net BV sold, current rate and period totals', s);
    r = await call('GET', '/api/company-earnings?type=BV_SALE', undefined, adminToken);
    assert(r.status === 200 && r.data.total === 2 && r.data.filteredAmount === 5000, 'List filters by type with a filtered total', r.data);
    r = await call('GET', '/api/company-earnings?memberId=TCE001&limit=2&page=1', undefined, adminToken);
    assert(r.status === 200 && r.data.data.length === 2 && r.data.total === 6 && r.data.totalPages === 3, 'List filters by member and pages', r.data);
    r = await call('GET', '/api/company-earnings/export?type=BV_SALE', undefined, adminToken);
    // fetch's text() drops the UTF-8 BOM the export starts with
    const csv = String(r.data).replace(/^﻿/, '');
    assert(r.status === 200 && (r.headers.get('content-type') || '').includes('text/csv') && csv.startsWith('Date (IST)') && csv.trim().split('\r\n').length === 3,
      'CSV export has a header and one row per entry', csv.slice(0, 200));
    r = await call('GET', '/api/company-earnings/export', undefined, A.token);
    assert(r.status === 403, 'Members cannot export earnings', r.status);

    const recon = await BVWalletService.reconcile();
    assert(recon.ok, 'BV reconciliation passes after sales, returns, bonus and refunds', recon.issues);
    assert(recon.totalHeldForReturns === 0, 'No BV is left held by return requests', recon);
  } finally {
    await wipe();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(async (error) => {
  console.error('Test run crashed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
