import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, ShieldCheck, Users } from 'lucide-react';
import { api } from '../services/api';

interface PreRegistrationPageProps {
  onProceed: (data: { sponsorId: string; sponsorName: string; position: 'LEFT' | 'RIGHT' }) => void;
  onGoToLogin: () => void;
}

export const PreRegistrationPage: React.FC<PreRegistrationPageProps> = ({ onProceed, onGoToLogin }) => {
  const urlParams = new URLSearchParams(window.location.search);
  const refFromUrl = urlParams.get('ref') || urlParams.get('sponsorId') || urlParams.get('sponsor') || '';
  const legFromUrl = (urlParams.get('leg') || urlParams.get('position') || 'LEFT').toUpperCase();

  const [sponsorId, setSponsorId] = useState(refFromUrl.toUpperCase());
  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const [position, setPosition] = useState<'LEFT' | 'RIGHT'>(legFromUrl === 'RIGHT' ? 'RIGHT' : 'LEFT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // Auto-verify if ref is in URL
  useEffect(() => {
    if (refFromUrl.trim()) {
      verifySponsor(refFromUrl.trim());
    }
  }, [refFromUrl]);

  const verifySponsor = async (idToVerify: string) => {
    const cleanId = idToVerify.trim().toUpperCase();
    if (!cleanId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.lookupSponsor(cleanId);
      if (res.status && res.data) {
        setSponsorName(res.data.name);
        setIsVerified(true);
      } else {
        setError(res.message || `Sponsor ID "${cleanId}" not found.`);
        setIsVerified(false);
        setSponsorName(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify Sponsor ID. Please check and try again.');
      setIsVerified(false);
      setSponsorName(null);
    } finally {
      setLoading(false);
    }
  };

  const handleManualVerify = (e: React.FormEvent) => {
    e.preventDefault();
    verifySponsor(sponsorId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified || !sponsorId.trim() || !sponsorName) {
      setError('Please provide a valid verified Sponsor ID.');
      return;
    }
    onProceed({
      sponsorId: sponsorId.trim().toUpperCase(),
      sponsorName,
      position,
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #090e1a 0%, #0f172a 50%, #1e293b 100%)',
      padding: '24px',
      position: 'relative'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        width: '520px',
        maxWidth: '100%',
        padding: '36px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
        position: 'relative',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Top Brand Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: '#eff6ff',
            color: '#1d72fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 16px -4px rgba(29, 114, 254, 0.2)'
          }}>
            <Users size={32} />
          </div>
          <span style={{
            background: '#e0f2fe',
            color: '#0369a1',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '11.5px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            display: 'inline-block',
            marginBottom: '8px'
          }}>
            Member Referral Invitation
          </span>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '4px 0 6px 0' }}>
            Pre-Registration
          </h1>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
            Confirm your Sponsor and select your binary placement leg to continue.
          </p>
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

        {/* Main Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sponsor ID Input / Status */}
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
              Sponsor ID *
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  required
                  placeholder="e.g. MEM0001 or ADMIN"
                  value={sponsorId}
                  onChange={(e) => {
                    setSponsorId(e.target.value.toUpperCase());
                    setIsVerified(false);
                    setSponsorName(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: isVerified ? '2px solid #10b981' : '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 700,
                    outline: 'none',
                    letterSpacing: '0.5px',
                    background: isVerified ? '#f0fdf4' : '#fff'
                  }}
                />
                {isVerified && (
                  <CheckCircle2 size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#10b981' }} />
                )}
              </div>

              {!isVerified && (
                <button
                  type="button"
                  onClick={handleManualVerify}
                  disabled={loading || !sponsorId.trim()}
                  style={{
                    padding: '0 16px',
                    background: '#1d72fe',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: sponsorId.trim() ? 'pointer' : 'not-allowed',
                    opacity: sponsorId.trim() ? 1 : 0.6
                  }}
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
              )}
            </div>
          </div>

          {/* Verified Sponsor Name Card */}
          {isVerified && sponsorName && (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#dcfce7',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Verified Sponsor
                  </span>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#14532d' }}>
                    {sponsorName}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '12px', color: '#166534', background: '#dcfce7', padding: '3px 9px', borderRadius: '20px', fontWeight: 700 }}>
                {sponsorId}
              </span>
            </div>
          )}

          {/* Placement Direction (Left / Right Leg) */}
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
              Select Placement Leg *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setPosition('LEFT')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: position === 'LEFT' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: position === 'LEFT' ? '#eff6ff' : '#f8fafc',
                  color: position === 'LEFT' ? '#1d4ed8' : '#64748b',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
              >
                <ArrowLeft size={18} />
                <span>LEFT Leg</span>
              </button>

              <button
                type="button"
                onClick={() => setPosition('RIGHT')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: position === 'RIGHT' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: position === 'RIGHT' ? '#eff6ff' : '#f8fafc',
                  color: position === 'RIGHT' ? '#1d4ed8' : '#64748b',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>RIGHT Leg</span>
                <ArrowRight size={18} />
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 0 0' }}>
              You will be placed along the extreme {position.toLowerCase()} team branch of sponsor <strong>{sponsorId || 'selected'}</strong>.
            </p>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={!isVerified || loading}
            style={{
              padding: '14px',
              borderRadius: '12px',
              background: isVerified ? 'linear-gradient(135deg, #1d72fe 0%, #155dfc 100%)' : '#cbd5e1',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '14.5px',
              cursor: isVerified ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: isVerified ? '0 10px 20px -5px rgba(29, 114, 254, 0.4)' : 'none',
              transition: 'all 0.2s ease',
              marginTop: '4px'
            }}
          >
            <span>Proceed to Registration Form</span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Existing Member / Login Link */}
        <div style={{ textAlign: 'center', marginTop: '22px', paddingTop: '18px', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Already a registered member?{' '}
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
