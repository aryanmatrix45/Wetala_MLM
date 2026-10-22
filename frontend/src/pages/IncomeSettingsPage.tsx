import React, { useState, useEffect } from 'react';
import { Alert, LoadingState, PageHeader, SegmentedControl } from '../components/ui';

import { Award, Calculator, Crown, Eye, Lock, Percent, Plus, Save, Trash2, TrendingUp, Users, Zap } from 'lucide-react';


import { api } from '../services/api';

interface IncomeSettingsPageProps {
  user?: any;
  token?: string | null;
  defaultSection?: 'all' | 'simulator' | 'teamPerformance' | 'rewards' | string;
}

const DEFAULT_PERFORMANCE_SLABS = [
  { tierId: 'TPB-1', pairCount: 10, leftThreshold: 10, rightThreshold: 10, royaltyBonusPercent: 3, limitAmount: 10000 },
  { tierId: 'TPB-2', pairCount: 100, leftThreshold: 100, rightThreshold: 100, royaltyBonusPercent: 3, limitAmount: 30000 },
  { tierId: 'TPB-3', pairCount: 400, leftThreshold: 400, rightThreshold: 400, royaltyBonusPercent: 2, limitAmount: 100000 },
  { tierId: 'TPB-4', pairCount: 1600, leftThreshold: 1600, rightThreshold: 1600, royaltyBonusPercent: 2, limitAmount: 300000 },
  { tierId: 'TPB-5', pairCount: 5000, leftThreshold: 5000, rightThreshold: 5000, royaltyBonusPercent: 1, limitAmount: 500000 },
  { tierId: 'TPB-6', pairCount: 25000, leftThreshold: 25000, rightThreshold: 25000, royaltyBonusPercent: 1, limitAmount: 1500000 },
];

const DEFAULT_REWARD_TIERS = [
  { tierId: 'RW-1', rankName: 'FRESHER', teamTarget: 5, leftRequirement: 5, rightRequirement: 5, rewardAmount: 1000, rewardTitle: 'Fresher' },
  { tierId: 'RW-2', rankName: 'STAR', teamTarget: 10, leftRequirement: 10, rightRequirement: 10, rewardAmount: 2000, rewardTitle: 'Star' },
  { tierId: 'RW-3', rankName: 'BRONZE', teamTarget: 50, leftRequirement: 50, rightRequirement: 50, rewardAmount: 10000, rewardTitle: 'Bronze' },
  { tierId: 'RW-4', rankName: 'SILVER', teamTarget: 100, leftRequirement: 100, rightRequirement: 100, rewardAmount: 20000, rewardTitle: 'Silver' },
  { tierId: 'RW-5', rankName: 'PEARL', teamTarget: 200, leftRequirement: 200, rightRequirement: 200, rewardAmount: 40000, rewardTitle: 'Pearl' },
  { tierId: 'RW-6', rankName: 'GOLD', teamTarget: 400, leftRequirement: 400, rightRequirement: 400, rewardAmount: 80000, rewardTitle: 'Gold' },
  { tierId: 'RW-7', rankName: 'RUBY', teamTarget: 800, leftRequirement: 800, rightRequirement: 800, rewardAmount: 160000, rewardTitle: 'Ruby' },
  { tierId: 'RW-8', rankName: 'DIAMOND', teamTarget: 1600, leftRequirement: 1600, rightRequirement: 1600, rewardAmount: 320000, rewardTitle: 'Diamond' },
  { tierId: 'RW-9', rankName: 'DOUBLE DIAMOND', teamTarget: 2500, leftRequirement: 2500, rightRequirement: 2500, rewardAmount: 500000, rewardTitle: 'Double Diamond' },
  { tierId: 'RW-10', rankName: 'CROWN DIAMOND', teamTarget: 5000, leftRequirement: 5000, rightRequirement: 5000, rewardAmount: 1000000, rewardTitle: 'Crown Diamond' },
  { tierId: 'RW-11', rankName: 'PLATINUM', teamTarget: 10000, leftRequirement: 10000, rightRequirement: 10000, rewardAmount: 2000000, rewardTitle: 'Platinum' },
  { tierId: 'RW-12', rankName: 'TOPAZ', teamTarget: 15000, leftRequirement: 15000, rightRequirement: 15000, rewardAmount: 3000000, rewardTitle: 'Topaz' },
  { tierId: 'RW-13', rankName: 'KOHINOOR', teamTarget: 25000, leftRequirement: 25000, rightRequirement: 25000, rewardAmount: 5000000, rewardTitle: 'Kohinoor' },
  { tierId: 'RW-14', rankName: 'DOUBLE KOHINOOR', teamTarget: 50000, leftRequirement: 50000, rightRequirement: 50000, rewardAmount: 10000000, rewardTitle: 'Double Kohinoor' },
  { tierId: 'RW-15', rankName: 'TRIPLE KOHINOOR', teamTarget: 100000, leftRequirement: 100000, rightRequirement: 100000, rewardAmount: 20000000, rewardTitle: 'Triple Kohinoor' },
];

const FALLBACK_FULL_RULES = {
  ruleSetId: 'DEFAULT_RULES',
  version: 3,
  isActive: true,
  welcomeBonus: {
    isEnabled: true,
    ratePercent: 4,
    maxMultiplier: 2,
    minLifetimeBv: 1250,
    minSponsoredCount: 2,
    settlementFrequency: 'Weekly',
    limitMode: 'MULTIPLIER',
    notes: '4% Company Weekly GBV Pool divided equally among members with 1,250 lifetime BV and 2 sponsored members, capped at 2x lifetime BV.',
  },
  binaryBonus: {
    isEnabled: true,
    standardBinaryRate: 0.20,
    rateInRupees: 250,
    pairBvUnit: 1250,
    specialBinaryRate: 0.25,
    isSpecialRateEnabled: false,
    calculationBase: 'BV',
    volumeCarryForwardMode: 'CARRY_FORWARD',
    dailyBinaryPayoutCap: 4000,
    excessCapPolicy: 'FLUSH',
    firstPairRatio: '1:1',
    subsequentPairRatio: '1:2_or_2:1',
  },
  sponsorBinaryBonus: {
    isEnabled: true,
    sponsorBinaryRate: 0.20,
    sponsorDepth: 1,
    calculationBase: 'BINARY_COMMISSION',
  },
  teamPerformanceBonus: {
    isEnabled: true,
    calculationBase: 'CTO_POOL',
    tiers: DEFAULT_PERFORMANCE_SLABS,
    notes: 'Team Performance Bonus based on balanced pairs sharing CTO pool with individual payout limits.',
  },
  rewards: {
    isEnabled: true,
    tiers: DEFAULT_REWARD_TIERS,
  },
  payoutDeductions: {
    isEnabled: false,
    tdsPercent: 0,
    adminFeePercent: 0,
    notes: 'No TDS or admin fee: the full income amount is credited to the wallet.',
  },
};

export const IncomeSettingsPage: React.FC<IncomeSettingsPageProps> = ({ 
  user: propUser, 
  token: propToken,
  defaultSection = 'simulator'
}) => {
  const savedToken = propToken || localStorage.getItem('wetala_token') || '';
  const savedUserStr = localStorage.getItem('wetala_user');
  const user = propUser || (savedUserStr ? JSON.parse(savedUserStr) : null);
  const isAdmin = user?.role === 'superadmin';

  // Section Mode: 'teamPerformance' | 'rewards' | 'simulator'
  const section = defaultSection || 'simulator';

  // Sub-tabs for simulator page
  const [activeTab, setActiveTab] = useState<'rules' | 'simulator' | 'my-status'>(
    section === 'simulator' && isAdmin ? 'rules' : (isAdmin ? 'rules' : 'my-status')
  );

  const [rules, setRules] = useState<any>(FALLBACK_FULL_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Simulator State
  const [simParams, setSimParams] = useState({
    leftBV: 10000,
    rightBV: 7000,
    binaryRate: 0.20,
    dailyCap: 4000,
    alreadyEarnedToday: 3500,
  });
  const [simResult, setSimResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await api.getCompensationRules(savedToken);
      if (res.status && res.data) {
        let loadedRules = { ...res.data };

        // Ensure Team Performance Bonus tiers
        if (
          !loadedRules.teamPerformanceBonus?.tiers ||
          loadedRules.teamPerformanceBonus.tiers.length === 0 ||
          loadedRules.teamPerformanceBonus.tiers[0].royaltyBonusPercent === undefined
        ) {
          loadedRules.teamPerformanceBonus = {
            ...(loadedRules.teamPerformanceBonus || {}),
            isEnabled: true,
            calculationBase: 'CTO_POOL',
            tiers: DEFAULT_PERFORMANCE_SLABS,
          };
        }

        // Ensure Rewards tiers
        if (!loadedRules.rewards?.tiers || loadedRules.rewards.tiers.length === 0) {
          loadedRules.rewards = {
            ...(loadedRules.rewards || {}),
            isEnabled: true,
            tiers: DEFAULT_REWARD_TIERS,
          };
        }

        // Ensure Payout Deductions settings
        if (!loadedRules.payoutDeductions || loadedRules.payoutDeductions.tdsPercent === undefined) {
          loadedRules.payoutDeductions = {
            isEnabled: false,
            tdsPercent: 0,
            adminFeePercent: 0,
            notes: 'No TDS or admin fee: the full income amount is credited to the wallet.',
          };
        }

        setRules(loadedRules);
      } else {
        setRules(FALLBACK_FULL_RULES);
      }
      if (isAdmin) {
        handleRunSimulation();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch compensation rules from backend database.');
      setRules(FALLBACK_FULL_RULES);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRules = async () => {
    if (!isAdmin) return;
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(null);
      const res = await api.updateCompensationRules(rules, savedToken);
      if (res.status) {
        setSaveSuccess(`Rules successfully updated to Version ${res.data?.version || rules.version + 1} with database audit log!`);
        setRules(res.data);
      } else {
        setError(res.message || 'Failed to update compensation rules.');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating compensation rules.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunSimulation = async (customParams?: any) => {
    try {
      setSimulating(true);
      const params = customParams || simParams;
      const res = await api.simulateCompensation(params, savedToken);
      if (res.status && res.simulation) {
        setSimResult(res.simulation);
      }
    } catch (err: any) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  const applyPreset = (presetName: string) => {
    let p = { ...simParams };
    if (presetName === 'cap_overflow') {
      p = { leftBV: 25000, rightBV: 20000, binaryRate: 0.20, dailyCap: 4000, alreadyEarnedToday: 3500 };
    } else if (presetName === 'equal_match') {
      p = { leftBV: 5000, rightBV: 5000, binaryRate: 0.20, dailyCap: 4000, alreadyEarnedToday: 0 };
    } else {
      p = { leftBV: 10000, rightBV: 7000, binaryRate: 0.20, dailyCap: 4000, alreadyEarnedToday: 3500 };
    }
    setSimParams(p);
    handleRunSimulation(p);
  };

  if (loading) {
    return (
      <div className="page-body">
        <LoadingState label="Loading compensation plan…" />
      </div>
    );
  }

  // Member calculated milestones
  const matchedPairs = user?.matchedPairs || 0;
  const currentRank = user?.rank || 'FRESHER';
  const rewardTiers = rules?.rewards?.tiers || DEFAULT_REWARD_TIERS;
  const currentTierIndex = rewardTiers.findIndex((t: any) => t.rankName?.toUpperCase() === currentRank.toUpperCase());
  const nextTier = rewardTiers[currentTierIndex + 1] || rewardTiers[0];
  const targetPairs = nextTier ? nextTier.teamTarget || nextTier.leftRequirement : 5;
  const progressPercent = Math.min(100, Math.round((matchedPairs / (targetPairs || 1)) * 100));

  // Page title & subtitle per section
  let pageTitle = isAdmin ? 'Compensation Rules & Simulator' : 'Compensation Plan';
  let pageSubtitle = 'Binary matching, welcome bonus and an interactive income simulator.';

  if (section === 'teamPerformance') {
    pageTitle = 'Team Performance Slabs';
    pageSubtitle = 'Company turnover (CTO) performance pools (3% down to 1%).';
  } else if (section === 'rewards') {
    pageTitle = 'Leadership Ranks & Lifetime Rewards';
    pageSubtitle = 'Cumulative left:right pair milestones with one-time cash and reward payouts from ₹1,000 up to ₹2 crore.';
  }

  const simulatorTabs = [
    ...(!isAdmin ? [{ value: 'my-status', label: 'My status & rank', icon: <TrendingUp size={14} /> }] : []),
    { value: 'rules', label: isAdmin ? 'Rule configurator' : 'Plan slabs', icon: isAdmin ? <Zap size={14} /> : <Eye size={14} /> },
    ...(isAdmin ? [{ value: 'simulator', label: 'Live simulator', icon: <Calculator size={14} /> }] : []),
  ];

  return (
    <div className="page-body">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        actions={
          <>
            {section === 'simulator' && (
              <SegmentedControl
                ariaLabel="Section"
                value={activeTab}
                onChange={(v) => setActiveTab(v as typeof activeTab)}
                options={simulatorTabs}
              />
            )}
            {isAdmin && (
              <button type="button" className="btn btn-primary" onClick={handleSaveRules} disabled={saving}>
                <Save size={16} />
                <span>{saving ? 'Saving…' : 'Save changes'}</span>
              </button>
            )}
          </>
        }
      />

      {saveSuccess && <Alert tone="success" onClose={() => setSaveSuccess('')}>{saveSuccess}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {/* =========================================================================
          PAGE 1: TEAM PERFORMANCE SLABS (defaultSection === 'teamPerformance')
          ========================================================================= */}
      {section === 'teamPerformance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {/* Card 4: Team Performance Bonus (6 Slabs) */}
          <div className="dashboard-card">
            <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title-group">
                <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h2 className="card-title">Team Performance Bonus (CTO Slabs)</h2>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    Balanced Left:Right team pairs sharing Company Turnover (CTO) pool with individual payout caps
                  </span>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    const newTiers = [...(rules.teamPerformanceBonus?.tiers || [])];
                    newTiers.push({
                      tierId: `TPB-${newTiers.length + 1}`,
                      pairCount: 1000,
                      leftThreshold: 1000,
                      rightThreshold: 1000,
                      royaltyBonusPercent: 2,
                      limitAmount: 150000
                    });
                    setRules({ ...rules, teamPerformanceBonus: { ...rules.teamPerformanceBonus, tiers: newTiers } });
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--fs-base)', padding: '7px 14px', borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, border: '1px solid var(--primary-border)', cursor: 'pointer' }}
                >
                  <Plus size={15} /> Add Performance Slab
                </button>
              )}
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ marginTop: '12px' }}>
              <thead>
                <tr>
                  <th>Slab ID</th>
                  <th>Pairs Required (Left:Right)</th>
                  <th>Royalty Bonus (CTO Pool)</th>
                  <th>Individual ₹ Limit</th>
                  {isAdmin && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {rules.teamPerformanceBonus?.tiers?.map((slab: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 800, color: 'var(--text-muted)' }}>{slab.tierId || `TPB-${idx + 1}`}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {isAdmin ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            value={slab.pairCount ?? slab.leftThreshold ?? 10}
                            onChange={(e) => {
                              const newTiers = [...rules.teamPerformanceBonus.tiers];
                              const val = parseInt(e.target.value) || 0;
                              newTiers[idx].pairCount = val;
                              newTiers[idx].leftThreshold = val;
                              newTiers[idx].rightThreshold = val;
                              setRules({ ...rules, teamPerformanceBonus: { ...rules.teamPerformanceBonus, tiers: newTiers } });
                            }}
                            style={{ width: '80px', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)' }}
                          />
                          <span>:</span>
                          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{slab.pairCount ?? slab.leftThreshold ?? 10} Pairs</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-strong)' }}>
                          {slab.pairCount || slab.leftThreshold || 10} : {slab.pairCount || slab.rightThreshold || 10} Pairs
                        </span>
                      )}
                    </td>
                    <td>
                      {isAdmin ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            step="0.5"
                            value={slab.royaltyBonusPercent ?? 3}
                            onChange={(e) => {
                              const newTiers = [...rules.teamPerformanceBonus.tiers];
                              newTiers[idx].royaltyBonusPercent = parseFloat(e.target.value) || 0;
                              setRules({ ...rules, teamPerformanceBonus: { ...rules.teamPerformanceBonus, tiers: newTiers } });
                            }}
                            style={{ width: '65px', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)' }}
                          />
                          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--primary)' }}>% CTO</span>
                        </div>
                      ) : (
                        <strong style={{ color: 'var(--primary)', fontSize: 'var(--fs-lg)' }}>{slab.royaltyBonusPercent ?? 3}% CTO</strong>
                      )}
                    </td>
                    <td>
                      {isAdmin ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>₹</span>
                          <input
                            type="number"
                            value={slab.limitAmount ?? 10000}
                            onChange={(e) => {
                              const newTiers = [...rules.teamPerformanceBonus.tiers];
                              newTiers[idx].limitAmount = parseInt(e.target.value) || 0;
                              setRules({ ...rules, teamPerformanceBonus: { ...rules.teamPerformanceBonus, tiers: newTiers } });
                            }}
                            style={{ width: '100px', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)' }}
                          />
                        </div>
                      ) : (
                        <strong style={{ color: 'var(--success)', fontSize: 'var(--fs-lg)' }}>₹ {(slab.limitAmount ?? 10000)?.toLocaleString()}</strong>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          onClick={() => {
                            const newTiers = rules.teamPerformanceBonus.tiers.filter((_: any, i: number) => i !== idx);
                            setRules({ ...rules, teamPerformanceBonus: { ...rules.teamPerformanceBonus, tiers: newTiers } });
                          }}
                          style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                          title="Delete Slab"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '12px' }}>
              * All qualified team members equally divide the CTO pool. No daily capping applies to Team Performance Bonus.
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAGE 2: LIFETIME REWARDS (defaultSection === 'rewards')
          ========================================================================= */}
      {section === 'rewards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {/* Member Rank & Reward Progress Card */}
          <div className="dashboard-card" style={{ background: 'var(--warning-light)', border: '1.5px solid var(--warning-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--warning-hover)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  YOUR LEADERSHIP RANK & REWARD TRACKER
                </span>
                <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
                  {currentRank} <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-muted)' }}>({matchedPairs} Total Matched Pairs)</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>Next Milestone Reward</span>
                <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 900, color: 'var(--success)' }}>
                  ₹ {nextTier?.rewardAmount ? nextTier.rewardAmount.toLocaleString() : '1,000'}
                </div>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--primary)' }}>
                  Rank: {nextTier?.rankName || 'FRESHER'}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <span>Milestone Progress to {nextTier?.rankName || 'Target'}</span>
                <span>{matchedPairs} / {targetPairs} Pairs ({progressPercent}%)</span>
              </div>
              <div style={{ width: '100%', height: '12px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${progressPercent}%`, 
                    height: '100%', 
                    background: 'var(--warning)', 
                    borderRadius: 'var(--radius-sm)',
                    transition: 'width 0.4s ease'
                  }} 
                />
              </div>
            </div>
          </div>

          {/* Complete 15 Rank & Reward Milestones Table */}
          <div className="dashboard-card">
            <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title-group">
                <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--warning-soft)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={20} />
                </div>
                <div>
                  <h2 className="card-title">15 Leadership Ranks & Lifetime Rewards</h2>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    15 Progressive Leadership Ranks & One-Time Milestone Business Rewards up to ₹2 Crore
                  </span>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    const newTiers = [...(rules.rewards?.tiers || [])];
                    newTiers.push({
                      tierId: `RW-${newTiers.length + 1}`,
                      rankName: 'NEW RANK',
                      teamTarget: 200000,
                      leftRequirement: 200000,
                      rightRequirement: 200000,
                      rewardAmount: 50000000,
                      rewardTitle: 'New Rank Title'
                    });
                    setRules({ ...rules, rewards: { ...rules.rewards, tiers: newTiers } });
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--fs-base)', padding: '7px 14px', borderRadius: 'var(--radius-md)', background: 'var(--warning-soft)', color: 'var(--warning-hover)', fontWeight: 700, border: '1px solid var(--warning-border)', cursor: 'pointer' }}
                >
                  <Plus size={15} /> Add Rank
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto', marginTop: '14px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank / Tier</th>
                    <th>Rank Title</th>
                    <th>Left : Right Pairs</th>
                    <th>One-Time Reward (₹)</th>
                    <th>Status</th>
                    {isAdmin && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {rules.rewards?.tiers?.map((tier: any, idx: number) => {
                    const target = tier.teamTarget || tier.leftRequirement || 0;
                    const isAchieved = matchedPairs >= target;
                    const isCurrent = currentTierIndex === idx;

                    return (
                      <tr key={idx} style={{ background: isCurrent ? 'var(--success-light)' : 'transparent' }}>
                        <td style={{ fontWeight: 800, color: 'var(--text-muted)' }}>
                          #{idx + 1}
                        </td>
                        <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                          {isAdmin ? (
                            <input
                              type="text"
                              value={tier.rankName}
                              onChange={(e) => {
                                const newTiers = [...rules.rewards.tiers];
                                newTiers[idx].rankName = e.target.value;
                                setRules({ ...rules, rewards: { ...rules.rewards, tiers: newTiers } });
                              }}
                              style={{ width: '150px', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Crown size={15} color="var(--warning)" />
                              <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800 }}>{tier.rankName}</span>
                            </div>
                          )}
                        </td>
                        <td>
                          {isAdmin ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                value={tier.teamTarget || tier.leftRequirement}
                                onChange={(e) => {
                                  const newTiers = [...rules.rewards.tiers];
                                  const val = parseInt(e.target.value) || 0;
                                  newTiers[idx].teamTarget = val;
                                  newTiers[idx].leftRequirement = val;
                                  newTiers[idx].rightRequirement = val;
                                  setRules({ ...rules, rewards: { ...rules.rewards, tiers: newTiers } });
                                }}
                                style={{ width: '90px', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)' }}
                              />
                              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Pairs</span>
                            </div>
                          ) : (
                            <strong style={{ color: 'var(--text-strong)' }}>
                              {(tier.teamTarget || tier.leftRequirement)?.toLocaleString()} : {(tier.teamTarget || tier.rightRequirement)?.toLocaleString()} Pairs
                            </strong>
                          )}
                        </td>
                        <td>
                          {isAdmin ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>₹</span>
                              <input
                                type="number"
                                value={tier.rewardAmount}
                                onChange={(e) => {
                                  const newTiers = [...rules.rewards.tiers];
                                  newTiers[idx].rewardAmount = parseInt(e.target.value) || 0;
                                  setRules({ ...rules, rewards: { ...rules.rewards, tiers: newTiers } });
                                }}
                                style={{ width: '120px', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}
                              />
                            </div>
                          ) : (
                            <strong style={{ color: 'var(--success)', fontSize: 'var(--fs-lg)' }}>
                              ₹ {tier.rewardAmount?.toLocaleString()}
                            </strong>
                          )}
                        </td>
                        <td>
                          {isAchieved ? (
                            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--success-light)', color: 'var(--success)' }}>
                              ✓ ACHIEVED
                            </span>
                          ) : isCurrent ? (
                            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                              IN PROGRESS
                            </span>
                          ) : (
                            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-muted)', color: 'var(--text-muted)' }}>
                              LOCKED
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td>
                            <button
                              onClick={() => {
                                const newTiers = rules.rewards.tiers.filter((_: any, i: number) => i !== idx);
                                setRules({ ...rules, rewards: { ...rules.rewards, tiers: newTiers } });
                              }}
                              style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                              title="Delete Rank"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAGE 3: INCOME & SIMULATOR (defaultSection === 'simulator' or 'all')
          ========================================================================= */}
      {section === 'simulator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          
          {/* Sub-tab 1: Rules Configurator / Plan View */}
          {activeTab === 'rules' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
              {!isAdmin && (
                <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-border)', color: 'var(--primary-strong)', padding: '14px 18px', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Lock size={18} color="var(--primary)" />
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600 }}>
                    You are viewing the official company compensation plan in Read-Only mode. All income calculations follow these active database rules.
                  </span>
                </div>
              )}

              {/* Grid: Binary Matching & Welcome Bonus */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px' }}>
                
                {/* Card 1: Binary Income & Daily Cap */}
                <div className="dashboard-card">
                  <div className="card-header-row">
                    <div className="card-title-group">
                      <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Percent size={18} />
                      </div>
                      <div>
                        <h2 className="card-title">1. Binary Income & Capping</h2>
                        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                          First pair 1:1, subsequent 1:2 or 2:1 • ₹{rules.binaryBonus?.rateInRupees ?? (rules.binaryBonus?.standardBinaryRate ? Math.round(rules.binaryBonus.standardBinaryRate * 1250) : 250)} per pair (1,250 BV)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                    <div>
                      <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                        Binary Rate (₹ per Pair)
                      </label>
                      {isAdmin ? (
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--fs-md)' }}>₹</span>
                          <input
                            type="number"
                            step="1"
                            value={rules.binaryBonus?.rateInRupees ?? (rules.binaryBonus?.standardBinaryRate ? Math.round(rules.binaryBonus.standardBinaryRate * 1250) : 250)}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setRules({
                                ...rules,
                                binaryBonus: {
                                  ...rules.binaryBonus,
                                  rateInRupees: val,
                                  standardBinaryRate: val / (rules.binaryBonus?.pairBvUnit || 1250),
                                }
                              });
                            }}
                            style={{ width: '100%', padding: '10px 14px 10px 28px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-main)' }}
                          />
                        </div>
                      ) : (
                        <div style={{ padding: '10px 14px', background: 'var(--surface-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-main)' }}>
                          ₹ {rules.binaryBonus?.rateInRupees ?? (rules.binaryBonus?.standardBinaryRate ? Math.round(rules.binaryBonus.standardBinaryRate * 1250) : 250)} per 1,250 BV pair
                        </div>
                      )}
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Configured in Rupees (₹), not percentage (1,250 BV base unit)
                      </span>
                    </div>

                    {/* Package Capping Banner */}
                    <div style={{ padding: '10px 12px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Member Daily Capping is Package-Based</span>
                      </div>
                      <div>
                        Each member's daily binary income is strictly capped by their purchased package. If daily binary income exceeds their package cap (e.g., <strong>₹4,000/day</strong> for Starter), no additional binary income can be earned that day.
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        <span style={{ background: 'var(--surface)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', fontWeight: 600, color: 'var(--text-strong)' }}>Starter: ₹4,000/day</span>
                        <span style={{ background: 'var(--surface)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', fontWeight: 600, color: 'var(--text-strong)' }}>Executive: ₹8,000/day</span>
                        <span style={{ background: 'var(--surface)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', fontWeight: 600, color: 'var(--text-strong)' }}>Professional: ₹12,000/day</span>
                        <span style={{ background: 'var(--surface)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', fontWeight: 600, color: 'var(--text-strong)' }}>Elite: ₹16,000/day</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>First Pair Ratio</label>
                        <div style={{ padding: '9px 12px', background: 'var(--surface-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--primary)' }}>
                          1:1
                        </div>
                      </div>

                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Subsequent Pair Ratio</label>
                        <div style={{ padding: '9px 12px', background: 'var(--surface-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--success)' }}>
                          1:2 or 2:1
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Standalone Welcome Bonus */}
                <div className="dashboard-card">
                  <div className="card-header-row">
                    <div className="card-title-group">
                      <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={18} />
                      </div>
                      <div>
                        <h2 className="card-title">2. Welcome Bonus</h2>
                        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                          {rules.welcomeBonus?.ratePercent ?? 4}% Company Weekly GBV Pool • {rules.welcomeBonus?.maxMultiplier ?? 2}× Maximum Multiplier
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {/* Field 1: Welcome Bonus Rate (%) */}
                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Welcome Bonus Rate (%)
                        </label>
                        {isAdmin ? (
                          <input
                            type="number"
                            step="0.5"
                            value={rules.welcomeBonus?.ratePercent ?? 4}
                            onChange={(e) => setRules({ ...rules, welcomeBonus: { ...rules.welcomeBonus, ratePercent: parseFloat(e.target.value) || 0 } })}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)' }}
                          />
                        ) : (
                          <div style={{ padding: '9px 12px', background: 'var(--surface-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-main)' }}>
                            {rules.welcomeBonus?.ratePercent || 4}% of Company Weekly GBV
                          </div>
                        )}
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                          Percentage applied to total Company Weekly GBV to form the bonus pool
                        </span>
                      </div>

                      {/* Field 2: Maximum Welcome Bonus Multiplier */}
                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Maximum Welcome Bonus Multiplier
                        </label>
                        {isAdmin ? (
                          <input
                            type="number"
                            step="0.1"
                            value={rules.welcomeBonus?.maxMultiplier ?? 2}
                            onChange={(e) => setRules({ ...rules, welcomeBonus: { ...rules.welcomeBonus, maxMultiplier: parseFloat(e.target.value) || 0 } })}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)' }}
                          />
                        ) : (
                          <div style={{ padding: '9px 12px', background: 'var(--surface-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-main)' }}>
                            {rules.welcomeBonus?.maxMultiplier || 2}× Lifetime Business Volume
                          </div>
                        )}
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                          Lifetime cap: member lifetime BV × {rules.welcomeBonus?.maxMultiplier ?? 2}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {/* Field 3: Minimum Lifetime BV */}
                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Minimum Lifetime BV
                        </label>
                        {isAdmin ? (
                          <input
                            type="number"
                            min="0"
                            value={rules.welcomeBonus?.minLifetimeBv ?? 1250}
                            onChange={(e) => setRules({ ...rules, welcomeBonus: { ...rules.welcomeBonus, minLifetimeBv: parseFloat(e.target.value) || 0 } })}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)' }}
                          />
                        ) : (
                          <div style={{ padding: '9px 12px', background: 'var(--surface-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-main)' }}>
                            {(rules.welcomeBonus?.minLifetimeBv ?? 1250).toLocaleString()} BV
                          </div>
                        )}
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                          BV the member must have received in its lifetime: packages, products or transfers in
                        </span>
                      </div>

                      {/* Field 4: Minimum Sponsored Members */}
                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Minimum Sponsored Members
                        </label>
                        {isAdmin ? (
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={rules.welcomeBonus?.minSponsoredCount ?? 2}
                            onChange={(e) => setRules({ ...rules, welcomeBonus: { ...rules.welcomeBonus, minSponsoredCount: parseInt(e.target.value, 10) || 0 } })}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)' }}
                          />
                        ) : (
                          <div style={{ padding: '9px 12px', background: 'var(--surface-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-main)' }}>
                            {rules.welcomeBonus?.minSponsoredCount ?? 2} members
                          </div>
                        )}
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                          Directly sponsored members with active binary status (100 BV or more), placed anywhere in the tree (same wing allowed)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2B: Sponsor Income */}
                <div className="dashboard-card">
                  <div className="card-header-row">
                    <div className="card-title-group">
                      <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={18} />
                      </div>
                      <div>
                        <h2 className="card-title">Sponsor Income</h2>
                        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Direct sponsor's share of each direct's daily binary income</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Sponsor Binary Rate (0.20 = 20%)
                        </label>
                        {isAdmin ? (
                          <input
                            type="number"
                            step="0.01"
                            value={rules.sponsorBinaryBonus?.sponsorBinaryRate ?? 0.20}
                            onChange={(e) => setRules({ ...rules, sponsorBinaryBonus: { ...rules.sponsorBinaryBonus, sponsorBinaryRate: parseFloat(e.target.value) || 0 } })}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)' }}
                          />
                        ) : (
                          <div style={{ padding: '9px 12px', background: 'var(--surface-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-main)' }}>
                            {((rules.sponsorBinaryBonus?.sponsorBinaryRate || 0.20) * 100).toFixed(0)}% (Direct Team)
                          </div>
                        )}
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--success)', marginTop: '2px', display: 'block', fontWeight: 600 }}>
                          Share of each direct's daily binary income • No daily capping
                        </span>
                      </div>

                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                          Sponsor Income
                        </label>
                        {isAdmin ? (
                          <select
                            value={rules.sponsorBinaryBonus?.isEnabled !== false ? 'true' : 'false'}
                            onChange={(e) => setRules({ ...rules, sponsorBinaryBonus: { ...rules.sponsorBinaryBonus, isEnabled: e.target.value === 'true' } })}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)' }}
                          >
                            <option value="true">On (paid in the daily binary settlement)</option>
                            <option value="false">Off</option>
                          </select>
                        ) : (
                          <div style={{ padding: '9px 12px', background: 'var(--surface-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-main)' }}>
                            {rules.sponsorBinaryBonus?.isEnabled !== false ? 'On' : 'Off'}
                          </div>
                        )}
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                          The direct sponsor gets this share on top; the member's own binary income is not reduced
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2C: Payout Deductions: none on any income */}
                <div className="dashboard-card" style={{ border: '1px solid var(--success-border)', background: 'var(--success-light)' }}>
                  <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title-group">
                      <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--success-soft)', color: 'var(--success-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Percent size={18} />
                      </div>
                      <div>
                        <h2 className="card-title">Payout Deductions</h2>
                        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>No TDS or admin fee is deducted from any income. 100% of every income is credited to the wallet.</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Sub-tab 2: Simulator Panel */}
          {activeTab === 'simulator' && isAdmin && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '26px' }}>
              <div className="dashboard-card">
                <div className="card-header-row" style={{ marginBottom: '18px' }}>
                  <div className="card-title-group">
                    <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calculator size={20} />
                    </div>
                    <div>
                      <h2 className="card-title">Scenario Parameters</h2>
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Dry-run calculations without altering production ledgers</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  <button 
                    onClick={() => applyPreset('standard')} className="btn btn-secondary btn-sm">
                    Preset 1: Standard 10k:7k
                  </button>
                  <button 
                    onClick={() => applyPreset('cap_overflow')} className="btn btn-secondary btn-sm">
                    Preset 2: Daily Cap Exceeded
                  </button>
                  <button 
                    onClick={() => applyPreset('equal_match')} className="btn btn-secondary btn-sm">
                    Preset 3: Clean 5k:5k
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Left Leg Cumulative BV</label>
                      <input
                        type="number"
                        value={simParams.leftBV}
                        onChange={(e) => setSimParams({ ...simParams, leftBV: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)' }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Right Leg Cumulative BV</label>
                      <input
                        type="number"
                        value={simParams.rightBV}
                        onChange={(e) => setSimParams({ ...simParams, rightBV: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Binary Rate (20% = 0.20)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={simParams.binaryRate}
                        onChange={(e) => setSimParams({ ...simParams, binaryRate: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)' }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Daily Payout Cap (₹)</label>
                      <input
                        type="number"
                        value={simParams.dailyCap}
                        onChange={(e) => setSimParams({ ...simParams, dailyCap: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Already Paid Today (₹)</label>
                      <input
                        type="number"
                        value={simParams.alreadyEarnedToday}
                        onChange={(e) => setSimParams({ ...simParams, alreadyEarnedToday: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)' }}
                      />
                    </div>
                  </div>

                  <button 
                    className="btn btn-primary" 
                    onClick={() => handleRunSimulation()} 
                    disabled={simulating}
                    style={{ marginTop: '10px' }}
                  >
                    {simulating ? 'Calculating...' : 'Recalculate Scenario'}
                  </button>
                </div>
              </div>

              {simResult && (
                <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header-row" style={{ marginBottom: '18px' }}>
                    <div className="card-title-group">
                      <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Zap size={20} />
                      </div>
                      <div>
                        <h2 className="card-title">Computed Breakdown</h2>
                        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Simulated ledger audit output</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-base)' }}>Matched Business Volume (BV)</span>
                      <strong style={{ color: 'var(--text-main)' }}>{simResult.binaryMatching?.matchedBV?.toLocaleString() || simResult.binary?.matchedBV?.toLocaleString()} BV</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-base)' }}>
                        Raw Binary Commission {rules.binaryBonus?.rateInRupees ? `(₹${rules.binaryBonus.rateInRupees}/cycle)` : ''}
                      </span>
                      <strong style={{ color: 'var(--text-main)' }}>₹ {(simResult.binaryMatching?.rawCommission ?? simResult.binary?.rawBinaryCommission)?.toLocaleString()}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-base)' }}>Daily Cap Applied</span>
                      <strong style={{ color: (simResult.binaryMatching?.excessCommission || simResult.binary?.excessCommission) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {(simResult.binaryMatching?.excessCommission || simResult.binary?.excessCommission) > 0 
                          ? `Capped! (₹${simResult.binaryMatching?.excessCommission || simResult.binary?.excessCommission} Flushed)` 
                          : 'Under Daily Cap'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-base)' }}>Payable Binary Commission</span>
                      <strong style={{ color: 'var(--success)', fontSize: 'var(--fs-lg)' }}>₹ {(simResult.binaryMatching?.payableCommission ?? simResult.binary?.payableBinaryCommission)?.toLocaleString()}</strong>
                    </div>
                  </div>

                  <div style={{ 
                    marginTop: 'auto',
                    background: 'var(--primary-light)', 
                    border: '1.5px solid var(--primary-border)', 
                    padding: '18px 20px', 
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--primary-strong)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Total Simulated Commission
                      </div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Includes Binary + Repurchase + Tiers
                      </div>
                    </div>

                    <div style={{ 
                      fontFamily: 'var(--font-display)', 
                      fontSize: 'var(--fs-4xl)', 
                      fontWeight: 900, 
                      color: 'var(--primary-hover)',
                      letterSpacing: '-0.5px' 
                    }}>
                      ₹ {simResult.totalSimulatedCommission?.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 3: Member Personal Status View */}
          {activeTab === 'my-status' && !isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '20px' }}>
                <div className="dashboard-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Package</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                    {user?.packageName || 'Starter Package'}
                  </div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Daily Binary Cap: <strong style={{ color: 'var(--text-main)' }}>₹ {user?.dailyCapping?.toLocaleString() || '4,000'} / day</strong>
                  </div>
                </div>

                <div className="dashboard-card" style={{ borderLeft: '4px solid var(--success)' }}>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Leadership Rank</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--success-strong)', marginTop: '2px' }}>
                    {currentRank}
                  </div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Total Matched Pairs: <strong style={{ color: 'var(--text-main)' }}>{matchedPairs}</strong>
                  </div>
                </div>

                <div className="dashboard-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Next Rank Milestone</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--warning-hover)', marginTop: '2px' }}>
                    {nextTier?.rankName || 'Star'}
                  </div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Cash Award: <strong style={{ color: 'var(--success)' }}>₹ {nextTier?.rewardAmount?.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default IncomeSettingsPage;
