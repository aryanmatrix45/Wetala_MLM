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
  const baseUrl = window.location.origin;

  const [selectedLegLink, setSelectedLegLink] = useState<'AUTO' | 'LEFT' | 'RIGHT'>('AUTO');
  const [copied, setCopied] = useState(false);

  // Generate dynamic referral link based on selected leg
  const getReferralUrl = () => {
    let url = `${baseUrl}/pre-registration?ref=${encodeURIComponent(memberId)}`;
    if (selectedLegLink === 'LEFT') url += '&leg=LEFT';
    if (selectedLegLink === 'RIGHT') url += '&leg=RIGHT';
    return url;
  };

  const currentLink = getReferralUrl();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = `Join my team on Panchveda Wellness! Register here: ${currentLink}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareTelegram = () => {
    const text = `Join my team on Panchveda Wellness!`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(currentLink)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Panchveda Wellness',
          text: `Join my team using Sponsor ID ${memberId}`,
          url: currentLink,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
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

        {/* Leg Target Selector Tabs */}
        <div style={{ marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', color: '#bfdbfe', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
            Choose Target Placement Leg for Link:
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedLegLink('AUTO')}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                background: selectedLegLink === 'AUTO' ? '#ffffff' : 'rgba(255, 255, 255, 0.15)',
                color: selectedLegLink === 'AUTO' ? '#1e3a8a' : '#ffffff',
                fontWeight: 700,
                fontSize: '12.5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Default (Prospect Selects Leg)
            </button>

            <button
              type="button"
              onClick={() => setSelectedLegLink('LEFT')}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                background: selectedLegLink === 'LEFT' ? '#ffffff' : 'rgba(255, 255, 255, 0.15)',
                color: selectedLegLink === 'LEFT' ? '#1e3a8a' : '#ffffff',
                fontWeight: 700,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <ArrowLeft size={14} />
              <span>Direct LEFT Leg Link</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedLegLink('RIGHT')}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                background: selectedLegLink === 'RIGHT' ? '#ffffff' : 'rgba(255, 255, 255, 0.15)',
                color: selectedLegLink === 'RIGHT' ? '#1e3a8a' : '#ffffff',
                fontWeight: 700,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>Direct RIGHT Leg Link</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Unique Referral Link Box */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '12px',
          padding: '8px 12px 8px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <span style={{
            fontSize: '13.5px',
            color: '#e2e8f0',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            flex: 1
          }}>
            {currentLink}
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCopyLink}
              style={{
                background: copied ? '#10b981' : '#ffffff',
                color: copied ? '#ffffff' : '#1e3a8a',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 16px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)'
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>

            <a
              href={currentLink}
              target="_blank"
              rel="noreferrer"
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '9px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none'
              }}
              title="Open pre-registration link"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        </div>

        {/* Share buttons row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#bfdbfe', fontWeight: 600 }}>Quick Share:</span>
          
          <button
            onClick={handleShareWhatsApp}
            style={{
              background: '#25d366',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MessageCircle size={15} />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handleShareTelegram}
            style={{
              background: '#229ed9',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Send size={15} />
            <span>Telegram</span>
          </button>

          <button
            onClick={handleNativeShare}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Share2 size={15} />
            <span>Share More</span>
          </button>
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
