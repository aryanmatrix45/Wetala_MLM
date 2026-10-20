import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: any, token: string) => void;
  onGoToPreReg: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onGoToPreReg }) => {
  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Login Submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password.trim()) {
      setError('Please provide your Email Address and Password.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.login({ email: identifier.trim(), password });

      if (res.status && res.token) {
        localStorage.setItem('wetala_token', res.token);
        localStorage.setItem('wetala_user', JSON.stringify(res.data));
        onLoginSuccess(res.data, res.token);
      } else {
        setError(res.message || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to connect to the authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      {/* Background Ambient Orbs */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />

      <div className="login-card" style={{ maxWidth: '460px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px',
            position: 'relative',
          }}>
            <img 
              src="/logo.png" 
              alt="Panchveda Wellness" 
              style={{
                width: '86px',
                height: '86px',
                borderRadius: '50%',
                objectFit: 'contain',
                background: '#ffffff',
                padding: '2px',
                border: '2px solid rgba(234, 179, 8, 0.45)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35), 0 0 20px rgba(16, 185, 129, 0.25)',
              }}
            />
          </div>
          <h1 className="login-title">Panchveda Wellness</h1>
          <p className="login-subtitle">
            Access your distributor dashboard & compensation ledger
          </p>
        </div>



        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '20px'
          }}>
            <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* =========================================================================
            SIGN IN FORM
            ========================================================================= */}
        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="login-label">Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" color="#94a3b8" />
              <input
                type="email"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. aryan@gmail.com"
                className="login-input"
                autoComplete="email"
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="login-label">Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" color="#94a3b8" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="login-input"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="input-eye-btn"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} color="#94a3b8" /> : <Eye size={18} color="#94a3b8" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="login-submit-btn"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Platform</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onGoToPreReg}
            style={{ color: '#38bdf8', fontWeight: 700, textDecoration: 'underline' }}
          >
            Sign Up / Join with Referral
          </button>
        </div>

        <div style={{ marginTop: '22px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
          Protected by Enterprise Decimal-Safe Binary Ledger
        </div>
      </div>
    </div>
  );
};
