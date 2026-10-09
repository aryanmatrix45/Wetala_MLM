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
  Trash2,
  Info,
  Smartphone,
  Landmark,
  FileCheck2,
  Phone,
  Mail
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

  const fetchAccount = async () => {
    setLoading(true);
    try {
      const res = await api.getCompanyAccount(token || undefined);
      if (res && res.status && res.data) {
        setAccount(res.data);
        setFormData({
          bankName: res.data.bankName || '',
          accountHolderName: res.data.accountHolderName || '',
          accountNumber: res.data.accountNumber || '',
          ifscCode: res.data.ifscCode || '',
          branchName: res.data.branchName || '',
          accountType: res.data.accountType || 'Current Account',
          upiId: res.data.upiId || '',
          upiHolderName: res.data.upiHolderName || '',
          depositInstructions: res.data.depositInstructions || '',
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
      
      // Auto-upload QR to server
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

  // Download QR Code for member
  const handleDownloadQr = () => {
    if (!qrPreview) return;
    const a = document.createElement('a');
    a.href = qrPreview;
    a.download = `Panchveda_Payment_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isEffectiveAdmin = isAdmin && !previewMemberMode;

  return (
    <div className="page-body">
      {/* Header */}
      <div className="welcome-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">
              {isEffectiveAdmin ? 'Company Account & Payment Settings' : 'Official Company Account & Payment Details'}
            </h1>
            <span style={{
              background: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <ShieldCheck size={14} /> Official Verified Account
            </span>
          </div>
          <p className="page-subtitle">
            {isEffectiveAdmin 
              ? 'Configure company bank details, UPI ID, and payment QR code shared with members for official package payments and deposits.' 
              : 'Scan the official payment QR code, copy the UPI ID, or use bank transfer for purchasing packages and adding business volume.'}
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
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                background: previewMemberMode ? '#eff6ff' : '#ffffff',
                border: previewMemberMode ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                color: previewMemberMode ? '#1d4ed8' : '#334155',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              <Eye size={15} />
              <span>{previewMemberMode ? 'Back to Edit Mode' : 'Preview Member View'}</span>
            </button>
          )}

          <button 
            onClick={fetchAccount} 
            className="secondary-btn" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px' }}
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
          padding: '12px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: statusMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${statusMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: statusMessage.type === 'success' ? '#065f46' : '#991b1b',
          fontSize: '13.5px',
          fontWeight: 600
        }}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
          <p style={{ fontWeight: 600 }}>Loading company account details...</p>
        </div>
      ) : isEffectiveAdmin ? (
        /* ========================================================================= */
        /* ADMIN CONFIGURATION MODE (Editable 3-Option Dashboard)                    */
        /* ========================================================================= */
        <form onSubmit={handleSaveDetails}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr', gap: '24px', alignItems: 'start' }}>
            
            {/* Column 1: QR Code & UPI Configuration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Option 1: QR Code Uploader */}
              <div className="dashboard-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <QrCode size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>1. Payment QR Code</h3>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Upload official payment QR code (PhonePe, GPay, Paytm, BHIM).</p>
                  </div>
                </div>

                <div style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '24px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {qrPreview ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        background: '#ffffff',
                        padding: '12px',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                        border: '1px solid #e2e8f0'
                      }}>
                        <img 
                          src={qrPreview} 
                          alt="Payment QR Code Preview" 
                          style={{ width: '180px', height: '180px', objectFit: 'contain', display: 'block' }} 
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <label style={{
                          background: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Upload size={14} />
                          <span>Change QR</span>
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
                            padding: '7px 14px',
                            borderRadius: '8px',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '20px 0' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <Upload size={22} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                        Upload Company QR Code
                      </div>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 14px 0' }}>
                        PNG, JPG, or WEBP up to 5MB
                      </p>
                      <label style={{
                        background: '#2563eb',
                        color: 'white',
                        padding: '8px 18px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Upload size={15} />
                        <span>Browse Image</span>
                        <input type="file" accept="image/*" onChange={handleQrFileSelect} style={{ display: 'none' }} />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Option 2: UPI Details */}
              <div className="dashboard-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>2. UPI ID Details</h3>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Official Virtual Payment Address (VPA) for quick UPI payments.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Company UPI ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. panchveda@sbi or username@okhdfcbank"
                      value={formData.upiId}
                      onChange={(e) => setFormData({ ...formData, upiId: e.target.value.toLowerCase() })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px', fontFamily: 'monospace', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      UPI Payee / Account Holder Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Panchveda Wellness Pvt Ltd"
                      value={formData.upiHolderName}
                      onChange={(e) => setFormData({ ...formData, upiHolderName: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Bank Account Details & Deposit Instructions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Option 3: Bank Account Details */}
              <div className="dashboard-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Landmark size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>3. Bank Account Details</h3>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>For direct NEFT, RTGS, and IMPS internet banking transfers.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Account Holder Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Panchveda Wellness Pvt Ltd"
                      value={formData.accountHolderName}
                      onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. State Bank of India"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Account Type *
                    </label>
                    <select
                      value={formData.accountType}
                      onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                    >
                      <option value="Current Account">Current Account</option>
                      <option value="Savings Account">Savings Account</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Account Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9876543210123"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px', fontFamily: 'monospace', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      IFSC Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SBIN0001234"
                      value={formData.ifscCode}
                      onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px', fontFamily: 'monospace', fontWeight: 700 }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Branch Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Connaught Place Branch, New Delhi"
                      value={formData.branchName}
                      onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Instructions & Help */}
              <div className="dashboard-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Info size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Payment Guidelines & Contacts</h3>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Instructions displayed to members on payment completion.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Deposit / Payment Instructions for Members
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Please enter your Member ID in remarks. Submit screenshot after payment..."
                      value={formData.depositInstructions}
                      onChange={(e) => setFormData({ ...formData, depositInstructions: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                        Support Phone
                      </label>
                      <input
                        type="text"
                        placeholder="+91 98765 43210"
                        value={formData.supportPhone}
                        onChange={(e) => setFormData({ ...formData, supportPhone: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                        Support Email
                      </label>
                      <input
                        type="email"
                        placeholder="payments@panchvedawellness.com"
                        value={formData.supportEmail}
                        onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Bar */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={saving}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 24px',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                    }}
                  >
                    <Save size={16} />
                    <span>{saving ? 'Saving...' : 'Save & Publish Account Details'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* ========================================================================= */
        /* MEMBER VIEW-ONLY MODE (Clean Read-Only Cards with 1-Click Copy & QR)      */
        /* ========================================================================= */
        <div>
          {/* Important Security Notice */}
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#1e3a8a' }}>
                  Official Panchveda Wellness Company Account
                </div>
                <div style={{ fontSize: '13px', color: '#3b82f6', marginTop: '2px' }}>
                  Please only transfer funds to the verified accounts listed below. Always include your <strong>Member ID ({user?.memberId || 'MEM...'})</strong> in the payment remarks.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '24px', alignItems: 'start' }}>
            
            {/* Left Card: QR Code & UPI Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Option 1: Payment QR Code Card */}
              <div className="dashboard-card" style={{ padding: '28px 24px', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eff6ff', color: '#2563eb', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, marginBottom: '16px' }}>
                  <QrCode size={14} /> Scan & Pay Instantly
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                  UPI Payment QR Code
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
                  Scan with Google Pay, PhonePe, Paytm, BHIM, or any banking app.
                </p>

                {qrPreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      background: '#ffffff',
                      padding: '16px',
                      borderRadius: '16px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                      border: '2px solid #e2e8f0',
                      display: 'inline-block'
                    }}>
                      <img 
                        src={qrPreview} 
                        alt="Company Payment QR Code" 
                        style={{ width: '220px', height: '220px', objectFit: 'contain', display: 'block' }} 
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className="primary-btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        fontSize: '13px',
                        fontWeight: 700,
                        background: '#059669',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
                      }}
                    >
                      <Download size={16} />
                      <span>Download QR Code Image</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '30px 10px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <QrCode size={40} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                      QR Code image is currently being updated by the admin. Please use the UPI ID or Bank details below.
                    </p>
                  </div>
                )}
              </div>

              {/* Option 2: UPI ID Card with 1-Click Copy */}
              <div className="dashboard-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Direct UPI ID</h3>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Transfer directly via any UPI app.</p>
                  </div>
                </div>

                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                      UPI ID (VPA)
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', marginTop: '2px' }}>
                      {formData.upiId || 'panchveda@sbi'}
                    </div>
                    {formData.upiHolderName && (
                      <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                        Payee: {formData.upiHolderName}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(formData.upiId, 'upiId')}
                    style={{
                      background: copiedField === 'upiId' ? '#ecfdf5' : '#ffffff',
                      color: copiedField === 'upiId' ? '#059669' : '#2563eb',
                      border: copiedField === 'upiId' ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {copiedField === 'upiId' ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedField === 'upiId' ? 'Copied!' : 'Copy UPI'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Card: Bank Account Details & Guidelines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Option 3: Bank Details Card */}
              <div className="dashboard-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Landmark size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Bank Account (NEFT / IMPS / RTGS)</h3>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>For direct internet and net banking transfers.</p>
                    </div>
                  </div>
                  <span style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>
                    {formData.accountType || 'Current Account'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  
                  {/* Account Holder */}
                  <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                      Beneficiary Name
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {formData.accountHolderName || 'Panchveda Wellness Pvt Ltd'}
                    </div>
                  </div>

                  {/* Bank Name */}
                  <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                      Bank Name
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {formData.bankName || 'State Bank of India'}
                    </div>
                  </div>

                  {/* Account Number with 1-Click Copy */}
                  <div style={{
                    padding: '12px 14px',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                        Account Number
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e40af', fontFamily: 'monospace', letterSpacing: '0.8px', marginTop: '2px' }}>
                        {formData.accountNumber || '9876543210123'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.accountNumber, 'accountNumber')}
                      style={{
                        background: copiedField === 'accountNumber' ? '#ecfdf5' : '#ffffff',
                        color: copiedField === 'accountNumber' ? '#059669' : '#2563eb',
                        border: copiedField === 'accountNumber' ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                        padding: '7px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      {copiedField === 'accountNumber' ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedField === 'accountNumber' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  {/* IFSC Code with 1-Click Copy */}
                  <div style={{
                    padding: '12px 14px',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                        IFSC Code
                      </div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', letterSpacing: '0.8px', marginTop: '2px' }}>
                        {formData.ifscCode || 'SBIN0001234'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.ifscCode, 'ifscCode')}
                      style={{
                        background: copiedField === 'ifscCode' ? '#ecfdf5' : '#ffffff',
                        color: copiedField === 'ifscCode' ? '#059669' : '#2563eb',
                        border: copiedField === 'ifscCode' ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                        padding: '7px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      {copiedField === 'ifscCode' ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedField === 'ifscCode' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  {/* Branch */}
                  {formData.branchName && (
                    <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                        Branch Name
                      </div>
                      <div style={{ fontSize: '13.5px', color: '#334155', fontWeight: 600, marginTop: '2px' }}>
                        {formData.branchName}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Deposit Guidelines Card */}
              <div className="dashboard-card" style={{ padding: '24px', background: 'linear-gradient(135deg, #ffffff 0%, #fefce8 100%)', border: '1px solid #fef08a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <FileCheck2 size={20} style={{ color: '#d97706' }} />
                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#854d0e', margin: 0 }}>
                    Step-by-Step Payment Instructions
                  </h4>
                </div>

                <p style={{ fontSize: '13px', color: '#713f12', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                  {formData.depositInstructions || 'Please enter your Member ID in remarks. Take a screenshot of the transaction receipt and submit to admin.'}
                </p>

                <div style={{ borderTop: '1px solid #fde047', paddingTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: '#854d0e' }}>
                  {formData.supportPhone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={14} />
                      <span>Support Phone: <strong>{formData.supportPhone}</strong></span>
                    </div>
                  )}
                  {formData.supportEmail && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} />
                      <span>Email: <strong>{formData.supportEmail}</strong></span>
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
