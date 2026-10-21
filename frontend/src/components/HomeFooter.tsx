import React, { useEffect, useState } from 'react';
import {
  api,
  type FooterConfig,
  type SocialLinkItem,
  normalizeGoogleDriveUrl,
} from '../services/api';
import {
  Youtube,
  Instagram,
  Facebook,
  Linkedin,
  Globe,
} from 'lucide-react';

// Custom crisp SVG icons for Twitter/X, WhatsApp, and Telegram
const TwitterXIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const WhatsAppIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.12-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.18-.47-.3" />
  </svg>
);

const TelegramIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
  </svg>
);

const getSocialIcon = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'youtube':
      return <Youtube size={18} />;
    case 'instagram':
      return <Instagram size={18} />;
    case 'twitter':
      return <TwitterXIcon size={16} />;
    case 'facebook':
      return <Facebook size={18} />;
    case 'whatsapp':
      return <WhatsAppIcon size={18} />;
    case 'telegram':
      return <TelegramIcon size={18} />;
    case 'linkedin':
      return <Linkedin size={18} />;
    default:
      return <Globe size={18} />;
  }
};

const getSocialColor = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'youtube':
      return '#ff0000';
    case 'instagram':
      return '#e1306c';
    case 'facebook':
      return '#1877f2';
    case 'twitter':
      return '#0f172a';
    case 'whatsapp':
      return '#25d366';
    case 'telegram':
      return '#229ed9';
    case 'linkedin':
      return '#0a66c2';
    default:
      return '#3b82f6';
  }
};

export const HomeFooter: React.FC = () => {
  const [config, setConfig] = useState<FooterConfig | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLinkItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const [footerRes, socialRes] = await Promise.all([
          api.getFooterConfig().catch(() => ({ status: false, data: null })),
          api.getSocialLinks().catch(() => ({ status: false, data: [] })),
        ]);

        if (isMounted) {
          if (footerRes && footerRes.status && footerRes.data) {
            setConfig(footerRes.data);
          }
          if (socialRes && socialRes.status && Array.isArray(socialRes.data)) {
            // Keep only active links with valid URLs
            setSocialLinks(socialRes.data.filter((s) => s.isActive && s.url && s.url.trim()));
          }
        }
      } catch (err) {
        console.error('[HomeFooter] Error loading footer data:', err);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Do not render anything until config has loaded from the database
  if (!config) {
    return null;
  }

  // Purely dynamic from database config — zero hardcoded fallbacks
  const brandName = config.brandName;
  const brandTrademark = config.brandTrademark;
  const tagline = config.tagline;
  const aboutText = config.aboutText;
  const helpLinks = (config.helpLinks || []).filter((l) => l.isActive);
  const customerCareLinks = (config.customerCareLinks || []).filter((l) => l.isActive);
  const emails = config.emails || [];
  const phones = config.phoneNumbers || [];
  const businessHoursWeekdays = config.businessHoursWeekdays;
  const businessHoursWeekend = config.businessHoursWeekend;
  const copyrightText = config.copyrightText;

  const logoSrc = config.logoUrl ? normalizeGoogleDriveUrl(config.logoUrl) : '/logo.png';

  return (
    <footer className="treandora-footer-wrapper">

      <div className="treandora-footer-container">
        <div className="treandora-footer-grid">
          {/* Column 1: Logo & About Section */}
          <div className="footer-col-about">
            {logoSrc ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <img
                  src={logoSrc}
                  alt={brandName || 'Brand Logo'}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    objectFit: 'contain',
                    background: 'var(--surface)',
                    padding: '2px',
                    border: '1.5px solid rgba(234, 179, 8, 0.45)',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                    flexShrink: 0,
                  }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                {brandName ? (
                  <div>
                    <div className="footer-brand-title">
                      <span>{brandName}</span>
                      {brandTrademark ? <sup>{brandTrademark}</sup> : null}
                    </div>
                    {tagline ? <div className="footer-brand-tagline" style={{ marginBottom: 0 }}>{tagline}</div> : null}
                  </div>
                ) : null}
              </div>
            ) : brandName ? (
              <div>
                <div className="footer-brand-title">
                  <span>{brandName}</span>
                  {brandTrademark ? <sup>{brandTrademark}</sup> : null}
                </div>
                {tagline ? <div className="footer-brand-tagline">{tagline}</div> : null}
              </div>
            ) : null}

            {aboutText ? <p className="footer-about-text">{aboutText}</p> : null}
          </div>

          {/* Column 2: Help Links */}
          {(config.helpTitle || helpLinks.length > 0) && (
            <div className="footer-col-help">
              {config.helpTitle ? <h4 className="footer-col-title">{config.helpTitle}</h4> : null}
              {helpLinks.length > 0 && (
                <ul className="footer-nav-list">
                  {helpLinks.map((item, idx) => (
                    <li key={item._id || item.id || idx}>
                      <a
                        href={item.url || '#'}
                        target={item.openInNewTab ? '_blank' : '_self'}
                        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                        className="footer-nav-link"
                      >
                        <span>{item.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Column 3: Customer Care */}
          {(config.customerCareTitle || customerCareLinks.length > 0) && (
            <div className="footer-col-care">
              {config.customerCareTitle ? (
                <h4 className="footer-col-title">{config.customerCareTitle}</h4>
              ) : null}
              {customerCareLinks.length > 0 && (
                <ul className="footer-nav-list">
                  {customerCareLinks.map((item, idx) => (
                    <li key={item._id || item.id || idx}>
                      <a
                        href={item.url || '#'}
                        target={item.openInNewTab ? '_blank' : '_self'}
                        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                        className="footer-nav-link"
                      >
                        <span>{item.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Column 4: Contact Us & Live Social Media */}
          <div className="footer-col-contact">
            {config.contactTitle ? (
              <h4 className="footer-col-title">{config.contactTitle}</h4>
            ) : null}

            {/* Emails */}
            {emails.length > 0 && (
              <div className="footer-contact-block">
                {config.emailTitle ? (
                  <span className="footer-contact-label">{config.emailTitle}</span>
                ) : null}
                <span className="footer-contact-text">
                  {emails.map((email, idx) => (
                    <React.Fragment key={email}>
                      <a href={`mailto:${email.trim()}`} className="footer-contact-links">
                        {email.trim()}
                      </a>
                      {idx < emails.length - 1 && ' / '}
                    </React.Fragment>
                  ))}
                </span>
              </div>
            )}

            {/* Phone Numbers */}
            {phones.length > 0 && (
              <div className="footer-contact-block">
                {config.phoneTitle ? (
                  <span className="footer-contact-label">{config.phoneTitle}</span>
                ) : null}
                <span className="footer-contact-text">
                  {phones.map((phone, idx) => (
                    <React.Fragment key={phone}>
                      <a
                        href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                        className="footer-contact-links"
                      >
                        {phone.trim()}
                      </a>
                      {idx < phones.length - 1 && ' / '}
                    </React.Fragment>
                  ))}
                </span>
              </div>
            )}

            {/* Business Hours */}
            {(businessHoursWeekdays || businessHoursWeekend) && (
              <div className="footer-contact-block">
                {config.businessHoursTitle ? (
                  <span className="footer-contact-label">{config.businessHoursTitle}</span>
                ) : null}
                {businessHoursWeekdays && <div>{businessHoursWeekdays}</div>}
                {businessHoursWeekend && <div>{businessHoursWeekend}</div>}
              </div>
            )}

            {/* Social Links dynamically powered by existing Social Links API */}
            {(config.showSocialLinks !== false) && socialLinks.length > 0 && (
              <div className="footer-social-bar" aria-label="Social media channels">
                {socialLinks.map((item) => (
                  <a
                    key={item._id || item.platform}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social-btn"
                    title={item.title || item.platform}
                    style={{
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = getSocialColor(item.platform);
                      e.currentTarget.style.boxShadow = `0 4px 12px ${getSocialColor(item.platform)}40`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {getSocialIcon(item.platform)}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar / Copyright */}
        {(copyrightText || config.disclaimerText) && (
          <div className="footer-bottom-bar">
            {copyrightText ? <div>{copyrightText}</div> : <div />}
            {config.disclaimerText && (
              <div style={{ maxWidth: 650, fontSize: 'var(--fs-sm)', opacity: 0.85 }}>
                {config.disclaimerText}
              </div>
            )}
          </div>
        )}
      </div>
    </footer>
  );
};

export default HomeFooter;
