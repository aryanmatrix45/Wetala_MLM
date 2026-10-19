import React, { useEffect, useState } from 'react';
import { PlayCircle, Film, Sparkles } from 'lucide-react';
import { api, type HomeVideoItem, type HomeVideoSettings } from '../services/api';

interface HomeVideoSectionProps {
  className?: string;
}

export const HomeVideoSection: React.FC<HomeVideoSectionProps> = ({ className = '' }) => {
  const [settings, setSettings] = useState<HomeVideoSettings | null>(null);
  const [videos, setVideos] = useState<HomeVideoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchVideos = async () => {
      try {
        const res = await api.getHomeVideos();
        if (isMounted && res.status && res.data) {
          setSettings(res.data.settings);
          setVideos(res.data.videos || []);
        }
      } catch (err) {
        console.error('[HomeVideoSection] Failed to load videos:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchVideos();
    return () => {
      isMounted = false;
    };
  }, []);

  // If inactive or no videos after loading, don't show the section
  if (!loading && (!settings?.isActive || videos.length === 0)) {
    return null;
  }

  return (
    <section
      className={`home-video-showcase-section ${className}`}
      aria-label="Official Video Presentation"
      style={{
        margin: '0 0 36px 0',
        padding: '24px 20px',
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: 20,
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative background glow */}
      <div
        style={{
          position: 'absolute',
          top: -80,
          right: -80,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -60,
          left: -60,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* 1. Header Area: Managed by Super Admin (CKEditor HTML with custom colors & formatting) */}
      <div style={{ marginBottom: 20, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.18)',
              flexShrink: 0,
            }}
          >
            <PlayCircle size={20} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {settings?.headerTitle ? (
              <div
                className="video-section-custom-title"
                style={{
                  fontSize: 'clamp(18px, 3vw, 22px)',
                  fontWeight: 800,
                  color: '#0f172a',
                  lineHeight: 1.25,
                  letterSpacing: '-0.02em',
                }}
                dangerouslySetInnerHTML={{ __html: settings.headerTitle }}
              />
            ) : (
              <h2
                style={{
                  margin: 0,
                  fontSize: 'clamp(18px, 3vw, 22px)',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                }}
              >
                Official Video Showcase
              </h2>
            )}
          </div>

          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#dc2626',
              background: '#fef2f2',
              padding: '4px 10px',
              borderRadius: 20,
              border: '1px solid #fee2e2',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
            }}
          >
            <Sparkles size={12} />
            <span>HD Showcase</span>
          </span>
        </div>

        {/* Subtitle from Super Admin */}
        {settings?.headerSubtitle && (
          <div
            className="video-section-custom-subtitle"
            style={{
              fontSize: 'clamp(13px, 2vw, 14px)',
              color: '#64748b',
              lineHeight: 1.5,
              marginTop: 4,
              paddingLeft: 46,
            }}
            dangerouslySetInnerHTML={{ __html: settings.headerSubtitle }}
          />
        )}
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
          }}
        >
          {[1, 2].map((idx) => (
            <div
              key={idx}
              style={{
                borderRadius: 16,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
              <div style={{ padding: 16 }}>
                <div style={{ height: 16, width: '60%', background: '#e2e8f0', borderRadius: 4, marginBottom: 10 }} />
                <div style={{ height: 12, width: '90%', background: '#f1f5f9', borderRadius: 4, marginBottom: 6 }} />
                <div style={{ height: 12, width: '75%', background: '#f1f5f9', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Video Grid & 3. Descriptions directly below */}
      {!loading && videos.length > 0 && (
        <div
          className="home-video-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: videos.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 22,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {videos.map((video) => (
            <article
              key={video._id}
              className="home-video-card"
              style={{
                background: '#ffffff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 12px 24px -6px rgba(15, 23, 42, 0.12)';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 10px rgba(15, 23, 42, 0.04)';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              {/* YouTube Video Player Embed with 16:9 Aspect Ratio */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16 / 9',
                  backgroundColor: '#0f172a',
                  overflow: 'hidden',
                }}
              >
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${video.videoId}?rel=0&modestbranding=1`}
                  title={video.title || 'Official Video Presentation'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                  }}
                />
              </div>

              {/* Video Info: Title and Description directly below the video */}
              <div
                style={{
                  padding: '16px 18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                }}
              >
                {/* Title */}
                {video.title && (
                  <h3
                    style={{
                      margin: '0 0 10px 0',
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#0f172a',
                      lineHeight: 1.35,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Film size={16} color="#dc2626" style={{ flexShrink: 0 }} />
                    <span>{video.title}</span>
                  </h3>
                )}

                {/* Description directly below the video */}
                {video.description ? (
                  <div
                    className="video-card-description"
                    style={{
                      fontSize: 13.5,
                      color: '#475569',
                      lineHeight: 1.6,
                      wordBreak: 'break-word',
                    }}
                    dangerouslySetInnerHTML={{ __html: video.description }}
                  />
                ) : (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: '#94a3b8',
                      fontStyle: 'italic',
                    }}
                  >
                    Watch the video above for details and presentation highlights.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Embedded CSS for CKEditor content rendering styling inside Video Section */}
      <style>{`
        .video-section-custom-title p {
          margin: 0;
          display: inline;
        }
        .video-section-custom-subtitle p {
          margin: 0;
        }
        .video-card-description p {
          margin: 0 0 8px 0;
        }
        .video-card-description p:last-child {
          margin-bottom: 0;
        }
        .video-card-description a {
          color: #2563eb;
          text-decoration: underline;
        }
        .video-card-description ul, .video-card-description ol {
          margin: 6px 0 8px 20px;
          padding: 0;
        }
        @media (max-width: 640px) {
          .home-video-showcase-section {
            padding: 18px 14px !important;
            border-radius: 16px !important;
          }
          .video-section-custom-subtitle {
            padding-left: 0 !important;
            margin-top: 8px !important;
          }
        }
      `}</style>
    </section>
  );
};
