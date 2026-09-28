import React, { useState } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  UserPlus, 
  Search, 
  Calendar, 
  Filter, 
  RotateCcw, 
  MoreVertical 
} from 'lucide-react';

interface MemberItem {
  id: string;
  memberId: string;
  name: string;
  sponsorId: string;
  package: string;
  joinDate: string;
  status: 'Active' | 'Inactive';
  mobile: string;
}

interface MembersPageProps {
  onOpenAddMember: () => void;
}

export const MembersPage: React.FC<MembersPageProps> = ({ onOpenAddMember }) => {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('All Packages');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch live members from backend API
  React.useEffect(() => {
    import('../services/api').then(({ api }) => {
      api.getMembers()
        .then((data) => {
          if (Array.isArray(data)) {
            setMembers(
              data.map((m: any) => ({
                id: m.id || m._id,
                memberId: m.memberId,
                name: m.name,
                sponsorId: m.sponsorId,
                package: m.packageName || m.package || 'Starter',
                joinDate: m.joinDate || 'Recent',
                status: (m.status || '').toLowerCase() === 'active' ? 'Active' : 'Inactive',
                mobile: m.mobile || m.phone || '-',
              }))
            );
          }
        })
        .catch((err) => console.log('Error fetching members:', err));
    });
  }, []);

  // Filter logic
  const filteredMembers = members.filter((m) => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.memberId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.mobile.includes(searchTerm) ||
      m.sponsorId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPackage = selectedPackage === 'All Packages' || m.package === selectedPackage;
    const matchesStatus = selectedStatus === 'All Status' || m.status === selectedStatus;

    return matchesSearch && matchesPackage && matchesStatus;
  });

  const handleToggleStatus = (id: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: m.status === 'Active' ? 'Inactive' : 'Active' } : m))
    );
  };

  const handleReset = () => {
    setSearchTerm('');
    setSelectedPackage('All Packages');
    setSelectedStatus('All Status');
  };

  const totalCount = members.length;
  const activeCount = members.filter((m) => m.status === 'Active').length;
  const inactiveCount = totalCount - activeCount;
  const activePercent = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;

  return (
    <div className="page-body">
      {/* Top Title & Add Member CTA */}
      <div className="welcome-header">
        <div>
          <h1 className="page-title">Members</h1>
          <p className="page-subtitle">Manage all members, view details, activate accounts and more.</p>
        </div>
        <button onClick={onOpenAddMember} className="primary-btn" style={{ padding: '10px 20px', borderRadius: '8px' }}>
          <UserPlus size={18} />
          <span>Add Member</span>
        </button>
      </div>

      {/* 4 Summary Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-blue">
            <Users size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Members</div>
            <div className="kpi-value">{totalCount}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-green">
            <UserCheck size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Active Members</div>
            <div className="kpi-value">
              {activeCount} {totalCount > 0 && <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 600 }}>↑ {activePercent}%</span>}
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-coral">
            <UserX size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Inactive Members</div>
            <div className="kpi-value">
              {inactiveCount} {totalCount > 0 && <span style={{ fontSize: '13px', color: '#ef4444', fontWeight: 600 }}>{100 - activePercent}%</span>}
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-gold">
            <UserPlus size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">New This Month</div>
            <div className="kpi-value">{totalCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar (Image 5 Middle) */}
      <div className="filter-bar">
        <div className="search-input-box">
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            placeholder="Name, Member ID, Mobile or Email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select 
          className="filter-select"
          value={selectedPackage}
          onChange={(e) => setSelectedPackage(e.target.value)}
        >
          <option value="All Packages">All Packages</option>
          <option value="Basic">Basic (₹ 3,000)</option>
          <option value="Premium">Premium (₹ 15,000)</option>
          <option value="Elite">Elite (₹ 35,000)</option>
        </select>

        <select 
          className="filter-select"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="All Status">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        <div className="filter-select" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
          <Calendar size={16} />
          <span>Select Date</span>
        </div>

        <button className="primary-btn" style={{ padding: '9px 18px' }}>
          <Filter size={15} />
          <span>Filter</span>
        </button>

        <button onClick={handleReset} className="outline-btn" style={{ padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RotateCcw size={15} />
          <span>Reset</span>
        </button>
      </div>

      {/* Members Table Card */}
      <div className="dashboard-card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Member ID</th>
                <th>Name</th>
                <th>Sponsor ID</th>
                <th>Package</th>
                <th>Join Date</th>
                <th>Status</th>
                <th>Mobile</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m, idx) => {
                const initials = m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <tr key={m.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: '6px', fontSize: '12px' }}>
                        {m.memberId}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '11.5px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{m.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{m.mobile}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>{m.sponsorId}</span>
                    </td>
                    <td>
                      <span style={{ 
                        padding: '3px 10px', 
                        borderRadius: '6px', 
                        fontSize: '11.5px', 
                        fontWeight: 700,
                        background: m.package === 'Premium' ? '#f5f3ff' : '#eff6ff',
                        color: m.package === 'Premium' ? '#7c3aed' : '#2563eb'
                      }}>
                        {m.package}
                      </span>
                    </td>
                    <td style={{ fontSize: '12.5px', color: '#64748b' }}>{m.joinDate}</td>
                    <td>
                      <span 
                        onClick={() => handleToggleStatus(m.id)}
                        className={`status-pill ${m.status === 'Active' ? 'status-active' : 'status-inactive'}`}
                        style={{ cursor: 'pointer' }}
                        title="Click to toggle status"
                      >
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: m.status === 'Active' ? '#10b981' : '#ef4444'
                        }} />
                        {m.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '12.5px', color: '#64748b' }}>{m.mobile}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <button className="action-view-btn" onClick={() => alert(`Viewing details for ${m.name} (${m.memberId})`)}>
                          View
                        </button>
                        <button className="action-edit-btn" onClick={() => alert(`Editing ${m.name}`)}>
                          Edit
                        </button>
                        <button style={{ color: '#94a3b8', padding: '4px' }}>
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Strip (Image 5 Bottom) */}
        <div style={{ 
          padding: '16px 24px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderTop: '1px solid #f1f5f9' 
        }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Showing {filteredMembers.length > 0 ? 1 : 0} to {filteredMembers.length} of {totalCount} members
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button 
              className="outline-btn" 
              style={{ padding: '6px 12px', fontSize: '12px' }}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              &lt;
            </button>
            <button className="primary-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>1</button>
            <button className="outline-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>2</button>
            <button className="outline-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>3</button>
            <button className="outline-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>4</button>
            <button className="outline-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>5</button>
            <span style={{ color: '#94a3b8', margin: '0 4px' }}>...</span>
            <button className="outline-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>126</button>
            <button 
              className="outline-btn" 
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
