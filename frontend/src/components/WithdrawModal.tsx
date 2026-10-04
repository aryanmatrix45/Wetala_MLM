import React, { useState } from 'react';
import { X, ArrowDownRight, Wallet, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availablePayout: number;
  totalPayout?: number;
  pendingAmount?: number;
  effectiveAvailable?: number;
  user?: any;
  onSuccess: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  availablePayout,
  totalPayout = 0,
  pendingAmount = 0,
  effectiveAvailable,
  user,
  onSuccess,
}) => {
  const maxAllowed = effectiveAvailable !== undefined ? effectiveAvailable : Math.max(0, availablePayout - pendingAmount);
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  const isOverLimit = numAmount > maxAllowed;
  const isInvalid = numAmount <= 0 || isOverLimit;

  const handleQuickPercent = (pct: number) => {
    const calculated = Math.floor(maxAllowed * (pct / 100));
    setAmount(calculated > 0 ? calculated.toString() : '');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalid) {
      if (numAmount <= 0) setError('Please enter an amount greater than ₹0');
      else if (isOverLimit) setError(`Requested amount cannot exceed your available balance of ₹${maxAllowed.toLocaleString()}`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await api.submitWithdrawalRequest({
        amount: numAmount,
        note: note.trim(),
        memberId: user?.memberId,
      });

      if (res?.status) {
        setSuccess(res.message || 'Withdrawal request submitted successfully!');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setError(res?.message || 'Failed to submit withdrawal request');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while submitting withdrawal request');
    } finally {
      setLoading(false);
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
          maxWidth: '520px',
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
            background: 'linear-gradient(135deg, #0b1329 0%, #1e293b 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              }}
            >
              <ArrowDownRight size={22} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                Request Payout Withdrawal
              </h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0' }}>
                {user?.name || 'Member'} • ID: <strong>{user?.memberId || 'MEM0001'}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#ffffff',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Balance Snapshot Card */}
        <div style={{ padding: '20px 24px 10px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
              border: '1px solid #dbeafe',
              borderRadius: '14px',
              padding: '16px 18px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Available for Withdrawal
              </span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#1d4ed8', marginTop: '2px' }}>
                ₹ {availablePayout.toLocaleString()}
              </div>
              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                Instant Requestable
              </span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Payout (Lifetime)
              </span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                ₹ {totalPayout.toLocaleString()}
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Cumulative Earnings
              </span>
            </div>
          </div>

          {pendingAmount > 0 && (
            <div
              style={{
                marginTop: '10px',
                padding: '10px 14px',
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#b45309',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <div>
                ₹ {pendingAmount.toLocaleString()} is currently queued in pending requests. Remaining requestable limit is{' '}
                <strong>₹ {maxAllowed.toLocaleString()}</strong>.
              </div>
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '10px 24px 24px', overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                padding: '12px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                color: '#dc2626',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              style={{
                padding: '12px 14px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '10px',
                color: '#059669',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{success}</span>
            </div>
          )}

          {/* Amount Field */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                Withdrawal Amount <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Max: <strong>₹ {maxAllowed.toLocaleString()}</strong>
              </span>
            </div>

            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  fontSize: '16px',
                  color: '#64748b',
                }}
              >
                ₹
              </span>
              <input
                type="number"
                min="1"
                max={maxAllowed}
                step="1"
                placeholder="Enter amount to withdraw"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 34px',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#0f172a',
                  border: isOverLimit ? '2px solid #ef4444' : '1px solid #cbd5e1',
                  borderRadius: '12px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  background: '#ffffff',
                }}
              />
            </div>

            {/* Quick Fill Percentage Pills */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              {[25, 50, 75, 100].map((pct) => (
                <button
                  type="button"
                  key={pct}
                  onClick={() => handleQuickPercent(pct)}
                  disabled={loading || maxAllowed <= 0}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#eff6ff';
                    e.currentTarget.style.borderColor = '#93c5fd';
                    e.currentTarget.style.color = '#1d4ed8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#334155';
                  }}
                >
                  {pct === 100 ? 'Max (100%)' : `${pct}%`}
                </button>
              ))}
            </div>

            {isOverLimit && (
              <div style={{ color: '#ef4444', fontSize: '11.5px', marginTop: '4px', fontWeight: 600 }}>
                Amount exceeds your allowable limit of ₹{maxAllowed.toLocaleString()}.
              </div>
            )}
          </div>

          {/* Optional Note Field */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
              Note / Bank Remarks <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Bank Account details, IFSC Code, or payment reference note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'none',
                background: '#ffffff',
              }}
            />
          </div>

          {/* Policy Information Notice */}
          <div
            style={{
              padding: '12px 14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              marginBottom: '20px',
              fontSize: '11.5px',
              color: '#64748b',
              lineHeight: 1.5,
              display: 'flex',
              gap: '10px',
            }}
          >
            <ShieldCheck size={18} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              Requests are recorded as <strong>PENDING</strong> and reviewed by administration. Balance is only deducted once the admin disburses and marks the request as <strong>PAID</strong>.
            </div>
          </div>

          {/* Action Buttons */}
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
              disabled={loading || isInvalid || maxAllowed <= 0}
              className="primary-btn"
              style={{
                padding: '10px 24px',
                fontSize: '13px',
                fontWeight: 700,
                background: isInvalid || maxAllowed <= 0 ? '#cbd5e1' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                cursor: isInvalid || maxAllowed <= 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isInvalid || maxAllowed <= 0 ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.35)',
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
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Wallet size={15} />
                  <span>Submit Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default WithdrawModal;
