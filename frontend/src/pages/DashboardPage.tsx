import React, { useState, useEffect } from 'react';
import { api, type DashboardStats } from '../services/api';
import { 
  Users, 
  UserPlus, 
  IndianRupee, 
  Wallet, 
  Calendar, 
  TrendingUp, 
  ShoppingBag, 
  ShoppingCart, 
  Award,
  Package,
  ArrowUpRight,
  GitMerge,
  Zap,
  Gift,
  CheckCircle2,
  XCircle,
  Sparkles,
  ExternalLink,
  Search,
  X
} from 'lucide-react';

interface DashboardPageProps {
  user?: any;
  onNavigate: (tab: string) => void;
  onOpenAddMember: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, onNavigate, onOpenAddMember }) => {
  const [trendRange, setTrendRange] = useState('30');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [welcomeBonus, setWelcomeBonus] = useState<any>(null);
  const [settling, setSettling] = useState(false);
  const [settleMsg, setSettleMsg] = useState('');
  const [isFullPayoutModalOpen, setIsFullPayoutModalOpen] = useState(false);
  const [showAllInline, setShowAllInline] = useState(false);
  const [payoutSearch, setPayoutSearch] = useState('');
  const [payoutFilterSettlement, setPayoutFilterSettlement] = useState('ALL');
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin';

  const loadWelcomeBonus = () => {
    const memberIdToFetch = user?.memberId || 'MEM0001';
    api.getWelcomeBonusMemberStatus(memberIdToFetch)
      .then((res: any) => {
        if (res?.status && res?.data) {
          setWelcomeBonus(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load Welcome Bonus status:', err);
      });
  };

  useEffect(() => {
    let isMounted = true;
    api.getDashboardStats()
      .then((data: any) => {
        if (isMounted) {
          setStats(data);
        }
      })
      .catch((err) => {
        console.error('Failed to load dashboard stats:', err);
      });
    loadWelcomeBonus();
    return () => { isMounted = false; };
  }, [user?.memberId]);

  const handleRunSettlement = async () => {
    setSettling(true);
    setSettleMsg('');
    try {
      const res = await api.settleWelcomeBonus();
      if (res?.status) {
        setSettleMsg(`✓ ${res.message || 'Settlement completed'}`);
        loadWelcomeBonus();
      } else {
        setSettleMsg(`⚠ ${res?.message || 'Settlement failed'}`);
      }
    } catch (err: any) {
      setSettleMsg(`⚠ ${err.message || 'Settlement error'}`);
    } finally {
      setSettling(false);
    }
  };

  // Live registrations data
  const fallbackRegistrations = [
    { name: 'Amit Kumar', id: 'MEM0126', package: 'Premium', bv: '5,000 BV', date: '12 Sep 2025', status: 'Active', leg: 'LEFT' },
    { name: 'Priya Singh', id: 'MEM0125', package: 'Basic', bv: '1,250 BV', date: '12 Sep 2025', status: 'Active', leg: 'RIGHT' },
    { name: 'Neha Verma', id: 'MEM0124', package: 'Premium', bv: '5,000 BV', date: '11 Sep 2025', status: 'Active', leg: 'LEFT' },
    { name: 'Suresh Yadav', id: 'MEM0123', package: 'Basic', bv: '1,250 BV', date: '11 Sep 2025', status: 'Active', leg: 'RIGHT' },
    { name: 'Manish Jain', id: 'MEM0122', package: 'Elite', bv: '10,000 BV', date: '10 Sep 2025', status: 'Active', leg: 'LEFT' }
  ];

  const recentRegistrations = stats?.recentMembers && stats.recentMembers.length > 0
    ? stats.recentMembers
    : fallbackRegistrations;

  const recentPayouts = [
    { member: 'Ramesh Kumar', id: 'MEM0120', amount: '₹ 12,500', net: '₹ 11,250', date: '12 Sep 2025', status: 'Paid' },
    { member: 'Sunita Devi', id: 'MEM0119', amount: '₹ 8,000', net: '₹ 7,200', date: '11 Sep 2025', status: 'Paid' },
    { member: 'Amit Sharma', id: 'MEM0118', amount: '₹ 6,400', net: '₹ 5,760', date: '10 Sep 2025', status: 'Pending' },
    { member: 'Pooja Singh', id: 'MEM0121', amount: '₹ 5,200', net: '₹ 4,680', date: '10 Sep 2025', status: 'Paid' },
    { member: 'Rajesh Meena', id: 'MEM0117', amount: '₹ 4,800', net: '₹ 4,320', date: '09 Sep 2025', status: 'Paid' }
  ];

  return (
    <div className="page-body">
      {/* Welcome Banner */}
      <div className="welcome-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 800, 
              background: '#dbeafe', 
              color: '#1d4ed8', 
              padding: '3px 10px', 
              borderRadius: '9999px',
              letterSpacing: '0.5px'
            }}>
              COMPENSATION PORTAL ACTIVE
            </span>
          </div>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="page-subtitle">Real-time performance analytics, binary volumes, and automated payout ledger.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="date-pill">
            <Calendar size={15} color="#64748b" />
            <span>Today, 12 Sep 2025</span>
          </div>

          <button onClick={onOpenAddMember} className="primary-btn">
            <UserPlus size={16} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Top KPI Metrics */}
      <div className={`kpi-grid ${isAdmin ? 'kpi-grid-6' : ''}`}>
        {/* Total Members */}
        <div className="kpi-card kpi-card-blue">
          <div className="kpi-icon-box kpi-icon-blue">
            <Users size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Distributors</div>
            <div className="kpi-value">{stats ? stats.totalMembers.toLocaleString() : '13'}</div>
            <div className="kpi-trend-pill kpi-trend-up">
              <ArrowUpRight size={13} />
              <span>{stats?.quickStats?.activePercent ?? 100}% Active Network</span>
            </div>
          </div>
        </div>

        {/* New Registrations */}
        <div className="kpi-card kpi-card-green">
          <div className="kpi-icon-box kpi-icon-green">
            <UserPlus size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">New Registrations</div>
            <div className="kpi-value">{stats ? stats.newRegistrations.toLocaleString() : '13'}</div>
            <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
              {stats?.registrationsToday ? `Today: +${stats.registrationsToday} joined` : 'Verified & Active'}
            </div>
          </div>
        </div>

        {/* Total Gross Value */}
        <div className="kpi-card kpi-card-gold">
          <div className="kpi-icon-box kpi-icon-gold">
            <IndianRupee size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Gross Value</div>
            <div className="kpi-value">
              ₹ {stats ? (stats.totalGrossValue || stats.totalJoiningRevenue || stats.totalPackagePrice || 73500).toLocaleString() : '73,500'}
            </div>
            <div className="kpi-trend-pill kpi-trend-up">
              <ArrowUpRight size={13} />
              <span>All-Time Turnover</span>
            </div>
          </div>
        </div>

        {/* Weekly Gross Value (Admin Dedicated Card) */}
        {isAdmin && (
          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)', border: '1px solid #a7f3d0' }}>
            <div className="kpi-icon-box" style={{ background: '#d1fae5', color: '#059669' }}>
              <Gift size={26} />
            </div>
            <div className="kpi-content">
              <div className="kpi-label" style={{ color: '#065f46', fontWeight: 700 }}>Weekly Gross Volume</div>
              <div className="kpi-value" style={{ color: '#047857' }}>
                {(stats?.weeklyGrossBusinessVolume || stats?.weeklyGrossValue || welcomeBonus?.currentWeeklyCompanyGBV || 7200).toLocaleString()} <span style={{ fontSize: '15px', fontWeight: 700 }}>BV</span>
              </div>
              <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700, marginTop: '3px' }}>
                4% Pool: {Math.round(((stats?.weeklyGrossBusinessVolume || stats?.weeklyGrossValue || welcomeBonus?.currentWeeklyCompanyGBV || 7200) * 0.04)).toLocaleString()} BV / week
              </div>
            </div>
          </div>
        )}

        {/* Total Business Volume Generated (Admin) */}
        {isAdmin && (
          <div className="kpi-card kpi-card-purple">
            <div className="kpi-icon-box kpi-icon-purple">
              <Zap size={26} />
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Total Business Volume</div>
              <div className="kpi-value" style={{ color: '#7c3aed' }}>
                {(stats?.totalBusinessVolume || stats?.totalBV || 27500).toLocaleString()} <span style={{ fontSize: '15px', fontWeight: 700 }}>BV</span>
              </div>
              <div className="kpi-trend-pill" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                <ArrowUpRight size={13} />
                <span>Generated BV</span>
              </div>
            </div>
          </div>
        )}

        {/* Total Joining Package Value (Top Right Card) */}
        <div className="kpi-card kpi-card-coral">
          <div className="kpi-icon-box kpi-icon-coral">
            <Wallet size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">{isAdmin ? 'Total Joining Price' : 'Total Payouts'}</div>
            <div className="kpi-value">
              ₹ {stats ? (stats.totalPackagePrice || stats.totalJoiningRevenue || 73500).toLocaleString() : '73,500'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              {isAdmin ? (
                <>Price Total of <strong style={{ color: '#059669' }}>{stats ? stats.totalMembers : '13'} Joined Members</strong></>
              ) : (
                <>Pending: <strong style={{ color: '#d97706' }}>₹ {stats?.pendingPayouts ? stats.pendingPayouts.toLocaleString() : '0'}</strong></>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Binary Volume Live Matching & Capping Strip */}
      <div className="dashboard-card" style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <div className="card-header-row" style={{ marginBottom: '16px' }}>
          <div className="card-title-group">
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '10px', 
              background: '#eff6ff', 
              color: '#2563eb', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <GitMerge size={20} />
            </div>
            <div>
              <h2 className="card-title">{isAdmin ? 'Live Binary Volume Matching & Engine' : 'Live Binary Volume Matching & Daily Cap'}</h2>
              <p style={{ fontSize: '12px', color: '#64748b' }}>Root Distributor Node: <strong>MEM0001 (Rohit Sharma)</strong></p>
            </div>
          </div>

          <button 
            onClick={() => onNavigate('income-settings')} 
            className="primary-btn" 
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            <Zap size={14} /> Open Simulator
          </button>
        </div>

        {/* Binary Volume Split Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '20px', alignItems: 'center' }}>
          {/* Leg Balance Meter */}
          <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>LEFT LEG: 15,000 BV</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>RIGHT LEG: 12,000 BV</span>
            </div>

            {/* Split Bar */}
            <div style={{ height: '12px', width: '100%', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: '55%', background: '#3b82f6' }} title="Left Leg: 15,000 BV" />
              <div style={{ width: '45%', background: '#10b981' }} title="Right Leg: 12,000 BV" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
              <span>Matched: <strong style={{ color: '#0f172a' }}>12,000 BV</strong></span>
              <span>Carry Left: <strong style={{ color: '#2563eb' }}>3,000 BV</strong></span>
            </div>
          </div>

          {/* Raw Commission Estimate */}
          <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Standard Binary Commission (20%)</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)', margin: '4px 0' }}>
              ₹ 2,400
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
              Calculated on 12,000 Matched BV
            </div>
          </div>

          {/* Daily Cap / Payout Policy Progress */}
          <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            {isAdmin ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  <span>Payout Limit Policy</span>
                  <span style={{ color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px' }}>Uncapped</span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)', margin: '8px 0 4px' }}>
                  Super Admin Account
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Binary capping is disabled for Admin roles.
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  <span>Daily Cap Utilization</span>
                  <span style={{ color: '#d97706', fontWeight: 700 }}>60%</span>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden', margin: '8px 0' }}>
                  <div style={{ width: '60%', height: '100%', background: 'linear-gradient(90deg, #f59e0b, #d97706)', borderRadius: '9999px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                  <span>Earned Today: <strong>₹ 2,400</strong></span>
                  <span>Cap: <strong>₹ {user?.dailyCapping ? user.dailyCapping.toLocaleString() : '4,000'}</strong></span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Standalone Welcome Bonus Dashboard Section */}
      <div className="dashboard-card" style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #ffffff 0%, #fdfefe 100%)', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <div className="card-header-row" style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title-group">
            <div style={{ 
              width: '38px', 
              height: '38px', 
              borderRadius: '10px', 
              background: '#ecfdf5', 
              color: '#059669', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Gift size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 className="card-title" style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Welcome Bonus</h2>
                <span style={{ 
                  padding: '3px 10px', 
                  borderRadius: '9999px', 
                  fontSize: '11px', 
                  fontWeight: 700,
                  background: (welcomeBonus?.status === 'Eligible' || (!welcomeBonus && true)) ? '#ecfdf5' : welcomeBonus?.status === 'Cap Reached' ? '#fef3c7' : '#fee2e2',
                  color: (welcomeBonus?.status === 'Eligible' || (!welcomeBonus && true)) ? '#059669' : welcomeBonus?.status === 'Cap Reached' ? '#d97706' : '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {(welcomeBonus?.status === 'Eligible' || (!welcomeBonus && true)) ? '✓ Eligible' : welcomeBonus?.status === 'Cap Reached' ? '⚡ 2× Cap Reached' : '✗ Ineligible'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Weekly 4% Company GBV Pool equally divided among members with active Left & Right wings (2× Lifetime Cap)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isAdmin && (
              <button
                onClick={handleRunSettlement}
                disabled={settling}
                className="primary-btn"
                style={{ fontSize: '12px', padding: '7px 16px', background: '#059669', borderColor: '#059669' }}
              >
                <Sparkles size={14} />
                {settling ? 'Settling...' : 'Run Weekly Settlement'}
              </button>
            )}
            <button 
              onClick={() => onNavigate('income-settings')} 
              className="secondary-btn" 
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              Configure Rules
            </button>
          </div>
        </div>

        {settleMsg && (
          <div style={{ 
            padding: '10px 16px', 
            borderRadius: '8px', 
            fontSize: '13px', 
            fontWeight: 600, 
            marginBottom: '16px',
            background: settleMsg.startsWith('✓') ? '#ecfdf5' : '#fef2f2',
            color: settleMsg.startsWith('✓') ? '#059669' : '#dc2626',
            border: `1px solid ${settleMsg.startsWith('✓') ? '#a7f3d0' : '#fecaca'}`
          }}>
            {settleMsg}
          </div>
        )}

        {/* Member Cap & Weekly Pool 2-Column Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          
          {/* Card 1: 2x Cap & Lifetime Earned */}
          <div style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Lifetime 2× Capping
              </span>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                Multiplier: 2×
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Qualifying Business Volume</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  {welcomeBonus ? `${welcomeBonus.qualifyingBusinessVolume.toLocaleString()} BV` : '—'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Maximum Welcome Bonus</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>
                  {welcomeBonus ? `${welcomeBonus.maximumWelcomeBonus.toLocaleString()} BV` : '—'}
                </span>
              </div>
            </div>

            {/* Cap Progress Bar */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>
                  Total Welcome Bonus Earned: <strong style={{ color: '#0f172a' }}>{welcomeBonus ? `${(welcomeBonus.totalWelcomeBonusEarned || 0).toLocaleString()} BV` : '0 BV'}</strong>
                </span>
                <span style={{ color: '#059669', fontWeight: 700 }}>
                  Remaining: {welcomeBonus ? `${(welcomeBonus.remainingBonus || 0).toLocaleString()} BV` : '—'}
                </span>
              </div>
              <div style={{ height: '8px', width: '100%', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    width: `${welcomeBonus && welcomeBonus.maximumWelcomeBonus ? Math.min(100, Math.round(((welcomeBonus.totalWelcomeBonusEarned || 0) / welcomeBonus.maximumWelcomeBonus) * 100)) : 0}%`, 
                    background: 'linear-gradient(90deg, #10b981, #059669)', 
                    borderRadius: '9999px' 
                  }} 
                />
              </div>
            </div>
          </div>

          {/* Card 2: Current Weekly Settlement Pool */}
          <div style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Current Weekly Pool Metrics
              </span>
              <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, background: '#eff6ff', padding: '2px 8px', borderRadius: '9999px' }}>
                Rate: 4% Pool
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Current Weekly Company GBV</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  {welcomeBonus ? `${welcomeBonus.currentWeeklyCompanyGBV.toLocaleString()} BV` : '—'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Welcome Bonus Pool (4%)</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>
                  {welcomeBonus ? `${welcomeBonus.welcomeBonusPool.toLocaleString()} BV` : '—'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Eligible Members</span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  {welcomeBonus ? `${welcomeBonus.eligibleMembers} members` : '—'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>This Week's Share</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>
                  {welcomeBonus ? `${welcomeBonus.thisWeeksShare.toLocaleString()} BV` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Wings Verification Status */}
          <div style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>
                Wing Eligibility Criteria
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Left Wing Active Member</span>
                  {(welcomeBonus?.leftWing ?? true) ? (
                    <span style={{ color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                      <CheckCircle2 size={16} /> ✓
                    </span>
                  ) : (
                    <span style={{ color: '#dc2626', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                      <XCircle size={16} /> ✗
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Right Wing Active Member</span>
                  {(welcomeBonus?.rightWing ?? true) ? (
                    <span style={{ color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                      <CheckCircle2 size={16} /> ✓
                    </span>
                  ) : (
                    <span style={{ color: '#dc2626', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                      <XCircle size={16} /> ✗
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '12px', fontSize: '11px', color: '#64748b' }}>
              Condition: 1 Left + 1 Right complete & lifetime earnings below 2× cap.
            </div>
          </div>
        </div>

        {/* Welcome Bonus History Table */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                Welcome Bonus Payout History
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Distributors paid weekly 4% pool business volume
              </span>
            </div>
            {welcomeBonus?.history && welcomeBonus.history.length > 0 && (
              <button
                onClick={() => setIsFullPayoutModalOpen(true)}
                className="secondary-btn"
                style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
              >
                <ExternalLink size={13} />
                Show More ({welcomeBonus.history.length})
              </button>
            )}
          </div>

          <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ fontSize: '11px', padding: '10px 14px' }}>Member</th>
                  <th style={{ fontSize: '11px', padding: '10px 14px' }}>Settlement ID</th>
                  <th style={{ fontSize: '11px', padding: '10px 14px' }}>Date</th>
                  <th style={{ fontSize: '11px', padding: '10px 14px' }}>Company GBV</th>
                  <th style={{ fontSize: '11px', padding: '10px 14px' }}>Total Pool (4%)</th>
                  <th style={{ fontSize: '11px', padding: '10px 14px' }}>Paid Business Volume</th>
                  <th style={{ fontSize: '11px', padding: '10px 14px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {welcomeBonus?.history && welcomeBonus.history.length > 0 ? (
                  (showAllInline ? welcomeBonus.history : welcomeBonus.history.slice(0, 3)).map((row: any, idx: number) => (
                    <tr key={row.transactionId || idx}>
                      <td style={{ fontSize: '12px', padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.memberName || row.memberId}</div>
                        <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>{row.memberId}</div>
                      </td>
                      <td style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>{row.settlementId}</td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>{row.date || 'Recent'}</td>
                      <td style={{ fontSize: '12px', color: '#0f172a' }}>{(row.companyGrossBusinessVolume || 0).toLocaleString()} BV</td>
                      <td style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{(row.totalBonusPool || 0).toLocaleString()} BV</td>
                      <td style={{ fontSize: '13px', fontWeight: 800, color: '#059669' }}>
                        +{(row.actualPayout || 0).toLocaleString()} BV
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        <span style={{ background: '#ecfdf5', color: '#059669', padding: '3px 9px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700 }}>
                          Credited ✓
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
                      No settlement transactions recorded yet. Click "Run Weekly Settlement" to process this week's pool.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Bar with "Show More" Button */}
          {welcomeBonus?.history && welcomeBonus.history.length > 3 && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '12px 16px', 
              background: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              borderTop: 'none', 
              borderBottomLeftRadius: '10px', 
              borderBottomRightRadius: '10px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                Showing <strong>{showAllInline ? welcomeBonus.history.length : Math.min(3, welcomeBonus.history.length)}</strong> of <strong>{welcomeBonus.history.length}</strong> paid members
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowAllInline(!showAllInline)}
                  className="secondary-btn"
                  style={{ fontSize: '12px', padding: '5px 12px' }}
                >
                  {showAllInline ? 'Show Less' : `Show More (${welcomeBonus.history.length - 3} more)`}
                </button>
                <button
                  onClick={() => setIsFullPayoutModalOpen(true)}
                  className="primary-btn"
                  style={{ fontSize: '12px', padding: '5px 14px', background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <ExternalLink size={12} />
                  Open Whole Page
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Middle Grid: Trend Chart & Quick Stats */}
      <div className="dashboard-grid-2">
        {/* Registrations Trend Chart */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <div className="card-title-group">
              <TrendingUp size={20} color="#2563eb" />
              <div>
                <h2 className="card-title">Network Growth Trend</h2>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Daily distributor enrollments & team activations</span>
              </div>
            </div>
            <select 
              className="pill-select" 
              value={trendRange}
              onChange={(e) => setTrendRange(e.target.value)}
            >
              <option value="30">Last 30 Days</option>
              <option value="7">Last 7 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>

          {/* SVG Trend Graph */}
          <div style={{ height: '230px', width: '100%', position: 'relative' }}>
            <svg viewBox="0 0 600 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="20" x2="580" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="65" x2="580" y2="65" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="110" x2="580" y2="110" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="155" x2="580" y2="155" stroke="#f1f5f9" strokeDasharray="3 3" />

              {/* Axis labels */}
              <text x="20" y="24" fontSize="10" fill="#94a3b8" fontWeight="600">50</text>
              <text x="20" y="69" fontSize="10" fill="#94a3b8" fontWeight="600">40</text>
              <text x="20" y="114" fontSize="10" fill="#94a3b8" fontWeight="600">30</text>
              <text x="20" y="159" fontSize="10" fill="#94a3b8" fontWeight="600">10</text>

              {/* Area & Polyline */}
              <path
                d="M 50 160 L 110 145 L 170 152 L 230 115 L 290 128 L 350 140 L 410 100 L 470 108 L 530 65 L 560 50 L 560 180 L 50 180 Z"
                fill="url(#trendGradient)"
              />
              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="50,160 110,145 170,152 230,115 290,128 350,140 410,100 470,108 530,65 560,50"
              />

              {/* Interactive Dots */}
              {[
                { cx: 50, cy: 160 }, { cx: 110, cy: 145 }, { cx: 170, cy: 152 },
                { cx: 230, cy: 115 }, { cx: 290, cy: 128 }, { cx: 350, cy: 140 },
                { cx: 410, cy: 100 }, { cx: 470, cy: 108 }, { cx: 530, cy: 65 }, { cx: 560, cy: 50 }
              ].map((pt, i) => (
                <circle key={i} cx={pt.cx} cy={pt.cy} r="4.5" fill="#ffffff" stroke="#2563eb" strokeWidth="3" />
              ))}

              {/* Date Markers */}
              <text x="50" y="195" fontSize="10" fill="#94a3b8" fontWeight="600" textAnchor="middle">13 Aug</text>
              <text x="170" y="195" fontSize="10" fill="#94a3b8" fontWeight="600" textAnchor="middle">21 Aug</text>
              <text x="290" y="195" fontSize="10" fill="#94a3b8" fontWeight="600" textAnchor="middle">29 Aug</text>
              <text x="410" y="195" fontSize="10" fill="#94a3b8" fontWeight="600" textAnchor="middle">06 Sep</text>
              <text x="540" y="195" fontSize="10" fill="#94a3b8" fontWeight="600" textAnchor="middle">12 Sep</text>
            </svg>
          </div>
        </div>

        {/* Quick Stats Panel */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <h2 className="card-title">Network Vital Stats</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Active Members */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Active Distributors</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {stats?.quickStats?.activeMembers ?? (stats ? stats.totalMembers : 11)} ({stats?.quickStats?.activePercent ?? 100}%)
                </span>
              </div>
              <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: `${stats?.quickStats?.activePercent ?? 100}%`, height: '100%', background: '#10b981', borderRadius: '9999px' }} />
              </div>
            </div>

            {/* Inactive Members */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Inactive Distributors</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {stats?.quickStats?.inactiveMembers ?? 0} ({100 - (stats?.quickStats?.activePercent ?? 100)}%)
                </span>
              </div>
              <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: `${100 - (stats?.quickStats?.activePercent ?? 100)}%`, height: '100%', background: '#ef4444', borderRadius: '9999px' }} />
              </div>
            </div>

            {/* Total Orders */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShoppingBag size={18} color="#8b5cf6" />
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Total Package Orders</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                {stats ? stats.totalMembers.toLocaleString() : '13'}
              </span>
            </div>

            {/* Total Business Volume Generated */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Zap size={18} color="#7c3aed" />
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Total Business Volume (BV)</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#7c3aed' }}>
                {(stats?.totalBusinessVolume || stats?.totalBV || 27500).toLocaleString()} BV
              </span>
            </div>

            {/* Product Sales */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShoppingCart size={18} color="#0284c7" />
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Repurchase Turnover</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>₹ 12,40,000</span>
            </div>

            {/* Ranks Achieved */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={18} color="#f59e0b" />
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Rank Achievers</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>32</span>
            </div>
          </div>
        </div>
      </div>

      {/* Split Tables: Recent Registrations & Recent Payouts */}
      <div className="dashboard-grid-2">
        {/* Recent Registrations Table */}
        <div className="dashboard-card" style={{ padding: '24px 0 0' }}>
          <div className="card-header-row" style={{ padding: '0 24px 16px' }}>
            <h2 className="card-title">Recent Enrollments</h2>
            <button onClick={() => onNavigate('members')} className="primary-btn" style={{ fontSize: '11px', padding: '6px 12px' }}>
              View All
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member</th>
                  <th>Package</th>
                  <th>BV</th>
                  <th>Placement</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRegistrations.map((row, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{row.id}</div>
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: row.package === 'Elite' ? '#fdf2f8' : row.package === 'Premium' ? '#f5f3ff' : '#eff6ff',
                        color: row.package === 'Elite' ? '#db2777' : row.package === 'Premium' ? '#7c3aed' : '#2563eb'
                      }}>
                        {row.package}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#059669' }}>{row.bv}</td>
                    <td>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: row.leg === 'LEFT' ? '#2563eb' : '#10b981',
                        background: row.leg === 'LEFT' ? '#eff6ff' : '#ecfdf5',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        {row.leg}
                      </span>
                    </td>
                    <td>
                      <span className="status-pill status-active">{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Payouts Table */}
        <div className="dashboard-card" style={{ padding: '24px 0 0' }}>
          <div className="card-header-row" style={{ padding: '0 24px 16px' }}>
            <h2 className="card-title">Recent Payout Transactions</h2>
            <button onClick={() => onNavigate('wallet-payouts')} className="primary-btn" style={{ fontSize: '11px', padding: '6px 12px' }}>
              View All
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Net Payout</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPayouts.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.member}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{row.id}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{row.net}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>Gross: {row.amount}</div>
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>{row.date}</td>
                    <td>
                      <span className={`status-pill ${row.status === 'Paid' ? 'status-paid' : 'status-pending'}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Action Strip */}
      <div className="quick-actions-strip">
        <button onClick={onOpenAddMember} className="quick-action-btn">
          <UserPlus size={20} color="#2563eb" />
          <span>Add Member</span>
        </button>

        <button onClick={() => onNavigate('genealogy')} className="quick-action-btn">
          <GitMerge size={20} color="#059669" />
          <span>Genealogy Tree</span>
        </button>

        <button onClick={() => onNavigate('income-settings')} className="quick-action-btn">
          <Zap size={20} color="#d97706" />
          <span>Rule Simulator</span>
        </button>

        <button onClick={() => onNavigate('packages')} className="quick-action-btn">
          <Package size={20} color="#7c3aed" />
          <span>Joining Packages</span>
        </button>

        <button onClick={() => onNavigate('wallet-payouts')} className="quick-action-btn">
          <Wallet size={20} color="#dc2626" />
          <span>Process Payouts</span>
        </button>
      </div>

      {/* FULL PAGE MODAL: Complete Welcome Bonus Payout Ledger */}
      {isFullPayoutModalOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setIsFullPayoutModalOpen(false)}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '18px',
              width: '100%',
              maxWidth: '1100px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '42px', 
                  height: '42px', 
                  borderRadius: '12px', 
                  background: '#ecfdf5', 
                  color: '#059669', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Gift size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Welcome Bonus Payout History — Whole Page View
                    </h2>
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '9999px', 
                      background: '#eff6ff', 
                      color: '#2563eb', 
                      fontSize: '11px', 
                      fontWeight: 700 
                    }}>
                      {(welcomeBonus?.history || []).length} Total Payouts
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                    Complete audit of every distributor who received the weekly 4% pool Business Volume
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsFullPayoutModalOpen(false)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal KPI Highlights */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '12px', 
              padding: '16px 24px', 
              background: '#f8fafc', 
              borderBottom: '1px solid #e2e8f0' 
            }}>
              <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>TOTAL DISTRIBUTED BV</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#059669' }}>
                  {(welcomeBonus?.history || []).reduce((sum: number, r: any) => sum + (Number(r.actualPayout) || 0), 0).toLocaleString()} BV
                </span>
              </div>
              <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>PAID DISTRIBUTORS</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  {(welcomeBonus?.history || []).length} members
                </span>
              </div>
              <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>CURRENT WEEK POOL</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb' }}>
                  {(welcomeBonus?.welcomeBonusPool || 0).toLocaleString()} BV
                </span>
              </div>
              <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>LATEST SETTLEMENT</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#7c3aed' }}>
                  {(welcomeBonus?.history || [])[0]?.settlementId || 'SETTLE-2026-W40'}
                </span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div style={{ 
              padding: '14px 24px', 
              borderBottom: '1px solid #f1f5f9', 
              display: 'flex', 
              gap: '12px', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              flexWrap: 'wrap'
            }}>
              <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search by member name, ID or settlement..."
                  value={payoutSearch}
                  onChange={(e) => setPayoutSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Settlement:</label>
                <select
                  value={payoutFilterSettlement}
                  onChange={(e) => setPayoutFilterSettlement(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    background: '#ffffff'
                  }}
                >
                  <option value="ALL">All Settlements</option>
                  {Array.from(new Set((welcomeBonus?.history || []).map((r: any) => r.settlementId).filter(Boolean))).map((sId: any) => (
                    <option key={sId} value={sId}>{sId}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scrollable Table Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
              <table className="data-table" style={{ margin: 0, width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                  <tr>
                    <th style={{ fontSize: '11px', padding: '12px 16px' }}>Member</th>
                    <th style={{ fontSize: '11px', padding: '12px 16px' }}>Settlement ID</th>
                    <th style={{ fontSize: '11px', padding: '12px 16px' }}>Settlement Date</th>
                    <th style={{ fontSize: '11px', padding: '12px 16px' }}>Company Weekly GBV</th>
                    <th style={{ fontSize: '11px', padding: '12px 16px' }}>Total Bonus Pool</th>
                    <th style={{ fontSize: '11px', padding: '12px 16px' }}>Paid Business Volume</th>
                    <th style={{ fontSize: '11px', padding: '12px 16px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(welcomeBonus?.history || [])
                    .filter((row: any) => {
                      const q = payoutSearch.toLowerCase().trim();
                      const matchesSearch = !q ||
                        (row.memberId && String(row.memberId).toLowerCase().includes(q)) ||
                        (row.memberName && String(row.memberName).toLowerCase().includes(q)) ||
                        (row.settlementId && String(row.settlementId).toLowerCase().includes(q));
                      const matchesSettlement = payoutFilterSettlement === 'ALL' || row.settlementId === payoutFilterSettlement;
                      return matchesSearch && matchesSettlement;
                    })
                    .map((row: any, idx: number) => (
                      <tr key={row.transactionId || idx}>
                        <td style={{ fontSize: '13px', padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.memberName || row.memberId}</div>
                          <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>{row.memberId}</div>
                        </td>
                        <td style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{row.settlementId}</td>
                        <td style={{ fontSize: '12px', color: '#64748b' }}>{row.date || 'Recent'}</td>
                        <td style={{ fontSize: '13px', color: '#0f172a' }}>{(row.companyGrossBusinessVolume || 0).toLocaleString()} BV</td>
                        <td style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{(row.totalBonusPool || 0).toLocaleString()} BV</td>
                        <td style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                          +{(row.actualPayout || 0).toLocaleString()} BV
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <span style={{ background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700 }}>
                            Credited ✓
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid #f1f5f9',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Total Paid Members: <strong>{(welcomeBonus?.history || []).length}</strong>
              </span>
              <button
                onClick={() => setIsFullPayoutModalOpen(false)}
                className="secondary-btn"
                style={{ fontSize: '13px', padding: '6px 18px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
