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

  const displayName =
    user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || (isSuperAdmin ? 'Super Admin' : 'Member');
  const isActiveStatus = user?.status?.toLowerCase() === 'active' || Boolean(user?.isActive);
  const fullAddress = [user?.address, user?.city, user?.state, user?.pincode].filter(Boolean).join(', ');

  const contactFields: Array<{ label: string; value: string; icon?: React.ElementType; wide?: boolean }> = [
    { label: 'Email Address', value: user?.email || 'Not specified', icon: Mail },
    { label: 'Mobile Number', value: user?.mobile || user?.phone || 'Not specified', icon: Phone },
    { label: 'Gender', value: user?.gender || 'Not specified' },
    { label: 'Date of Birth', value: user?.dob || 'Not specified', icon: Calendar },
    { label: 'Residential Address', value: fullAddress || 'Not specified', icon: MapPin, wide: true },
    { label: 'PAN Number', value: user?.panNumber || 'Not submitted', icon: CreditCard },
    {
      label: 'Aadhaar Number',
      value: user?.aadhaarNumber ? `•••• •••• ${user.aadhaarNumber.slice(-4)}` : 'Not submitted',
      icon: FileText,
    },
  ];

  return (
    <div className="page-body profile-page">
      {/* Page header */}
      <header className="profile-page-header">
        <h1 className="page-title">Member Profile & Referral Center</h1>
        <p className="page-subtitle">
          Manage your account details and share your personal referral link to build your team.
        </p>
      </header>

      {/* 1. Refer & Grow */}
      <section className="profile-referral-card" aria-labelledby="profile-referral-title">
        <div className="profile-referral-head">
          <div className="profile-referral-intro">
            <span className="profile-referral-badge">
              <Sparkles size={14} aria-hidden="true" />
              {isSuperAdmin ? 'SUPER ADMIN REFERRAL' : 'REFERRAL PROGRAM'}
            </span>
            <h2 className="profile-referral-title" id="profile-referral-title">
              Refer & Grow Your Network
            </h2>
            <p className="profile-referral-desc">
              Invite new members using your personal referral link. When they register, our extreme outer-leg engine
              automatically places them in your binary tree downline!
            </p>
            {isSuperAdmin && (
              <div className="profile-company-note">
                <ShieldCheck size={15} aria-hidden="true" />
                <span>
                  <strong>Company Mode:</strong> Your link enrolls distributors directly under Sponsor ID{' '}
                  <strong>{memberId}</strong>.
                </span>
              </div>
            )}
          </div>

          <div className="profile-sponsor-box">
            <span className="profile-sponsor-label">{isSuperAdmin ? 'Company Sponsor ID' : 'Your Sponsor ID'}</span>
            <span className="profile-sponsor-id">{memberId}</span>
          </div>
        </div>

        <h3 className="profile-links-heading">Your Referral Links</h3>
        <div className="profile-links-list">
          {referralLinks.map((link) => {
            const isCopied = copiedLeg === link.leg;
            const LegIcon = link.leg === 'LEFT' ? ArrowLeft : link.leg === 'RIGHT' ? ArrowRight : Share2;

            return (
              <div key={link.leg} className="profile-link-row">
                <div className="profile-link-meta">
                  <span className="profile-link-icon" aria-hidden="true">
                    <LegIcon size={15} />
                  </span>
                  <div className="profile-link-text">
                    <div className="profile-link-title">{link.title}</div>
                    <div className="profile-link-desc">{link.description}</div>
                  </div>
                </div>

                <div className="profile-link-body">
                  <code className="profile-link-url">{link.url}</code>

                  <div className="profile-link-actions">
                    <button
                      type="button"
                      className={`profile-link-btn is-copy ${isCopied ? 'is-copied' : ''}`}
                      onClick={() => handleCopyLink(link.leg, link.url)}
                      aria-label={`Copy ${link.title}`}
                    >
                      {isCopied ? <Check size={15} /> : <Copy size={15} />}
                      <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                    </button>

                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="profile-link-btn is-ghost"
                      title={`Open ${link.title}`}
                      aria-label={`Open ${link.title}`}
                    >
                      <ExternalLink size={15} />
                    </a>

                    <button
                      type="button"
                      className="profile-link-btn is-whatsapp"
                      onClick={() => handleShareWhatsApp(link.url)}
                      title="Share on WhatsApp"
                      aria-label={`Share ${link.title} on WhatsApp`}
                    >
                      <MessageCircle size={15} />
                      <span className="profile-link-btn-label">WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      className="profile-link-btn is-telegram"
                      onClick={() => handleShareTelegram(link.url)}
                      title="Share on Telegram"
                      aria-label={`Share ${link.title} on Telegram`}
                    >
                      <Send size={15} />
                      <span className="profile-link-btn-label">Telegram</span>
                    </button>

                    <button
                      type="button"
                      className="profile-link-btn is-ghost"
                      onClick={() => handleNativeShare(link.leg, link.url)}
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
      </section>

      {/* 2. Account summary & contact details */}
      <div className="profile-details-grid">
        <section className="profile-card" aria-labelledby="profile-account-title">
          <div className="profile-identity">
            <div className="profile-avatar" aria-hidden="true">
              {(user?.name || user?.firstName || 'M').charAt(0).toUpperCase()}
            </div>
            <div className="profile-identity-text">
              <h3 className="profile-identity-name" id="profile-account-title">
                {displayName}
              </h3>
              <span className="profile-identity-id">
                {isSuperAdmin ? 'Platform Owner (Super Admin)' : `ID: ${memberId}`}
              </span>
            </div>
          </div>

          <dl className="profile-summary-list">
            <div className="profile-summary-row">
              <dt>Account Status</dt>
              <dd>
                <span className={`profile-status-pill ${isSuperAdmin ? 'is-info' : isActiveStatus ? 'is-success' : 'is-warning'}`}>
                  {isSuperAdmin ? 'Super Admin' : user?.status ? user.status.toLowerCase() : 'Active'}
                </span>
              </dd>
            </div>
            <div className="profile-summary-row">
              <dt>Current Rank</dt>
              <dd>{isSuperAdmin ? 'Company Administrator' : user?.rank || 'Distributor'}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>Active Package</dt>
              <dd>{isSuperAdmin ? 'Executive Management' : user?.packageName || 'Basic Package'}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>{isSuperAdmin ? 'Company Sponsor ID' : 'Sponsor ID'}</dt>
              <dd>{isSuperAdmin ? rootSponsorId : user?.sponsorId || 'None (Root Member)'}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>Binary Active</dt>
              <dd>
                <span className={`profile-status-pill ${user?.isBinaryActive ? 'is-success' : 'is-muted'}`}>
                  {user?.isBinaryActive ? 'Qualified (100+ BV)' : 'Needs 100 BV'}
                </span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="profile-card" aria-labelledby="profile-contact-title">
          <h3 className="profile-card-title" id="profile-contact-title">
            Contact & Identity Details
          </h3>

          <dl className="profile-contact-grid">
            {contactFields.map((field) => {
              const Icon = field.icon;
              return (
                <div key={field.label} className={`profile-contact-field ${field.wide ? 'is-wide' : ''}`}>
                  <dt>{field.label}</dt>
                  <dd>
                    {Icon && <Icon size={15} aria-hidden="true" />}
                    <span>{field.value}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      </div>
    </div>
  );
};
