import React, { useState, useEffect } from 'react';
import { Alert, Badge, EmptyState, PageHeader, SegmentedControl } from '../components/ui';
import { CheckCircle2, IndianRupee, Info, Percent, RefreshCw, Search, Shield, Sparkles, UserCheck, Users } from 'lucide-react';

import { api } from '../services/api';

interface SponsorIncomePageProps {
  user?: any;
  token?: string | null;
}

export const SponsorIncomePage: React.FC<SponsorIncomePageProps> = ({ user: propUser, token: propToken }) => {
  const savedToken = propToken || localStorage.getItem('wetala_token') || '';
  const savedUserStr = localStorage.getItem('wetala_user');
  const user = propUser || (savedUserStr ? JSON.parse(savedUserStr) : null);
  const isAdmin = user?.role?.toLowerCase() === 'superadmin' || user?.role?.toLowerCase() === 'admin';
  const defaultMemberId = isAdmin ? 'MEM0001' : (user?.memberId || 'MEM0001');

  const [activeMemberId, setActiveMemberId] = useState(defaultMemberId);
  const [allMembers, setAllMembers] = useState<Array<{ memberId: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPosition, setFilterPosition] = useState<'ALL' | 'LEFT' | 'RIGHT'>('ALL');

  // If Super Admin, fetch members list for the audit dropdown selector
  useEffect(() => {
    if (isAdmin) {
      api.getMembers(savedToken).then((membersList: any) => {
        if (Array.isArray(membersList) && membersList.length > 0) {
          const list = membersList
            .map((m: any) => ({ memberId: m.memberId || m.id, name: m.name }))
            .filter((m: any) => Boolean(m.memberId));
          setAllMembers(list);
          if (list.length > 0 && !list.some((m: any) => m.memberId === activeMemberId)) {
            setActiveMemberId(list[0].memberId);
          }
        }
      }).catch((e: any) => console.error('Failed to load members list for sponsor audit', e));
    }
  }, [isAdmin, savedToken]);

  useEffect(() => {
    fetchSponsorIncomeData();
  }, [activeMemberId]);

  const fetchSponsorIncomeData = async () => {
    if (!activeMemberId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getSponsorIncomeSummary(activeMemberId, savedToken);
      if (res.status && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Failed to load sponsor income.');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching sponsor income.');
    } finally {
      setLoading(false);
    }
  };

  const activeMemberName = data?.memberName || '';

  const kpis = data?.kpis || {
    totalGrossBonus: 0,
    totalNetCredited: 0,
    thisMonth: 0,
    directTeamCount: 0,
    earningDirectsCount: 0,
    appliedRatePercent: 20,
    isUncapped: true,
    noLegRequirement: true,
    isEnabled: true,
  };
  const rate = kpis.appliedRatePercent;
  const inr = (value: number) => `₹${(value || 0).toLocaleString('en-IN')}`;

  const directTeam = data?.directTeamBreakdown || [];
  const recentPayouts = data?.recentPayouts || [];

  const filteredDirects = directTeam.filter((d: any) => {
    const matchesSearch = 
      d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.memberId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPos = 
      filterPosition === 'ALL' || 
      d.position?.toUpperCase() === filterPosition;
    return matchesSearch && matchesPos;
  });

  return (
    <div className="page-body">
      <PageHeader
        title="Sponsor Income"
        subtitle={`${rate}% of the daily binary income of every member you sponsored directly, paid on top of theirs.`}
        actions={
          <button type="button" onClick={fetchSponsorIncomeData} className="btn btn-secondary">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {isAdmin && (
        <div className="card toolbar-card">
          <div className="icon-text" style={{ flex: '1 1 320px', minWidth: 0 }}>
            <Shield size={16} aria-hidden="true" />
            <span style={{ color: 'var(--text-secondary)' }}>
              Admin view (read-only). Inspecting{' '}
              <strong style={{ color: 'var(--text-main)' }}>{activeMemberName ? `${activeMemberName} (${activeMemberId})` : activeMemberId}</strong>
            </span>
          </div>
          <div className="icon-text">
            <label htmlFor="audit-member-select" className="form-label">Member</label>
            <select
              id="audit-member-select"
              value={activeMemberId}
              onChange={(e) => setActiveMemberId(e.target.value)}
              className="form-select"
              style={{ width: 'auto', minWidth: 220 }}
            >
              {allMembers.length > 0 ? (
                allMembers.map((m) => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.memberId} - {m.name} {m.memberId === 'MEM0001' ? '(Root Member)' : ''}
                  </option>
                ))
              ) : (
                <option value={activeMemberId}>{activeMemberId} - Root Member</option>
              )}
            </select>
          </div>
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {!loading && !kpis.isEnabled && (
        <Alert tone="warning">Sponsor income is switched off in Income Settings. No new sponsor income is being paid.</Alert>
      )}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-purple"><IndianRupee size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">{isAdmin ? `Sponsor income of ${activeMemberName || activeMemberId}` : 'Total sponsor income'}</div>
            <div className="kpi-value">{inr(kpis.totalNetCredited)}</div>
            <div className="kpi-sub">This month {inr(kpis.thisMonth)} · no deductions</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-blue"><Users size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Direct team</div>
            <div className="kpi-value">{kpis.directTeamCount}</div>
            <div className="kpi-sub">Sponsored by {activeMemberId}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-green"><UserCheck size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Earning directs</div>
            <div className="kpi-value">{kpis.earningDirectsCount}</div>
            <div className="kpi-sub">
              {kpis.directTeamCount > 0 ? `${((kpis.earningDirectsCount / kpis.directTeamCount) * 100).toFixed(0)}%` : '0%'} of the direct team earning binary income
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-gold"><Percent size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Sponsor bonus rate</div>
            <div className="kpi-value">{kpis.appliedRatePercent}%</div>
            <div className="kpi-sub">Flat · uncapped · paid daily</div>
          </div>
        </div>
      </div>

      {/* How sponsor income works */}
      <div className="dashboard-card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span className="icon-tile tone-purple" style={{ width: 32, height: 32 }}><Info size={16} /></span>
          <h2 className="card-title">How Sponsor Income Works</h2>
        </div>

        <div className="sponsor-rules-grid">
          {/* Rule Item 1 */}
          <div className="stat-panel is-muted" style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CheckCircle2 size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
              <strong style={{ fontSize: 'var(--fs-base)', color: 'var(--text-strong)' }}>{rate}% of Each Direct's Daily Binary Income</strong>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Each day, when a member you sponsored directly is paid binary income, you receive <strong>{rate}% of the amount credited to them</strong>. Example: they are paid ₹1,000, you get ₹{(1000 * rate / 100).toLocaleString('en-IN')}.
            </p>
          </div>

          {/* Rule Item 2 */}
          <div className="stat-panel is-muted" style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0 }} />
              <strong style={{ fontSize: 'var(--fs-base)', color: 'var(--text-strong)' }}>Their Income Is Not Reduced</strong>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Sponsor income is paid by the company <strong>on top</strong>. Your direct members keep 100% of their own binary income. It doesn't matter where they are placed in the tree.
            </p>
          </div>

          {/* Rule Item 3 */}
          <div className="stat-panel is-muted" style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CheckCircle2 size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
              <strong style={{ fontSize: 'var(--fs-base)', color: 'var(--text-strong)' }}>100% Uncapped (No Daily Cap)</strong>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Package daily capping limits only apply to binary matching income. <strong>Sponsor income has no daily cap</strong> and is credited to your wallet with the daily binary settlement.
            </p>
          </div>
        </div>
      </div>

      {/* Main Section: Direct Team Members & Money Earned Through Each Sponsor Member */}
      <div className="dashboard-card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ minWidth: 0, flex: '1 1 280px' }}>
            <h2 className="card-title">
              {isAdmin ? `Direct Team Sponsored by ${activeMemberName ? `${activeMemberName} (${activeMemberId})` : activeMemberId}` : 'Direct Team Members & Sponsor Earnings Breakdown'}
            </h2>
            <span className="card-subtitle" style={{ display: 'block' }}>
              {isAdmin ? `All members directly sponsored by ${activeMemberId}, their binary income, and the ${rate}% sponsor income credited to ${activeMemberId}` : 'All members sponsored by you, their binary income, and how much sponsor income you earned from each person'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0, width: '100%', maxWidth: '100%' }}>
            <div className="filter-search-box" style={{ minWidth: 180 }}>
              <Search size={15} className="search-icon" aria-hidden="true" />
              <input
                type="text"
                aria-label="Search direct members"
                placeholder="Search member name or ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <SegmentedControl
              ariaLabel="Filter by leg"
              value={filterPosition}
              onChange={(v) => setFilterPosition(v as typeof filterPosition)}
              options={[{ value: 'ALL', label: 'All' }, { value: 'LEFT', label: 'Left' }, { value: 'RIGHT', label: 'Right' }]}
            />
          </div>
        </div>

        {filteredDirects.length === 0 ? (
          <EmptyState compact icon={<Users size={22} />} title="No direct members found" text={searchTerm ? 'Try a different search.' : undefined} />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Direct Member Name</th>
                  <th>Member ID</th>
                  <th>Leg Position</th>
                  <th>Package</th>
                  <th>Their Binary Income</th>
                  <th>{isAdmin ? `${rate}% Sponsor Income to ${activeMemberId}` : `Your ${rate}% Sponsor Income`}</th>
                  <th>{isAdmin ? `Net Credited to ${activeMemberId}` : 'Net Credited to Wallet'}</th>
                  <th>Last Credited</th>
                </tr>
              </thead>
              <tbody>
                {filteredDirects.map((direct: any, idx: number) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 'var(--fs-sm)', flexShrink: 0 }}>
                          {direct.name?.charAt(0)?.toUpperCase() || 'M'}
                        </div>
                        <div>
                          <strong style={{ color: 'var(--text-main)', display: 'block', fontSize: 'var(--fs-base)' }}>{direct.name}</strong>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Joined: {direct.joinDate ? new Date(direct.joinDate).toLocaleDateString() : '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
                        {direct.memberId}
                      </span>
                    </td>
                    <td>
                      <Badge tone={direct.position?.toUpperCase() === 'LEFT' ? 'primary' : 'accent'}>{direct.position?.toUpperCase() || 'N/A'}</Badge>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {direct.packageName || 'Starter'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      ₹{direct.binaryEarnings.toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-hover)' }}>
                      ₹{direct.sponsorBonusGenerated.toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--success)' }}>
                      ₹{direct.sponsorBonusNet.toLocaleString()}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {direct.lastBonusAt ? new Date(direct.lastBonusAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent sponsor income credits, one row per sponsored member per day */}
      <div className="dashboard-card">
        <div style={{ marginBottom: '18px' }}>
          <h2 className="card-title">
            {isAdmin ? `Recent Sponsor Income of ${activeMemberId}` : 'Recent Sponsor Income'}
          </h2>
          <span className="card-subtitle" style={{ display: 'block' }}>
            Each row is one sponsored member's binary income for one day and the {rate}% credited {isAdmin ? `to ${activeMemberId}` : 'to your wallet'}
          </span>
        </div>

        {recentPayouts.length === 0 ? (
          <EmptyState compact icon={<Sparkles size={22} />} title="No sponsor income credited yet" text={<>It appears after each daily binary settlement in which {isAdmin ? `${activeMemberId}'s` : 'your'} direct members earn binary income.</>} />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Sponsored Member</th>
                  <th>Their Binary Income</th>
                  <th>Rate</th>
                  <th>{isAdmin ? 'Sponsor Income' : 'Your Sponsor Income'}</th>
                </tr>
              </thead>
              <tbody>
                {recentPayouts.map((payout: any) => (
                  <tr key={payout.ledgerId}>
                    <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {payout.businessDate
                        ? new Date(`${payout.businessDate}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
                        : new Date(payout.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-strong)' }}>
                      {payout.sourceMemberName ? `${payout.sourceMemberName} (${payout.sourceMemberId})` : payout.sourceMemberId}
                    </td>
                    <td style={{ color: 'var(--text-main)' }}>
                      {payout.baseAmount ? inr(payout.baseAmount) : '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {payout.ratePercent ? `${payout.ratePercent}%` : '—'}
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--success)' }}>
                      + {inr(payout.netPayable ?? payout.grossAmount)}
                    </td>
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

export default SponsorIncomePage;
