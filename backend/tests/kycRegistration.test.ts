/**
 * Registration (nominee fields, no KYC at signup) and Member KYC API tests.
 *
 * Runs the real Express app against MongoDB over HTTP. Because it creates and deletes members
 * and files, it only runs against a local database:
 *   MONGODB_URI=mongodb://127.0.0.1:27017/wetala_kyc_test npx tsx tests/kycRegistration.test.ts
 */
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { AddressInfo } from 'net';
import app from '../src/app';
import { Member } from '../src/models/Member.model';
import { KYC_FILE_PREFIX } from '../src/services/storage.service';

const MONGODB_URI = process.env.MONGODB_URI || '';
const TEST_EMAIL_DOMAIN = '@test-kyc.com';
const KYC_DIR = path.resolve(__dirname, '../private_uploads/kyc');

// 1x1 PNG and a minimal JPEG header (the server checks file signatures, not decoders)
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString('base64')}`;
const SVG_DATA_URL = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64')}`;
const FAKE_PNG_DATA_URL = `data:image/png;base64,${Buffer.from('this is not an image').toString('base64')}`;
const OVERSIZE_PNG_DATA_URL = `data:image/png;base64,${Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(3 * 1024 * 1024 + 10),
]).toString('base64')}`;
const DRIVE_LINK = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing';

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
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json() : await res.arrayBuffer();
  return { status: res.status, headers: res.headers, data: data as any };
}

const registration = (overrides: Record<string, unknown> = {}) => ({
  name: 'Kyc Tester',
  email: `tester${TEST_EMAIL_DOMAIN}`,
  mobile: '9888800001',
  password: 'Secret@123',
  confirmPassword: 'Secret@123',
  sponsorId: 'MEM0001',
  position: 'RIGHT',
  ...overrides,
});

const fullKyc = (overrides: Record<string, unknown> = {}) => ({
  accountHolderName: 'Kyc Tester',
  bankAccountNumber: '123456789012',
  ifscCode: 'SBIN0001234',
  upiId: 'tester@okaxis',
  aadhaarNumber: '234567890123',
  panNumber: 'ABCDE1234F',
  address: '12 MG Road, Andheri East, Mumbai',
  state: 'Maharashtra',
  pincode: '400069',
  documents: {
    upiQrImage: { upload: PNG_DATA_URL },
    aadhaarImage: { upload: JPEG_DATA_URL },
    panImage: { driveLink: DRIVE_LINK },
    profilePhoto: { upload: PNG_DATA_URL },
  },
  ...overrides,
});

const fileKeyOf = (reference: string) => reference.slice(KYC_FILE_PREFIX.length);

async function runTests() {
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGODB_URI)) {
    console.error('Refusing to run: set MONGODB_URI to a local test database (mongodb://127.0.0.1:...).');
    process.exit(1);
  }
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'kyc_test_secret';

  await mongoose.connect(MONGODB_URI);
  const server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const createdFiles: string[] = [];

  try {
    await Member.deleteMany({ email: { $regex: /@test-kyc\.com$/i } });

    // Root sponsor so referrals have someone to point at
    let root = await Member.findOne({ memberId: 'MEM0001' });
    if (!root) {
      root = await Member.create({
        memberId: 'MEM0001', name: 'Root Sponsor', email: `root${TEST_EMAIL_DOMAIN}`, mobile: '9888800000',
        password: 'password123', sponsorId: '', isBinaryActive: true, personalBv: 1250,
      });
    }

    console.log('\n--- Registration ---');
    let r = await call('POST', '/api/auth/register', registration({ confirmPassword: undefined }));
    assert(r.status === 400 && /Confirm Password is required/.test(r.data.message), 'Confirm Password is mandatory', r.data);

    r = await call('POST', '/api/auth/register', registration({ nomineePhone: '12345' }));
    assert(r.status === 400 && /Nominee Phone/.test(r.data.message), 'Invalid nominee phone rejected', r.data);

    r = await call('POST', '/api/auth/register', registration({ nomineeAge: '200' }));
    assert(r.status === 400 && /Nominee Age/.test(r.data.message), 'Out-of-range nominee age rejected', r.data);

    r = await call('POST', '/api/auth/register', registration({ nomineeName: 'R2D2!' }));
    assert(r.status === 400 && /Nominee Name/.test(r.data.message), 'Invalid nominee name rejected', r.data);

    r = await call('POST', '/api/auth/register', registration({ sponsorId: '' }));
    assert(r.status === 400 && /Sponsor ID is mandatory/.test(r.data.message), 'Sponsor ID still mandatory', r.data);

    r = await call('POST', '/api/auth/register', registration({
      nomineeName: 'Sunita Tester', nomineePhone: '9777700001', nomineeAge: 52,
      // KYC fields are no longer accepted at registration
      aadhaarNumber: '234567890123', panNumber: 'ABCDE1234F', address: '1 Main St', gender: 'Male',
    }));
    assert(r.status === 201 && r.data.status === true, 'Registration succeeds with nominee details', r.data);
    const memberA = await Member.findOne({ email: `tester${TEST_EMAIL_DOMAIN}` });
    assert(memberA?.nomineeName === 'Sunita Tester' && memberA?.nomineePhone === '9777700001' && memberA?.nomineeAge === 52, 'Nominee details stored');
    assert(!memberA?.aadhaarNumber && !memberA?.panNumber && !memberA?.address && !memberA?.gender, 'KYC/address fields ignored at registration');
    assert(memberA?.sponsorId === 'MEM0001' && memberA?.preferredLeg === 'RIGHT', 'Sponsor and position preserved');
    assert(memberA?.kyc.status === 'not_submitted', 'New member starts with KYC not submitted');

    r = await call('POST', '/api/auth/register', registration({ email: `minimal${TEST_EMAIL_DOMAIN}`, mobile: '9888800002' }));
    assert(r.status === 201, 'Registration succeeds without optional nominee fields', r.data);

    console.log('\n--- Login & profile without KYC ---');
    r = await call('POST', '/api/auth/login', { email: `tester${TEST_EMAIL_DOMAIN}`, password: 'Secret@123' });
    assert(r.status === 200 && Boolean(r.data.token), 'Member can log in before submitting KYC', r.data);
    const tokenA: string = r.data.token;

    r = await call('POST', '/api/auth/login', { email: `minimal${TEST_EMAIL_DOMAIN}`, password: 'Secret@123' });
    const tokenB: string = r.data.token;

    r = await call('GET', '/api/auth/me', undefined, tokenA);
    assert(r.data.data?.nomineeName === 'Sunita Tester' && r.data.data?.kycStatus === 'not_submitted', 'Profile returns nominee and KYC status', r.data.data);


    const adminToken = jwt.sign({ id: new mongoose.Types.ObjectId().toString(), email: 'admin@test-kyc.com', role: 'superadmin' }, process.env.JWT_SECRET!);

    console.log('\n--- Nominee update from profile ---');
    r = await call('PATCH', '/api/auth/profile/nominee', { nomineeName: 'Ravi Kumar' });
    assert(r.status === 401, 'Nominee update requires authentication');

    r = await call('PATCH', '/api/auth/profile/nominee', { nomineeName: 'Ravi Kumar' }, adminToken);
    assert(r.status === 403, 'Super Admin cannot use the member nominee endpoint');

    r = await call('PATCH', '/api/auth/profile/nominee', { nomineeName: 'Ravi Kumar', nomineePhone: '98765' }, tokenA);
    assert(r.status === 400 && /Nominee Phone/.test(r.data.message), 'Invalid nominee phone rejected on update', r.data);

    r = await call('PATCH', '/api/auth/profile/nominee', { nomineeAge: '0' }, tokenA);
    assert(r.status === 400 && /Nominee Age/.test(r.data.message), 'Invalid nominee age rejected on update', r.data);

    r = await call('PATCH', '/api/auth/profile/nominee', {
      nomineeName: '  Ravi   Kumar ', nomineePhone: '9666600001', nomineeAge: 61,
      // Attempts to change identity fields must be ignored
      email: `hijack${TEST_EMAIL_DOMAIN}`, mobile: '9000000000', phone: '9000000000', name: 'Someone Else', sponsorId: 'MEM9999',
    }, tokenA);
    assert(r.status === 200 && r.data.data.nomineeName === 'Ravi Kumar' && r.data.data.nomineeAge === 61, 'Nominee details updated', r.data);
    let afterUpdate = await Member.findOne({ email: `tester${TEST_EMAIL_DOMAIN}` });
    assert(afterUpdate?.nomineeName === 'Ravi Kumar' && afterUpdate?.nomineePhone === '9666600001' && afterUpdate?.nomineeAge === 61, 'Nominee update saved to database');
    assert(
      afterUpdate?.email === `tester${TEST_EMAIL_DOMAIN}` && afterUpdate?.mobile === '9888800001' && afterUpdate?.name === 'Kyc Tester' && afterUpdate?.sponsorId === 'MEM0001',
      'Email, mobile, name and sponsor cannot be changed through the nominee endpoint'
    );

    r = await call('GET', '/api/auth/me', undefined, tokenA);
    assert(
      r.data.data?.nomineeName === 'Ravi Kumar' && r.data.data?.nomineePhone === '9666600001' && r.data.data?.nomineeAge === 61,
      'Updated nominee returned after refresh (GET /auth/me)',
      r.data.data
    );

    r = await call('PATCH', '/api/auth/profile/nominee', { nomineeName: '', nomineePhone: '', nomineeAge: null }, tokenB);
    afterUpdate = await Member.findOne({ email: `minimal${TEST_EMAIL_DOMAIN}` });
    assert(r.status === 200 && afterUpdate?.nomineeName === '' && afterUpdate?.nomineeAge === null, 'Nominee fields can be cleared');
    afterUpdate = await Member.findOne({ email: `tester${TEST_EMAIL_DOMAIN}` });
    assert(afterUpdate?.nomineeName === 'Ravi Kumar', "Another member's update does not touch this member");

    console.log('\n--- KYC: access control & validation ---');
    r = await call('GET', '/api/kyc/me');
    assert(r.status === 401, 'KYC requires authentication');

    r = await call('GET', '/api/kyc/me', undefined, adminToken);
    assert(r.status === 403, 'Super Admin has no own KYC');

    r = await call('GET', '/api/kyc/me', undefined, tokenA);
    assert(r.status === 200 && r.data.data.status === 'not_submitted' && r.data.data.documents.aadhaarImage === null, 'Empty KYC returned', r.data);

    r = await call('PUT', '/api/kyc/me', { accountHolderName: 'Kyc Tester' }, tokenA);
    const missing = Object.keys(r.data.errors || {});
    assert(
      r.status === 400 && ['bankAccountNumber', 'ifscCode', 'upiId', 'aadhaarNumber', 'panNumber', 'address', 'state', 'pincode', 'upiQrImage', 'aadhaarImage', 'panImage', 'profilePhoto'].every((f) => missing.includes(f)),
      'All mandatory KYC fields enforced',
      missing
    );

    r = await call('PUT', '/api/kyc/me', fullKyc({ ifscCode: 'SBIN1234', panNumber: 'ABCD1234F', aadhaarNumber: '123456789012', upiId: 'not-a-upi', bankAccountNumber: '12ab' }), tokenA);
    assert(
      r.status === 400 && ['ifscCode', 'panNumber', 'aadhaarNumber', 'upiId', 'bankAccountNumber'].every((f) => r.data.errors?.[f]),
      'Malformed IFSC / PAN / Aadhaar / UPI / account number rejected',
      r.data.errors
    );

    r = await call('PUT', '/api/kyc/me', fullKyc({ address: 'Mumbai', state: 'M4h@', pincode: '012345' }), tokenA);
    assert(
      r.status === 400 && ['address', 'state', 'pincode'].every((f) => r.data.errors?.[f]),
      'Too-short address, invalid state and invalid pincode rejected',
      r.data.errors
    );

    const filesBefore = fs.readdirSync(KYC_DIR).length;
    r = await call('PUT', '/api/kyc/me', fullKyc({ documents: { ...fullKyc().documents, upiQrImage: { upload: SVG_DATA_URL } } }), tokenA);
    assert(r.status === 400 && /Unsupported file type/.test(r.data.errors?.upiQrImage), 'SVG upload rejected', r.data.errors);

    r = await call('PUT', '/api/kyc/me', fullKyc({ documents: { ...fullKyc().documents, aadhaarImage: { upload: FAKE_PNG_DATA_URL } } }), tokenA);
    assert(r.status === 400 && /Unsupported file type/.test(r.data.errors?.aadhaarImage), 'File with spoofed image MIME type rejected', r.data.errors);

    r = await call('PUT', '/api/kyc/me', fullKyc({ documents: { ...fullKyc().documents, profilePhoto: { upload: OVERSIZE_PNG_DATA_URL } } }), tokenA);
    assert(r.status === 400 && /too large/.test(r.data.errors?.profilePhoto), 'Oversized image rejected', r.data.errors);

    r = await call('PUT', '/api/kyc/me', fullKyc({ documents: { ...fullKyc().documents, panImage: { driveLink: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp' } } }), tokenA);
    assert(r.status === 400 && /Google Drive file link/.test(r.data.errors?.panImage), 'Drive folder link rejected', r.data.errors);

    r = await call('PUT', '/api/kyc/me', fullKyc({ documents: { ...fullKyc().documents, panImage: { driveLink: 'https://evil.example.com/pan.jpg' } } }), tokenA);
    assert(r.status === 400 && r.data.errors?.panImage, 'Non-Drive external link rejected', r.data.errors);
    assert(fs.readdirSync(KYC_DIR).length === filesBefore, 'Rejected submissions write no files');

    console.log('\n--- KYC: submit ---');
    r = await call('PUT', '/api/kyc/me', fullKyc(), tokenA);
    assert(r.status === 200 && r.data.data.status === 'pending', 'Valid KYC submitted and pending review', r.data);
    const kycA = r.data.data;
    assert(kycA.bankAccountNumberMasked.endsWith('9012') && !kycA.bankAccountNumber && !kycA.aadhaarNumber, 'Member sees masked account / Aadhaar numbers only', kycA);
    assert(kycA.aadhaarNumberMasked === '•••• •••• 0123', 'Aadhaar masked to last 4 digits', kycA.aadhaarNumberMasked);
    assert(kycA.documents.panImage?.source === 'drive' && kycA.documents.panImage.url === 'https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345=s0', 'Drive link converted to direct image URL', kycA.documents.panImage);
    assert(kycA.documents.aadhaarImage?.source === 'upload' && kycA.documents.upiQrImage?.source === 'upload', 'Uploads stored as private files');

    const stored = await Member.findOne({ email: `tester${TEST_EMAIL_DOMAIN}` });
    createdFiles.push(stored!.kyc.upiQrImage, stored!.kyc.aadhaarImage, stored!.kyc.profilePhoto);
    assert(stored!.aadhaarNumber === '234567890123' && stored!.panNumber === 'ABCDE1234F', 'Aadhaar / PAN saved on member record');
    assert(
      stored!.address === '12 MG Road, Andheri East, Mumbai' && stored!.state === 'Maharashtra' && stored!.pincode === '400069' &&
        kycA.address === stored!.address && kycA.pincode === '400069',
      'Address, state and pincode saved and returned'
    );
    assert(createdFiles.every((ref) => fs.existsSync(path.join(KYC_DIR, fileKeyOf(ref)))), 'Uploaded files exist in private storage');
    assert(stored!.kyc.aadhaarImage.endsWith('.jpg') && stored!.kyc.upiQrImage.endsWith('.png'), 'File extension taken from detected format');

    console.log('\n--- KYC: document access ---');
    const aadhaarKey = kycA.documents.aadhaarImage.fileKey;
    r = await call('GET', `/api/kyc/files/${aadhaarKey}`);
    assert(r.status === 401, 'Document requires authentication');

    r = await call('GET', `/api/kyc/files/${aadhaarKey}`, undefined, tokenA);
    assert(r.status === 200 && r.headers.get('content-type') === 'image/jpeg' && /no-store/.test(r.headers.get('cache-control') || ''), 'Owner can view own document (private, no-store)', r.status);

    r = await call('GET', `/api/kyc/files/${aadhaarKey}`, undefined, tokenB);
    assert(r.status === 404, 'Another member cannot view the document');

    r = await call('GET', `/api/kyc/files/${aadhaarKey}`, undefined, adminToken);
    assert(r.status === 200, 'Super Admin can view the document');

    r = await call('GET', '/api/kyc/files/..%2F..%2F.env', undefined, adminToken);
    assert(r.status === 404, 'Path traversal key rejected');

    for (const publicPath of [`/uploads/kyc/${aadhaarKey}`, `/uploads/../private_uploads/kyc/${aadhaarKey}`, `/private_uploads/kyc/${aadhaarKey}`]) {
      r = await call('GET', publicPath);
      assert(r.status === 404, `Not reachable via public path ${publicPath}`, r.status);
    }

    console.log('\n--- KYC: data exposure ---');
    r = await call('GET', '/api/members', undefined, adminToken);
    const listed = (r.data as any[]).find((m) => m.memberId === stored!.memberId);
    assert(Boolean(listed) && !JSON.stringify(listed).includes('123456789012') && !JSON.stringify(listed).includes(KYC_FILE_PREFIX), 'Members list exposes no bank data or document references');

    const serialized = JSON.stringify(stored!.toJSON());
    assert(!serialized.includes('123456789012') && !serialized.includes('234567890123') && !serialized.includes(KYC_FILE_PREFIX), 'Serialized member document strips KYC data', serialized.slice(0, 300));

    r = await call('GET', `/api/kyc/members/${stored!.memberId}`, undefined, tokenB);
    assert(r.status === 403, 'Members cannot read another member\'s KYC');

    r = await call('GET', `/api/kyc/members/${stored!.memberId}`, undefined, adminToken);
    assert(r.status === 200 && r.data.data.bankAccountNumber === '123456789012' && r.data.data.aadhaarNumber === '234567890123', 'Super Admin sees full details for verification');

    console.log('\n--- KYC: review & update ---');
    r = await call('PATCH', `/api/kyc/members/${stored!.memberId}/review`, { decision: 'rejected' }, adminToken);
    assert(r.status === 400, 'Rejection requires a reason');

    r = await call('PATCH', `/api/kyc/members/${stored!.memberId}/review`, { decision: 'rejected', reason: 'PAN image is blurry' }, adminToken);
    assert(r.status === 200 && r.data.data.status === 'rejected', 'Super Admin can reject KYC');

    r = await call('GET', '/api/kyc/me', undefined, tokenA);
    assert(r.data.data.status === 'rejected' && r.data.data.rejectionReason === 'PAN image is blurry', 'Member sees rejection reason');

    // Update: keep account / Aadhaar numbers and most documents, replace the Aadhaar image
    const oldAadhaarRef = stored!.kyc.aadhaarImage;
    r = await call('PUT', '/api/kyc/me', {
      accountHolderName: 'Kyc Tester',
      ifscCode: 'HDFC0000123',
      upiId: 'tester@okhdfc',
      panNumber: 'ABCDE1234F',
      address: '12 MG Road, Andheri East, Mumbai',
      state: 'Maharashtra',
      pincode: '400069',
      documents: { aadhaarImage: { upload: PNG_DATA_URL } },
    }, tokenA);
    assert(r.status === 200 && r.data.data.status === 'pending' && r.data.data.rejectionReason === '', 'Resubmission goes back to pending', r.data);
    const updated = await Member.findOne({ email: `tester${TEST_EMAIL_DOMAIN}` });
    createdFiles.push(updated!.kyc.aadhaarImage);
    assert(updated!.kyc.bankAccountNumber === '123456789012' && updated!.aadhaarNumber === '234567890123', 'Blank account / Aadhaar keeps values on file');
    assert(updated!.kyc.ifscCode === 'HDFC0000123', 'Changed IFSC saved');
    assert(updated!.kyc.aadhaarImage !== oldAadhaarRef && !fs.existsSync(path.join(KYC_DIR, fileKeyOf(oldAadhaarRef))), 'Replaced document file deleted from storage');
    assert(updated!.kyc.profilePhoto === stored!.kyc.profilePhoto, 'Untouched documents kept');

    r = await call('PATCH', `/api/kyc/members/${stored!.memberId}/review`, { decision: 'approved' }, adminToken);
    assert(r.status === 200 && r.data.data.status === 'approved', 'Super Admin can approve KYC');

    r = await call('GET', '/api/auth/me', undefined, tokenA);
    assert(r.data.data?.kycStatus === 'approved', 'Profile reflects approved KYC status');
  } finally {
    const leftovers = await Member.find({ email: { $regex: /@test-kyc\.com$/i } });
    for (const m of leftovers) {
      for (const ref of [m.kyc?.upiQrImage, m.kyc?.aadhaarImage, m.kyc?.panImage, m.kyc?.profilePhoto]) {
        if (ref?.startsWith(KYC_FILE_PREFIX)) createdFiles.push(ref);
      }
    }
    for (const ref of createdFiles) {
      const filePath = path.join(KYC_DIR, fileKeyOf(ref));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await Member.deleteMany({ email: { $regex: /@test-kyc\.com$/i } });
    server.close();
    await mongoose.disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
