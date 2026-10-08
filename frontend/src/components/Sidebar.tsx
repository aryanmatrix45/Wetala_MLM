import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Users, 
  GitFork, 
  Package, 
  IndianRupee, 
  Users2, 
  Sparkles, 
  Trophy, 
  Wallet, 
  BarChart3, 
  Settings, 
  LogOut,
  Gift,
  ArrowDownToLine,
  UserCheck,
  ShoppingBag,
  FolderTree,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout?: () => void;
  user?: any;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, user }) => {
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin';
  const [pendingWithdrawals, setPendingWithdrawals] = useState<number>(0);
  const [pendingMemberRequests, setPendingMemberRequests] = useState<number>(0);

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
    } else if (user?.memberId) {
      api.getMyWithdrawals(undefined, user.memberId)
        .then((res: any) => {
          if (res?.summary?.pendingCount !== undefined) {
            setPendingWithdrawals(res.summary.pendingCount);
          }
        })
        .catch(() => {});
    }
  }, [isAdmin, user?.memberId]);

  const sections = [
    {
      title: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: Home }
      ]
    },
    {
      title: 'Network & Genealogy',
      items: [
        { 
          id: 'members', 
          label: isAdmin ? 'All Members' : 'My Registered Members', 
          icon: Users 
        },
        ...(isAdmin ? [
          {
            id: 'member-requests',
            label: 'Member Requests',
            icon: UserCheck,
            badge: pendingMemberRequests > 0 ? `${pendingMemberRequests} New` : undefined
          }
        ] : []),
        { id: 'genealogy', label: 'Binary & Sponsor Tree', icon: GitFork, badge: 'Live' }
      ]
    },
    {
      title: 'Finance & Compensation',
      items: [
        { id: 'welcome-bonus', label: 'Welcome Bonus', icon: Gift, badge: isAdmin ? '4% Pool' : 'BV' },
        { id: 'sponsor-income', label: 'Sponsor Binary Income', icon: Users, badge: '20%' },
        { 
          id: 'withdrawals', 
          label: isAdmin ? 'Withdrawal Requests' : 'My Withdrawals', 
          icon: ArrowDownToLine, 
          badge: pendingWithdrawals > 0 ? (isAdmin ? `${pendingWithdrawals} New` : `${pendingWithdrawals} Pending`) : undefined 
        },
        { id: 'wallet-payouts', label: 'Wallet & Payouts', icon: Wallet },
        { id: 'income-settings', label: 'Income & Simulator', icon: IndianRupee, badge: 'Engine' },
        { id: 'team-bonus', label: 'Team Bonus Slabs', icon: Users2 },
        { id: 'direct-royalty', label: 'Royalty & Consultancy', icon: Sparkles },
        { id: 'rank-rewards', label: 'Lifetime Rewards', icon: Trophy }
      ]
    },
    {
      title: isAdmin ? 'Platform Administration' : 'Member Services',
      items: [
        ...(isAdmin ? [
          {
            id: 'manage-categories',
            label: 'Manage Categories',
            icon: FolderTree,
          },
          {
            id: 'manage-subcategories',
            label: 'Manage Subcategories',
            icon: Layers,
          },
          {
            id: 'manage-products',
            label: 'Manage Products',
            icon: ShoppingBag,
          },
        ] : [
          {
            id: 'member-products',
            label: 'Products & Repurchase',
            icon: ShoppingBag,
            badge: 'Store',
          },
        ]),
        { 
          id: 'packages', 
          label: isAdmin ? 'Package Management' : (user?.packageName || user?.joiningPackageId ? 'Packages & Upgrade' : 'Buy Joining Package'), 
          icon: Package, 
          badge: isAdmin ? undefined : (user?.packageName || user?.joiningPackageId ? 'Upgrade' : 'Buy') 
        },
        ...(isAdmin ? [
          { id: 'reports', label: 'Financial Reports', icon: BarChart3 },
          { id: 'settings', label: 'System Settings', icon: Settings }
        ] : [])
      ]
    }
  ];

  return (
    <aside className="sidebar">
      {/* Brand Logo */}
      <div className="sidebar-logo">
        <div className="logo-brand-wrap">
          <div className="logo-emblem" style={{ background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)' }}>PW</div>
          <div className="logo-text-group">
            <span className="logo-text" style={{ fontSize: '15px' }}>Panchveda Wellness</span>
            <span className="logo-badge">Direct Selling</span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="sidebar-menu">
        {sections.map((section, sIdx) => (
          <div key={sIdx} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="sidebar-section-label">{section.title}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`menu-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} style={{ color: isActive ? '#ffffff' : '#94a3b8' }} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="menu-item-badge">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <button 
            onClick={() => onLogout ? onLogout() : alert('Logging out...')} 
            className="menu-item" 
            style={{ color: '#f87171' }}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Bottom Live System Indicator */}
      <div className="sidebar-footer-card">
        <div className="system-status-indicator">
          <div className="pulse-dot"></div>
          <span>{isAdmin ? 'System Engine Active' : 'Binary Engine Active'}</span>
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isAdmin ? (
            <>
              <span style={{ color: '#10b981', fontWeight: 700 }}>Uncapped Policy</span>
              <span>v2.4.0</span>
            </>
          ) : (
            <>
              <span>Daily Cap: ₹{user?.dailyCapping ? user.dailyCapping.toLocaleString() : '4,000'}</span>
              <span>v2.4.0</span>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
