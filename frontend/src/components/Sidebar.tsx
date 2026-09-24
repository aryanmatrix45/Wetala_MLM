import React from 'react';
import { 
  Home, 
  Users, 
  GitFork, 
  Package, 
  IndianRupee, 
  GitMerge, 
  Users2, 
  Sparkles, 
  Trophy, 
  Wallet, 
  BarChart3, 
  FileText, 
  Settings, 
  LogOut,
  Sprout
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'genealogy', label: 'Genealogy Tree', icon: GitFork },
    { id: 'packages', label: 'Package Management', icon: Package },
    { id: 'income-settings', label: 'Income Settings', icon: IndianRupee },
    { id: 'pairing-binary', label: 'Pairing & Binary', icon: GitMerge },
    { id: 'team-bonus', label: 'Team Bonus', icon: Users2 },
    { id: 'direct-royalty', label: 'Direct / Royalty', icon: Sparkles },
    { id: 'rank-rewards', label: 'Rank & Rewards', icon: Trophy },
    { id: 'wallet-payouts', label: 'Wallet & Payouts', icon: Wallet },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'cms-content', label: 'CMS / Content', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="sidebar">
      {/* Brand Logo */}
      <div className="sidebar-logo">
        <div className="logo-bubbles">
          <div className="bubble" style={{ background: '#f59e0b' }}></div>
          <div className="bubble" style={{ background: '#ef4444' }}></div>
          <div className="bubble" style={{ background: '#10b981' }}></div>
          <div className="bubble" style={{ background: '#0284c7' }}></div>
        </div>
        <span className="logo-text">Wetala</span>
      </div>

      {/* Navigation Menu */}
      <nav className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`menu-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <button 
          onClick={() => alert('Logout clicked')} 
          className="menu-item" 
          style={{ marginTop: 'auto', color: '#94a3b8' }}
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </nav>

      {/* Bottom Slogan Card */}
      <div className="sidebar-footer-card">
        <div className="sprout-icon-box">
          <Sprout size={20} />
        </div>
        <div className="footer-slogan">
          People Grow<br />Better Together
        </div>
      </div>
    </aside>
  );
};
