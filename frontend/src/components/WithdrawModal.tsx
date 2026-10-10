import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowDownRight, 
  Wallet, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  ShoppingBag, 
  Package, 
  AlertTriangle
} from 'lucide-react';
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
  onNavigate?: (tab: string) => void;
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
  onNavigate,
}) => {
  const maxAllowed = effectiveAvailable !== undefined ? effectiveAvailable : Math.max(0, availablePayout - pendingAmount);
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isPrivileged = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin';

  // Lifetime Personal BV Eligibility State (1,250 BV threshold)
  const [bvInfo, setBvInfo] = useState<{
    lifetimePersonalBV: number;
    minWithdrawalBVRequired: number;
    isWithdrawalEligible: boolean;
    shortfallBV: number;
    loadingBV: boolean;
  }>({
    lifetimePersonalBV: user?.personalBv || 0,
    minWithdrawalBVRequired: 1250,
    isWithdrawalEligible: isPrivileged || (user?.personalBv || 0) >= 1250,
    shortfallBV: Math.max(0, 1250 - (user?.personalBv || 0)),
    loadingBV: false,
  });

  useEffect(() => {
    if (isOpen && user?.memberId) {
      setBvInfo((prev) => ({ ...prev, loadingBV: true }));
      api.getWithdrawalBalanceSummary(user.memberId)
        .then((res: any) => {
          if (res?.status && res?.data) {
            const currentLifetime = res.data.lifetimePersonalBV ?? (user?.personalBv || 0);
            const minReq = res.data.minWithdrawalBVRequired || 1250;
            const eligible = isPrivileged || currentLifetime >= minReq;
            setBvInfo({
              lifetimePersonalBV: currentLifetime,
              minWithdrawalBVRequired: minReq,
              isWithdrawalEligible: eligible,
              shortfallBV: Math.max(0, minReq - currentLifetime),
              loadingBV: false,
            });
          }
        })
        .catch(() => {
          setBvInfo((prev) => ({ ...prev, loadingBV: false }));
        });
    }
  }, [isOpen, user?.memberId, isPrivileged]);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  const isOverLimit = numAmount > maxAllowed;
  const isInvalid = numAmount <= 0 || isOverLimit;

  const handleQuickPercent = (pct: number) => {
    const calculated = Math.floor(maxAllowed * (pct / 100));
    setAmount(calculated > 0 ? calculated.toString() : '');
    setError(null);
  };

  const handleActionNavigate = (targetTab: string) => {
    onClose();
    if (onNavigate) {
      onNavigate(targetTab);
    } else {
      if (targetTab === 'member-products') {
        window.location.href = '/products';
      } else {
        window.location.href = `/${targetTab}`;
      }
    }
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

  // =========================================================================
  // POP-UP VIEW 1: INELIGIBLE (Lifetime Personal BV < 1,250 BV)
  // =========================================================================
  if (!isPrivileged && !bvInfo.isWithdrawalEligible && !bvInfo.loadingBV) {
    const progressPercent = Math.min(100, Math.round((bvInfo.lifetimePersonalBV / bvInfo.minWithdrawalBVRequired) * 100));

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            border: '1px solid #fed7aa',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '22px 24px',
              background: 'linear-gradient(135deg, #7c2d12 0%, #c2410c 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                }}
              >
                <Lock size={22} color="#ffffff" />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                  Withdrawal Requirement Not Met
                </h2>
                <p style={{ fontSize: '12px', color: '#fed7aa', margin: '3px 0 0' }}>
                  Minimum 1,250 Lifetime Business Volume (BV) Required
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
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

          {/* Modal Body */}
          <div style={{ padding: '24px' }}>
            {/* Warning Message Box */}
            <div
              style={{
                background: '#fff7ed',
                border: '1px solid #ffedd5',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                gap: '12px',
              }}
            >
              <AlertTriangle size={22} color="#ea580c" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ fontSize: '13.5px', color: '#9a3412', fontWeight: 600, margin: 0, lineHeight: 1.55 }}>
                  Your lifetime business volume that you have bought by a product or by a package has not reached <strong>1,250 BV</strong>.
                </p>
                <p style={{ fontSize: '12.5px', color: '#c2410c', margin: '6px 0 0', lineHeight: 1.5 }}>
                  You cannot send a withdrawal request to the super admin until your lifetime personal purchases reach at least <strong>1,250 BV</strong>. For that, please buy a product or buy any package.
                </p>
              </div>
            </div>

            {/* Lifetime BV Progress Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '18px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Lifetime Personal Purchases
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#ea580c' }}>
                  {progressPercent}% Completed
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden', marginBottom: '14px' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    background: 'linear-gradient(90deg, #ea580c 0%, #f97316 100%)',
                    borderRadius: '9999px',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>

              {/* Stats Split Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
                <div style={{ padding: '8px', background: '#ffffff', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Your BV</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {bvInfo.lifetimePersonalBV.toLocaleString()}
                  </div>
                </div>

                <div style={{ padding: '8px', background: '#ffffff', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Required</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                    {bvInfo.minWithdrawalBVRequired.toLocaleString()}
                  </div>
                </div>

                <div style={{ padding: '8px', background: '#ffffff', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Needed</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>
                    {bvInfo.shortfallBV.toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '12px', lineHeight: 1.4 }}>
                ℹ All Business Volume from any package purchases or product repurchases accumulates across your lifetime.
              </div>
            </div>

            {/* Quick Actions (Buy Product / Buy Package) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => handleActionNavigate('member-products')}
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                }}
              >
                <ShoppingBag size={16} />
                <span>Buy Products</span>
              </button>

              <button
                type="button"
                onClick={() => handleActionNavigate('packages')}
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                }}
              >
                <Package size={16} />
                <span>Buy Package</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                background: '#f1f5f9',
                color: '#475569',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ELIGIBLE FORM (Lifetime BV >= 1,250 BV or Privileged Admin)
  // =========================================================================
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

          {/* Qualified Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '11.5px', color: '#059669', fontWeight: 600 }}>
            <ShieldCheck size={15} color="#10b981" />
            <span>Lifetime Purchase Qualified ({bvInfo.lifetimePersonalBV.toLocaleString()} BV / 1,250 BV)</span>
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
              <AlertCircle size={15} color="#d97706" style={{ flexShrink: 0 }} />
              <span>
                Pending requests: <strong>₹ {pendingAmount.toLocaleString()}</strong>. Remaining allowed: <strong>₹ {maxAllowed.toLocaleString()}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Withdrawal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '10px 24px 24px', display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                padding: '12px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                color: '#b91c1c',
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
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Optional Note Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '6px' }}>
              Remarks / Transaction Note <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Bank transfer request, preferred account note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                outline: 'none',
                resize: 'none',
                background: '#ffffff',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#64748b',
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
