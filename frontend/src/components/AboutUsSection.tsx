import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Award,
  Sparkles,
  CheckCircle2,
  HeartHandshake,
} from 'lucide-react';
import {
  api,
  type AboutSectionItem,
  normalizeGoogleDriveUrl,
  retryWithImageFallback,
} from '../services/api';

interface AboutUsSectionProps {
  className?: string;
}

export const AboutUsSection: React.FC<AboutUsSectionProps> = ({ className = '' }) => {
  const [sections, setSections] = useState<AboutSectionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchSections = async () => {
      try {
        const res = await api.getAboutSections();
        if (isMounted && res.status && Array.isArray(res.data)) {
          const active = res.data.filter((s) => s.status === 'ACTIVE');
          setSections(active);
        }
      } catch (err) {
        console.error('[AboutUsSection] Failed to fetch about sections:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSections();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!loading && sections.length === 0) {
    return null;
  }

  return (
    <section className={`home-section about-us-showcase-section ${className}`} aria-label="About us">

      {/* Skeletons while loading */}
      {loading && (
        <div
          style={{
            height: 320,
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(90deg, var(--surface-muted) 25%, var(--surface-sunken) 50%, var(--surface-muted) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            border: '1px solid var(--border-color)',
          }}
        />
      )}

      {/* Render All Active About Sections */}
      {!loading &&
        sections.map((section, idx) => {
          const directImg = normalizeGoogleDriveUrl(section.imageUrl);

          return (
            <div
              key={section._id}
              className="about-card-container"
              style={{
                marginBottom: idx < sections.length - 1 ? 28 : 0,
              }}
            >
              {/* Subtle Decorative Background Glow */}
              <div
                style={{
                  position: 'absolute',
                  top: -60,
                  right: -60,
                  width: 240,
                  height: 240,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(37, 99, 235, 0.06) 0%, rgba(255,255,255,0) 70%)',
                  pointerEvents: 'none',
                }}
              />

              <div
                className="about-grid-layout"
                style={{
                  gridTemplateColumns: directImg ? undefined : '1fr',
                }}
              >
                {/* 1. Content Side (On the LEFT on desktop, On TOP on mobile) */}
                <div className="about-content-col">
                  {/* Tagline / Subtitle Badge */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 700,
                      color: 'var(--primary)',
                      background: 'var(--primary-light)',
                      border: '1px solid var(--primary-soft)',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-xl)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 14,
                    }}
                  >
                    <Sparkles size={13} />
                    <span>{section.subtitle || 'About Our Mission'}</span>
                  </div>

                  {/* Mandatory Title */}
                  <h2 className="about-title">{section.title}</h2>

                  {/* Formatted Rich Description from CKEditor */}
                  <div
                    className="about-section-html-content"
                    dangerouslySetInnerHTML={{ __html: section.description }}
                  />

                  {/* Value Highlights Pill Bar */}
                  <div
                    className="about-highlights-wrap"
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 12,
                      paddingTop: 14,
                      borderTop: '1px solid var(--border-light)',
                    }}
                  >
                    <div className="about-highlight-item" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      <CheckCircle2 size={15} color="var(--success)" />
                      <span>Authentic Ayurveda</span>
                    </div>
                    <div className="about-highlight-item" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      <Award size={15} color="var(--primary)" />
                      <span>Research Backed</span>
                    </div>
                    <div className="about-highlight-item" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      <HeartHandshake size={15} color="var(--accent)" />
                      <span>Distributor Prosperity</span>
                    </div>
                  </div>
                </div>

                {/* 2. Image Side (On the RIGHT on desktop, underneath on mobile) */}
                {directImg && (
                  <div className="about-image-col">
                    <div className="about-image-box">
                      <img
                        src={directImg}
                        alt={section.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (!retryWithImageFallback(e.currentTarget)) {
                            e.currentTarget.style.display = 'none';
                          }
                        }}
                      />

                      {/* Floating Trust Badge */}
                      <div className="about-floating-badge">
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'var(--success)',
                            color: 'var(--text-inverse)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <ShieldCheck size={16} />
                        </div>
                        <div>
                          <div className="about-floating-badge-title" style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-main)' }}>
                            100% Certified Herbal
                          </div>
                          <div className="about-floating-badge-subtitle" style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                            GMP Formulations
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </section>
  );
};

export default AboutUsSection;
