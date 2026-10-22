import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, Badge, Field } from '../components/ui';

interface PreRegistrationPageProps {
  onProceed: (data: { sponsorId: string; sponsorName: string; position: 'LEFT' | 'RIGHT' }) => void;
  onGoToLogin: () => void;
}

export const PreRegistrationPage: React.FC<PreRegistrationPageProps> = ({ onProceed, onGoToLogin }) => {
  const urlParams = new URLSearchParams(window.location.search);
  const refFromUrl = urlParams.get('ref') || urlParams.get('sponsorId') || urlParams.get('sponsor') || '';
  const legFromUrl = (urlParams.get('leg') || urlParams.get('position') || 'LEFT').toUpperCase();
  // A referral link fixes the sponsor; a leg-specific link (…&leg=LEFT|RIGHT) also fixes the position
  const isReferralLink = Boolean(refFromUrl.trim());
  const isLegLocked = isReferralLink && Boolean(urlParams.get('leg') || urlParams.get('position'));

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

    let targetLookupId = cleanId;
    if (cleanId === 'ADMIN' || cleanId === 'SUPERADMIN') {
      targetLookupId = 'MEM0001';
      setSponsorId('MEM0001');
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.lookupSponsor(targetLookupId);
      if (res.status && res.data && res.data.canRefer === false) {
        // Only binary-active members can refer new members
        setSponsorId(res.data.memberId);
        setError(res.data.referralBlockedReason || 'This sponsor cannot refer new members yet.');
        setIsVerified(false);
        setSponsorName(null);
      } else if (res.status && res.data) {
        setSponsorId(res.data.memberId);
        setSponsorName(res.data.name);
        setIsVerified(true);
      } else {
        setError(
          isReferralLink
            ? `This referral link is not valid (Sponsor ID "${cleanId}" was not found). Please ask your sponsor for a new link.`
            : res.message || `Sponsor ID "${cleanId}" not found.`
        );
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
    <AuthLayout
      eyebrow="Step 1 of 2"
      title="Join Panchveda"
      subtitle="Confirm your sponsor and choose your placement leg."
      footer={
        <>
          Already a member?{' '}
          <button type="button" className="link-btn" onClick={onGoToLogin}>
            Sign in
          </button>
        </>
      }
    >
      {error && (
        <Alert tone="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <Field
          label="Sponsor ID"
          required
          htmlFor="prereg-sponsor"
          hint={isReferralLink ? 'Set by your referral link.' : undefined}
        >
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <div className="input-with-icon" style={{ flex: 1 }}>
              <input
                id="prereg-sponsor"
                type="text"
                required
                placeholder="e.g. MEM0001"
                value={sponsorId}
                readOnly={isReferralLink}
                aria-readonly={isReferralLink}
                onChange={(e) => {
                  if (isReferralLink) return;
                  setSponsorId(e.target.value.toUpperCase());
                  setIsVerified(false);
                  setSponsorName(null);
                }}
                className="form-input has-trailing"
                style={{ fontWeight: 600, letterSpacing: '0.04em', borderColor: isVerified ? 'var(--success)' : undefined }}
              />
              {isVerified ? (
                <CheckCircle2 size={18} aria-label="Verified" style={{ position: 'absolute', right: 12, color: 'var(--success)' }} />
              ) : isReferralLink && (
                <Lock size={16} aria-hidden="true" style={{ position: 'absolute', right: 12, color: 'var(--text-light)' }} />
              )}
            </div>

            {!isVerified && !isReferralLink && (
              <button
                type="button"
                onClick={handleManualVerify}
                disabled={loading || !sponsorId.trim()}
                className="btn btn-secondary btn-lg"
              >
                {loading ? 'Verifying…' : 'Verify'}
              </button>
            )}
          </div>
        </Field>

        {isVerified && sponsorName && (
          <div className="verified-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
              <ShieldCheck size={20} aria-hidden="true" />
              <div style={{ minWidth: 0 }}>
                <div className="verified-card-label">Verified sponsor</div>
                <div className="verified-card-name">{sponsorName}</div>
              </div>
            </div>
            <Badge tone="success">{sponsorId}</Badge>
          </div>
        )}

        <Field
          label={isLegLocked ? 'Placement leg (set by your referral link)' : 'Placement leg'}
          required={!isLegLocked}
          hint={
            <>
              You will be placed on the extreme {position.toLowerCase()} branch of sponsor{' '}
              <strong>{sponsorId || 'selected'}</strong>.
            </>
          }
        >
          <div className="choice-grid" role="radiogroup" aria-label="Placement leg">
            {(['LEFT', 'RIGHT'] as const).map((leg) => (
              <button
                key={leg}
                type="button"
                role="radio"
                aria-checked={position === leg}
                onClick={() => setPosition(leg)}
                disabled={isLegLocked && position !== leg}
                className={`choice-card${position === leg ? ' is-selected' : ''}`}
              >
                {leg === 'LEFT' && <ArrowLeft size={18} aria-hidden="true" />}
                <span>{leg === 'LEFT' ? 'Left leg' : 'Right leg'}</span>
                {leg === 'RIGHT' && <ArrowRight size={18} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </Field>

        <button
          type="submit"
          disabled={!isVerified || loading}
          className="btn btn-primary btn-lg btn-block"
          style={{ marginTop: 'var(--space-2)' }}
        >
          Continue to registration
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
    </AuthLayout>
  );
};
