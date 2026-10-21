import React, { useState, useEffect } from 'react';
import { EmptyState, LoadingState, PageHeader, StatusBadge } from '../components/ui';
import { AlertCircle, Bell, Check, CheckCircle2, Clock, CreditCard, Eye, FileText, IndianRupee, PlusCircle, RefreshCw, Search, Wallet, XCircle } from 'lucide-react';

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
  const isAdmin = user?.role?.toLowerCase() === 'superadmin';
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
      <PageHeader
        title={isAdmin ? 'Withdrawals & Payouts' : 'My Wallet & Withdrawals'}
        subtitle={
          isAdmin
            ? 'Review withdrawal requests, approve them and record bank transfers.'
            : 'Your available balance, withdrawal requests and commission history.'
        }
        actions={
          <>
            <button type="button" onClick={loadData} className="btn btn-secondary" title="Refresh records">
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
            {!isAdmin && (
              <button type="button" onClick={() => setIsWithdrawModalOpen(true)} className="btn btn-success">
                <PlusCircle size={16} />
                <span>Withdraw</span>
              </button>
            )}
          </>
        }
      />

      <div className="kpi-grid">
        {isAdmin ? (
          <>
            <div className="kpi-card">
              <div className="kpi-icon-box kpi-icon-blue"><IndianRupee size={20} /></div>
              <div className="kpi-content">
                <div className="kpi-label">Gross requested</div>
                <div className="kpi-value">₹ {kpis.totalRequestedAmount.toLocaleString()}</div>
                <div className="kpi-sub">{kpis.totalRequests} requests</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-box kpi-icon-gold"><Clock size={20} /></div>
              <div className="kpi-content">
                <div className="kpi-label">Pending review</div>
                <div className="kpi-value">{kpis.pendingCount}</div>
                <div className="kpi-sub">₹ {kpis.totalPendingAmount.toLocaleString()} awaiting action</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-box kpi-icon-purple"><Check size={20} /></div>
              <div className="kpi-content">
                <div className="kpi-label">Approved, unpaid</div>
                <div className="kpi-value">{kpis.approvedCount}</div>
                <div className="kpi-sub">Ready to mark as paid</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-box kpi-icon-green"><Wallet size={20} /></div>
              <div className="kpi-content">
                <div className="kpi-label">Total paid</div>
                <div className="kpi-value">₹ {kpis.totalPaidAmount.toLocaleString()}</div>
                <div className="kpi-sub">{kpis.paidCount} transfers settled</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="kpi-card">
              <div className="kpi-icon-box kpi-icon-blue"><Wallet size={20} /></div>
              <div className="kpi-content">
                <div className="kpi-label">Available balance</div>
                <div className="kpi-value">₹ {(memberBalance?.availablePayout ?? user?.walletBalance ?? 0).toLocaleString()}</div>
                <div className="kpi-sub">Available to withdraw</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-box kpi-icon-gold"><Clock size={20} /></div>
              <div className="kpi-content">
                <div className="kpi-label">Pending / approved</div>
                <div className="kpi-value">₹ {(memberBalance?.pendingAmount ?? 0).toLocaleString()}</div>
                <div className="kpi-sub">{requests.filter(r => r.status === 'PENDING' || r.status === 'APPROVED').length} active request(s)</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-box kpi-icon-green"><CheckCircle2 size={20} /></div>
              <div className="kpi-content">
                <div className="kpi-label">Total withdrawn</div>
                <div className="kpi-value">₹ {(memberBalance?.withdrawnAmount ?? 0).toLocaleString()}</div>
                <div className="kpi-sub">Paid to your bank account</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-box kpi-icon-purple"><IndianRupee size={20} /></div>
              <div className="kpi-content">
                <div className="kpi-label">Lifetime payout</div>
                <div className="kpi-value">₹ {(memberBalance?.totalPayout ?? user?.totalIncome ?? 0).toLocaleString()}</div>
                <div className="kpi-sub">All commission income</div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="tabs" role="tablist" aria-label="Payout sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'requests'}
          onClick={() => setActiveSubTab('requests')}
          className={`tab-btn${activeSubTab === 'requests' ? ' is-active' : ''}`}
        >
          <Wallet size={16} />
          <span>Withdrawal Requests ({requests.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'messages'}
          onClick={() => setActiveSubTab('messages')}
          className={`tab-btn${activeSubTab === 'messages' ? ' is-active' : ''}`}
        >
          <Bell size={16} />
          <span>Messages</span>
          {unreadNotifCount > 0 && <span className="badge badge-solid-danger">{unreadNotifCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'commissions'}
          onClick={() => setActiveSubTab('commissions')}
          className={`tab-btn${activeSubTab === 'commissions' ? ' is-active' : ''}`}
        >
          <FileText size={16} />
          <span>Commission Ledger</span>
        </button>
      </div>

      {/* TAB 1: WITHDRAWAL REQUESTS */}
      {activeSubTab === 'requests' && (
        <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-toolbar">
            <div className="segmented" role="tablist" aria-label="Filter by status">
              {['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === st}
                  onClick={() => setStatusFilter(st)}
                  className={`segmented-btn${statusFilter === st ? ' is-active' : ''}`}
                >
                  {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div className="filter-search-box" style={{ maxWidth: 300 }}>
              <Search size={14} className="search-icon" aria-hidden="true" />
              <input
                type="text"
                aria-label="Search withdrawals"
                placeholder="Search request, member or reference"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      <LoadingState compact label="Loading withdrawal requests…" />
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      <EmptyState compact icon={<AlertCircle size={22} />} title="No withdrawal requests" text="Nothing matches the current filter." />
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
                          <span className="text-mono" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.requestId}</span>
                        </td>

                        {/* Member Details */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="avatar-circle">{initials}</span>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{row.memberName || row.memberId}</div>
                              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{row.memberId}</div>
                            </div>
                          </div>
                        </td>

                        {/* Requested Amount */}
                        <td>
                          <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: 'var(--fs-md)' }}>
                            ₹ {row.requestedAmount.toLocaleString()}
                          </span>
                        </td>

                        {/* Approved Amount */}
                        <td>
                          {row.approvedAmount !== undefined && row.approvedAmount !== null ? (
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                              ₹ {row.approvedAmount.toLocaleString()}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-light)' }}>—</span>
                          )}
                        </td>

                        {/* Paid & Payment Reference */}
                        <td>
                          {row.status === 'PAID' ? (
                            <div>
                              <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: 'var(--fs-base)' }}>
                                ₹ {(row.paidAmount || row.approvedAmount || row.requestedAmount).toLocaleString()}
                              </span>
                              {row.paymentReference && (
                                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  Ref: <strong style={{ color: 'var(--text-body)' }}>{row.paymentReference}</strong>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-light)' }}>—</span>
                          )}
                        </td>

                        {/* Date */}
                        <td style={{ color: 'var(--text-muted)' }}>
                          {row.requestedAt ? new Date(row.requestedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent'}
                        </td>

                        {/* Status */}
                        <td>
                          <StatusBadge status={row.status} />
                        </td>

                        {/* Notes */}
                        <td style={{ maxWidth: '160px' }}>
                          {row.note && (
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.note}>
                              <span style={{ fontWeight: 600 }}>Note:</span> {row.note}
                            </div>
                          )}
                          {row.adminNote && (
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }} title={row.adminNote}>
                              <span style={{ fontWeight: 600 }}>Admin:</span> {row.adminNote}
                            </div>
                          )}
                          {!row.note && !row.adminNote && <span style={{ color: 'var(--text-disabled)' }}>—</span>}
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'center' }}>
                          <div className="row-actions" style={{ justifyContent: 'center' }}>
                            {isAdmin ? (
                              <>
                                {row.status === 'PENDING' && (
                                  <>
                                    <button
                                      onClick={() => handleOpenAdminAction(row, 'APPROVE')}
                                      className="btn btn-primary btn-sm"
                                      title="Approve Request"
                                    >
                                      <Check size={13} /> Approve
                                    </button>
                                    <button
                                      onClick={() => handleOpenAdminAction(row, 'REJECT')}
                                      className="btn btn-sm btn-icon btn-danger-outline"
                                      title="Reject Request"
                                      aria-label="Reject Request"
                                    >
                                      <XCircle size={13} />
                                    </button>
                                  </>
                                )}

                                {row.status === 'APPROVED' && (
                                  <>
                                    <button
                                      onClick={() => handleOpenAdminAction(row, 'PAY')}
                                      className="btn btn-success btn-sm"
                                      title="Mark as Paid"
                                    >
                                      <CreditCard size={13} /> Mark as Paid
                                    </button>
                                    <button
                                      onClick={() => handleOpenAdminAction(row, 'REJECT')}
                                      className="btn btn-sm btn-icon btn-danger-outline"
                                      title="Reject Request"
                                      aria-label="Reject Request"
                                    >
                                      <XCircle size={13} />
                                    </button>
                                  </>
                                )}

                                {(row.status === 'PAID' || row.status === 'REJECTED') && (
                                  <button
                                    onClick={() => handleOpenAdminAction(row, 'VIEW_DETAILS')} className="btn btn-secondary btn-sm">
                                    <Eye size={12} /> Audit Details
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => handleOpenAdminAction(row, 'VIEW_DETAILS')} className="btn btn-secondary btn-sm">
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
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              Live real-time message log
            </span>
          </div>

          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <Bell size={32} color="var(--text-disabled)" style={{ margin: '0 auto 10px', display: 'block' }} />
              No notifications or messages yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notifications.map((notif) => (
                <div
                  key={notif._id || notif.notificationId}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-lg)',
                    background: notif.isRead ? 'var(--surface)' : 'var(--info-light)',
                    border: `1px solid ${notif.isRead ? 'var(--border-color)' : 'var(--info-border)'}`,
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
                        borderRadius: 'var(--radius-md)',
                        background:
                          notif.type === 'WITHDRAWAL_PAID'
                            ? 'var(--success-light)'
                            : notif.type === 'WITHDRAWAL_APPROVED'
                            ? 'var(--primary-light)'
                            : notif.type === 'WITHDRAWAL_REJECTED'
                            ? 'var(--danger-light)'
                            : 'var(--warning-light)',
                        color:
                          notif.type === 'WITHDRAWAL_PAID'
                            ? 'var(--success)'
                            : notif.type === 'WITHDRAWAL_APPROVED'
                            ? 'var(--primary)'
                            : notif.type === 'WITHDRAWAL_REJECTED'
                            ? 'var(--danger)'
                            : 'var(--warning)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Bell size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-main)' }}>
                        {notif.title}
                        {!notif.isRead && (
                          <span style={{ fontSize: 'var(--fs-2xs)', background: 'var(--primary)', color: 'var(--text-inverse)', padding: '1px 6px', borderRadius: 'var(--radius-full)', marginLeft: '8px' }}>
                            New
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {notif.message}
                      </div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-light)', marginTop: '4px' }}>
                        {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : ''}
                        {notif.referenceId && ` • Ref: ${notif.referenceId}`}
                      </div>
                    </div>
                  </div>

                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkNotifRead(notif.notificationId || notif._id)} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
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
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-subtle)' }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Platform Commission Ledger Records
            </h3>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Commission payouts. No TDS or admin fee is deducted; older entries may still show past deductions.
            </p>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ledger ID</th>
                  <th>Member</th>
                  <th>Gross Commission</th>
                  <th>TDS</th>
                  <th>Admin Fee</th>
                  <th>Net Payable</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {commissionLedger.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No commission ledger entries available.
                    </td>
                  </tr>
                ) : (
                  commissionLedger.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)' }}>
                          {row.id}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{row.memberName}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{row.memberId}</div>
                      </td>
                      <td style={{ fontWeight: 700 }}>₹ {row.amount?.toLocaleString()}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 600 }}>- ₹ {row.tdsDeduction}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 600 }}>- ₹ {row.adminFee}</td>
                      <td>
                        <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: 'var(--fs-md)', background: 'var(--success-light)', padding: '3px 8px', borderRadius: 'var(--radius-sm)' }}>
                          ₹ {row.netPayable?.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.requestDate}</td>
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
