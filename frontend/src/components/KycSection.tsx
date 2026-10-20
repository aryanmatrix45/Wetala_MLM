import React, { useEffect, useState } from 'react';
import {
  Landmark, QrCode, Fingerprint, Upload, Link2, Undo2, AlertCircle, CheckCircle2,
  ShieldCheck, Clock, XCircle, FileWarning, Loader2, MapPin,
} from 'lucide-react';
import {
  api,
  type KycDetails,
  type KycImageField,
  type KycStatus,
  type KycSubmitPayload,
} from '../services/api';
import { KycDocumentImage, type KycImageLoadState, type KycImageSource } from './KycDocumentImage';
import { KYC_ACCEPT_ATTR, KYC_MAX_SOURCE_MB, isGoogleDriveFileLink, prepareKycImage } from '../utils/kycImage';

// Same rules as the backend (kyc.controller.ts)
const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]{1,99}$/;
const BANK_ACCOUNT_PATTERN = /^\d{9,18}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;
const AADHAAR_PATTERN = /^[2-9]\d{11}$/;
const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/;
const STATE_PATTERN = /^[A-Za-z][A-Za-z .&-]{1,59}$/;
const PINCODE_PATTERN = /^[1-9]\d{5}$/;

const STATUS_META: Record<KycStatus, { label: string; pill: string; icon: React.ElementType; text: string }> = {
  not_submitted: {
    label: 'Not Submitted',
    pill: 'is-muted',
    icon: FileWarning,
    text: 'Submit your bank, payment and identity details below for verification.',
  },
  pending: {
    label: 'Under Review',
    pill: 'is-warning',
    icon: Clock,
    text: 'Your KYC has been submitted and is awaiting verification.',
  },
  approved: {
    label: 'Verified',
    pill: 'is-success',
    icon: ShieldCheck,
    text: 'Your KYC is verified. Updating any detail will send it for verification again.',
  },
  rejected: {
    label: 'Rejected',
    pill: 'is-danger',
    icon: XCircle,
    text: 'Your KYC was not approved. Please correct the details and submit again.',
  },
};

const DOCUMENT_FIELDS: Record<KycImageField, { label: string; hint: string }> = {
  upiQrImage: { label: 'UPI QR Code', hint: 'Clear screenshot or photo of your UPI payment QR code.' },
  aadhaarImage: { label: 'Aadhaar Card Image', hint: 'Front side, with all text readable.' },
  panImage: { label: 'PAN Card Image', hint: 'Front side, with name and PAN number readable.' },
  profilePhoto: { label: 'Profile Photograph', hint: 'Recent passport-style photo with your face clearly visible.' },
};

interface DocumentDraft {
  mode: 'upload' | 'drive';
  uploadDataUrl: string;
  driveLink: string;
  processing: boolean;
  linkState: KycImageLoadState | null;
}

const emptyDraft = (): DocumentDraft => ({
  mode: 'upload',
  uploadDataUrl: '',
  driveLink: '',
  processing: false,
  linkState: null,
});

const emptyDrafts = (): Record<KycImageField, DocumentDraft> => ({
  upiQrImage: emptyDraft(),
  aadhaarImage: emptyDraft(),
  panImage: emptyDraft(),
  profilePhoto: emptyDraft(),
});

const formFromKyc = (kyc: KycDetails | null) => ({
  accountHolderName: kyc?.accountHolderName || '',
  bankAccountNumber: '',
  ifscCode: kyc?.ifscCode || '',
  upiId: kyc?.upiId || '',
  aadhaarNumber: '',
  panNumber: kyc?.panNumber || '',
  address: kyc?.address || '',
  state: kyc?.state || '',
  pincode: kyc?.pincode || '',
});

const hasNewDocument = (draft: DocumentDraft) =>
  draft.mode === 'upload' ? Boolean(draft.uploadDataUrl) : Boolean(draft.driveLink.trim());

interface KycSectionProps {
  token: string;
  onKycLoaded?: (kyc: KycDetails) => void;
}

export const KycSection: React.FC<KycSectionProps> = ({ token, onKycLoaded }) => {
  const [kyc, setKyc] = useState<KycDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(formFromKyc(null));
  const [drafts, setDrafts] = useState(emptyDrafts);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const applyKyc = (data: KycDetails) => {
    setKyc(data);
    setForm(formFromKyc(data));
    setDrafts(emptyDrafts());
    onKycLoaded?.(data);
  };

  const loadKyc = () => {
    setLoading(true);
    setLoadError(null);
    api
      .getMyKyc(token)
      .then((res) => {
        if (res.status && res.data) applyKyc(res.data);
        else setLoadError(res.message || 'Unable to load your KYC details.');
      })
      .catch(() => setLoadError('Unable to load your KYC details. Please check your connection.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadKyc, [token]);

  const setField = (name: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setSuccessMsg(null);
  };

  const updateDraft = (field: KycImageField, patch: Partial<DocumentDraft>) => {
    setDrafts((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } }));
    setSuccessMsg(null);
  };

  const setDocError = (field: KycImageField, message: string) =>
    setErrors((prev) => ({ ...prev, [field]: message }));

  const handleFileChosen = async (field: KycImageField, file: File | undefined) => {
    if (!file) return;
    setDocError(field, '');
    updateDraft(field, { processing: true });
    try {
      const dataUrl = await prepareKycImage(file);
      updateDraft(field, { mode: 'upload', uploadDataUrl: dataUrl, driveLink: '', linkState: null, processing: false });
    } catch (err: any) {
      updateDraft(field, { processing: false });
      setDocError(field, err.message || 'This image could not be used.');
    }
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    const name = form.accountHolderName.trim();
    if (!name) next.accountHolderName = 'Account Holder Name is required.';
    else if (!NAME_PATTERN.test(name)) next.accountHolderName = 'Use letters, spaces, dots, hyphens and apostrophes only.';

    if (form.bankAccountNumber) {
      if (!BANK_ACCOUNT_PATTERN.test(form.bankAccountNumber)) next.bankAccountNumber = 'Bank Account Number must be 9 to 18 digits.';
    } else if (!kyc?.hasBankAccountNumber) {
      next.bankAccountNumber = 'Bank Account Number is required.';
    }

    if (!form.ifscCode) next.ifscCode = 'IFSC Code is required.';
    else if (!IFSC_PATTERN.test(form.ifscCode)) next.ifscCode = 'Enter a valid 11-character IFSC Code (e.g. SBIN0001234).';

    if (!form.upiId.trim()) next.upiId = 'UPI ID is required.';
    else if (!UPI_ID_PATTERN.test(form.upiId.trim())) next.upiId = 'Enter a valid UPI ID (e.g. name@okbank).';

    if (form.aadhaarNumber) {
      if (!AADHAAR_PATTERN.test(form.aadhaarNumber)) next.aadhaarNumber = 'Aadhaar Number must be 12 digits and cannot start with 0 or 1.';
    } else if (!kyc?.hasAadhaarNumber) {
      next.aadhaarNumber = 'Aadhaar Card Number is required.';
    }

    if (!form.panNumber) next.panNumber = 'PAN Card Number is required.';
    else if (!PAN_PATTERN.test(form.panNumber)) next.panNumber = 'Enter a valid PAN (e.g. ABCDE1234F).';

    const address = form.address.trim();
    if (!address) next.address = 'Full Address is required.';
    else if (address.length < 10) next.address = 'Please enter your complete address (house, street, area, city).';

    if (!form.state.trim()) next.state = 'State is required.';
    else if (!STATE_PATTERN.test(form.state.trim())) next.state = 'Enter a valid State name.';

    if (!form.pincode) next.pincode = 'Pincode is required.';
    else if (!PINCODE_PATTERN.test(form.pincode)) next.pincode = 'Pincode must be 6 digits and cannot start with 0.';

    (Object.keys(DOCUMENT_FIELDS) as KycImageField[]).forEach((field) => {
      const draft = drafts[field];
      const label = DOCUMENT_FIELDS[field].label;
      if (draft.processing) {
        next[field] = `${label} is still being processed.`;
      } else if (draft.mode === 'drive' && draft.driveLink.trim()) {
        if (!isGoogleDriveFileLink(draft.driveLink)) {
          next[field] = 'Enter a Google Drive file link (https://drive.google.com/file/d/...).';
        } else if (draft.linkState === 'error') {
          next[field] = 'This Google Drive file is not publicly viewable. Change its sharing or upload the image.';
        }
      } else if (!hasNewDocument(draft) && !kyc?.documents[field]) {
        next[field] = `${label} is required.`;
      }
    });

    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMsg(null);

    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      setSubmitError('Please correct the highlighted fields.');
      return;
    }

    const documents: KycSubmitPayload['documents'] = {};
    (Object.keys(drafts) as KycImageField[]).forEach((field) => {
      const draft = drafts[field];
      if (draft.mode === 'upload' && draft.uploadDataUrl) documents[field] = { upload: draft.uploadDataUrl };
      if (draft.mode === 'drive' && draft.driveLink.trim()) documents[field] = { driveLink: draft.driveLink.trim() };
    });

    const payload: KycSubmitPayload = {
      accountHolderName: form.accountHolderName.trim(),
      ifscCode: form.ifscCode,
      upiId: form.upiId.trim(),
      panNumber: form.panNumber,
      address: form.address.trim(),
      state: form.state.trim(),
      pincode: form.pincode,
      documents,
      ...(form.bankAccountNumber ? { bankAccountNumber: form.bankAccountNumber } : {}),
      ...(form.aadhaarNumber ? { aadhaarNumber: form.aadhaarNumber } : {}),
    };

    setSubmitting(true);
    try {
      const res = await api.submitMyKyc(payload, token);
      if (res.status && res.data) {
        applyKyc(res.data);
        setErrors({});
        setSuccessMsg(res.message || 'KYC submitted successfully.');
      } else {
        if (res.errors) setErrors(res.errors);
        setSubmitError(res.message || 'Failed to submit KYC. Please try again.');
      }
    } catch {
      setSubmitError('Failed to submit KYC. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="profile-card kyc-card" aria-busy="true">
        <div className="kyc-loading">
          <Loader2 size={20} className="kyc-spin" aria-hidden="true" />
          <span>Loading KYC details…</span>
        </div>
      </section>
    );
  }

  if (loadError || !kyc) {
    return (
      <section className="profile-card kyc-card">
        <div className="kyc-alert is-error">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{loadError || 'Unable to load your KYC details.'}</span>
          <button type="button" className="kyc-link-btn" onClick={loadKyc}>Retry</button>
        </div>
      </section>
    );
  }

  const status = STATUS_META[kyc.status] || STATUS_META.not_submitted;
  const StatusIcon = status.icon;
  const isFirstSubmission = kyc.status === 'not_submitted';

  const renderInput = (
    name: keyof typeof form,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> & { transform?: (v: string) => string; hint?: string }
  ) => {
    const { transform, hint, ...inputProps } = props;
    const errorId = `kyc-${name}-error`;
    return (
      <div className="kyc-field">
        <label htmlFor={`kyc-${name}`}>{label}</label>
        <input
          id={`kyc-${name}`}
          value={form[name]}
          onChange={(e) => setField(name, transform ? transform(e.target.value) : e.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? errorId : undefined}
          className={errors[name] ? 'has-error' : ''}
          {...inputProps}
        />
        {errors[name] ? (
          <span className="kyc-field-error" id={errorId}>{errors[name]}</span>
        ) : (
          hint && <span className="kyc-field-hint">{hint}</span>
        )}
      </div>
    );
  };

  const renderDocument = (field: KycImageField) => {
    const meta = DOCUMENT_FIELDS[field];
    const draft = drafts[field];
    const existing = kyc.documents[field];
    const hasDraft = hasNewDocument(draft);
    const validDriveLink = draft.mode === 'drive' && isGoogleDriveFileLink(draft.driveLink);

    let preview: KycImageSource | null = null;
    if (draft.mode === 'upload' && draft.uploadDataUrl) preview = { kind: 'local', dataUrl: draft.uploadDataUrl };
    else if (validDriveLink) preview = { kind: 'drive', url: draft.driveLink.trim() };
    else if (!hasDraft && existing) {
      preview = existing.source === 'upload' ? { kind: 'upload', fileKey: existing.fileKey } : { kind: 'drive', url: existing.url };
    }

    const inputId = `kyc-file-${field}`;
    return (
      <div className={`kyc-doc ${errors[field] ? 'has-error' : ''}`} key={field}>
        <div className="kyc-doc-head">
          <span className="kyc-doc-label">{meta.label} *</span>
          {hasDraft ? (
            <span className="kyc-doc-badge is-new">New — not yet saved</span>
          ) : existing ? (
            <span className="kyc-doc-badge">{existing.source === 'drive' ? 'Google Drive link' : 'Uploaded'}</span>
          ) : null}
        </div>

        <div className="kyc-doc-preview">
          {draft.processing ? (
            <div className="kyc-image-state">
              <Loader2 size={20} className="kyc-spin" aria-hidden="true" />
              <span>Processing image…</span>
            </div>
          ) : preview ? (
            <KycDocumentImage
              source={preview}
              token={token}
              alt={meta.label}
              onLoadStateChange={preview.kind === 'drive' && validDriveLink ? (s) => updateDraft(field, { linkState: s }) : undefined}
            />
          ) : (
            <div className="kyc-image-state">
              <Upload size={20} aria-hidden="true" />
              <span>No document added yet</span>
            </div>
          )}
        </div>

        <div className="kyc-doc-modes" role="group" aria-label={`${meta.label} source`}>
          <button
            type="button"
            className={draft.mode === 'upload' ? 'is-active' : ''}
            aria-pressed={draft.mode === 'upload'}
            onClick={() => updateDraft(field, { mode: 'upload', driveLink: '', linkState: null })}
          >
            <Upload size={14} aria-hidden="true" /> Upload
          </button>
          <button
            type="button"
            className={draft.mode === 'drive' ? 'is-active' : ''}
            aria-pressed={draft.mode === 'drive'}
            onClick={() => updateDraft(field, { mode: 'drive', uploadDataUrl: '' })}
          >
            <Link2 size={14} aria-hidden="true" /> Drive link
          </button>
        </div>

        {draft.mode === 'upload' ? (
          <div className="kyc-doc-actions">
            <label htmlFor={inputId} className="kyc-upload-btn">
              <Upload size={14} aria-hidden="true" />
              {existing || draft.uploadDataUrl ? 'Replace image' : 'Choose image'}
            </label>
            <input
              id={inputId}
              type="file"
              accept={KYC_ACCEPT_ATTR}
              className="kyc-file-input"
              disabled={draft.processing || submitting}
              onChange={(e) => {
                handleFileChosen(field, e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <span className="kyc-field-hint">JPG, PNG or WebP, up to {KYC_MAX_SOURCE_MB} MB.</span>
          </div>
        ) : (
          <div className="kyc-field">
            <input
              type="url"
              inputMode="url"
              placeholder="https://drive.google.com/file/d/…/view"
              value={draft.driveLink}
              aria-label={`${meta.label} Google Drive link`}
              onChange={(e) => {
                updateDraft(field, { driveLink: e.target.value, linkState: null });
                setDocError(field, '');
              }}
            />
            <span className="kyc-field-hint">
              The file must be shared as “Anyone with the link”, so anyone holding the link can open it. Uploading is more private.
            </span>
          </div>
        )}

        {hasDraft && (
          <button
            type="button"
            className="kyc-link-btn"
            onClick={() => {
              updateDraft(field, emptyDraft());
              setDocError(field, '');
            }}
          >
            <Undo2 size={13} aria-hidden="true" /> {existing ? 'Keep current document' : 'Clear'}
          </button>
        )}

        {errors[field] ? <span className="kyc-field-error">{errors[field]}</span> : <span className="kyc-field-hint">{meta.hint}</span>}
      </div>
    );
  };

  return (
    <section className="profile-card kyc-card" aria-labelledby="kyc-title">
      <div className="kyc-header">
        <div>
          <h3 className="profile-card-title kyc-title" id="kyc-title">Complete Your KYC</h3>
          <p className="kyc-subtitle">{status.text}</p>
        </div>
        <span className={`profile-status-pill ${status.pill} kyc-status`}>
          <StatusIcon size={13} aria-hidden="true" />
          {status.label}
        </span>
      </div>

      {(kyc.submittedAt || kyc.reviewedAt) && (
        <p className="kyc-meta">
          {kyc.submittedAt && <>Submitted {new Date(kyc.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</>}
          {kyc.reviewedAt && <> · Reviewed {new Date(kyc.reviewedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</>}
        </p>
      )}

      {kyc.status === 'rejected' && kyc.rejectionReason && (
        <div className="kyc-alert is-error">
          <XCircle size={18} aria-hidden="true" />
          <span><strong>Reason:</strong> {kyc.rejectionReason}</span>
        </div>
      )}

      {successMsg && (
        <div className="kyc-alert is-success" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <fieldset className="kyc-group" disabled={submitting}>
          <legend><Landmark size={16} aria-hidden="true" /> Bank Details</legend>
          <div className="kyc-grid">
            {renderInput('accountHolderName', 'Account Holder Name *', {
              placeholder: 'As printed on your passbook',
              autoComplete: 'name',
              maxLength: 100,
            })}
            {renderInput('bankAccountNumber', 'Bank Account Number *', {
              placeholder: kyc.hasBankAccountNumber ? `On file: ${kyc.bankAccountNumberMasked}` : '9 to 18 digits',
              inputMode: 'numeric',
              autoComplete: 'off',
              maxLength: 18,
              transform: (v) => v.replace(/\D/g, '').slice(0, 18),
              hint: kyc.hasBankAccountNumber ? 'Leave blank to keep the account number on file.' : undefined,
            })}
            {renderInput('ifscCode', 'IFSC Code *', {
              placeholder: 'e.g. SBIN0001234',
              autoComplete: 'off',
              maxLength: 11,
              transform: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11),
            })}
          </div>
        </fieldset>

        <fieldset className="kyc-group" disabled={submitting}>
          <legend><QrCode size={16} aria-hidden="true" /> Payment Details</legend>
          <div className="kyc-grid">
            {renderInput('upiId', 'UPI ID *', {
              placeholder: 'e.g. name@okbank',
              autoComplete: 'off',
              maxLength: 320,
              transform: (v) => v.replace(/\s/g, ''),
            })}
          </div>
          <div className="kyc-docs-grid">{renderDocument('upiQrImage')}</div>
        </fieldset>

        <fieldset className="kyc-group" disabled={submitting}>
          <legend><MapPin size={16} aria-hidden="true" /> Address Details</legend>
          <div className="kyc-field">
            <label htmlFor="kyc-address">Full Address *</label>
            <textarea
              id="kyc-address"
              rows={3}
              maxLength={300}
              autoComplete="street-address"
              placeholder="House / flat no., street, area, landmark, city"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              aria-invalid={Boolean(errors.address)}
              aria-describedby={errors.address ? 'kyc-address-error' : undefined}
              className={errors.address ? 'has-error' : ''}
            />
            {errors.address && <span className="kyc-field-error" id="kyc-address-error">{errors.address}</span>}
          </div>
          <div className="kyc-grid kyc-grid-spaced">
            {renderInput('state', 'State *', {
              placeholder: 'e.g. Maharashtra',
              autoComplete: 'address-level1',
              maxLength: 60,
            })}
            {renderInput('pincode', 'Pincode *', {
              placeholder: '6-digit pincode',
              inputMode: 'numeric',
              autoComplete: 'postal-code',
              maxLength: 6,
              transform: (v) => v.replace(/\D/g, '').slice(0, 6),
            })}
          </div>
        </fieldset>

        <fieldset className="kyc-group" disabled={submitting}>
          <legend><Fingerprint size={16} aria-hidden="true" /> Identity Verification</legend>
          <div className="kyc-grid">
            {renderInput('aadhaarNumber', 'Aadhaar Card Number *', {
              placeholder: kyc.hasAadhaarNumber ? `On file: ${kyc.aadhaarNumberMasked}` : '12-digit Aadhaar number',
              inputMode: 'numeric',
              autoComplete: 'off',
              maxLength: 12,
              transform: (v) => v.replace(/\D/g, '').slice(0, 12),
              hint: kyc.hasAadhaarNumber ? 'Leave blank to keep the Aadhaar number on file.' : undefined,
            })}
            {renderInput('panNumber', 'PAN Card Number *', {
              placeholder: 'e.g. ABCDE1234F',
              autoComplete: 'off',
              maxLength: 10,
              transform: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10),
            })}
          </div>
          <div className="kyc-docs-grid">
            {renderDocument('aadhaarImage')}
            {renderDocument('panImage')}
            {renderDocument('profilePhoto')}
          </div>
        </fieldset>

        {submitError && (
          <div className="kyc-alert is-error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="kyc-submit-row">
          <span className="kyc-field-hint">
            <ShieldCheck size={13} aria-hidden="true" /> Uploaded documents are stored privately and visible only to you and the verification team.
          </span>
          <button type="submit" className="primary-btn kyc-submit-btn" disabled={submitting}>
            {submitting ? <Loader2 size={16} className="kyc-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
            <span>{submitting ? 'Submitting…' : isFirstSubmission ? 'Submit KYC' : 'Update KYC'}</span>
          </button>
        </div>
      </form>
    </section>
  );
};
