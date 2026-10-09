import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  UserPlus, 
  Search, 
  Filter, 
  RotateCcw, 
  Clock, 
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Phone,
  Package,
  Calendar,
  X
} from 'lucide-react';
import { api } from '../services/api';

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
  onOpenAddMember: () => void;
  user?: any;
  token?: string | null;
  onNavigate?: (tab: string) => void;
}

export const MembersPage: React.FC<MembersPageProps> = ({ onOpenAddMember, user, token, onNavigate }) => {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('All Packages');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin';

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
                package: m.packageName || m.package || 'Package 1',
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
      {/* Top Header */}
      <div className="welcome-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 className="page-title">{isAdmin ? 'All Members Directory' : 'My Registered Members'}</h1>
            <span style={{
              background: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '11.5px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Sparkles size={13} />
              {isAdmin ? 'Super Admin Mode' : `Sponsor ID: ${user?.memberId || 'MEM0001'}`}
            </span>
          </div>
          <p className="page-subtitle">
            {isAdmin 
              ? 'Complete company-wide directory. Track placements, approval states, and member activity.'
              : `Showing members registered under or sponsored by your ID (${user?.memberId || 'Account'}). New additions require Super Admin approval.`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isAdmin && pendingCount > 0 && onNavigate && (
            <button 
              onClick={() => onNavigate('member-requests')} 
              className="secondary-btn" 
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#d97706',
                borderColor: '#fde68a',
                background: '#fffbeb',
                fontWeight: 700,
                fontSize: '13px'
              }}
            >
              <Clock size={16} />
              <span>{pendingCount} Pending Requests</span>
            </button>
          )}

          <button 
            onClick={onOpenAddMember} 
            className="primary-btn" 
            style={{ 
              padding: '10px 22px', 
              borderRadius: '10px',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
            }}
          >
            <UserPlus size={18} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Admin Notice Banner if pending requests exist */}
      {isAdmin && pendingCount > 0 && onNavigate && (
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1px solid #fcd34d',
          borderRadius: '14px',
          padding: '14px 20px',
          marginBottom: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              background: '#fde68a', 
              color: '#b45309', 
              width: '38px', 
              height: '38px', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#92400e' }}>
                Action Required: {pendingCount} Member Registration {pendingCount === 1 ? 'Request' : 'Requests'} Pending Approval
              </div>
              <div style={{ fontSize: '12.5px', color: '#b45309', marginTop: '2px' }}>
                New members cannot log in or occupy binary tree legs until you accept their request.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('member-requests')}
            className="primary-btn"
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              borderRadius: '8px',
              flexShrink: 0
            }}
          >
            <span>Review & Approve</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-blue">
            <Users size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">{isAdmin ? 'Total Members' : 'My Total Members'}</div>
            <div className="kpi-value">{totalCount}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-green">
            <UserCheck size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Active in Binary Tree</div>
            <div className="kpi-value">
              {activeCount}
              {totalCount > 0 && (
                <span style={{ fontSize: '12px', color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  ↑ {activePercent}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-gold">
            <Clock size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Pending Approval</div>
            <div className="kpi-value" style={{ color: '#d97706' }}>
              {pendingCount}
              {pendingCount > 0 && (
                <span style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                  Awaiting Admin
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-coral">
            <UserX size={24} />
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
              placeholder={isAdmin ? "Search by Name, ID, Mobile, Sponsor..." : "Search in my registered members..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                style={{ position: 'absolute', right: '12px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
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
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="All Status">All Status</option>
              <option value="Active">● Active Only</option>
              <option value="Pending">● Pending Approval</option>
              <option value="Inactive">● Inactive</option>
              <option value="Rejected">● Rejected</option>
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
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
          Showing <span style={{ color: '#0f172a', fontWeight: 700 }}>{filteredMembers.length}</span> of {totalCount} members
        </div>
      </div>

      {/* Members Table Card */}
      <div className="dashboard-card" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                <th>Member ID</th>
                <th>Member Name & Phone</th>
                <th>Sponsor ID</th>
                {isAdmin && <th>Added By</th>}
                <th>Package</th>
                <th>Join Date</th>
                <th>Account Status</th>
                <th>Binary Tree</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                    <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 600 }}>Loading members directory...</p>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                      <Users size={28} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                      {searchTerm ? 'No matching members found' : 'No members registered yet'}
                    </div>
                    <p style={{ color: '#64748b', fontSize: '13.5px', marginTop: '4px' }}>
                      {searchTerm 
                        ? 'Try adjusting your search keywords or clearing filters.' 
                        : isAdmin 
                        ? 'Click the "Add Member" button to create the first member.' 
                        : 'Click "Add Member" above to register your first team member!'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m, idx) => {
                  const initials = m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                  
                  return (
                    <tr key={m.id}>
                      {/* Index */}
                      <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>
                        {idx + 1}
                      </td>

                      {/* Member ID */}
                      <td>
                        <span style={{ 
                          fontWeight: 800, 
                          color: '#2563eb', 
                          background: '#eff6ff', 
                          border: '1px solid #dbeafe',
                          padding: '4px 9px', 
                          borderRadius: '8px', 
                          fontSize: '12.5px',
                          letterSpacing: '0.4px',
                          display: 'inline-block'
                        }}>
                          {m.memberId}
                        </span>
                      </td>

                      {/* Name & Mobile */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: m.status === 'Pending' 
                              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                              : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            color: 'white',
                            fontWeight: 800,
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)'
                          }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13.5px' }}>
                              {m.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Phone size={11} style={{ color: '#94a3b8' }} />
                              <span>{m.mobile}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Sponsor ID */}
                      <td>
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: 700, 
                          color: '#334155',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}>
                          {m.sponsorId}
                        </span>
                      </td>

                      {/* Added By (for Admin view) */}
                      {isAdmin && (
                        <td>
                          <span style={{ 
                            fontSize: '11.5px', 
                            color: '#475569', 
                            background: '#f1f5f9', 
                            padding: '3px 8px', 
                            borderRadius: '6px',
                            fontWeight: 600
                          }}>
                            {m.addedBy || 'ADMIN'}
                          </span>
                        </td>
                      )}

                      {/* Package */}
                      <td>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '8px', 
                          fontSize: '12px', 
                          fontWeight: 700,
                          background: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #dbeafe',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <Package size={12} />
                          {m.package}
                        </span>
                      </td>

                      {/* Join Date */}
                      <td style={{ fontSize: '12.5px', color: '#64748b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Calendar size={12} style={{ color: '#94a3b8' }} />
                          <span>{m.joinDate}</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td>
                        {m.status === 'Active' && (
                          <span className="status-pill status-active">
                            <span style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: '#10b981',
                              boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.25)'
                            }} />
                            Active
                          </span>
                        )}

                        {m.status === 'Pending' && (
                          <span className="status-pill status-pending" title="Awaiting Super Admin approval">
                            <Clock size={12} />
                            Pending Approval
                          </span>
                        )}

                        {m.status === 'Inactive' && (
                          <span className="status-pill status-inactive">
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
                            Inactive
                          </span>
                        )}

                        {m.status === 'Rejected' && (
                          <span className="status-pill status-rejected">
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* Binary Tree Status */}
                      <td>
                        {m.isBinaryActive ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#ecfdf5',
                            color: '#065f46',
                            border: '1px solid #a7f3d0',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 700
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                            Active ({m.personalBv} BV)
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#fffbeb',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 600
                          }} title="Requires minimum 100 BV in account to participate in binary tree">
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                            Pending ({m.personalBv}/100 BV)
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="action-view-btn" 
                          onClick={() => alert(`Member Profile:\n\nName: ${m.name}\nMember ID: ${m.memberId}\nMobile: ${m.mobile}\nSponsor ID: ${m.sponsorId}\nPackage: ${m.package}\nStatus: ${m.status}\nAdded By: ${m.addedBy || 'Direct'}\nJoin Date: ${m.joinDate}`)}
                          style={{
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: 700
                          }}
                        >
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

        {/* Pagination Strip */}
        <div style={{ 
          padding: '16px 22px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderTop: '1px solid #f1f5f9',
          background: '#f8fafc'
        }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Showing <strong>{filteredMembers.length > 0 ? 1 : 0}</strong> to <strong>{filteredMembers.length}</strong> of <strong>{totalCount}</strong> members
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="outline-btn" 
              style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px' }}
              disabled
            >
              Previous
            </button>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', padding: '6px 10px', background: '#eff6ff', borderRadius: '6px' }}>
              1
            </span>
            <button 
              className="outline-btn" 
              style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px' }}
              disabled
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
