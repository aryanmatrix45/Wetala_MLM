import React, { useState, useEffect } from 'react';
import { api, type DashboardStats, type BVSummary } from '../services/api';
import { AlertCircle, ArrowDownRight, Award, BarChart3, Calendar, Check, CheckCircle2, Coins, CreditCard, ExternalLink, Gift, GitMerge, IndianRupee, Package, PlusCircle, Search, ShoppingBag, ShoppingCart, Sparkles, UserPlus, Users, Wallet, XCircle, Zap } from 'lucide-react';
import { WithdrawModal } from '../components/WithdrawModal';
import { AdminWithdrawalActionModal, type AdminActionType } from '../components/AdminWithdrawalActionModal';
import { type WithdrawalRequestItem } from '../services/api';
import { Alert, Badge, Modal, PageHeader, StatusBadge } from '../components/ui';

interface DashboardPageProps {
  user?: any;
  onNavigate: (tab: string) => void;
  initialSection?: string;
}

const SkeletonText: React.FC<{ width?: string | number; height?: string | number; borderRadius?: string | number; style?: React.CSSProperties }> = ({
  width = '100%',
  height = '1em',
  borderRadius = '6px',
  style,
}) => (
  <span
    className="skeleton-shimmer"
    style={{
      width,
      height,
      borderRadius,
      ...style,
    }}
  />
);

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, onNavigate, initialSection }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [welcomeBonus, setWelcomeBonus] = useState<any>(null);
  const [welcomeBonusLoading, setWelcomeBonusLoading] = useState(true);
  const [bvSummary, setBvSummary] = useState<BVSummary | null>(null);
  const [sponsorIncome, setSponsorIncome] = useState<{ total: number; thisMonth: number; ratePercent: number } | null>(null);
  const [settling, setSettling] = useState(false);
  const [settleMsg, setSettleMsg] = useState('');
  const [settleWeek, setSettleWeek] = useState('');
  const [isFullPayoutModalOpen, setIsFullPayoutModalOpen] = useState(false);
  const [showAllInline, setShowAllInline] = useState(false);
  const [payoutSearch, setPayoutSearch] = useState('');
  const [payoutFilterSettlement, setPayoutFilterSettlement] = useState('ALL');
  const isAdmin = user?.role?.toLowerCase() === 'superadmin' || user?.role?.toLowerCase() === 'admin';
  // Binary status: live BV summary when loaded (personal + BV Wallet), otherwise the login profile
  const binaryActive = bvSummary ? bvSummary.binary.isActive : (user?.personalBv || 0) >= 100;
  const statusBV = bvSummary ? bvSummary.totalBV : (user?.personalBv || 0);
  const currentMemberId = user?.memberId || 'MEM0001';
  const effectivePayouts: any[] = isAdmin 
    ? (welcomeBonus?.history || [])
    : (welcomeBonus?.history || []).filter((r: any) => r.memberId === currentMemberId);

  // Withdrawal Request System State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminModalAction, setAdminModalAction] = useState<AdminActionType>('APPROVE');
  const [selectedWithdrawalRequest, setSelectedWithdrawalRequest] = useState<WithdrawalRequestItem | null>(null);
  const [memberWithdrawalSummary, setMemberWithdrawalSummary] = useState<any>(null);
  const [dashboardWithdrawalRequests, setDashboardWithdrawalRequests] = useState<WithdrawalRequestItem[]>([]);
  const [dashboardWithdrawalKpis, setDashboardWithdrawalKpis] = useState<any>(null);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);

  // Dynamic Binary Volume & Commission Engine State
  const [binaryData, setBinaryData] = useState<any>(null);
  const [binaryLoading, setBinaryLoading] = useState(true);

  useEffect(() => {
    if (initialSection === 'welcome-bonus') {
      const el = document.getElementById('welcome-bonus-section');
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [initialSection]);

  const loadBinaryData = () => {
    setBinaryLoading(true);
    const memberIdToFetch = user?.memberId || 'MEM0001';
    api.getBinaryVolume(memberIdToFetch)
      .then((res: any) => {
        if (res?.status && res?.data) {
          setBinaryData(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load binary volume:', err);
      })
      .finally(() => {
        setBinaryLoading(false);
      });
  };

  const loadWelcomeBonus = () => {
    setWelcomeBonusLoading(true);
    if (isAdmin) {
      api.getWelcomeBonusAdminSummary()
        .then((res: any) => {
          if (res?.status && res?.data) {
            setWelcomeBonus(res.data);
          }
        })
        .catch((err) => {
          console.error('Failed to load Welcome Bonus admin summary:', err);
        })
        .finally(() => {
          setWelcomeBonusLoading(false);
        });
    } else {
      const memberIdToFetch = user?.memberId || 'MEM0001';
      api.getWelcomeBonusMemberStatus(memberIdToFetch)
        .then((res: any) => {
          if (res?.status && res?.data) {
            setWelcomeBonus(res.data);
          }
        })
        .catch((err) => {
          console.error('Failed to load Welcome Bonus status:', err);
        })
        .finally(() => {
          setWelcomeBonusLoading(false);
        });
    }
  };

  const loadWithdrawalData = () => {
    setWithdrawalLoading(true);
    if (isAdmin) {
      api.getAllWithdrawalsAdmin()
        .then((res: any) => {
          if (res?.status && res?.data) {
            setDashboardWithdrawalRequests(res.data);
            if (res.kpis) setDashboardWithdrawalKpis(res.kpis);
          }
        })
        .catch((err) => console.error('Failed to load admin withdrawals on dashboard:', err))
        .finally(() => setWithdrawalLoading(false));
    } else {
      Promise.all([
        api.getMyWithdrawals(undefined, currentMemberId),
        api.getWithdrawalBalanceSummary(currentMemberId)
      ])
        .then(([myReqs, balSum]: any) => {
          if (myReqs?.status && myReqs?.data) {
            setDashboardWithdrawalRequests(myReqs.data);
          }
          if (balSum?.status && balSum?.data) {
            setMemberWithdrawalSummary(balSum.data);
          } else if (myReqs?.summary) {
            setMemberWithdrawalSummary(myReqs.summary);
          }
        })
        .catch((err) => console.error('Failed to load member withdrawals on dashboard:', err))
        .finally(() => setWithdrawalLoading(false));
    }
  };

  useEffect(() => {
    let isMounted = true;
    setStatsLoading(true);
    api.getDashboardStats()
      .then((data: any) => {
        if (isMounted) {
          setStats(data);
        }
      })
      .catch((err) => {
        console.error('Failed to load dashboard stats:', err);
      })
      .finally(() => {
        if (isMounted) {
          setStatsLoading(false);
        }
      });
    loadWelcomeBonus();
    loadWithdrawalData();
    loadBinaryData();
    if (!isAdmin && user?.memberId) {
      api.getBVSummary()
        .then((res) => {
          if (isMounted && res?.status && res.data) setBvSummary(res.data);
        })
        .catch(() => {});
      api.getSponsorIncomeSummary(user.memberId)
        .then((res) => {
          const kpis = res?.data?.kpis;
          if (isMounted && res?.status && kpis) {
            setSponsorIncome({ total: kpis.totalNetCredited || 0, thisMonth: kpis.thisMonth || 0, ratePercent: kpis.appliedRatePercent ?? 20 });
          }
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, [user?.memberId, isAdmin]);

  // Finished weeks not yet settled (newest first), from the admin summary
  const unsettledWeeks: { weekStart: string; weekEnd: string }[] = welcomeBonus?.unsettledWeeks || [];
  const selectedSettleWeek = unsettledWeeks.find((w) => w.weekStart === settleWeek) || unsettledWeeks[0];
  const formatWeekDay = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const handleRunSettlement = async () => {
    if (!selectedSettleWeek) return;
    const weekLabel = `${formatWeekDay(selectedSettleWeek.weekStart)} – ${formatWeekDay(selectedSettleWeek.weekEnd)}`;
    if (!window.confirm(`Settle the welcome bonus for the week ${weekLabel}? BV will be credited to eligible members' BV Wallets.`)) return;
    setSettling(true);
    setSettleMsg('');
    try {
      const res = await api.settleWelcomeBonus({ weekStart: selectedSettleWeek.weekStart });
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

  const recentRegistrations = stats?.recentMembers || [];



  return (
    <div className="page-body">
      {/* Welcome Banner */}
      <PageHeader
        title={isAdmin ? 'Dashboard' : `Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        subtitle={isAdmin ? 'Company performance, binary volume and payouts.' : 'Your volume, binary matching and earnings at a glance.'}
        actions={
          <>
            <div className="date-pill">
              <Calendar size={15} aria-hidden="true" />
              <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            {!isAdmin && (
              <button type="button" onClick={() => setIsWithdrawModalOpen(true)} className="btn btn-success">
                <ArrowDownRight size={16} />
                <span>Withdraw</span>
              </button>
            )}
          </>
        }
      />

      {/* 100 BV Binary Income Tree Participation Banner for Distributors */}
      {/* Live status when loaded; falls back to the profile from login */}
      {!isAdmin && !(bvSummary ? bvSummary.binary.isActive : (user?.personalBv || 0) >= 100) && (
        <Alert tone="warning" title={`Binary income not active yet · ${statusBV.toLocaleString()} / 100 BV`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <span style={{ flex: '1 1 320px' }}>
              You need at least <strong>100 BV</strong> (personal BV plus BV Wallet balance) to join the binary tree and
              earn matching income. Purchase products or receive BV in your BV Wallet to activate.
            </span>
            <button type="button" onClick={() => onNavigate('member-products')} className="btn btn-sm btn-secondary">
              <ShoppingCart size={14} />
              Shop products
            </button>
          </div>
        </Alert>
      )}

      {/* Top KPI Metrics */}
      <div className={`kpi-grid ${isAdmin ? 'kpi-grid-6' : 'kpi-grid-5'}`}>
        {isAdmin ? (
          <>
            {/* Total Distributors (Admin) */}
            <div className="kpi-card kpi-card-blue">
              <div className="kpi-icon-box kpi-icon-blue">
                <Users size={20} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Total Distributors</div>
                <div className="kpi-value">
                  {statsLoading ? <SkeletonText width="60px" height="28px" /> : (stats?.totalMembers ?? 0).toLocaleString()}
                </div>
                <div className="kpi-sub">
                    {statsLoading ? <SkeletonText width="70px" height="12px" /> : `${stats?.quickStats?.activePercent ?? 100}% Active Network`}
                  </div>
              </div>
            </div>

            {/* New Registrations (Admin) */}
            <div className="kpi-card kpi-card-green">
              <div className="kpi-icon-box kpi-icon-green">
                <UserPlus size={20} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">New Registrations</div>
                <div className="kpi-value">
                  {statsLoading ? <SkeletonText width="60px" height="28px" /> : (stats?.newRegistrations ?? 0).toLocaleString()}
                </div>
                <div className="kpi-sub">
                  {statsLoading ? (
                    <SkeletonText width="90px" height="12px" />
                  ) : stats?.registrationsToday ? (
                    `Today: +${stats.registrationsToday} joined`
                  ) : (
                    'Verified & Active'
                  )}
                </div>
              </div>
            </div>

            {/* Total Gross Value (Admin) */}
            <div className="kpi-card kpi-card-gold">
              <div className="kpi-icon-box kpi-icon-gold">
                <IndianRupee size={20} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Total Gross Value</div>
                <div className="kpi-value">
                  ₹ {statsLoading ? (
                    <SkeletonText width="80px" height="28px" />
                  ) : (
                    (stats?.totalGrossValue || stats?.totalJoiningRevenue || stats?.totalPackagePrice || 0).toLocaleString()
                  )}
                </div>
                <div className="kpi-sub">All-time turnover</div>
              </div>
            </div>

            {/* Weekly Gross Volume (Admin) */}
            <div className="kpi-card">
              <div className="kpi-icon-box kpi-icon-green">
                <Gift size={20} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Weekly Gross Volume</div>
                <div className="kpi-value">
                  {statsLoading ? (
                    <SkeletonText width="80px" height="28px" />
                  ) : (
                    (stats?.weeklyGrossBusinessVolume ?? stats?.weeklyGrossValue ?? welcomeBonus?.currentWeeklyCompanyGBV ?? 0).toLocaleString()
                  )}{' '}
                  <span className="kpi-unit">BV</span>
                </div>
                <div className="kpi-sub">
                  {welcomeBonus?.activeRules?.ratePercent ?? 4}% Pool: {statsLoading ? '...' : Math.round(((stats?.weeklyGrossBusinessVolume ?? stats?.weeklyGrossValue ?? welcomeBonus?.currentWeeklyCompanyGBV ?? 0) * ((welcomeBonus?.activeRules?.ratePercent ?? 4) / 100))).toLocaleString()} BV / week
                </div>
              </div>
            </div>

            {/* Total Business Volume Generated (Admin) */}
            <div className="kpi-card kpi-card-purple">
              <div className="kpi-icon-box kpi-icon-purple">
                <Zap size={20} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Total Business Volume</div>
                <div className="kpi-value">
                  {statsLoading ? (
                    <SkeletonText width="80px" height="28px" />
                  ) : (
                    (stats?.totalBusinessVolume ?? stats?.totalBV ?? 0).toLocaleString()
                  )}{' '}
                  <span className="kpi-unit">BV</span>
                </div>
              </div>
            </div>

            {/* Total Joining Package Value (Admin) */}
            <div className="kpi-card kpi-card-coral">
              <div className="kpi-icon-box kpi-icon-coral">
                <Wallet size={20} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Total Joining Price</div>
                <div className="kpi-value">
                  ₹ {statsLoading ? (
                    <SkeletonText width="80px" height="28px" />
                  ) : (
                    (stats?.totalPackagePrice || stats?.totalJoiningRevenue || 0).toLocaleString()
                  )}
                </div>
                <div className="kpi-sub">
                  Price Total of{' '}
                  <strong style={{ color: 'var(--success)' }}>
                    {statsLoading ? '...' : (stats?.totalMembers ?? 0)} Joined Members
                  </strong>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Member Card 1: Membership Status */}
            <div className="kpi-card kpi-card-blue">
              <div className="kpi-icon-box kpi-icon-blue">
                <Award size={20} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Distributor Status</div>
                <div className="kpi-value" style={{ fontSize: 'var(--fs-xl)', color: binaryActive ? 'var(--success)' : 'var(--warning)' }}>
                  {binaryActive ? 'Binary Active' : 'Login Active'}
                </div>
                <div className="kpi-sub" style={{ color: binaryActive ? 'var(--success)' : 'var(--warning-hover)' }}>
                  {binaryActive
                    ? bvSummary?.binary.lockedBV
                      ? `${bvSummary.binary.lockedBV} BV locked for binary activation`
                      : bvSummary?.binary.activationSource === 'BV_WALLET'
                        ? `Activated with BV Wallet (${statusBV.toLocaleString()} BV)`
                        : `Tree Qualified: ${statusBV.toLocaleString()} BV`
                    : `Tree Inactive: ${statusBV}/100 BV`}
                </div>
              </div>
            </div>

            {/* Member Card: Total Business Volume (earned personal BV + spendable BV Wallet) */}
            <div className="kpi-card kpi-card-purple">
              <div className="kpi-icon-box kpi-icon-purple">
                <Coins size={20} />
              </div>
              <div className="kpi-content" style={{ width: '100%' }}>
                <div className="kpi-label">Total Business Volume</div>
                <div className="kpi-value">
                  {bvSummary ? bvSummary.totalBV.toLocaleString('en-IN') : <SkeletonText width="60px" height="28px" />}{' '}
                  <span className="kpi-unit">BV</span>
                </div>
                {bvSummary && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '6px', display: 'grid', gap: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span>Personal BV (earned)</span>
                      <strong style={{ color: 'var(--text-main)' }}>{bvSummary.personal.total.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', paddingLeft: '8px', color: 'var(--text-muted)' }}>
                      <span>Package · Products</span>
                      <span>
                        {bvSummary.personal.package.toLocaleString('en-IN')} · {bvSummary.personal.purchases.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span>BV Wallet (spendable)</span>
                      <strong style={{ color: 'var(--text-main)' }}>{bvSummary.wallet.available.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', paddingLeft: '8px', color: 'var(--text-muted)' }}>
                      <span>incl. welcome bonus</span>
                      <span>{bvSummary.wallet.welcomeBonus.toLocaleString('en-IN')}</span>
                    </div>
                    {bvSummary.binary.lockedBV > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: 'var(--warning-hover)' }}>
                        <span>Locked for binary activation (used once)</span>
                        <strong>−{bvSummary.binary.lockedBV.toLocaleString('en-IN')}</strong>
                      </div>
                    )}
                    {bvSummary.wallet.pendingOrderBV > 0 && (
                      <div style={{ color: 'var(--warning-hover)', fontWeight: 600 }}>
                        {bvSummary.wallet.pendingOrderBV.toLocaleString('en-IN')} BV paid on {bvSummary.wallet.pendingOrders} order(s) awaiting approval
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate('bv-wallet')}
                  className="btn btn-sm btn-soft btn-block"
                  style={{ marginTop: 'var(--space-3)' }}
                >
                  <Coins size={14} />
                  <span>Open BV Wallet</span>
                </button>
              </div>
            </div>

            {/* Member Card 2: Welcome Bonus Earned (Business Volume) */}
            <div className="kpi-card kpi-card-green">
              <div className="kpi-icon-box kpi-icon-green">
                <Gift size={20} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Welcome Bonus Earned</div>
                <div className="kpi-value">
                  {welcomeBonusLoading ? (
                    <SkeletonText width="60px" height="28px" />
                  ) : (
                    (welcomeBonus?.totalWelcomeBonusEarned || 0).toLocaleString()
                  )}{' '}
                  <span className="kpi-unit">BV</span>
                </div>
                <div className="kpi-sub">
                  Remaining Cap: {welcomeBonusLoading ? '...' : (welcomeBonus?.remainingBonus || 0).toLocaleString()} BV
                </div>
              </div>
            </div>

            {/* Member Card 3: Sponsor Income (share of directly sponsored members' daily binary income) */}
            <div
              className="kpi-card"
              onClick={() => onNavigate('sponsor-income')}
              style={{ cursor: 'pointer' }}
            >
              <div className="kpi-icon-box kpi-icon-purple">
                <Users size={20} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Sponsor Income</div>
                <div className="kpi-value">
                  ₹ {sponsorIncome ? sponsorIncome.total.toLocaleString('en-IN') : <SkeletonText width="60px" height="28px" />}
                </div>
                <div className="kpi-sub">
                  This month: ₹ {sponsorIncome ? sponsorIncome.thisMonth.toLocaleString('en-IN') : '...'} • {sponsorIncome?.ratePercent ?? 20}% of directs' binary
                </div>
              </div>
            </div>


            {/* Member Card 4: Total Payout / Available Payout Balance */}
            <div className="kpi-card kpi-card-coral">
              <div className="kpi-icon-box kpi-icon-coral">
                <Wallet size={20} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Available Payout Balance</div>
                <div className="kpi-value">
                  ₹ {withdrawalLoading ? (
                    <SkeletonText width="70px" height="28px" />
                  ) : (
                    (memberWithdrawalSummary?.availablePayout ?? user?.walletBalance ?? 0).toLocaleString()
                  )}
                </div>
                <div className="kpi-sub">
                  Total Payout: <strong style={{ color: 'var(--text-main)' }}>₹ {withdrawalLoading ? '...' : (memberWithdrawalSummary?.totalPayout ?? user?.totalIncome ?? 0).toLocaleString()}</strong>
                  {(memberWithdrawalSummary?.pendingAmount > 0 || (memberWithdrawalSummary?.totalPending > 0)) && (
                    <span style={{ color: 'var(--warning-hover)', display: 'block', fontWeight: 600 }}>
                      Pending: ₹ {(memberWithdrawalSummary?.pendingAmount || memberWithdrawalSummary?.totalPending || 0).toLocaleString()}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(true)}
                  className="btn btn-sm btn-soft btn-block"
                  style={{ marginTop: 'var(--space-3)' }}
                >
                  <ArrowDownRight size={14} />
                  <span>Withdraw Funds</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* NEW: Binary Volume Live Matching & Capping Strip */}
      <div className="dashboard-card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header-row">
          <div className="card-title-group">
            <span className="icon-tile tone-blue">
              <GitMerge size={20} />
            </span>
            <div>
              <h2 className="card-title">{isAdmin ? 'Binary Volume Matching' : 'Binary Matching & Daily Cap'}</h2>
              <p className="card-subtitle">
                {isAdmin ? 'Root node ' : 'Your node '}
                <strong>{user?.memberId || 'MEM0001'}{user?.name ? ` · ${user.name}` : ''}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => onNavigate('binary-ledger')} className="btn btn-sm btn-secondary">
              <BarChart3 size={14} /> Binary Income
            </button>
            <button type="button" onClick={() => onNavigate('income-settings')} className="btn btn-sm btn-primary">
              <Zap size={14} /> Simulator
            </button>
          </div>
        </div>

        {/* Binary Volume Split Grid - 100% Dynamic from Engine */}
        {(() => {
          const leftBV = binaryData?.leftTotalBV ?? 0;
          const rightBV = binaryData?.rightTotalBV ?? 0;
          const totalVol = leftBV + rightBV;
          const leftPct = totalVol > 0 ? Math.round((leftBV / totalVol) * 100) : 50;
          const rightPct = 100 - leftPct;

          const matchedBV = binaryData?.matchedBV ?? 0;
          const matchedCycles = binaryData?.matchedCycles ?? 0;
          const carryLeftBV = binaryData?.carryLeftBV ?? 0;
          const carryRightBV = binaryData?.carryRightBV ?? 0;
          const reservedBV = binaryData?.reservedBV ?? 0;
          const reservedSide = binaryData?.reservedSide ?? null;

          const ratePerCycle = binaryData?.ratePerCycle ?? 250;
          const totalBinaryIncome = binaryData?.totalBinaryIncome ?? (matchedCycles * ratePerCycle);
          const earnedToday = binaryData?.earnedToday ?? 0;
          const dailyCap = binaryData?.dailyCap ?? (user?.dailyCapping || 4000);
          const capUtil = binaryData?.dailyCapUtilization ?? (dailyCap > 0 ? Math.min(100, Math.round((earnedToday / dailyCap) * 100)) : 0);

          return (
            <div className="dashboard-binary-banner-grid">
              {/* Leg Balance Meter */}
              <div className="stat-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--primary)' }}>
                    {binaryLoading ? (
                      <SkeletonText width="120px" height="14px" />
                    ) : (
                      `LEFT LEG: ${leftBV.toLocaleString()} BV (${binaryData?.leftMemberCount ?? 0} M)`
                    )}
                  </span>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--success)' }}>
                    {binaryLoading ? (
                      <SkeletonText width="120px" height="14px" />
                    ) : (
                      `RIGHT LEG: ${rightBV.toLocaleString()} BV (${binaryData?.rightMemberCount ?? 0} M)`
                    )}
                  </span>
                </div>

                {/* Split Bar */}
                {binaryLoading ? (
                  <SkeletonText width="100%" height="12px" borderRadius="9999px" />
                ) : (
                  <div style={{ height: '12px', width: '100%', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-full)', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${leftPct}%`, background: 'var(--primary)', transition: 'width 0.4s ease' }} title={`Left Leg: ${leftBV.toLocaleString()} BV (${leftPct}%)`} />
                    <div style={{ width: `${rightPct}%`, background: 'var(--success)', transition: 'width 0.4s ease' }} title={`Right Leg: ${rightBV.toLocaleString()} BV (${rightPct}%)`} />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '6px', flexWrap: 'wrap', gap: '4px' }}>
                  {binaryLoading ? (
                    <SkeletonText width="180px" height="13px" />
                  ) : (
                    <>
                      <span>Matched: <strong style={{ color: 'var(--text-main)' }}>{matchedBV.toLocaleString()} BV</strong> ({matchedCycles} Cycles)</span>
                      {reservedBV > 0 && (
                        <span style={{ color: 'var(--warning)', fontWeight: 700, background: 'var(--warning-soft)', padding: '1px 6px', borderRadius: 'var(--radius-xs)' }}>
                          Reserved (Stage 2): {reservedBV.toLocaleString()} BV ({reservedSide})
                        </span>
                      )}
                      {carryLeftBV > 0 ? (
                        <span>Unmatched Left: <strong style={{ color: 'var(--primary)' }}>{carryLeftBV.toLocaleString()} BV</strong>{carryRightBV > 0 ? <> · Right: <strong style={{ color: 'var(--success)' }}>{carryRightBV.toLocaleString()} BV</strong></> : null}</span>
                      ) : carryRightBV > 0 ? (
                        <span>Unmatched Right: <strong style={{ color: 'var(--success)' }}>{carryRightBV.toLocaleString()} BV</strong></span>
                      ) : (
                        <span>Balanced: <strong style={{ color: 'var(--text-muted)' }}>0 BV Carry</strong></span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Dynamic Daily Binary Income Box */}
              <div className="stat-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', fontWeight: 600 }}>Today's Binary Income (₹{ratePerCycle}/match, paid after midnight)</div>
                  {binaryLoading ? (
                    <SkeletonText width="60px" height="14px" />
                  ) : (
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '1px 6px', borderRadius: 'var(--radius-xs)' }}>
                      {matchedCycles} {matchedCycles === 1 ? 'Pair' : 'Pairs'} Matched
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-display)', margin: '4px 0' }}>
                  ₹ {binaryLoading ? <SkeletonText width="80px" height="26px" /> : earnedToday.toLocaleString()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--success)', fontWeight: 600 }}>
                  <span>Estimated today: <strong>₹ {binaryLoading ? '...' : earnedToday.toLocaleString()}</strong></span>
                  <span style={{ color: 'var(--text-muted)' }}>All-Time: <strong>₹ {binaryLoading ? '...' : totalBinaryIncome.toLocaleString()}</strong></span>
                </div>
              </div>

              {/* Daily Cap / Payout Policy Progress */}
              <div className="stat-panel">
                {isAdmin && user?.role === 'ADMIN' && !user?.packageName ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', fontWeight: 600 }}>
                      <span>Payout Limit Policy</span>
                      <span style={{ color: 'var(--success)', fontWeight: 700, background: 'var(--success-light)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-xs)' }}>Uncapped</span>
                    </div>
                    <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-display)', margin: '8px 0 4px' }}>
                      Super Admin Account
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                      Binary capping is disabled for System Admin roles.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', fontWeight: 600 }}>
                      <span>Daily Cap Utilization</span>
                      {binaryLoading ? (
                        <SkeletonText width="35px" height="13px" />
                      ) : (
                        <span style={{ 
                          fontWeight: 700, 
                          color: capUtil >= 90 ? 'var(--danger)' : capUtil >= 60 ? 'var(--warning)' : 'var(--success)' 
                        }}>
                          {capUtil}%
                        </span>
                      )}
                    </div>
                    {binaryLoading ? (
                      <div style={{ margin: '8px 0' }}>
                        <SkeletonText width="100%" height="8px" borderRadius="9999px" />
                      </div>
                    ) : (
                      <div style={{ height: '8px', background: 'var(--surface-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden', margin: '8px 0' }}>
                        <div style={{ 
                          width: `${Math.min(100, capUtil)}%`, 
                          height: '100%', 
                          background: capUtil >= 90 ? 'var(--danger)' : capUtil >= 60 ? 'var(--warning)' : 'var(--success)', 
                          borderRadius: 'var(--radius-full)',
                          transition: 'width 0.4s ease' 
                        }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                      <span>Earned Today: <strong style={{ color: 'var(--text-main)' }}>₹ {binaryLoading ? '...' : earnedToday.toLocaleString()}</strong></span>
                      <span>Cap: <strong style={{ color: 'var(--text-main)' }}>₹ {binaryLoading ? '...' : dailyCap.toLocaleString()}</strong></span>
                    </div>
                    {!binaryLoading && binaryData?.today && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <span>
                          New today: L <strong style={{ color: 'var(--primary)' }}>{(binaryData.today.newLeftBV || 0).toLocaleString('en-IN')}</strong> · R{' '}
                          <strong style={{ color: 'var(--success)' }}>{(binaryData.today.newRightBV || 0).toLocaleString('en-IN')}</strong> BV
                        </span>
                        <span>
                          Flushed today:{' '}
                          <strong style={{ color: binaryData.today.flushedAmount > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
                            ₹ {(binaryData.today.flushedAmount || 0).toLocaleString('en-IN')}
                          </strong>
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })()}

      </div>

      {/* Standalone Welcome Bonus Dashboard Section */}
      <div id="welcome-bonus-section" className="dashboard-card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header-row">
          <div className="card-title-group">
            <span className="icon-tile tone-green">
              <Gift size={20} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <h2 className="card-title">{isAdmin ? 'Welcome Bonus Pool' : 'My Welcome Bonus'}</h2>
                {!isAdmin && welcomeBonus && (
                  welcomeBonus.status === 'Eligible' ? (
                    <Badge tone="success">Eligible</Badge>
                  ) : welcomeBonus.status === 'Cap Reached' ? (
                    <Badge tone="warning">{welcomeBonus?.activeRules?.maxMultiplier ?? 2}× cap reached</Badge>
                  ) : (
                    <Badge tone="danger">Not eligible</Badge>
                  )
                )}
              </div>
              <p className="card-subtitle">
                Weekly {welcomeBonus?.activeRules?.ratePercent ?? 4}% of company GBV · lifetime cap {welcomeBonus?.activeRules?.maxMultiplier ?? 2}× BV
              </p>
            </div>
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {unsettledWeeks.length > 0 ? (
                <select
                  value={selectedSettleWeek?.weekStart || ''}
                  onChange={(e) => setSettleWeek(e.target.value)}
                  disabled={settling}
                  aria-label="Week to settle"
                  className="form-select"
                  style={{ height: 'var(--control-h-sm)', width: 'auto', fontSize: 'var(--fs-sm)' }}
                >
                  {unsettledWeeks.map((w) => (
                    <option key={w.weekStart} value={w.weekStart}>
                      Week {formatWeekDay(w.weekStart)} – {formatWeekDay(w.weekEnd)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="form-hint">All finished weeks settled</span>
              )}
              <button
                type="button"
                onClick={handleRunSettlement}
                disabled={settling || !selectedSettleWeek}
                className="btn btn-sm btn-success"
              >
                <Sparkles size={14} />
                {settling ? 'Settling…' : 'Settle Week'}
              </button>
              <button type="button" onClick={() => onNavigate('income-settings')} className="btn btn-sm btn-secondary">
                Configure Rules
              </button>
            </div>
          )}
        </div>

        {settleMsg && (
          <Alert tone={settleMsg.startsWith('✓') ? 'success' : 'error'} onClose={() => setSettleMsg('')}>
            {settleMsg.replace(/^[✓⚠]\s*/, '')}
          </Alert>
        )}

        {/* 3-Column Overview: Admin View vs Member View */}
        <div className="stat-panel-grid">
          
          {isAdmin ? (
            /* ADMIN VIEW: Global Pool Governance, Active Rules, & Audit Overview */
            <>
              {/* Admin Card 1: Active Policy & Engine Configuration */}
              <div className="stat-panel is-muted" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span className="stat-panel-title">
                      Active Rules & Governance
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Pool Rate</span>
                      <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--primary)' }}>
                        {welcomeBonus?.activeRules?.ratePercent ?? 4}%
                      </span>
                      <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>of Company Weekly GBV</span>
                    </div>
                    <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Cap Multiplier</span>
                      <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--success)' }}>
                        {welcomeBonus?.activeRules?.maxMultiplier ?? 2}× Cap
                      </span>
                      <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Max payout per member</span>
                    </div>
                  </div>

                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', lineHeight: 1.5, background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <CheckCircle2 size={14} color="var(--success)" /> 
                      Lifetime BV of at least {(welcomeBonus?.activeRules?.minLifetimeBv ?? 1250).toLocaleString()} BV
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginTop: '4px' }}>
                      <CheckCircle2 size={14} color="var(--success)" />
                      {welcomeBonus?.activeRules?.minSponsoredCount ?? 2} directly sponsored binary-active members (any wing, any level)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginTop: '4px' }}>
                      <CheckCircle2 size={14} color="var(--success)" /> Frequency: {welcomeBonus?.activeRules?.settlementFrequency || 'Weekly'}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => onNavigate('income-settings')} className="link-btn">
                    Adjust Rules in Income Settings →
                  </button>
                </div>
              </div>

              {/* Admin Card 2: Current Weekly Settlement Pool */}
              <div className="stat-panel is-muted">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="stat-panel-title">
                    Current Weekly Pool Metrics
                  </span>
                  <Badge tone="primary">{welcomeBonus?.activeRules?.ratePercent ?? 4}% pool</Badge>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Current Weekly Company GBV</span>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)' }}>
                      {welcomeBonus ? `${(welcomeBonus.currentWeeklyCompanyGBV || 0).toLocaleString()} BV` : '—'}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Welcome Bonus Pool ({welcomeBonus?.activeRules?.ratePercent ?? 4}%)</span>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--primary)' }}>
                      {welcomeBonus ? `${(welcomeBonus.welcomeBonusPool || 0).toLocaleString()} BV` : '—'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Eligible Members</span>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)' }}>
                      {welcomeBonus ? `${welcomeBonus.eligibleMembersCount ?? welcomeBonus.eligibleMembers ?? 0} members` : '—'}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Projected Member Share</span>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--success)' }}>
                      {welcomeBonus ? `${(welcomeBonus.projectedShare ?? welcomeBonus.thisWeeksShare ?? 0).toLocaleString()} BV` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin Card 3: Settlement Distribution & Audit Overview */}
              <div className="stat-panel is-muted" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span className="stat-panel-title">
                      Settlement & Payout Audit
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Total Distributed Lifetime</span>
                      <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--success)' }}>
                        {welcomeBonus ? `${(welcomeBonus.totalPaidOutLifetime || 0).toLocaleString()} BV` : '0 BV'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Settlement Cycles</span>
                      <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)' }}>
                        {welcomeBonus ? `${welcomeBonus.totalSettlementsCount || 0} completed` : '0'}
                      </span>
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Last Processed Settlement</span>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-main)' }}>
                      {welcomeBonus?.lastSettlement 
                        ? `${welcomeBonus.lastSettlement.settlementId} (${(welcomeBonus.lastSettlement.totalAmountDistributed || 0).toLocaleString()} BV to ${welcomeBonus.lastSettlement.eligibleMemberCount || 0} members)` 
                        : 'No past settlements recorded yet'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* MEMBER VIEW: Personal Capping, Wings Qualification, & Weekly Pool Share */
            <>
              {/* Member Card 1: Dynamic Multiplier Cap & Lifetime Earned */}
              <div className="stat-panel is-muted">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="stat-panel-title">
                    Lifetime {welcomeBonus?.activeRules?.maxMultiplier ?? 2}× Capping
                  </span>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Multiplier: {welcomeBonus?.activeRules?.maxMultiplier ?? 2}×
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Lifetime Business Volume</span>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)' }}>
                      {welcomeBonus ? `${(welcomeBonus.qualifyingBusinessVolume || 0).toLocaleString()} BV` : '—'}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Maximum Welcome Bonus</span>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--success)' }}>
                      {welcomeBonus ? `${(welcomeBonus.maximumWelcomeBonus || 0).toLocaleString()} BV` : '—'}
                    </span>
                  </div>
                </div>

                {/* Cap Progress Bar */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Total Welcome Bonus Earned: <strong style={{ color: 'var(--text-main)' }}>{welcomeBonus ? `${(welcomeBonus.totalWelcomeBonusEarned || 0).toLocaleString()} BV` : '0 BV'}</strong>
                    </span>
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                      Remaining: {welcomeBonus ? `${(welcomeBonus.remainingBonus || 0).toLocaleString()} BV` : '—'}
                    </span>
                  </div>
                  <div style={{ height: '8px', width: '100%', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${welcomeBonus && welcomeBonus.maximumWelcomeBonus ? Math.min(100, Math.round(((welcomeBonus.totalWelcomeBonusEarned || 0) / welcomeBonus.maximumWelcomeBonus) * 100)) : 0}%`, 
                        background: 'var(--success)', 
                        borderRadius: 'var(--radius-full)' 
                      }} 
                    />
                  </div>
                </div>
              </div>

              {/* Member Card 2: Current Weekly Settlement Pool */}
              <div className="stat-panel is-muted">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="stat-panel-title">
                    Current Weekly Pool Metrics
                  </span>
                  <Badge tone="primary">{welcomeBonus?.activeRules?.ratePercent ?? 4}% pool</Badge>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Current Weekly Company GBV</span>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)' }}>
                      {welcomeBonus ? `${(welcomeBonus.currentWeeklyCompanyGBV || 0).toLocaleString()} BV` : '—'}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Welcome Bonus Pool ({welcomeBonus?.activeRules?.ratePercent ?? 4}%)</span>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--primary)' }}>
                      {welcomeBonus ? `${(welcomeBonus.welcomeBonusPool || 0).toLocaleString()} BV` : '—'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>Eligible Members</span>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)' }}>
                      {welcomeBonus ? `${welcomeBonus.eligibleMembersCount ?? welcomeBonus.eligibleMembers ?? 0} members` : '—'}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block' }}>This Week's Share</span>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--success)' }}>
                      {welcomeBonus ? `${(welcomeBonus.thisWeeksShare || 0).toLocaleString()} BV` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Member Card 3: Eligibility Conditions */}
              <div className="stat-panel is-muted" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <span className="stat-panel-title" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
                    Eligibility Criteria
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      {
                        label: 'Lifetime BV',
                        met: (welcomeBonus?.lifetimeBv || 0) >= (welcomeBonus?.activeRules?.minLifetimeBv ?? 1250),
                        value: `${(welcomeBonus?.lifetimeBv || 0).toLocaleString()} / ${(welcomeBonus?.activeRules?.minLifetimeBv ?? 1250).toLocaleString()} BV`,
                      },
                      {
                        label: 'Directly Sponsored Members',
                        met: (welcomeBonus?.sponsoredCount || 0) >= (welcomeBonus?.activeRules?.minSponsoredCount ?? 2),
                        value: `${welcomeBonus?.sponsoredCount || 0} / ${welcomeBonus?.activeRules?.minSponsoredCount ?? 2}`,
                      },
                    ].map((condition) => (
                      <div key={condition.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-body)' }}>
                          {condition.label}
                        </span>
                        <span style={{ color: condition.met ? 'var(--success)' : 'var(--danger)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--fs-base)' }}>
                          {condition.met ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {condition.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '12px', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Condition: at least {(welcomeBonus?.activeRules?.minLifetimeBv ?? 1250).toLocaleString()} BV received in your lifetime (packages, products or transfers) and {welcomeBonus?.activeRules?.minSponsoredCount ?? 2} directly sponsored members on any wing whose binary status is active (100 BV or more). Earnings stop at {welcomeBonus?.activeRules?.maxMultiplier ?? 2}× your lifetime BV.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Welcome Bonus History Table */}
        <div>
          <div className="card-header-row" style={{ marginBottom: 'var(--space-3)' }}>
            <div>
              <h3 className="section-title">
                {isAdmin ? 'Payout History' : 'My Payout History'}
              </h3>
              <p className="card-subtitle">
                {isAdmin ? 'Members credited from the weekly pool' : 'Weekly settlement bonuses credited to your BV'}
              </p>
            </div>
            {effectivePayouts && effectivePayouts.length > 0 && (
              <button type="button" onClick={() => setIsFullPayoutModalOpen(true)} className="btn btn-sm btn-secondary">
                <ExternalLink size={14} />
                View all ({effectivePayouts.length})
              </button>
            )}
          </div>

          <div className="table-responsive table-framed">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Settlement ID</th>
                  <th>Date</th>
                  <th>Company GBV</th>
                  <th>Total Pool ({welcomeBonus?.activeRules?.ratePercent ?? 4}%)</th>
                  <th>Paid Business Volume</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {effectivePayouts && effectivePayouts.length > 0 ? (
                  (showAllInline ? effectivePayouts : effectivePayouts.slice(0, 3)).map((row: any, idx: number) => (
                    <tr key={row.transactionId || idx}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{row.memberName || row.memberId}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--primary)', fontWeight: 600 }}>{row.memberId}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{row.settlementId}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.date || 'Recent'}</td>
                      <td style={{ color: 'var(--text-main)' }}>{(row.companyGrossBusinessVolume || 0).toLocaleString()} BV</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{(row.totalBonusPool || 0).toLocaleString()} BV</td>
                      <td style={{ fontWeight: 800, color: 'var(--success)' }}>
                        +{(row.actualPayout || 0).toLocaleString()} BV
                      </td>
                      <td>
                        <Badge tone="success">Credited</Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      {isAdmin 
                        ? 'No settlements recorded yet. Use “Settle Week” to process a finished week.'
                        : 'No settlement bonuses credited to your account yet. Meet the eligibility criteria above to qualify.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Bar with "Show More" Button */}
          {effectivePayouts && effectivePayouts.length > 3 && (
            <div className="table-footer">
              <span>
                Showing <strong>{showAllInline ? effectivePayouts.length : Math.min(3, effectivePayouts.length)}</strong> of <strong>{effectivePayouts.length}</strong>
              </span>
              <button type="button" onClick={() => setShowAllInline(!showAllInline)} className="btn btn-sm btn-ghost">
                {showAllInline ? 'Show less' : `Show ${effectivePayouts.length - 3} more`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent enrollments & network stats */}
      <div className="dashboard-grid-2">
        {/* Recent Registrations Table */}
        <div className="dashboard-card dashboard-table-card">
          <div className="card-header-row">
            <h2 className="card-title">Recent Enrollments</h2>
            <button type="button" onClick={() => onNavigate('members')} className="btn btn-secondary btn-sm">
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
                {statsLoading ? (
                  [...Array(5)].map((_, idx) => (
                    <tr key={idx}>
                      <td><SkeletonText width="15px" height="14px" /></td>
                      <td>
                        <SkeletonText width="100px" height="14px" style={{ marginBottom: '4px' }} />
                        <SkeletonText width="60px" height="11px" />
                      </td>
                      <td><SkeletonText width="65px" height="20px" borderRadius="6px" /></td>
                      <td><SkeletonText width="60px" height="14px" /></td>
                      <td><SkeletonText width="45px" height="18px" borderRadius="4px" /></td>
                      <td><SkeletonText width="55px" height="18px" borderRadius="9999px" /></td>
                    </tr>
                  ))
                ) : recentRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-light)' }}>
                      No recent enrollments found.
                    </td>
                  </tr>
                ) : (
                  recentRegistrations.map((row, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{row.name}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{row.id}</div>
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--fs-xs)',
                          fontWeight: 700,
                          background: row.package === 'Elite' ? '#fdf2f8' : row.package === 'Premium' ? 'var(--accent-light)' : 'var(--primary-light)',
                          color: row.package === 'Elite' ? '#db2777' : row.package === 'Premium' ? 'var(--accent)' : 'var(--primary)'
                        }}>
                          {row.package}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--success)' }}>{row.bv}</td>
                      <td>
                        <span style={{
                          fontSize: 'var(--fs-xs)',
                          fontWeight: 700,
                          color: row.leg === 'LEFT' ? 'var(--primary)' : 'var(--success)',
                          background: row.leg === 'LEFT' ? 'var(--primary-light)' : 'var(--success-light)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-xs)'
                        }}>
                          {row.leg}
                        </span>
                      </td>
                      <td>
                        <span className="status-pill status-active">{row.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-base)', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Active Distributors</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  {statsLoading ? (
                    <SkeletonText width="70px" height="14px" />
                  ) : (
                    `${stats?.quickStats?.activeMembers ?? stats?.totalMembers ?? 0} (${stats?.quickStats?.activePercent ?? 100}%)`
                  )}
                </span>
              </div>
              <div style={{ height: '7px', background: 'var(--surface-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ width: `${statsLoading ? 100 : (stats?.quickStats?.activePercent ?? 100)}%`, height: '100%', background: 'var(--success)', borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {/* Inactive Members */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-base)', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Inactive Distributors</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  {statsLoading ? (
                    <SkeletonText width="70px" height="14px" />
                  ) : (
                    `${stats?.quickStats?.inactiveMembers ?? 0} (${100 - (stats?.quickStats?.activePercent ?? 100)}%)`
                  )}
                </span>
              </div>
              <div style={{ height: '7px', background: 'var(--surface-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ width: `${statsLoading ? 0 : (100 - (stats?.quickStats?.activePercent ?? 100))}%`, height: '100%', background: 'var(--danger)', borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {/* Total Orders */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShoppingBag size={18} color="var(--accent)" />
                <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)', fontWeight: 500 }}>Total Package Orders</span>
              </div>
              <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-main)' }}>
                {statsLoading ? <SkeletonText width="40px" height="16px" /> : (stats?.totalMembers ?? 0).toLocaleString()}
              </span>
            </div>

            {/* Total Business Volume Generated */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Zap size={18} color="var(--accent)" />
                <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)', fontWeight: 500 }}>Total Business Volume (BV)</span>
              </div>
              <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--accent)' }}>
                {statsLoading ? <SkeletonText width="70px" height="16px" /> : `${(stats?.totalBusinessVolume ?? stats?.totalBV ?? 0).toLocaleString()} BV`}
              </span>
            </div>

            {/* Product Sales */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShoppingCart size={18} color="var(--info)" />
                <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)', fontWeight: 500 }}>Repurchase Turnover</span>
              </div>
              <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-main)' }}>
                {statsLoading ? (
                  <SkeletonText width="60px" height="16px" />
                ) : (
                  `₹ ${(stats?.repurchaseTurnover ?? stats?.quickStats?.repurchaseTurnover ?? 0).toLocaleString()}`
                )}
              </span>
            </div>

            {/* Ranks Achieved */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={18} color="var(--warning)" />
                <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)', fontWeight: 500 }}>Rank Achievers</span>
              </div>
              <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-main)' }}>
                {statsLoading ? <SkeletonText width="30px" height="16px" /> : (stats?.rankAchievers ?? stats?.quickStats?.rankAchievers ?? 0)}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Live Withdrawal Requests & Action Hub */}
      <div className="dashboard-card dashboard-table-card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <h2 className="card-title">{isAdmin ? 'Withdrawal Requests' : 'My Withdrawal Requests'}</h2>
              {isAdmin && dashboardWithdrawalKpis?.pendingCount > 0 && (
                <Badge tone="warning">{dashboardWithdrawalKpis.pendingCount} pending</Badge>
              )}
            </div>
            <p className="card-subtitle">Latest 5 requests</p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            {!isAdmin && (
              <button type="button" onClick={() => setIsWithdrawModalOpen(true)} className="btn btn-success btn-sm">
                <PlusCircle size={14} />
                <span>Withdraw</span>
              </button>
            )}
            <button type="button" onClick={() => onNavigate('withdrawals')} className="btn btn-secondary btn-sm">
              View all
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Req ID</th>
                <th>{isAdmin ? 'Member' : 'Requested'}</th>
                <th>{isAdmin ? 'Requested' : 'Paid / Ref'}</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {withdrawalLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <span className="spinner" style={{ display: 'block', margin: '0 auto var(--space-2)' }} aria-hidden="true" />
                    Loading withdrawal requests...
                  </td>
                </tr>
              ) : dashboardWithdrawalRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <AlertCircle size={22} color="var(--text-light)" style={{ margin: '0 auto 6px', display: 'block' }} />
                    {isAdmin 
                      ? 'No withdrawal requests recorded yet.' 
                      : 'No withdrawal requests submitted yet. Use “Withdraw” to request a payout.'}
                  </td>
                </tr>
              ) : (
                dashboardWithdrawalRequests.slice(0, 5).map((row) => (
                  <tr key={row._id || row.requestId}>
                    {/* Req ID */}
                    <td>
                      <span className="text-mono" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.requestId}</span>
                    </td>

                    {/* Col 2 */}
                    <td>
                      {isAdmin ? (
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 'var(--fs-sm)' }}>{row.memberName || row.memberId}</div>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{row.memberId}</div>
                        </div>
                      ) : (
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: 'var(--fs-base)' }}>
                          ₹ {row.requestedAmount.toLocaleString()}
                        </div>
                      )}
                    </td>

                    {/* Col 3 */}
                    <td>
                      {isAdmin ? (
                        <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: 'var(--fs-base)' }}>
                          ₹ {row.requestedAmount.toLocaleString()}
                        </span>
                      ) : (
                        <div>
                          {row.status === 'PAID' ? (
                            <>
                              <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: 'var(--fs-base)' }}>
                                ₹ {(row.paidAmount || row.requestedAmount).toLocaleString()}
                              </span>
                              {row.paymentReference && (
                                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                                  Ref: {row.paymentReference}
                                </div>
                              )}
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-light)' }}>—</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Date */}
                    <td style={{ color: 'var(--text-muted)' }}>
                      {row.requestedAt ? new Date(row.requestedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Recent'}
                    </td>

                    {/* Status */}
                    <td>
                      <StatusBadge status={row.status} />
                    </td>

                    {/* Action */}
                    <td style={{ textAlign: 'center' }}>
                      {isAdmin ? (
                        <div className="row-actions" style={{ justifyContent: 'center' }}>
                          {row.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedWithdrawalRequest(row);
                                  setAdminModalAction('APPROVE');
                                  setIsAdminModalOpen(true);
                                }}
                                className="btn btn-primary btn-sm"
                                title="Approve"
                              >
                                <Check size={12} /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedWithdrawalRequest(row);
                                  setAdminModalAction('REJECT');
                                  setIsAdminModalOpen(true);
                                }}
                                className="btn btn-sm btn-icon btn-danger-outline"
                                title="Reject"
                                aria-label="Reject"
                              >
                                <XCircle size={12} />
                              </button>
                            </>
                          )}

                          {row.status === 'APPROVED' && (
                            <button
                              onClick={() => {
                                setSelectedWithdrawalRequest(row);
                                setAdminModalAction('PAY');
                                setIsAdminModalOpen(true);
                              }}
                              className="btn btn-success btn-sm"
                              title="Mark as Paid"
                            >
                              <CreditCard size={12} /> Pay
                            </button>
                          )}

                          {(row.status === 'PAID' || row.status === 'REJECTED') && (
                            <button
                              onClick={() => {
                                setSelectedWithdrawalRequest(row);
                                setAdminModalAction('VIEW_DETAILS');
                                setIsAdminModalOpen(true);
                              }}
                              className="btn btn-sm btn-secondary"
                            >
                              Details
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedWithdrawalRequest(row);
                            setAdminModalAction('VIEW_DETAILS');
                            setIsAdminModalOpen(true);
                          }}
                          className="btn btn-sm btn-secondary"
                        >
                          Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Quick Action Strip */}
      <div className="quick-actions-strip">
        <button type="button" onClick={() => onNavigate('genealogy')} className="quick-action-btn">
          <GitMerge size={18} />
          <span>Genealogy Tree</span>
        </button>
        <button type="button" onClick={() => onNavigate('income-settings')} className="quick-action-btn">
          <Zap size={18} />
          <span>Income Simulator</span>
        </button>
        <button type="button" onClick={() => onNavigate('packages')} className="quick-action-btn">
          <Package size={18} />
          <span>Packages</span>
        </button>
        <button type="button" onClick={() => onNavigate('wallet-payouts')} className="quick-action-btn">
          <Wallet size={18} />
          <span>Wallet & Payouts</span>
        </button>
      </div>

      {/* Complete Welcome Bonus payout ledger */}
      <Modal
        open={isFullPayoutModalOpen}
        onClose={() => setIsFullPayoutModalOpen(false)}
        size="xl"
        title={isAdmin ? 'Welcome Bonus Payout History' : 'My Welcome Bonus Payout History'}
        subtitle={
          isAdmin
            ? `Every member credited from the weekly ${welcomeBonus?.activeRules?.ratePercent ?? 4}% pool`
            : `All weekly ${welcomeBonus?.activeRules?.ratePercent ?? 4}% pool bonuses credited to your account`
        }
        bodyStyle={{ padding: 0 }}
        footer={
          <>
            <span className="form-hint" style={{ marginRight: 'auto', alignSelf: 'center' }}>
              {isAdmin ? 'Paid members' : 'Settlements credited'}: <strong>{effectivePayouts.length}</strong>
            </span>
            <button type="button" onClick={() => setIsFullPayoutModalOpen(false)} className="btn btn-secondary">
              Close
            </button>
          </>
        }
      >
        <div className="stat-panel-grid" style={{ padding: 'var(--space-4) var(--space-6)', margin: 0, borderBottom: '1px solid var(--border-light)' }}>
          <div className="stat-panel">
            <div className="stat-panel-label">{isAdmin ? 'Total distributed BV' : 'My total earned BV'}</div>
            <div className="stat-panel-value" style={{ color: 'var(--success)' }}>
              {effectivePayouts.reduce((sum: number, r: any) => sum + (Number(r.actualPayout) || 0), 0).toLocaleString()} BV
            </div>
          </div>
          <div className="stat-panel">
            <div className="stat-panel-label">{isAdmin ? 'Paid members' : 'My settlements'}</div>
            <div className="stat-panel-value">{effectivePayouts.length}</div>
          </div>
          <div className="stat-panel">
            <div className="stat-panel-label">{isAdmin ? 'Current week pool' : 'Lifetime cap'}</div>
            <div className="stat-panel-value">
              {isAdmin
                ? `${(welcomeBonus?.welcomeBonusPool || 0).toLocaleString()} BV`
                : `${(welcomeBonus?.maximumWelcomeBonus || (welcomeBonus?.qualifyingBusinessVolume ? welcomeBonus.qualifyingBusinessVolume * (welcomeBonus?.activeRules?.maxMultiplier ?? 2) : 2500)).toLocaleString()} BV`}
            </div>
          </div>
          <div className="stat-panel">
            <div className="stat-panel-label">Latest settlement</div>
            <div className="stat-panel-value" style={{ fontSize: 'var(--fs-lg)' }}>
              {effectivePayouts[0]?.settlementId || '—'}
            </div>
          </div>
        </div>

        <div className="filter-group" style={{ padding: 'var(--space-3) var(--space-6)', borderBottom: '1px solid var(--border-light)' }}>
          <div className="filter-search-box">
            <Search size={16} className="search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search member name, ID or settlement"
              aria-label="Search payouts"
              value={payoutSearch}
              onChange={(e) => setPayoutSearch(e.target.value)}
            />
          </div>
          <select
            value={payoutFilterSettlement}
            onChange={(e) => setPayoutFilterSettlement(e.target.value)}
            aria-label="Filter by settlement"
            className="form-select"
            style={{ width: 'auto', minWidth: 180 }}
          >
            <option value="ALL">All settlements</option>
            {Array.from(new Set(effectivePayouts.map((r: any) => r.settlementId).filter(Boolean))).map((sId: any) => (
              <option key={sId} value={sId}>{sId}</option>
            ))}
          </select>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th>Member</th>
                <th>Settlement ID</th>
                <th>Settlement Date</th>
                <th>Company Weekly GBV</th>
                <th>Total Bonus Pool</th>
                <th>Paid BV</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {effectivePayouts
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
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.memberName || row.memberId}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{row.memberId}</div>
                    </td>
                    <td>{row.settlementId}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{row.date || 'Recent'}</td>
                    <td>{(row.companyGrossBusinessVolume || 0).toLocaleString()} BV</td>
                    <td>{(row.totalBonusPool || 0).toLocaleString()} BV</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>+{(row.actualPayout || 0).toLocaleString()} BV</td>
                    <td><Badge tone="success">Credited</Badge></td>
                  </tr>
                ))}
              {effectivePayouts.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state-text" style={{ textAlign: 'center', padding: 'var(--space-8)', maxWidth: 'none' }}>
                    {isAdmin
                      ? 'No settlements recorded yet. Use “Settle Week” to process a finished week.'
                      : 'No settlement bonuses credited to your account yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Member Withdrawal Modal */}
      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        availablePayout={memberWithdrawalSummary?.availablePayout ?? user?.walletBalance ?? 0}
        totalPayout={memberWithdrawalSummary?.totalPayout ?? user?.totalIncome ?? 0}
        pendingAmount={memberWithdrawalSummary?.pendingAmount || memberWithdrawalSummary?.totalPending || 0}
        effectiveAvailable={memberWithdrawalSummary?.effectiveAvailable}
        user={user}
        onSuccess={() => {
          loadWithdrawalData();
        }}
        onNavigate={onNavigate}
      />

      {/* Admin Action Modal */}
      <AdminWithdrawalActionModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        request={selectedWithdrawalRequest}
        actionType={adminModalAction}
        onSuccess={() => {
          loadWithdrawalData();
        }}
      />
    </div>
  );
};
