import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { api } from '../services/api';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, Field } from '../components/ui';

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
    <AuthLayout
      title="Sign in"
      subtitle="Access your member dashboard and earnings."
      footer={
        <>
          New to Panchveda?{' '}
          <button type="button" className="link-btn" onClick={onGoToPreReg}>
            Join with a referral
          </button>
        </>
      }
    >
      {error && (
        <Alert tone="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleLoginSubmit} className="auth-form" noValidate>
        <Field label="Email address" htmlFor="login-email">
          <div className="input-with-icon">
            <Mail size={18} className="input-icon" aria-hidden="true" />
            <input
              id="login-email"
              type="email"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com"
              className="form-input"
              autoComplete="email"
            />
          </div>
        </Field>

        <Field label="Password" htmlFor="login-password">
          <div className="input-with-icon">
            <Lock size={18} className="input-icon" aria-hidden="true" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="form-input has-trailing"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="input-eye-btn"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>

        <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block" style={{ marginTop: 'var(--space-2)' }}>
          {loading ? (
            <>
              <span className="spinner spinner-sm spinner-inverse" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </AuthLayout>
  );
};
