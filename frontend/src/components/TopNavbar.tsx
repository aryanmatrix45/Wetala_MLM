import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, ChevronDown, LogOut, AlertTriangle, X, User } from 'lucide-react';
import { api } from '../services/api';
import { NotificationList } from './NotificationList';
import { isCappingNotification } from '../hooks/useNotifications';
import { findNavItem } from './navigation';

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
  const isHome = activeTab === 'home';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsNotifOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const displayName = user?.name
    ? user.name
    : user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : isAdmin
        ? 'Super Admin'
        : 'Member';

  const initials = (() => {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  })();

  const subLabel = user?.memberId ? user.memberId : isAdmin ? 'Super Admin' : 'Member';
  const context = activeTab ? findNavItem(user, activeTab) : null;
  const capNotif = onNavigate ? liveNotifs.find(isCappingNotification) : undefined;

  return (
    <header className="top-header">
      <div className="header-left">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="toggle-btn"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        {isHome ? (
          <button type="button" className="header-brand-home" onClick={() => onNavigate?.('home')}>
            <img src="/logo.png" alt="" className="header-brand-logo" />
            <span className="header-brand-text">
              <span className="header-brand-name">Panchveda</span>
              <span className="header-brand-tag">Wellness</span>
            </span>
          </button>
        ) : (
          context && (
            <div className="header-context">
              {context.section && (
                <>
                  <span className="header-context-section">{context.section}</span>
                  <span className="header-context-sep" aria-hidden="true">/</span>
                </>
              )}
              <span className="header-context-page">{context.label}</span>
            </div>
          )
        )}
      </div>

      <div className="header-right">
        {capNotif && (
          <button
            type="button"
            className="capping-alert-pill"
            onClick={() => {
              if (capNotif._id || capNotif.notificationId) {
                api.markNotificationRead(capNotif._id || capNotif.notificationId).catch(() => {});
              }
              onNavigate?.('packages');
            }}
            title="Daily capping exceeded — upgrade your package"
          >
            <AlertTriangle size={14} />
            <span className="capping-alert-text">Capping exceeded · Upgrade</span>
          </button>
        )}

        <div className="header-notif-wrap" ref={notifDropdownRef}>
          <button
            type="button"
            className="notification-badge-btn"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            aria-expanded={isNotifOpen}
            onClick={() => {
              setIsNotifOpen((prev) => !prev);
              setIsDropdownOpen(false);
            }}
          >
            <Bell size={19} />
            {unreadCount > 0 && <span className="notif-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>

          {isNotifOpen && (
            <div className="notification-dropdown-menu" role="dialog" aria-label="Notifications">
              <div className="dropdown-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="dropdown-title">{isAdmin ? 'Alerts & Requests' : 'Notifications'}</span>
                  {unreadCount > 0 && <span className="badge badge-primary">{unreadCount} new</span>}
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setIsNotifOpen(false)}
                  aria-label="Close notifications"
                >
                  <X size={16} />
                </button>
              </div>
              <NotificationList
                notifications={liveNotifs}
                onNavigate={onNavigate}
                onItemClick={() => setIsNotifOpen(false)}
              />
              <div className="dropdown-foot">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setIsNotifOpen(false);
                    onNavigate?.('withdrawals');
                  }}
                >
                  View all in Payout Center
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="profile-dropdown-container" ref={profileDropdownRef}>
          <button
            type="button"
            className={`profile-pill ${isDropdownOpen ? 'active' : ''}`}
            onClick={() => {
              setIsDropdownOpen((prev) => !prev);
              setIsNotifOpen(false);
            }}
            aria-expanded={isDropdownOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
          >
            <span className="avatar-circle">{initials}</span>
            <span className="profile-info">
              <span className="profile-name">{displayName}</span>
              <span className="profile-role">{subLabel}</span>
            </span>
            <ChevronDown
              size={14}
              color="var(--text-muted)"
              style={{ transition: 'transform 0.2s ease', transform: isDropdownOpen ? 'rotate(180deg)' : 'none' }}
            />
          </button>

          {isDropdownOpen && (
            <div className="profile-dropdown-menu" role="menu">
              <div className="profile-dropdown-header">
                <div className="profile-dropdown-user-row">
                  <span className="avatar-circle-sm">{initials}</span>
                  <div className="profile-dropdown-user-text">
                    <div className="profile-dropdown-name">{displayName}</div>
                    {user?.email && <div className="profile-dropdown-email">{user.email}</div>}
                    {user?.memberId && <div className="profile-dropdown-email">Member ID {user.memberId}</div>}
                  </div>
                </div>
              </div>

              <div className="profile-dropdown-divider" />

              <button
                type="button"
                role="menuitem"
                className="profile-dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(false);
                  onNavigate?.('profile');
                }}
              >
                <User size={16} />
                <span>{isAdmin ? 'Profile & Referrals' : 'Profile & KYC'}</span>
              </button>

              <button
                type="button"
                role="menuitem"
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
