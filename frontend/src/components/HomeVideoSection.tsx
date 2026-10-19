import React, { useEffect, useState } from 'react';
import { PlayCircle, Film } from 'lucide-react';
import { HomeSectionHeader } from './HomeSectionHeader';
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
      className={`home-section home-video-showcase-section ${className}`}
      aria-labelledby="home-video-title"
    >
      {/* Header: title & subtitle are managed by Super Admin (CKEditor HTML) */}
      <HomeSectionHeader
        id="home-video-title"
        icon={<PlayCircle size={18} />}
        tone="red"
        title={
          settings?.headerTitle ? (
            <span
              className="video-section-custom-title"
              dangerouslySetInnerHTML={{ __html: settings.headerTitle }}
            />
          ) : (
            'Official Video Showcase'
          )
        }
        subtitle={
          settings?.headerSubtitle ? (
            <div
              className="video-section-custom-subtitle"
              dangerouslySetInnerHTML={{ __html: settings.headerSubtitle }}
            />
          ) : undefined
        }
      />

      {/* Loading Skeletons */}
      {loading && (
        <div className="home-video-grid" aria-hidden="true">
          {[1, 2].map((idx) => (
            <div key={idx} className="home-video-card is-skeleton">
              <div className="home-video-frame home-skeleton-block" />
              <div className="home-video-info">
                <div className="home-skeleton-line" style={{ width: '60%', height: 14 }} />
                <div className="home-skeleton-line" style={{ width: '90%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video grid with title & description directly below each video */}
      {!loading && videos.length > 0 && (
        <div className={`home-video-grid ${videos.length === 1 ? 'is-single' : ''}`}>
          {videos.map((video) => (
            <article key={video._id} className="home-video-card">
              <div className="home-video-frame">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${video.videoId}?rel=0&modestbranding=1`}
                  title={video.title || 'Official Video Presentation'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                />
              </div>

              <div className="home-video-info">
                {video.title && (
                  <h3 className="home-video-title">
                    <Film size={16} aria-hidden="true" />
                    <span>{video.title}</span>
                  </h3>
                )}

                {video.description ? (
                  <div
                    className="video-card-description"
                    dangerouslySetInnerHTML={{ __html: video.description }}
                  />
                ) : (
                  <p className="video-card-description is-empty">
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
      `}</style>
    </section>
  );
};
