import React, { useState, useEffect } from 'react';
import { X, UserPlus, CheckCircle2, Lock, Eye, EyeOff, Mail, Phone, Calendar, User, AlertCircle, Sparkles, ArrowLeft, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (member: any) => Promise<void> | void;
  user?: any;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({ isOpen, onClose, onAddMember, user }) => {
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin';
  const [formData, setFormData] = useState({
    name: '',
    countryCode: '+91',
    mobile: '',
    email: '',
    dob: '',
    gender: 'Male',
    address: '',
    state: '',
    city: '',
    pincode: '',
    panNumber: '',
    aadhaarNumber: '',
    password: '',
    confirmPassword: '',
    sponsorId: user?.memberId || '',
    position: 'LEFT',
  });

  const [isFirstMember, setIsFirstMember] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Check if any members exist in the system to adapt root registration
      api.getMembers().then((members) => {
        if (Array.isArray(members) && members.length === 0) {
          setIsFirstMember(true);
        } else {
          setIsFirstMember(false);
        }
      }).catch(() => {
        setIsFirstMember(false);
      });

      if (user?.memberId && !formData.sponsorId) {
        setFormData((prev) => ({
          ...prev,
          sponsorId: user.memberId,
        }));
      }
    }
  }, [isOpen, user?.memberId]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Please provide full name.');
      return;
    }

    const cleanMobile = formData.mobile.trim();
    if (!cleanMobile) {
      setError('Please provide 10-digit mobile number.');
      return;
    }

    if (!/^\d+$/.test(cleanMobile)) {
      setError('Mobile number must contain digits only. Non-numeric characters and letters are not allowed.');
      return;
    }

    if (cleanMobile.length !== 10) {
      setError('Mobile number must contain exactly 10 digits.');
      return;
    }

    if (!formData.email.trim()) {
      setError('Please provide email address.');
      return;
    }

    if (formData.aadhaarNumber && formData.aadhaarNumber.trim()) {
      const cleanAadhaar = formData.aadhaarNumber.trim().replace(/\s+/g, '');
      if (!/^\d+$/.test(cleanAadhaar) || /[^\d\s]/.test(formData.aadhaarNumber)) {
        setError('Aadhaar number must contain digits only. Letters and special characters are not allowed.');
        return;
      }
      if (cleanAadhaar.length !== 12) {
        setError('Aadhaar number must contain exactly 12 digits.');
        return;
      }
    }

    if (!isFirstMember && !formData.sponsorId.trim()) {
      setError('Please enter Sponsor ID (e.g. ADMIN or an existing Member ID).');
      return;
    }

    if (!formData.password) {
      setError('Please set a password.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    try {
      setLoading(true);

      const payload: any = {
        name: formData.name.trim(),
        countryCode: formData.countryCode,
        mobile: cleanMobile,
        email: formData.email.trim(),
        dob: formData.dob ? formData.dob.trim() : undefined,
        gender: formData.gender,
        address: formData.address.trim() || undefined,
        state: formData.state.trim() || undefined,
        city: formData.city.trim() || undefined,
        pincode: formData.pincode.trim() || undefined,
        panNumber: formData.panNumber.trim().toUpperCase() || undefined,
        aadhaarNumber: formData.aadhaarNumber ? formData.aadhaarNumber.trim().replace(/\s+/g, '') : undefined,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        sponsorId: formData.sponsorId ? formData.sponsorId.trim().toUpperCase() : (isFirstMember ? 'ADMIN' : ''),
        position: formData.position.toUpperCase(),
      };

      await onAddMember(payload);
    } catch (err: any) {
      setError(err.message || 'Failed to register member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '16px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '580px',
        maxWidth: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: '28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#eff6ff',
              color: '#1d72fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserPlus size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Add New Member</h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '3px 0 0 0' }}>Register a new member with login credentials & binary placement.</p>
            </div>
          </div>

          <button onClick={onClose} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}>
            <X size={20} />
          </button>
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
            marginBottom: '18px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* First Member Root Notice */}
        {isFirstMember && (
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '18px'
          }}>
            <Sparkles size={16} style={{ flexShrink: 0, color: '#059669' }} />
            <span>
              <strong>First Member (Root Node):</strong> No members exist yet. This person will be created as the Root Member of the entire tree. Root node has no sponsor ID.
            </span>
          </div>
        )}

        {/* Regular Member Approval Notice */}
        {!isAdmin && (
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1e40af',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '18px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>Approval Workflow:</strong> New members registered from your portal are submitted to the Super Admin panel. They will appear in your member list and will be activated in the binary tree once approved.
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Full Name */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Full Name *
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                required
                placeholder="Enter full name (e.g. Rohit Sharma)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              />
            </div>
          </div>

          {/* Mobile & Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  Mobile Number * (Unique)
                </label>
                <span style={{ fontSize: '10.5px', color: formData.mobile.length === 10 ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
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
                    padding: '9px 6px',
                    border: 'none',
                    borderRight: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: '#1e293b',
                    outline: 'none',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+65">🇸🇬 +65</option>
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+966">🇸🇦 +966</option>
                  <option value="+977">🇳🇵 +977</option>
                  <option value="+880">🇧🇩 +880</option>
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
                      // Reject non-numeric characters and cap at 10 digits
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, mobile: digits });
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 10px 9px 30px',
                      border: 'none',
                      fontSize: '12.5px',
                      outline: 'none',
                      letterSpacing: '0.5px'
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Email Address * (Unique)
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="email"
                  required
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Date of Birth & Gender */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
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

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Gender
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

          {/* Address & City/State */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Address & State/City (Optional)
            </label>
            <input
              type="text"
              placeholder="Street Address, City, State, PIN"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', marginBottom: '8px' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input
                type="text"
                placeholder="PAN Card Number"
                value={formData.panNumber}
                onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
              <div>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="12-digit Aadhaar Number (Optional)"
                  value={formData.aadhaarNumber}
                  onChange={(e) => {
                    // Reject non-numeric characters and limit to 12 digits
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                    setFormData({ ...formData, aadhaarNumber: digits });
                  }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
                {formData.aadhaarNumber && (
                  <span style={{ fontSize: '10.5px', color: formData.aadhaarNumber.length === 12 ? '#10b981' : '#f59e0b', display: 'block', marginTop: '3px' }}>
                    {formData.aadhaarNumber.length}/12 digits
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Password & Confirm Password */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Password *
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Set a strong password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{ width: '100%', padding: '10px 36px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
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
                  style={{ width: '100%', padding: '10px 36px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
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

          {/* Sponsor ID & Directional Placement Leg */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Sponsor ID {isFirstMember ? <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>(None - Root Node)</span> : '*'}
                {!isFirstMember && <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}> (Existing Member ID, e.g. MEM0001)</span>}
              </label>
              <input
                type="text"
                disabled={isFirstMember}
                required={!isFirstMember}
                placeholder={isFirstMember ? "None (Root member has no sponsor)" : "Enter existing Member ID (e.g. MEM0001)"}
                value={isFirstMember ? "" : formData.sponsorId}
                onChange={(e) => setFormData({ ...formData, sponsorId: e.target.value.toUpperCase() })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  background: isFirstMember ? '#f8fafc' : '#ffffff'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Placement Leg *
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, position: 'LEFT' })}
                  style={{
                    flex: 1,
                    padding: '9px 10px',
                    borderRadius: '8px',
                    border: formData.position === 'LEFT' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: formData.position === 'LEFT' ? '#eff6ff' : '#f8fafc',
                    color: formData.position === 'LEFT' ? '#1d4ed8' : '#64748b',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ArrowLeft size={15} />
                  <span>LEFT Leg</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, position: 'RIGHT' })}
                  style={{
                    flex: 1,
                    padding: '9px 10px',
                    borderRadius: '8px',
                    border: formData.position === 'RIGHT' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: formData.position === 'RIGHT' ? '#eff6ff' : '#f8fafc',
                    color: formData.position === 'RIGHT' ? '#1d4ed8' : '#64748b',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>RIGHT Leg</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>



          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
            <button type="button" onClick={onClose} className="outline-btn" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{loading ? 'Registering...' : 'Register Member'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
