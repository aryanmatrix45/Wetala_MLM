import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock, Gift, IndianRupee, Layers, PlusCircle, RefreshCw, RotateCcw, Search, Send, ShieldAlert, ShieldCheck, ShoppingCart, Sparkles, Undo2, Wallet } from 'lucide-react';
import { Alert, Field as SharedField, Modal as SharedModal, StatusBadge } from '../components/ui';
import {
  api,
  type BVRateInfo,
  type BVRecipient,
  type BVReturnRequestItem,
  type BVTransactionItem,
  type BVTransactionStatus,
  type BVWalletSummary,
} from '../services/api';

type Section = 'send' | 'history' | 'returns' | 'generate';

interface BVWalletPageProps {
  user?: any;
  token?: string | null;
  initialSection?: Section;
}

interface AdminOverview {
  totalGenerated: number;
  memberCirculationBV: number;
  memberHolders: number;
  reconciliation: { ok: boolean; issues: string[]; checkedAt: string };
}

const OPERATOR_STORAGE_KEY = 'wetala_bv_operator_name';

const formatBV = (value: number | undefined) => `${(value || 0).toLocaleString('en-IN')} BV`;
const formatINR = (value: number | null | undefined) =>
  `₹${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TYPE_LABEL: Record<BVTransactionItem['type'], string> = {
  GENERATION: 'Generated',
  TRANSFER: 'Transfer',
  REVERSAL: 'Reversal',
  WELCOME_BONUS: 'Welcome bonus',
  PURCHASE: 'Order payment',
  PURCHASE_REFUND: 'Order refund',
  BINARY_ACTIVATION: 'Binary activation',
  RETURN_REQUESTED: 'Return requested',
  RETURN_APPROVED: 'Return to company',
  RETURN_RELEASED: 'Return released',
};
const formatDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const newRequestKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `bv-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

const readStoredOperator = () => {
  try {
    return localStorage.getItem(OPERATOR_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const storeOperator = (name: string) => {
  try {
    localStorage.setItem(OPERATOR_STORAGE_KEY, name);
  } catch {
    // Per-browser convenience only
  }
};

const STATUS_STYLE: Record<BVTransactionStatus, { label: string }> = {
  COMPLETED: { label: 'Completed' },
  REVERSED: { label: 'Reversed' },
};

const StatusPill: React.FC<{ status: BVTransactionStatus }> = ({ status }) => (
  <StatusBadge status={status === 'REVERSED' ? 'REJECTED' : 'COMPLETED'} label={status === 'REVERSED' ? 'Reversed' : 'Completed'} />
);

// Matches .form-input; kept as an object because several fields extend it inline
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--fs-md)',
  outline: 'none',
  background: 'var(--surface)',
  minHeight: 'var(--control-h)',
};

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div style={{ marginBottom: 'var(--space-4)' }}>
    <SharedField label={label} hint={hint}>{children}</SharedField>
  </div>
);

const Banner: React.FC<{ kind: 'error' | 'success'; text: string; onClose?: () => void }> = ({ kind, text, onClose }) => (
  <Alert tone={kind} onClose={onClose}>{text}</Alert>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <SharedModal title={title} onClose={onClose} size="sm">{children}</SharedModal>
);

const KpiCard: React.FC<{ tone: 'green' | 'gold' | 'blue' | 'purple'; icon: React.ReactNode; label: string; value: string; sub?: string; valueColor?: string }> = ({
  tone,
  icon,
  label,
  value,
  sub,
  valueColor,
}) => (
  <div className={`kpi-card kpi-card-${tone}`}>
    <div className={`kpi-icon-box kpi-icon-${tone}`}>{icon}</div>
    <div className="kpi-content">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={valueColor?.includes('danger') ? { color: valueColor } : undefined}>
        {value}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  </div>
);

export const BVWalletPage: React.FC<BVWalletPageProps> = ({ user, token, initialSection }) => {
  const isAdmin = user?.role?.toLowerCase() === 'superadmin';
  const authToken = token || undefined;

  const [section, setSection] = useState<Section>(initialSection || 'send');
  const [wallet, setWallet] = useState<BVWalletSummary | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (initialSection) setSection(initialSection);
  }, [initialSection]);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    try {
      const [w, o] = await Promise.all([
        api.getBVWallet(authToken),
        isAdmin ? api.getBVAdminOverview(authToken) : Promise.resolve(null),
      ]);
      if (w?.status) setWallet(w.data);
      if (o?.status) setOverview(o.data);
    } catch {
      // Cards keep their last values; sections show their own errors
    } finally {
      setLoading(false);
    }
  }, [authToken, isAdmin]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet, refreshKey]);

  const refreshAll = () => setRefreshKey((k) => k + 1);

  const sections: Array<{ id: Section; label: string; icon: React.ElementType }> = [
    { id: 'send', label: isAdmin ? 'Sell BV' : 'Send BV', icon: Send },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'returns', label: isAdmin ? 'Return requests' : 'Return BV', icon: RotateCcw },
    ...(isAdmin ? [{ id: 'generate' as Section, label: 'Generate BV', icon: PlusCircle }] : []),
  ];
  const bonusBV = wallet?.bonusBV || 0;

  return (
    <div className="page-body">
      <div className="welcome-header">
        <div>
          <h1 className="page-title">{isAdmin ? 'BV Wallet (Super Admin)' : 'My BV Wallet'}</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Generate BV, sell it to members at the BV rate, handle return requests, and audit or reverse transactions.'
              : 'Send BV to other members, pay for products and packages, return BV you bought, and track everything you sent and received.'}
          </p>
        </div>
        <button type="button" onClick={refreshAll} className="btn btn-sm btn-secondary" title="Refresh">
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {wallet?.isFrozen && (
        <Banner kind="error" text={`Your BV wallet is frozen${wallet.frozenReason ? `: ${wallet.frozenReason}` : ''}. You can still receive BV but cannot send it.`} />
      )}

      <div className="kpi-grid">
        <KpiCard
          tone="green"
          icon={<Wallet size={20} />}
          label="Available"
          value={formatBV(wallet?.availableBV)}
          sub={
            isAdmin
              ? 'Ready to sell'
              : bonusBV > 0
                ? `${formatBV(wallet?.sendableBV)} can be sent · ${formatBV(bonusBV)} bonus for orders only`
                : 'Ready to send'
          }
        />
        {isAdmin ? (
          <>
            <KpiCard
              tone="purple"
              icon={<Sparkles size={20} />}
              label="Total generated"
              value={formatBV(overview?.totalGenerated)}
              valueColor="var(--accent)"
              sub={`${formatBV(overview?.memberCirculationBV)} with ${overview?.memberHolders || 0} member(s)`}
            />
            <KpiCard
              tone="gold"
              icon={<IndianRupee size={20} />}
              label="Sold to members"
              value={formatBV(wallet?.totalSold)}
              valueColor="var(--warning)"
              sub={`${formatBV(wallet?.totalReceived)} returned by members`}
            />
            <KpiCard
              tone="blue"
              icon={overview?.reconciliation.ok === false ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
              label="Balance check"
              value={overview ? (overview.reconciliation.ok ? 'Balanced' : 'Mismatch') : '—'}
              valueColor={overview?.reconciliation.ok === false ? 'var(--danger)' : 'var(--primary)'}
              sub="All wallets vs. BV generated"
            />
          </>
        ) : (
          <>
            <KpiCard
              tone="blue"
              icon={<ArrowDownLeft size={20} />}
              label="Received"
              value={formatBV(wallet?.totalReceived)}
              valueColor="var(--primary)"
              sub={`${formatBV(wallet?.totalSent)} sent to others`}
            />
            <KpiCard
              tone="gold"
              icon={<Gift size={20} />}
              label="Welcome bonus"
              value={formatBV(wallet?.totalWelcomeBonus)}
              valueColor="var(--warning)"
              sub={`${formatBV(bonusBV)} unused · for your own orders only`}
            />
            <KpiCard tone="purple" icon={<ShoppingCart size={20} />} label="Spent on orders" value={formatBV(wallet?.totalSpent)} valueColor="var(--accent)" sub="Products & packages paid with BV" />
            {(wallet?.totalActivationLocked || 0) > 0 && (
              <KpiCard
                tone="gold"
                icon={<Layers size={20} />}
                label="Locked for binary"
                value={formatBV(wallet?.totalActivationLocked)}
                valueColor="var(--warning-hover)"
                sub="Used once in binary income; cannot be sent or spent"
              />
            )}
          </>
        )}
      </div>

      {isAdmin && overview && !overview.reconciliation.ok && (
        <Banner kind="error" text={`Balance check found ${overview.reconciliation.issues.length} issue(s): ${overview.reconciliation.issues.slice(0, 3).join(' ')}`} />
      )}

      <div role="tablist" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {sections.map(({ id, label, icon: Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSection(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--fs-base)',
                fontWeight: 700,
                cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`,
                background: active ? 'var(--primary-light)' : 'var(--surface)',
                color: active ? 'var(--primary-hover)' : 'var(--text-secondary)',
              }}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {section === 'send' && <SendSection token={authToken} isAdmin={isAdmin} wallet={wallet} onChange={refreshAll} />}
      {section === 'history' && <HistorySection token={authToken} isAdmin={isAdmin} refreshKey={refreshKey} onChange={refreshAll} />}
      {section === 'returns' &&
        (isAdmin ? (
          <AdminReturnsSection token={authToken} refreshKey={refreshKey} onChange={refreshAll} />
        ) : (
          <MemberReturnsSection token={authToken} wallet={wallet} refreshKey={refreshKey} onChange={refreshAll} />
        ))}
      {section === 'generate' && isAdmin && <GenerateSection token={authToken} wallet={wallet} onChange={refreshAll} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Send BV (instant)
// ---------------------------------------------------------------------------

const SendSection: React.FC<{
  token?: string;
  isAdmin: boolean;
  wallet: BVWalletSummary | null;
  onChange: () => void;
}> = ({ token, isAdmin, wallet, onChange }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BVRecipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [recipient, setRecipient] = useState<BVRecipient | null>(null);
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [operatorName, setOperatorName] = useState(readStoredOperator);
  const [requestKey, setRequestKey] = useState(newRequestKey);
  const [confirming, setConfirming] = useState(false);
  const [repeatWarning, setRepeatWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  // Super Admin transfers are sales at the current BV rate
  const [rate, setRate] = useState<BVRateInfo | null>(null);
  const [rateLoaded, setRateLoaded] = useState(!isAdmin);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .getBVRate(token)
      .then((res) => setRate(res?.status ? res.data || null : null))
      .catch(() => setRate(null))
      .finally(() => setRateLoaded(true));
  }, [isAdmin, token]);

  // Debounced member search
  useEffect(() => {
    const q = query.trim();
    setSearchError('');
    if (q.length < 3) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      setSearching(true);
      api
        .searchBVRecipients(q, token)
        .then((res: any) => {
          if (res?.status) setResults(res.data || []);
          else setSearchError(res?.message || 'Search failed.');
        })
        .catch(() => setSearchError('Search failed.'))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [query, token]);

  const amountNumber = Number(amount);
  const maxTransfer = wallet?.limits.maxTransferBV || 0;
  // Members can only send regular BV; welcome bonus BV pays for their own orders
  const sendable = wallet ? (wallet.sendableBV ?? wallet.availableBV) : 0;
  const saleValue = rate && Number.isInteger(amountNumber) && amountNumber > 0 ? (amountNumber * rate.ratePaise) / 100 : 0;
  const validationError = useMemo(() => {
    if (isAdmin && rateLoaded && !rate) return 'Set the BV rate in Company Earnings before selling BV.';
    if (!recipient) return 'Select a recipient.';
    if (!amount || !Number.isInteger(amountNumber) || amountNumber < 1) return 'Enter a whole number of BV.';
    if (wallet && amountNumber > sendable) {
      return wallet.bonusBV > 0 && !isAdmin
        ? `You can send up to ${formatBV(sendable)}. ${formatBV(wallet.bonusBV)} is welcome bonus BV, which can only be used for your own orders.`
        : `You only have ${formatBV(sendable)} available.`;
    }
    if (maxTransfer && amountNumber > maxTransfer) return `Maximum per transfer is ${formatBV(maxTransfer)}.`;
    if (!title.trim()) return 'Enter a title.';
    if (isAdmin && !operatorName.trim()) return 'Enter your name as operator.';
    return '';
  }, [recipient, amount, amountNumber, wallet, sendable, maxTransfer, title, isAdmin, operatorName, rate, rateLoaded]);

  const resetForm = () => {
    setRecipient(null);
    setQuery('');
    setResults([]);
    setAmount('');
    setTitle('');
    setNote('');
    setRequestKey(newRequestKey());
  };

  const submit = async (confirmRepeat = false) => {
    if (!recipient || validationError) return;
    setSubmitting(true);
    setMessage(null);
    try {
      if (isAdmin) storeOperator(operatorName.trim());
      const res = await api.sendBVTransfer(
        {
          recipientId: recipient.memberId,
          amount: amountNumber,
          title: title.trim(),
          note: note.trim(),
          requestKey,
          confirmRepeat,
          ...(isAdmin ? { operatorName: operatorName.trim() } : {}),
        },
        token
      );
      if (res?.possibleDuplicate) {
        // Nothing was sent; ask before sending the same amount to the same person again
        setConfirming(false);
        setRepeatWarning(res.message);
        return;
      }
      setConfirming(false);
      setRepeatWarning('');
      if (res?.status) {
        setMessage({ kind: 'success', text: `${res.message} Your balance: ${formatBV(res.data?.availableBV)}.` });
        resetForm();
        onChange();
      } else {
        setMessage({ kind: 'error', text: res?.message || 'Transfer failed.' });
      }
    } catch {
      // Keep the same request key so a retry cannot send twice
      setMessage({ kind: 'error', text: 'Network error. Check your history before retrying; a retry will not send twice.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-card">
      <div className="card-header-row" style={{ marginBottom: '12px' }}>
        <h2 className="card-title">{isAdmin ? 'Sell BV to a member' : 'Send BV'}</h2>
      </div>
      {message && <Banner kind={message.kind} text={message.text} onClose={() => setMessage(null)} />}
      {isAdmin && rateLoaded && (
        rate ? (
          <Alert tone="info" style={{ marginBottom: '16px' }}>
            BV rate: <strong>{formatINR(rate.rate)} per BV</strong>. Every BV you send is added to Super Admin earnings at this rate.
          </Alert>
        ) : (
          <Alert tone="warning" style={{ marginBottom: '16px' }} title="No BV rate set">
            Set the BV rate in Company Earnings before selling BV to members.
          </Alert>
        )
      )}
      {!isAdmin && (
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 0 }}>
          To give BV you bought back to the company, use <strong>Return BV</strong>.
        </p>
      )}

      {!recipient ? (
        <>
          <Field label="Find member" hint="Search by Member ID, name, phone number or email.">
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-light)' }} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. MEM0012, Asha, 9876543210"
                style={{ ...inputStyle, paddingLeft: '36px' }}
                aria-label="Search member"
              />
            </div>
            {searching && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '8px' }}>Searching…</div>}
            {searchError && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--danger-hover)', marginTop: '8px' }}>{searchError}</div>}
            {!searching && query.trim().length >= 3 && results.length === 0 && !searchError && (
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '8px' }}>No active member matches.</div>
            )}
            {results.length > 0 && (
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginTop: '8px', overflow: 'hidden' }}>
                {results.map((m) => (
                  <button
                    key={m.memberId}
                    type="button"
                    onClick={() => setRecipient(m)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--surface)',
                      border: 'none',
                      borderBottom: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      gap: '10px',
                    }}
                  >
                    <span>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 'var(--fs-base)' }}>{m.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}> · {m.memberId}</span>
                    </span>
                    <span style={{ color: 'var(--text-light)', fontSize: 'var(--fs-xs)' }}>{m.mobile}</span>
                  </button>
                ))}
              </div>
            )}
          </Field>
        </>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              background: 'var(--success-light)',
              border: '1.5px solid var(--success-border)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '16px',
            }}
          >
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--success-hover)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recipient</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)' }}>{recipient.name}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                {[recipient.memberId, recipient.mobile, recipient.email].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setRecipient(null)}>
              Change
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 16px' }}>
            <Field
              label="Amount (BV)"
              hint={
                wallet
                  ? isAdmin || !wallet.bonusBV
                    ? `Available: ${formatBV(sendable)}`
                    : `Can be sent: ${formatBV(sendable)} (${formatBV(wallet.bonusBV)} welcome bonus is for your own orders)`
                  : undefined
              }
            >
              <input type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} placeholder="e.g. 2000" />
            </Field>
            <Field label="Title">
              <input type="text" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder={isAdmin ? 'e.g. BV purchase' : 'e.g. For your order'} />
            </Field>
          </div>
          {isAdmin && rate && saleValue > 0 && (
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-body)', marginBottom: '12px' }}>
              {formatBV(amountNumber)} × {formatINR(rate.rate)} = <strong>{formatINR(saleValue)}</strong> will be added to Super Admin earnings.
            </div>
          )}
          <Field label="Note (optional)">
            <textarea maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          {isAdmin && (
            <Field label="Operator name" hint="Who is making this transfer on the shared Super Admin account.">
              <input type="text" maxLength={60} value={operatorName} onChange={(e) => setOperatorName(e.target.value)} style={inputStyle} />
            </Field>
          )}
          {validationError && amount && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--warning-hover)', marginBottom: '10px' }}>{validationError}</div>}
          <button type="button" className="btn btn-primary" disabled={!!validationError || !!wallet?.isFrozen} onClick={() => setConfirming(true)}>
            <Send size={14} />
            <span>Review transfer</span>
          </button>
        </>
      )}

      {confirming && recipient && (
        <Modal title="Confirm BV transfer" onClose={() => !submitting && setConfirming(false)}>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--text-body)', lineHeight: 1.6 }}>
            Send <strong>{formatBV(amountNumber)}</strong> to <strong>{recipient.name}</strong> ({recipient.memberId})?
            {isAdmin && rate && (
              <div style={{ marginTop: '8px' }}>
                Sale value: <strong>{formatINR(saleValue)}</strong> at {formatINR(rate.rate)} per BV, added to Super Admin earnings.
              </div>
            )}
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--danger-hover)', fontWeight: 600, marginTop: '8px' }}>
              The BV is credited immediately and this cannot be undone. Check the name and amount.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px' }}>
            <button type="button" className="btn btn-sm btn-secondary" disabled={submitting} onClick={() => setConfirming(false)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => submit(false)}>
              {submitting ? 'Sending…' : 'Send now'}
            </button>
          </div>
        </Modal>
      )}

      {repeatWarning && recipient && (
        <Modal title="Send again?" onClose={() => !submitting && setRepeatWarning('')}>
          <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-body)', marginTop: 0 }}>{repeatWarning}</p>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Nothing has been sent yet. Only continue if you really mean to send this twice.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px' }}>
            <button type="button" className="btn btn-sm btn-secondary" disabled={submitting} onClick={() => setRepeatWarning('')}>
              Don't send
            </button>
            <button type="button" className="btn btn-sm btn-danger-outline" disabled={submitting} onClick={() => submit(true)}>
              {submitting ? 'Sending…' : 'Yes, send again'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Transaction history (+ admin reversal)
// ---------------------------------------------------------------------------

const HistorySection: React.FC<{ token?: string; isAdmin: boolean; refreshKey: number; onChange: () => void }> = ({
  token,
  isAdmin,
  refreshKey,
  onChange,
}) => {
  const [scope, setScope] = useState<'mine' | 'all'>(isAdmin ? 'all' : 'mine');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [direction, setDirection] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BVTransactionItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [reversing, setReversing] = useState<BVTransactionItem | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setPage(1);
  }, [scope, type, status, direction, search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const request =
        scope === 'all'
          ? api.getAllBVTransactions({ type, status, search: search.trim(), page, limit: 20 }, token)
          : api.getBVTransactions({ type, status, direction, page, limit: 20 }, token);
      request
        .then((res: any) => {
          if (res?.status) {
            setItems(res.data || []);
            setTotalPages(res.totalPages || 1);
            setTotal(res.total || 0);
            setError('');
          } else {
            setError(res?.message || 'Could not load history.');
          }
        })
        .catch(() => setError('Could not load history.'));
    }, search ? 300 : 0);
    return () => clearTimeout(handle);
  }, [scope, type, status, direction, search, page, token, refreshKey]);

  const selectStyle: React.CSSProperties = { ...inputStyle, width: 'auto', padding: '8px 10px', fontSize: 'var(--fs-base)' };
  const canReverse = (t: BVTransactionItem) => isAdmin && t.type === 'TRANSFER' && t.status === 'COMPLETED';

  return (
    <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-subtle)' }}>
        {isAdmin && (
          <select value={scope} onChange={(e) => setScope(e.target.value as 'mine' | 'all')} style={selectStyle} aria-label="Scope">
            <option value="all">All transactions</option>
            <option value="mine">Super Admin wallet</option>
          </select>
        )}
        <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle} aria-label="Type">
          <option value="">All types</option>
          {isAdmin && <option value="GENERATION">Generation</option>}
          <option value="TRANSFER">Transfer</option>
          <option value="REVERSAL">Reversal</option>
          <option value="WELCOME_BONUS">Welcome bonus</option>
          <option value="PURCHASE">Order payment</option>
          <option value="PURCHASE_REFUND">Order refund</option>
          <option value="BINARY_ACTIVATION">Binary activation</option>
          <option value="RETURN_REQUESTED">Return requested</option>
          <option value="RETURN_APPROVED">Return to company</option>
          <option value="RETURN_RELEASED">Return released</option>
        </select>
        {scope === 'mine' && (
          <select value={direction} onChange={(e) => setDirection(e.target.value)} style={selectStyle} aria-label="Direction">
            <option value="">Sent & received</option>
            {isAdmin && <option value="GENERATED">Generated</option>}
            <option value="SENT">Sent</option>
            <option value="RECEIVED">Received</option>
          </select>
        )}
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle} aria-label="Status">
          <option value="">All statuses</option>
          {(Object.keys(STATUS_STYLE) as BVTransactionStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_STYLE[s].label}
            </option>
          ))}
        </select>
        {scope === 'all' && (
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Transaction ID, member, title"
            style={{ ...inputStyle, width: 'auto', flex: '1 1 200px', padding: '8px 10px', fontSize: 'var(--fs-base)' }}
            aria-label="Search transactions"
          />
        )}
        <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{total} record(s)</span>
      </div>

      {(error || message) && (
        <div style={{ padding: '12px 16px 0' }}>
          {error && <Banner kind="error" text={error} />}
          {message && <Banner kind="success" text={message} onClose={() => setMessage('')} />}
        </div>
      )}

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Type</th>
              <th>From → To</th>
              <th style={{ textAlign: 'right' }}>BV</th>
              <th>Title / note</th>
              <th>Date</th>
              <th>Status</th>
              {isAdmin && <th />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-light)' }}>
                  No transactions yet.
                </td>
              </tr>
            ) : (
              items.map((t) => {
                const outgoing = t.direction === 'SENT';
                const sign = t.direction ? (outgoing ? '−' : '+') : '';
                const typeLabel =
                  t.type === 'TRANSFER' ? (outgoing ? 'Sent' : t.direction === 'RECEIVED' ? 'Received' : 'Transfer') : TYPE_LABEL[t.type] || t.type;
                const TypeIcon =
                  t.type === 'GENERATION'
                    ? Layers
                    : t.type === 'REVERSAL'
                      ? Undo2
                      : t.type === 'WELCOME_BONUS'
                        ? Gift
                        : t.type === 'PURCHASE' || t.type === 'PURCHASE_REFUND'
                          ? ShoppingCart
                          : t.type === 'RETURN_REQUESTED' || t.type === 'RETURN_APPROVED' || t.type === 'RETURN_RELEASED'
                            ? RotateCcw
                            : outgoing
                            ? ArrowUpRight
                            : ArrowDownLeft;
                return (
                  <tr key={t.transactionId}>
                    <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{t.transactionId}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                        <TypeIcon size={13} />
                        {typeLabel}
                      </span>
                    </td>
                    <td>
                      <div>
                        {t.sender.name} <span style={{ color: 'var(--text-light)' }}>({t.sender.id})</span>
                      </div>
                      {t.recipient && (
                        <div style={{ color: 'var(--text-secondary)' }}>
                          → {t.recipient.name} <span style={{ color: 'var(--text-light)' }}>({t.recipient.id})</span>
                        </div>
                      )}
                      {t.initiatedBy?.operatorName && <div style={{ color: 'var(--text-light)', fontSize: 'var(--fs-xs)' }}>Operator: {t.initiatedBy.operatorName}</div>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: outgoing ? 'var(--danger-hover)' : 'var(--success-hover)', whiteSpace: 'nowrap' }}>
                      {sign}
                      {t.amount.toLocaleString('en-IN')}
                      {typeof t.value === 'number' && (
                        <div style={{ fontWeight: 600, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                          {formatINR(t.value)}
                          {typeof t.rate === 'number' ? ` @ ${formatINR(t.rate)}` : ''}
                        </div>
                      )}
                      {!!t.bonusAmount && t.type !== 'WELCOME_BONUS' && (
                        <div style={{ fontWeight: 600, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{t.bonusAmount.toLocaleString('en-IN')} bonus BV</div>
                      )}
                    </td>
                    <td style={{ maxWidth: '240px' }}>
                      <div style={{ fontWeight: 600 }}>{t.title}</div>
                      {t.note && <div style={{ color: 'var(--text-muted)' }}>{t.note}</div>}
                      {t.reversedBy && (
                        <div style={{ color: 'var(--danger-hover)', fontSize: 'var(--fs-xs)', marginTop: '2px' }}>
                          Reversed by {t.reversedBy}
                          {t.reversalReason ? `: ${t.reversalReason}` : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(t.createdAt)}</td>
                    <td>
                      <StatusPill status={t.status} />
                    </td>
                    {isAdmin && (
                      <td>
                        {canReverse(t) && (
                          <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => setReversing(t)}>
                            <Undo2 size={12} />
                            <span>Reverse</span>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', padding: '12px 16px' }}>
          <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <button type="button" className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}

      {reversing && (
        <ReverseModal
          token={token}
          transfer={reversing}
          onClose={() => setReversing(null)}
          onDone={(text) => {
            setReversing(null);
            setMessage(text);
            onChange();
          }}
        />
      )}
    </div>
  );
};

const ReverseModal: React.FC<{ token?: string; transfer: BVTransactionItem; onClose: () => void; onDone: (message: string) => void }> = ({
  token,
  transfer,
  onClose,
  onDone,
}) => {
  const [reason, setReason] = useState('');
  const [operatorName, setOperatorName] = useState(readStoredOperator);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      storeOperator(operatorName.trim());
      const res = await api.reverseBVTransfer(transfer.transactionId, { reason: reason.trim(), operatorName: operatorName.trim(), password }, token);
      setPassword('');
      if (res?.status) onDone(res.message);
      else setError(res?.message || 'Reversal failed.');
    } catch {
      setError('Network error. Check the history before retrying.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Reverse transfer" onClose={() => !submitting && onClose()}>
      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-body)', marginTop: 0 }}>
        Move <strong>{formatBV(transfer.amount)}</strong> back from <strong>{transfer.recipient?.name}</strong> ({transfer.recipient?.id}) to{' '}
        <strong>{transfer.sender.name}</strong> ({transfer.sender.id}). This creates a new reversal transaction and can only be done once.
        {typeof transfer.value === 'number' && (
          <>
            {' '}
            The sale value of <strong>{formatINR(transfer.value)}</strong> is taken back out of Super Admin earnings.
          </>
        )}
      </p>
      {error && <Banner kind="error" text={error} />}
      <Field label="Reason">
        <textarea maxLength={500} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. Sent to the wrong member" />
      </Field>
      <Field label="Operator name">
        <input type="text" maxLength={60} value={operatorName} onChange={(e) => setOperatorName(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Super Admin password">
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
      </Field>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-sm btn-secondary" disabled={submitting} onClick={onClose}>
          Back
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={submitting || !reason.trim() || !operatorName.trim() || !password}
          onClick={submit}
        >
          {submitting ? 'Reversing…' : 'Reverse transfer'}
        </button>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Returns to the company
// ---------------------------------------------------------------------------

const ReturnStatus: React.FC<{ status: BVReturnRequestItem['status'] }> = ({ status }) => <StatusBadge status={status} />;

const Pagination: React.FC<{ page: number; totalPages: number; onPage: (page: number) => void }> = ({ page, totalPages, onPage }) =>
  totalPages > 1 ? (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', padding: '12px 16px' }}>
      <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
        Page {page} of {totalPages}
      </span>
      <button type="button" className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  ) : null;

/** Member: return BV bought from the Super Admin, and follow its own requests. */
const MemberReturnsSection: React.FC<{ token?: string; wallet: BVWalletSummary | null; refreshKey: number; onChange: () => void }> = ({
  token,
  wallet,
  refreshKey,
  onChange,
}) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [requestKey, setRequestKey] = useState(newRequestKey);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [items, setItems] = useState<BVReturnRequestItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cancelling, setCancelling] = useState('');

  useEffect(() => {
    api
      .getMyBVReturns({ page, limit: 10 }, token)
      .then((res: any) => {
        if (res?.status) {
          setItems(res.data || []);
          setTotalPages(res.totalPages || 1);
        }
      })
      .catch(() => {});
  }, [token, page, refreshKey]);

  const capacity = wallet?.returns;
  const returnable = capacity?.returnableBV || 0;
  const amountNumber = Number(amount);
  // Same average-price rule as the server; the last BV takes the exact remainder
  const estimate =
    capacity && Number.isInteger(amountNumber) && amountNumber > 0
      ? amountNumber >= returnable
        ? capacity.returnableValue
        : Math.round(amountNumber * capacity.valuePerBV * 100) / 100
      : 0;
  const validationError =
    !amount || !Number.isInteger(amountNumber) || amountNumber < 1
      ? 'Enter a whole number of BV.'
      : amountNumber > returnable
        ? `You can return up to ${formatBV(returnable)}.`
        : '';

  const submit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await api.requestBVReturn({ amount: amountNumber, note: note.trim(), requestKey }, token);
      setConfirming(false);
      if (res?.status) {
        setMessage({ kind: 'success', text: res.message });
        setAmount('');
        setNote('');
        setRequestKey(newRequestKey());
        setPage(1);
        onChange();
      } else {
        setMessage({ kind: 'error', text: res?.message || 'Return request failed.' });
      }
    } catch {
      // Keep the same request key so a retry cannot file twice
      setConfirming(false);
      setMessage({ kind: 'error', text: 'Network error. Check your requests below before retrying; a retry will not file twice.' });
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (requestId: string) => {
    setCancelling(requestId);
    setMessage(null);
    try {
      const res = await api.cancelBVReturn(requestId, token);
      setMessage({ kind: res?.status ? 'success' : 'error', text: res?.message || 'Could not cancel.' });
      if (res?.status) onChange();
    } catch {
      setMessage({ kind: 'error', text: 'Network error. Please try again.' });
    } finally {
      setCancelling('');
    }
  };

  return (
    <>
      <div className="dashboard-card" style={{ maxWidth: '640px' }}>
        <div className="card-header-row" style={{ marginBottom: '12px' }}>
          <h2 className="card-title">Return BV to the company</h2>
        </div>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 0 }}>
          You can return BV you bought from the company, at the average price you paid. Welcome bonus BV and BV received from other members
          cannot be returned. The BV is held until the Super Admin approves your request and refunds you.
        </p>
        {message && <Banner kind={message.kind} text={message.text} onClose={() => setMessage(null)} />}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Returnable now</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800 }}>{formatBV(returnable)}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Worth {formatINR(capacity?.returnableValue)}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Bought from company</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800 }}>{formatBV(capacity?.purchasedBV)}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Paid {formatINR(capacity?.purchasedValue)}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Returned / pending</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800 }}>
              {formatBV(capacity?.returnedBV)} / {formatBV(capacity?.pendingReturnBV)}
            </div>
          </div>
        </div>

        {returnable > 0 ? (
          <>
            <Field label="BV to return" hint={capacity ? `Average price: ${formatINR(capacity.valuePerBV)} per BV` : undefined}>
              <input type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} placeholder={`Up to ${returnable}`} />
            </Field>
            <Field label="Note (optional)">
              <textarea maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. Refund to my UPI ID" />
            </Field>
            {amount && validationError && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--warning-hover)', marginBottom: '10px' }}>{validationError}</div>}
            {amount && !validationError && (
              <div style={{ fontSize: 'var(--fs-base)', marginBottom: '12px' }}>
                Refund value: <strong>{amountNumber < returnable ? '≈ ' : ''}{formatINR(estimate)}</strong>
              </div>
            )}
            <button type="button" className="btn btn-primary" disabled={!!validationError || !!wallet?.isFrozen} onClick={() => setConfirming(true)}>
              <RotateCcw size={14} />
              <span>Review return</span>
            </button>
          </>
        ) : (
          <Alert tone="info">You have no BV to return.</Alert>
        )}
      </div>

      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header-row" style={{ padding: '14px 16px', margin: 0, borderBottom: '1px solid var(--border-color)' }}>
          <h2 className="card-title">My return requests</h2>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Request</th>
                <th style={{ textAlign: 'right' }}>BV</th>
                <th style={{ textAlign: 'right' }}>Refund value</th>
                <th>Requested</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-light)' }}>
                    No return requests yet.
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr key={r.requestId}>
                    <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                      {r.requestId}
                      {r.note && <div style={{ fontFamily: 'inherit', color: 'var(--text-muted)' }}>{r.note}</div>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.amount.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right' }}>{formatINR(r.value)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.createdAt)}</td>
                    <td>
                      <ReturnStatus status={r.status} />
                      {r.decisionReason && r.status === 'REJECTED' && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginTop: '2px' }}>{r.decisionReason}</div>
                      )}
                    </td>
                    <td>
                      {r.status === 'PENDING' && (
                        <button type="button" className="btn btn-sm btn-secondary" disabled={cancelling === r.requestId} onClick={() => cancel(r.requestId)}>
                          {cancelling === r.requestId ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </div>

      {confirming && (
        <Modal title="Confirm BV return" onClose={() => !submitting && setConfirming(false)}>
          <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-body)', marginTop: 0 }}>
            Return <strong>{formatBV(amountNumber)}</strong> to the company for <strong>{amountNumber < returnable ? 'about ' : ''}{formatINR(estimate)}</strong>?
          </p>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            The BV is held from your wallet now. If the Super Admin rejects the request, or you cancel it, the BV comes back.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px' }}>
            <button type="button" className="btn btn-sm btn-secondary" disabled={submitting} onClick={() => setConfirming(false)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" disabled={submitting} onClick={submit}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};

/** Super Admin: approve (after refunding outside the app) or reject members' return requests. */
const AdminReturnsSection: React.FC<{ token?: string; refreshKey: number; onChange: () => void }> = ({ token, refreshKey, onChange }) => {
  const [status, setStatus] = useState<'' | BVReturnRequestItem['status']>('PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BVReturnRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [acting, setActing] = useState<{ request: BVReturnRequestItem; action: 'approve' | 'reject' } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [status, search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      api
        .getAllBVReturns({ status, search: search.trim(), page, limit: 20 }, token)
        .then((res: any) => {
          if (res?.status) {
            setItems(res.data || []);
            setTotal(res.total || 0);
            setTotalPages(res.totalPages || 1);
            setError('');
          } else {
            setError(res?.message || 'Could not load return requests.');
          }
        })
        .catch(() => setError('Could not load return requests.'));
    }, search ? 300 : 0);
    return () => clearTimeout(handle);
  }, [status, search, page, token, refreshKey]);

  const selectStyle: React.CSSProperties = { ...inputStyle, width: 'auto', padding: '8px 10px', fontSize: 'var(--fs-base)' };

  return (
    <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-subtle)' }}>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} style={selectStyle} aria-label="Status">
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="">All statuses</option>
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Request ID, member"
          style={{ ...inputStyle, width: 'auto', flex: '1 1 200px', padding: '8px 10px', fontSize: 'var(--fs-base)' }}
          aria-label="Search return requests"
        />
        <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{total} request(s)</span>
      </div>
      <div style={{ padding: '12px 16px 0' }}>
        <Alert tone="info">
          Refund the member outside the app first, then approve. Approving moves the BV to the Super Admin wallet and deducts the refund value from earnings.
        </Alert>
        {error && <Banner kind="error" text={error} />}
        {message && <Banner kind="success" text={message} onClose={() => setMessage('')} />}
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Member</th>
              <th style={{ textAlign: 'right' }}>BV</th>
              <th style={{ textAlign: 'right' }}>Refund value</th>
              <th>Requested</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-light)' }}>
                  No return requests.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.requestId}>
                  <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    {r.requestId}
                    {r.note && <div style={{ fontFamily: 'inherit', color: 'var(--text-muted)' }}>{r.note}</div>}
                  </td>
                  <td>
                    {r.memberName} <span style={{ color: 'var(--text-light)' }}>({r.memberId})</span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.amount.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right' }}>
                    {formatINR(r.value)}
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>@ {formatINR(r.valuePerBV)}</div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.createdAt)}</td>
                  <td>
                    <ReturnStatus status={r.status} />
                    {r.status !== 'PENDING' && (r.decidedBy?.operatorName || r.decisionReason) && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginTop: '2px' }}>
                        {[r.decidedBy?.operatorName, r.decisionReason].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {r.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => setActing({ request: r, action: 'approve' })}>
                          Approve
                        </button>
                        <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => setActing({ request: r, action: 'reject' })}>
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      {acting && (
        <ReturnDecisionModal
          token={token}
          request={acting.request}
          action={acting.action}
          onClose={() => setActing(null)}
          onDone={(text) => {
            setActing(null);
            setMessage(text);
            onChange();
          }}
        />
      )}
    </div>
  );
};

const ReturnDecisionModal: React.FC<{
  token?: string;
  request: BVReturnRequestItem;
  action: 'approve' | 'reject';
  onClose: () => void;
  onDone: (message: string) => void;
}> = ({ token, request, action, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [operatorName, setOperatorName] = useState(readStoredOperator);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const approving = action === 'approve';

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      storeOperator(operatorName.trim());
      const res = approving
        ? await api.approveBVReturn(request.requestId, { operatorName: operatorName.trim(), password }, token)
        : await api.rejectBVReturn(request.requestId, { reason: reason.trim(), operatorName: operatorName.trim() }, token);
      setPassword('');
      if (res?.status) onDone(res.message);
      else setError(res?.message || 'Action failed.');
    } catch {
      setError('Network error. Check the request status before retrying.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={approving ? 'Approve return' : 'Reject return'} onClose={() => !submitting && onClose()}>
      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-body)', marginTop: 0 }}>
        {approving ? (
          <>
            Confirm you have refunded <strong>{formatINR(request.value)}</strong> to <strong>{request.memberName}</strong> ({request.memberId}).{' '}
            {formatBV(request.amount)} moves to the Super Admin wallet and {formatINR(request.value)} is deducted from earnings.
          </>
        ) : (
          <>
            {formatBV(request.amount)} goes back to <strong>{request.memberName}</strong> ({request.memberId}). Earnings do not change.
          </>
        )}
      </p>
      {error && <Banner kind="error" text={error} />}
      {!approving && (
        <Field label="Reason">
          <textarea maxLength={500} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Shown to the member" />
        </Field>
      )}
      <Field label="Operator name">
        <input type="text" maxLength={60} value={operatorName} onChange={(e) => setOperatorName(e.target.value)} style={inputStyle} />
      </Field>
      {approving && (
        <Field label="Super Admin password">
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        </Field>
      )}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-sm btn-secondary" disabled={submitting} onClick={onClose}>
          Back
        </button>
        <button
          type="button"
          className={approving ? 'btn btn-primary' : 'btn btn-danger'}
          disabled={submitting || !operatorName.trim() || (approving ? !password : !reason.trim())}
          onClick={submit}
        >
          {submitting ? 'Saving…' : approving ? 'Approve return' : 'Reject return'}
        </button>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Generate BV (Super Admin)
// ---------------------------------------------------------------------------

const GenerateSection: React.FC<{ token?: string; wallet: BVWalletSummary | null; onChange: () => void }> = ({ token, wallet, onChange }) => {
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [operatorName, setOperatorName] = useState(readStoredOperator);
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const amountNumber = Number(amount);
  const maxGenerate = wallet?.limits.maxGenerateBV || 0;
  const validationError =
    !amount || !Number.isInteger(amountNumber) || amountNumber < 1
      ? 'Enter a whole number of BV.'
      : maxGenerate && amountNumber > maxGenerate
        ? `Maximum per generation is ${formatBV(maxGenerate)}.`
        : !title.trim()
          ? 'Enter a name / title.'
          : !note.trim()
            ? 'Enter a note explaining why.'
            : !operatorName.trim()
              ? 'Enter your name as operator.'
              : '';

  const submit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      storeOperator(operatorName.trim());
      const res = await api.generateBV(
        { amount: amountNumber, title: title.trim(), note: note.trim(), operatorName: operatorName.trim(), password },
        token
      );
      setPassword('');
      setConfirming(false);
      if (res?.status) {
        setMessage({ kind: 'success', text: `${res.message} Available balance: ${formatBV(res.data?.availableBV)}.` });
        setAmount('');
        setTitle('');
        setNote('');
        onChange();
      } else {
        setMessage({ kind: 'error', text: res?.message || 'Generation failed.' });
      }
    } catch {
      setMessage({ kind: 'error', text: 'Network error. Check the history before retrying.' });
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-card" style={{ maxWidth: '640px' }}>
      <div className="card-header-row" style={{ marginBottom: '12px' }}>
        <h2 className="card-title">Generate BV</h2>
      </div>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 0 }}>
        Adds BV to the Super Admin wallet. Wallet BV does not count toward personal BV, binary volume or commissions.
      </p>
      {message && <Banner kind={message.kind} text={message.text} onClose={() => setMessage(null)} />}
      <Field label="Amount (BV)">
        <input type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} placeholder="e.g. 10000" />
      </Field>
      <Field label="Name / title">
        <input type="text" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. October allocation" />
      </Field>
      <Field label="Note">
        <textarea maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Reason for generating this BV" />
      </Field>
      <Field label="Operator name" hint="Who is generating on the shared Super Admin account.">
        <input type="text" maxLength={60} value={operatorName} onChange={(e) => setOperatorName(e.target.value)} style={inputStyle} />
      </Field>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '12px' }}>The date and time are recorded automatically.</div>
      {validationError && amount && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--warning-hover)', marginBottom: '10px' }}>{validationError}</div>}
      <button type="button" className="btn btn-primary" disabled={!!validationError} onClick={() => setConfirming(true)}>
        <PlusCircle size={14} />
        <span>Generate</span>
      </button>

      {confirming && (
        <Modal title="Confirm BV generation" onClose={() => !submitting && setConfirming(false)}>
          <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-body)', marginTop: 0 }}>
            Generate <strong>{formatBV(amountNumber)}</strong> ("{title.trim()}") as <strong>{operatorName.trim()}</strong>?
          </p>
          <Field label="Super Admin password">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password && !submitting) submit();
              }}
              autoFocus
            />
          </Field>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-sm btn-secondary" disabled={submitting} onClick={() => setConfirming(false)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" disabled={submitting || !password} onClick={submit}>
              {submitting ? 'Generating…' : 'Confirm & generate'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BVWalletPage;
