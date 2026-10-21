import React, { useState, useEffect } from 'react';
import { ArrowRight, CircleDot, Clock, Filter, Package, RotateCcw, Search, UserCheck, UserX, Users, X } from 'lucide-react';
import { api } from '../services/api';
import { Alert, Badge, EmptyState, LoadingState, Modal, PageHeader, StatusBadge } from '../components/ui';

interface MemberItem {
  id: string;
  memberId: string;
  name: string;
  sponsorId: string;
  package: string;
  joinDate: string;
  status: 'Active' | 'Inactive' | 'Pending' | 'Rejected';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  addedBy?: string;
  mobile: string;
  personalBv: number;
  isBinaryActive: boolean;
}

interface MembersPageProps {
  user?: any;
  token?: string | null;
  onNavigate?: (tab: string) => void;
}

export const MembersPage: React.FC<MembersPageProps> = ({ user, token, onNavigate }) => {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMember, setViewMember] = useState<MemberItem | null>(null);
  const [selectedPackage, setSelectedPackage] = useState('All Packages');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role?.toLowerCase() === 'superadmin';

  // Fetch live members from backend API scoped to user role
  useEffect(() => {
    setLoading(true);
    api.getMembers(token || undefined)
      .then((data) => {
        if (Array.isArray(data)) {
          setMembers(
            data.map((m: any) => {
              let resolvedStatus: 'Active' | 'Inactive' | 'Pending' | 'Rejected' = 'Inactive';
              if (m.approvalStatus === 'pending' || m.status === 'pending') {
                resolvedStatus = 'Pending';
              } else if (m.approvalStatus === 'rejected' || m.status === 'rejected') {
                resolvedStatus = 'Rejected';
              } else if ((m.status || '').toLowerCase() === 'active') {
                resolvedStatus = 'Active';
              }

              const pBv = Number(m.personalBv || 0);
              const isBinActive = Boolean(m.isBinaryActive || pBv >= 100);

              return {
                id: m.id || m._id,
                memberId: m.memberId,
                name: m.name,
                sponsorId: m.sponsorId,
                package: m.packageName || m.package || 'No Package',
                joinDate: m.joinDate || 'Recent',
                status: resolvedStatus,
                approvalStatus: m.approvalStatus || (resolvedStatus === 'Pending' ? 'pending' : 'approved'),
                addedBy: m.addedBy || 'ADMIN',
                mobile: m.mobile || m.phone || '-',
                personalBv: pBv,
                isBinaryActive: isBinActive,
              };
            })
          );
        }
      })
      .catch((err) => console.error('Error fetching members:', err))
      .finally(() => setLoading(false));
  }, [token]);

  // Filter logic
  const filteredMembers = members.filter((m) => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.memberId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.mobile.includes(searchTerm) ||
      m.sponsorId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.addedBy && m.addedBy.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesPackage = selectedPackage === 'All Packages' || m.package === selectedPackage;
    const matchesStatus = selectedStatus === 'All Status' || m.status === selectedStatus;

    return matchesSearch && matchesPackage && matchesStatus;
  });

  const handleReset = () => {
    setSearchTerm('');
    setSelectedPackage('All Packages');
    setSelectedStatus('All Status');
  };

  const totalCount = members.length;
  const activeCount = members.filter((m) => m.status === 'Active').length;
  const pendingCount = members.filter((m) => m.status === 'Pending').length;
  const inactiveCount = members.filter((m) => m.status === 'Inactive' || m.status === 'Rejected').length;
  const activePercent = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;

  return (
    <div className="page-body">
      <PageHeader
        title={isAdmin ? 'All Members' : 'My Direct Members'}
        subtitle={
          isAdmin
            ? 'Company-wide directory with placement, approval and activity status.'
            : `Members who joined with your Sponsor ID ${user?.memberId || ''}.`
        }
      />

      {isAdmin && pendingCount > 0 && onNavigate && (
        <Alert tone="warning" title={`${pendingCount} registration ${pendingCount === 1 ? 'request' : 'requests'} awaiting approval`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <span>New members cannot log in or take a binary tree position until you accept their request.</span>
            <button type="button" onClick={() => onNavigate('member-requests')} className="btn btn-sm btn-secondary">
              Review requests
              <ArrowRight size={14} />
            </button>
          </div>
        </Alert>
      )}

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-blue">
            <Users size={20} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">{isAdmin ? 'Total Members' : 'My Direct Members'}</div>
            <div className="kpi-value">{totalCount}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-green">
            <UserCheck size={20} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Active in Binary Tree</div>
            <div className="kpi-value">{activeCount}</div>
            {totalCount > 0 && <div className="kpi-sub">{activePercent}% of members</div>}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-gold">
            <Clock size={20} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Pending Approval</div>
            <div className="kpi-value">{pendingCount}</div>
            {pendingCount > 0 && <div className="kpi-sub">Awaiting approval</div>}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-coral">
            <UserX size={20} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Inactive / Rejected</div>
            <div className="kpi-value">
              {inactiveCount}
            </div>
          </div>
        </div>
      </div>

      {/* Modern Filter Toolbar */}
      <div className="table-filter-bar">
        <div className="filter-group">
          {/* Search Box */}
          <div className="filter-search-box">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder={isAdmin ? "Search by Name, ID, Mobile, Sponsor..." : "Search in my direct members..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="input-clear-btn" aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Package Filter */}
          <div className="filter-select-box">
            <Filter size={14} className="select-icon" />
            <select value={selectedPackage} onChange={(e) => setSelectedPackage(e.target.value)}>
              <option value="All Packages">All Packages</option>
              <option value="Package 1">Package 1 (₹2,500)</option>
              <option value="Package 2">Package 2 (₹5,000)</option>
              <option value="Package 3">Package 3 (₹10,000)</option>
              <option value="Package 4">Package 4 (₹25,000)</option>
              <option value="Package 5">Package 5 (₹50,000)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="filter-select-box">
            <CircleDot size={14} className="select-icon" />
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="All Status">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Pending">Pending Approval</option>
              <option value="Inactive">Inactive</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Reset Action */}
          {(searchTerm || selectedPackage !== 'All Packages' || selectedStatus !== 'All Status') && (
            <button className="reset-btn" onClick={handleReset} title="Clear all filters">
              <RotateCcw size={14} />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        {/* Member Counter chip */}
        
      </div>

      {/* Members Table Card */}
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Member</th>
                <th>Sponsor</th>
                {isAdmin && <th>Added By</th>}
                <th>Package</th>
                <th>Joined</th>
                <th>Account</th>
                <th>Binary Tree</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8}>
                    <LoadingState label="Loading members…" />
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8}>
                    <EmptyState
                      icon={<Users size={22} />}
                      title={searchTerm ? 'No matching members' : 'No members yet'}
                      text={
                        searchTerm
                          ? 'Try different keywords or clear the filters.'
                          : isAdmin
                            ? 'Members will appear here once they register.'
                            : 'Members who register with your referral link will appear here.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m, idx) => {
                  const initials = m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <tr key={m.id}>
                      <td style={{ color: 'var(--text-light)' }}>{idx + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <span className="avatar-circle" style={{ background: m.status === 'Pending' ? 'var(--warning)' : undefined }}>
                            {initials}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{m.name}</div>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                              <span className="text-mono">{m.memberId}</span> · {m.mobile}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-mono">{m.sponsorId}</td>
                      {isAdmin && <td style={{ color: 'var(--text-muted)' }}>{m.addedBy || 'ADMIN'}</td>}
                      <td><Badge tone="primary" icon={<Package size={12} />}>{m.package}</Badge></td>
                      <td className="nowrap" style={{ color: 'var(--text-muted)' }}>{m.joinDate}</td>
                      <td>
                        <StatusBadge
                          status={m.status}
                          label={m.status === 'Pending' ? 'Pending approval' : m.status}
                        />
                      </td>
                      <td>
                        {m.isBinaryActive ? (
                          <Badge tone="success">Active · {m.personalBv} BV</Badge>
                        ) : (
                          <Badge tone="warning" title="Requires at least 100 BV to join the binary tree">
                            {m.personalBv}/100 BV
                          </Badge>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setViewMember(m)}>
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredMembers.length > 0 && (
          <div className="table-footer" style={{ border: 'none', borderTop: '1px solid var(--border-light)', borderRadius: 0 }}>
            <span>
              Showing <strong>{filteredMembers.length}</strong> of <strong>{totalCount}</strong> members
            </span>
          </div>
        )}
      </div>

      <Modal
        open={!!viewMember}
        onClose={() => setViewMember(null)}
        size="sm"
        title={viewMember?.name}
        subtitle={viewMember?.memberId}
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setViewMember(null)}>
            Close
          </button>
        }
      >
        {viewMember && (
          <div className="detail-list">
            <div className="detail-row"><span>Mobile</span><span>{viewMember.mobile}</span></div>
            <div className="detail-row"><span>Sponsor ID</span><span>{viewMember.sponsorId}</span></div>
            <div className="detail-row"><span>Package</span><span>{viewMember.package}</span></div>
            <div className="detail-row"><span>Status</span><span><StatusBadge status={viewMember.status} label={viewMember.status} /></span></div>
            <div className="detail-row"><span>Added by</span><span>{viewMember.addedBy || 'Direct'}</span></div>
            <div className="detail-row"><span>Join date</span><span>{viewMember.joinDate}</span></div>
          </div>
        )}
      </Modal>
    </div>
  );
};
