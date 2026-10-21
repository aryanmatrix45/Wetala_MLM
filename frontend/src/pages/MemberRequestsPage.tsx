import React, { useState, useEffect } from 'react';
import { Alert, Badge, EmptyState, LoadingState, PageHeader } from '../components/ui';
import { ArrowRight, CheckCircle2, Mail, Package, Phone, RefreshCw, Search, UserCheck, UserX } from 'lucide-react';
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
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            Member Requests
            {requests.length > 0 && <Badge tone="warning" size="lg">{requests.length} pending</Badge>}
          </span>
        }
        subtitle="Accepted members can log in immediately. Binary tree participation starts once they reach 100 BV."
        actions={
          <>
            <button type="button" onClick={fetchRequests} className="btn btn-secondary" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
              <span>Refresh</span>
            </button>
            {onNavigate && (
              <button type="button" onClick={() => onNavigate('members')} className="btn btn-secondary">
                <span>All Members</span>
                <ArrowRight size={16} />
              </button>
            )}
          </>
        }
      />

      {feedbackMessage && (
        <Alert tone={feedbackMessage.type === 'success' ? 'success' : 'error'}>{feedbackMessage.text}</Alert>
      )}

      <div className="table-filter-bar">
        <div className="filter-search-box">
          <Search size={16} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            aria-label="Search requests"
            placeholder="Search name, ID, phone, sponsor or added by"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <LoadingState label="Loading member requests…" />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={22} />}
            title={searchTerm ? 'No matching requests' : 'No pending requests'}
            text={searchTerm ? 'No requests match your search.' : 'All registration requests have been reviewed.'}
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Contact</th>
                  <th>Added By</th>
                  <th>Sponsor & Leg</th>
                  <th>Package</th>
                  <th>Requested</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((reqItem) => {
                  const isActionLoading = actionLoadingId === (reqItem.id || reqItem.memberId);
                  return (
                    <tr key={reqItem.id || reqItem.memberId}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{reqItem.name}</div>
                        <div className="text-mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{reqItem.memberId}</div>
                      </td>
                      <td>
                        <div className="icon-text"><Phone size={13} aria-hidden="true" /> {reqItem.mobile}</div>
                        <div className="icon-text" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                          <Mail size={13} aria-hidden="true" /> {reqItem.email}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{reqItem.addedBy || 'Direct'}</td>
                      <td>
                        <div>Sponsor <strong className="text-mono">{reqItem.sponsorId}</strong></div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                          Parent {reqItem.parentId || 'Auto'} · {reqItem.position || 'LEFT'} leg
                        </div>
                      </td>
                      <td>
                        <div className="icon-text"><Package size={13} aria-hidden="true" /> {reqItem.packageName || 'No package'}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{reqItem.packageBv ? `${reqItem.packageBv} BV` : '0 BV'}</div>
                      </td>
                      <td className="nowrap" style={{ color: 'var(--text-muted)' }}>
                        {reqItem.joinDate || new Date(reqItem.createdAt).toLocaleDateString('en-GB')}
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => handleApprove(reqItem)}
                            disabled={isActionLoading}
                            className="btn btn-sm btn-success"
                            title="Accept and activate member"
                          >
                            <UserCheck size={14} />
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(reqItem)}
                            disabled={isActionLoading}
                            className="btn btn-sm btn-danger-outline"
                            title="Reject request"
                          >
                            <UserX size={14} />
                            Reject
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
