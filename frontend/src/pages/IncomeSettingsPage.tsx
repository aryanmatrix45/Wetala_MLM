import React, { useState, useEffect } from 'react';
import { Percent, Store, Users, Calculator, CheckCircle2, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { api } from '../services/api';

export const IncomeSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rules' | 'simulator'>('simulator');
  const [rules, setRules] = useState<any>(null);
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
      const res = await api.getCompensationRules();
      if (res.status && res.data) {
        setRules(res.data);
      }
      // Run initial simulation
      handleRunSimulation();
    } catch (err: any) {
      setError(err.message || 'Failed to fetch compensation rules.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRules = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(null);
      const token = localStorage.getItem('wetala_token') || '';
      const res = await api.updateCompensationRules(rules, token);
      if (res.status) {
        setSaveSuccess('Compensation rules updated and audited successfully!');
        setRules(res.data);
      } else {
        setError(res.message || 'Failed to update rules.');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating rules.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunSimulation = async (customParams?: any) => {
    try {
      setSimulating(true);
      const params = customParams || simParams;
      const res = await api.simulateCompensation(params);
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
        <p style={{ color: '#64748b', fontWeight: 600 }}>Loading compensation engine & rule set...</p>
      </div>
    );
  }

  return (
    <div className="page-body">
      {/* Header & Mode Switcher */}
      <div className="welcome-header">
        <div>
          <h1 className="page-title">Compensation Engine & Simulator</h1>
          <p className="page-subtitle">Configure binary matching formulas, daily caps, repurchase slabs, rewards, and test payouts with the dry-run simulator.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
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
              <Zap size={16} />
              <span>ACTIVE RULES</span>
            </button>
          </div>

          {activeTab === 'rules' && (
            <button className="primary-btn" onClick={handleSaveRules} disabled={saving}>
              {saving ? 'Auditing & Saving...' : 'Save Rule Changes'}
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
          SIMULATOR TAB: Command Center
          ========================================================================= */}
      {activeTab === 'simulator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '26px' }}>
          {/* Left: Interactive Input Panel */}
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

            {/* Scenario Quick Presets */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button 
                onClick={() => applyPreset('standard')}
                style={{ fontSize: '11.5px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', background: '#f1f5f9', color: '#334155' }}
              >
                Preset 1: Standard 10k:7k
              </button>
              <button 
                onClick={() => applyPreset('cap_overflow')}
                style={{ fontSize: '11.5px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', background: '#fffbeb', color: '#b45309' }}
              >
                Preset 2: Cap Overflow (20k:25k)
              </button>
              <button 
                onClick={() => applyPreset('equal_match')}
                style={{ fontSize: '11.5px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', background: '#ecfdf5', color: '#047857' }}
              >
                Preset 3: Equal 5k:5k
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Leg BV Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#2563eb', display: 'block', marginBottom: '6px' }}>
                    LEFT LEG VOLUME (BV)
                  </label>
                  <input
                    type="number"
                    value={simParams.leftBV}
                    onChange={(e) => setSimParams({ ...simParams, leftBV: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#059669', display: 'block', marginBottom: '6px' }}>
                    RIGHT LEG VOLUME (BV)
                  </label>
                  <input
                    type="number"
                    value={simParams.rightBV}
                    onChange={(e) => setSimParams({ ...simParams, rightBV: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Rate & Cap Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
                    Binary Matching Rate (20% = 0.20)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={simParams.binaryRate}
                    onChange={(e) => setSimParams({ ...simParams, binaryRate: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '13.5px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
                    Daily Binary Cap (₹)
                  </label>
                  <input
                    type="number"
                    value={simParams.dailyCap}
                    onChange={(e) => setSimParams({ ...simParams, dailyCap: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '13.5px' }}
                  />
                </div>
              </div>

              {/* Already Earned Today & Repurchase */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
                    Already Earned Today (₹)
                  </label>
                  <input
                    type="number"
                    value={simParams.alreadyEarnedToday}
                    onChange={(e) => setSimParams({ ...simParams, alreadyEarnedToday: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '13.5px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
                    Personal Repurchase (₹)
                  </label>
                  <input
                    type="number"
                    value={simParams.purchaseAmount}
                    onChange={(e) => setSimParams({ ...simParams, purchaseAmount: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '13.5px' }}
                  />
                </div>
              </div>

              <button
                className="primary-btn"
                onClick={() => handleRunSimulation()}
                disabled={simulating}
                style={{ height: '46px', justifyContent: 'center', marginTop: '8px' }}
              >
                <RefreshCw size={17} className={simulating ? 'spin' : ''} />
                <span>{simulating ? 'Calculating Safe Decimals...' : 'Simulate Payout'}</span>
              </button>
            </div>
          </div>

          {/* Right: Modern Financial Receipt Breakdown */}
          {simResult && (
            <div className="dashboard-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
              <div className="card-header-row" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '14px', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', letterSpacing: '1px' }}>AUDIT RECEIPT</span>
                  <h2 className="card-title">Compensation Output Breakdown</h2>
                </div>
                <div style={{ 
                  background: '#ecfdf5', 
                  color: '#059669', 
                  fontSize: '11px', 
                  fontWeight: 800, 
                  padding: '4px 10px', 
                  borderRadius: '9999px',
                  border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  DECIMAL-SAFE
                </div>
              </div>

              {/* Binary Matching Section */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>1. Binary Matching:</span>
                  <span style={{ color: '#2563eb' }}>{simResult.binaryMatching?.matchedBV.toLocaleString()} BV Matched</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: '#64748b' }}>
                  <div>Left Remaining: <strong style={{ color: '#0f172a' }}>{simResult.binaryMatching?.remainingLeftBV.toLocaleString()} BV</strong></div>
                  <div>Right Remaining: <strong style={{ color: '#0f172a' }}>{simResult.binaryMatching?.remainingRightBV.toLocaleString()} BV</strong></div>
                  <div>Raw Commission: <strong style={{ color: '#0f172a' }}>₹ {simResult.binaryMatching?.rawCommission.toLocaleString()}</strong></div>
                  <div>Remaining Cap: <strong style={{ color: '#d97706' }}>₹ {simResult.binaryMatching?.remainingCap.toLocaleString()}</strong></div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginTop: '10px', 
                  paddingTop: '8px', 
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '13px'
                }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>Payable Binary Commission:</span>
                  <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '16px' }}>
                    ₹ {simResult.binaryMatching?.payableCommission.toLocaleString()}
                  </span>
                </div>

                {simResult.binaryMatching?.excessCommission > 0 && (
                  <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600, marginTop: '4px' }}>
                    ⚠️ Cap exceeded: ₹ {simResult.binaryMatching?.excessCommission.toLocaleString()} handled via FLUSH policy
                  </div>
                )}
              </div>

              {/* Other Bonuses */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Team Volume Tier: <strong>{simResult.teamBonus?.qualifiedTier}</strong></span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>₹ {simResult.teamBonus?.calculatedBonus.toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Self Repurchase Bonus (8%):</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>₹ {simResult.selfPurchaseBonus?.calculatedBonus.toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Franchise Incentive: <strong>{simResult.franchiseBonus?.qualifiedTier}</strong></span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>₹ {simResult.franchiseBonus?.calculatedBonus.toLocaleString()}</span>
                </div>
              </div>

              {/* Total Payable Box */}
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
                    Includes Binary + Team + Self Purchase
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

      {/* =========================================================================
          ACTIVE RULES CONFIGURATION TAB
          ========================================================================= */}
      {activeTab === 'rules' && rules && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
          {/* Card 1: Binary Income & Daily Cap */}
          <div className="dashboard-card">
            <div className="card-header-row">
              <div className="card-title-group">
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Percent size={18} />
                </div>
                <h2 className="card-title">1. Binary Income & Matching</h2>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Standard Binary Rate (0.20 = 20%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rules.binaryBonus?.standardBinaryRate}
                    onChange={(e) => setRules({ ...rules, binaryBonus: { ...rules.binaryBonus, standardBinaryRate: parseFloat(e.target.value) || 0 } })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Daily Binary Payout Cap (₹)
                  </label>
                  <input
                    type="number"
                    value={rules.binaryBonus?.dailyBinaryPayoutCap}
                    onChange={(e) => setRules({ ...rules, binaryBonus: { ...rules.binaryBonus, dailyBinaryPayoutCap: parseFloat(e.target.value) || 0 } })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Volume Carry Forward Mode
                  </label>
                  <select
                    value={rules.binaryBonus?.volumeCarryForwardMode}
                    onChange={(e) => setRules({ ...rules, binaryBonus: { ...rules.binaryBonus, volumeCarryForwardMode: e.target.value } })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: 'white' }}
                  >
                    <option value="CARRY_FORWARD">CARRY_FORWARD (Retain Unmatched BV)</option>
                    <option value="FLUSH">FLUSH (Discard Unmatched BV)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Excess Cap Policy
                  </label>
                  <select
                    value={rules.binaryBonus?.excessCapPolicy}
                    onChange={(e) => setRules({ ...rules, binaryBonus: { ...rules.binaryBonus, excessCapPolicy: e.target.value } })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: 'white' }}
                  >
                    <option value="FLUSH">FLUSH (Discard Excess Commission)</option>
                    <option value="HOLD">HOLD (Hold for manual review)</option>
                    <option value="CARRY_FORWARD">CARRY_FORWARD</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Special Binary Rate (Notes: 25%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rules.binaryBonus?.specialBinaryRate}
                    onChange={(e) => setRules({ ...rules, binaryBonus: { ...rules.binaryBonus, specialBinaryRate: parseFloat(e.target.value) || 0 } })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Special Rate Enabled?
                  </label>
                  <select
                    value={rules.binaryBonus?.isSpecialRateEnabled ? 'true' : 'false'}
                    onChange={(e) => setRules({ ...rules, binaryBonus: { ...rules.binaryBonus, isSpecialRateEnabled: e.target.value === 'true' } })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: 'white' }}
                  >
                    <option value="false">Disabled (Default 20%)</option>
                    <option value="true">Enabled (Apply 25%)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Sponsor & Self Purchase Bonus */}
          <div className="dashboard-card">
            <div className="card-header-row">
              <div className="card-title-group">
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={18} />
                </div>
                <h2 className="card-title">2. Sponsor & Repurchase Bonuses</h2>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Sponsor Binary Rate (20% = 0.20)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rules.sponsorBinaryBonus?.sponsorBinaryRate}
                    onChange={(e) => setRules({ ...rules, sponsorBinaryBonus: { ...rules.sponsorBinaryBonus, sponsorBinaryRate: parseFloat(e.target.value) || 0 } })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Self Purchase Bonus (8% = 0.08)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rules.selfPurchaseBonus?.ratePercent}
                    onChange={(e) => setRules({ ...rules, selfPurchaseBonus: { ...rules.selfPurchaseBonus, ratePercent: parseFloat(e.target.value) || 0 } })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Upline Bonus Rate (2% = 0.02)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rules.uplineBonus?.uplineBonusRate}
                    onChange={(e) => setRules({ ...rules, uplineBonus: { ...rules.uplineBonus, uplineBonusRate: parseFloat(e.target.value) || 0 } })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Retail Profit Max (%)
                  </label>
                  <input
                    type="number"
                    value={rules.retailProfit?.maxPercentage}
                    onChange={(e) => setRules({ ...rules, retailProfit: { ...rules.retailProfit, maxPercentage: parseFloat(e.target.value) || 0 } })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Team Bonus Slabs */}
          <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
            <div className="card-header-row">
              <div className="card-title-group">
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={18} />
                </div>
                <h2 className="card-title">3. Team Volume Bonus Slabs (Configured Notebook Tiers)</h2>
              </div>
            </div>

            <table className="data-table" style={{ fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Tier ID</th>
                  <th>Left Requirement (BV)</th>
                  <th>Right Requirement (BV)</th>
                  <th>Matching Percentage</th>
                </tr>
              </thead>
              <tbody>
                {rules.teamBonus?.tiers?.map((t: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700, color: '#2563eb' }}>{t.tierId || `TB-${idx + 1}`}</td>
                    <td>{t.leftVolume.toLocaleString()} BV</td>
                    <td>{t.rightVolume.toLocaleString()} BV</td>
                    <td style={{ fontWeight: 800, color: '#059669' }}>{(t.rate * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
