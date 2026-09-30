import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, ChevronDown, LogOut, Zap, Search, ShieldCheck } from 'lucide-react';

interface TopNavbarProps {
  user?: {
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    memberId?: string;
    role?: string;
  } | null;
  onToggleSidebar?: () => void;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ user, onToggleSidebar, onLogout, onNavigate }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const displayName = user?.name
    ? user.name
    : user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : 'Rohit Sharma';

  const initials = (() => {
    if (user?.name) {
      const parts = user.name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.firstName ? user.firstName.slice(0, 2).toUpperCase() : 'RS';
  })();

  const subLabel = user?.memberId
    ? `ID: ${user.memberId}`
    : user?.role === 'superadmin'
      ? 'Super Admin'
      : user?.role === 'admin'
        ? 'Admin'
        : 'Distributor';

  return (
    <header className="top-header">
      <div className="header-left">
        <button onClick={onToggleSidebar} className="toggle-btn" aria-label="Toggle Navigation">
          <Menu size={20} />
        </button>

        {/* Global Search Bar */}
        <div className="header-search-bar">
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search Member ID, Leg BV, Transactions..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onNavigate?.('members');
              }
            }}
          />
        </div>
      </div>

      <div className="header-right">
        {/* Quick Simulator CTA */}
        {onNavigate && (
          <button 
            className="header-pill-btn"
            onClick={() => onNavigate('income-settings')}
            title="Open Compensation Simulator"
          >
            <Zap size={15} color="#2563eb" />
            <span>Simulate Payout</span>
          </button>
        )}

        {/* Live Engine Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#059669',
          background: '#ecfdf5',
          padding: '6px 12px',
          borderRadius: '9999px',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>MongoDB Live</span>
        </div>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }} ref={notifDropdownRef}>
          <button 
            className="notification-badge-btn" 
            aria-label="Notifications"
            onClick={() => {
              setIsNotifOpen((prev) => !prev);
              setIsDropdownOpen(false);
            }}
          >
            <Bell size={19} />
            <span className="notif-count">3</span>
          </button>

          {isNotifOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              right: '0',
              width: '300px',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 35px -6px rgba(15, 23, 42, 0.15)',
              border: '1px solid #e2e8f0',
              padding: '16px',
              zIndex: 50,
              animation: 'fadeIn 0.15s ease-out'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Live System Alerts</span>
                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>3 New</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>Binary Volume Matched</div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>1,250 BV matched on MEM0001 left leg.</div>
                </div>
                <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>New Member Placed</div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>Priya Singh joined under MEM0001 (Right).</div>
                </div>
                <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>Daily Cap Reached</div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>₹4,000 threshold reached for MEM0003.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown Container */}
        <div className="profile-dropdown-container" ref={profileDropdownRef}>
          <div
            className={`profile-pill ${isDropdownOpen ? 'active' : ''}`}
            onClick={() => {
              setIsDropdownOpen((prev) => !prev);
              setIsNotifOpen(false);
            }}
            role="button"
            tabIndex={0}
            aria-expanded={isDropdownOpen}
            aria-label="User profile menu"
          >
            <div className="avatar-circle">{initials}</div>
            <div className="profile-info">
              <span className="profile-name">{displayName}</span>
              <span className="profile-role">{subLabel}</span>
            </div>
            <ChevronDown
              size={14}
              color="#64748b"
              style={{
                transition: 'transform 0.2s ease',
                transform: isDropdownOpen ? 'rotate(180deg)' : 'none'
              }}
            />
          </div>

          {/* Floating Dropdown Menu (Positioned Below) */}
          {isDropdownOpen && (
            <div className="profile-dropdown-menu">
              <div className="profile-dropdown-header">
                <div className="profile-dropdown-user-row">
                  <div className="avatar-circle-sm">{initials}</div>
                  <div className="profile-dropdown-user-text">
                    <div className="profile-dropdown-name">{displayName}</div>
                    <div className="profile-dropdown-email">{user?.email || 'superadmin@wetala.com'}</div>
                  </div>
                </div>
                {user?.memberId && (
                  <div className="profile-dropdown-badge">
                    <span className="badge-label">Member ID:</span>
                    <span className="badge-value">{user.memberId}</span>
                  </div>
                )}
              </div>

              <div className="profile-dropdown-divider" />

              <button
                type="button"
                className="profile-dropdown-item danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(false);
                  onLogout?.();
                }}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
