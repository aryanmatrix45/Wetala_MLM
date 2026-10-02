import React from 'react';
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
  LogOut
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout?: () => void;
  user?: any;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, user }) => {
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

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
        { id: 'members', label: 'Members Directory', icon: Users },
        { id: 'genealogy', label: 'Binary & Sponsor Tree', icon: GitFork, badge: 'Live' }
      ]
    },
    {
      title: 'Finance & Compensation',
      items: [
        { id: 'income-settings', label: 'Income & Simulator', icon: IndianRupee, badge: 'Engine' },
        { id: 'team-bonus', label: 'Team Bonus Slabs', icon: Users2 },
        { id: 'direct-royalty', label: 'Royalty & Consultancy', icon: Sparkles },
        { id: 'rank-rewards', label: 'Lifetime Rewards', icon: Trophy },
        { id: 'wallet-payouts', label: 'Wallet & Payouts', icon: Wallet, badge: '3' }
      ]
    },
    {
      title: isAdmin ? 'Platform Administration' : 'Member Services',
      items: [
        { 
          id: 'packages', 
          label: isAdmin ? 'Package Management' : 'Buy Joining Package', 
          icon: Package, 
          badge: isAdmin ? undefined : 'Buy' 
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
            <span className="logo-text" style={{ fontSize: '15px' }}>Panchwati Wellness</span>
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
          <span>Binary Engine Active</span>
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
          <span>Daily Cap: ₹4,000</span>
          <span>v2.4.0</span>
        </div>
      </div>
    </aside>
  );
};
