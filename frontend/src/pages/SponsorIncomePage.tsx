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
  Search
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
  const currentMemberId = user?.memberId || 'MEM0001';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPosition, setFilterPosition] = useState<'ALL' | 'LEFT' | 'RIGHT'>('ALL');

  useEffect(() => {
    fetchSponsorIncomeData();
  }, [currentMemberId]);

  const fetchSponsorIncomeData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getSponsorIncomeSummary(currentMemberId, savedToken);
      if (res.status && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Failed to load Sponsor Binary Income data.');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching Sponsor Binary Income.');
    } finally {
      setLoading(false);
    }
  };

  const kpis = data?.kpis || {
    totalGrossBonus: 0,
    totalTdsDeducted: 0,
    totalAdminFeeDeducted: 0,
    totalNetCredited: 0,
    directTeamCount: 0,
    earningDirectsCount: 0,
    appliedRatePercent: 20,
    isUncapped: true,
    noLegRequirement: true,
    deductions: {
      isEnabled: true,
      tdsPercent: 5,
      adminFeePercent: 5,
      netPercent: 90,
    },
  };

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

  const deductions = kpis.deductions || {
    isEnabled: true,
    tdsPercent: 5,
    adminFeePercent: 5,
    netPercent: 90,
  };

  return (
    <div className="page-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Banner & Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
                <Users size={22} />
              </div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Sponsor Binary Income
                </h1>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                  20% Direct Matching Bonus on all binary income earned by your direct team
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '20px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Zap size={14} /> 100% Uncapped
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '20px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ShieldCheck size={14} /> Single-Leg Qualified
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '20px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Percent size={14} /> {deductions.isEnabled ? `${deductions.tdsPercent}% TDS + ${deductions.adminFeePercent}% Admin Fee (${deductions.netPercent}% Net)` : 'Zero Deductions (100% Net)'}
            </span>
            <button
              onClick={fetchSponsorIncomeData}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '7px 14px', borderRadius: '8px', background: '#f8fafc', color: '#475569', fontWeight: 600, border: '1px solid #e2e8f0', cursor: 'pointer' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#b91c1c', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Top KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* KPI 1 */}
        <div className="dashboard-card" style={{ padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)', border: '1px solid #e0e7ff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>Total Net Credited to Wallet</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IndianRupee size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e1b4b', marginBottom: '6px' }}>
            ₹{kpis.totalNetCredited.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Gross: ₹{kpis.totalGrossBonus.toLocaleString()} • Deductions: -₹{(kpis.totalTdsDeducted + kpis.totalAdminFeeDeducted).toLocaleString()}
          </div>
        </div>

        {/* KPI 2 */}
        <div className="dashboard-card" style={{ padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)', border: '1px solid #dbeafe', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>Direct Team Members</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e3a8a', marginBottom: '6px' }}>
            {kpis.directTeamCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Members sponsored by your ID: <strong>{currentMemberId}</strong>
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
            {kpis.directTeamCount > 0 ? `${((kpis.earningDirectsCount / kpis.directTeamCount) * 100).toFixed(0)}%` : '0%'} of your direct team earning binary income
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
            Uncapped • 0% Daily Limit • Single Leg Eligible
          </div>
        </div>
      </div>

      {/* Somras™ Core Rules Box (Transparent Member Rules) */}
      <div className="dashboard-card" style={{ padding: '22px', borderRadius: '14px', background: '#ffffff', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Info size={16} />
          </div>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Sponsor Binary Income Rules & Payout Policy
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {/* Rule Item 1 */}
          <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CheckCircle2 size={16} color="#4f46e5" />
              <strong style={{ fontSize: '13px', color: '#1e293b' }}>20% on Direct's Binary Income</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Whenever any member in your Left or Right direct team earns binary matching income (₹250 per cycle), you receive <strong>20% (₹50 per cycle)</strong> directly.
            </p>
          </div>

          {/* Rule Item 2 */}
          <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CheckCircle2 size={16} color="#059669" />
              <strong style={{ fontSize: '13px', color: '#1e293b' }}>No Leg Balancing Required</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Both Left and Right legs do <strong>NOT</strong> need to be balanced. You earn even if income is generated exclusively from Left leg, Right leg, or a single active direct member.
            </p>
          </div>

          {/* Rule Item 3 */}
          <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CheckCircle2 size={16} color="#d97706" />
              <strong style={{ fontSize: '13px', color: '#1e293b' }}>100% Uncapped (No Daily Cap)</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Package daily capping limits only apply to binary matching income. <strong>Sponsor Binary Bonus has NO daily capping</strong> and is paid completely.
            </p>
          </div>

          {/* Rule Item 4 */}
          <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CheckCircle2 size={16} color="#7c3aed" />
              <strong style={{ fontSize: '13px', color: '#1e293b' }}>Wallet Settlement & Deductions</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              {deductions.isEnabled ? (
                <>Standard <strong>{deductions.tdsPercent}% TDS + {deductions.adminFeePercent}% Admin fee</strong> → Net <strong>{deductions.netPercent}%</strong> is credited directly to your wallet balance.</>
              ) : (
                <>Zero Deductions: <strong>100% Net</strong> is credited directly to your wallet balance with ₹0 deductions.</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Section: Direct Team Members & Money Earned Through Each Sponsor Member */}
      <div className="dashboard-card" style={{ padding: '24px', borderRadius: '14px', background: '#ffffff', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Direct Team Members & Sponsor Earnings Breakdown
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              All members sponsored by you, their binary earnings, and how much money you earned from each person
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search member name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '220px' }}
              />
            </div>
            <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
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
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            <Users size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No direct team members found matching your search.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Direct Member Name</th>
                  <th style={{ padding: '12px' }}>Member ID</th>
                  <th style={{ padding: '12px' }}>Leg Position</th>
                  <th style={{ padding: '12px' }}>Package</th>
                  <th style={{ padding: '12px' }}>Their Binary Income</th>
                  <th style={{ padding: '12px' }}>Your 20% Sponsor Bonus</th>
                  <th style={{ padding: '12px' }}>Net Credited to Wallet</th>
                  <th style={{ padding: '12px' }}>Last Bonus Credited</th>
                </tr>
              </thead>
              <tbody>
                {filteredDirects.map((direct: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px' }}>
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

      {/* Recent Sponsor Bonus Payout Ledger */}
      <div className="dashboard-card" style={{ padding: '24px', borderRadius: '14px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: '18px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Recent Sponsor Bonus Wallet Credits
          </h2>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Live record of 20% sponsor bonuses credited directly into your wallet
          </span>
        </div>

        {recentPayouts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            <Sparkles size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No sponsor bonus credits recorded yet.</p>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Bonus credits will appear automatically as soon as your direct referrals complete binary cycles.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Ledger ID</th>
                  <th style={{ padding: '12px' }}>Source Direct Member</th>
                  <th style={{ padding: '12px' }}>Gross Bonus</th>
                  <th style={{ padding: '12px' }}>TDS ({deductions.tdsPercent}%)</th>
                  <th style={{ padding: '12px' }}>Admin ({deductions.adminFeePercent}%)</th>
                  <th style={{ padding: '12px' }}>Net Credited to Wallet</th>
                  <th style={{ padding: '12px' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentPayouts.map((payout: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#64748b', fontSize: '12px' }}>
                      {payout.ledgerId}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#1e293b' }}>
                      {payout.sourceMemberId}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>
                      ₹{payout.grossAmount}
                    </td>
                    <td style={{ padding: '12px', color: '#ef4444', fontWeight: 600 }}>
                      - ₹{payout.tdsDeduction}
                    </td>
                    <td style={{ padding: '12px', color: '#f59e0b', fontWeight: 600 }}>
                      - ₹{payout.adminFee}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 800, color: '#10b981' }}>
                      + ₹{payout.netPayable}
                    </td>
                    <td style={{ padding: '12px', color: '#64748b', fontSize: '12px' }}>
                      {new Date(payout.createdAt).toLocaleDateString()}
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
