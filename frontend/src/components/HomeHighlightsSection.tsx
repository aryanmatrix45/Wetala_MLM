import React, { useEffect, useState } from 'react';
import { api, type HomeHighlightItem, type HomeHighlightSettings } from '../services/api';
import { HighlightIcon } from './highlightIcons';

// Cards from this count upward scroll continuously; fewer cards sit in a static row
const MARQUEE_MIN_CARDS = 4;
// Seconds each card takes to travel its own width, per speed setting
const SECONDS_PER_CARD = { SLOW: 9, NORMAL: 6, FAST: 3.5 } as const;

interface HomeHighlightsSectionProps {
  /** Admin preview: render these instead of fetching */
  previewItems?: HomeHighlightItem[];
  previewSettings?: HomeHighlightSettings;
}

const HighlightCard: React.FC<{ item: HomeHighlightItem; hidden?: boolean }> = ({ item, hidden }) => (
  <li className={`hl-card${item.isHighlighted ? ' is-highlighted' : ''}`} aria-hidden={hidden || undefined}>
    <span className="hl-card-icon">
      <HighlightIcon name={item.icon} size={34} />
    </span>
    <span className="hl-card-text">
      <span className="hl-card-title">{item.title}</span>
      {item.subtitle && <span className="hl-card-subtitle">{item.subtitle}</span>}
    </span>
  </li>
);

export const HomeHighlightsSection: React.FC<HomeHighlightsSectionProps> = ({ previewItems, previewSettings }) => {
  const isPreview = Boolean(previewItems);
  const [items, setItems] = useState<HomeHighlightItem[]>(previewItems || []);
  const [settings, setSettings] = useState<HomeHighlightSettings | null>(previewSettings || null);
  const [loading, setLoading] = useState(!isPreview);

  useEffect(() => {
    if (isPreview) {
      setItems(previewItems || []);
      setSettings(previewSettings || null);
      return;
    }
    let cancelled = false;
    api
      .getHomeHighlights()
      .then((res) => {
        if (cancelled || !res?.status) return;
        setSettings(res.data.settings);
        setItems(Array.isArray(res.data.highlights) ? res.data.highlights : []);
      })
      .catch(() => {
        // The home page simply skips this section if it cannot load
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isPreview, previewItems, previewSettings]);

  if (loading) {
    return (
      <section className="home-section hl-section" aria-hidden="true">
        <ul className="hl-row">
          {[0, 1, 2].map((i) => (
            <li key={i} className="hl-card is-skeleton">
              <span className="home-skeleton-line" style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', margin: 0 }} />
              <span className="hl-card-text" style={{ flex: 1 }}>
                <span className="home-skeleton-line" style={{ width: '60%', height: 14 }} />
                <span className="home-skeleton-line" style={{ width: '85%', height: 12, margin: 0 }} />
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!settings?.isActive || items.length === 0) return null;

  const heading = settings.heading?.trim();
  const subheading = settings.subheading?.trim();
  const scrolls = items.length >= MARQUEE_MIN_CARDS;
  const duration = items.length * SECONDS_PER_CARD[settings.scrollSpeed || 'NORMAL'];

  return (
    <section className="home-section hl-section" aria-label={heading || 'Highlights'}>
      {(heading || subheading) && (
        <div className="hl-head">
          {heading && <h2 className="home-section-title">{heading}</h2>}
          {subheading && <p className="home-section-subtitle">{subheading}</p>}
        </div>
      )}

      {scrolls ? (
        <div className="hl-marquee" style={{ '--hl-duration': `${duration}s` } as React.CSSProperties}>
          <ul className="hl-track">
            {items.map((item) => (
              <HighlightCard key={item._id} item={item} />
            ))}
            {/* Second copy makes the loop seamless; hidden from assistive tech */}
            {items.map((item) => (
              <HighlightCard key={`${item._id}-copy`} item={item} hidden />
            ))}
          </ul>
        </div>
      ) : (
        <ul className={`hl-row hl-count-${items.length}`}>
          {items.map((item) => (
            <HighlightCard key={item._id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
};

export default HomeHighlightsSection;
