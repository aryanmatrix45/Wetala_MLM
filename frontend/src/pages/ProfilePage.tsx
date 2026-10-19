import React, { useState, useEffect } from 'react';
import {
  Share2, Copy, Check, MessageCircle, Send, ExternalLink,
  Mail, Phone, Calendar, MapPin, CreditCard,
  FileText, Sparkles, ArrowLeft, ArrowRight, ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';

interface ProfilePageProps {
  user: any;
  token?: string | null;
  onNavigate?: (tab: string) => void;
}

type ReferralLeg = 'AUTO' | 'LEFT' | 'RIGHT';

// Referral link for a placement leg (AUTO lets the prospect choose their leg)
const getReferralUrl = (memberId: string, leg: ReferralLeg) => {
  let url = `${window.location.origin}/pre-registration?ref=${encodeURIComponent(memberId)}`;
  if (leg !== 'AUTO') url += `&leg=${leg}`;
  return url;
};

const linkActionBtn: React.CSSProperties = {
  border: 'none',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '12.5px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  transition: 'all 0.15s ease',
};

export const ProfilePage: React.FC<ProfilePageProps> = ({ user }) => {
  const isSuperAdmin = user?.role?.toLowerCase() === 'superadmin';
  const [rootSponsorId, setRootSponsorId] = useState<string>('MEM0001');

  // If logged in as Super Admin, dynamically fetch the Company Root Member ID
  useEffect(() => {
    if (isSuperAdmin) {
      api.getRootSponsor()
        .then((res: any) => {
          if (res?.data?.memberId) {
            setRootSponsorId(res.data.memberId);
          }
        })
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  // For regular members: user.memberId. For Super Admin: Company Root ID (MEM0001)
  const memberId = isSuperAdmin ? rootSponsorId : (user?.memberId || 'MEM0001');

  const [copiedLeg, setCopiedLeg] = useState<ReferralLeg | null>(null);

  const referralLinks: Array<{
    leg: ReferralLeg;
    title: string;
    description: string;
    url: string;
  }> = [
    {
      leg: 'AUTO',
      title: 'Default Link',
      description: 'New member chooses their own leg',
      url: getReferralUrl(memberId, 'AUTO'),
    },
    {
      leg: 'LEFT',
      title: 'Left Leg Link',
      description: 'Places new members in your LEFT leg',
      url: getReferralUrl(memberId, 'LEFT'),
    },
    {
      leg: 'RIGHT',
      title: 'Right Leg Link',
      description: 'Places new members in your RIGHT leg',
      url: getReferralUrl(memberId, 'RIGHT'),
    },
  ];

  const handleCopyLink = (leg: ReferralLeg, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLeg(leg);
    setTimeout(() => setCopiedLeg((current) => (current === leg ? null : current)), 2500);
  };

  const handleShareWhatsApp = (url: string) => {
    const text = `Join my team on Panchveda Wellness! Register here: ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareTelegram = (url: string) => {
    const text = `Join my team on Panchveda Wellness!`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleNativeShare = async (leg: ReferralLeg, url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Panchveda Wellness',
          text: `Join my team using Sponsor ID ${memberId}`,
          url,
        });
      } catch {
        handleCopyLink(leg, url);
      }
    } else {
      handleCopyLink(leg, url);
    }
  };

  return (
    <div className="page-body" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Top Banner / Breadcrumb */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
          Member Profile & Referral Center
        </h1>
        <p className="page-subtitle" style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
          Manage your account details and share your personal referral link to build your team.
        </p>
      </div>

      {/* 1. “REFER & GROW” HERO SECTION */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)',
        borderRadius: '20px',
        padding: '32px',
        color: '#ffffff',
        boxShadow: '0 20px 40px -10px rgba(37, 99, 235, 0.35)',
        marginBottom: '28px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background glow decoration */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(5px)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, marginBottom: '10px' }}>
              <Sparkles size={14} style={{ color: '#fbbf24' }} />
              <span>{isSuperAdmin ? 'SUPER ADMIN REFERRAL' : 'REFERRAL PROGRAM'}</span>
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
              Refer & Grow Your Network
            </h2>
            <p style={{ fontSize: '14px', color: '#bfdbfe', margin: 0, maxWidth: '620px', lineHeight: '1.5' }}>
              Invite new members using your personal referral link. When they register, our extreme outer-leg engine automatically places them in your binary tree downline!
            </p>
            {isSuperAdmin && (
              <div style={{
                marginTop: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.14)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                padding: '6px 14px',
                borderRadius: '10px',
                fontSize: '12.5px',
                color: '#e0f2fe'
              }}>
                <ShieldCheck size={15} color="#67e8f9" />
                <span>
                  <strong>Company Mode:</strong> Your link enrolls distributors directly under Sponsor ID <strong>{memberId}</strong>.
                </span>
              </div>
            )}
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(10px)',
            borderRadius: '14px',
            padding: '12px 18px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            textAlign: 'right'
          }}>
            <span style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
              {isSuperAdmin ? 'Company Sponsor ID' : 'Your Sponsor ID'}
            </span>
            <span style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.5px' }}>
              {memberId}
            </span>
          </div>
        </div>

        {/* Referral links: one row per placement leg */}
        <span style={{ fontSize: '12px', color: '#bfdbfe', fontWeight: 600, display: 'block', marginBottom: '10px' }}>
          Your Referral Links
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {referralLinks.map((link) => {
            const isCopied = copiedLeg === link.leg;
            const LegIcon = link.leg === 'LEFT' ? ArrowLeft : link.leg === 'RIGHT' ? ArrowRight : Share2;

            return (
              <div
                key={link.leg}
                style={{
                  background: 'rgba(0, 0, 0, 0.22)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                }}
              >
                {/* Row header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.16)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    <LegIcon size={15} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>{link.title}</div>
                    <div style={{ fontSize: '12px', color: '#bfdbfe' }}>{link.description}</div>
                  </div>
                </div>

                {/* URL + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      flex: '1 1 280px',
                      minWidth: 0,
                      fontSize: '13px',
                      color: '#e2e8f0',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '8px',
                      padding: '9px 12px',
                    }}
                  >
                    {link.url}
                  </span>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(link.leg, link.url)}
                      style={{
                        ...linkActionBtn,
                        background: isCopied ? '#10b981' : '#ffffff',
                        color: isCopied ? '#ffffff' : '#1e3a8a',
                        minWidth: '96px',
                      }}
                      aria-label={`Copy ${link.title}`}
                    >
                      {isCopied ? <Check size={15} /> : <Copy size={15} />}
                      <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                    </button>

                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...linkActionBtn, background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' }}
                      title={`Open ${link.title}`}
                      aria-label={`Open ${link.title}`}
                    >
                      <ExternalLink size={15} />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(link.url)}
                      style={{ ...linkActionBtn, background: '#25d366', color: '#ffffff' }}
                      title="Share on WhatsApp"
                      aria-label={`Share ${link.title} on WhatsApp`}
                    >
                      <MessageCircle size={15} />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareTelegram(link.url)}
                      style={{ ...linkActionBtn, background: '#229ed9', color: '#ffffff' }}
                      title="Share on Telegram"
                      aria-label={`Share ${link.title} on Telegram`}
                    >
                      <Send size={15} />
                      <span>Telegram</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNativeShare(link.leg, link.url)}
                      style={{ ...linkActionBtn, background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}
                      title="More sharing options"
                      aria-label={`More ways to share ${link.title}`}
                    >
                      <Share2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. MEMBER PROFILE DETAILS CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px' }}>
        {/* Left Column: Account Summary */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', paddingBottom: '18px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: '#eff6ff',
              color: '#1d72fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '20px'
            }}>
              {(user?.name || user?.firstName || 'M').charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: '0 0 2px 0' }}>
                {user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || (isSuperAdmin ? 'Super Admin' : 'Member')}
              </h3>
              <span style={{ fontSize: '13px', color: '#1d72fe', fontWeight: 700 }}>
                {isSuperAdmin ? 'Platform Owner (Super Admin)' : `ID: ${memberId}`}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Account Status</span>
              <span style={{
                background: isSuperAdmin ? '#eff6ff' : (user?.status === 'active' || user?.isActive ? '#ecfdf5' : '#fef3c7'),
                color: isSuperAdmin ? '#1d4ed8' : (user?.status === 'active' || user?.isActive ? '#065f46' : '#92400e'),
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'capitalize'
              }}>
                {isSuperAdmin ? 'Super Admin' : (user?.status || 'Active')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Current Rank</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {isSuperAdmin ? 'Company Administrator' : (user?.rank || 'Distributor')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Active Package</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {isSuperAdmin ? 'Executive Management' : (user?.packageName || 'Basic Package')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                {isSuperAdmin ? 'Company Sponsor ID' : 'Sponsor ID'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {isSuperAdmin ? rootSponsorId : (user?.sponsorId || 'None (Root Member)')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Binary Active</span>
              <span style={{
                background: user?.isBinaryActive ? '#ecfdf5' : '#f1f5f9',
                color: user?.isBinaryActive ? '#059669' : '#64748b',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 700
              }}>
                {user?.isBinaryActive ? 'Qualified (100+ BV)' : 'Needs 100 BV'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Personal & Contact Information */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 18px 0', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
            Contact & Identity Details
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            <div>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                Email Address
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>
                <Mail size={15} style={{ color: '#94a3b8' }} />
                <span>{user?.email || 'Not specified'}</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                Mobile Number
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>
                <Phone size={15} style={{ color: '#94a3b8' }} />
                <span>{user?.mobile || user?.phone || 'Not specified'}</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                Gender
              </span>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>
                {user?.gender || 'Not specified'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                Date of Birth
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>
                <Calendar size={15} style={{ color: '#94a3b8' }} />
                <span>{user?.dob || 'Not specified'}</span>
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                Residential Address
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>
                <MapPin size={15} style={{ color: '#94a3b8', flexShrink: 0 }} />
                <span>
                  {[user?.address, user?.city, user?.state, user?.pincode].filter(Boolean).join(', ') || 'Not specified'}
                </span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                PAN Number
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>
                <CreditCard size={15} style={{ color: '#94a3b8' }} />
                <span>{user?.panNumber || 'Not submitted'}</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                Aadhaar Number
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>
                <FileText size={15} style={{ color: '#94a3b8' }} />
                <span>{user?.aadhaarNumber ? `•••• •••• ${user.aadhaarNumber.slice(-4)}` : 'Not submitted'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
