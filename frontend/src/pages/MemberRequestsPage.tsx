import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  UserX, 
  Clock, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  UserPlus, 
  ArrowRight,
  Package,
  Calendar,
  Phone,
  Mail
} from 'lucide-react';
import { api } from '../services/api';

interface MemberRequestItem {
  id: string;
  memberId: string;
  name: string;
  email: string;
  mobile: string;
  dob?: string;
  sponsorId: string;
  parentId?: string;
  position?: string;
  packageName?: string;
  packageBv?: number;
  addedBy: string;
  createdAt: string;
  joinDate?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  status: string;
}

interface MemberRequestsPageProps {
  user?: any;
  token?: string | null;
  onNavigate?: (tab: string) => void;
}

export const MemberRequestsPage: React.FC<MemberRequestsPageProps> = ({ token, onNavigate }) => {
  const [requests, setRequests] = useState<MemberRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.getMemberRequests(token || undefined);
      if (res && res.status && Array.isArray(res.data)) {
        setRequests(res.data);
      } else {
        setRequests([]);
      }
    } catch (err: any) {
      console.error('Error fetching member requests:', err);
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to load member requests.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [token]);

  const handleApprove = async (reqItem: MemberRequestItem) => {
    const confirmApprove = window.confirm(
      `Are you sure you want to accept and approve ${reqItem.name} (${reqItem.memberId})?\n\n- They will be granted immediate login access.\n- Binary income tree participation will activate once their account accumulates minimum 100 BV.`
    );
    if (!confirmApprove) return;

    setActionLoadingId(reqItem.id || reqItem.memberId);
    setFeedbackMessage(null);
    try {
      const res = await api.approveMemberRequest(reqItem.id || reqItem.memberId, token || undefined);
      setFeedbackMessage({
        type: 'success',
        text: res.message || `Member ${reqItem.name} (${reqItem.memberId}) approved! Login access enabled.`,
      });
      await fetchRequests();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to approve member request.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (reqItem: MemberRequestItem) => {
    const reason = window.prompt(
      `Please enter a rejection reason for ${reqItem.name} (${reqItem.memberId}):`,
      'Information incomplete or invalid sponsor details.'
    );
    if (reason === null) return; // User cancelled

    setActionLoadingId(reqItem.id || reqItem.memberId);
    setFeedbackMessage(null);
    try {
      const res = await api.rejectMemberRequest(reqItem.id || reqItem.memberId, reason, token || undefined);
      setFeedbackMessage({
        type: 'success',
        text: res.message || `Member request for ${reqItem.name} rejected and slot released.`,
      });
      await fetchRequests();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to reject member request.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.memberId.toLowerCase().includes(q) ||
      r.mobile.includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.sponsorId.toLowerCase().includes(q) ||
      r.addedBy.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-body">
      {/* Header */}
      <div className="welcome-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Member Requests & Approvals</h1>
            <span style={{
              background: '#fef3c7',
              color: '#d97706',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Clock size={13} /> {requests.length} Pending
            </span>
          </div>
          <p className="page-subtitle">
            Review and accept new member registrations. Once accepted, members can immediately log in. Binary income tree participation will activate when their account accumulates minimum 100 BV.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={fetchRequests} 
            className="secondary-btn" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px' }}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
            <span>Refresh</span>
          </button>
          {onNavigate && (
            <button 
              onClick={() => onNavigate('members')} 
              className="primary-btn" 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px' }}
            >
              <span>View All Members</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Alert Notice */}
      {feedbackMessage && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: feedbackMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${feedbackMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: feedbackMessage.type === 'success' ? '#065f46' : '#991b1b',
          fontSize: '14px',
          fontWeight: 500
        }}>
          {feedbackMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Pending Approval</div>
            <div className="kpi-value" style={{ color: '#d97706' }}>{requests.length}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#ecfdf5', color: '#059669' }}>
            <ShieldCheck size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Binary Qualification</div>
            <div className="kpi-value" style={{ fontSize: '18px', color: '#059669' }}>Min. 100 BV</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <UserPlus size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Submission Mode</div>
            <div className="kpi-value" style={{ fontSize: '18px', color: '#2563eb' }}>Member Direct</div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="table-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by name, ID, phone, sponsor, or added by..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              background: '#ffffff'
            }}
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#1d72fe', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p>Loading member requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <CheckCircle2 size={30} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
              No Pending Member Requests
            </h3>
            <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
              {searchTerm 
                ? 'No requests match your current search query.' 
                : 'All member registration requests have been reviewed and approved. Great job!'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 18px' }}>Candidate Member</th>
                  <th style={{ padding: '14px 18px' }}>Contact Details</th>
                  <th style={{ padding: '14px 18px' }}>Added By</th>
                  <th style={{ padding: '14px 18px' }}>Sponsor & Leg</th>
                  <th style={{ padding: '14px 18px' }}>Package / BV</th>
                  <th style={{ padding: '14px 18px' }}>Request Date</th>
                  <th style={{ padding: '14px 18px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((reqItem) => {
                  const isActionLoading = actionLoadingId === (reqItem.id || reqItem.memberId);
                  return (
                    <tr key={reqItem.id || reqItem.memberId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {/* Candidate Member */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{reqItem.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', fontWeight: 600 }}>
                          ID: {reqItem.memberId}
                        </div>
                      </td>

                      {/* Contact Details */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155' }}>
                          <Phone size={13} style={{ color: '#94a3b8' }} /> {reqItem.mobile}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          <Mail size={13} style={{ color: '#94a3b8' }} /> {reqItem.email}
                        </div>
                      </td>

                      {/* Added By */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          background: '#f1f5f9',
                          color: '#334155',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600
                        }}>
                          {reqItem.addedBy || 'Direct'}
                        </span>
                      </td>

                      {/* Sponsor & Leg */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>
                          Sponsor: <strong>{reqItem.sponsorId}</strong>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          Parent: {reqItem.parentId || 'Auto'} | Leg: <span style={{ fontWeight: 600, color: reqItem.position === 'RIGHT' ? '#0284c7' : '#10b981' }}>{reqItem.position || 'LEFT'}</span>
                        </div>
                      </td>

                      {/* Package / BV */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Package size={14} style={{ color: '#64748b' }} />
                          <span style={{ fontWeight: 500, color: '#0f172a', fontSize: '13px' }}>
                            {reqItem.packageName || 'Package 1'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                          {reqItem.packageBv ? `${reqItem.packageBv} BV` : '1,250 BV'}
                        </div>
                      </td>

                      {/* Request Date */}
                      <td style={{ padding: '14px 18px', fontSize: '12px', color: '#64748b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Calendar size={13} />
                          <span>{reqItem.joinDate || new Date(reqItem.createdAt).toLocaleDateString('en-GB')}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => handleApprove(reqItem)}
                            disabled={isActionLoading}
                            style={{
                              background: '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '7px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: isActionLoading ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              boxShadow: '0 1px 2px rgba(16, 185, 129, 0.2)'
                            }}
                            title="Accept & Activate Member into Binary Tree"
                          >
                            <UserCheck size={14} />
                            <span>Accept</span>
                          </button>

                          <button
                            onClick={() => handleReject(reqItem)}
                            disabled={isActionLoading}
                            style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              padding: '7px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: isActionLoading ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                            title="Reject Member Request"
                          >
                            <UserX size={14} />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
