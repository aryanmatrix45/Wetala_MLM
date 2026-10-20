import { Response } from 'express';
import { Member, IMember, KYC_IMAGE_FIELDS, KycImageField } from '../models/Member.model';
import { StorageService, KYC_FILE_PREFIX } from '../services/storage.service';
import { HTTP_STATUS, ROLES } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';
import { extractGoogleDriveFileId, toGoogleDriveImageUrl } from '../utils/googleDrive';

const IMAGE_FIELD_LABELS: Record<KycImageField, string> = {
  upiQrImage: 'UPI QR Code',
  aadhaarImage: 'Aadhaar Card image',
  panImage: 'PAN Card image',
  profilePhoto: 'Profile Photo',
};

const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]{1,99}$/;
const BANK_ACCOUNT_PATTERN = /^\d{9,18}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;
const AADHAAR_PATTERN = /^[2-9]\d{11}$/;
const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/;
const STATE_PATTERN = /^[A-Za-z][A-Za-z .&-]{1,59}$/;
const PINCODE_PATTERN = /^[1-9]\d{5}$/;

const maskTail = (value: string, visible = 4): string =>
  value ? `${'•'.repeat(Math.max(value.length - visible, 4))}${value.slice(-visible)}` : '';

const serializeDocument = (reference: string) => {
  if (!reference) return null;
  if (reference.startsWith(KYC_FILE_PREFIX)) {
    return { source: 'upload' as const, fileKey: reference.slice(KYC_FILE_PREFIX.length) };
  }
  const driveId = extractGoogleDriveFileId(reference);
  return {
    source: 'drive' as const,
    url: driveId ? toGoogleDriveImageUrl(driveId) : reference,
    originalUrl: reference,
  };
};

/**
 * KYC payload for the client. Members see their bank account and Aadhaar numbers masked;
 * the Super Admin (who verifies KYC) sees them in full.
 */
const serializeKyc = (member: IMember, revealSensitive: boolean) => {
  const kyc = member.kyc || ({} as IMember['kyc']);
  const aadhaar = member.aadhaarNumber || '';
  const account = kyc.bankAccountNumber || '';

  return {
    memberId: member.memberId,
    status: kyc.status || 'not_submitted',
    submittedAt: kyc.submittedAt || null,
    reviewedAt: kyc.reviewedAt || null,
    rejectionReason: kyc.rejectionReason || '',
    accountHolderName: kyc.accountHolderName || '',
    ifscCode: kyc.ifscCode || '',
    upiId: kyc.upiId || '',
    panNumber: member.panNumber || '',
    address: member.address || '',
    state: member.state || '',
    pincode: member.pincode || '',
    hasBankAccountNumber: Boolean(account),
    hasAadhaarNumber: Boolean(aadhaar),
    bankAccountNumberMasked: maskTail(account),
    aadhaarNumberMasked: aadhaar ? `•••• •••• ${aadhaar.slice(-4)}` : '',
    ...(revealSensitive ? { bankAccountNumber: account, aadhaarNumber: aadhaar } : {}),
    documents: Object.fromEntries(
      KYC_IMAGE_FIELDS.map((field) => [field, serializeDocument(kyc[field] || '')])
    ) as Record<KycImageField, ReturnType<typeof serializeDocument>>,
  };
};

const findOwnMember = async (req: AuthenticatedRequest): Promise<IMember | null> => {
  if (req.user?.role !== ROLES.MEMBER || !req.user.id) return null;
  return Member.findById(req.user.id);
};

export const KycController = {
  /**
   * Current member's KYC details
   * GET /api/kyc/me
   */
  async getMyKyc(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const member = await findOwnMember(req);
      if (!member) {
        res.status(HTTP_STATUS.FORBIDDEN).json({ status: false, message: 'KYC is available to member accounts only.' });
        return;
      }
      res.status(HTTP_STATUS.OK).json({ status: true, data: serializeKyc(member, false) });
    } catch (error: any) {
      console.error('[KycController.getMyKyc] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Failed to load KYC details.' });
    }
  },

  /**
   * Submit or update the current member's KYC. Every mandatory field must be present after the
   * update; values already on file (account number, Aadhaar number, documents) may be omitted
   * to keep them. Any change sends the KYC back for review.
   * PUT /api/kyc/me
   * Body: { accountHolderName, bankAccountNumber?, ifscCode, upiId, aadhaarNumber?, panNumber,
   *         address, state, pincode,
   *         documents?: { [field]: { upload: <data URL> } | { driveLink: <url> } } }
   */
  async submitMyKyc(req: AuthenticatedRequest, res: Response): Promise<void> {
    const writtenFiles: string[] = [];
    try {
      const member = await findOwnMember(req);
      if (!member) {
        res.status(HTTP_STATUS.FORBIDDEN).json({ status: false, message: 'KYC is available to member accounts only.' });
        return;
      }

      const body = req.body || {};
      const kyc = member.kyc;
      const errors: Record<string, string> = {};

      const accountHolderName = String(body.accountHolderName ?? '').trim().replace(/\s+/g, ' ');
      if (!accountHolderName) errors.accountHolderName = 'Account Holder Name is required.';
      else if (!NAME_PATTERN.test(accountHolderName)) {
        errors.accountHolderName = 'Account Holder Name may contain letters, spaces, dots, hyphens and apostrophes only.';
      }

      const rawAccount = String(body.bankAccountNumber ?? '').replace(/\s+/g, '');
      const bankAccountNumber = rawAccount || kyc.bankAccountNumber || '';
      if (!bankAccountNumber) errors.bankAccountNumber = 'Bank Account Number is required.';
      else if (rawAccount && !BANK_ACCOUNT_PATTERN.test(rawAccount)) {
        errors.bankAccountNumber = 'Bank Account Number must be 9 to 18 digits.';
      }

      const ifscCode = String(body.ifscCode ?? '').trim().toUpperCase();
      if (!ifscCode) errors.ifscCode = 'IFSC Code is required.';
      else if (!IFSC_PATTERN.test(ifscCode)) {
        errors.ifscCode = 'Enter a valid 11-character IFSC Code (e.g. SBIN0001234).';
      }

      const upiId = String(body.upiId ?? '').trim();
      if (!upiId) errors.upiId = 'UPI ID is required.';
      else if (!UPI_ID_PATTERN.test(upiId)) errors.upiId = 'Enter a valid UPI ID (e.g. name@okbank).';

      const rawAadhaar = String(body.aadhaarNumber ?? '').replace(/\s+/g, '');
      const aadhaarNumber = rawAadhaar || member.aadhaarNumber || '';
      if (!aadhaarNumber) errors.aadhaarNumber = 'Aadhaar Card Number is required.';
      else if (rawAadhaar && !AADHAAR_PATTERN.test(rawAadhaar)) {
        errors.aadhaarNumber = 'Aadhaar Number must be 12 digits and cannot start with 0 or 1.';
      }

      const panNumber = String(body.panNumber ?? '').trim().toUpperCase();
      if (!panNumber) errors.panNumber = 'PAN Card Number is required.';
      else if (!PAN_PATTERN.test(panNumber)) errors.panNumber = 'Enter a valid PAN (e.g. ABCDE1234F).';

      const address = String(body.address ?? '').trim().replace(/\s+/g, ' ');
      if (!address) errors.address = 'Full Address is required.';
      else if (address.length < 10 || address.length > 300) {
        errors.address = 'Full Address must be between 10 and 300 characters.';
      }

      const state = String(body.state ?? '').trim().replace(/\s+/g, ' ');
      if (!state) errors.state = 'State is required.';
      else if (!STATE_PATTERN.test(state)) errors.state = 'Enter a valid State name.';

      const pincode = String(body.pincode ?? '').trim();
      if (!pincode) errors.pincode = 'Pincode is required.';
      else if (!PINCODE_PATTERN.test(pincode)) errors.pincode = 'Pincode must be 6 digits and cannot start with 0.';

      // Validate every document before writing anything to disk
      const documents = body.documents && typeof body.documents === 'object' ? body.documents : {};
      const pendingUploads: Array<{ field: KycImageField; buffer: Buffer; ext: string }> = [];
      const newLinks: Partial<Record<KycImageField, string>> = {};

      for (const field of KYC_IMAGE_FIELDS) {
        const label = IMAGE_FIELD_LABELS[field];
        const input = documents[field];

        if (input && typeof input === 'object' && 'upload' in input) {
          const parsed = StorageService.parseKycImage(input.upload);
          if ('error' in parsed) errors[field] = `${label}: ${parsed.error}`;
          else pendingUploads.push({ field, buffer: parsed.buffer, ext: parsed.ext });
        } else if (input && typeof input === 'object' && 'driveLink' in input) {
          const link = String(input.driveLink ?? '').trim();
          if (!extractGoogleDriveFileId(link)) {
            errors[field] = `${label}: enter a Google Drive file link (https://drive.google.com/file/d/...).`;
          } else {
            newLinks[field] = link;
          }
        } else if (input !== undefined && input !== null) {
          errors[field] = `${label}: invalid document data.`;
        } else if (!kyc[field]) {
          errors[field] = `${label} is required.`;
        }
      }

      if (Object.keys(errors).length > 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: Object.values(errors)[0],
          errors,
        });
        return;
      }

      // Write new uploads, then swap references on the member
      const replacedReferences: string[] = [];
      const setReference = (field: KycImageField, reference: string) => {
        if (kyc[field] && kyc[field] !== reference) replacedReferences.push(kyc[field]);
        kyc[field] = reference;
      };

      for (const upload of pendingUploads) {
        const reference = await StorageService.saveKycImage(upload.buffer, upload.ext);
        writtenFiles.push(reference);
        setReference(upload.field, reference);
      }
      for (const [field, link] of Object.entries(newLinks) as Array<[KycImageField, string]>) {
        setReference(field, link);
      }

      kyc.accountHolderName = accountHolderName;
      kyc.bankAccountNumber = bankAccountNumber;
      kyc.ifscCode = ifscCode;
      kyc.upiId = upiId;
      member.aadhaarNumber = aadhaarNumber;
      member.panNumber = panNumber;
      member.address = address;
      member.state = state;
      member.pincode = pincode;

      const wasSubmitted = kyc.status !== 'not_submitted';
      kyc.status = 'pending';
      kyc.submittedAt = new Date();
      kyc.reviewedAt = undefined;
      kyc.reviewedBy = undefined;
      kyc.rejectionReason = '';

      await member.save();
      writtenFiles.length = 0;

      // Old files are only removed once the new references are safely stored
      await Promise.all(replacedReferences.map((ref) => StorageService.deleteKycImage(ref)));

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: wasSubmitted
          ? 'KYC details updated and sent for verification.'
          : 'KYC submitted successfully. Verification is in progress.',
        data: serializeKyc(member, false),
      });
    } catch (error: any) {
      console.error('[KycController.submitMyKyc] Error:', error);
      await Promise.all(writtenFiles.map((ref) => StorageService.deleteKycImage(ref)));
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Failed to save KYC details.' });
    }
  },

  /**
   * Stream a private KYC document. Only the member who owns it and the Super Admin may view it.
   * GET /api/kyc/files/:key
   */
  async getKycFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const key = String(req.params.key || '');
      const notFound = () => {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Document not found.' });
      };

      if (!StorageService.isValidKycFileKey(key)) {
        notFound();
        return;
      }

      const reference = `${KYC_FILE_PREFIX}${key}`;
      const owner = await Member.findOne({
        $or: KYC_IMAGE_FIELDS.map((field) => ({ [`kyc.${field}`]: reference })),
      }).select('memberId');

      const isSuperAdmin = req.user?.role === ROLES.SUPERADMIN;
      const isOwner = Boolean(owner && req.user?.role === ROLES.MEMBER && owner.memberId === req.user.memberId);
      const filePath = owner ? StorageService.getKycFilePath(key) : null;

      // Unauthorized requests get the same response as missing files, so keys can't be probed
      if (!filePath || !(isSuperAdmin || isOwner)) {
        notFound();
        return;
      }

      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
      res.sendFile(filePath);
    } catch (error: any) {
      console.error('[KycController.getKycFile] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Failed to load document.' });
    }
  },

  /**
   * Super Admin: full KYC details of a member for verification
   * GET /api/kyc/members/:memberId
   */
  async getMemberKyc(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const member = await Member.findOne({ memberId: String(req.params.memberId || '').toUpperCase().trim() });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Member not found.' });
        return;
      }
      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: { ...serializeKyc(member, true), name: member.name, email: member.email, mobile: member.mobile },
      });
    } catch (error: any) {
      console.error('[KycController.getMemberKyc] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Failed to load KYC details.' });
    }
  },

  /**
   * Super Admin: approve or reject a submitted KYC
   * PATCH /api/kyc/members/:memberId/review
   * Body: { decision: 'approved' | 'rejected', reason?: string }
   */
  async reviewMemberKyc(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const decision = String(req.body?.decision || '');
      const reason = String(req.body?.reason || '').trim();

      if (decision !== 'approved' && decision !== 'rejected') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: "Decision must be 'approved' or 'rejected'." });
        return;
      }
      if (decision === 'rejected' && !reason) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'A reason is required when rejecting KYC.' });
        return;
      }

      const member = await Member.findOne({ memberId: String(req.params.memberId || '').toUpperCase().trim() });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Member not found.' });
        return;
      }
      if (member.kyc.status === 'not_submitted') {
        res.status(HTTP_STATUS.CONFLICT).json({ status: false, message: 'This member has not submitted KYC yet.' });
        return;
      }

      member.kyc.status = decision;
      member.kyc.reviewedAt = new Date();
      member.kyc.reviewedBy = req.user?.email || 'ADMIN';
      member.kyc.rejectionReason = decision === 'rejected' ? reason : '';
      await member.save();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `KYC ${decision} for ${member.name} (${member.memberId}).`,
        data: serializeKyc(member, true),
      });
    } catch (error: any) {
      console.error('[KycController.reviewMemberKyc] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Failed to update KYC status.' });
    }
  },
};
