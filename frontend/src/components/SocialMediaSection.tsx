import React, { useEffect, useState } from 'react';
import {
  Youtube,
  Instagram,
  Facebook,
  Linkedin,
  Globe,
  ExternalLink,
  Share2,
} from 'lucide-react';
import { api, type SocialLinkItem } from '../services/api';
import { HomeSectionHeader } from './HomeSectionHeader';

// Crisp custom SVG icons for X (formerly Twitter), WhatsApp, and Telegram
const TwitterXIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const WhatsAppIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.12-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.18-.47-.3" />
  </svg>
);

const TelegramIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
  </svg>
);

interface PlatformVisual {
  name: string;
  badgeBg: string;
  badgeColor: string;
  hoverGlow: string;
  borderHover: string;
  icon: React.ReactNode;
}

const PLATFORM_CONFIG: Record<string, PlatformVisual> = {
  youtube: {
    name: 'YouTube',
    badgeBg: 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
    badgeColor: 'var(--text-inverse)',
    hoverGlow: 'rgba(255, 0, 0, 0.22)',
    borderHover: '#ff4d4d',
    icon: <Youtube size={22} />,
  },
  instagram: {
    name: 'Instagram',
    badgeBg: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
    badgeColor: 'var(--text-inverse)',
    hoverGlow: 'rgba(225, 48, 108, 0.25)',
    borderHover: '#e1306c',
    icon: <Instagram size={22} />,
  },
  twitter: {
    name: 'X (Twitter)',
    badgeBg: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
    badgeColor: 'var(--text-inverse)',
    hoverGlow: 'rgba(0, 0, 0, 0.28)',
    borderHover: '#3f3f46',
    icon: <TwitterXIcon size={20} />,
  },
  facebook: {
    name: 'Facebook',
    badgeBg: 'linear-gradient(135deg, #1877F2 0%, var(--primary) 100%)',
    badgeColor: 'var(--text-inverse)',
    hoverGlow: 'rgba(24, 119, 242, 0.25)',
    borderHover: '#1877f2',
    icon: <Facebook size={22} />,
  },
  whatsapp: {
    name: 'WhatsApp',
    badgeBg: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
    badgeColor: 'var(--text-inverse)',
    hoverGlow: 'rgba(37, 211, 102, 0.25)',
    borderHover: '#25d366',
    icon: <WhatsAppIcon size={21} />,
  },
  telegram: {
    name: 'Telegram',
    badgeBg: 'linear-gradient(135deg, #229ED9 0%, #0088cc 100%)',
    badgeColor: 'var(--text-inverse)',
    hoverGlow: 'rgba(34, 158, 217, 0.25)',
    borderHover: '#229ed9',
    icon: <TelegramIcon size={22} />,
  },
  linkedin: {
    name: 'LinkedIn',
    badgeBg: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
    badgeColor: 'var(--text-inverse)',
    hoverGlow: 'rgba(10, 102, 194, 0.25)',
    borderHover: '#0a66c2',
    icon: <Linkedin size={22} />,
  },
  website: {
    name: 'Website',
    badgeBg: 'var(--accent)',
    badgeColor: 'var(--text-inverse)',
    hoverGlow: 'rgba(79, 70, 229, 0.25)',
    borderHover: 'var(--accent)',
    icon: <Globe size={22} />,
  },
  custom: {
    name: 'Official Link',
    badgeBg: 'var(--info)',
    badgeColor: 'var(--text-inverse)',
    hoverGlow: 'rgba(2, 132, 199, 0.25)',
    borderHover: 'var(--info)',
    icon: <Share2 size={22} />,
  },
};

interface SocialMediaSectionProps {
  className?: string;
  /** Show a message instead of hiding the section when no links are configured */
  showEmptyState?: boolean;
}

export const SocialMediaSection: React.FC<SocialMediaSectionProps> = ({ className = '', showEmptyState = false }) => {
  const [links, setLinks] = useState<SocialLinkItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchLinks = async () => {
      try {
        const res = await api.getSocialLinks();
        if (isMounted && res.status && Array.isArray(res.data)) {
          // Keep only links with actual non-empty URLs
          const valid = res.data.filter((item) => item.isActive && item.url && item.url.trim().length > 0);
          setLinks(valid);
        }
      } catch (err) {
        console.error('[SocialMediaSection] Error fetching social links:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLinks();
    return () => {
      isMounted = false;
    };
  }, []);

  // Do not display if finished loading and no active links exist
  if (!loading && links.length === 0) {
    return showEmptyState ? (
      <p className="social-links-empty">No social media channels have been added yet.</p>
    ) : null;
  }

  return (
    <section
      className={`home-section social-media-connect-section ${className}`}
      aria-labelledby="home-social-title"
    >
      <HomeSectionHeader
        id="home-social-title"
        icon={<Share2 size={18} />}
        tone="green"
        title="Connect With Us"
        subtitle="Follow our official channels for tutorials, live sessions and news."
        action={
          <span className="home-section-meta is-success">
            <span className="home-chip-dot" aria-hidden="true" />
            Official verified links
          </span>
        }
      />

      {loading ? (
        <div className="social-links-grid" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="social-link-card is-skeleton">
              <div className="home-skeleton-block" />
            </div>
          ))}
        </div>
      ) : (
        <div className="social-links-grid">
          {links.map((item) => {
            const visual = PLATFORM_CONFIG[item.platform] || PLATFORM_CONFIG.custom;

            return (
              <a
                key={item._id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="social-link-card"
                style={
                  {
                    '--brand-glow': visual.hoverGlow,
                    '--brand-border': visual.borderHover,
                  } as React.CSSProperties
                }
              >
                <span
                  className="social-link-icon"
                  style={{ background: visual.badgeBg, color: visual.badgeColor }}
                  aria-hidden="true"
                >
                  {visual.icon}
                </span>

                <span className="social-link-text">
                  <span className="social-link-title">{item.title || visual.name}</span>
                  <span className="social-link-sub">{item.subtitle || 'Click to visit'}</span>
                </span>

                <ExternalLink size={15} className="social-link-arrow" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default SocialMediaSection;
