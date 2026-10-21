import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, EmptyState, LoadingState, PageHeader, SegmentedControl } from '../components/ui';
import { RefreshCw, Trophy } from 'lucide-react';
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

const MEDALS = ['var(--warning)', 'var(--text-light)', 'var(--warning-hover)'];

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

  const th: React.CSSProperties = { whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { whiteSpace: 'nowrap' };

  return (
    <div className="page-body" style={{ maxWidth: 1100 }}>
      <PageHeader
        title="Binary Leaderboard"
        subtitle={`Top binary income earners from settled days${data ? ` (${formatDate(data.from)} – ${formatDate(data.to)})` : ''}.`}
        actions={
          <button type="button" onClick={load} className="btn btn-secondary btn-icon" title="Refresh" aria-label="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <SegmentedControl
          ariaLabel="Period"
          value={period}
          onChange={(v) => setPeriod(v as typeof period)}
          options={PERIODS.map((p) => ({ value: p.id, label: p.label }))}
        />
      </div>

      {data?.me && !isAdmin && (
        <Alert tone="info">
          Your rank: <strong>#{data.me.rank}</strong> of {data.totalEarners} · {inr(data.me.creditedAmount)} from {data.me.matches} match(es)
        </Alert>
      )}

      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        {error ? (
          <div style={{ padding: 'var(--space-4)' }}><Alert tone="error" style={{ marginBottom: 0 }}>{error}</Alert></div>
        ) : loading && !data ? (
          <LoadingState label="Loading leaderboard…" />
        ) : !data?.leaders?.length ? (
          <EmptyState icon={<Trophy size={22} />} title="No settled income yet" text="No binary income has been settled in this period." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={th}>Rank</th>
                  <th style={th}>Member</th>
                  <th style={{ ...th, textAlign: 'right' }}>Matches</th>
                  <th style={{ ...th, textAlign: 'right' }}>Binary income</th>
                  {isAdmin && <th style={{ ...th, textAlign: 'right' }}>Flushed</th>}
                </tr>
              </thead>
              <tbody>
                {(data?.leaders || []).map((r: any) => (
                  <tr key={r.rank} style={r.isMe ? { background: 'var(--primary-light)' } : undefined}>
                    <td style={{ ...td, fontWeight: 700, color: MEDALS[r.rank - 1] || 'var(--text-body)' }}>
                      {r.rank <= 3 ? <Trophy size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} /> : null}#{r.rank}
                    </td>
                    <td style={td}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.memberName}</span>
                      {r.memberId && <span className="text-mono" style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{r.memberId}</span>}
                      {r.isMe && <Badge tone="primary" className="ml-2">You</Badge>}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{r.matches}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--success-hover)' }}>{inr(r.creditedAmount)}</td>
                    {isAdmin && <td style={{ ...td, textAlign: 'right', color: 'var(--danger)' }}>{inr(r.flushedAmount)}</td>}
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
