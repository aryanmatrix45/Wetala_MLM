import React, { useState, useEffect } from 'react';
import { 
  Percent, 
  Store, 
  Users, 
  Calculator, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Award, 
  Crown, 
  TrendingUp, 
  Building2, 
  Lock, 
  Eye, 
  Save, 
  Plus, 
  Trash2,
  Sparkles,
  Gift
} from 'lucide-react';
import { api } from '../services/api';

interface IncomeSettingsPageProps {
  user?: any;
  token?: string | null;
  defaultSection?: 'all' | 'simulator' | 'teamBonus' | 'royalty' | 'rewards' | string;
}

const DEFAULT_PERFORMANCE_SLABS = [
  { tierId: 'TPB-1', pairCount: 10, leftThreshold: 10, rightThreshold: 10, royaltyBonusPercent: 3, limitAmount: 10000 },
  { tierId: 'TPB-2', pairCount: 100, leftThreshold: 100, rightThreshold: 100, royaltyBonusPercent: 3, limitAmount: 30000 },
  { tierId: 'TPB-3', pairCount: 400, leftThreshold: 400, rightThreshold: 400, royaltyBonusPercent: 2, limitAmount: 100000 },
  { tierId: 'TPB-4', pairCount: 1600, leftThreshold: 1600, rightThreshold: 1600, royaltyBonusPercent: 2, limitAmount: 300000 },
  { tierId: 'TPB-5', pairCount: 5000, leftThreshold: 5000, rightThreshold: 5000, royaltyBonusPercent: 1, limitAmount: 500000 },
  { tierId: 'TPB-6', pairCount: 25000, leftThreshold: 25000, rightThreshold: 25000, royaltyBonusPercent: 1, limitAmount: 1500000 },
];

const DEFAULT_TEAM_BONUS_TIERS = [
  { tierId: 'TB-1', leftVolume: 1000, rightVolume: 1000, rate: 0.15 },
  { tierId: 'TB-2', leftVolume: 2500, rightVolume: 2500, rate: 0.10 },
  { tierId: 'TB-3', leftVolume: 7500, rightVolume: 7500, rate: 0.07 },
  { tierId: 'TB-4', leftVolume: 20000, rightVolume: 20000, rate: 0.06 },
  { tierId: 'TB-5', leftVolume: 35000, rightVolume: 35000, rate: 0.05 },
  { tierId: 'TB-6', leftVolume: 70000, rightVolume: 70000, rate: 0.04 },
  { tierId: 'TB-7', leftVolume: 150000, rightVolume: 150000, rate: 0.03 },
  { tierId: 'TB-8', leftVolume: 300000, rightVolume: 300000, rate: 0.02 },
];

const DEFAULT_FRANCHISE_TIERS = [
  { threshold: 50000, rate: 0.05 },
  { threshold: 100000, rate: 0.08 },
  { threshold: 500000, rate: 0.10 },
  { threshold: 1000000, rate: 0.12 },
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

const DEFAULT_ROYALTY = {
  isEnabled: true,
  poolPercent: 2, // 2% of Company Monthly Turnover
  eligibleRanks: ['DIAMOND', 'DOUBLE DIAMOND', 'CROWN DIAMOND', 'PLATINUM', 'TOPAZ', 'KOHINOOR', 'DOUBLE KOHINOOR', 'TRIPLE KOHINOOR'],
  minTeamVolume: 50000,
  notes: 'Royalty Club pool equally distributed among qualifying Diamond and above leaders from Company Monthly Turnover (CTO).',
};

const DEFAULT_CONSULTANCY = {
  isEnabled: true,
  qualifyingAmount: 2500, // ₹2,500 DP
  productQuantity: 1,
  qualifyingMonths: 3, // 3 consecutive months
  freeProductMonth: 4, // 4th month free product
  notes: 'Purchase products worth ₹2,500 DP continuously for 3 consecutive months to receive a free product of ₹2,500 DP in the 4th month.',
};

const FALLBACK_FULL_RULES = {
  ruleSetId: 'DEFAULT_RULES',
  version: 3,
  isActive: true,
  welcomeBonus: {
    isEnabled: true,
    requiresLeftAndRight: true,
    ratePercent: 4,
    limitMode: 'ACTIVE_PACKAGE',
    fixedAmount: 0,
    notes: '4% on every new package. Requires Left & Right completed. Capped at active package limit.',
  },
  binaryBonus: {
    isEnabled: true,
    standardBinaryRate: 0.20,
    specialBinaryRate: 0.25,
    isSpecialRateEnabled: false,
    calculationBase: 'BV',
    volumeCarryForwardMode: 'CARRY_FORWARD',
    dailyBinaryPayoutCap: 4000,
    excessCapPolicy: 'FLUSH',
    firstPairRatio: '1:2_or_2:1',
    subsequentPairRatio: '1:1',
  },
  teamBonus: {
    isEnabled: true,
    calculationBase: 'MATCHED_BV',
    tiers: DEFAULT_TEAM_BONUS_TIERS,
  },
  selfPurchaseBonus: {
    isEnabled: true,
    ratePercent: 0.08,
    calculationBase: 'BV',
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
  franchisePolicy: {
    isEnabled: true,
    incentiveType: 'MARGIN',
    tiers: DEFAULT_FRANCHISE_TIERS,
    uplineBonusRate: 0.02,
  },
  uplineBonus: {
    isEnabled: true,
    uplineBonusRate: 0.02,
    maxUplineLevels: 1,
    calculationBase: 'BV',
  },
  royalty: DEFAULT_ROYALTY,
  consultancyBonus: DEFAULT_CONSULTANCY,
  retailProfit: {
    isEnabled: true,
    maxPercentage: 50,
    calculationBase: 'MRP',
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
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // Section Mode: 'teamBonus' | 'royalty' | 'rewards' | 'simulator'
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
    purchaseAmount: 10000,
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

        // Ensure Team Volume Bonus tiers
        if (!loadedRules.teamBonus?.tiers || loadedRules.teamBonus.tiers.length === 0) {
          loadedRules.teamBonus = {
            ...(loadedRules.teamBonus || {}),
            isEnabled: true,
            calculationBase: 'MATCHED_BV',
            tiers: DEFAULT_TEAM_BONUS_TIERS,
          };
        }

        // Ensure Franchise tiers
        if (!loadedRules.franchisePolicy?.tiers || loadedRules.franchisePolicy.tiers.length === 0) {
          loadedRules.franchisePolicy = {
            ...(loadedRules.franchisePolicy || {}),
            isEnabled: true,
            incentiveType: 'MARGIN',
            uplineBonusRate: loadedRules.franchisePolicy?.uplineBonusRate || 0.02,
            tiers: DEFAULT_FRANCHISE_TIERS,
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

        // Ensure Royalty settings
        if (!loadedRules.royalty || loadedRules.royalty.poolPercent === undefined) {
          loadedRules.royalty = {
            ...(loadedRules.royalty || {}),
            ...DEFAULT_ROYALTY,
          };
        }

        // Ensure Consultancy settings
        if (!loadedRules.consultancyBonus || loadedRules.consultancyBonus.qualifyingAmount === undefined) {
          loadedRules.consultancyBonus = {
            ...(loadedRules.consultancyBonus || {}),
            ...DEFAULT_CONSULTANCY,
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
      p = { leftBV: 25000, rightBV: 20000, binaryRate: 0.20, dailyCap: 4000, alreadyEarnedToday: 3500, purchaseAmount: 12000 };
    } else if (presetName === 'equal_match') {
      p = { leftBV: 5000, rightBV: 5000, binaryRate: 0.20, dailyCap: 4000, alreadyEarnedToday: 0, purchaseAmount: 6500 };
    } else {
      p = { leftBV: 10000, rightBV: 7000, binaryRate: 0.20, dailyCap: 4000, alreadyEarnedToday: 3500, purchaseAmount: 10000 };
    }
    setSimParams(p);
    handleRunSimulation(p);
  };

  if (loading) {
    return (
      <div className="page-body" style={{ textAlign: 'center', padding: '100px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b', fontWeight: 600 }}>Loading active compensation plan from backend database...</p>
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

  // Determine Page Titles & Subtitles based on defaultSection
  let pageBadge = isAdmin ? 'ADMIN CONTROL CENTER' : 'MEMBER PLAN & BENEFITS';
  let pageTitle = 'Compensation Rules & Live Simulator';
  let pageSubtitle = 'Master binary matching, welcome bonus, and interactive live simulator.';

  if (section === 'teamBonus') {
    pageBadge = 'TEAM VOLUME & PERFORMANCE';
    pageTitle = 'Team Volume Bonus & Performance Slabs';
    pageSubtitle = 'Repurchase matched BV bonus slabs (15% down to 2%) and Company Turnover (CTO) Performance pools (3% down to 1%).';
  } else if (section === 'royalty') {
    pageBadge = 'LEADERSHIP & REPURCHASE LOYALTY';
    pageTitle = 'Royalty Pool & Consultancy Program';
    pageSubtitle = 'Monthly Company Turnover (CTO) Royalty Club for Diamond+ leaders and 4th Month Free Product Loyalty Program.';
  } else if (section === 'rewards') {
    pageBadge = 'LIFETIME RECOGNITION & AWARDS';
    pageTitle = '15 Leadership Ranks & Lifetime Rewards';
    pageSubtitle = 'Cumulative Left:Right pair milestones with one-time cash & luxury rewards from ₹1,000 up to ₹2 Crore.';
  }

  return (
    <div className="page-body">
      {/* Header & Section Title */}
      <div className="welcome-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 800, 
              padding: '3px 8px', 
              borderRadius: '6px', 
              background: isAdmin ? '#eff6ff' : '#ecfdf5', 
              color: isAdmin ? '#1d4ed8' : '#047857',
              letterSpacing: '0.5px' 
            }}>
              {pageBadge}
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>•</span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              Version {rules?.version || 3} (Database Active)
            </span>
          </div>

          <h1 className="page-title">{pageTitle}</h1>
          <p className="page-subtitle">{pageSubtitle}</p>
        </div>

        {/* Action Controls & Tab Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {section === 'simulator' && (
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              {!isAdmin && (
                <button
                  onClick={() => setActiveTab('my-status')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '9px',
                    fontSize: '13px',
                    fontWeight: 700,
                    background: activeTab === 'my-status' ? '#ffffff' : 'transparent',
                    color: activeTab === 'my-status' ? '#059669' : '#64748b',
                    boxShadow: activeTab === 'my-status' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  <TrendingUp size={16} />
                  <span>MY STATUS & RANK</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('rules')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '9px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: activeTab === 'rules' ? '#ffffff' : 'transparent',
                  color: activeTab === 'rules' ? '#2563eb' : '#64748b',
                  boxShadow: activeTab === 'rules' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                {isAdmin ? <Zap size={16} /> : <Eye size={16} />}
                <span>{isAdmin ? 'RULE CONFIGURATOR' : 'PLAN SLABS (READ-ONLY)'}</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => setActiveTab('simulator')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '9px',
                    fontSize: '13px',
                    fontWeight: 700,
                    background: activeTab === 'simulator' ? '#ffffff' : 'transparent',
                    color: activeTab === 'simulator' ? '#2563eb' : '#64748b',
                    boxShadow: activeTab === 'simulator' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  <Calculator size={16} />
                  <span>LIVE SIMULATOR</span>
                </button>
              )}
            </div>
          )}

          {isAdmin && (
            <button 
              className="primary-btn" 
              onClick={handleSaveRules} 
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={16} />
              <span>{saving ? 'Saving to DB...' : 'Save Rule Changes'}</span>
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '14px 18px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={20} color="#10b981" />
          <span style={{ fontWeight: 600 }}>{saveSuccess}</span>
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '14px 18px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={20} color="#ef4444" />
          <span style={{ fontWeight: 600 }}>{error}</span>
        </div>
      )}

      {/* =========================================================================
          PAGE 1: TEAM BONUS SLABS (defaultSection === 'teamBonus')
          ========================================================================= */}
      {section === 'teamBonus' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {/* Card 5: Team Volume Bonus (8 Slabs) */}
          <div className="dashboard-card">
            <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title-group">
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={20} />
                </div>
                <div>
                  <h2 className="card-title">Team Volume Bonus (Repurchase CTO Slabs)</h2>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Matched BV repurchase pool bonus • 8 Progressive Volume Slabs from 15% down to 2%
                  </span>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    const newTiers = [...(rules.teamBonus?.tiers || [])];
                    newTiers.push({
                      tierId: `TB-${newTiers.length + 1}`,
                      leftVolume: 500000,
                      rightVolume: 500000,
                      rate: 0.01
                    });
                    setRules({ ...rules, teamBonus: { ...rules.teamBonus, tiers: newTiers } });
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '7px 14px', borderRadius: '8px', background: '#fffbeb', color: '#d97706', fontWeight: 700, border: '1px solid #fde68a', cursor: 'pointer' }}
                >
                  <Plus size={15} /> Add Volume Tier
                </button>
              )}
            </div>

            <table className="data-table" style={{ fontSize: '13px', marginTop: '12px' }}>
              <thead>
                <tr>
                  <th>Tier ID</th>
                  <th>Left BV : Right BV Match</th>
                  <th>CTO Pool Percentage</th>
                  <th>Calculation Base</th>
                  {isAdmin && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {rules.teamBonus?.tiers?.map((tier: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 800, color: '#64748b' }}>{tier.tierId || `TB-${idx + 1}`}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>
                      {isAdmin ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            value={tier.leftVolume}
                            onChange={(e) => {
                              const newTiers = [...rules.teamBonus.tiers];
                              const val = parseInt(e.target.value) || 0;
                              newTiers[idx].leftVolume = val;
                              newTiers[idx].rightVolume = val;
                              setRules({ ...rules, teamBonus: { ...rules.teamBonus, tiers: newTiers } });
                            }}
                            style={{ width: '90px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                          />
                          <span>BV : </span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>{tier.leftVolume?.toLocaleString()} BV</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>
                          {tier.leftVolume?.toLocaleString()} BV : {tier.rightVolume?.toLocaleString()} BV
                        </span>
                      )}
                    </td>
                    <td>
                      {isAdmin ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            step="0.5"
                            value={((tier.rate || 0) * 100).toFixed(1)}
                            onChange={(e) => {
                              const newTiers = [...rules.teamBonus.tiers];
                              newTiers[idx].rate = (parseFloat(e.target.value) || 0) / 100;
                              setRules({ ...rules, teamBonus: { ...rules.teamBonus, tiers: newTiers } });
                            }}
                            style={{ width: '65px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                          />
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#d97706' }}>% CTO</span>
                        </div>
                      ) : (
                        <strong style={{ color: '#d97706', fontSize: '15px' }}>{((tier.rate || 0) * 100).toFixed(0)}% CTO</strong>
                      )}
                    </td>
                    <td style={{ color: '#64748b' }}>Matched Repurchase BV</td>
                    {isAdmin && (
                      <td>
                        <button
                          onClick={() => {
                            const newTiers = rules.teamBonus.tiers.filter((_: any, i: number) => i !== idx);
                            setRules({ ...rules, teamBonus: { ...rules.teamBonus, tiers: newTiers } });
                          }}
                          style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                          title="Delete Tier"
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

          {/* Card 4: Team Performance Bonus (6 Slabs) */}
          <div className="dashboard-card">
            <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title-group">
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h2 className="card-title">Team Performance Bonus (CTO Slabs)</h2>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
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
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '7px 14px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', fontWeight: 700, border: '1px solid #bfdbfe', cursor: 'pointer' }}
                >
                  <Plus size={15} /> Add Performance Slab
                </button>
              )}
            </div>

            <table className="data-table" style={{ fontSize: '13px', marginTop: '12px' }}>
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
                    <td style={{ fontWeight: 800, color: '#64748b' }}>{slab.tierId || `TPB-${idx + 1}`}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>
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
                            style={{ width: '80px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                          />
                          <span>:</span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>{slab.pairCount ?? slab.leftThreshold ?? 10} Pairs</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>
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
                            style={{ width: '65px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                          />
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>% CTO</span>
                        </div>
                      ) : (
                        <strong style={{ color: '#2563eb', fontSize: '15px' }}>{slab.royaltyBonusPercent ?? 3}% CTO</strong>
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
                            style={{ width: '100px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                          />
                        </div>
                      ) : (
                        <strong style={{ color: '#059669', fontSize: '15px' }}>₹ {(slab.limitAmount ?? 10000)?.toLocaleString()}</strong>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          onClick={() => {
                            const newTiers = rules.teamPerformanceBonus.tiers.filter((_: any, i: number) => i !== idx);
                            setRules({ ...rules, teamPerformanceBonus: { ...rules.teamPerformanceBonus, tiers: newTiers } });
                          }}
                          style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
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
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '12px' }}>
              * All qualified team members equally divide the CTO pool. No daily capping applies to Team Performance Bonus.
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAGE 2: ROYALTY & CONSULTANCY (defaultSection === 'royalty')
          ========================================================================= */}
      {section === 'royalty' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {/* Card: Royalty Club Pool */}
          <div className="dashboard-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="card-title-group">
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="card-title">Royalty Club Pool (CTO Distribution)</h2>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Exclusive monthly leadership pool distributed equally among Diamond and higher leadership ranks
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', background: rules.royalty?.isEnabled ? '#ecfdf5' : '#fef2f2', color: rules.royalty?.isEnabled ? '#059669' : '#dc2626' }}>
                  {rules.royalty?.isEnabled ? 'ROYALTY POOL ACTIVE' : 'POOL INACTIVE'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px', marginBottom: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Monthly CTO Pool Share</span>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#8b5cf6', marginTop: '4px' }}>
                  {isAdmin ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        step="0.5"
                        value={rules.royalty?.poolPercent ?? 2}
                        onChange={(e) => setRules({ ...rules, royalty: { ...rules.royalty, poolPercent: parseFloat(e.target.value) || 0 } })}
                        style={{ width: '80px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '18px', fontWeight: 800 }}
                      />
                      <span>% CTO</span>
                    </div>
                  ) : (
                    `${rules.royalty?.poolPercent || 2}% CTO`
                  )}
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>Divided equally across active qualifiers</span>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Min Qualifying Team Volume</span>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                  {isAdmin ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        value={rules.royalty?.minTeamVolume ?? 50000}
                        onChange={(e) => setRules({ ...rules, royalty: { ...rules.royalty, minTeamVolume: parseInt(e.target.value) || 0 } })}
                        style={{ width: '100px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '18px', fontWeight: 800 }}
                      />
                      <span style={{ fontSize: '14px' }}>BV</span>
                    </div>
                  ) : (
                    `${(rules.royalty?.minTeamVolume || 50000)?.toLocaleString()} BV`
                  )}
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>Monthly combined repurchase volume</span>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Your Current Rank Status</span>
                <div style={{ fontSize: '20px', fontWeight: 900, color: currentRank === 'FRESHER' ? '#64748b' : '#059669', marginTop: '4px' }}>
                  {currentRank}
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  {['DIAMOND', 'DOUBLE DIAMOND', 'CROWN DIAMOND', 'PLATINUM', 'TOPAZ', 'KOHINOOR', 'DOUBLE KOHINOOR', 'TRIPLE KOHINOOR'].includes(currentRank.toUpperCase()) 
                    ? '🎉 You qualify for the Royalty Club Pool!' 
                    : 'Requires Diamond rank or above to qualify.'}
                </span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
                Eligible Leadership Ranks for Monthly Royalty Club:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['DIAMOND', 'DOUBLE DIAMOND', 'CROWN DIAMOND', 'PLATINUM', 'TOPAZ', 'KOHINOOR', 'DOUBLE KOHINOOR', 'TRIPLE KOHINOOR'].map((rank, idx) => (
                  <span key={idx} style={{ fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '6px', background: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff' }}>
                    ★ {rank}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card: Consultancy Loyalty Bonus (4th Month Free Product) */}
          <div className="dashboard-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="card-title-group">
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Gift size={20} />
                </div>
                <div>
                  <h2 className="card-title">Consultancy Loyalty Bonus (4th Month Free Product)</h2>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Special repurchase customer loyalty program • Purchase ₹2,500 DP continuously for 3 months to unlock free product in Month 4
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', background: '#ecfdf5', color: '#059669' }}>
                  PROGRAM ACTIVE
                </span>
              </div>
            </div>

            {/* Stepper Card */}
            <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '20px', marginTop: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#166534', marginBottom: '14px' }}>
                4-MONTH CONSECUTIVE REPURCHASE REWARD TIMELINE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div style={{ background: '#ffffff', padding: '14px', borderRadius: '10px', border: '1.5px solid #86efac', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#166534' }}>MONTH 1</span>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>₹2,500 DP</div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Product Repurchase</span>
                </div>

                <div style={{ background: '#ffffff', padding: '14px', borderRadius: '10px', border: '1.5px solid #86efac', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#166534' }}>MONTH 2</span>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>₹2,500 DP</div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Product Repurchase</span>
                </div>

                <div style={{ background: '#ffffff', padding: '14px', borderRadius: '10px', border: '1.5px solid #86efac', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#166534' }}>MONTH 3</span>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>₹2,500 DP</div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Product Repurchase</span>
                </div>

                <div style={{ background: '#fef3c7', padding: '14px', borderRadius: '10px', border: '2px solid #f59e0b', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 900, color: '#b45309' }}>MONTH 4 (AWARD)</span>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#b45309', margin: '4px 0' }}>FREE PRODUCT 🎁</div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#b45309' }}>₹2,500 DP Free Value</span>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Qualifying Monthly Purchase (₹ DP)</label>
                  <input
                    type="number"
                    value={rules.consultancyBonus?.qualifyingAmount ?? 2500}
                    onChange={(e) => setRules({ ...rules, consultancyBonus: { ...rules.consultancyBonus, qualifyingAmount: parseInt(e.target.value) || 0 } })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Required Consecutive Months</label>
                  <input
                    type="number"
                    value={rules.consultancyBonus?.qualifyingMonths ?? 3}
                    onChange={(e) => setRules({ ...rules, consultancyBonus: { ...rules.consultancyBonus, qualifyingMonths: parseInt(e.target.value) || 0 } })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Free Product Reward Month</label>
                  <input
                    type="number"
                    value={rules.consultancyBonus?.freeProductMonth ?? 4}
                    onChange={(e) => setRules({ ...rules, consultancyBonus: { ...rules.consultancyBonus, freeProductMonth: parseInt(e.target.value) || 0 } })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          PAGE 3: LIFETIME REWARDS (defaultSection === 'rewards')
          ========================================================================= */}
      {section === 'rewards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {/* Member Rank & Reward Progress Card */}
          <div className="dashboard-card" style={{ background: 'linear-gradient(135deg, #fefce8 0%, #ffffff 100%)', border: '1.5px solid #fef08a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  YOUR LEADERSHIP RANK & REWARD TRACKER
                </span>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                  {currentRank} <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>({matchedPairs} Total Matched Pairs)</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Next Milestone Reward</span>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#059669' }}>
                  ₹ {nextTier?.rewardAmount ? nextTier.rewardAmount.toLocaleString() : '1,000'}
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb' }}>
                  Rank: {nextTier?.rankName || 'FRESHER'}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                <span>Milestone Progress to {nextTier?.rankName || 'Target'}</span>
                <span>{matchedPairs} / {targetPairs} Pairs ({progressPercent}%)</span>
              </div>
              <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${progressPercent}%`, 
                    height: '100%', 
                    background: 'linear-gradient(90deg, #d97706 0%, #10b981 100%)', 
                    borderRadius: '6px',
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
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={20} />
                </div>
                <div>
                  <h2 className="card-title">15 Leadership Ranks & Lifetime Rewards</h2>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
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
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '7px 14px', borderRadius: '8px', background: '#fef3c7', color: '#b45309', fontWeight: 700, border: '1px solid #fde68a', cursor: 'pointer' }}
                >
                  <Plus size={15} /> Add Rank
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto', marginTop: '14px' }}>
              <table className="data-table" style={{ fontSize: '13px' }}>
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
                      <tr key={idx} style={{ background: isCurrent ? '#f0fdf4' : 'transparent' }}>
                        <td style={{ fontWeight: 800, color: '#64748b' }}>
                          #{idx + 1}
                        </td>
                        <td style={{ fontWeight: 800, color: '#0f172a' }}>
                          {isAdmin ? (
                            <input
                              type="text"
                              value={tier.rankName}
                              onChange={(e) => {
                                const newTiers = [...rules.rewards.tiers];
                                newTiers[idx].rankName = e.target.value;
                                setRules({ ...rules, rewards: { ...rules.rewards, tiers: newTiers } });
                              }}
                              style={{ width: '150px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Crown size={15} color="#d97706" />
                              <span style={{ fontSize: '14px', fontWeight: 800 }}>{tier.rankName}</span>
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
                                style={{ width: '90px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                              />
                              <span style={{ fontSize: '12px', color: '#64748b' }}>Pairs</span>
                            </div>
                          ) : (
                            <strong style={{ color: '#1e293b' }}>
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
                                style={{ width: '120px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}
                              />
                            </div>
                          ) : (
                            <strong style={{ color: '#059669', fontSize: '15px' }}>
                              ₹ {tier.rewardAmount?.toLocaleString()}
                            </strong>
                          )}
                        </td>
                        <td>
                          {isAchieved ? (
                            <span style={{ fontSize: '11px', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#059669' }}>
                              ✓ ACHIEVED
                            </span>
                          ) : isCurrent ? (
                            <span style={{ fontSize: '11px', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb' }}>
                              IN PROGRESS
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#64748b' }}>
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
                              style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
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
          PAGE 4: INCOME & SIMULATOR (defaultSection === 'simulator' or 'all')
          ========================================================================= */}
      {section === 'simulator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          
          {/* Sub-tab 1: Rules Configurator / Plan View */}
          {activeTab === 'rules' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
              {!isAdmin && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '14px 18px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Lock size={18} color="#2563eb" />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>
                    You are viewing the official company compensation plan in Read-Only mode. All income calculations follow these active database rules.
                  </span>
                </div>
              )}

              {/* Grid: Binary Matching & Welcome Bonus */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                
                {/* Card 1: Binary Income & Daily Cap */}
                <div className="dashboard-card">
                  <div className="card-header-row">
                    <div className="card-title-group">
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Percent size={18} />
                      </div>
                      <div>
                        <h2 className="card-title">1. Binary Income & Capping</h2>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>First pair 1:2 or 2:1, subsequent 1:1 • 20% Matching Rate</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Binary Rate (20% = 0.20)
                        </label>
                        {isAdmin ? (
                          <input
                            type="number"
                            step="0.01"
                            value={rules.binaryBonus?.standardBinaryRate}
                            onChange={(e) => setRules({ ...rules, binaryBonus: { ...rules.binaryBonus, standardBinaryRate: parseFloat(e.target.value) || 0 } })}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                          />
                        ) : (
                          <div style={{ padding: '9px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                            {((rules.binaryBonus?.standardBinaryRate || 0.20) * 100).toFixed(0)}% (₹250 per 1,250 BV)
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Base Daily Payout Cap (₹)
                        </label>
                        {isAdmin ? (
                          <input
                            type="number"
                            value={rules.binaryBonus?.dailyBinaryPayoutCap}
                            onChange={(e) => setRules({ ...rules, binaryBonus: { ...rules.binaryBonus, dailyBinaryPayoutCap: parseFloat(e.target.value) || 0 } })}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                          />
                        ) : (
                          <div style={{ padding: '9px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                            ₹ {rules.binaryBonus?.dailyBinaryPayoutCap?.toLocaleString()} / day (Base)
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>First Pair Ratio</label>
                        <div style={{ padding: '9px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#2563eb' }}>
                          1:2 or 2:1
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Subsequent Pair Ratio</label>
                        <div style={{ padding: '9px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#059669' }}>
                          1:1
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Welcome Bonus & Sponsor Binary */}
                <div className="dashboard-card">
                  <div className="card-header-row">
                    <div className="card-title-group">
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={18} />
                      </div>
                      <div>
                        <h2 className="card-title">2. Welcome & Sponsor Binary</h2>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>4% Welcome Bonus • 20% Direct Sponsor Binary Match</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Welcome Income Rate (%)
                        </label>
                        {isAdmin ? (
                          <input
                            type="number"
                            value={rules.welcomeBonus?.ratePercent ?? 4}
                            onChange={(e) => setRules({ ...rules, welcomeBonus: { ...rules.welcomeBonus, ratePercent: parseFloat(e.target.value) || 0 } })}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                          />
                        ) : (
                          <div style={{ padding: '9px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                            {rules.welcomeBonus?.ratePercent || 4}% on every new package
                          </div>
                        )}
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                          Requires 1 Left + 1 Right complete
                        </span>
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Sponsor Binary Rate (0.20 = 20%)
                        </label>
                        {isAdmin ? (
                          <input
                            type="number"
                            step="0.01"
                            value={rules.sponsorBinaryBonus?.sponsorBinaryRate ?? 0.20}
                            onChange={(e) => setRules({ ...rules, sponsorBinaryBonus: { ...rules.sponsorBinaryBonus, sponsorBinaryRate: parseFloat(e.target.value) || 0 } })}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                          />
                        ) : (
                          <div style={{ padding: '9px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                            {((rules.sponsorBinaryBonus?.sponsorBinaryRate || 0.20) * 100).toFixed(0)}% (Direct Team)
                          </div>
                        )}
                        <span style={{ fontSize: '11px', color: '#059669', marginTop: '2px', display: 'block', fontWeight: 600 }}>
                          No daily capping • Single-leg eligible
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Self Purchase Bonus (0.08 = 8%)
                        </label>
                        {isAdmin ? (
                          <input
                            type="number"
                            step="0.01"
                            value={rules.selfPurchaseBonus?.ratePercent ?? 0.08}
                            onChange={(e) => setRules({ ...rules, selfPurchaseBonus: { ...rules.selfPurchaseBonus, ratePercent: parseFloat(e.target.value) || 0 } })}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                          />
                        ) : (
                          <div style={{ padding: '9px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                            {((rules.selfPurchaseBonus?.ratePercent || 0.08) * 100).toFixed(0)}% Cashback
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Retail Profit Margin Max (%)
                        </label>
                        {isAdmin ? (
                          <input
                            type="number"
                            value={rules.retailProfit?.maxPercentage ?? 50}
                            onChange={(e) => setRules({ ...rules, retailProfit: { ...rules.retailProfit, maxPercentage: parseFloat(e.target.value) || 0 } })}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                          />
                        ) : (
                          <div style={{ padding: '9px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                            Up to {rules.retailProfit?.maxPercentage || 50}% Retail Margin
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Card 6: Franchise / Stock Point Plan */}
              <div className="dashboard-card">
                <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="card-title-group">
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={18} />
                    </div>
                    <div>
                      <h2 className="card-title">Franchise & Stock Point Model</h2>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Stock Point Investment • Franchise Turnover Margin (FTO) • Sponsoring Upline Bonus (2%)</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isAdmin && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: '#eff6ff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                        <span style={{ fontWeight: 700, color: '#1e40af' }}>Upline Bonus:</span>
                        <input
                          type="number"
                          step="0.5"
                          value={((rules.franchisePolicy?.uplineBonusRate ?? 0.02) * 100).toFixed(0)}
                          onChange={(e) => setRules({ ...rules, franchisePolicy: { ...rules.franchisePolicy, uplineBonusRate: (parseFloat(e.target.value) || 0) / 100 } })}
                          style={{ width: '45px', padding: '3px 6px', border: '1px solid #bfdbfe', borderRadius: '4px', fontSize: '12px' }}
                        />
                        <span style={{ fontWeight: 700, color: '#1e40af' }}>%</span>
                      </div>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => {
                          const newTiers = [...(rules.franchisePolicy?.tiers || [])];
                          newTiers.push({
                            threshold: 2000000,
                            rate: 0.15
                          });
                          setRules({ ...rules, franchisePolicy: { ...rules.franchisePolicy, tiers: newTiers } });
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px', borderRadius: '8px', background: '#f1f5f9', color: '#334155', fontWeight: 700, border: '1px solid #cbd5e1', cursor: 'pointer' }}
                      >
                        <Plus size={14} /> Add Franchise Tier
                      </button>
                    )}
                  </div>
                </div>

                <table className="data-table" style={{ fontSize: '13px', marginTop: '12px' }}>
                  <thead>
                    <tr>
                      <th>Stock Point Investment (₹)</th>
                      <th>Franchise Margin (FTO)</th>
                      <th>Sponsoring Upline Bonus</th>
                      {isAdmin && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rules.franchisePolicy?.tiers?.map((f: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 800, color: '#0f172a' }}>
                          {isAdmin ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>₹</span>
                              <input
                                type="number"
                                value={f.threshold}
                                onChange={(e) => {
                                  const newTiers = [...rules.franchisePolicy.tiers];
                                  newTiers[idx].threshold = parseInt(e.target.value) || 0;
                                  setRules({ ...rules, franchisePolicy: { ...rules.franchisePolicy, tiers: newTiers } });
                                }}
                                style={{ width: '110px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                              />
                            </div>
                          ) : (
                            <span style={{ fontSize: '14px', fontWeight: 800 }}>₹ {f.threshold?.toLocaleString()}</span>
                          )}
                        </td>
                        <td>
                          {isAdmin ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                step="0.5"
                                value={((f.rate || 0) * 100).toFixed(0)}
                                onChange={(e) => {
                                  const newTiers = [...rules.franchisePolicy.tiers];
                                  newTiers[idx].rate = (parseFloat(e.target.value) || 0) / 100;
                                  setRules({ ...rules, franchisePolicy: { ...rules.franchisePolicy, tiers: newTiers } });
                                }}
                                style={{ width: '60px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                              />
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>% Margin</span>
                            </div>
                          ) : (
                            <strong style={{ color: '#059669', fontSize: '14px' }}>{((f.rate || 0) * 100).toFixed(0)}% Margin</strong>
                          )}
                        </td>
                        <td>
                          <span style={{ color: '#1e40af', fontWeight: 700 }}>2% Direct Upline</span>
                        </td>
                        {isAdmin && (
                          <td>
                            <button
                              onClick={() => {
                                const newTiers = rules.franchisePolicy.tiers.filter((_: any, i: number) => i !== idx);
                                setRules({ ...rules, franchisePolicy: { ...rules.franchisePolicy, tiers: newTiers } });
                              }}
                              style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              title="Delete Tier"
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
            </div>
          )}

          {/* Sub-tab 2: Simulator Panel */}
          {activeTab === 'simulator' && isAdmin && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '26px' }}>
              <div className="dashboard-card">
                <div className="card-header-row" style={{ marginBottom: '18px' }}>
                  <div className="card-title-group">
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calculator size={20} />
                    </div>
                    <div>
                      <h2 className="card-title">Scenario Parameters</h2>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Dry-run calculations without altering production ledgers</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  <button 
                    onClick={() => applyPreset('standard')}
                    style={{ fontSize: '11.5px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', background: '#f1f5f9', color: '#334155' }}
                  >
                    Preset 1: Standard 10k:7k
                  </button>
                  <button 
                    onClick={() => applyPreset('cap_overflow')}
                    style={{ fontSize: '11.5px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', background: '#f1f5f9', color: '#334155' }}
                  >
                    Preset 2: Daily Cap Exceeded
                  </button>
                  <button 
                    onClick={() => applyPreset('equal_match')}
                    style={{ fontSize: '11.5px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', background: '#f1f5f9', color: '#334155' }}
                  >
                    Preset 3: Clean 5k:5k
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Left Leg Cumulative BV</label>
                      <input
                        type="number"
                        value={simParams.leftBV}
                        onChange={(e) => setSimParams({ ...simParams, leftBV: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Right Leg Cumulative BV</label>
                      <input
                        type="number"
                        value={simParams.rightBV}
                        onChange={(e) => setSimParams({ ...simParams, rightBV: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Binary Rate (20% = 0.20)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={simParams.binaryRate}
                        onChange={(e) => setSimParams({ ...simParams, binaryRate: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Daily Payout Cap (₹)</label>
                      <input
                        type="number"
                        value={simParams.dailyCap}
                        onChange={(e) => setSimParams({ ...simParams, dailyCap: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Already Paid Today (₹)</label>
                      <input
                        type="number"
                        value={simParams.alreadyEarnedToday}
                        onChange={(e) => setSimParams({ ...simParams, alreadyEarnedToday: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Member Self Repurchase (₹)</label>
                      <input
                        type="number"
                        value={simParams.purchaseAmount}
                        onChange={(e) => setSimParams({ ...simParams, purchaseAmount: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <button 
                    className="primary-btn" 
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
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Zap size={20} />
                      </div>
                      <div>
                        <h2 className="card-title">Computed Breakdown</h2>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>Simulated ledger audit output</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Matched Business Volume (BV)</span>
                      <strong style={{ color: '#0f172a' }}>{simResult.binaryMatching?.matchedBV?.toLocaleString() || simResult.binary?.matchedBV?.toLocaleString()} BV</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Raw Binary Commission (20%)</span>
                      <strong style={{ color: '#0f172a' }}>₹ {(simResult.binaryMatching?.rawCommission ?? simResult.binary?.rawBinaryCommission)?.toLocaleString()}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Daily Cap Applied</span>
                      <strong style={{ color: (simResult.binaryMatching?.excessCommission || simResult.binary?.excessCommission) > 0 ? '#ef4444' : '#10b981' }}>
                        {(simResult.binaryMatching?.excessCommission || simResult.binary?.excessCommission) > 0 
                          ? `Capped! (₹${simResult.binaryMatching?.excessCommission || simResult.binary?.excessCommission} Flushed)` 
                          : 'Under Daily Cap'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Payable Binary Commission</span>
                      <strong style={{ color: '#059669', fontSize: '16px' }}>₹ {(simResult.binaryMatching?.payableCommission ?? simResult.binary?.payableBinaryCommission)?.toLocaleString()}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Self Purchase Bonus (8%)</span>
                      <strong style={{ color: '#0f172a' }}>₹ {(simResult.selfPurchaseBonus?.calculatedBonus || 0)?.toLocaleString()}</strong>
                    </div>
                  </div>

                  <div style={{ 
                    marginTop: 'auto',
                    background: 'linear-gradient(135deg, #eff6ff 0%, #ecfdf5 100%)', 
                    border: '1.5px solid #bfdbfe', 
                    padding: '18px 20px', 
                    borderRadius: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Total Simulated Commission
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Includes Binary + Repurchase + Tiers
                      </div>
                    </div>

                    <div style={{ 
                      fontFamily: 'var(--font-display)', 
                      fontSize: '30px', 
                      fontWeight: 900, 
                      color: '#1d4ed8',
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                <div className="dashboard-card" style={{ borderLeft: '4px solid #2563eb' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Active Package</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {user?.packageName || 'Starter Package'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', marginTop: '8px' }}>
                    Daily Binary Cap: <strong style={{ color: '#0f172a' }}>₹ {user?.dailyCapping?.toLocaleString() || '4,000'} / day</strong>
                  </div>
                </div>

                <div className="dashboard-card" style={{ borderLeft: '4px solid #10b981' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Leadership Rank</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#065f46', marginTop: '2px' }}>
                    {currentRank}
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', marginTop: '8px' }}>
                    Total Matched Pairs: <strong style={{ color: '#0f172a' }}>{matchedPairs}</strong>
                  </div>
                </div>

                <div className="dashboard-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Next Rank Milestone</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#b45309', marginTop: '2px' }}>
                    {nextTier?.rankName || 'Star'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', marginTop: '8px' }}>
                    Cash Award: <strong style={{ color: '#059669' }}>₹ {nextTier?.rewardAmount?.toLocaleString()}</strong>
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
