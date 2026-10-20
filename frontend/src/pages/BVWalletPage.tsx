import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Layers,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Undo2,
  UserRound,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {
  api,
  type BVRecipient,
  type BVTransactionItem,
  type BVTransactionStatus,
  type BVWalletSummary,
} from '../services/api';

type Section = 'send' | 'history' | 'generate';

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
const SUPER_ADMIN_ID = 'ADMIN';

const formatBV = (value: number | undefined) => `${(value || 0).toLocaleString('en-IN')} BV`;
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

const STATUS_STYLE: Record<BVTransactionStatus, { label: string; bg: string; color: string }> = {
  COMPLETED: { label: 'Completed', bg: '#dcfce7', color: '#15803d' },
  REVERSED: { label: 'Reversed', bg: '#fee2e2', color: '#b91c1c' },
};

const StatusPill: React.FC<{ status: BVTransactionStatus }> = ({ status }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.COMPLETED;
  return (
    <span style={{ fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color, padding: '3px 9px', borderRadius: '9999px', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #cbd5e1',
  borderRadius: '10px',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#ffffff',
};

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' };

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={labelStyle}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{hint}</div>}
  </div>
);

const Banner: React.FC<{ kind: 'error' | 'success'; text: string; onClose?: () => void }> = ({ kind, text, onClose }) => (
  <div
    role={kind === 'error' ? 'alert' : 'status'}
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      padding: '10px 12px',
      borderRadius: '10px',
      marginBottom: '14px',
      fontSize: '13px',
      background: kind === 'error' ? '#fef2f2' : '#f0fdf4',
      border: `1px solid ${kind === 'error' ? '#fecaca' : '#bbf7d0'}`,
      color: kind === 'error' ? '#b91c1c' : '#15803d',
    }}
  >
    {kind === 'error' ? <XCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} /> : <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '1px' }} />}
    <span style={{ flex: 1 }}>{text}</span>
    {onClose && (
      <button type="button" onClick={onClose} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
        <X size={14} />
      </button>
    )}
  </div>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    }}
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)', overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{title}</h3>
        <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
          <X size={18} />
        </button>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  </div>
);

const ghostBtn: React.CSSProperties = { fontSize: '12px', padding: '8px 14px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' };
const dangerBtn: React.CSSProperties = { fontSize: '12px', padding: '8px 14px', background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3' };

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
      <div className="kpi-value" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{sub}</div>}
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
    { id: 'send', label: 'Send BV', icon: Send },
    { id: 'history', label: 'History', icon: Clock },
    ...(isAdmin ? [{ id: 'generate' as Section, label: 'Generate BV', icon: PlusCircle }] : []),
  ];

  return (
    <div className="page-body">
      <div className="welcome-header">
        <div>
          <h1 className="page-title">{isAdmin ? 'BV Wallet (Super Admin)' : 'My BV Wallet'}</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Generate BV, send it to members instantly, and audit or reverse transactions.'
              : 'Send BV instantly to other members or the Super Admin, and track everything you sent and received.'}
          </p>
        </div>
        <button type="button" onClick={refreshAll} className="primary-btn" style={ghostBtn} title="Refresh">
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {wallet?.isFrozen && (
        <Banner kind="error" text={`Your BV wallet is frozen${wallet.frozenReason ? `: ${wallet.frozenReason}` : ''}. You can still receive BV but cannot send it.`} />
      )}

      <div className="kpi-grid" style={{ marginBottom: '22px' }}>
        <KpiCard tone="green" icon={<Wallet size={24} />} label="Available" value={formatBV(wallet?.availableBV)} sub="Ready to send" />
        {isAdmin ? (
          <>
            <KpiCard
              tone="purple"
              icon={<Sparkles size={24} />}
              label="Total generated"
              value={formatBV(overview?.totalGenerated)}
              valueColor="#7c3aed"
              sub={`${formatBV(overview?.memberCirculationBV)} with ${overview?.memberHolders || 0} member(s)`}
            />
            <KpiCard
              tone="gold"
              icon={<ArrowDownLeft size={24} />}
              label="Received from members"
              value={formatBV(wallet?.totalReceived)}
              valueColor="#d97706"
              sub={`${formatBV(wallet?.totalSent)} sent to members`}
            />
            <KpiCard
              tone="blue"
              icon={overview?.reconciliation.ok === false ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
              label="Balance check"
              value={overview ? (overview.reconciliation.ok ? 'Balanced' : 'Mismatch') : '—'}
              valueColor={overview?.reconciliation.ok === false ? '#dc2626' : '#2563eb'}
              sub="All wallets vs. BV generated"
            />
          </>
        ) : (
          <>
            <KpiCard tone="blue" icon={<ArrowDownLeft size={24} />} label="Total received" value={formatBV(wallet?.totalReceived)} valueColor="#2563eb" />
            <KpiCard tone="purple" icon={<ArrowUpRight size={24} />} label="Total sent" value={formatBV(wallet?.totalSent)} valueColor="#7c3aed" />
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
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                border: `1.5px solid ${active ? '#2563eb' : '#e2e8f0'}`,
                background: active ? '#eff6ff' : '#ffffff',
                color: active ? '#1d4ed8' : '#475569',
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

  const chooseSuperAdmin = async () => {
    setSearchError('');
    try {
      const res = await api.getBVRecipient(SUPER_ADMIN_ID, token);
      if (res?.status) setRecipient(res.data);
      else setSearchError(res?.message || 'Super Admin is not available.');
    } catch {
      setSearchError('Super Admin is not available.');
    }
  };

  const amountNumber = Number(amount);
  const maxTransfer = wallet?.limits.maxTransferBV || 0;
  const validationError = useMemo(() => {
    if (!recipient) return 'Select a recipient.';
    if (!amount || !Number.isInteger(amountNumber) || amountNumber < 1) return 'Enter a whole number of BV.';
    if (wallet && amountNumber > wallet.availableBV) return `You only have ${formatBV(wallet.availableBV)} available.`;
    if (maxTransfer && amountNumber > maxTransfer) return `Maximum per transfer is ${formatBV(maxTransfer)}.`;
    if (!title.trim()) return 'Enter a title.';
    if (isAdmin && !operatorName.trim()) return 'Enter your name as operator.';
    return '';
  }, [recipient, amount, amountNumber, wallet, maxTransfer, title, isAdmin, operatorName]);

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

  const isToAdmin = recipient?.memberId === SUPER_ADMIN_ID;

  return (
    <div className="dashboard-card">
      <div className="card-header-row" style={{ marginBottom: '12px' }}>
        <h2 className="card-title">Send BV</h2>
      </div>
      {message && <Banner kind={message.kind} text={message.text} onClose={() => setMessage(null)} />}

      {!recipient ? (
        <>
          {!isAdmin && (
            <button
              type="button"
              onClick={chooseSuperAdmin}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '12px 14px',
                marginBottom: '16px',
                background: '#f8fafc',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '12px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <UserRound size={18} color="#2563eb" />
              <span>
                <span style={{ display: 'block', fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>Send to Super Admin</span>
                <span style={{ display: 'block', color: '#64748b', fontSize: '12px' }}>Return BV to the company wallet</span>
              </span>
            </button>
          )}
          <Field label={isAdmin ? 'Find member' : 'Or find a member'} hint="Search by Member ID, name, phone number or email.">
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. MEM0012, Asha, 9876543210"
                style={{ ...inputStyle, paddingLeft: '36px' }}
                aria-label="Search member"
              />
            </div>
            {searching && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>Searching…</div>}
            {searchError && <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '8px' }}>{searchError}</div>}
            {!searching && query.trim().length >= 3 && results.length === 0 && !searchError && (
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>No active member matches.</div>
            )}
            {results.length > 0 && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', marginTop: '8px', overflow: 'hidden' }}>
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
                      background: '#ffffff',
                      border: 'none',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      textAlign: 'left',
                      gap: '10px',
                    }}
                  >
                    <span>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{m.name}</span>
                      <span style={{ color: '#64748b', fontSize: '12px' }}> · {m.memberId}</span>
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>{m.mobile}</span>
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
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              borderRadius: '12px',
              marginBottom: '16px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recipient</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{recipient.name}</div>
              <div style={{ fontSize: '12px', color: '#475569' }}>
                {isToAdmin ? 'Company wallet' : [recipient.memberId, recipient.mobile, recipient.email].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button type="button" className="primary-btn" style={ghostBtn} onClick={() => setRecipient(null)}>
              Change
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 16px' }}>
            <Field label="Amount (BV)" hint={wallet ? `Available: ${formatBV(wallet.availableBV)}` : undefined}>
              <input type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} placeholder="e.g. 2000" />
            </Field>
            <Field label="Title">
              <input type="text" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. Payment received" />
            </Field>
          </div>
          <Field label="Note (optional)">
            <textarea maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          {isAdmin && (
            <Field label="Operator name" hint="Who is making this transfer on the shared Super Admin account.">
              <input type="text" maxLength={60} value={operatorName} onChange={(e) => setOperatorName(e.target.value)} style={inputStyle} />
            </Field>
          )}
          {validationError && amount && <div style={{ fontSize: '12px', color: '#b45309', marginBottom: '10px' }}>{validationError}</div>}
          <button type="button" className="primary-btn" disabled={!!validationError || !!wallet?.isFrozen} onClick={() => setConfirming(true)}>
            <Send size={14} />
            <span>Review transfer</span>
          </button>
        </>
      )}

      {confirming && recipient && (
        <Modal title="Confirm BV transfer" onClose={() => !submitting && setConfirming(false)}>
          <div style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6 }}>
            Send <strong>{formatBV(amountNumber)}</strong> to <strong>{recipient.name}</strong>
            {!isToAdmin && ` (${recipient.memberId})`}?
            <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600, marginTop: '8px' }}>
              The BV is credited immediately and this cannot be undone. Check the name and amount.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px' }}>
            <button type="button" className="primary-btn" style={ghostBtn} disabled={submitting} onClick={() => setConfirming(false)}>
              Back
            </button>
            <button type="button" className="primary-btn" disabled={submitting} onClick={() => submit(false)}>
              {submitting ? 'Sending…' : 'Send now'}
            </button>
          </div>
        </Modal>
      )}

      {repeatWarning && recipient && (
        <Modal title="Send again?" onClose={() => !submitting && setRepeatWarning('')}>
          <p style={{ fontSize: '14px', color: '#334155', marginTop: 0 }}>{repeatWarning}</p>
          <p style={{ fontSize: '12px', color: '#64748b' }}>Nothing has been sent yet. Only continue if you really mean to send this twice.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px' }}>
            <button type="button" className="primary-btn" style={ghostBtn} disabled={submitting} onClick={() => setRepeatWarning('')}>
              Don't send
            </button>
            <button type="button" className="primary-btn" style={dangerBtn} disabled={submitting} onClick={() => submit(true)}>
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

  const selectStyle: React.CSSProperties = { ...inputStyle, width: 'auto', padding: '8px 10px', fontSize: '13px' };
  const canReverse = (t: BVTransactionItem) => isAdmin && t.type === 'TRANSFER' && t.status === 'COMPLETED';

  return (
    <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
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
            style={{ ...inputStyle, width: 'auto', flex: '1 1 200px', padding: '8px 10px', fontSize: '13px' }}
            aria-label="Search transactions"
          />
        )}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b' }}>{total} record(s)</span>
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
                <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '28px', color: '#94a3b8' }}>
                  No transactions yet.
                </td>
              </tr>
            ) : (
              items.map((t) => {
                const outgoing = t.direction === 'SENT';
                const sign = t.direction ? (outgoing ? '−' : '+') : '';
                const typeLabel =
                  t.type === 'GENERATION' ? 'Generated' : t.type === 'REVERSAL' ? 'Reversal' : outgoing ? 'Sent' : t.direction === 'RECEIVED' ? 'Received' : 'Transfer';
                return (
                  <tr key={t.transactionId}>
                    <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px' }}>{t.transactionId}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                        {t.type === 'GENERATION' ? <Layers size={13} /> : t.type === 'REVERSAL' ? <Undo2 size={13} /> : outgoing ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}
                        {typeLabel}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      <div>
                        {t.sender.name} <span style={{ color: '#94a3b8' }}>({t.sender.id})</span>
                      </div>
                      {t.recipient && (
                        <div style={{ color: '#475569' }}>
                          → {t.recipient.name} <span style={{ color: '#94a3b8' }}>({t.recipient.id})</span>
                        </div>
                      )}
                      {t.initiatedBy?.operatorName && <div style={{ color: '#94a3b8', fontSize: '11px' }}>Operator: {t.initiatedBy.operatorName}</div>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: outgoing ? '#b91c1c' : '#15803d', whiteSpace: 'nowrap' }}>
                      {sign}
                      {t.amount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ fontSize: '12px', maxWidth: '240px' }}>
                      <div style={{ fontWeight: 600 }}>{t.title}</div>
                      {t.note && <div style={{ color: '#64748b' }}>{t.note}</div>}
                      {t.reversedBy && (
                        <div style={{ color: '#b91c1c', fontSize: '11px', marginTop: '2px' }}>
                          Reversed by {t.reversedBy}
                          {t.reversalReason ? `: ${t.reversalReason}` : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{formatDateTime(t.createdAt)}</td>
                    <td>
                      <StatusPill status={t.status} />
                    </td>
                    {isAdmin && (
                      <td>
                        {canReverse(t) && (
                          <button type="button" className="primary-btn" style={{ ...dangerBtn, padding: '5px 10px', fontSize: '11px' }} onClick={() => setReversing(t)}>
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
          <button type="button" className="primary-btn" style={ghostBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Page {page} of {totalPages}
          </span>
          <button type="button" className="primary-btn" style={ghostBtn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
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
      <p style={{ fontSize: '13px', color: '#334155', marginTop: 0 }}>
        Move <strong>{formatBV(transfer.amount)}</strong> back from <strong>{transfer.recipient?.name}</strong> ({transfer.recipient?.id}) to{' '}
        <strong>{transfer.sender.name}</strong> ({transfer.sender.id}). This creates a new reversal transaction and can only be done once.
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
        <button type="button" className="primary-btn" style={ghostBtn} disabled={submitting} onClick={onClose}>
          Back
        </button>
        <button
          type="button"
          className="primary-btn"
          style={dangerBtn}
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
      <p style={{ fontSize: '12px', color: '#64748b', marginTop: 0 }}>
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
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>The date and time are recorded automatically.</div>
      {validationError && amount && <div style={{ fontSize: '12px', color: '#b45309', marginBottom: '10px' }}>{validationError}</div>}
      <button type="button" className="primary-btn" disabled={!!validationError} onClick={() => setConfirming(true)}>
        <PlusCircle size={14} />
        <span>Generate</span>
      </button>

      {confirming && (
        <Modal title="Confirm BV generation" onClose={() => !submitting && setConfirming(false)}>
          <p style={{ fontSize: '14px', color: '#334155', marginTop: 0 }}>
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
            <button type="button" className="primary-btn" style={ghostBtn} disabled={submitting} onClick={() => setConfirming(false)}>
              Back
            </button>
            <button type="button" className="primary-btn" disabled={submitting || !password} onClick={submit}>
              {submitting ? 'Generating…' : 'Confirm & generate'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BVWalletPage;
