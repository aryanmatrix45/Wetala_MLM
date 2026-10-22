import React, { useEffect, useState } from 'react';
import {
  Share2, Copy, Check, MessageCircle, Send, ExternalLink, Sparkles, ArrowLeft, ArrowRight, ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { Alert } from './ui';

type ReferralLeg = 'AUTO' | 'LEFT' | 'RIGHT';

// Referral link for a placement leg (AUTO lets the prospect choose their leg)
const getReferralUrl = (memberId: string, leg: ReferralLeg) => {
  let url = `${window.location.origin}/pre-registration?ref=${encodeURIComponent(memberId)}`;
  if (leg !== 'AUTO') url += `&leg=${leg}`;
  return url;
};

interface ReferralCardProps {
  memberId: string;
  isSuperAdmin: boolean;
}

export const ReferralCard: React.FC<ReferralCardProps> = ({ memberId, isSuperAdmin }) => {
  const [copiedLeg, setCopiedLeg] = useState<ReferralLeg | null>(null);
  // Members can refer once binary active; the server decides (the saved user may be out of date)
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  useEffect(() => {
    if (isSuperAdmin || !memberId) return;
    let cancelled = false;
    api
      .lookupSponsor(memberId)
      .then((res) => {
        if (!cancelled) setBlockedReason(res?.status && res.data?.canRefer === false ? res.data.referralBlockedReason || 'You cannot refer new members yet.' : null);
      })
      .catch(() => {
        // Registration still checks the sponsor, so a failed lookup just shows the links
      });
    return () => {
      cancelled = true;
    };
  }, [memberId, isSuperAdmin]);

  const referralLinks: Array<{ leg: ReferralLeg; title: string; description: string; url: string }> = [
    { leg: 'AUTO', title: 'Default Link', description: 'New member chooses their own leg', url: getReferralUrl(memberId, 'AUTO') },
    { leg: 'LEFT', title: 'Left Leg Link', description: 'Places new members in your LEFT leg', url: getReferralUrl(memberId, 'LEFT') },
    { leg: 'RIGHT', title: 'Right Leg Link', description: 'Places new members in your RIGHT leg', url: getReferralUrl(memberId, 'RIGHT') },
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
      </div>

      <h3 className="profile-links-heading">Your Referral Links</h3>
      {blockedReason ? (
        <Alert tone="warning" title="Referral links are locked">
          Your links unlock once your account is active and binary active (100 BV), which places you in the binary tree.
        </Alert>
      ) : (
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
      )}
    </section>
  );
};
