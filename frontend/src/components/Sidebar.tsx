import React, { useState, useEffect } from 'react';
import { LogOut, X, ChevronDown } from 'lucide-react';
import { api } from '../services/api';
import { getNavSections } from './navigation';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout?: () => void;
  user?: any;
  isOpen?: boolean;
  onClose?: () => void;
}

const COLLAPSED_KEY = 'wetala_sidebar_collapsed';
// Matches the backend DEFAULT_DAILY_CAP used when a member has no package-specific cap
const DEFAULT_DAILY_CAP = 4000;

const readCollapsed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]');
  } catch {
    return [];
  }
};

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, user, isOpen, onClose }) => {
  const isAdmin = user?.role?.toLowerCase() === 'superadmin';
  const [pendingWithdrawals, setPendingWithdrawals] = useState<number>(0);
  const [pendingMemberRequests, setPendingMemberRequests] = useState<number>(0);
  const [pendingPurchaseRequests, setPendingPurchaseRequests] = useState<number>(0);
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);

  useEffect(() => {
    if (isAdmin) {
      api.getAllWithdrawalsAdmin({ status: 'PENDING', limit: 1 })
        .then((res: any) => {
          if (res?.kpis?.pendingCount !== undefined) {
            setPendingWithdrawals(res.kpis.pendingCount);
          } else if (res?.total !== undefined) {
            setPendingWithdrawals(res.total);
          }
        })
        .catch(() => {});

      api.getMemberRequests()
        .then((res: any) => {
          if (res?.totalPending !== undefined) {
            setPendingMemberRequests(res.totalPending);
          }
        })
        .catch(() => {});

      api.getPurchases({ stage: 'REQUESTED', limit: 1 })
        .then((res: any) => {
          if (res?.pagination?.total !== undefined) {
            setPendingPurchaseRequests(res.pagination.total);
          }
        })
        .catch(() => {});
    } else if (user?.memberId) {
      api.getMyWithdrawals(undefined, user.memberId)
        .then((res: any) => {
          if (res?.summary?.pendingCount !== undefined) {
            setPendingWithdrawals(res.summary.pendingCount);
          }
        })
        .catch(() => {});

      api.getPurchases({ memberId: user.memberId, limit: 20 })
        .then((res: any) => {
          if (Array.isArray(res?.data)) {
            const active = res.data.filter((p: any) =>
              ['REQUESTED', 'PAYMENT_INSTRUCTIONS_SENT', 'PAYMENT_SUBMITTED'].includes(p.approvalStage)
            ).length;
            setPendingPurchaseRequests(active);
          }
        })
        .catch(() => {});
    }
  }, [isAdmin, user?.memberId]);

  const sections = getNavSections(user, {
    withdrawals: pendingWithdrawals,
    memberRequests: pendingMemberRequests,
    purchases: pendingPurchaseRequests,
  });

  const toggleSection = (id: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const hasActivePackage = Boolean(user?.packageName);
  const dailyCap = user?.dailyCapping > 0 ? user.dailyCapping : DEFAULT_DAILY_CAP;

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-logo">
        <div className="logo-brand-wrap">
          <img src="/logo.png" alt="" className="sidebar-brand-img" />
          <div className="logo-text-group">
            <span className="logo-text">Panchveda Wellness</span>
            <span className="logo-badge">{isAdmin ? 'Admin Console' : 'Member Portal'}</span>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="sidebar-close-btn" aria-label="Close navigation">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="sidebar-menu">
        {sections.map((section) => {
          // The group holding the current page always stays open
          const containsActive = section.items.some((item) => item.id === activeTab);
          const isCollapsed = Boolean(section.title) && collapsed.includes(section.id) && !containsActive;
          return (
            <div key={section.id} className={`sidebar-group${isCollapsed ? ' is-collapsed' : ''}`}>
              {section.title && (
                <button
                  type="button"
                  className="sidebar-section-label"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={!isCollapsed}
                >
                  <span>{section.title}</span>
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
              )}
              {!isCollapsed &&
                section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-tab={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        onClose?.();
                      }}
                      className={`menu-item ${isActive ? 'active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{item.label}</span>
                      {!!item.count && (
                        <span className="menu-item-badge" aria-label={`${item.count} pending`}>
                          {item.count > 99 ? '99+' : item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {!isAdmin && (
          <div className="sidebar-footer-card">
            <strong>
              <span className={`status-dot${hasActivePackage ? ' is-on' : ''}`} aria-hidden="true" />
              {hasActivePackage ? `${user.packageName} package` : 'No active package'}
            </strong>
            {hasActivePackage && <span>Daily cap ₹{Number(dailyCap).toLocaleString('en-IN')}</span>}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            onClose?.();
            onLogout?.();
          }}
          className="menu-item is-danger"
        >
          <LogOut size={18} aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
