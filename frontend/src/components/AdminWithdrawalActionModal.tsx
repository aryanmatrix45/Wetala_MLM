import React, { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, CreditCard, FileText, X, XCircle } from 'lucide-react';
import { StatusBadge } from './ui';
import { api, type WithdrawalRequestItem } from '../services/api';

export type AdminActionType = 'APPROVE' | 'REJECT' | 'PAY' | 'VIEW_DETAILS';

interface AdminWithdrawalActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: WithdrawalRequestItem | null;
  actionType: AdminActionType;
  onSuccess: () => void;
}

// Mount the content only while open, so its hooks always run in the same order (and state resets per request)
export const AdminWithdrawalActionModal: React.FC<AdminWithdrawalActionModalProps> = (props) => {
  if (!props.isOpen || !props.request) return null;
  return <AdminWithdrawalActionModalContent key={`${props.request.requestId}-${props.actionType}`} {...props} request={props.request} />;
};

const AdminWithdrawalActionModalContent: React.FC<AdminWithdrawalActionModalProps & { request: WithdrawalRequestItem }> = ({
  onClose,
  request,
  actionType,
  onSuccess,
}) => {

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


  return (
    <div className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}>
      <div className="modal modal-legacy" style={{ maxWidth: '540px', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="card-title-group">
            <span className={`icon-tile ${actionType === 'APPROVE' ? 'tone-blue' : actionType === 'REJECT' ? 'tone-red' : actionType === 'PAY' ? 'tone-green' : 'tone-gold'}`}>
              {actionType === 'APPROVE' && <Check size={20} />}
              {actionType === 'REJECT' && <XCircle size={20} />}
              {actionType === 'PAY' && <CreditCard size={20} />}
              {actionType === 'VIEW_DETAILS' && <FileText size={20} />}
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 className="modal-title">{getTitle()}</h2>
              <p className="modal-subtitle">
                {request.requestId} · {request.memberName || request.memberId} ({request.memberId})
              </p>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={loading} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Member Request Overview Strip */}
        <div style={{ padding: '16px 24px 8px', background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Requested</span>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)' }}>
                ₹ {request.requestedAmount.toLocaleString()}
              </div>
            </div>

            <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Status</span>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, marginTop: '2px' }}>
                <StatusBadge status={request.status} />
              </div>
            </div>

            <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Date</span>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '2px' }}>
                {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
              </div>
            </div>
          </div>

          {request.note && (
            <div style={{ marginTop: '10px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', background: 'var(--surface)', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <strong>Member Note:</strong> {request.note}
            </div>
          )}
        </div>

        {/* Content Body / Form */}
        <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
          {error && (
            <div style={{ padding: '12px 14px', background: 'var(--danger-light)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: 'var(--fs-base)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{ padding: '12px 14px', background: 'var(--success-light)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: 'var(--fs-base)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{success}</span>
            </div>
          )}

          {actionType === 'VIEW_DETAILS' ? (
            <div>
              <h3 className="section-title" style={{ marginBottom: '12px' }}>
                Audit Trail & Status History
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(request.statusHistory && request.statusHistory.length > 0 ? request.statusHistory : [
                  { status: request.status, changedAt: request.requestedAt, changedBy: request.memberId, note: request.note }
                ]).map((hist, i) => (
                  <div key={i} style={{ padding: '12px 14px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 800, fontSize: 'var(--fs-sm)', color: 'var(--text-strong)' }}>{hist.status}</span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                        {hist.changedAt ? new Date(hist.changedAt).toLocaleString() : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                      <strong>By:</strong> {hist.changedBy}
                    </div>
                    {hist.note && (
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <em>"{hist.note}"</em>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {request.paymentReference && (
                <div style={{ marginTop: '16px', padding: '12px 14px', background: 'var(--success-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--success-border)' }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--success-strong)' }}>Disbursed Payment Details</div>
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--success-hover)', marginTop: '2px' }}>
                    Paid Amount: ₹ {request.paidAmount ? request.paidAmount.toLocaleString() : request.requestedAmount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--success)', marginTop: '2px' }}>
                    Txn Reference / UTR: <strong>{request.paymentReference}</strong>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={onClose} className="btn btn-primary">
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {actionType === 'APPROVE' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
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
                        fontSize: 'var(--fs-lg)',
                        fontWeight: 700,
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-strong)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Admin Approval Note <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(Optional)</span>
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
                        fontSize: 'var(--fs-base)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-strong)',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ padding: '10px 14px', background: 'var(--primary-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-border)', fontSize: 'var(--fs-sm)', color: 'var(--primary-strong)', marginBottom: '20px' }}>
                    ℹ️ <strong>Note:</strong> Approving will set status to <strong>APPROVED</strong>. Payout funds are <strong>NOT deducted</strong> until you execute "Mark as Paid".
                  </div>
                </>
              )}

              {actionType === 'REJECT' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Rejection Reason <span style={{ color: 'var(--danger)' }}>*</span>
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
                        fontSize: 'var(--fs-base)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-strong)',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ padding: '10px 14px', background: 'var(--danger-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--danger-border)', fontSize: 'var(--fs-sm)', color: 'var(--danger-strong)', marginBottom: '20px' }}>
                    <strong>Warning:</strong> The member will receive a rejection notification with the reason above.
                  </div>
                </>
              )}

              {actionType === 'PAY' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Actual Paid Amount (₹) <span style={{ color: 'var(--danger)' }}>*</span>
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
                        fontSize: 'var(--fs-lg)',
                        fontWeight: 800,
                        color: 'var(--success)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-strong)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Payment Reference / UTR / Transaction ID <span style={{ color: 'var(--danger)' }}>*</span>
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
                        fontSize: 'var(--fs-base)',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-strong)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Admin Remarks <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(Optional)</span>
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
                        fontSize: 'var(--fs-base)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-strong)',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ padding: '12px 14px', background: 'var(--success-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--success-border)', fontSize: 'var(--fs-sm)', color: 'var(--success-strong)', marginBottom: '20px' }}>
                    <strong>Automated Balance Deduction:</strong> Confirming payment will permanently mark this request as <strong>PAID</strong> and deduct <strong>₹{parseFloat(paidAmount || '0').toLocaleString()}</strong> from member's available payout. Duplicate payment is strictly prevented.
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading} className="btn btn-secondary">
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{
                    padding: '10px 24px',
                    fontSize: 'var(--fs-base)',
                    fontWeight: 700,
                    background:
                      actionType === 'APPROVE'
                        ? 'var(--primary)'
                        : actionType === 'REJECT'
                        ? 'var(--danger)'
                        : 'var(--success)',
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
                          border: '2px solid var(--surface)',
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
