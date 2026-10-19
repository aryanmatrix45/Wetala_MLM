import React from 'react';
import { LogIn, UserPlus } from 'lucide-react';

interface PublicTopNavbarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onShowSocial: () => void;
  onLogin: () => void;
  onSignUp: () => void;
}

/**
 * Header for visitors who are not signed in: brand, public section links (desktop)
 * and separate Login / Sign Up buttons on the right.
 */
export const PublicTopNavbar: React.FC<PublicTopNavbarProps> = ({
  activeTab,
  onNavigate,
  onShowSocial,
  onLogin,
  onSignUp,
}) => {
  const links = [
    { key: 'home', label: 'Home', onClick: () => onNavigate('home'), isActive: activeTab === 'home' },
    {
      key: 'member-products',
      label: 'Products',
      onClick: () => onNavigate('member-products'),
      isActive: activeTab === 'member-products',
    },
    { key: 'social', label: 'Social Media', onClick: onShowSocial, isActive: false },
  ];

  return (
    <header className="top-header public-header">
      <div className="header-left">
        <button
          type="button"
          className="header-brand-home public-brand"
          onClick={() => onNavigate('home')}
          title="Panchveda Wellness Home"
        >
          <img src="/logo.png" alt="" className="public-brand-logo" />
          <span className="public-brand-text">
            <span className="public-brand-name">Panchveda</span>
            <span className="public-brand-tag">Wellness</span>
          </span>
        </button>

        <nav className="public-nav" aria-label="Main">
          {links.map((link) => (
            <button
              key={link.key}
              type="button"
              className={`public-nav-link ${link.isActive ? 'is-active' : ''}`}
              onClick={link.onClick}
              aria-current={link.isActive ? 'page' : undefined}
            >
              {link.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="header-right public-auth-actions">
        <button type="button" className="public-auth-btn is-login" onClick={onLogin}>
          <LogIn size={16} aria-hidden="true" />
          <span>Login</span>
        </button>
        <button type="button" className="public-auth-btn is-signup" onClick={onSignUp}>
          <UserPlus size={16} aria-hidden="true" />
          <span>Sign Up</span>
        </button>
      </div>
    </header>
  );
};

export default PublicTopNavbar;
