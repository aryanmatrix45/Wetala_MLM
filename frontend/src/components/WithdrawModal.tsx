import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Package, ShieldCheck, ShoppingBag, Wallet, X } from 'lucide-react';
import { Alert } from './ui';
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

  const isPrivileged = user?.role?.toLowerCase() === 'superadmin';

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
      <div className="modal-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}>
        <div className="modal modal-legacy" style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column' }}
          onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="modal-header">
            <div style={{ minWidth: 0 }}>
              <h2 className="modal-title">Withdrawal not available yet</h2>
              <p className="modal-subtitle">At least 1,250 lifetime personal BV is required</p>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div style={{ padding: '24px' }}>
            {/* Warning Message Box */}
            <Alert tone="warning" style={{ marginBottom: 'var(--space-5)' }}>
              <p style={{ fontWeight: 600 }}>Your lifetime business volume that you have bought by a product or by a package has not reached <strong>1,250 BV</strong>.</p>
              <p style={{ marginTop: 6 }}>You cannot send a withdrawal request to the super admin until your lifetime personal purchases reach at least <strong>1,250 BV</strong>. For that, please buy a product or buy any package.</p>
            </Alert>

            {/* Lifetime BV Progress Card */}
            <div
              style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Lifetime Personal Purchases
                </span>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--warning-hover)' }}>
                  {progressPercent}% Completed
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '10px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: '14px' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    background: 'var(--warning)',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>

              {/* Stats Split Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
                <div style={{ padding: '8px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Your BV</div>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                    {bvInfo.lifetimePersonalBV.toLocaleString()}
                  </div>
                </div>

                <div style={{ padding: '8px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Required</div>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--success)', marginTop: '2px' }}>
                    {bvInfo.minWithdrawalBVRequired.toLocaleString()}
                  </div>
                </div>

                <div style={{ padding: '8px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Needed</div>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--danger)', marginTop: '2px' }}>
                    {bvInfo.shortfallBV.toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.4 }}>
                ℹ All Business Volume from any package purchases or product repurchases accumulates across your lifetime.
              </div>
            </div>

            {/* Quick Actions (Buy Product / Buy Package) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => handleActionNavigate('member-products')} className="btn btn-success">
                <ShoppingBag size={16} />
                <span>Buy Products</span>
              </button>

              <button
                type="button"
                onClick={() => handleActionNavigate('packages')} className="btn btn-primary">
                <Package size={16} />
                <span>Buy Package</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
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
    <div className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}>
      <div className="modal modal-legacy" style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <h2 className="modal-title">Request withdrawal</h2>
            <p className="modal-subtitle">
              {user?.name || 'Member'} · ID <strong>{user?.memberId || 'MEM0001'}</strong>
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={loading} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Balance Snapshot Card */}
        <div style={{ padding: '20px 24px 10px' }}>
          <div
            style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--primary-soft)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 18px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px',
            }}
          >
            <div>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Available for Withdrawal
              </span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary-hover)', marginTop: '2px' }}>
                ₹ {availablePayout.toLocaleString()}
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--success)', fontWeight: 600 }}>
                Instant Requestable
              </span>
            </div>

            <div>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Payout (Lifetime)
              </span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                ₹ {totalPayout.toLocaleString()}
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                Cumulative Earnings
              </span>
            </div>
          </div>

          {/* Qualified Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: 'var(--fs-sm)', color: 'var(--success)', fontWeight: 600 }}>
            <ShieldCheck size={15} color="var(--success)" />
            <span>Lifetime Purchase Qualified ({bvInfo.lifetimePersonalBV.toLocaleString()} BV / 1,250 BV)</span>
          </div>

          {pendingAmount > 0 && (
            <div
              style={{
                marginTop: '10px',
                padding: '10px 14px',
                background: 'var(--warning-light)',
                border: '1px solid var(--warning-soft)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: 'var(--fs-sm)',
                color: 'var(--warning-hover)',
              }}
            >
              <AlertCircle size={15} color="var(--warning)" style={{ flexShrink: 0 }} />
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
                background: 'var(--danger-light)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger-hover)',
                fontSize: 'var(--fs-base)',
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
                background: 'var(--success-light)',
                border: '1px solid var(--success-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--success)',
                fontSize: 'var(--fs-base)',
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
              <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                Withdrawal Amount <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
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
                  fontSize: 'var(--fs-lg)',
                  color: 'var(--text-muted)',
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
                  fontSize: 'var(--fs-lg)',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  border: isOverLimit ? '2px solid var(--danger)' : '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-lg)',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  background: 'var(--surface)',
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
                  disabled={loading || maxAllowed <= 0} className="btn btn-secondary btn-sm" style={{ flex: 1 }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--primary-light)';
                    e.currentTarget.style.borderColor = 'var(--primary-border)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface-subtle)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}>
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Optional Note Field */}
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
              Remarks / Transaction Note <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-light)', fontWeight: 400 }}>(Optional)</span>
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
                fontSize: 'var(--fs-base)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                outline: 'none',
                resize: 'none',
                background: 'var(--surface)',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading} className="btn btn-secondary">
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || isInvalid || maxAllowed <= 0}
              className="btn btn-primary"
              style={{
                padding: '10px 24px',
                fontSize: 'var(--fs-base)',
                fontWeight: 700,
                background: isInvalid || maxAllowed <= 0 ? 'var(--border-strong)' : 'var(--primary)',
                cursor: isInvalid || maxAllowed <= 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isInvalid || maxAllowed <= 0 ? 'none' : 'none',
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
