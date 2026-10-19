import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, ChevronDown, LogOut, Zap, Search, ShieldCheck, AlertTriangle, X, User } from 'lucide-react';
import { api } from '../services/api';
import { NotificationList } from './NotificationList';
import { isCappingNotification } from '../hooks/useNotifications';

interface TopNavbarProps {
  user?: {
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    memberId?: string;
    role?: string;
  } | null;
  activeTab?: string;
  onToggleSidebar?: () => void;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  /** Latest notifications, polled once in App (shared with the mobile bottom nav) */
  notifications?: any[];
  unreadCount?: number;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  user,
  activeTab,
  onToggleSidebar,
  onLogout,
  onNavigate,
  notifications: liveNotifs = [],
  unreadCount = 0,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'superadmin';

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
      : 'Member';

  return (
    <header className="top-header">
      <div className="header-left">
        <button 
          onClick={onToggleSidebar} 
          className={`toggle-btn ${activeTab === 'home' ? 'toggle-btn-home' : ''}`}
          aria-label="Toggle Navigation"
          title="Open Navigation Menu"
        >
          <Menu size={20} />
          {activeTab === 'home' && <span className="toggle-btn-label">Menu</span>}
        </button>

        {activeTab === 'home' && (
          <div 
            className="header-brand-home" 
            onClick={() => onNavigate?.('home')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
            title="Panchveda Wellness Home"
          >
            <img
              src="/logo.png"
              alt="Panchveda"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                objectFit: 'contain',
                background: '#ffffff',
                padding: '1.5px',
                border: '1.5px solid rgba(234, 179, 8, 0.45)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', letterSpacing: '-0.02em' }}>
                Panchveda
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#eab308', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Wellness
              </span>
            </div>
          </div>
        )}

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
        <div className="header-live-badge" style={{
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

        {/* Capping Exceeded Alert Pill in Topbar */}
        {(() => {
          const capNotif = liveNotifs.find(isCappingNotification);
          if (!capNotif || !onNavigate) return null;
          return (
            <button 
              className="capping-alert-pill"
              onClick={() => {
                if (capNotif._id || capNotif.notificationId) {
                  api.markNotificationRead(capNotif._id || capNotif.notificationId).catch(() => {});
                }
                onNavigate('packages');
              }}
              title="Capping limits exceeded! Click to upgrade your package."
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#b91c1c',
                background: '#fef2f2',
                padding: '5px 12px',
                borderRadius: '9999px',
                border: '1.5px solid #fca5a5',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.12)',
              }}
            >
              <AlertTriangle size={14} color="#dc2626" />
              <span className="capping-alert-text">Capping Exceeded • Upgrade Package</span>
            </button>
          );
        })()}

        {/* Notification Bell */}
        <div className="header-notif-wrap" style={{ position: 'relative' }} ref={notifDropdownRef}>
          <button 
            className="notification-badge-btn" 
            aria-label="Notifications"
            onClick={() => {
              setIsNotifOpen((prev) => !prev);
              setIsDropdownOpen(false);
            }}
          >
            <Bell size={19} />
            {unreadCount > 0 && <span className="notif-count">{unreadCount}</span>}
          </button>

          {isNotifOpen && (
            <div className="notification-dropdown-menu">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    {isAdmin ? 'Admin Alerts & Requests' : 'Account Notifications'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, background: '#eff6ff', padding: '2px 7px', borderRadius: '12px' }}>
                    {unreadCount > 0 ? `${unreadCount} New` : 'Up to date'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNotifOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#f1f5f9',
                    color: '#64748b',
                    cursor: 'pointer',
                    border: 'none',
                    padding: 0
                  }}
                  title="Close notifications"
                >
                  <X size={14} />
                </button>
              </div>
              <NotificationList
                notifications={liveNotifs}
                onNavigate={onNavigate}
                onItemClick={() => setIsNotifOpen(false)}
              />

              <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                <button
                  onClick={() => {
                    setIsNotifOpen(false);
                    onNavigate?.('withdrawals');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  View All in Payout Center →
                </button>
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
                className="profile-dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(false);
                  onNavigate?.('profile');
                }}
              >
                <User size={16} />
                <span>My Profile & Referrals</span>
              </button>

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
