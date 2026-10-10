import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  Zap, 
  ShieldCheck, 
  Award, 
  ArrowDownLeft, 
  ArrowDownRight,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

interface BinaryLedgerPageProps {
  user?: any;
  token?: string | null;
}

export const BinaryLedgerPage: React.FC<BinaryLedgerPageProps> = ({ user: propUser, token: propToken }) => {
  const savedToken = propToken || localStorage.getItem('wetala_token') || '';
  const savedUserStr = localStorage.getItem('wetala_user');
  const user = propUser || (savedUserStr ? JSON.parse(savedUserStr) : null);
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin';
  const defaultMemberId = user?.memberId || 'MEM0001';

  const [activeMemberId, setActiveMemberId] = useState(defaultMemberId);
  const [searchInput, setSearchInput] = useState(defaultMemberId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [legFilter, setLegFilter] = useState<'ALL' | 'LEFT' | 'RIGHT'>('ALL');
  
  // Admin settlement trigger state
  const [settling, setSettling] = useState(false);
  const [settleMsg, setSettleMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchLedgerData(activeMemberId, pagination.page, legFilter);
  }, [activeMemberId, pagination.page, legFilter]);

  const fetchLedgerData = async (memberId: string, pageNum: number, leg: string) => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page: pageNum, limit: 20 };
      if (leg !== 'ALL') {
        params.leg = leg;
      }
      const res = await api.getBinaryLedger(memberId, params, savedToken);
      if (res.status) {
        setSummary(res.summary);
        setLedgerEntries(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setError(res.message || 'Failed to fetch Business Volume ledger records.');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading BV ledger data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim().toUpperCase();
    if (clean) {
      setActiveMemberId(clean);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  };

  const handleRunDailySettlement = async () => {
    if (!isAdmin) return;
    setSettling(true);
    setSettleMsg(null);
    try {
      const res = await api.settleDailyBinary(undefined, savedToken);
      if (res?.status) {
        setSettleMsg({
          type: 'success',
          text: `Daily binary calculation completed: ${res.data?.details?.length || 0} earners processed. ₹${(res.data?.totalPayableIncome || 0).toLocaleString()} credited.`,
        });
        fetchLedgerData(activeMemberId, 1, legFilter);
      } else {
        setSettleMsg({ type: 'error', text: res?.message || 'Daily settlement failed.' });
      }
    } catch (err: any) {
      setSettleMsg({ type: 'error', text: err.message || 'Settlement execution error.' });
    } finally {
      setSettling(false);
    }
  };

  const leftAvailable = summary?.leftAvailableBV ?? 0;
  const rightAvailable = summary?.rightAvailableBV ?? 0;
  const leftTotal = summary?.leftTotalBV ?? 0;
  const rightTotal = summary?.rightTotalBV ?? 0;
  const consumedTotal = summary?.consumedTotalBV ?? 0;
  const reservedBV = summary?.reservedBV ?? 0;
  const reservedSide = summary?.reservedSide ?? null;
  const payoutCount = summary?.payoutCount ?? 0;
  const dailyCap = summary?.dailyCapping ?? (user?.dailyCapping || 4000);

  // Determine sequential payout stage description
  const getStageBadge = () => {
    if (payoutCount === 0) {
      return {
        label: 'Stage 1: Initial Qualifying Payout',
        detail: 'Requires 2,500:1,250 or 1,250:2,500 BV (2:1 or 1:2)',
        color: '#2563eb',
        bg: '#eff6ff',
      };
    } else if (payoutCount === 1) {
      return {
        label: 'Stage 2: Second Payout Matching',
        detail: `Using 2,500 reserved BV on ${reservedSide || 'opposite leg'} + 1,250 new BV`,
        color: '#d97706',
        bg: '#fef3c7',
      };
    } else {
      return {
        label: `Stage 3+: Continuous 1:1 Matching (${payoutCount} Payouts Completed)`,
        detail: 'Permanent 1,250:1,250 matching ratio @ ₹250 per pair',
        color: '#059669',
        bg: '#ecfdf5',
      };
    }
  };

  const stage = getStageBadge();

  return (
    <div className="page-body" style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Header Banner */}
      <div className="welcome-header" style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ 
            width: '46px', 
            height: '46px', 
            borderRadius: '12px', 
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', 
            color: '#fff', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flexShrink: 0,
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' 
          }}>
            <BarChart3 size={24} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Business Volume (BV) Ledger & Carry-Forward Engine
            </h1>
            <p className="page-subtitle" style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Auditable double-entry tracking of consumed, reserved, and carried-forward Business Volume with automated daily midnight calculation.
            </p>
          </div>
        </div>

        {/* Action Bar (Search & Admin Settle) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
          {isAdmin && (
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Enter Member ID..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  style={{
                    padding: '8px 12px 8px 30px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    width: '180px',
                    outline: 'none',
                    fontWeight: 600,
                  }}
                />
              </div>
              <button type="submit" className="secondary-btn" style={{ fontSize: '12px', padding: '8px 12px' }}>
                Search
              </button>
            </form>
          )}

          {isAdmin && (
            <button
              onClick={handleRunDailySettlement}
              disabled={settling}
              className="primary-btn"
              style={{
                fontSize: '12px',
                padding: '8px 14px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              }}
            >
              <Zap size={14} className={settling ? 'animate-spin' : ''} />
              <span>{settling ? 'Calculating...' : 'Run Daily Settlement Now'}</span>
            </button>
          )}

          <button
            onClick={() => fetchLedgerData(activeMemberId, pagination.page, legFilter)}
            className="secondary-btn"
            style={{ fontSize: '12px', padding: '8px 12px' }}
            title="Refresh Ledger"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Settlement Feedback Message */}
      {settleMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: settleMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${settleMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: settleMsg.type === 'success' ? '#065f46' : '#991b1b',
        }}>
          {settleMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{settleMsg.text}</span>
        </div>
      )}

      {/* Member Details Pill */}
      {summary && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          padding: '12px 20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Inspecting Member:</span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
              {summary.memberName || 'Distributor'} ({summary.memberId})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '11.5px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '9999px',
              background: stage.bg,
              color: stage.color,
              border: `1px solid ${stage.color}33`,
            }}>
              {stage.label}
            </span>
            <span style={{
              fontSize: '11.5px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '9999px',
              background: '#f1f5f9',
              color: '#475569',
            }}>
              Daily Cap: ₹{dailyCap.toLocaleString()}/day
            </span>
          </div>
        </div>
      )}

      {/* 4 Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Card 1: Left Leg Balance */}
        <div className="dashboard-card" style={{ padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)', border: '1px solid #bfdbfe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Left Leg Volume
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#1e3a8a', marginBottom: '4px' }}>
            {leftAvailable.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 700, color: '#3b82f6' }}>BV Avail</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b', borderTop: '1px solid #dbeafe', paddingTop: '8px', marginTop: '8px' }}>
            <span>Total Inflow: <strong>{leftTotal.toLocaleString()} BV</strong></span>
            <span style={{ color: '#2563eb', fontWeight: 700 }}>Carry: {leftAvailable.toLocaleString()} BV</span>
          </div>
        </div>

        {/* Card 2: Right Leg Balance */}
        <div className="dashboard-card" style={{ padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)', border: '1px solid #a7f3d0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Right Leg Volume
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#d1fae5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownRight size={18} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#064e3b', marginBottom: '4px' }}>
            {rightAvailable.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>BV Avail</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b', borderTop: '1px solid #d1fae5', paddingTop: '8px', marginTop: '8px' }}>
            <span>Total Inflow: <strong>{rightTotal.toLocaleString()} BV</strong></span>
            <span style={{ color: '#059669', fontWeight: 700 }}>Carry: {rightAvailable.toLocaleString()} BV</span>
          </div>
        </div>

        {/* Card 3: Consumed & Matched BV */}
        <div className="dashboard-card" style={{ padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, #ffffff 0%, #fdf4ff 100%)', border: '1px solid #f5d0fe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#86198f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Consumed & Matched
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fae8ff', color: '#a21caf', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={18} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#701a75', marginBottom: '4px' }}>
            {consumedTotal.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 700, color: '#a21caf' }}>BV Consumed</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b', borderTop: '1px solid #f5d0fe', paddingTop: '8px', marginTop: '8px' }}>
            <span>Completed Payouts: <strong>{payoutCount}</strong></span>
            <span style={{ color: '#86198f', fontWeight: 700 }}>Earned: ₹{(payoutCount * 250).toLocaleString()}</span>
          </div>
        </div>

        {/* Card 4: Reserved BV for Payout #2 */}
        <div className="dashboard-card" style={{ padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)', border: '1px solid #fde68a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Reserved BV (Stage 2)
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#78350f', marginBottom: '4px' }}>
            {reservedBV.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 700, color: '#d97706' }}>BV {reservedSide ? `(${reservedSide})` : ''}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b', borderTop: '1px solid #fde68a', paddingTop: '8px', marginTop: '8px' }}>
            <span>{reservedBV > 0 ? 'Reserved for 2nd payout' : 'None currently reserved'}</span>
            <span style={{ color: '#b45309', fontWeight: 700 }}>{reservedBV > 0 ? 'Awaiting 1,250 BV opposite' : 'Active Stage'}</span>
          </div>
        </div>
      </div>

      {/* Rules & Logic Transparent Accordion / Card */}
      <div className="dashboard-card" style={{ padding: '20px', borderRadius: '14px', background: '#ffffff', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <ShieldCheck size={20} color="#2563eb" />
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Official Binary Volume & Payout Rules
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
              1. Free Member Participation & Daily Cap
            </div>
            <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Anyone can generate binary income even without buying a package, earning up to <strong>₹4,000 per day</strong>. If earnings exceed ₹4,000, payable income is capped and an instant notification alerts the member to upgrade.
            </p>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
              2. 3-Stage Sequential Matching (₹250 / cycle)
            </div>
            <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              <strong>1st Payout:</strong> 2,500:1,250 or 1,250:2,500 BV (1,250 BV consumed, 2,500 BV reserved).<br />
              <strong>2nd Payout:</strong> 2,500 reserved BV + 1,250 new BV consumed.<br />
              <strong>3rd+ Payouts:</strong> Continuous 1:1 matching of 1,250:1,250 BV indefinitely.
            </p>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
              3. Indefinite BV Carry-Forward & Repurchase Reuse
            </div>
            <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Unmatched BV never expires and carries forward to subsequent daily runs. Any new product repurchase BV added into an account is credited immediately and reused for binary matching.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Table Card */}
      <div className="dashboard-card" style={{ padding: '20px', borderRadius: '14px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Business Volume Ledger & Consumption Audit
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Complete record of all earned, consumed, reserved, and carried forward BV transactions.
            </p>
          </div>

          {/* Leg Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => { setLegFilter('ALL'); setPagination((p) => ({ ...p, page: 1 })); }}
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: legFilter === 'ALL' ? '#0f172a' : '#ffffff',
                color: legFilter === 'ALL' ? '#ffffff' : '#475569',
                cursor: 'pointer',
              }}
            >
              All Legs
            </button>
            <button
              onClick={() => { setLegFilter('LEFT'); setPagination((p) => ({ ...p, page: 1 })); }}
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #bfdbfe',
                background: legFilter === 'LEFT' ? '#2563eb' : '#ffffff',
                color: legFilter === 'LEFT' ? '#ffffff' : '#2563eb',
                cursor: 'pointer',
              }}
            >
              Left Leg Only
            </button>
            <button
              onClick={() => { setLegFilter('RIGHT'); setPagination((p) => ({ ...p, page: 1 })); }}
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #a7f3d0',
                background: legFilter === 'RIGHT' ? '#059669' : '#ffffff',
                color: legFilter === 'RIGHT' ? '#ffffff' : '#059669',
                cursor: 'pointer',
              }}
            >
              Right Leg Only
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        {loading && ledgerEntries.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
            <div className="animate-spin" style={{ width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px', fontWeight: 600 }}>Loading Business Volume Ledger...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#b91c1c', background: '#fef2f2', borderRadius: '10px' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px', fontWeight: 600 }}>{error}</p>
          </div>
        ) : ledgerEntries.length === 0 ? (
          <div style={{ padding: '50px 0', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '10px' }}>
            <Layers size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>No BV Ledger Entries Found</p>
            <p style={{ fontSize: '12px', color: '#64748b' }}>
              Transactions will appear here as product repurchases or daily binary matching cycles occur.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  <th style={{ padding: '12px 14px' }}>Date & Time</th>
                  <th style={{ padding: '12px 14px' }}>Leg</th>
                  <th style={{ padding: '12px 14px' }}>Type</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Opening BV</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Earned (+)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Consumed (-)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Reserved</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Carry Forward</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Closing BV</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Payout #</th>
                  <th style={{ padding: '12px 14px' }}>Description / Audit Trail</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((entry, idx) => {
                  const isConsumed = (entry.consumedBV || 0) > 0;
                  const isEarned = (entry.earnedBV || 0) > 0;
                  const isReserved = (entry.reservedBV || 0) > 0;
                  const legColor = entry.position === 'LEFT' ? '#2563eb' : entry.position === 'RIGHT' ? '#059669' : '#64748b';
                  const legBg = entry.position === 'LEFT' ? '#eff6ff' : entry.position === 'RIGHT' ? '#ecfdf5' : '#f1f5f9';

                  return (
                    <tr 
                      key={entry._id || entry.ledgerId || idx}
                      style={{ 
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                        background: isConsumed ? 'rgba(254, 242, 242, 0.35)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 14px', color: '#334155', whiteSpace: 'nowrap' }}>
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) : '-'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {entry.position ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: legBg,
                            color: legColor,
                          }}>
                            {entry.position}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: isConsumed ? '#fee2e2' : isEarned ? '#dcfce7' : '#f1f5f9',
                          color: isConsumed ? '#b91c1c' : isEarned ? '#15803d' : '#475569',
                        }}>
                          {entry.sourceType || 'BV_ENTRY'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#64748b' }}>
                        {(entry.openingBV || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: isEarned ? 700 : 400, color: isEarned ? '#15803d' : '#94a3b8' }}>
                        {isEarned ? `+${(entry.earnedBV).toLocaleString()}` : '0'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: isConsumed ? 700 : 400, color: isConsumed ? '#dc2626' : '#94a3b8' }}>
                        {isConsumed ? `-${(entry.consumedBV).toLocaleString()}` : '0'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: isReserved ? 700 : 400, color: isReserved ? '#d97706' : '#94a3b8' }}>
                        {isReserved ? `${(entry.reservedBV).toLocaleString()}` : '-'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                        {(entry.carriedForwardBV || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {(entry.closingBV ?? entry.newBV ?? 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {entry.payoutSequence ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                          }}>
                            #{entry.payoutSequence}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569', fontSize: '12px', maxWidth: '320px' }}>
                        {entry.description || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b' }}>
            <div>
              Showing page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong> ({pagination.total} total transactions)
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className="secondary-btn"
                style={{ fontSize: '11.5px', padding: '5px 10px', opacity: pagination.page <= 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                className="secondary-btn"
                style={{ fontSize: '11.5px', padding: '5px 10px', opacity: pagination.page >= pagination.pages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
