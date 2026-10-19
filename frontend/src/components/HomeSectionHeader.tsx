import React from 'react';

export type HomeSectionTone = 'blue' | 'green' | 'red' | 'gold' | 'purple';

interface HomeSectionHeaderProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  tone?: HomeSectionTone;
  id?: string;
}

/**
 * Shared header used by every member home section so titles, icons and
 * spacing stay visually consistent.
 */
export const HomeSectionHeader: React.FC<HomeSectionHeaderProps> = ({
  icon,
  title,
  subtitle,
  action,
  tone = 'blue',
  id,
}) => (
  <div className="home-section-head">
    <div className="home-section-title-wrap">
      <span className={`home-section-icon tone-${tone}`} aria-hidden="true">
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <h2 className="home-section-title" id={id}>
          {title}
        </h2>
        {subtitle && <div className="home-section-subtitle">{subtitle}</div>}
      </div>
    </div>
    {action && <div className="home-section-action">{action}</div>}
  </div>
);

export default HomeSectionHeader;
