import React, { useState, useEffect } from 'react';
import { Alert, EmptyState, LoadingState, PageHeader } from '../components/ui';
import { Check, Copy, Download, Eye, EyeOff, FileCheck2, Landmark, Mail, Phone, QrCode, RefreshCw, Save, Smartphone, Sparkles, Trash2, Upload } from 'lucide-react';
import { api, getAssetUrl, type CompanyAccountData } from '../services/api';

interface CompanyAccountPageProps {
  user?: any;
  token?: string | null;
}

const NOT_CONFIGURED = <span style={{ color: 'var(--text-light)', fontWeight: 500, fontFamily: 'var(--font-family)', letterSpacing: 'normal', fontSize: 'var(--fs-md)' }}>Not configured</span>;

export const CompanyAccountPage: React.FC<CompanyAccountPageProps> = ({ user, token }) => {
  const isAdmin = user?.role?.toLowerCase() === 'superadmin';
  
  const [account, setAccount] = useState<CompanyAccountData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadingQr, setUploadingQr] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Admin form state
  const [formData, setFormData] = useState({
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    accountType: 'Current Account',
    upiId: '',
    upiHolderName: '',
    depositInstructions: '',
    supportPhone: '',
    supportEmail: '',
    isActive: true,
  });

  // QR preview state
  const [qrPreview, setQrPreview] = useState<string>('');
  const [previewMemberMode, setPreviewMemberMode] = useState<boolean>(false);
  
  // Copy feedback states
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [adminActiveTab, setAdminActiveTab] = useState<'bank' | 'upi' | 'qr' | 'instructions'>('bank');

  const fetchAccount = async () => {
    setLoading(true);
    try {
      const res = await api.getCompanyAccount(token || undefined);
      if (res && res.status && res.data) {
        setAccount(res.data);
        setFormData({
          bankName: res.data.bankName || '',
          accountHolderName: res.data.accountHolderName || 'Panchveda Wellness Pvt Ltd',
          accountNumber: res.data.accountNumber || '',
          ifscCode: res.data.ifscCode || '',
          branchName: res.data.branchName || '',
          accountType: res.data.accountType || 'Current Account',
          upiId: res.data.upiId || '',
          upiHolderName: res.data.upiHolderName || 'Panchveda Wellness Pvt Ltd',
          depositInstructions: res.data.depositInstructions || 'Please mention your Member ID in the payment remarks/notes. After making the payment, note your 12-digit UTR/reference number and submit for instant verification.',
          supportPhone: res.data.supportPhone || '',
          supportEmail: res.data.supportEmail || '',
          isActive: res.data.isActive !== false,
        });
        setQrPreview(res.data.qrCodeUrl ? getAssetUrl(res.data.qrCodeUrl) : '');
      }
    } catch (err: any) {
      console.error('Failed to load company account:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load company account details.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccount();
  }, [token]);

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2500);
  };

  const handleCopyAllBankDetails = () => {
    const text = `Official Company Bank Details:\nBank: ${formData.bankName}\nAccount Name: ${formData.accountHolderName}\nAccount Number: ${formData.accountNumber}\nIFSC Code: ${formData.ifscCode}\nBranch: ${formData.branchName}\nAccount Type: ${formData.accountType}`;
    handleCopy(text, 'allBank');
  };

  // QR code file upload handler
  const handleQrFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Please upload a valid image file (PNG, JPG, WEBP).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'Image file size must be less than 5MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setQrPreview(base64Data);
      
      setUploadingQr(true);
      setStatusMessage(null);
      try {
        const res = await api.uploadCompanyQR(base64Data, token || undefined);
        if (res.status && res.data) {
          setQrPreview(getAssetUrl(res.data.qrCodeUrl));
          if (account) {
            setAccount({
              ...account,
              qrCodeUrl: res.data.qrCodeUrl,
              qrCodeKey: res.data.qrCodeKey,
            });
          }
          setStatusMessage({ type: 'success', text: 'Payment QR Code image uploaded and published successfully!' });
        }
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: err.message || 'Failed to upload QR code.' });
      } finally {
        setUploadingQr(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Remove QR Code
  const handleRemoveQr = async () => {
    const confirmRemove = window.confirm('Are you sure you want to remove the current Payment QR Code?');
    if (!confirmRemove) return;

    setUploadingQr(true);
    setStatusMessage(null);
    try {
      const res = await api.removeCompanyQR(token || undefined);
      if (res.status) {
        setQrPreview('');
        if (account) {
          setAccount({
            ...account,
            qrCodeUrl: '',
            qrCodeKey: '',
          });
        }
        setStatusMessage({ type: 'success', text: 'Payment QR Code removed successfully.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to remove QR code.' });
    } finally {
      setUploadingQr(false);
    }
  };

  // Save Text Details
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await api.updateCompanyAccount(formData, token || undefined);
      if (res.status) {
        setAccount(res.data);
        setStatusMessage({ type: 'success', text: 'Company payment details updated and published successfully!' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update company account details.' });
    } finally {
      setSaving(false);
    }
  };

  // Generate UPI URI & Dynamic Scannable QR Code
  const upiIdToUse = formData.upiId;
  const payeeNameToUse = formData.accountHolderName || formData.upiHolderName || 'Panchveda Wellness';
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiIdToUse)}&pn=${encodeURIComponent(payeeNameToUse)}&cu=INR`;
  const dynamicGeneratedQr = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&margin=12&data=${encodeURIComponent(upiUri)}`;
  const effectiveQrCodeUrl = qrPreview || (upiIdToUse ? dynamicGeneratedQr : '');

  // Download QR Code
  const handleDownloadQr = () => {
    const a = document.createElement('a');
    a.href = effectiveQrCodeUrl;
    a.download = `Panchveda_Payment_QR_${formData.upiId || 'official'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isEffectiveAdmin = isAdmin && !previewMemberMode;

  // Format account number in groups of 4 for readability
  const formattedAccountNumber = (formData.accountNumber || '')
    .replace(/\s?/g, '')
    .replace(/(\d{4})/g, '$1 ')
    .trim();

  return (
    <div className="page-body" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & CONTROLS                                                 */}
      {/* ========================================================================= */}
      <PageHeader
        title={isEffectiveAdmin ? 'Company Account Settings' : 'Company Bank & QR'}
        subtitle={
          isEffectiveAdmin
            ? 'Bank details, UPI ID and payment QR code shown to members for official deposits.'
            : 'Pay for packages and products by UPI QR, UPI ID or bank transfer (NEFT/IMPS).'
        }
        actions={
          <>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setPreviewMemberMode(!previewMemberMode)}
                className={`btn ${previewMemberMode ? 'btn-soft' : 'btn-secondary'}`}
                aria-pressed={previewMemberMode}
              >
                {previewMemberMode ? <EyeOff size={16} /> : <Eye size={16} />}
                <span>{previewMemberMode ? 'Back to editing' : 'Preview member view'}</span>
              </button>
            )}
            <button type="button" onClick={fetchAccount} className="btn btn-secondary" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
              <span>Refresh</span>
            </button>
          </>
        }
      />

      {statusMessage && (
        <Alert tone={statusMessage.type === 'success' ? 'success' : 'error'} onClose={() => setStatusMessage(null)}>
          {statusMessage.text}
        </Alert>
      )}

      {loading ? (
        <LoadingState label="Loading payment details…" />
      ) : isEffectiveAdmin ? (
        /* ========================================================================= */
        /* 2. ADMIN CONFIGURATION MODE                                               */
        /* ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="tabs" role="tablist" aria-label="Company account settings" style={{ marginBottom: 0 }}>
            {[
              { id: 'bank', label: 'Bank details', icon: Landmark },
              { id: 'upi', label: 'UPI ID', icon: Smartphone },
              { id: 'qr', label: 'QR code', icon: QrCode },
              { id: 'instructions', label: 'Instructions & support', icon: FileCheck2 },
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isSelected = adminActiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setAdminActiveTab(tab.id as any)}
                  className={`tab-btn${isSelected ? ' is-active' : ''}`}
                >
                  <TabIcon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSaveDetails}>
            <div className="company-admin-studio-grid">
              
              {/* Active Tab Configuration Card */}
              <div className="dashboard-card">
                
                {/* TAB 1: BANK DETAILS */}
                {adminActiveTab === 'bank' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-lg)', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Landmark size={22} />
                      </div>
                      <div>
                        <h3 className="section-title" style={{ margin: 0 }}>Official Bank Account</h3>
                        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Configure company bank for NEFT, RTGS, and IMPS payments.</p>
                      </div>
                    </div>

                    <div className="company-admin-form-row">
                      <div style={{ gridColumn: 'span 2' }}>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Account Holder / Beneficiary Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Panchveda Wellness Pvt Ltd"
                          value={formData.accountHolderName}
                          onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                          style={{ width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-strong)', fontSize: 'var(--fs-md)', outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Bank Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. State Bank of India"
                          value={formData.bankName}
                          onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                          style={{ width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-strong)', fontSize: 'var(--fs-md)', outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Account Type *
                        </label>
                        <select
                          value={formData.accountType}
                          onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                          style={{ width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-strong)', fontSize: 'var(--fs-md)', background: 'var(--surface)', outline: 'none' }}
                        >
                          <option value="Current Account">Current Account (Corporate)</option>
                          <option value="Savings Account">Savings Account</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Account Number *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 9876543210123"
                          value={formData.accountNumber}
                          onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                          style={{ width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-strong)', fontSize: 'var(--fs-md)', fontFamily: 'monospace', fontWeight: 700, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          IFSC Code *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. SBIN0001234"
                          value={formData.ifscCode}
                          onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                          style={{ width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-strong)', fontSize: 'var(--fs-md)', fontFamily: 'monospace', fontWeight: 700, outline: 'none' }}
                        />
                      </div>

                      <div style={{ gridColumn: 'span 2' }}>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Branch Address / Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Connaught Place Branch, New Delhi - 110001"
                          value={formData.branchName}
                          onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                          style={{ width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-strong)', fontSize: 'var(--fs-md)', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: UPI SETTINGS */}
                {adminActiveTab === 'upi' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-lg)', background: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Smartphone size={22} />
                      </div>
                      <div>
                        <h3 className="section-title" style={{ margin: 0 }}>Direct UPI ID (VPA)</h3>
                        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Enables 1-click UPI payments across PhonePe, Google Pay, and Paytm.</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Company Virtual Payment Address (UPI ID) *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. panchveda@sbi or company@okhdfcbank"
                          value={formData.upiId}
                          onChange={(e) => setFormData({ ...formData, upiId: e.target.value.toLowerCase().trim() })}
                          style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-strong)', fontSize: 'var(--fs-lg)', fontFamily: 'monospace', fontWeight: 700, outline: 'none' }}
                        />
                        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                          Must be a valid active UPI handle registered with your business bank account.
                        </span>
                      </div>

                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Registered Payee Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Panchveda Wellness Pvt Ltd"
                          value={formData.upiHolderName}
                          onChange={(e) => setFormData({ ...formData, upiHolderName: e.target.value })}
                          style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-strong)', fontSize: 'var(--fs-md)', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: QR CODE UPLOAD */}
                {adminActiveTab === 'qr' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-lg)', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <QrCode size={22} />
                      </div>
                      <div>
                        <h3 className="section-title" style={{ margin: 0 }}>Payment QR Code Image</h3>
                        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Upload your official merchant soundbox / payment standee QR image.</p>
                      </div>
                    </div>

                    <div style={{
                      border: '2px dashed var(--text-light)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '30px',
                      textAlign: 'center',
                      background: 'var(--surface-subtle)',
                      transition: 'all 0.2s ease'
                    }}>
                      {qrPreview ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                          <div style={{
                            background: 'var(--surface)',
                            padding: '16px',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
                            border: '1.5px solid var(--border-color)',
                            display: 'inline-block'
                          }}>
                            <img 
                              src={qrPreview} 
                              alt="Uploaded Payment QR" 
                              style={{ width: '200px', height: '200px', objectFit: 'contain', display: 'block' }} 
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '10px' }}>
                            <label style={{
                              background: 'var(--primary)',
                              color: 'var(--text-inverse)',
                              padding: '8px 16px',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 'var(--fs-base)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <Upload size={14} />
                              <span>Replace Image</span>
                              <input type="file" accept="image/*" onChange={handleQrFileSelect} style={{ display: 'none' }} />
                            </label>

                            <button
                              type="button"
                              onClick={handleRemoveQr}
                              disabled={uploadingQr} className="btn btn-danger-outline">
                              <Trash2 size={14} />
                              <span>Remove QR</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                            <QrCode size={28} />
                          </div>
                          <h4 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-strong)', marginBottom: '4px' }}>
                            Upload Merchant QR Code
                          </h4>
                          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', maxWidth: '360px', margin: '0 auto 16px auto' }}>
                            Upload a high-resolution screenshot or PDF export of your PhonePe / GooglePay / Paytm QR standee (PNG, JPG, WEBP).
                          </p>
                          <label style={{
                            background: 'var(--primary)',
                            color: 'var(--text-inverse)',
                            padding: '10px 22px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--fs-base)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: 'none'
                          }}>
                            <Upload size={15} />
                            <span>Select File</span>
                            <input type="file" accept="image/*" onChange={handleQrFileSelect} style={{ display: 'none' }} />
                          </label>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-light)', marginTop: '10px' }}>
                            * If left empty, a live dynamic QR code for your UPI ID will be automatically generated for members!
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: INSTRUCTIONS & SUPPORT */}
                {adminActiveTab === 'instructions' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-lg)', background: 'var(--warning-soft)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileCheck2 size={22} />
                      </div>
                      <div>
                        <h3 className="section-title" style={{ margin: 0 }}>Payment Guidelines & Helpdesk</h3>
                        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Step-by-step guidance shown to members upon making deposits.</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Deposit Guidelines for Members
                        </label>
                        <textarea
                          rows={4}
                          placeholder="e.g. Please enter your Member ID in remarks. Take a screenshot of the transaction receipt and submit for instant verification."
                          value={formData.depositInstructions}
                          onChange={(e) => setFormData({ ...formData, depositInstructions: e.target.value })}
                          style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-strong)', fontSize: 'var(--fs-md)', outline: 'none', resize: 'vertical', lineHeight: 1.5 }}
                        />
                      </div>

                      <div className="company-admin-form-row">
                        <div>
                          <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                            Payment Support Phone
                          </label>
                          <input
                            type="text"
                            placeholder="+91 98765 43210"
                            value={formData.supportPhone}
                            onChange={(e) => setFormData({ ...formData, supportPhone: e.target.value })}
                            style={{ width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-strong)', fontSize: 'var(--fs-md)', outline: 'none' }}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                            Payment Support Email
                          </label>
                          <input
                            type="email"
                            placeholder="payments@panchvedawellness.com"
                            value={formData.supportEmail}
                            onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                            style={{ width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-strong)', fontSize: 'var(--fs-md)', outline: 'none' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Action Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '28px', paddingTop: '18px', borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    Changes reflect immediately for all members upon saving.
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '11px 26px',
                      fontSize: 'var(--fs-md)',
                      fontWeight: 800,
                      background: 'var(--primary)',
                      boxShadow: 'none',
                      borderRadius: 'var(--radius-md)',
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Save size={16} />
                    <span>{saving ? 'Publishing...' : 'Save & Publish Account Details'}</span>
                  </button>
                </div>
              </div>

              {/* Sidebar Summary & Live Output Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="dashboard-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Sparkles size={18} style={{ color: 'var(--primary)' }} />
                    <h4 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      Live Status Summary
                    </h4>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: 'var(--fs-base)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface-muted)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Bank Configured:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{formData.bankName || 'Not Set'}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface-muted)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>UPI Active:</span>
                      <strong style={{ color: 'var(--success)', fontFamily: 'monospace' }}>{formData.upiId || 'Not Set'}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface-muted)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Custom QR Status:</span>
                      <strong style={{ color: qrPreview ? 'var(--success)' : 'var(--warning)' }}>
                        {qrPreview ? 'Custom Image Active' : 'Auto Dynamic QR Active'}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPreviewMemberMode(true)} className="btn btn-soft" style={{ width: '100%', marginTop: '18px' }}>
                    <Eye size={15} />
                    <span>View As Member</span>
                  </button>
                </div>
              </div>

            </div>
          </form>
        </div>
      ) : (
        /* ========================================================================= */
        /* 3. MEMBER VIEW-ONLY MODE (World-Class Fintech Presentation)               */
        /* ========================================================================= */
        <div>
          
          {/* Official Security Guarantee Badge */}
          <Alert tone="info" title={`Beneficiary: ${formData.accountHolderName || 'Panchveda Wellness Pvt Ltd'}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <span style={{ flex: '1 1 320px' }}>
                Check the beneficiary name before sending money, and mention your Member ID{' '}
                <strong className="text-mono">{user?.memberId || 'MEM0001'}</strong> in the payment remarks.
              </span>
              <button type="button" onClick={handleCopyAllBankDetails} className="btn btn-sm btn-secondary">
                {copiedField === 'allBank' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedField === 'allBank' ? 'Copied' : 'Copy all details'}</span>
              </button>
            </div>
          </Alert>

          {/* Core Grid: QR Code (Left) + Bank Details (Right) */}
          <div className="company-account-grid">
            
            {/* =================================================================== */}
            {/* COLUMN 1: QR CODE & UPI EXPRESS PAY CARD                           */}
            {/* =================================================================== */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Option 1: Payment QR Code Card */}
              <div className="dashboard-card" style={{ textAlign: 'center' }}>
                <h3 className="card-title">Scan & pay with UPI</h3>
                <p className="card-subtitle" style={{ marginBottom: 'var(--space-5)' }}>
                  Works with Google Pay, PhonePe, Paytm, BHIM or any UPI bank app.
                </p>

                {effectiveQrCodeUrl ? (
                  <>
                    <div className="qr-frame">
                      <img src={effectiveQrCodeUrl} alt="Company payment QR code" />
                    </div>
                    <div>
                      <button type="button" onClick={handleDownloadQr} className="btn btn-secondary btn-sm">
                        <Download size={15} />
                        <span>Download QR code</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    compact
                    icon={<QrCode size={22} />}
                    title="QR code not configured"
                    text={isEffectiveAdmin ? 'Add a UPI ID or upload a QR image in the editor.' : 'Use the bank details instead, or contact support.'}
                  />
                )}
              </div>

              {/* Option 2: UPI ID Card with 1-Click Copy */}
              <div className="dashboard-card" style={{ border: '1.5px solid var(--success-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--success-soft)', color: 'var(--success-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, margin: 0, color: 'var(--success-strong)' }}>Direct UPI ID (VPA)</h4>
                      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--success)', margin: '2px 0 0 0' }}>For manual UPI transfers in any banking app.</p>
                    </div>
                  </div>

                  <span style={{
                    background: 'var(--success-soft)',
                    color: 'var(--success-hover)',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-xl)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 700
                  }}>
                    Instant Transfer
                  </span>
                </div>

                <div style={{
                  background: 'var(--surface)',
                  border: '1.5px solid var(--success-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                }}>
                  <div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>
                      Virtual Payment Address (VPA)
                    </div>
                    <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'monospace', marginTop: '3px' }}>
                      {formData.upiId || NOT_CONFIGURED}
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--success)', fontWeight: 700, marginTop: '2px' }}>
                      Payee: {formData.upiHolderName || formData.accountHolderName || 'Panchveda Wellness'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(formData.upiId, 'upiId')}
                    style={{
                      background: copiedField === 'upiId' ? 'var(--success-hover)' : 'var(--primary)',
                      color: 'var(--text-inverse)',
                      border: 'none',
                      padding: '10px 18px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--fs-base)',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: copiedField === 'upiId' ? '0 4px 12px rgba(21, 128, 61, 0.3)' : '0 4px 12px rgba(37, 99, 235, 0.25)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {copiedField === 'upiId' ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copiedField === 'upiId' ? 'Copied!' : 'Copy UPI'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* =================================================================== */}
            {/* COLUMN 2: PREMIUM BANK DETAILS CARD & 3-STEP GUIDE                  */}
            {/* =================================================================== */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Option 3: Premium Bank Account Details Card */}
              <div className="dashboard-card" style={{ border: '1.5px solid var(--border-color)' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-lg)', background: 'var(--primary-light)', color: 'var(--primary-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Landmark size={24} />
                    </div>
                    <div>
                      <h3 className="section-title" style={{ margin: 0 }}>
                        Bank Account (NEFT / IMPS / RTGS)
                      </h3>
                      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                        For internet banking and bank counter deposits.
                      </p>
                    </div>
                  </div>

                  <span style={{
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    border: '1px solid var(--primary-border)',
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 800
                  }}>
                    {formData.accountType || 'Current Account'}
                  </span>
                </div>

                {/* Details Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Account Number Card (Highlight) */}
                  <div style={{
                    padding: '16px 18px',
                    background: 'var(--surface-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1.5px solid var(--primary-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
                        Account Number
                      </div>
                      <div style={{ fontSize: 'clamp(16px, 4.5vw, 20px)', fontWeight: 900, color: 'var(--primary-strong)', fontFamily: 'monospace', letterSpacing: '1px', marginTop: '3px', wordBreak: 'break-all' }}>
                        {formattedAccountNumber || NOT_CONFIGURED}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(formData.accountNumber, 'accountNumber')}
                      style={{
                        background: copiedField === 'accountNumber' ? 'var(--success-light)' : 'var(--surface)',
                        color: copiedField === 'accountNumber' ? 'var(--success)' : 'var(--primary)',
                        border: copiedField === 'accountNumber' ? '1.5px solid var(--success-border)' : '1px solid var(--border-strong)',
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {copiedField === 'accountNumber' ? <Check size={15} /> : <Copy size={15} />}
                      <span>{copiedField === 'accountNumber' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  {/* IFSC Code Card (Highlight) */}
                  <div style={{
                    padding: '16px 18px',
                    background: 'var(--surface-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1.5px solid var(--primary-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
                        IFSC Code (Zero 0 in the 5th character)
                      </div>
                      <div style={{ fontSize: 'clamp(15px, 4vw, 19px)', fontWeight: 900, color: 'var(--primary-strong)', fontFamily: 'monospace', letterSpacing: '1px', marginTop: '3px' }}>
                        {formData.ifscCode || NOT_CONFIGURED}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(formData.ifscCode, 'ifscCode')}
                      style={{
                        background: copiedField === 'ifscCode' ? 'var(--success-light)' : 'var(--surface)',
                        color: copiedField === 'ifscCode' ? 'var(--success)' : 'var(--primary)',
                        border: copiedField === 'ifscCode' ? '1.5px solid var(--success-border)' : '1px solid var(--border-strong)',
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {copiedField === 'ifscCode' ? <Check size={15} /> : <Copy size={15} />}
                      <span>{copiedField === 'ifscCode' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  {/* Beneficiary Name */}
                  <div style={{
                    padding: '14px 16px',
                    background: 'var(--surface-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Beneficiary / Account Holder Name
                      </div>
                      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                        {formData.accountHolderName || 'Panchveda Wellness Pvt Ltd'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.accountHolderName || 'Panchveda Wellness Pvt Ltd', 'accName')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                      title="Copy Name"
                    >
                      {copiedField === 'accName' ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
                    </button>
                  </div>

                  {/* Bank & Branch Row */}
                  <div className="company-bank-branch-grid">
                    <div style={{ padding: '14px 16px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Bank Name
                      </div>
                      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                        {formData.bankName || NOT_CONFIGURED}
                      </div>
                    </div>

                    <div style={{ padding: '14px 16px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Branch Name
                      </div>
                      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                        {formData.branchName || NOT_CONFIGURED}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3-step payment guide */}
              <div className="dashboard-card">
                <div className="card-title-group" style={{ marginBottom: 'var(--space-4)' }}>
                  <span className="icon-tile tone-blue" style={{ width: 32, height: 32 }}>
                    <FileCheck2 size={18} />
                  </span>
                  <h4 className="card-title">How to pay</h4>
                </div>

                <ol className="steps-list">
                  <li>
                    <strong>Pay the amount</strong>
                    <span>Scan the QR, use the UPI ID, or send via net banking.</span>
                  </li>
                  <li>
                    <strong>Note the UTR number</strong>
                    <span>Save the 12-digit transaction reference.</span>
                  </li>
                  <li>
                    <strong>Submit for verification</strong>
                    <span>Enter the UTR on your order so it can be approved.</span>
                  </li>
                </ol>

                {formData.depositInstructions && (
                  <Alert tone="info" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
                    {formData.depositInstructions}
                  </Alert>
                )}

                {(formData.supportPhone || formData.supportEmail) && (
                  <div className="steps-support">
                    {formData.supportPhone && (
                      <span className="icon-text"><Phone size={14} /> Helpline <strong>{formData.supportPhone}</strong></span>
                    )}
                    {formData.supportEmail && (
                      <span className="icon-text"><Mail size={14} /> Support <strong>{formData.supportEmail}</strong></span>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyAccountPage;
