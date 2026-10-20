import React, { useCallback, useEffect, useState } from 'react';
import { Trophy, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface BinaryLeaderboardPageProps {
  user?: any;
  token?: string | null;
}

type Period = 'day' | 'week' | 'month';

const inr = (n: number | null | undefined) => `₹${(n || 0).toLocaleString('en-IN')}`;
const formatDate = (d: string) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: 'day', label: 'Yesterday' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'Last 30 days' },
];

const MEDALS = ['#f59e0b', '#94a3b8', '#b45309'];

export const BinaryLeaderboardPage: React.FC<BinaryLeaderboardPageProps> = ({ user, token }) => {
  const savedToken = token || localStorage.getItem('wetala_token') || '';
  const isAdmin = user?.role?.toLowerCase() === 'superadmin';
  const [period, setPeriod] = useState<Period>('week');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBinaryLeaderboard({ period, limit: 50 }, savedToken);
      if (res?.status) setData(res.data);
      else setError(res?.message || 'Could not load the leaderboard.');
    } catch (err: any) {
      setError(err.message || 'Could not load the leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [period, savedToken]);

  useEffect(() => {
    load();
  }, [load]);

  const th: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap' };

  return (
    <div className="page-body" style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div className="welcome-header" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trophy size={24} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Binary Leaderboard</h1>
            <p className="page-subtitle" style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Top binary income earners from settled days{data ? ` (${formatDate(data.from)} – ${formatDate(data.to)})` : ''}.
            </p>
          </div>
        </div>
        <button onClick={load} className="secondary-btn" style={{ fontSize: '12px', padding: '8px 12px' }} title="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            style={{ fontSize: '12.5px', fontWeight: 700, padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: period === p.id ? '#0f172a' : '#ffffff', color: period === p.id ? '#ffffff' : '#475569', cursor: 'pointer' }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {data?.me && !isAdmin && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: '16px', fontSize: '13px', color: '#1e3a8a' }}>
          Your rank: <strong>#{data.me.rank}</strong> of {data.totalEarners} · {inr(data.me.creditedAmount)} from {data.me.matches} match(es)
        </div>
      )}

      <div style={{ padding: '18px', borderRadius: '14px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
        {error ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#b91c1c', background: '#fef2f2', borderRadius: '10px' }}>
            <AlertCircle size={22} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>{error}</p>
          </div>
        ) : !loading && !data?.leaders?.length ? (
          <div style={{ padding: '44px 16px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '10px', fontSize: '13px' }}>
            No binary income has been settled in this period yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '11px', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={th}>Rank</th>
                  <th style={th}>Member</th>
                  <th style={{ ...th, textAlign: 'right' }}>Matches</th>
                  <th style={{ ...th, textAlign: 'right' }}>Binary income</th>
                  {isAdmin && <th style={{ ...th, textAlign: 'right' }}>Flushed</th>}
                </tr>
              </thead>
              <tbody>
                {(data?.leaders || []).map((r: any) => (
                  <tr key={r.rank} style={{ borderBottom: '1px solid #f1f5f9', background: r.isMe ? '#eff6ff' : 'transparent' }}>
                    <td style={{ ...td, fontWeight: 800, color: MEDALS[r.rank - 1] || '#334155' }}>
                      {r.rank <= 3 ? <Trophy size={14} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> : null}#{r.rank}
                    </td>
                    <td style={td}>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{r.memberName}</span>
                      {r.memberId && <span style={{ color: '#64748b', marginLeft: '6px' }}>{r.memberId}</span>}
                      {r.isMe && <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 800, color: '#1d4ed8' }}>YOU</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{r.matches}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#15803d' }}>{inr(r.creditedAmount)}</td>
                    {isAdmin && <td style={{ ...td, textAlign: 'right', color: '#dc2626' }}>{inr(r.flushedAmount)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
