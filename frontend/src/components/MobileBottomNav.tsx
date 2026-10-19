import React, { useEffect, useState } from 'react';
import { Home, ShoppingBag, Bell, Share2, X } from 'lucide-react';
import { NotificationList } from './NotificationList';
import { SocialMediaSection } from './SocialMediaSection';

type SheetKind = 'notifications' | 'social';

interface MobileBottomNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  notifications: any[];
  unreadCount: number;
  isAdmin?: boolean;
}

/**
 * Fixed bottom navigation for phones (hidden on desktop via CSS).
 * Home and Products switch tabs; Notifications and Social Media open a bottom sheet
 * that sits above the bar so members can switch sections without closing it first.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onNavigate,
  notifications,
  unreadCount,
  isAdmin = false,
}) => {
  const [openSheet, setOpenSheet] = useState<SheetKind | null>(null);

  const closeSheet = () => setOpenSheet(null);
  const toggleSheet = (kind: SheetKind) => setOpenSheet((current) => (current === kind ? null : kind));

  // Close the sheet whenever the visible tab changes
  useEffect(() => {
    setOpenSheet(null);
  }, [activeTab]);

  // Escape closes the sheet; lock page scroll while it is open
  useEffect(() => {
    if (!openSheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenSheet(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [openSheet]);

  const goTo = (tab: string) => {
    setOpenSheet(null);
    onNavigate(tab);
  };

  const items = [
    {
      key: 'home',
      label: 'Home',
      icon: Home,
      isActive: !openSheet && activeTab === 'home',
      onClick: () => goTo('home'),
    },
    {
      key: 'products',
      label: 'Products',
      icon: ShoppingBag,
      isActive: !openSheet && activeTab === 'member-products',
      onClick: () => goTo('member-products'),
    },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: Bell,
      isActive: openSheet === 'notifications',
      badge: unreadCount,
      onClick: () => toggleSheet('notifications'),
    },
    {
      key: 'social',
      label: 'Social',
      icon: Share2,
      isActive: openSheet === 'social',
      onClick: () => toggleSheet('social'),
    },
  ];

  return (
    <>
      {openSheet && (
        <>
          <div className="bottom-sheet-backdrop" onClick={closeSheet} aria-hidden="true" />
          <section
            className="bottom-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bottom-sheet-title"
          >
            <div className="bottom-sheet-handle" aria-hidden="true" />
            <header className="bottom-sheet-header">
              <div>
                <h2 className="bottom-sheet-title" id="bottom-sheet-title">
                  {openSheet === 'notifications'
                    ? isAdmin
                      ? 'Admin Alerts & Requests'
                      : 'Notifications'
                    : 'Social Media'}
                </h2>
                <p className="bottom-sheet-subtitle">
                  {openSheet === 'notifications'
                    ? unreadCount > 0
                      ? `${unreadCount} new`
                      : 'You are up to date'
                    : 'Follow our official channels for tutorials, live sessions and news'}
                </p>
              </div>
              <button type="button" className="bottom-sheet-close" onClick={closeSheet} aria-label="Close">
                <X size={18} />
              </button>
            </header>

            <div className="bottom-sheet-body">
              {openSheet === 'notifications' ? (
                <>
                  <NotificationList
                    notifications={notifications}
                    onNavigate={goTo}
                    onItemClick={closeSheet}
                    maxHeight="none"
                  />
                  <button type="button" className="bottom-sheet-link" onClick={() => goTo('withdrawals')}>
                    View all in Payout Center →
                  </button>
                </>
              ) : (
                <SocialMediaSection showEmptyState />
              )}
            </div>
          </section>
        </>
      )}

      <nav className="mobile-bottom-nav" aria-label="Primary">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={`mobile-bottom-nav-item ${item.isActive ? 'is-active' : ''}`}
              onClick={item.onClick}
              aria-current={item.isActive ? 'page' : undefined}
              aria-label={
                item.badge ? `${item.label}, ${item.badge} unread` : item.label
              }
            >
              <span className="mobile-bottom-nav-icon">
                <Icon size={21} aria-hidden="true" />
                {item.badge ? (
                  <span className="mobile-bottom-nav-badge" aria-hidden="true">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </span>
              <span className="mobile-bottom-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

export default MobileBottomNav;
