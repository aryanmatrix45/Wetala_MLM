import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Check, 
  Copy, 
  Upload, 
  Download, 
  Save, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff,
  Trash2, 
  Smartphone, 
  Landmark, 
  Phone, 
  Mail,
  Zap,
  Sparkles,
  FileCheck2
} from 'lucide-react';
import { api, getAssetUrl, type CompanyAccountData } from '../services/api';

interface CompanyAccountPageProps {
  user?: any;
  token?: string | null;
}

export const CompanyAccountPage: React.FC<CompanyAccountPageProps> = ({ user, token }) => {
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin';
  
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
          bankName: res.data.bankName || 'State Bank of India',
          accountHolderName: res.data.accountHolderName || 'Panchveda Wellness Pvt Ltd',
          accountNumber: res.data.accountNumber || '9876543210123',
          ifscCode: res.data.ifscCode || 'SBIN0001234',
          branchName: res.data.branchName || 'Connaught Place Branch, New Delhi',
          accountType: res.data.accountType || 'Current Account',
          upiId: res.data.upiId || 'panchveda@sbi',
          upiHolderName: res.data.upiHolderName || 'Panchveda Wellness Pvt Ltd',
          depositInstructions: res.data.depositInstructions || 'Please mention your Member ID in the payment remarks/notes. After making the payment, note your 12-digit UTR/reference number and submit for instant verification.',
          supportPhone: res.data.supportPhone || '+91 98765 43210',
          supportEmail: res.data.supportEmail || 'payments@panchvedawellness.com',
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
  const upiIdToUse = formData.upiId || 'panchveda@sbi';
  const payeeNameToUse = formData.accountHolderName || formData.upiHolderName || 'Panchveda Wellness';
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiIdToUse)}&pn=${encodeURIComponent(payeeNameToUse)}&cu=INR`;
  const dynamicGeneratedQr = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&margin=12&data=${encodeURIComponent(upiUri)}`;
  const effectiveQrCodeUrl = qrPreview || dynamicGeneratedQr;

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
  const formattedAccountNumber = (formData.accountNumber || '9876543210123')
    .replace(/\s?/g, '')
    .replace(/(\d{4})/g, '$1 ')
    .trim();

  return (
    <div className="page-body" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & CONTROLS                                                 */}
      {/* ========================================================================= */}
      <div className="welcome-header" style={{ marginBottom: '22px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {isEffectiveAdmin ? 'Company Payment & Account Settings' : 'Official Payment & Bank Accounts'}
            </h1>
            <span style={{
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 1px 2px rgba(16, 185, 129, 0.1)'
            }}>
              <ShieldCheck size={14} style={{ color: '#059669' }} /> Verified Company Account
            </span>
          </div>
          <p className="page-subtitle" style={{ fontSize: '13.5px', color: '#64748b', marginTop: '4px' }}>
            {isEffectiveAdmin 
              ? 'Configure company bank details, UPI ID, and payment QR code shared with members for official deposits.' 
              : 'Scan the official payment QR code, transfer via UPI ID, or use NEFT/IMPS for package purchases and deposit verification.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isAdmin && (
            <button
              onClick={() => setPreviewMemberMode(!previewMemberMode)}
              className="secondary-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '9px 16px',
                borderRadius: '10px',
                background: previewMemberMode ? '#eff6ff' : '#ffffff',
                border: previewMemberMode ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                color: previewMemberMode ? '#1d4ed8' : '#334155',
                fontWeight: 700,
                fontSize: '13px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {previewMemberMode ? <EyeOff size={15} /> : <Eye size={15} />}
              <span>{previewMemberMode ? 'Back to Admin Edit' : 'Preview Member View'}</span>
            </button>
          )}

          <button 
            onClick={fetchAccount} 
            className="secondary-btn" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '9px 16px', 
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin-anim' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '12px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: statusMessage.type === 'success' ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
          border: `1.5px solid ${statusMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
          color: statusMessage.type === 'success' ? '#14532d' : '#991b1b',
          fontSize: '13.5px',
          fontWeight: 700,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)'
        }}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20} style={{ color: '#16a34a' }} /> : <AlertCircle size={20} style={{ color: '#dc2626' }} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '90px 20px', textAlign: 'center', color: '#64748b' }}>
          <div style={{ width: '42px', height: '42px', border: '3.5px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>Loading verified payment details...</p>
        </div>
      ) : isEffectiveAdmin ? (
        /* ========================================================================= */
        /* 2. ADMIN CONFIGURATION MODE (Sleek Segmented Studio)                     */
        /* ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Segmented Tab Navigation for Admin */}
          <div style={{
            display: 'flex',
            gap: '8px',
            background: '#ffffff',
            padding: '6px',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            flexWrap: 'wrap'
          }}>
            {[
              { id: 'bank', label: '1. Bank Details', icon: Landmark },
              { id: 'upi', label: '2. UPI ID Settings', icon: Smartphone },
              { id: 'qr', label: '3. QR Code Upload', icon: QrCode },
              { id: 'instructions', label: '4. Instructions & Support', icon: FileCheck2 },
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isSelected = adminActiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAdminActiveTab(tab.id as any)}
                  style={{
                    flex: '1 1 auto',
                    minWidth: '150px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: isSelected ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'transparent',
                    color: isSelected ? '#ffffff' : '#64748b',
                    boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
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
              <div className="dashboard-card" style={{ padding: '28px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' }}>
                
                {/* TAB 1: BANK DETAILS */}
                {adminActiveTab === 'bank' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Landmark size={22} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Official Bank Account</h3>
                        <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>Configure company bank for NEFT, RTGS, and IMPS payments.</p>
                      </div>
                    </div>

                    <div className="company-admin-form-row">
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Account Holder / Beneficiary Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Panchveda Wellness Pvt Ltd"
                          value={formData.accountHolderName}
                          onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                          style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Bank Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. State Bank of India"
                          value={formData.bankName}
                          onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                          style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Account Type *
                        </label>
                        <select
                          value={formData.accountType}
                          onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                          style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', background: '#fff', outline: 'none' }}
                        >
                          <option value="Current Account">Current Account (Corporate)</option>
                          <option value="Savings Account">Savings Account</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Account Number *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 9876543210123"
                          value={formData.accountNumber}
                          onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                          style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14.5px', fontFamily: 'monospace', fontWeight: 700, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          IFSC Code *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. SBIN0001234"
                          value={formData.ifscCode}
                          onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                          style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14.5px', fontFamily: 'monospace', fontWeight: 700, outline: 'none' }}
                        />
                      </div>

                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Branch Address / Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Connaught Place Branch, New Delhi - 110001"
                          value={formData.branchName}
                          onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                          style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: UPI SETTINGS */}
                {adminActiveTab === 'upi' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Smartphone size={22} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Direct UPI ID (VPA)</h3>
                        <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>Enables 1-click UPI payments across PhonePe, Google Pay, and Paytm.</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Company Virtual Payment Address (UPI ID) *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. panchveda@sbi or company@okhdfcbank"
                          value={formData.upiId}
                          onChange={(e) => setFormData({ ...formData, upiId: e.target.value.toLowerCase().trim() })}
                          style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '15px', fontFamily: 'monospace', fontWeight: 700, outline: 'none' }}
                        />
                        <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                          Must be a valid active UPI handle registered with your business bank account.
                        </span>
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Registered Payee Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Panchveda Wellness Pvt Ltd"
                          value={formData.upiHolderName}
                          onChange={(e) => setFormData({ ...formData, upiHolderName: e.target.value })}
                          style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: QR CODE UPLOAD */}
                {adminActiveTab === 'qr' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <QrCode size={22} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Payment QR Code Image</h3>
                        <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>Upload your official merchant soundbox / payment standee QR image.</p>
                      </div>
                    </div>

                    <div style={{
                      border: '2px dashed #94a3b8',
                      borderRadius: '16px',
                      padding: '30px',
                      textAlign: 'center',
                      background: '#f8fafc',
                      transition: 'all 0.2s ease'
                    }}>
                      {qrPreview ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                          <div style={{
                            background: '#ffffff',
                            padding: '16px',
                            borderRadius: '16px',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
                            border: '1.5px solid #e2e8f0',
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
                              background: '#2563eb',
                              color: '#ffffff',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              fontSize: '13px',
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
                              disabled={uploadingQr}
                              style={{
                                background: '#fee2e2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <Trash2 size={14} />
                              <span>Remove QR</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                            <QrCode size={28} />
                          </div>
                          <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
                            Upload Merchant QR Code
                          </h4>
                          <p style={{ fontSize: '12.5px', color: '#64748b', maxWidth: '360px', margin: '0 auto 16px auto' }}>
                            Upload a high-resolution screenshot or PDF export of your PhonePe / GooglePay / Paytm QR standee (PNG, JPG, WEBP).
                          </p>
                          <label style={{
                            background: '#2563eb',
                            color: '#ffffff',
                            padding: '10px 22px',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                          }}>
                            <Upload size={15} />
                            <span>Select File</span>
                            <input type="file" accept="image/*" onChange={handleQrFileSelect} style={{ display: 'none' }} />
                          </label>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px' }}>
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
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileCheck2 size={22} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Payment Guidelines & Helpdesk</h3>
                        <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>Step-by-step guidance shown to members upon making deposits.</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Deposit Guidelines for Members
                        </label>
                        <textarea
                          rows={4}
                          placeholder="e.g. Please enter your Member ID in remarks. Take a screenshot of the transaction receipt and submit for instant verification."
                          value={formData.depositInstructions}
                          onChange={(e) => setFormData({ ...formData, depositInstructions: e.target.value })}
                          style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', outline: 'none', resize: 'vertical', lineHeight: 1.5 }}
                        />
                      </div>

                      <div className="company-admin-form-row">
                        <div>
                          <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                            Payment Support Phone
                          </label>
                          <input
                            type="text"
                            placeholder="+91 98765 43210"
                            value={formData.supportPhone}
                            onChange={(e) => setFormData({ ...formData, supportPhone: e.target.value })}
                            style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', outline: 'none' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                            Payment Support Email
                          </label>
                          <input
                            type="email"
                            placeholder="payments@panchvedawellness.com"
                            value={formData.supportEmail}
                            onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                            style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', outline: 'none' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Action Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '28px', paddingTop: '18px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Changes reflect immediately for all members upon saving.
                  </div>
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={saving}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '11px 26px',
                      fontSize: '14px',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                      borderRadius: '10px',
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
                <div className="dashboard-card" style={{ padding: '24px', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Sparkles size={18} style={{ color: '#2563eb' }} />
                    <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Live Status Summary
                    </h4>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f1f5f9', borderRadius: '8px' }}>
                      <span style={{ color: '#64748b' }}>Bank Configured:</span>
                      <strong style={{ color: '#0f172a' }}>{formData.bankName || 'Not Set'}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f1f5f9', borderRadius: '8px' }}>
                      <span style={{ color: '#64748b' }}>UPI Active:</span>
                      <strong style={{ color: '#059669', fontFamily: 'monospace' }}>{formData.upiId || 'Not Set'}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f1f5f9', borderRadius: '8px' }}>
                      <span style={{ color: '#64748b' }}>Custom QR Status:</span>
                      <strong style={{ color: qrPreview ? '#059669' : '#d97706' }}>
                        {qrPreview ? 'Custom Image Active' : 'Auto Dynamic QR Active'}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPreviewMemberMode(true)}
                    style={{
                      width: '100%',
                      marginTop: '18px',
                      padding: '10px',
                      background: '#eff6ff',
                      color: '#2563eb',
                      border: '1.5px solid #bfdbfe',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
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
          <div className="company-security-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
              }}>
                <ShieldCheck size={26} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Verified Corporate Account: {formData.accountHolderName || 'Panchveda Wellness Pvt Ltd'}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '3px' }}>
                  Always verify payment beneficiary name before sending funds. Mention your Member ID (<strong style={{ color: '#60a5fa' }}>{user?.memberId || 'MEM0001'}</strong>) in transaction remarks.
                </div>
              </div>
            </div>

            <button
              onClick={handleCopyAllBankDetails}
              style={{
                background: copiedField === 'allBank' ? '#059669' : 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '10px 18px',
                borderRadius: '10px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0,
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(5px)'
              }}
            >
              {copiedField === 'allBank' ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedField === 'allBank' ? 'Copied All Details!' : 'Copy All Details'}</span>
            </button>
          </div>

          {/* Core Grid: QR Code (Left) + Bank Details (Right) */}
          <div className="company-account-grid">
            
            {/* =================================================================== */}
            {/* COLUMN 1: QR CODE & UPI EXPRESS PAY CARD                           */}
            {/* =================================================================== */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Option 1: Payment QR Code Card */}
              <div className="dashboard-card" style={{
                padding: '28px 24px',
                textAlign: 'center',
                background: '#ffffff',
                borderRadius: '20px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.06)',
                border: '1px solid #e2e8f0',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  color: '#1d4ed8',
                  padding: '5px 14px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 800,
                  marginBottom: '14px',
                  border: '1px solid #bfdbfe'
                }}>
                  <Zap size={13} style={{ fill: '#2563eb' }} /> Scan & Pay Instantly
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  UPI Bharat QR Code
                </h3>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 20px 0' }}>
                  Scan with GPay, PhonePe, Paytm, BHIM, or any UPI Bank App.
                </p>

                {/* QR Code Container with Scan Frame */}
                <div style={{
                  display: 'inline-block',
                  background: '#ffffff',
                  padding: '16px',
                  borderRadius: '20px',
                  boxShadow: '0 12px 35px -8px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.04)',
                  border: '2px solid #e2e8f0',
                  position: 'relative',
                  marginBottom: '16px',
                  maxWidth: '100%'
                }}>
                  <img 
                    src={effectiveQrCodeUrl} 
                    alt="Company Payment QR Code" 
                    style={{ 
                      width: '220px', 
                      height: '220px', 
                      maxWidth: '100%',
                      objectFit: 'contain', 
                      display: 'block',
                      borderRadius: '8px'
                    }} 
                  />

                  {/* QR Center Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: '#ffffff',
                    padding: '4px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    border: '1px solid #cbd5e1'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '11px',
                      letterSpacing: '0.5px'
                    }}>
                      PV
                    </div>
                  </div>
                </div>

                {/* Download Button */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="primary-btn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '9px 20px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      border: 'none',
                      borderRadius: '10px',
                      boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={15} />
                    <span>Download QR Code Image</span>
                  </button>
                </div>

                {/* Indian UPI Supported Logos strip */}
                <div style={{
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Accepted On:
                  </span>
                  {['Google Pay', 'PhonePe', 'Paytm', 'BHIM UPI', 'Cred'].map((app) => (
                    <span 
                      key={app} 
                      style={{ 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        color: '#475569', 
                        background: '#f8fafc', 
                        border: '1px solid #e2e8f0', 
                        padding: '3px 8px', 
                        borderRadius: '6px' 
                      }}
                    >
                      {app}
                    </span>
                  ))}
                </div>
              </div>

              {/* Option 2: UPI ID Card with 1-Click Copy */}
              <div className="dashboard-card" style={{
                padding: '24px',
                background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
                borderRadius: '18px',
                border: '1.5px solid #bbf7d0',
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#14532d' }}>Direct UPI ID (VPA)</h4>
                      <p style={{ fontSize: '12px', color: '#16a34a', margin: '2px 0 0 0' }}>For manual UPI transfers in any banking app.</p>
                    </div>
                  </div>

                  <span style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '11.5px',
                    fontWeight: 700
                  }}>
                    Instant Transfer
                  </span>
                </div>

                <div style={{
                  background: '#ffffff',
                  border: '1.5px solid #86efac',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>
                      Virtual Payment Address (VPA)
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace', marginTop: '3px' }}>
                      {formData.upiId || 'panchveda@sbi'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
                      Payee: {formData.upiHolderName || formData.accountHolderName || 'Panchveda Wellness'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(formData.upiId || 'panchveda@sbi', 'upiId')}
                    style={{
                      background: copiedField === 'upiId' ? '#15803d' : '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 18px',
                      borderRadius: '10px',
                      fontSize: '13px',
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
              <div className="dashboard-card" style={{
                padding: '28px',
                background: '#ffffff',
                borderRadius: '20px',
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.06)'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Landmark size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                        Bank Account (NEFT / IMPS / RTGS)
                      </h3>
                      <p style={{ fontSize: '12.5px', color: '#64748b', margin: '2px 0 0 0' }}>
                        For internet banking and bank counter deposits.
                      </p>
                    </div>
                  </div>

                  <span style={{
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
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
                    background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
                    borderRadius: '14px',
                    border: '1.5px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
                        Account Number
                      </div>
                      <div style={{ fontSize: 'clamp(16px, 4.5vw, 20px)', fontWeight: 900, color: '#1e3a8a', fontFamily: 'monospace', letterSpacing: '1px', marginTop: '3px', wordBreak: 'break-all' }}>
                        {formattedAccountNumber}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(formData.accountNumber || '9876543210123', 'accountNumber')}
                      style={{
                        background: copiedField === 'accountNumber' ? '#ecfdf5' : '#ffffff',
                        color: copiedField === 'accountNumber' ? '#059669' : '#2563eb',
                        border: copiedField === 'accountNumber' ? '1.5px solid #a7f3d0' : '1px solid #cbd5e1',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
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
                    background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
                    borderRadius: '14px',
                    border: '1.5px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
                        IFSC Code (Zero 0 in the 5th character)
                      </div>
                      <div style={{ fontSize: 'clamp(15px, 4vw, 19px)', fontWeight: 900, color: '#1e3a8a', fontFamily: 'monospace', letterSpacing: '1px', marginTop: '3px' }}>
                        {formData.ifscCode || 'SBIN0001234'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(formData.ifscCode || 'SBIN0001234', 'ifscCode')}
                      style={{
                        background: copiedField === 'ifscCode' ? '#ecfdf5' : '#ffffff',
                        color: copiedField === 'ifscCode' ? '#059669' : '#2563eb',
                        border: copiedField === 'ifscCode' ? '1.5px solid #a7f3d0' : '1px solid #cbd5e1',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
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
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                        Beneficiary / Account Holder Name
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        {formData.accountHolderName || 'Panchveda Wellness Pvt Ltd'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.accountHolderName || 'Panchveda Wellness Pvt Ltd', 'accName')}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
                      title="Copy Name"
                    >
                      {copiedField === 'accName' ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                    </button>
                  </div>

                  {/* Bank & Branch Row */}
                  <div className="company-bank-branch-grid">
                    <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                        Bank Name
                      </div>
                      <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        {formData.bankName || 'State Bank of India'}
                      </div>
                    </div>

                    <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                        Branch Name
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                        {formData.branchName || 'Connaught Place Branch'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3-Step Visual Payment Stepper */}
              <div className="dashboard-card" style={{
                padding: '26px 28px',
                background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
                borderRadius: '20px',
                border: '1.5px solid #fef08a',
                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileCheck2 size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#854d0e', margin: 0 }}>
                      Step-by-Step Payment & Activation Guide
                    </h4>
                    <p style={{ fontSize: '12px', color: '#a16207', margin: '2px 0 0 0' }}>Follow these 3 simple steps to ensure instant activation.</p>
                  </div>
                </div>

                <div className="company-payment-steps-grid">
                  
                  {/* Step 1 */}
                  <div style={{ background: '#ffffff', padding: '14px', borderRadius: '12px', border: '1px solid #fef08a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ background: '#fef3c7', color: '#d97706', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11px' }}>
                        1
                      </span>
                      <strong style={{ fontSize: '13px', color: '#854d0e' }}>Pay Amount</strong>
                    </div>
                    <p style={{ fontSize: '11.5px', color: '#713f12', margin: 0, lineHeight: 1.4 }}>
                      Scan QR, use UPI ID, or send via Net Banking.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div style={{ background: '#ffffff', padding: '14px', borderRadius: '12px', border: '1px solid #fef08a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ background: '#fef3c7', color: '#d97706', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11px' }}>
                        2
                      </span>
                      <strong style={{ fontSize: '13px', color: '#854d0e' }}>Note UTR No.</strong>
                    </div>
                    <p style={{ fontSize: '11.5px', color: '#713f12', margin: 0, lineHeight: 1.4 }}>
                      Save the 12-digit transaction reference number.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div style={{ background: '#ffffff', padding: '14px', borderRadius: '12px', border: '1px solid #fef08a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ background: '#fef3c7', color: '#d97706', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11px' }}>
                        3
                      </span>
                      <strong style={{ fontSize: '13px', color: '#854d0e' }}>Verify & Active</strong>
                    </div>
                    <p style={{ fontSize: '11.5px', color: '#713f12', margin: 0, lineHeight: 1.4 }}>
                      Share screenshot or UTR for immediate approval!
                    </p>
                  </div>
                </div>

                {/* Additional Custom Instructions from Admin */}
                {formData.depositInstructions && (
                  <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fde047', fontSize: '12.5px', color: '#713f12', lineHeight: 1.5, marginBottom: '14px' }}>
                    <strong>Admin Note:</strong> {formData.depositInstructions}
                  </div>
                )}

                {/* Support Helpline Footer */}
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '12.5px', color: '#854d0e', paddingTop: '10px', borderTop: '1px solid #fef08a' }}>
                  {formData.supportPhone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={14} style={{ color: '#d97706' }} />
                      <span>Helpline: <strong>{formData.supportPhone}</strong></span>
                    </div>
                  )}
                  {formData.supportEmail && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} style={{ color: '#d97706' }} />
                      <span>Support: <strong>{formData.supportEmail}</strong></span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyAccountPage;
