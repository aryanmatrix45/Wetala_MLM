import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Phone, User, UserRound, Users } from 'lucide-react';
import { api } from '../services/api';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, Field } from '../components/ui';

interface FullRegistrationPageProps {
  initialData: {
    sponsorId: string;
    sponsorName: string;
    position: 'LEFT' | 'RIGHT';
    name?: string;
    email?: string;
    mobile?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
  };
  onBackToPreReg: () => void;
  onGoToLogin: () => void;
}

export const FullRegistrationPage: React.FC<FullRegistrationPageProps> = ({
  initialData,
  onBackToPreReg,
  onGoToLogin
}) => {
  const [formData, setFormData] = useState({
    sponsorId: initialData.sponsorId || 'MEM0001',
    sponsorName: initialData.sponsorName || 'Panchveda Sponsor',
    position: initialData.position || 'LEFT',
    name: initialData.name || '',
    countryCode: '+91',
    mobile: initialData.mobile || initialData.phone || '',
    email: initialData.email || '',
    password: initialData.password || '',
    confirmPassword: initialData.confirmPassword || '',
    nomineeName: '',
    nomineePhone: '',
    nomineeAge: '',
    agreeTerms: true,
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      sponsorId: initialData.sponsorId || prev.sponsorId,
      sponsorName: initialData.sponsorName || prev.sponsorName,
      position: initialData.position || prev.position,
      name: initialData.name !== undefined ? initialData.name : prev.name,
      mobile: initialData.mobile !== undefined ? initialData.mobile : (initialData.phone !== undefined ? initialData.phone : prev.mobile),
      email: initialData.email !== undefined ? initialData.email : prev.email,
      password: initialData.password !== undefined ? initialData.password : prev.password,
      confirmPassword: initialData.confirmPassword !== undefined ? initialData.confirmPassword : prev.confirmPassword,
    }));
  }, [initialData]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    memberId: string;
    name: string;
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!formData.name.trim()) {
      setError('Please provide your Full Name.');
      return;
    }

    const cleanMobile = formData.mobile.trim();
    if (!cleanMobile) {
      setError('Please provide your Mobile Number.');
      return;
    }

    if (!/^\d+$/.test(cleanMobile)) {
      setError('Mobile Number must contain digits only. Non-numeric characters and letters are not allowed.');
      return;
    }

    if (cleanMobile.length !== 10) {
      setError('Mobile Number must contain exactly 10 digits.');
      return;
    }

    if (!formData.email.trim()) {
      setError('Please provide your Email Address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setError('Please provide a valid Email Address (e.g. rahul@example.com).');
      return;
    }

    if (!formData.password) {
      setError('Please set a Password.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (!formData.confirmPassword) {
      setError('Please confirm your Password.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    // Nominee details are optional, but must be valid when provided
    const nomineeName = formData.nomineeName.trim();
    if (nomineeName && !/^[A-Za-z][A-Za-z .'-]{1,99}$/.test(nomineeName)) {
      setError('Nominee Name may contain letters, spaces, dots, hyphens and apostrophes only.');
      return;
    }

    if (formData.nomineePhone && formData.nomineePhone.length !== 10) {
      setError('Nominee Phone Number must contain exactly 10 digits.');
      return;
    }

    if (formData.nomineeAge && (Number(formData.nomineeAge) < 1 || Number(formData.nomineeAge) > 120)) {
      setError('Nominee Age must be between 1 and 120.');
      return;
    }

    if (!formData.agreeTerms) {
      setError('You must agree to the Terms and Conditions to proceed.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        countryCode: formData.countryCode,
        mobile: cleanMobile,
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        sponsorId: formData.sponsorId,
        position: formData.position,
        nomineeName: nomineeName || undefined,
        nomineePhone: formData.nomineePhone || undefined,
        nomineeAge: formData.nomineeAge ? Number(formData.nomineeAge) : undefined,
        termsAccepted: formData.agreeTerms,
      };

      const res = await api.register(payload);
      if (res.status) {
        setSuccessResult({
          memberId: res.memberId || res.data?.memberId || 'Created',
          name: formData.name,
          message: res.message || 'Registration completed successfully!',
        });
      } else {
        setError(res.message || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while registering member.');
    } finally {
      setLoading(false);
    }
  };

  // If successfully registered, show Success Card
  if (successResult) {
    return (
      <AuthLayout
        eyebrow="Registration complete"
        title="Welcome to Panchveda"
        subtitle={<>Congratulations, <strong>{successResult.name}</strong>. Your account is active and you can sign in now.</>}
      >
        <div className="detail-list" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="detail-row">
            <span>Member ID</span>
            <span style={{ color: 'var(--primary)', fontSize: 'var(--fs-lg)' }}>{successResult.memberId}</span>
          </div>
          <div className="detail-row">
            <span>Sponsor</span>
            <span>{formData.sponsorName} ({formData.sponsorId})</span>
          </div>
          <div className="detail-row">
            <span>Placement</span>
            <span>{formData.position} leg · activates at 100 BV</span>
          </div>
        </div>

        <Alert tone="success" title="Next steps">
          Sign in with your email and password, then open <strong>Profile → Complete Your KYC</strong> to add your bank,
          payment and identity details. Your binary tree position is placed once you purchase your first package or
          product (100 BV).
        </Alert>

        <button type="button" onClick={onGoToLogin} className="btn btn-primary btn-lg btn-block">
          Continue to sign in
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </AuthLayout>
    );
  }

  const togglePassword = (shown: boolean, setShown: (v: boolean) => void) => (
    <button
      type="button"
      onClick={() => setShown(!shown)}
      className="input-eye-btn"
      aria-label={shown ? 'Hide password' : 'Show password'}
    >
      {shown ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <AuthLayout
      wide
      eyebrow="Step 2 of 2"
      title="Create your account"
      subtitle="KYC documents can be added from your Profile after you sign in."
      footer={
        <>
          Already have an account?{' '}
          <button type="button" className="link-btn" onClick={onGoToLogin}>
            Sign in
          </button>
        </>
      }
    >
      {/* Sponsor & Position: set by the referral link, never editable here */}
      <div className="fullreg-grid-2" style={{ marginBottom: 'var(--space-5)' }}>
        <Field label="Sponsor" htmlFor="reg-sponsor-id" hint={formData.sponsorName}>
          <div className="input-with-icon">
            <Users size={16} className="input-icon" aria-hidden="true" />
            <input
              id="reg-sponsor-id"
              type="text"
              value={formData.sponsorId}
              readOnly
              aria-readonly="true"
              tabIndex={-1}
              className="form-input has-trailing"
              style={{ paddingLeft: 38, fontWeight: 600 }}
            />
            <Lock size={14} aria-hidden="true" style={{ position: 'absolute', right: 12, color: 'var(--text-light)' }} />
          </div>
        </Field>

        <Field label="Position" htmlFor="reg-position" hint="Set by your referral link">
          <div className="input-with-icon">
            {formData.position === 'RIGHT'
              ? <ArrowRight size={16} className="input-icon" aria-hidden="true" />
              : <ArrowLeft size={16} className="input-icon" aria-hidden="true" />}
            <input
              id="reg-position"
              type="text"
              value={`${formData.position} Leg`}
              readOnly
              aria-readonly="true"
              tabIndex={-1}
              className="form-input has-trailing"
              style={{ paddingLeft: 38, fontWeight: 600 }}
            />
            <Lock size={14} aria-hidden="true" style={{ position: 'absolute', right: 12, color: 'var(--text-light)' }} />
          </div>
        </Field>
      </div>

      {error && (
        <Alert tone="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <h2 className="auth-section-title">Personal information</h2>

        <Field label="Full name" required htmlFor="reg-name">
          <div className="input-with-icon">
            <User size={16} className="input-icon" aria-hidden="true" />
            <input
              id="reg-name"
              type="text"
              required
              autoComplete="name"
              placeholder="e.g. Ramesh Sharma"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
            />
          </div>
        </Field>

        <div className="fullreg-grid-2">
          <Field
            label="Mobile number"
            required
            htmlFor="reg-mobile"
            hint={<span style={{ color: formData.mobile.length === 10 ? 'var(--success)' : undefined }}>{formData.mobile.length}/10 digits</span>}
          >
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <select
                aria-label="Country code"
                value={formData.countryCode}
                onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                className="form-select"
                style={{ width: 96, flexShrink: 0 }}
              >
                <option value="+91">+91 IN</option>
                <option value="+1">+1 US</option>
                <option value="+44">+44 UK</option>
                <option value="+971">+971 AE</option>
                <option value="+65">+65 SG</option>
                <option value="+61">+61 AU</option>
                <option value="+966">+966 SA</option>
                <option value="+977">+977 NP</option>
                <option value="+880">+880 BD</option>
              </select>
              <div className="input-with-icon">
                <Phone size={15} className="input-icon" aria-hidden="true" />
                <input
                  id="reg-mobile"
                  type="tel"
                  required
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="tel-national"
                  placeholder="10-digit mobile"
                  value={formData.mobile}
                  onChange={(e) => {
                    // Strictly reject non-numeric characters and limit to 10 digits
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, mobile: digits });
                  }}
                  className="form-input"
                />
              </div>
            </div>
          </Field>

          <Field label="Email address" required htmlFor="reg-email">
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" aria-hidden="true" />
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="form-input"
              />
            </div>
          </Field>
        </div>

        <h2 className="auth-section-title">Account password</h2>

        <div className="fullreg-grid-2">
          <Field label="Password" required htmlFor="reg-password" hint="At least 6 characters">
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" aria-hidden="true" />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="form-input has-trailing"
              />
              {togglePassword(showPassword, setShowPassword)}
            </div>
          </Field>

          <Field label="Confirm password" required htmlFor="reg-confirm">
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" aria-hidden="true" />
              <input
                id="reg-confirm"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="form-input has-trailing"
              />
              {togglePassword(showConfirmPassword, setShowConfirmPassword)}
            </div>
          </Field>
        </div>

        <h2 className="auth-section-title">
          Nominee <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)' }}>(optional)</span>
        </h2>

        <div className="fullreg-grid-3">
          <Field label="Nominee name" htmlFor="reg-nominee-name">
            <div className="input-with-icon">
              <UserRound size={16} className="input-icon" aria-hidden="true" />
              <input
                id="reg-nominee-name"
                type="text"
                maxLength={100}
                placeholder="Full name"
                value={formData.nomineeName}
                onChange={(e) => setFormData({ ...formData, nomineeName: e.target.value })}
                className="form-input"
              />
            </div>
          </Field>

          <Field label="Nominee phone" htmlFor="reg-nominee-phone">
            <div className="input-with-icon">
              <Phone size={15} className="input-icon" aria-hidden="true" />
              <input
                id="reg-nominee-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile"
                value={formData.nomineePhone}
                onChange={(e) => setFormData({ ...formData, nomineePhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                className="form-input"
              />
            </div>
          </Field>

          <Field label="Nominee age" htmlFor="reg-nominee-age">
            <input
              id="reg-nominee-age"
              type="text"
              inputMode="numeric"
              maxLength={3}
              placeholder="e.g. 45"
              value={formData.nomineeAge}
              onChange={(e) => setFormData({ ...formData, nomineeAge: e.target.value.replace(/\D/g, '').slice(0, 3) })}
              className="form-input"
            />
          </Field>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={formData.agreeTerms}
            onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
          />
          <span>
            I agree to the <strong>Terms &amp; Conditions</strong>, Privacy Policy and MLM Code of Ethics, and confirm
            that the details above are true and accurate.
          </span>
        </label>

        <div className="form-actions" style={{ marginTop: 0 }}>
          <button type="button" onClick={onBackToPreReg} disabled={loading} className="btn btn-secondary btn-lg">
            <ArrowLeft size={16} aria-hidden="true" />
            Back
          </button>
          <button type="submit" disabled={loading || !formData.agreeTerms} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
            {loading ? (
              <>
                <span className="spinner spinner-sm spinner-inverse" aria-hidden="true" />
                Creating account…
              </>
            ) : (
              'Complete registration'
            )}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
};
