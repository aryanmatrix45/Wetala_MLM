import React, { useState } from 'react';
import { X, Check, XCircle, CreditCard, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { api, type WithdrawalRequestItem } from '../services/api';

export type AdminActionType = 'APPROVE' | 'REJECT' | 'PAY' | 'VIEW_DETAILS';

interface AdminWithdrawalActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: WithdrawalRequestItem | null;
  actionType: AdminActionType;
  onSuccess: () => void;
}

export const AdminWithdrawalActionModal: React.FC<AdminWithdrawalActionModalProps> = ({
  isOpen,
  onClose,
  request,
  actionType,
  onSuccess,
}) => {
  if (!isOpen || !request) return null;

  const [approvedAmount, setApprovedAmount] = useState<string>(
    request.approvedAmount ? String(request.approvedAmount) : String(request.requestedAmount)
  );
  const [paidAmount, setPaidAmount] = useState<string>(
    request.approvedAmount ? String(request.approvedAmount) : String(request.requestedAmount)
  );
  const [paymentReference, setPaymentReference] = useState<string>(request.paymentReference || '');
  const [adminNote, setAdminNote] = useState<string>(request.adminNote || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (actionType === 'APPROVE') {
        const numApproved = parseFloat(approvedAmount);
        if (!numApproved || numApproved <= 0) {
          setError('Please provide a valid approved amount greater than ₹0');
          setLoading(false);
          return;
        }

        const res = await api.approveWithdrawal(request.requestId, {
          approvedAmount: numApproved,
          adminNote: adminNote.trim(),
        });

        if (res?.status) {
          setSuccess(`Request ${request.requestId} approved successfully!`);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1000);
        } else {
          setError(res?.message || 'Failed to approve request');
        }
      } else if (actionType === 'REJECT') {
        if (!adminNote.trim()) {
          setError('Please provide a reason or note for rejecting this request.');
          setLoading(false);
          return;
        }

        const res = await api.rejectWithdrawal(request.requestId, {
          adminNote: adminNote.trim(),
        });

        if (res?.status) {
          setSuccess(`Request ${request.requestId} rejected.`);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1000);
        } else {
          setError(res?.message || 'Failed to reject request');
        }
      } else if (actionType === 'PAY') {
        const numPaid = parseFloat(paidAmount);
        if (!numPaid || numPaid <= 0) {
          setError('Please enter a valid paid amount greater than ₹0');
          setLoading(false);
          return;
        }

        if (!paymentReference.trim()) {
          setError('Payment Reference / Transaction ID is required to mark as paid');
          setLoading(false);
          return;
        }

        const res = await api.markWithdrawalAsPaid(request.requestId, {
          paidAmount: numPaid,
          paymentReference: paymentReference.trim(),
          adminNote: adminNote.trim(),
        });

        if (res?.status) {
          setSuccess(`Payment recorded! ₹${numPaid.toLocaleString()} deducted from member balance.`);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1200);
        } else {
          setError(res?.message || 'Failed to process payment');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Network error processing admin action');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (actionType) {
      case 'APPROVE':
        return 'Approve Withdrawal Request';
      case 'REJECT':
        return 'Reject Withdrawal Request';
      case 'PAY':
        return 'Mark Withdrawal as PAID';
      case 'VIEW_DETAILS':
        return 'Withdrawal Request Audit Details';
    }
  };

  const getHeaderGradient = () => {
    switch (actionType) {
      case 'APPROVE':
        return 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)';
      case 'REJECT':
        return 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)';
      case 'PAY':
        return 'linear-gradient(135deg, #064e3b 0%, #059669 100%)';
      case 'VIEW_DETAILS':
        return 'linear-gradient(135deg, #0f172a 0%, #334155 100%)';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '540px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            background: getHeaderGradient(),
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {actionType === 'APPROVE' && <Check size={20} color="#ffffff" />}
              {actionType === 'REJECT' && <XCircle size={20} color="#ffffff" />}
              {actionType === 'PAY' && <CreditCard size={20} color="#ffffff" />}
              {actionType === 'VIEW_DETAILS' && <FileText size={20} color="#ffffff" />}
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{getTitle()}</h2>
              <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', margin: '2px 0 0' }}>
                Req ID: <strong>{request.requestId}</strong> • Member: <strong>{request.memberName || request.memberId} ({request.memberId})</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Member Request Overview Strip */}
        <div style={{ padding: '16px 24px 8px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Requested</span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                ₹ {request.requestedAmount.toLocaleString()}
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Status</span>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '2px' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    display: 'inline-block',
                    background:
                      request.status === 'PAID'
                        ? '#ecfdf5'
                        : request.status === 'APPROVED'
                        ? '#eff6ff'
                        : request.status === 'REJECTED'
                        ? '#fef2f2'
                        : '#fffbeb',
                    color:
                      request.status === 'PAID'
                        ? '#059669'
                        : request.status === 'APPROVED'
                        ? '#2563eb'
                        : request.status === 'REJECTED'
                        ? '#dc2626'
                        : '#d97706',
                  }}
                >
                  {request.status}
                </span>
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Date</span>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569', marginTop: '2px' }}>
                {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
              </div>
            </div>
          </div>

          {request.note && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#475569', background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong>Member Note:</strong> {request.note}
            </div>
          )}
        </div>

        {/* Content Body / Form */}
        <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
          {error && (
            <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#dc2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{ padding: '12px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', color: '#059669', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{success}</span>
            </div>
          )}

          {actionType === 'VIEW_DETAILS' ? (
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
                Audit Trail & Status History
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(request.statusHistory && request.statusHistory.length > 0 ? request.statusHistory : [
                  { status: request.status, changedAt: request.requestedAt, changedBy: request.memberId, note: request.note }
                ]).map((hist, i) => (
                  <div key={i} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 800, fontSize: '12px', color: '#1e293b' }}>{hist.status}</span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {hist.changedAt ? new Date(hist.changedAt).toLocaleString() : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      <strong>By:</strong> {hist.changedBy}
                    </div>
                    {hist.note && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        <em>"{hist.note}"</em>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {request.paymentReference && (
                <div style={{ marginTop: '16px', padding: '12px 14px', background: '#ecfdf5', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#065f46' }}>Disbursed Payment Details</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#047857', marginTop: '2px' }}>
                    Paid Amount: ₹ {request.paidAmount ? request.paidAmount.toLocaleString() : request.requestedAmount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#059669', marginTop: '2px' }}>
                    Txn Reference / UTR: <strong>{request.paymentReference}</strong>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={onClose} className="primary-btn" style={{ fontSize: '13px', padding: '8px 20px' }}>
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {actionType === 'APPROVE' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                      Approved Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(e.target.value)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        fontSize: '15px',
                        fontWeight: 700,
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                      Admin Approval Note <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Approved for bank transfer processing..."
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '13px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', fontSize: '12px', color: '#1e40af', marginBottom: '20px' }}>
                    ℹ️ <strong>Note:</strong> Approving will set status to <strong>APPROVED</strong>. Payout funds are <strong>NOT deducted</strong> until you execute "Mark as Paid".
                  </div>
                </>
              )}

              {actionType === 'REJECT' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                      Rejection Reason <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="State the reason for rejecting this withdrawal request (e.g. Invalid bank details, incomplete KYC)..."
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      disabled={loading}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '13px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca', fontSize: '12px', color: '#991b1b', marginBottom: '20px' }}>
                    ⚠️ <strong>Warning:</strong> The member will receive a rejection notification with the reason above.
                  </div>
                </>
              )}

              {actionType === 'PAY' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                      Actual Paid Amount (₹) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      disabled={loading}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        fontSize: '16px',
                        fontWeight: 800,
                        color: '#059669',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                      Payment Reference / UTR / Transaction ID <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. IMPS/UPI/NEFT Reference Number: UTR192837465"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      disabled={loading}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        fontSize: '13px',
                        fontWeight: 600,
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                      Admin Remarks <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Optional payout disbursement remarks..."
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '13px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ padding: '12px 14px', background: '#ecfdf5', borderRadius: '10px', border: '1px solid #a7f3d0', fontSize: '12px', color: '#065f46', marginBottom: '20px' }}>
                    ⚡ <strong>Automated Balance Deduction:</strong> Confirming payment will permanently mark this request as <strong>PAID</strong> and deduct <strong>₹{parseFloat(paidAmount || '0').toLocaleString()}</strong> from member's available payout. Duplicate payment is strictly prevented.
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569',
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="primary-btn"
                  style={{
                    padding: '10px 24px',
                    fontSize: '13px',
                    fontWeight: 700,
                    background:
                      actionType === 'APPROVE'
                        ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                        : actionType === 'REJECT'
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {loading ? (
                    <>
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          border: '2px solid #ffffff',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      {actionType === 'APPROVE' && <Check size={16} />}
                      {actionType === 'REJECT' && <XCircle size={16} />}
                      {actionType === 'PAY' && <CreditCard size={16} />}
                      <span>
                        {actionType === 'APPROVE' && 'Confirm Approval'}
                        {actionType === 'REJECT' && 'Reject Request'}
                        {actionType === 'PAY' && 'Mark as Paid & Deduct'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
export default AdminWithdrawalActionModal;
