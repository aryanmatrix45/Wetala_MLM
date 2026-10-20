import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Zap,
  ShieldCheck,
  ArrowDownLeft,
  ArrowDownRight,
  AlertCircle,
  CalendarDays,
  Flame,
  IndianRupee,
  Clock,
} from 'lucide-react';
import { api } from '../services/api';

interface BinaryLedgerPageProps {
  user?: any;
  token?: string | null;
}

type TabId = 'today' | 'history' | 'movements' | 'settlements';

const inr = (n: number | null | undefined) => `₹${(n || 0).toLocaleString('en-IN')}`;
const bv = (n: number | null | undefined) => `${(n || 0).toLocaleString('en-IN')} BV`;
const formatDate = (d: string) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const card: React.CSSProperties = { padding: '20px', borderRadius: '14px', background: '#ffffff', border: '1px solid #e2e8f0' };
const th: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right' };

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  icon: React.ReactNode;
  tone: { fg: string; bg: string; border: string };
}> = ({ label, value, footer, icon, tone }) => (
  <div className="dashboard-card" style={{ padding: '18px', borderRadius: '14px', background: `linear-gradient(135deg, #ffffff 0%, ${tone.bg} 100%)`, border: `1px solid ${tone.border}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <span style={{ fontSize: '11.5px', fontWeight: 800, color: tone.fg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: tone.bg, color: tone.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
    </div>
    <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{value}</div>
    {footer && (
      <div style={{ fontSize: '11.5px', color: '#64748b', borderTop: `1px solid ${tone.border}`, paddingTop: '8px', marginTop: '8px' }}>{footer}</div>
    )}
  </div>
);

const TONES = {
  blue: { fg: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  green: { fg: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  amber: { fg: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  purple: { fg: '#86198f', bg: '#fdf4ff', border: '#f5d0fe' },
  red: { fg: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
};

const Pager: React.FC<{ pagination: any; onPage: (p: number) => void; noun: string }> = ({ pagination, onPage, noun }) =>
  pagination.pages > 1 ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', flexWrap: 'wrap', gap: '8px' }}>
      <div>
        Page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong> ({pagination.total} {noun})
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)} className="secondary-btn" style={{ fontSize: '11.5px', padding: '5px 10px', opacity: pagination.page <= 1 ? 0.5 : 1 }}>
          Previous
        </button>
        <button disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)} className="secondary-btn" style={{ fontSize: '11.5px', padding: '5px 10px', opacity: pagination.page >= pagination.pages ? 0.5 : 1 }}>
          Next
        </button>
      </div>
    </div>
  ) : null;

const EmptyState: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div style={{ padding: '44px 16px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '10px' }}>
    <Layers size={34} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
    <p style={{ fontSize: '14px', fontWeight: 700, color: '#334155', margin: 0 }}>{title}</p>
    <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{text}</p>
  </div>
);

const ErrorBox: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ padding: '24px', textAlign: 'center', color: '#b91c1c', background: '#fef2f2', borderRadius: '10px' }}>
    <AlertCircle size={22} style={{ margin: '0 auto 8px' }} />
    <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>{message}</p>
  </div>
);

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; fg: string; bg: string }> = {
    PAID: { label: 'Paid', fg: '#15803d', bg: '#dcfce7' },
    NO_MATCH: { label: 'No match', fg: '#475569', bg: '#f1f5f9' },
    NOT_QUALIFIED: { label: 'Not qualified', fg: '#b45309', bg: '#fef3c7' },
    COMPLETED: { label: 'Completed', fg: '#15803d', bg: '#dcfce7' },
    RUNNING: { label: 'Running', fg: '#1d4ed8', bg: '#dbeafe' },
    FAILED: { label: 'Failed', fg: '#b91c1c', bg: '#fee2e2' },
  };
  const s = map[status] || { label: status, fg: '#475569', bg: '#f1f5f9' };
  return <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '9999px', background: s.bg, color: s.fg }}>{s.label}</span>;
};

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
    <div className="page-body" style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div className="welcome-header" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}>
            <BarChart3 size={24} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Binary Income</h1>
            <p className="page-subtitle" style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Team BV is matched once a day. Each day's income is credited to your wallet after midnight (IST).
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
          {isAdmin && (
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Enter Member ID..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  style={{ padding: '8px 12px 8px 30px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', width: '170px', outline: 'none', fontWeight: 600 }}
                />
              </div>
              <button type="submit" className="secondary-btn" style={{ fontSize: '12px', padding: '8px 12px' }}>
                View
              </button>
            </form>
          )}
          <button onClick={loadToday} className="secondary-btn" style={{ fontSize: '12px', padding: '8px 12px' }} title="Refresh">
            <RefreshCw size={14} className={todayLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {todayError && <div style={{ marginBottom: '16px' }}><ErrorBox message={todayError} /></div>}

      {/* Qualification */}
      {q && (
        <div style={{ background: qualified ? '#f0fdf4' : '#fffbeb', border: `1px solid ${qualified ? '#bbf7d0' : '#fde68a'}`, borderRadius: '12px', padding: '14px 18px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color={qualified ? '#16a34a' : '#d97706'} />
              <span style={{ fontSize: '13.5px', fontWeight: 800, color: qualified ? '#15803d' : '#92400e' }}>
                {isAdmin && activeMemberId !== user?.memberId ? `${activeMemberId}: ` : ''}Binary income eligibility
              </span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '9999px', background: qualified ? '#dcfce7' : '#fef3c7', color: qualified ? '#15803d' : '#b45309', textTransform: 'uppercase' }}>
              {qualified ? 'Qualified' : 'Not qualified yet'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {[
              { ok: q.isSelfActive, title: '1. Binary activated (100 BV locked)', yes: 'Active', no: 'Needs 100 BV' },
              { ok: q.hasLeftSponsor, title: '2. Your sponsored member on the left (any level)', yes: q.leftSponsorMembers?.[0]?.name || 'Found', no: 'None yet' },
              { ok: q.hasRightSponsor, title: '3. Your sponsored member on the right (any level)', yes: q.rightSponsorMembers?.[0]?.name || 'Found', no: 'None yet' },
            ].map((c) => (
              <div key={c.title} style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>{c.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  {c.ok ? <CheckCircle2 size={14} color="#16a34a" /> : <AlertTriangle size={14} color="#d97706" />}
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: c.ok ? '#16a34a' : '#d97706' }}>{c.ok ? c.yes : c.no}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '2px' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              fontSize: '12.5px',
              fontWeight: 700,
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: tab === t.id ? '#0f172a' : '#ffffff',
              color: tab === t.id ? '#ffffff' : '#475569',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
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
  if (!data) return loading ? <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading...</div> : null;
  const o = data.opening;
  const c = data.closing;
  const capLabel = data.dailyCap > 0 ? inr(data.dailyCap) : 'No cap';
  const capPct = data.dailyCap > 0 ? Math.min(100, Math.round((data.generatedAmount / data.dailyCap) * 100)) : 0;
  const stage = o.payoutCount === 0 ? 'Waiting for 1st payout (2,500 : 1,250)' : o.payoutCount === 1 ? `Waiting for 2nd payout (1,250 new BV opposite the kept 2,500 ${o.reservedSide || ''})` : `1 : 1 matching (${o.payoutCount} payouts so far)`;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#475569', marginBottom: '12px', flexWrap: 'wrap' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
            <span>Daily cap used</span>
            <span>{inr(Math.min(data.generatedAmount, data.dailyCap))} / {inr(data.dailyCap)}</span>
          </div>
          <div style={{ height: '10px', borderRadius: '9999px', background: '#f1f5f9', overflow: 'hidden' }}>
            <div style={{ width: `${capPct}%`, height: '100%', background: capPct >= 100 ? '#dc2626' : '#2563eb' }} />
          </div>
        </div>
      )}

      <div style={{ ...card, marginBottom: '18px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>Matches expected today</h2>
        {data.cycles.length === 0 ? (
          <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
            No match yet. Left {bv(o.left + data.newLeftBV)} : Right {bv(o.right + data.newRightBV)} available.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'left' }}>
                  <th style={th}>Payout #</th>
                  <th style={th}>Stage</th>
                  <th style={{ ...th, textAlign: 'right' }}>Left BV used</th>
                  <th style={{ ...th, textAlign: 'right' }}>Right BV used</th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.cycles.map((cy: any) => (
                  <tr key={cy.payoutSequence} style={{ borderBottom: '1px solid #f1f5f9' }}>
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
        <p style={{ fontSize: '12px', color: '#64748b', margin: '10px 0 0' }}>
          After today: carry forward Left <strong>{bv(c.left)}</strong> · Right <strong>{bv(c.right)}</strong>
          {c.reservedBV > 0 ? <> · Kept for 2nd payout <strong>{bv(c.reservedBV)} ({c.reservedSide})</strong></> : null}
        </p>
      </div>

      <div style={card}>
        <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>How binary income works</h2>
        <ul style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.7, margin: 0, paddingLeft: '18px' }}>
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
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Day-by-day binary income</h2>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: '#475569', flexWrap: 'wrap' }}>
            From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>
        </div>

        {error ? (
          <ErrorBox message={error} />
        ) : !loading && rows.length === 0 ? (
          <EmptyState title="No settled days yet" text="Each day appears here after it is settled at midnight (IST)." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
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
                  <tr key={r.closingId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...td, fontWeight: 700 }}>{formatDate(r.businessDate)}</td>
                    <td style={{ ...tdNum, color: '#1d4ed8' }}>{(r.newLeftBV || 0).toLocaleString('en-IN')}</td>
                    <td style={{ ...tdNum, color: '#047857' }}>{(r.newRightBV || 0).toLocaleString('en-IN')}</td>
                    <td style={tdNum}>{r.matches}</td>
                    <td style={tdNum}>{inr(r.generatedAmount)}</td>
                    <td style={{ ...tdNum, color: '#64748b' }}>{r.dailyCap > 0 ? inr(r.dailyCap) : '-'}</td>
                    <td style={{ ...tdNum, fontWeight: 800, color: '#15803d' }}>{inr(r.creditedAmount)}</td>
                    <td style={{ ...tdNum, color: r.flushedAmount > 0 ? '#dc2626' : '#94a3b8' }}>{inr(r.flushedAmount)}</td>
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
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>BV movements</h2>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['ALL', 'LEFT', 'RIGHT'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLeg(l)}
                style={{ fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: leg === l ? '#0f172a' : '#ffffff', color: leg === l ? '#ffffff' : '#475569', cursor: 'pointer' }}
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '11px', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>
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
                  const legColor = e.position === 'LEFT' ? '#2563eb' : e.position === 'RIGHT' ? '#059669' : '#64748b';
                  return (
                    <tr key={e.ledgerId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ ...td, color: '#334155' }}>
                        {new Date(e.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ ...td, fontWeight: 800, color: legColor }}>{e.position || '-'}</td>
                      <td style={td}>{typeLabel(e)}</td>
                      <td style={{ ...tdNum, color: e.earnedBV > 0 ? '#15803d' : '#94a3b8', fontWeight: e.earnedBV > 0 ? 700 : 400 }}>{e.earnedBV > 0 ? `+${e.earnedBV.toLocaleString('en-IN')}` : '0'}</td>
                      <td style={{ ...tdNum, color: e.consumedBV > 0 ? '#dc2626' : '#94a3b8', fontWeight: e.consumedBV > 0 ? 700 : 400 }}>{e.consumedBV > 0 ? `-${e.consumedBV.toLocaleString('en-IN')}` : '0'}</td>
                      <td style={{ ...tdNum, color: e.reservedBV > 0 ? '#d97706' : '#94a3b8' }}>{e.reservedBV > 0 ? e.reservedBV.toLocaleString('en-IN') : '-'}</td>
                      <td style={td}>
                        {e.businessDate ? formatDate(e.businessDate) : '-'}
                        {e.settlementStatus === 'PENDING' && <span style={{ marginLeft: '6px', fontSize: '10.5px', fontWeight: 800, color: '#1d4ed8' }}>WAITING</span>}
                      </td>
                      <td style={{ ...td, whiteSpace: 'normal', color: '#475569', fontSize: '12px', minWidth: '240px' }}>{e.description}</td>
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
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Run a settlement</h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
              Runs automatically at 00:05 IST for the previous day. Use this to settle or retry a finished day manually.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={settleDate} max={lastSettleableDate} onChange={(e) => setSettleDate(e.target.value)} style={{ padding: '7px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <button onClick={runSettlement} disabled={settling || !settleDate} className="primary-btn" style={{ fontSize: '12px', padding: '8px 14px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <Zap size={14} className={settling ? 'animate-spin' : ''} />
              <span>{settling ? 'Settling...' : 'Settle day'}</span>
            </button>
          </div>
        </div>
        {message && (
          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, background: message.type === 'success' ? '#ecfdf5' : '#fef2f2', color: message.type === 'success' ? '#065f46' : '#991b1b' }}>
            {message.text}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '16px' }}>
        <div style={card}>
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 12px' }}>Settlement days</h2>
          {runs.length === 0 ? (
            <EmptyState title="No settlements yet" text="The first settlement runs after the next midnight (IST)." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '11px', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>
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
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: r.businessDate === selectedDate ? '#eff6ff' : 'transparent' }}
                    >
                      <td style={{ ...td, fontWeight: 700 }}>{formatDate(r.businessDate)}</td>
                      <td style={td}><StatusPill status={r.status} /></td>
                      <td style={tdNum}>{r.totals?.earners || 0}</td>
                      <td style={tdNum}>{r.totals?.matches || 0}</td>
                      <td style={tdNum}>{(r.totals?.newLeftBV || 0).toLocaleString('en-IN')}</td>
                      <td style={tdNum}>{(r.totals?.newRightBV || 0).toLocaleString('en-IN')}</td>
                      <td style={{ ...tdNum, fontWeight: 800, color: '#15803d' }}>{inr(r.totals?.creditedAmount)}</td>
                      <td style={{ ...tdNum, color: '#dc2626' }}>{inr(r.totals?.flushedAmount)}</td>
                      <td style={{ ...tdNum, color: r.failures?.length ? '#dc2626' : '#94a3b8' }}>{r.failures?.length || 0}</td>
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
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Members for {formatDate(selectedDate)}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Member ID or name" value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }} />
                <label style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="checkbox" checked={earnersOnly} onChange={(e) => setEarnersOnly(e.target.checked)} /> Earners only
                </label>
              </div>
            </div>
            {t && (
              <p style={{ fontSize: '12.5px', color: '#475569', margin: '0 0 12px' }}>
                {t.closings} member(s) closed · {t.qualifiedMembers} qualified · {t.earners} earner(s) · {t.matches} matches · Earned {inr(t.generatedAmount)} · Credited <strong style={{ color: '#15803d' }}>{inr(t.creditedAmount)}</strong> · Flushed <strong style={{ color: '#dc2626' }}>{inr(t.flushedAmount)}</strong>
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
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '11px', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>
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
                      <tr key={c.closingId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={td}>
                          <button onClick={() => onViewMember(c.memberId)} style={{ background: 'none', border: 'none', padding: 0, color: '#1d4ed8', fontWeight: 700, cursor: 'pointer' }}>
                            {c.memberId}
                          </button>
                          <span style={{ color: '#64748b', marginLeft: '6px' }}>{c.memberName}</span>
                        </td>
                        <td style={tdNum}>{(c.newLeftBV || 0).toLocaleString('en-IN')}</td>
                        <td style={tdNum}>{(c.newRightBV || 0).toLocaleString('en-IN')}</td>
                        <td style={tdNum}>{c.matches}</td>
                        <td style={{ ...tdNum, color: '#64748b' }}>{c.dailyCap > 0 ? inr(c.dailyCap) : '-'}</td>
                        <td style={{ ...tdNum, fontWeight: 800, color: '#15803d' }}>{inr(c.creditedAmount)}</td>
                        <td style={{ ...tdNum, color: c.flushedAmount > 0 ? '#dc2626' : '#94a3b8' }}>{inr(c.flushedAmount)}</td>
                        <td style={td}>{c.creditedAmount > 0 ? (c.walletCredited ? 'Credited' : <span style={{ color: '#dc2626', fontWeight: 700 }}>Pending</span>) : '-'}</td>
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
