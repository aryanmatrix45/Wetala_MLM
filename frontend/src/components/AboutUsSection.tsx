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
    <div
      className={`about-us-showcase-section ${className}`}
      style={{
        marginBottom: 36,
        marginTop: 10,
      }}
    >
      <style>{`
        .about-card-container {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          padding: 36px 40px;
          box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05);
          position: relative;
          overflow: hidden;
        }

        .about-grid-layout {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 40px;
          align-items: center;
        }

        .about-content-col {
          order: 1; /* Left on Desktop */
        }

        .about-image-col {
          order: 2; /* Right on Desktop */
          display: flex;
          justifyContent: center;
          width: 100%;
        }

        .about-image-box {
          position: relative;
          width: 100%;
          max-width: 480px;
          height: 350px;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 12px 30px -8px rgba(15, 23, 42, 0.15);
          border: 1px solid #cbd5e1;
          background: #f8fafc;
        }

        .about-image-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }

        .about-floating-badge {
          position: absolute;
          bottom: 16px;
          left: 16px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          padding: 8px 14px;
          border-radius: 12px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.12);
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(226, 232, 240, 0.9);
          z-index: 2;
        }

        .about-title {
          font-size: 26px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.3;
          letter-spacing: -0.02em;
          margin-bottom: 16px;
          margin-top: 0;
        }

        .about-section-html-content {
          font-size: 14px;
          line-height: 1.75;
          color: #334155;
          margin-bottom: 20px;
          word-break: break-word;
          overflow-wrap: break-word;
        }

        .about-section-html-content p {
          margin-top: 0;
          margin-bottom: 12px;
        }

        .about-section-html-content ul, .about-section-html-content ol {
          padding-left: 20px;
          margin-bottom: 14px;
        }

        .about-section-html-content li {
          margin-bottom: 6px;
        }

        /* Phone / Mobile Responsive Adjustments */
        @media (max-width: 768px) {
          .about-card-container {
            padding: 22px 18px !important;
            border-radius: 16px !important;
          }

          .about-grid-layout {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }

          .about-content-col {
            order: 1 !important;
          }

          .about-image-col {
            order: 2 !important; /* Image renders smoothly below text on mobile */
          }

          .about-image-box {
            height: 230px !important;
            max-width: 100% !important;
            border-radius: 14px !important;
          }

          .about-title {
            font-size: 21px !important;
            line-height: 1.35 !important;
            margin-bottom: 12px !important;
          }

          .about-section-html-content {
            font-size: 13.5px !important;
            line-height: 1.65 !important;
            margin-bottom: 16px !important;
          }

          .about-floating-badge {
            bottom: 10px !important;
            left: 10px !important;
            padding: 6px 10px !important;
            gap: 6px !important;
          }

          .about-floating-badge-title {
            font-size: 10px !important;
          }

          .about-floating-badge-subtitle {
            font-size: 9px !important;
          }

          .about-highlights-wrap {
            gap: 8px !important;
          }

          .about-highlight-item {
            font-size: 11px !important;
          }
        }
      `}</style>

      {/* Skeletons while loading */}
      {loading && (
        <div
          style={{
            height: 320,
            borderRadius: 18,
            background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            border: '1px solid #e2e8f0',
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
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#2563eb',
                      background: '#eff6ff',
                      border: '1px solid #dbeafe',
                      padding: '4px 12px',
                      borderRadius: 20,
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
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    <div className="about-highlight-item" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', fontWeight: 600 }}>
                      <CheckCircle2 size={15} color="#16a34a" />
                      <span>Authentic Ayurveda</span>
                    </div>
                    <div className="about-highlight-item" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', fontWeight: 600 }}>
                      <Award size={15} color="#2563eb" />
                      <span>Research Backed</span>
                    </div>
                    <div className="about-highlight-item" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', fontWeight: 600 }}>
                      <HeartHandshake size={15} color="#8b5cf6" />
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
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />

                      {/* Floating Trust Badge */}
                      <div className="about-floating-badge">
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: '#16a34a',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <ShieldCheck size={16} />
                        </div>
                        <div>
                          <div className="about-floating-badge-title" style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>
                            100% Certified Herbal
                          </div>
                          <div className="about-floating-badge-subtitle" style={{ fontSize: 10, color: '#64748b' }}>
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
    </div>
  );
};

export default AboutUsSection;
