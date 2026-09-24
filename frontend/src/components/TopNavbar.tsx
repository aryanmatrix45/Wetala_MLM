import React, { useState } from 'react';
import { Menu, Bell, ChevronDown, LogOut } from 'lucide-react';

interface TopNavbarProps {
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
  } | null;
  onToggleSidebar?: () => void;
  onLogout?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ user, onToggleSidebar, onLogout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : 'SuperAdmin';

  const initial = user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'S';

  return (
    <header className="top-header">
      <div className="header-left">
        <button onClick={onToggleSidebar} className="toggle-btn" aria-label="Toggle Navigation">
          <Menu size={20} />
        </button>
      </div>

      <div className="header-right">
        {/* Notification Bell */}
        <button className="notification-badge-btn" aria-label="Notifications">
          <Bell size={20} />
          <span className="notif-count">3</span>
        </button>

        {/* Admin Profile Pill */}
        <div
          className="profile-pill"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <div className="avatar-circle">{initial}</div>
          <div className="profile-info">
            <span className="profile-name">{displayName}</span>
            <span className="profile-role">
              {user?.role === 'superadmin' ? 'Super Admin' : 'Admin'}
            </span>
          </div>
          <ChevronDown size={14} color="#64748b" />

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="profile-dropdown-menu">
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{displayName}</div>
                <div style={{ fontSize: '11px', color: '#64748b', wordBreak: 'break-all' }}>{user?.email}</div>
              </div>
              <button
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
