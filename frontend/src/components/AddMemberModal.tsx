import React, { useState, useEffect } from 'react';
import { X, UserPlus, CheckCircle2, Lock, Eye, EyeOff, Mail, Phone, Calendar, User, AlertCircle } from 'lucide-react';
import { api, type PackageItem } from '../services/api';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (member: any) => Promise<void> | void;
  user?: any;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({ isOpen, onClose, onAddMember, user }) => {
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin';
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [placementMode, setPlacementMode] = useState<'auto' | 'manual'>('auto');
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    dob: '',
    password: '',
    confirmPassword: '',
    sponsorId: user?.memberId || '',
    parentId: '',
    placementId: '',
    position: 'LEFT',
    package: 'Package 1',
    packageId: 'PKG-1',
  });

  useEffect(() => {
    if (isOpen) {
      if (user?.memberId && !formData.sponsorId) {
        setFormData((prev) => ({
          ...prev,
          sponsorId: user.memberId,
        }));
      }
      api.getPackages()
        .then((res) => {
          if (res.status && Array.isArray(res.data) && res.data.length > 0) {
            const activePkgs = res.data.filter((p) => p.isActive);
            setPackages(activePkgs);
            if (activePkgs.length > 0) {
              setFormData((prev) => ({
                ...prev,
                package: activePkgs[0].name,
                packageId: activePkgs[0].packageId,
              }));
            }
          }
        })
        .catch((err) => console.error('Failed to load packages in AddMemberModal:', err));
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

    if (!formData.mobile.trim()) {
      setError('Please provide 10-digit mobile number.');
      return;
    }

    if (!formData.email.trim()) {
      setError('Please provide email address.');
      return;
    }

    if (!formData.sponsorId.trim()) {
      setError('Please enter Sponsor ID (e.g. ADMIN or an existing Member ID).');
      return;
    }

    if (placementMode === 'manual') {
      if (!formData.parentId.trim()) {
        setError('Please specify Binary Parent ID for manual placement.');
        return;
      }
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
        ...formData,
        packageName: formData.package,
        packageId: formData.packageId,
        sponsorId: formData.sponsorId.trim().toUpperCase(),
      };

      if (placementMode === 'manual') {
        const cleanParent = formData.parentId.trim().toUpperCase();
        const pos = formData.position.toUpperCase();
        // Client-side quick check
        const valRes = await api.validatePlacement(cleanParent, pos);
        if (!valRes.status) {
          setError(valRes.message || `Position ${pos} under ${cleanParent} is not available.`);
          setLoading(false);
          return;
        }
        payload.parentId = cleanParent;
        payload.placementId = cleanParent;
        payload.position = pos;
      } else {
        delete payload.parentId;
        delete payload.placementId;
      }

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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Mobile Number * (Unique)
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="tel"
                  required
                  placeholder="Enter 10 digit mobile"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                />
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

          {/* Date of Birth */}
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

          {/* Sponsor ID & Placement Leg */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Sponsor ID * <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(e.g. ADMIN or Member ID)</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter Sponsor ID (ADMIN or MEM0001)"
                value={formData.sponsorId}
                onChange={(e) => setFormData({ ...formData, sponsorId: e.target.value.toUpperCase() })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Binary Placement
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPlacementMode('auto')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: placementMode === 'auto' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: placementMode === 'auto' ? '#eff6ff' : '#f8fafc',
                    color: placementMode === 'auto' ? '#1d4ed8' : '#64748b',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Auto (BFS)
                </button>
                <button
                  type="button"
                  onClick={() => setPlacementMode('manual')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: placementMode === 'manual' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: placementMode === 'manual' ? '#eff6ff' : '#f8fafc',
                    color: placementMode === 'manual' ? '#1d4ed8' : '#64748b',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  🎯 Manual
                </button>
              </div>
            </div>
          </div>

          {/* Manual Placement Details: Distinct Binary Tree Placement */}
          {placementMode === 'manual' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '12px',
              borderRadius: '8px'
            }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Binary Parent ID * <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(Under whom placed)</span>
                </label>
                <input
                  type="text"
                  required={placementMode === 'manual'}
                  placeholder="e.g. MEM0006"
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Position *
                </label>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                >
                  <option value="LEFT">LEFT Leg</option>
                  <option value="RIGHT">RIGHT Leg</option>
                </select>
              </div>
            </div>
          )}

          {/* Package Selection */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Joining Package *
            </label>
            <select
              value={formData.packageId || formData.package}
              onChange={(e) => {
                const sel = packages.find((p) => p.packageId === e.target.value || p.name === e.target.value);
                setFormData({
                  ...formData,
                  packageId: sel ? sel.packageId : e.target.value,
                  package: sel ? sel.name : e.target.value,
                });
              }}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
            >
              {packages.length > 0 ? (
                packages.map((pkg) => (
                  <option key={pkg.packageId} value={pkg.packageId}>
                    {pkg.name} (₹ {pkg.price.toLocaleString()} — {pkg.bv.toLocaleString()} BV | {pkg.rp || 1} RP | Cap: ₹{(pkg.dailyCapping || 4000).toLocaleString()})
                  </option>
                ))
              ) : (
                <>
                  <option value="PKG-1">Package 1 (₹ 3,000 — 1,250 BV | 1 RP)</option>
                  <option value="PKG-2">Package 2 (₹ 6,500 — 2,500 BV | 2 RP)</option>
                  <option value="PKG-3">Package 3 (₹ 15,000 — 5,000 BV | 4 RP)</option>
                  <option value="PKG-4">Package 4 (₹ 35,000 — 10,000 BV | 8 RP)</option>
                </>
              )}
            </select>
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
