import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowDownRight, CalendarDays, CheckCircle2, Clock, Flame, IndianRupee, Layers, RefreshCw, Search, ShieldCheck, Zap } from 'lucide-react';
import { api } from '../services/api';
import { Alert, Badge, EmptyState as SharedEmptyState, PageHeader, StatusBadge } from '../components/ui';

interface BinaryLedgerPageProps {
  user?: any;
  token?: string | null;
}

type TabId = 'today' | 'history' | 'movements' | 'settlements';

const inr = (n: number | null | undefined) => `₹${(n || 0).toLocaleString('en-IN')}`;
const bv = (n: number | null | undefined) => `${(n || 0).toLocaleString('en-IN')} BV`;
const formatDate = (d: string) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const card: React.CSSProperties = { padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', background: 'var(--surface)', border: '1px solid var(--border-color)' };
const th: React.CSSProperties = { whiteSpace: 'nowrap' };
const td: React.CSSProperties = { whiteSpace: 'nowrap' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right' };

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  icon: React.ReactNode;
  tone: { fg: string; bg: string; border: string };
}> = ({ label, value, footer, icon, tone }) => (
  <div className="kpi-card" style={{ flexDirection: 'column', gap: 'var(--space-2)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <span className="kpi-label">{label}</span>
      <span className="icon-tile" style={{ width: 30, height: 30, background: tone.bg, color: tone.fg }}>{icon}</span>
    </div>
    <div className="kpi-value" style={{ marginTop: 0 }}>{value}</div>
    {footer && <div className="kpi-sub" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-2)', width: '100%' }}>{footer}</div>}
  </div>
);

const TONES = {
  blue: { fg: 'var(--primary-hover)', bg: 'var(--primary-light)', border: 'var(--primary-border)' },
  green: { fg: 'var(--success-hover)', bg: 'var(--success-light)', border: 'var(--success-border)' },
  amber: { fg: 'var(--warning-hover)', bg: 'var(--warning-light)', border: 'var(--warning-border)' },
  purple: { fg: 'var(--accent-hover)', bg: 'var(--accent-light)', border: 'var(--accent-border)' },
  red: { fg: 'var(--danger-hover)', bg: 'var(--danger-light)', border: 'var(--danger-border)' },
};

const Pager: React.FC<{ pagination: any; onPage: (p: number) => void; noun: string }> = ({ pagination, onPage, noun }) =>
  pagination.pages > 1 ? (
    <div className="pager">
      <div>
        Page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong> ({pagination.total} {noun})
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button type="button" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)} className="btn btn-secondary btn-sm">
          Previous
        </button>
        <button type="button" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)} className="btn btn-secondary btn-sm">
          Next
        </button>
      </div>
    </div>
  ) : null;

const EmptyState: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <SharedEmptyState icon={<Layers size={22} />} title={title} text={text} compact />
);

const ErrorBox: React.FC<{ message: string }> = ({ message }) => (
  <Alert tone="error" style={{ marginBottom: 0 }}>{message}</Alert>
);

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Paid', NO_MATCH: 'No match', NOT_QUALIFIED: 'Not qualified', COMPLETED: 'Completed', RUNNING: 'Running', FAILED: 'Failed',
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <StatusBadge
    status={status === 'RUNNING' ? 'PROCESSING' : status === 'NOT_QUALIFIED' ? 'PENDING' : status}
    label={STATUS_LABELS[status] || status}
  />
);

export const BinaryLedgerPage: React.FC<BinaryLedgerPageProps> = ({ user: propUser, token: propToken }) => {
  const savedToken = propToken || localStorage.getItem('wetala_token') || '';
  const savedUserStr = localStorage.getItem('wetala_user');
  const user = propUser || (savedUserStr ? JSON.parse(savedUserStr) : null);
  const isAdmin = user?.role?.toLowerCase() === 'superadmin';
  const defaultMemberId = user?.memberId || 'MEM0001';

  const [activeMemberId, setActiveMemberId] = useState(defaultMemberId);
  const [searchInput, setSearchInput] = useState(defaultMemberId);
  const [tab, setTab] = useState<TabId>('today');

  const [today, setToday] = useState<any>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    setTodayLoading(true);
    setTodayError(null);
    try {
      const res = await api.getBinaryToday(activeMemberId, savedToken);
      if (res?.status) setToday(res.data);
      else setTodayError(res?.message || 'Could not load binary income.');
    } catch (err: any) {
      setTodayError(err.message || 'Could not load binary income.');
    } finally {
      setTodayLoading(false);
    }
  }, [activeMemberId, savedToken]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim().toUpperCase();
    if (clean) setActiveMemberId(clean);
  };

  const q = today?.qualification;
  const qualified = Boolean(q?.isSelfActive && q?.isSponsorQualified);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'today', label: 'Today (Live)' },
    { id: 'history', label: 'Daily History' },
    { id: 'movements', label: 'BV Movements' },
    ...(isAdmin ? [{ id: 'settlements' as TabId, label: 'Daily Settlements' }] : []),
  ];

  return (
    <div className="page-body">
      <PageHeader
        title="Binary Income"
        subtitle="Team BV is matched once a day. Each day's income is credited to your wallet after midnight (IST)."
        actions={
          <>
            {isAdmin && (
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <div className="filter-search-box" style={{ minWidth: 0, width: 180 }}>
                  <Search size={14} className="search-icon" aria-hidden="true" />
                  <input
                    type="text"
                    aria-label="Member ID"
                    placeholder="Member ID"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-secondary">View</button>
              </form>
            )}
            <button type="button" onClick={loadToday} className="btn btn-secondary btn-icon" title="Refresh" aria-label="Refresh">
              <RefreshCw size={16} className={todayLoading ? 'animate-spin' : ''} />
            </button>
          </>
        }
      />

      {todayError && <ErrorBox message={todayError} />}

      {q && (
        <div className={`card qualification-card ${qualified ? 'is-ok' : 'is-pending'}`}>
          <div className="card-header-row" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="card-title-group">
              <ShieldCheck size={18} color={qualified ? 'var(--success)' : 'var(--warning)'} />
              <h2 className="section-title">
                {isAdmin && activeMemberId !== user?.memberId ? `${activeMemberId}: ` : ''}Binary income eligibility
              </h2>
            </div>
            <Badge tone={qualified ? 'success' : 'warning'}>{qualified ? 'Qualified' : 'Not qualified yet'}</Badge>
          </div>
          <div className="stat-panel-grid" style={{ marginBottom: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
            {[
              { ok: q.isSelfActive, title: 'Binary activated (100 BV locked)', yes: 'Active', no: 'Needs 100 BV' },
              { ok: q.hasLeftSponsor, title: 'Sponsored member on your left (any level)', yes: q.leftSponsorMembers?.[0]?.name || 'Found', no: 'None yet' },
              { ok: q.hasRightSponsor, title: 'Sponsored member on your right (any level)', yes: q.rightSponsorMembers?.[0]?.name || 'Found', no: 'None yet' },
            ].map((c) => (
              <div key={c.title} className="stat-panel" style={{ padding: 'var(--space-3)' }}>
                <div className="stat-panel-label" style={{ fontSize: 'var(--fs-xs)' }}>{c.title}</div>
                <div className="icon-text" style={{ marginTop: 'var(--space-1)', fontWeight: 600, color: c.ok ? 'var(--success)' : 'var(--warning-hover)' }}>
                  {c.ok ? <CheckCircle2 size={14} color="var(--success)" /> : <AlertTriangle size={14} color="var(--warning)" />}
                  {c.ok ? c.yes : c.no}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Binary income views">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`tab-btn${tab === t.id ? ' is-active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'today' && <TodayTab data={today} loading={todayLoading} />}
      {tab === 'history' && <HistoryTab memberId={activeMemberId} token={savedToken} />}
      {tab === 'movements' && <MovementsTab memberId={activeMemberId} token={savedToken} />}
      {tab === 'settlements' && isAdmin && (
        <SettlementsTab token={savedToken} onViewMember={(id) => { setActiveMemberId(id); setSearchInput(id); setTab('history'); }} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Today (live estimate)
// ---------------------------------------------------------------------------

const TodayTab: React.FC<{ data: any; loading: boolean }> = ({ data, loading }) => {
  if (!data) return loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : null;
  const o = data.opening;
  const c = data.closing;
  const capLabel = data.dailyCap > 0 ? inr(data.dailyCap) : 'No cap';
  const capPct = data.dailyCap > 0 ? Math.min(100, Math.round((data.generatedAmount / data.dailyCap) * 100)) : 0;
  const stage = o.payoutCount === 0 ? 'Waiting for 1st payout (2,500 : 1,250)' : o.payoutCount === 1 ? `Waiting for 2nd payout (1,250 new BV opposite the kept 2,500 ${o.reservedSide || ''})` : `1 : 1 matching (${o.payoutCount} payouts so far)`;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: '12px', flexWrap: 'wrap' }}>
        <Clock size={14} />
        <span>
          Estimate for <strong>{formatDate(data.businessDate)}</strong>. Paid after midnight IST. Stage: <strong>{stage}</strong>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '18px' }}>
        <StatCard label="Left: new today" value={bv(data.newLeftBV)} icon={<ArrowDownLeft size={16} />} tone={TONES.blue} footer={<>Carry forward: <strong>{bv(o.left)}</strong></>} />
        <StatCard label="Right: new today" value={bv(data.newRightBV)} icon={<ArrowDownRight size={16} />} tone={TONES.green} footer={<>Carry forward: <strong>{bv(o.right)}</strong></>} />
        <StatCard label="Matches today" value={data.matches} icon={<Layers size={16} />} tone={TONES.purple} footer={<>{inr(data.ratePerMatch)} each · Kept for 2nd payout: <strong>{bv(o.reservedBV)}</strong></>} />
        <StatCard label="Estimated income" value={inr(data.creditedAmount)} icon={<IndianRupee size={16} />} tone={TONES.green} footer={<>Earned {inr(data.generatedAmount)} · Daily cap {capLabel}</>} />
        <StatCard label="Flushed (above cap)" value={inr(data.flushedAmount)} icon={<Flame size={16} />} tone={data.flushedAmount > 0 ? TONES.red : TONES.amber} footer="Not carried forward" />
      </div>

      {data.dailyCap > 0 && (
        <div style={{ ...card, marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-body)', marginBottom: '8px' }}>
            <span>Daily cap used</span>
            <span>{inr(Math.min(data.generatedAmount, data.dailyCap))} / {inr(data.dailyCap)}</span>
          </div>
          <div style={{ height: '10px', borderRadius: 'var(--radius-full)', background: 'var(--surface-muted)', overflow: 'hidden' }}>
            <div style={{ width: `${capPct}%`, height: '100%', background: capPct >= 100 ? 'var(--danger)' : 'var(--primary)' }} />
          </div>
        </div>
      )}

      <div style={{ ...card, marginBottom: '18px' }}>
        <h2 className="section-title" style={{ margin: '0 0 10px' }}>Matches expected today</h2>
        {data.cycles.length === 0 ? (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: 0 }}>
            No match yet. Left {bv(o.left + data.newLeftBV)} : Right {bv(o.right + data.newRightBV)} available.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={th}>Payout #</th>
                  <th style={th}>Stage</th>
                  <th style={{ ...th, textAlign: 'right' }}>Left BV used</th>
                  <th style={{ ...th, textAlign: 'right' }}>Right BV used</th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.cycles.map((cy: any) => (
                  <tr key={cy.payoutSequence}>
                    <td style={td}>#{cy.payoutSequence}</td>
                    <td style={td}>
                      {cy.stage === 'FIRST_PAYOUT' ? `1st payout (${cy.ratio}, 2,500 kept ${cy.reservedSide})` : cy.stage === 'SECOND_PAYOUT' ? `2nd payout (kept 2,500 ${cy.reservedSide} released)` : '1 : 1'}
                    </td>
                    <td style={tdNum}>{bv(cy.leftBVUsed)}</td>
                    <td style={tdNum}>{bv(cy.rightBVUsed)}</td>
                    <td style={{ ...tdNum, fontWeight: 700 }}>{inr(cy.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: '10px 0 0' }}>
          After today: carry forward Left <strong>{bv(c.left)}</strong> · Right <strong>{bv(c.right)}</strong>
          {c.reservedBV > 0 ? <> · Kept for 2nd payout <strong>{bv(c.reservedBV)} ({c.reservedSide})</strong></> : null}
        </p>
      </div>

      <div style={card}>
        <h2 className="section-title" style={{ margin: '0 0 10px' }}>How binary income works</h2>
        <ul style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, paddingLeft: '18px' }}>
          <li>Reaching 100 BV (from any source) activates binary income. 100 BV is locked for it and used once in binary.</li>
          <li>You need a member you sponsored somewhere in your left team and one in your right team (any level).</li>
          <li><strong>1st payout:</strong> 2,500 BV on one side and 1,250 BV on the other pays ₹250. The 2,500 is kept.</li>
          <li><strong>2nd payout:</strong> the kept 2,500 plus 1,250 new BV on the other side pays ₹250.</li>
          <li><strong>3rd payout onwards:</strong> every 1,250 : 1,250 pays ₹250, with no limit.</li>
          <li>Used BV cannot be used again. Unused BV carries forward to the next day.</li>
          <li>Daily cap: your package cap, or ₹4,000 without a package. Income above the cap is flushed and not carried forward.</li>
          <li>No TDS or admin fee is deducted. The full amount is credited to your wallet.</li>
        </ul>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Daily history
// ---------------------------------------------------------------------------

const HistoryTab: React.FC<{ memberId: string; token: string }> = ({ memberId, token }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0, pages: 1 });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBinaryDaily(memberId, { page, limit: 30, from, to }, token);
      if (res?.status) {
        setRows(res.data || []);
        setTotals(res.totals);
        setPagination(res.pagination);
      } else setError(res?.message || 'Could not load daily history.');
    } catch (err: any) {
      setError(err.message || 'Could not load daily history.');
    } finally {
      setLoading(false);
    }
  }, [memberId, token, from, to]);

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <>
      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <StatCard label="Credited" value={inr(totals.creditedAmount)} icon={<IndianRupee size={16} />} tone={TONES.green} footer={`${totals.days} day(s)`} />
          <StatCard label="Matches" value={totals.matches} icon={<Layers size={16} />} tone={TONES.purple} footer={`Earned ${inr(totals.generatedAmount)}`} />
          <StatCard label="Flushed" value={inr(totals.flushedAmount)} icon={<Flame size={16} />} tone={TONES.red} footer="Above the daily cap" />
          <StatCard label="New team BV" value={bv(totals.newLeftBV + totals.newRightBV)} icon={<CalendarDays size={16} />} tone={TONES.blue} footer={`L ${bv(totals.newLeftBV)} · R ${bv(totals.newRightBV)}`} />
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <h2 className="section-title" style={{ margin: 0 }}>Day-by-day binary income</h2>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }} />
            To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }} />
          </div>
        </div>

        {error ? (
          <ErrorBox message={error} />
        ) : !loading && rows.length === 0 ? (
          <EmptyState title="No settled days yet" text="Each day appears here after it is settled at midnight (IST)." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={{ ...th, textAlign: 'right' }}>Left new</th>
                  <th style={{ ...th, textAlign: 'right' }}>Right new</th>
                  <th style={{ ...th, textAlign: 'right' }}>Matches</th>
                  <th style={{ ...th, textAlign: 'right' }}>Earned</th>
                  <th style={{ ...th, textAlign: 'right' }}>Cap</th>
                  <th style={{ ...th, textAlign: 'right' }}>Credited</th>
                  <th style={{ ...th, textAlign: 'right' }}>Flushed</th>
                  <th style={{ ...th, textAlign: 'right' }}>Left carry</th>
                  <th style={{ ...th, textAlign: 'right' }}>Right carry</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.closingId}>
                    <td style={{ ...td, fontWeight: 700 }}>{formatDate(r.businessDate)}</td>
                    <td style={{ ...tdNum, color: 'var(--primary-hover)' }}>{(r.newLeftBV || 0).toLocaleString('en-IN')}</td>
                    <td style={{ ...tdNum, color: 'var(--success-hover)' }}>{(r.newRightBV || 0).toLocaleString('en-IN')}</td>
                    <td style={tdNum}>{r.matches}</td>
                    <td style={tdNum}>{inr(r.generatedAmount)}</td>
                    <td style={{ ...tdNum, color: 'var(--text-muted)' }}>{r.dailyCap > 0 ? inr(r.dailyCap) : '-'}</td>
                    <td style={{ ...tdNum, fontWeight: 800, color: 'var(--success-hover)' }}>{inr(r.creditedAmount)}</td>
                    <td style={{ ...tdNum, color: r.flushedAmount > 0 ? 'var(--danger)' : 'var(--text-light)' }}>{inr(r.flushedAmount)}</td>
                    <td style={tdNum}>{(r.closing?.left || 0).toLocaleString('en-IN')}</td>
                    <td style={tdNum}>{(r.closing?.right || 0).toLocaleString('en-IN')}</td>
                    <td style={td}><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager pagination={pagination} onPage={load} noun="days" />
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// BV movements (ledger)
// ---------------------------------------------------------------------------

const MovementsTab: React.FC<{ memberId: string; token: string }> = ({ memberId, token }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [leg, setLeg] = useState<'ALL' | 'LEFT' | 'RIGHT'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBinaryLedger(memberId, { page, limit: 20, ...(leg !== 'ALL' ? { leg } : {}) }, token);
      if (res?.status) {
        setRows(res.data || []);
        setSummary(res.summary);
        setPagination(res.pagination);
      } else setError(res?.message || 'Could not load BV movements.');
    } catch (err: any) {
      setError(err.message || 'Could not load BV movements.');
    } finally {
      setLoading(false);
    }
  }, [memberId, token, leg]);

  useEffect(() => {
    load(1);
  }, [load]);

  const typeLabel = (entry: any) => {
    if (entry.sourceType === 'MATCHED') return 'Daily matching';
    if (entry.sourceType === 'ACTIVATION') return 'Activation BV';
    if (entry.sourceType === 'REVERSAL') return 'Reversal';
    return entry.position ? 'Team BV' : 'Personal BV';
  };

  return (
    <>
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <StatCard label="Left lifetime" value={bv(summary.leftTotalBV)} icon={<ArrowDownLeft size={16} />} tone={TONES.blue} footer={<>Waiting today: {bv(summary.leftPendingBV)}</>} />
          <StatCard label="Right lifetime" value={bv(summary.rightTotalBV)} icon={<ArrowDownRight size={16} />} tone={TONES.green} footer={<>Waiting today: {bv(summary.rightPendingBV)}</>} />
          <StatCard label="BV used in matching" value={bv(summary.consumedTotalBV)} icon={<Layers size={16} />} tone={TONES.purple} footer={`${summary.payoutCount} payout(s) completed`} />
          <StatCard label="Activation lock" value={bv(summary.activationLockedBV)} icon={<ShieldCheck size={16} />} tone={TONES.amber} footer="Locked once to activate binary" />
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 className="section-title" style={{ margin: 0 }}>BV movements</h2>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['ALL', 'LEFT', 'RIGHT'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLeg(l)}
                style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: leg === l ? 'var(--surface-inverse)' : 'var(--surface)', color: leg === l ? 'var(--text-inverse)' : 'var(--text-secondary)', cursor: 'pointer' }}
              >
                {l === 'ALL' ? 'All' : l === 'LEFT' ? 'Left' : 'Right'}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <ErrorBox message={error} />
        ) : !loading && rows.length === 0 ? (
          <EmptyState title="No BV movements yet" text="Team BV, activation BV and daily matching appear here." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={th}>Date & time</th>
                  <th style={th}>Leg</th>
                  <th style={th}>Type</th>
                  <th style={{ ...th, textAlign: 'right' }}>Added</th>
                  <th style={{ ...th, textAlign: 'right' }}>Used / removed</th>
                  <th style={{ ...th, textAlign: 'right' }}>Kept</th>
                  <th style={th}>Day</th>
                  <th style={th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const legColor = e.position === 'LEFT' ? 'var(--primary)' : e.position === 'RIGHT' ? 'var(--success)' : 'var(--text-muted)';
                  return (
                    <tr key={e.ledgerId}>
                      <td style={{ ...td, color: 'var(--text-body)' }}>
                        {new Date(e.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ ...td, fontWeight: 800, color: legColor }}>{e.position || '-'}</td>
                      <td style={td}>{typeLabel(e)}</td>
                      <td style={{ ...tdNum, color: e.earnedBV > 0 ? 'var(--success-hover)' : 'var(--text-light)', fontWeight: e.earnedBV > 0 ? 700 : 400 }}>{e.earnedBV > 0 ? `+${e.earnedBV.toLocaleString('en-IN')}` : '0'}</td>
                      <td style={{ ...tdNum, color: e.consumedBV > 0 ? 'var(--danger)' : 'var(--text-light)', fontWeight: e.consumedBV > 0 ? 700 : 400 }}>{e.consumedBV > 0 ? `-${e.consumedBV.toLocaleString('en-IN')}` : '0'}</td>
                      <td style={{ ...tdNum, color: e.reservedBV > 0 ? 'var(--warning)' : 'var(--text-light)' }}>{e.reservedBV > 0 ? e.reservedBV.toLocaleString('en-IN') : '-'}</td>
                      <td style={td}>
                        {e.businessDate ? formatDate(e.businessDate) : '-'}
                        {e.settlementStatus === 'PENDING' && <span style={{ marginLeft: '6px', fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--primary-hover)' }}>WAITING</span>}
                      </td>
                      <td style={{ ...td, whiteSpace: 'normal', color: 'var(--text-secondary)', minWidth: '240px' }}>{e.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager pagination={pagination} onPage={load} noun="entries" />
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Daily settlements (Super Admin)
// ---------------------------------------------------------------------------

const SettlementsTab: React.FC<{ token: string; onViewMember: (memberId: string) => void }> = ({ token, onViewMember }) => {
  const [runs, setRuns] = useState<any[]>([]);
  const [lastSettleableDate, setLastSettleableDate] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [detailPagination, setDetailPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [earnersOnly, setEarnersOnly] = useState(true);
  const [settleDate, setSettleDate] = useState('');
  const [settling, setSettling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadRuns = useCallback(async () => {
    const res = await api.getBinarySettlements({ limit: 60 }, token);
    if (res?.status) {
      setRuns(res.data || []);
      setLastSettleableDate(res.lastSettleableDate);
      setSettleDate((d) => d || res.lastSettleableDate);
      setSelectedDate((d) => d || res.data?.[0]?.businessDate || '');
    }
  }, [token]);

  const loadDetail = useCallback(async (page: number) => {
    if (!selectedDate) return;
    const res = await api.getBinarySettlement(selectedDate, { page, limit: 50, search, earnersOnly }, token);
    if (res?.status) {
      setDetail(res.data);
      setDetailPagination(res.pagination);
    }
  }, [selectedDate, search, earnersOnly, token]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    loadDetail(1);
  }, [loadDetail]);

  const runSettlement = async () => {
    if (!settleDate) return;
    if (!window.confirm(`Settle binary income for ${formatDate(settleDate)}? Members already settled for that day are skipped.`)) return;
    setSettling(true);
    setMessage(null);
    try {
      const res = await api.settleDailyBinary(settleDate, token);
      setMessage({ type: res?.status ? 'success' : 'error', text: res?.message || 'Settlement failed.' });
      if (res?.status) {
        setSelectedDate(settleDate);
        await loadRuns();
        await loadDetail(1);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Settlement failed.' });
    } finally {
      setSettling(false);
    }
  };

  const t = detail?.totals;

  return (
    <>
      <div style={{ ...card, marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 className="section-title" style={{ margin: 0 }}>Run a settlement</h2>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Runs automatically at 00:05 IST for the previous day. Use this to settle or retry a finished day manually.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={settleDate} max={lastSettleableDate} onChange={(e) => setSettleDate(e.target.value)} style={{ padding: '7px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)' }} />
            <button onClick={runSettlement} disabled={settling || !settleDate} className="btn btn-success btn-sm">
              <Zap size={14} className={settling ? 'animate-spin' : ''} />
              <span>{settling ? 'Settling...' : 'Settle day'}</span>
            </button>
          </div>
        </div>
        {message && (
        <Alert tone={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>
      )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '16px' }}>
        <div style={card}>
          <h2 className="section-title" style={{ margin: '0 0 12px' }}>Settlement days</h2>
          {runs.length === 0 ? (
            <EmptyState title="No settlements yet" text="The first settlement runs after the next midnight (IST)." />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Status</th>
                    <th style={{ ...th, textAlign: 'right' }}>Earners</th>
                    <th style={{ ...th, textAlign: 'right' }}>Matches</th>
                    <th style={{ ...th, textAlign: 'right' }}>Left new</th>
                    <th style={{ ...th, textAlign: 'right' }}>Right new</th>
                    <th style={{ ...th, textAlign: 'right' }}>Credited</th>
                    <th style={{ ...th, textAlign: 'right' }}>Flushed</th>
                    <th style={{ ...th, textAlign: 'right' }}>Failures</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr
                      key={r.businessDate}
                      onClick={() => setSelectedDate(r.businessDate)}
                      style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer', background: r.businessDate === selectedDate ? 'var(--primary-light)' : 'transparent' }}
                    >
                      <td style={{ ...td, fontWeight: 700 }}>{formatDate(r.businessDate)}</td>
                      <td style={td}><StatusPill status={r.status} /></td>
                      <td style={tdNum}>{r.totals?.earners || 0}</td>
                      <td style={tdNum}>{r.totals?.matches || 0}</td>
                      <td style={tdNum}>{(r.totals?.newLeftBV || 0).toLocaleString('en-IN')}</td>
                      <td style={tdNum}>{(r.totals?.newRightBV || 0).toLocaleString('en-IN')}</td>
                      <td style={{ ...tdNum, fontWeight: 800, color: 'var(--success-hover)' }}>{inr(r.totals?.creditedAmount)}</td>
                      <td style={{ ...tdNum, color: 'var(--danger)' }}>{inr(r.totals?.flushedAmount)}</td>
                      <td style={{ ...tdNum, color: r.failures?.length ? 'var(--danger)' : 'var(--text-light)' }}>{r.failures?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedDate && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              <h2 className="section-title" style={{ margin: 0 }}>Members for {formatDate(selectedDate)}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Member ID or name" value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-sm)' }} />
                <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="checkbox" checked={earnersOnly} onChange={(e) => setEarnersOnly(e.target.checked)} /> Earners only
                </label>
              </div>
            </div>
            {t && (
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                {t.closings} member(s) closed · {t.qualifiedMembers} qualified · {t.earners} earner(s) · {t.matches} matches · Earned {inr(t.generatedAmount)} · Credited <strong style={{ color: 'var(--success-hover)' }}>{inr(t.creditedAmount)}</strong> · Flushed <strong style={{ color: 'var(--danger)' }}>{inr(t.flushedAmount)}</strong>
              </p>
            )}
            {detail?.run?.failures?.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <ErrorBox message={`${detail.run.failures.length} member(s) failed: ${detail.run.failures.map((f: any) => f.memberId).join(', ')}. Run the day again to retry them.`} />
              </div>
            )}
            {!detail?.closings?.length ? (
              <EmptyState title="No members to show" text="Nobody matches this filter for the selected day." />
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={th}>Member</th>
                      <th style={{ ...th, textAlign: 'right' }}>Left new</th>
                      <th style={{ ...th, textAlign: 'right' }}>Right new</th>
                      <th style={{ ...th, textAlign: 'right' }}>Matches</th>
                      <th style={{ ...th, textAlign: 'right' }}>Cap</th>
                      <th style={{ ...th, textAlign: 'right' }}>Credited</th>
                      <th style={{ ...th, textAlign: 'right' }}>Flushed</th>
                      <th style={th}>Wallet</th>
                      <th style={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.closings.map((c: any) => (
                      <tr key={c.closingId}>
                        <td style={td}>
                          <button onClick={() => onViewMember(c.memberId)} className="link-btn">
                            {c.memberId}
                          </button>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>{c.memberName}</span>
                        </td>
                        <td style={tdNum}>{(c.newLeftBV || 0).toLocaleString('en-IN')}</td>
                        <td style={tdNum}>{(c.newRightBV || 0).toLocaleString('en-IN')}</td>
                        <td style={tdNum}>{c.matches}</td>
                        <td style={{ ...tdNum, color: 'var(--text-muted)' }}>{c.dailyCap > 0 ? inr(c.dailyCap) : '-'}</td>
                        <td style={{ ...tdNum, fontWeight: 800, color: 'var(--success-hover)' }}>{inr(c.creditedAmount)}</td>
                        <td style={{ ...tdNum, color: c.flushedAmount > 0 ? 'var(--danger)' : 'var(--text-light)' }}>{inr(c.flushedAmount)}</td>
                        <td style={td}>{c.creditedAmount > 0 ? (c.walletCredited ? 'Credited' : <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Pending</span>) : '-'}</td>
                        <td style={td}><StatusPill status={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager pagination={detailPagination} onPage={loadDetail} noun="members" />
          </div>
        )}
      </div>
    </>
  );
};
