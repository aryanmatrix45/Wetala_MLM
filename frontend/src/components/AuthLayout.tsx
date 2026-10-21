import React from 'react';

interface AuthLayoutProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small label above the title, e.g. the current step */
  eyebrow?: React.ReactNode;
  wide?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/* Shared frame for sign-in and registration screens */
export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, eyebrow, wide, footer, children }) => (
  <div className="auth-page">
    <main className={`auth-card${wide ? ' is-wide' : ''}`}>
      <header className="auth-header">
        <img src="/logo.png" alt="Panchveda Wellness" className="auth-logo" />
        {eyebrow && <span className="auth-eyebrow">{eyebrow}</span>}
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
      </header>
      {children}
      {footer && <footer className="auth-footer">{footer}</footer>}
    </main>
  </div>
);
