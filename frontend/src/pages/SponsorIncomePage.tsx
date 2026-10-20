import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Percent, 
  Sparkles, 
  ShieldCheck, 
  IndianRupee, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  UserCheck, 
  Zap, 
  Info,
  Search,
  Shield
} from 'lucide-react';
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
    <div className="page-body" style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* Top Banner & Header */}
      <div className="welcome-header" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, maxWidth: '100%' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
            <Users size={22} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="page-title" style={{ margin: 0, wordBreak: 'break-word' }}>
              Sponsor Income
            </h1>
            <p className="page-subtitle" style={{ margin: '3px 0 0 0', lineHeight: 1.4, wordBreak: 'break-word' }}>
              {rate}% of the daily binary income of every member you sponsored directly, paid on top of theirs
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', maxWidth: '100%' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '20px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
            <Zap size={14} /> 100% Uncapped
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '20px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
            <ShieldCheck size={14} /> Their Income Not Reduced
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '20px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
            <Percent size={14} /> 100% Net Direct Payout
          </span>
          <button
            onClick={fetchSponsorIncomeData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '6px 12px', borderRadius: '8px', background: '#f8fafc', color: '#475569', fontWeight: 600, border: '1px solid #e2e8f0', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Super Admin Audit Banner & Member Inspector */}
      {isAdmin && (
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          borderRadius: '12px',
          color: '#ffffff',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 4px 14px rgba(30, 27, 75, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 320px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={20} color="#a5b4fc" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#e0e7ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Super Admin Audit Mode</span>
                <span style={{ fontSize: '11px', background: '#4338ca', color: '#c7d2fe', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  Read-Only Audit
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#c7d2fe', lineHeight: 1.4 }}>
                Administrators do not earn commission payouts. You are inspecting network distributor <strong>{activeMemberName ? `${activeMemberName} (${activeMemberId})` : activeMemberId}</strong>.
              </p>
            </div>
          </div>

          {/* Member Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <label htmlFor="audit-member-select" style={{ fontSize: '12.5px', fontWeight: 600, color: '#e0e7ff' }}>
              Select Member to Audit:
            </label>
            <select
              id="audit-member-select"
              value={activeMemberId}
              onChange={(e) => setActiveMemberId(e.target.value)}
              style={{
                background: '#0f172a',
                color: '#ffffff',
                border: '1px solid #4338ca',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none'
              }}
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

      {error && (
        <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#b91c1c', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, maxWidth: '100%', wordBreak: 'break-word' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !kpis.isEnabled && (
        <div style={{ padding: '14px 18px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', color: '#92400e', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>Sponsor income is currently switched off in Income Settings. No new sponsor income is being paid.</span>
        </div>
      )}

      {/* 4 Top KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        {/* KPI 1 */}
        <div className="dashboard-card" style={{ padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)', border: '1px solid #e0e7ff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>
              {isAdmin ? `Sponsor Income of ${activeMemberName || activeMemberId}` : 'Total Sponsor Income'}
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IndianRupee size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e1b4b', marginBottom: '6px' }}>
            {inr(kpis.totalNetCredited)}
          </div>
          <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
            This month: {inr(kpis.thisMonth)} • Zero deductions
          </div>
        </div>

        {/* KPI 2 */}
        <div className="dashboard-card" style={{ padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)', border: '1px solid #dbeafe', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>
              {isAdmin ? `Direct Team of ${activeMemberId}` : 'Direct Team Members'}
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e3a8a', marginBottom: '6px' }}>
            {kpis.directTeamCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {isAdmin ? (
              <>Members sponsored by: <strong>{activeMemberName ? `${activeMemberName} (${activeMemberId})` : activeMemberId}</strong></>
            ) : (
              <>Members sponsored by your ID: <strong>{activeMemberId}</strong></>
            )}
          </div>
        </div>

        {/* KPI 3 */}
        <div className="dashboard-card" style={{ padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)', border: '1px solid #d1fae5', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>Earning Direct Referrals</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#064e3b', marginBottom: '6px' }}>
            {kpis.earningDirectsCount}
          </div>
          <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
            {kpis.directTeamCount > 0 ? `${((kpis.earningDirectsCount / kpis.directTeamCount) * 100).toFixed(0)}%` : '0%'} {isAdmin ? `of ${activeMemberId}'s direct team earning binary income` : 'of your direct team earning binary income'}
          </div>
        </div>

        {/* KPI 4 */}
        <div className="dashboard-card" style={{ padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)', border: '1px solid #fef3c7', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>Sponsor Bonus Rate</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Percent size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#78350f', marginBottom: '6px' }}>
            {kpis.appliedRatePercent}% Flat
          </div>
          <div style={{ fontSize: '12px', color: '#d97706', fontWeight: 600 }}>
            Uncapped • Direct sponsor only • Paid daily
          </div>
        </div>
      </div>

      {/* Somras™ Core Rules Box (Transparent Member Rules) */}
      <div className="dashboard-card" style={{ padding: '22px', borderRadius: '14px', background: '#ffffff', border: '1px solid #e2e8f0', marginBottom: '24px', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Info size={16} />
          </div>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0, wordBreak: 'break-word' }}>
            How Sponsor Income Works
          </h2>
        </div>

        <div className="sponsor-rules-grid">
          {/* Rule Item 1 */}
          <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CheckCircle2 size={16} color="#4f46e5" style={{ flexShrink: 0 }} />
              <strong style={{ fontSize: '13px', color: '#1e293b' }}>{rate}% of Each Direct's Daily Binary Income</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Each day, when a member you sponsored directly is paid binary income, you receive <strong>{rate}% of the amount credited to them</strong>. Example: they are paid ₹1,000, you get ₹{(1000 * rate / 100).toLocaleString('en-IN')}.
            </p>
          </div>

          {/* Rule Item 2 */}
          <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0 }} />
              <strong style={{ fontSize: '13px', color: '#1e293b' }}>Their Income Is Not Reduced</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Sponsor income is paid by the company <strong>on top</strong>. Your direct members keep 100% of their own binary income. It doesn't matter where they are placed in the tree.
            </p>
          </div>

          {/* Rule Item 3 */}
          <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CheckCircle2 size={16} color="#d97706" style={{ flexShrink: 0 }} />
              <strong style={{ fontSize: '13px', color: '#1e293b' }}>100% Uncapped (No Daily Cap)</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Package daily capping limits only apply to binary matching income. <strong>Sponsor income has no daily cap</strong> and is credited to your wallet with the daily binary settlement.
            </p>
          </div>
        </div>
      </div>

      {/* Main Section: Direct Team Members & Money Earned Through Each Sponsor Member */}
      <div className="dashboard-card" style={{ padding: '24px', borderRadius: '14px', background: '#ffffff', border: '1px solid #e2e8f0', marginBottom: '24px', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ minWidth: 0, flex: '1 1 280px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0, wordBreak: 'break-word' }}>
              {isAdmin ? `Direct Team Sponsored by ${activeMemberName ? `${activeMemberName} (${activeMemberId})` : activeMemberId}` : 'Direct Team Members & Sponsor Earnings Breakdown'}
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}>
              {isAdmin ? `All members directly sponsored by ${activeMemberId}, their binary income, and the ${rate}% sponsor income credited to ${activeMemberId}` : 'All members sponsored by you, their binary income, and how much sponsor income you earned from each person'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0, width: '100%', maxWidth: '100%' }}>
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '140px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search member name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', flexShrink: 0 }}>
              {(['ALL', 'LEFT', 'RIGHT'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setFilterPosition(pos)}
                  style={{
                    padding: '7px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: 'none',
                    background: filterPosition === pos ? '#4f46e5' : '#f8fafc',
                    color: filterPosition === pos ? '#ffffff' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredDirects.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <Users size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No direct team members found matching your search.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', minWidth: '780px', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Direct Member Name</th>
                  <th style={{ padding: '12px' }}>Member ID</th>
                  <th style={{ padding: '12px' }}>Leg Position</th>
                  <th style={{ padding: '12px' }}>Package</th>
                  <th style={{ padding: '12px' }}>Their Binary Income</th>
                  <th style={{ padding: '12px' }}>{isAdmin ? `${rate}% Sponsor Income to ${activeMemberId}` : `Your ${rate}% Sponsor Income`}</th>
                  <th style={{ padding: '12px' }}>{isAdmin ? `Net Credited to ${activeMemberId}` : 'Net Credited to Wallet'}</th>
                  <th style={{ padding: '12px' }}>Last Credited</th>
                </tr>
              </thead>
              <tbody>
                {filteredDirects.map((direct: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px', flexShrink: 0 }}>
                          {direct.name?.charAt(0)?.toUpperCase() || 'M'}
                        </div>
                        <div>
                          <strong style={{ color: '#0f172a', display: 'block', fontSize: '13px' }}>{direct.name}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Joined: {direct.joinDate ? new Date(direct.joinDate).toLocaleDateString() : '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#475569', fontSize: '12px' }}>
                        {direct.memberId}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: direct.position?.toUpperCase() === 'LEFT' ? '#eff6ff' : '#f5f3ff',
                        color: direct.position?.toUpperCase() === 'LEFT' ? '#2563eb' : '#7c3aed'
                      }}>
                        {direct.position?.toUpperCase() || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#475569', fontWeight: 600 }}>
                      {direct.packageName || 'Starter'}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>
                      ₹{direct.binaryEarnings.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#4338ca' }}>
                      ₹{direct.sponsorBonusGenerated.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 800, color: '#059669', fontSize: '14px' }}>
                      ₹{direct.sponsorBonusNet.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', color: '#64748b', fontSize: '12px' }}>
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
      <div className="dashboard-card" style={{ padding: '24px', borderRadius: '14px', background: '#ffffff', border: '1px solid #e2e8f0', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '18px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0, wordBreak: 'break-word' }}>
            {isAdmin ? `Recent Sponsor Income of ${activeMemberId}` : 'Recent Sponsor Income'}
          </h2>
          <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}>
            Each row is one sponsored member's binary income for one day and the {rate}% credited {isAdmin ? `to ${activeMemberId}` : 'to your wallet'}
          </span>
        </div>

        {recentPayouts.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <Sparkles size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No sponsor income credited yet.</p>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>It appears after each daily binary settlement in which {isAdmin ? `${activeMemberId}'s` : 'your'} direct members earn binary income.</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', minWidth: '650px', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Day</th>
                  <th style={{ padding: '12px' }}>Sponsored Member</th>
                  <th style={{ padding: '12px' }}>Their Binary Income</th>
                  <th style={{ padding: '12px' }}>Rate</th>
                  <th style={{ padding: '12px' }}>{isAdmin ? 'Sponsor Income' : 'Your Sponsor Income'}</th>
                </tr>
              </thead>
              <tbody>
                {recentPayouts.map((payout: any) => (
                  <tr key={payout.ledgerId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', color: '#475569', fontWeight: 600 }}>
                      {payout.businessDate
                        ? new Date(`${payout.businessDate}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
                        : new Date(payout.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#1e293b' }}>
                      {payout.sourceMemberName ? `${payout.sourceMemberName} (${payout.sourceMemberId})` : payout.sourceMemberId}
                    </td>
                    <td style={{ padding: '12px', color: '#0f172a' }}>
                      {payout.baseAmount ? inr(payout.baseAmount) : '—'}
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>
                      {payout.ratePercent ? `${payout.ratePercent}%` : '—'}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 800, color: '#10b981' }}>
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
