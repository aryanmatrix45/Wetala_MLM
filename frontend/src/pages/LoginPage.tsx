import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, User, Phone, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: any, token: string) => void;
  onGoToPreReg?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onGoToPreReg }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regSponsorId, setRegSponsorId] = useState('MEM0001');
  const [regPosition, setRegPosition] = useState<'LEFT' | 'RIGHT'>('LEFT');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Handle Login Submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

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

  // Handle Signup Submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!regName.trim()) {
      setError('Please provide your Full Name.');
      return;
    }

    if (!regEmail.trim()) {
      setError('Please provide a valid Email address.');
      return;
    }

    if (!regPhone.trim()) {
      setError('Please provide your 10-digit Phone number.');
      return;
    }

    if (!regPassword) {
      setError('Please set a password.');
      return;
    }

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.register({
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        password: regPassword,
        confirmPassword: regConfirmPassword,
        sponsorId: regSponsorId.trim().toUpperCase() || 'MEM0001',
        position: regPosition,
      });

      if (res.status) {
        setSuccessMsg(
          `🎉 Welcome ${res.data?.name || regName}! Your Member ID is ${res.memberId}. Your account is active. You can log in immediately below.`
        );
        // Pre-fill login credentials with the newly registered user
        setIdentifier(res.data?.email || regEmail.trim());
        setPassword(regPassword);
        // Switch to login tab smoothly
        setAuthMode('login');
      } else {
        setError(res.message || 'Registration failed. Please check your details.');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to connect to the registration server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      {/* Background Ambient Orbs */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />

      <div className="login-card" style={{ maxWidth: authMode === 'register' ? '500px' : '460px' }}>
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
            {authMode === 'login' 
              ? 'Access your distributor dashboard & compensation ledger' 
              : 'Join the network & start earning multi-tier binary commissions'}
          </p>
        </div>



        {/* Success Alert */}
        {successMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#a7f3d0',
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '20px'
          }}>
            <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

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
        {authMode === 'login' ? (
          <>
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
                onClick={() => {
                  if (onGoToPreReg) {
                    onGoToPreReg();
                  } else {
                    setAuthMode('register');
                  }
                }}
                style={{ color: '#38bdf8', fontWeight: 700, textDecoration: 'underline' }}
              >
                Sign Up / Join with Referral
              </button>
            </div>
          </>
        ) : (
          /* =========================================================================
             SIGN UP / REGISTER FORM
             ========================================================================= */
          <>
            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Full Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label className="login-label">Full Name</label>
                <div className="input-with-icon">
                  <User size={18} className="input-icon" color="#94a3b8" />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="login-input"
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Email & Phone Grid */}
              <div className="auth-form-row">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label className="login-label">Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={18} className="input-icon" color="#94a3b8" />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="rahul@example.com"
                      className="login-input"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label className="login-label">Phone Number</label>
                  <div className="input-with-icon">
                    <Phone size={18} className="input-icon" color="#94a3b8" />
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="98765 43210"
                      className="login-input"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              </div>

              {/* Sponsor ID & Preferred Leg Grid */}
              <div className="auth-form-row auth-form-row-sponsor">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label className="login-label">Sponsor Member ID</label>
                  <div className="input-with-icon">
                    <User size={18} className="input-icon" color="#94a3b8" />
                    <input
                      type="text"
                      required
                      value={regSponsorId}
                      onChange={(e) => setRegSponsorId(e.target.value.toUpperCase())}
                      placeholder="e.g. MEM0001"
                      className="login-input"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label className="login-label">Preferred Placement</label>
                  <select
                    value={regPosition}
                    onChange={(e) => setRegPosition(e.target.value as 'LEFT' | 'RIGHT')}
                    className="login-input"
                    style={{ paddingLeft: '14px', paddingRight: '32px', cursor: 'pointer', background: '#1e293b', color: '#f8fafc' }}
                  >
                    <option value="LEFT">Left Wing</option>
                    <option value="RIGHT">Right Wing</option>
                  </select>
                </div>
              </div>

              {/* Password & Confirm Password Grid */}
              <div className="auth-form-row">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label className="login-label">Password</label>
                  <div className="input-with-icon">
                    <Lock size={18} className="input-icon" color="#94a3b8" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="login-input"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="input-eye-btn"
                      aria-label="Toggle password"
                    >
                      {showRegPassword ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label className="login-label">Confirm Password</label>
                  <div className="input-with-icon">
                    <Lock size={18} className="input-icon" color="#94a3b8" />
                    <input
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="login-input"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      className="input-eye-btn"
                      aria-label="Toggle confirm password"
                    >
                      {showRegConfirmPassword ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="login-submit-btn"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)' }}
              >
                {loading ? (
                  <span>Registering Member...</span>
                ) : (
                  <>
                    <span>Create My Account</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                style={{ color: '#38bdf8', fontWeight: 700, textDecoration: 'underline' }}
              >
                Sign In Here
              </button>
            </div>
          </>
        )}

        <div style={{ marginTop: '22px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
          Protected by Enterprise Decimal-Safe Binary Ledger
        </div>
      </div>
    </div>
  );
};
