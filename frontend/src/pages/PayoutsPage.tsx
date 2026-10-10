import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Wallet, 
  IndianRupee, 
  Search, 
  Bell, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  CreditCard, 
  FileText,
  AlertCircle,
  RefreshCw,
  Eye,
  PlusCircle
} from 'lucide-react';
import { api, type WithdrawalRequestItem } from '../services/api';
import { AdminWithdrawalActionModal, type AdminActionType } from '../components/AdminWithdrawalActionModal';
import { WithdrawModal } from '../components/WithdrawModal';

interface PayoutsPageProps {
  user?: any;
  token?: string | null;
  defaultSubTab?: 'requests' | 'messages' | 'commissions';
  onNavigate?: (tab: string) => void;
}

export const PayoutsPage: React.FC<PayoutsPageProps> = ({ user, token, defaultSubTab = 'requests', onNavigate }) => {
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin';
  const currentMemberId = user?.memberId || 'MEM0001';

  // Navigation tab
  const [activeSubTab, setActiveSubTab] = useState<'requests' | 'messages' | 'commissions'>(defaultSubTab);

  useEffect(() => {
    if (defaultSubTab) {
      setActiveSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);

  // Withdrawal Requests State
  const [requests, setRequests] = useState<WithdrawalRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [kpis, setKpis] = useState<any>({
    totalRequests: 0,
    pendingCount: 0,
    approvedCount: 0,
    paidCount: 0,
    rejectedCount: 0,
    totalRequestedAmount: 0,
    totalPaidAmount: 0,
    totalPendingAmount: 0,
  });

  // Member balance summary (for non-admin)
  const [memberBalance, setMemberBalance] = useState<any>(null);

  // Admin Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Commission Ledger State
  const [commissionLedger, setCommissionLedger] = useState<any[]>([]);

  // Modals
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequestItem | null>(null);
  const [adminModalAction, setAdminModalAction] = useState<AdminActionType>('APPROVE');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        // Fetch Admin requests
        const reqRes = await api.getAllWithdrawalsAdmin({
          status: statusFilter,
          search: searchQuery,
        }, token || undefined);

        if (reqRes?.status && reqRes.data) {
          setRequests(reqRes.data);
          if (reqRes.kpis) setKpis(reqRes.kpis);
        }

        // Fetch Admin notifications
        const notifRes = await api.getAdminNotifications(token || undefined);
        if (notifRes?.status && notifRes.data) {
          setNotifications(notifRes.data);
          setUnreadNotifCount(notifRes.unreadCount || 0);
        }
      } else {
        // Fetch Member requests & balance
        const [myReqRes, balRes, myNotifRes] = await Promise.all([
          api.getMyWithdrawals(token || undefined, currentMemberId),
          api.getWithdrawalBalanceSummary(currentMemberId, token || undefined),
          api.getMemberNotifications(currentMemberId, token || undefined),
        ]);

        if (myReqRes?.status && myReqRes.data) {
          setRequests(myReqRes.data);
        }
        if (balRes?.status && balRes.data) {
          setMemberBalance(balRes.data);
        }
        if (myNotifRes?.status && myNotifRes.data) {
          setNotifications(myNotifRes.data);
          setUnreadNotifCount(myNotifRes.unreadCount || 0);
        }
      }

      // Load legacy commission ledger
      try {
        const comRes = await api.getPayouts();
        if (Array.isArray(comRes)) {
          setCommissionLedger(comRes);
        }
      } catch {
        // Non-critical
      }
    } catch (err) {
      console.error('Failed to load withdrawal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin, currentMemberId, statusFilter, searchQuery]);

  const handleOpenAdminAction = (req: WithdrawalRequestItem, action: AdminActionType) => {
    setSelectedRequest(req);
    setAdminModalAction(action);
    setIsAdminModalOpen(true);
  };

  const handleMarkNotifRead = async (id: string) => {
    await api.markNotificationRead(id, token || undefined);
    loadData();
  };

  // Filtered requests list
  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = r.requestId?.toLowerCase().includes(q);
      const matchMember = r.memberId?.toLowerCase().includes(q) || r.memberName?.toLowerCase().includes(q);
      const matchRef = r.paymentReference?.toLowerCase().includes(q);
      return matchId || matchMember || matchRef;
    }
    return true;
  });

  return (
    <div className="page-body">
      {/* Top Banner */}
      <div className="welcome-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              background: '#ecfdf5',
              color: '#059669',
              padding: '3px 10px',
              borderRadius: '9999px',
              letterSpacing: '0.5px'
            }}>
              LIVE WITHDRAWAL SYSTEM
            </span>
            {unreadNotifCount > 0 && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                background: '#eff6ff',
                color: '#2563eb',
                padding: '3px 10px',
                borderRadius: '9999px'
              }}>
                {unreadNotifCount} New Message{unreadNotifCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <h1 className="page-title">{isAdmin ? 'Withdrawal Requests & Payout Center' : 'My Payout & Withdrawal Wallet'}</h1>
          <p className="page-subtitle">
            {isAdmin 
              ? 'Review pending member payout requests, authorize payments, and disburse bank transfers with automated balance synchronization.' 
              : 'Track your real-time available payout balance, submit new withdrawal requests, and audit payment clearance.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={loadData} 
            className="primary-btn" 
            style={{ fontSize: '12px', padding: '8px 14px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}
            title="Refresh records"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {!isAdmin && (
            <button
              onClick={() => setIsWithdrawModalOpen(true)}
              className="primary-btn"
              style={{
                fontSize: '13px',
                padding: '8px 18px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              }}
            >
              <PlusCircle size={16} />
              <span>Withdraw Payout</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="kpi-grid" style={{ marginBottom: '26px' }}>
        {isAdmin ? (
          <>
            <div className="kpi-card kpi-card-blue">
              <div className="kpi-icon-box kpi-icon-blue">
                <IndianRupee size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Gross Requested</div>
                <div className="kpi-value">₹ {kpis.totalRequestedAmount.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  {kpis.totalRequests} Requests Logged
                </div>
              </div>
            </div>

            <div className="kpi-card kpi-card-gold">
              <div className="kpi-icon-box kpi-icon-gold">
                <Clock size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Pending Review</div>
                <div className="kpi-value" style={{ color: '#d97706' }}>
                  {kpis.pendingCount}
                </div>
                <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600, marginTop: '4px' }}>
                  ₹ {kpis.totalPendingAmount.toLocaleString()} Awaiting Action
                </div>
              </div>
            </div>

            <div className="kpi-card kpi-card-purple">
              <div className="kpi-icon-box kpi-icon-purple">
                <Check size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Approved in Queue</div>
                <div className="kpi-value" style={{ color: '#7c3aed' }}>
                  {kpis.approvedCount}
                </div>
                <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginTop: '4px' }}>
                  Ready for "Mark as Paid"
                </div>
              </div>
            </div>

            <div className="kpi-card kpi-card-green">
              <div className="kpi-icon-box kpi-icon-green">
                <Wallet size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Total Paid Disbursed</div>
                <div className="kpi-value" style={{ color: '#059669' }}>
                  ₹ {kpis.totalPaidAmount.toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700, marginTop: '4px' }}>
                  {kpis.paidCount} Transfers Settled
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="kpi-card kpi-card-blue">
              <div className="kpi-icon-box kpi-icon-blue">
                <Wallet size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Available Payout Balance</div>
                <div className="kpi-value" style={{ color: '#1d4ed8' }}>
                  ₹ {(memberBalance?.availablePayout ?? user?.walletBalance ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700, marginTop: '4px' }}>
                  Ready for Immediate Withdrawal
                </div>
              </div>
            </div>

            <div className="kpi-card kpi-card-gold">
              <div className="kpi-icon-box kpi-icon-gold">
                <Clock size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Pending / Approved</div>
                <div className="kpi-value" style={{ color: '#d97706' }}>
                  ₹ {(memberBalance?.pendingAmount ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  {requests.filter(r => r.status === 'PENDING' || r.status === 'APPROVED').length} active request(s)
                </div>
              </div>
            </div>

            <div className="kpi-card kpi-card-green">
              <div className="kpi-icon-box kpi-icon-green">
                <CheckCircle2 size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Total Withdrawn</div>
                <div className="kpi-value" style={{ color: '#059669' }}>
                  ₹ {(memberBalance?.withdrawnAmount ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
                  Disbursed to Bank Account
                </div>
              </div>
            </div>

            <div className="kpi-card kpi-card-purple">
              <div className="kpi-icon-box kpi-icon-purple">
                <IndianRupee size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">Lifetime Total Payout</div>
                <div className="kpi-value" style={{ color: '#7c3aed' }}>
                  ₹ {(memberBalance?.totalPayout ?? user?.totalIncome ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  All Commission Income
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveSubTab('requests')}
          style={{
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'requests' ? '#2563eb' : 'transparent',
            color: activeSubTab === 'requests' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
        >
          <Wallet size={16} />
          <span>Withdrawal Requests ({requests.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('messages')}
          style={{
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'messages' ? '#2563eb' : 'transparent',
            color: activeSubTab === 'messages' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
        >
          <Bell size={16} />
          <span>Messages & Notifications</span>
          {unreadNotifCount > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '9999px',
              fontWeight: 800
            }}>
              {unreadNotifCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('commissions')}
          style={{
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'commissions' ? '#2563eb' : 'transparent',
            color: activeSubTab === 'commissions' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
        >
          <FileText size={16} />
          <span>Commission Ledger</span>
        </button>
      </div>

      {/* TAB 1: WITHDRAWAL REQUESTS */}
      {activeSubTab === 'requests' && (
        <div className="dashboard-card" style={{ padding: '0', overflow: 'hidden' }}>
          {/* Controls: Search and Status Filter */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
            }}
          >
            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '5px 12px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: statusFilter === st ? '#2563eb' : '#cbd5e1',
                    background: statusFilter === st ? '#eff6ff' : '#ffffff',
                    color: statusFilter === st ? '#1d4ed8' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search Req ID, Member ID, Ref..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  fontSize: '12.5px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  background: '#ffffff',
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Member</th>
                  <th>Requested Amount</th>
                  <th>Approved Amount</th>
                  <th>Paid & Reference</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                      <div className="spin" style={{ width: '24px', height: '24px', border: '2px solid #cbd5e1', borderTopColor: '#2563eb', borderRadius: '50%', margin: '0 auto 10px' }} />
                      Loading withdrawal requests...
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                      <AlertCircle size={28} color="#94a3b8" style={{ margin: '0 auto 8px', display: 'block' }} />
                      No withdrawal requests found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((row) => {
                    const initials = (row.memberName || row.memberId || 'M')
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <tr key={row._id || row.requestId}>
                        {/* Request ID */}
                        <td>
                          <span style={{ fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px' }}>
                            {row.requestId}
                          </span>
                        </td>

                        {/* Member Details */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.memberName || row.memberId}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{row.memberId}</div>
                            </div>
                          </div>
                        </td>

                        {/* Requested Amount */}
                        <td>
                          <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>
                            ₹ {row.requestedAmount.toLocaleString()}
                          </span>
                        </td>

                        {/* Approved Amount */}
                        <td>
                          {row.approvedAmount !== undefined && row.approvedAmount !== null ? (
                            <span style={{ fontWeight: 700, color: '#2563eb' }}>
                              ₹ {row.approvedAmount.toLocaleString()}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>

                        {/* Paid & Payment Reference */}
                        <td>
                          {row.status === 'PAID' ? (
                            <div>
                              <span style={{ fontWeight: 800, color: '#059669', fontSize: '13px' }}>
                                ₹ {(row.paidAmount || row.approvedAmount || row.requestedAmount).toLocaleString()}
                              </span>
                              {row.paymentReference && (
                                <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                                  Ref: <strong style={{ color: '#334155' }}>{row.paymentReference}</strong>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>

                        {/* Date */}
                        <td style={{ fontSize: '12px', color: '#64748b' }}>
                          {row.requestedAt ? new Date(row.requestedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent'}
                        </td>

                        {/* Status */}
                        <td>
                          <span
                            className={`status-pill ${
                              row.status === 'PAID'
                                ? 'status-paid'
                                : row.status === 'APPROVED'
                                ? 'status-approved'
                                : row.status === 'REJECTED'
                                ? 'status-rejected'
                                : 'status-pending'
                            }`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background:
                                row.status === 'PAID'
                                  ? '#ecfdf5'
                                  : row.status === 'APPROVED'
                                  ? '#eff6ff'
                                  : row.status === 'REJECTED'
                                  ? '#fef2f2'
                                  : '#fffbeb',
                              color:
                                row.status === 'PAID'
                                  ? '#059669'
                                  : row.status === 'APPROVED'
                                  ? '#2563eb'
                                  : row.status === 'REJECTED'
                                  ? '#dc2626'
                                  : '#d97706',
                              border:
                                row.status === 'PAID'
                                  ? '1px solid #a7f3d0'
                                  : row.status === 'APPROVED'
                                  ? '1px solid #bfdbfe'
                                  : row.status === 'REJECTED'
                                  ? '1px solid #fecaca'
                                  : '1px solid #fde68a',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background:
                                  row.status === 'PAID'
                                    ? '#10b981'
                                    : row.status === 'APPROVED'
                                    ? '#3b82f6'
                                    : row.status === 'REJECTED'
                                    ? '#ef4444'
                                    : '#f59e0b',
                              }}
                            />
                            {row.status}
                          </span>
                        </td>

                        {/* Notes */}
                        <td style={{ maxWidth: '160px' }}>
                          {row.note && (
                            <div style={{ fontSize: '11px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.note}>
                              <span style={{ fontWeight: 600 }}>Note:</span> {row.note}
                            </div>
                          )}
                          {row.adminNote && (
                            <div style={{ fontSize: '10.5px', color: '#9333ea', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }} title={row.adminNote}>
                              <span style={{ fontWeight: 600 }}>Admin:</span> {row.adminNote}
                            </div>
                          )}
                          {!row.note && !row.adminNote && <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            {isAdmin ? (
                              <>
                                {row.status === 'PENDING' && (
                                  <>
                                    <button
                                      onClick={() => handleOpenAdminAction(row, 'APPROVE')}
                                      className="primary-btn"
                                      style={{
                                        fontSize: '11px',
                                        padding: '5px 10px',
                                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                      }}
                                      title="Approve Request"
                                    >
                                      <Check size={13} /> Approve
                                    </button>
                                    <button
                                      onClick={() => handleOpenAdminAction(row, 'REJECT')}
                                      style={{
                                        fontSize: '11px',
                                        padding: '5px 8px',
                                        background: '#fef2f2',
                                        color: '#dc2626',
                                        border: '1px solid #fecaca',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                      }}
                                      title="Reject Request"
                                    >
                                      <XCircle size={13} />
                                    </button>
                                  </>
                                )}

                                {row.status === 'APPROVED' && (
                                  <>
                                    <button
                                      onClick={() => handleOpenAdminAction(row, 'PAY')}
                                      className="primary-btn"
                                      style={{
                                        fontSize: '11px',
                                        padding: '5px 12px',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                                      }}
                                      title="Mark as Paid"
                                    >
                                      <CreditCard size={13} /> Mark as Paid
                                    </button>
                                    <button
                                      onClick={() => handleOpenAdminAction(row, 'REJECT')}
                                      style={{
                                        fontSize: '11px',
                                        padding: '5px 8px',
                                        background: '#fef2f2',
                                        color: '#dc2626',
                                        border: '1px solid #fecaca',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                      }}
                                      title="Reject Request"
                                    >
                                      <XCircle size={13} />
                                    </button>
                                  </>
                                )}

                                {(row.status === 'PAID' || row.status === 'REJECTED') && (
                                  <button
                                    onClick={() => handleOpenAdminAction(row, 'VIEW_DETAILS')}
                                    style={{
                                      fontSize: '11px',
                                      padding: '5px 10px',
                                      background: '#f1f5f9',
                                      color: '#475569',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <Eye size={12} /> Audit Details
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => handleOpenAdminAction(row, 'VIEW_DETAILS')}
                                style={{
                                  fontSize: '11px',
                                  padding: '5px 10px',
                                  background: '#f1f5f9',
                                  color: '#475569',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Eye size={12} /> Details
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MESSAGES & NOTIFICATIONS */}
      {activeSubTab === 'messages' && (
        <div className="dashboard-card">
          <div className="card-header-row" style={{ marginBottom: '16px' }}>
            <h2 className="card-title">Withdrawal Notifications & Messages</h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Live real-time message log
            </span>
          </div>

          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <Bell size={32} color="#cbd5e1" style={{ margin: '0 auto 10px', display: 'block' }} />
              No notifications or messages yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notifications.map((notif) => (
                <div
                  key={notif._id || notif.notificationId}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '12px',
                    background: notif.isRead ? '#ffffff' : '#f0f9ff',
                    border: `1px solid ${notif.isRead ? '#e2e8f0' : '#bae6fd'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background:
                          notif.type === 'WITHDRAWAL_PAID'
                            ? '#ecfdf5'
                            : notif.type === 'WITHDRAWAL_APPROVED'
                            ? '#eff6ff'
                            : notif.type === 'WITHDRAWAL_REJECTED'
                            ? '#fef2f2'
                            : '#fffbeb',
                        color:
                          notif.type === 'WITHDRAWAL_PAID'
                            ? '#059669'
                            : notif.type === 'WITHDRAWAL_APPROVED'
                            ? '#2563eb'
                            : notif.type === 'WITHDRAWAL_REJECTED'
                            ? '#dc2626'
                            : '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Bell size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                        {notif.title}
                        {!notif.isRead && (
                          <span style={{ fontSize: '10px', background: '#3b82f6', color: '#fff', padding: '1px 6px', borderRadius: '9999px', marginLeft: '8px' }}>
                            New
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '2px' }}>
                        {notif.message}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                        {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : ''}
                        {notif.referenceId && ` • Ref: ${notif.referenceId}`}
                      </div>
                    </div>
                  </div>

                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkNotifRead(notif.notificationId || notif._id)}
                      style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        color: '#475569',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COMMISSION LEDGER */}
      {activeSubTab === 'commissions' && (
        <div className="dashboard-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Platform Commission Ledger Records
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
              Historical commission payout generation with automatic 5% TDS and 5% Admin fee deductions.
            </p>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ledger ID</th>
                  <th>Member</th>
                  <th>Gross Commission</th>
                  <th>TDS (5%)</th>
                  <th>Admin Fee (5%)</th>
                  <th>Net Payable</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {commissionLedger.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No commission ledger entries available.
                    </td>
                  </tr>
                ) : (
                  commissionLedger.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span style={{ fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: '6px', fontSize: '12px' }}>
                          {row.id}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.memberName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{row.memberId}</div>
                      </td>
                      <td style={{ fontWeight: 700 }}>₹ {row.amount?.toLocaleString()}</td>
                      <td style={{ color: '#ef4444', fontWeight: 600 }}>- ₹ {row.tdsDeduction}</td>
                      <td style={{ color: '#ef4444', fontWeight: 600 }}>- ₹ {row.adminFee}</td>
                      <td>
                        <span style={{ fontWeight: 800, color: '#059669', fontSize: '14px', background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px' }}>
                          ₹ {row.netPayable?.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>{row.requestDate}</td>
                      <td>
                        <span className={`status-pill ${row.status === 'paid' ? 'status-paid' : 'status-pending'}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin Action Modal */}
      <AdminWithdrawalActionModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        request={selectedRequest}
        actionType={adminModalAction}
        onSuccess={loadData}
      />

      {/* Member Withdraw Modal */}
      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        availablePayout={memberBalance?.availablePayout ?? user?.walletBalance ?? 0}
        totalPayout={memberBalance?.totalPayout ?? user?.totalIncome ?? 0}
        pendingAmount={memberBalance?.pendingAmount ?? 0}
        effectiveAvailable={memberBalance?.effectiveAvailable}
        user={user}
        onSuccess={loadData}
        onNavigate={onNavigate}
      />
    </div>
  );
};
export default PayoutsPage;
