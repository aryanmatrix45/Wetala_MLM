import React, { useState } from 'react';
import {
  User, Mail, Phone, Lock, Eye, EyeOff, MapPin, Calendar, CreditCard,
  FileText, CheckCircle2, AlertCircle, ArrowLeft,
  CheckSquare, Square
} from 'lucide-react';
import { api } from '../services/api';

interface FullRegistrationPageProps {
  initialData: {
    sponsorId: string;
    sponsorName: string;
    position: 'LEFT' | 'RIGHT';
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
    sponsorId: initialData.sponsorId,
    sponsorName: initialData.sponsorName,
    position: initialData.position,
    name: '',
    countryCode: '+91',
    mobile: '',
    gender: 'Male',
    dob: '',
    email: '',
    address: '',
    state: '',
    city: '',
    pincode: '',
    panNumber: '',
    aadhaarNumber: '',
    password: '',
    confirmPassword: '',
    agreeTerms: true,
  });

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
      setError('Please provide a valid Email Address.');
      return;
    }

    if (!formData.address.trim()) {
      setError('Please provide your complete Residential Address.');
      return;
    }

    if (!formData.state.trim() || !formData.city.trim() || !formData.pincode.trim()) {
      setError('Please provide State, City, and 6-digit Pin Code.');
      return;
    }

    // Aadhaar Validation: If provided, must be strictly 12 numeric digits
    if (formData.aadhaarNumber && formData.aadhaarNumber.trim()) {
      const cleanAadhaar = formData.aadhaarNumber.trim().replace(/\s+/g, '');
      if (!/^\d+$/.test(cleanAadhaar) || /[^\d\s]/.test(formData.aadhaarNumber)) {
        setError('Aadhaar Number must contain digits only. Letters and special characters are not allowed.');
        return;
      }
      if (cleanAadhaar.length !== 12) {
        setError('Aadhaar Number must contain exactly 12 digits.');
        return;
      }
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Password and Confirm Password do not match.');
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
        gender: formData.gender,
        dob: formData.dob ? formData.dob.trim() : undefined,
        address: formData.address.trim(),
        state: formData.state.trim(),
        city: formData.city.trim(),
        pincode: formData.pincode.trim(),
        panNumber: formData.panNumber ? formData.panNumber.trim().toUpperCase() : undefined,
        aadhaarNumber: formData.aadhaarNumber ? formData.aadhaarNumber.trim().replace(/\s+/g, '') : undefined,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        sponsorId: formData.sponsorId,
        position: formData.position,
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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #090e1a 0%, #0f172a 50%, #1e293b 100%)',
        padding: '24px'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '560px',
          maxWidth: '100%',
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: '#ecfdf5',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.3)'
          }}>
            <CheckCircle2 size={40} />
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
            Registration Successful!
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px 0' }}>
            Welcome to the team, <strong>{successResult.name}</strong>! Your account has been registered with binary placement.
          </p>

          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '20px',
            marginBottom: '28px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Assigned Member ID:</span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#1d72fe', letterSpacing: '0.5px' }}>
                {successResult.memberId}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Sponsor:</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {formData.sponsorName} ({formData.sponsorId})
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Placement Leg:</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {formData.position} Leg
              </span>
            </div>
          </div>

          <button
            onClick={onGoToLogin}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #1d72fe 0%, #155dfc 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              boxShadow: '0 10px 20px -5px rgba(29, 114, 254, 0.4)'
            }}
          >
            Proceed to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #090e1a 0%, #0f172a 50%, #1e293b 100%)',
      padding: '36px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        width: '780px',
        maxWidth: '100%',
        padding: '36px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Navigation & Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={onBackToPreReg}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#475569',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={16} />
            <span>Change Sponsor / Leg</span>
          </button>

          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Step 2 of 2: Member Details
          </span>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
            New Member Registration
          </h1>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
            Fill in your personal, address, and login credentials to register.
          </p>
        </div>

        {/* Sponsor & Leg Summary Card (Locked) */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '14px',
          padding: '14px 18px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '24px'
        }}>
          <div>
            <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>
              Sponsor Details
            </span>
            <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#1e3a8a' }}>
              {formData.sponsorName}
            </div>
            <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 600 }}>
              ID: {formData.sponsorId}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>
              Binary Placement
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{
                background: '#1d72fe',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 800
              }}>
                {formData.position} Leg
              </span>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                (Extreme Outer Spillover)
              </span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Full Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section 1: Personal Details */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              1. Personal Information
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Full Name *
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    required
                    placeholder="Enter full name (e.g. Ramesh Sharma)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Gender *
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff' }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Mobile Number *
                  </label>
                  <span style={{ fontSize: '11px', color: formData.mobile.length === 10 ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
                    {formData.mobile.length}/10 digits
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  overflow: 'hidden',
                  background: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}>
                  <select
                    value={formData.countryCode}
                    onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                    style={{
                      padding: '10px 8px',
                      border: 'none',
                      borderRight: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#1e293b',
                      outline: 'none',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <option value="+91">🇮🇳 +91 (India)</option>
                    <option value="+1">🇺🇸 +1 (US)</option>
                    <option value="+44">🇬🇧 +44 (UK)</option>
                    <option value="+971">🇦🇪 +971 (UAE)</option>
                    <option value="+65">🇸🇬 +65 (SG)</option>
                    <option value="+61">🇦🇺 +61 (AU)</option>
                    <option value="+966">🇸🇦 +966 (SA)</option>
                    <option value="+977">🇳🇵 +977 (NP)</option>
                    <option value="+880">🇧🇩 +880 (BD)</option>
                  </select>
                  <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                    <Phone size={15} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="10 digit mobile"
                      value={formData.mobile}
                      onChange={(e) => {
                        // Strictly reject non-numeric characters and limit to 10 digits
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({ ...formData, mobile: digits });
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 32px',
                        border: 'none',
                        fontSize: '13px',
                        outline: 'none',
                        letterSpacing: '0.5px'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Email Address *
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="email"
                    required
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Date of Birth (Optional)
                </label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9' }} />

          {/* Section 2: Address Details */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              2. Residential Address
            </h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Complete Address *
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  required
                  placeholder="House No, Street, Landmark, Area"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  State *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maharashtra"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  City *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mumbai"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Pin Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="6-digit PIN"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9' }} />

          {/* Section 3: Identity & KYC Details */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              3. Identity Details (KYC)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  PAN Card Number (Optional)
                </label>
                <div style={{ position: 'relative' }}>
                  <CreditCard size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="e.g. ABCDE1234F"
                    value={formData.panNumber}
                    onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                    style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Aadhaar Number (12 Digits)
                  </label>
                  {formData.aadhaarNumber && (
                    <span style={{ fontSize: '11px', color: formData.aadhaarNumber.length === 12 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                      {formData.aadhaarNumber.length}/12 digits
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <FileText size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="12-digit Aadhaar number"
                    value={formData.aadhaarNumber}
                    onChange={(e) => {
                      // Strictly reject letters and special characters on typing
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                      setFormData({ ...formData, aadhaarNumber: digits });
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      letterSpacing: '1px'
                    }}
                  />
                </div>
                {formData.aadhaarNumber && formData.aadhaarNumber.length > 0 && formData.aadhaarNumber.length < 12 && (
                  <span style={{ fontSize: '11px', color: '#f59e0b', display: 'block', marginTop: '4px', fontWeight: 500 }}>
                    Must be exactly 12 digits ({12 - formData.aadhaarNumber.length} more needed)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9' }} />

          {/* Section 4: Login Password */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              4. Account Password
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Set a strong password (min 6 chars)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{ width: '100%', padding: '10px 38px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Confirm Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    style={{ width: '100%', padding: '10px 38px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Terms & Conditions Checkbox */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: '#f8fafc',
            padding: '14px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            marginTop: '4px'
          }}>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, agreeTerms: !formData.agreeTerms })}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: formData.agreeTerms ? '#1d72fe' : '#94a3b8', marginTop: '1px' }}
            >
              {formData.agreeTerms ? <CheckSquare size={19} /> : <Square size={19} />}
            </button>
            <label style={{ fontSize: '12.5px', color: '#334155', cursor: 'pointer', lineHeight: '1.4' }}>
              I agree to the <strong>Terms & Conditions</strong>, Privacy Policy, and MLM Code of Ethics. I confirm that all the personal and KYC details provided above are true and accurate.
            </label>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onBackToPreReg}
              disabled={loading}
              style={{
                padding: '13px 20px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontWeight: 600,
                fontSize: '13.5px',
                cursor: 'pointer'
              }}
            >
              Back
            </button>

            <button
              type="submit"
              disabled={loading || !formData.agreeTerms}
              style={{
                flex: 1,
                padding: '13px',
                borderRadius: '10px',
                background: formData.agreeTerms ? 'linear-gradient(135deg, #1d72fe 0%, #155dfc 100%)' : '#cbd5e1',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '14.5px',
                cursor: formData.agreeTerms ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: formData.agreeTerms ? '0 10px 20px -5px rgba(29, 114, 254, 0.4)' : 'none'
              }}
            >
              <CheckCircle2 size={18} />
              <span>{loading ? 'Submitting Registration...' : 'Complete Registration'}</span>
            </button>
          </div>
        </form>

        {/* Existing Member Link */}
        <div style={{ textAlign: 'center', marginTop: '22px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Already have an active account?{' '}
            <button
              onClick={onGoToLogin}
              style={{
                background: 'none',
                border: 'none',
                color: '#1d72fe',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline'
              }}
            >
              Sign In Here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
