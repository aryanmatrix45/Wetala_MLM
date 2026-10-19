import React, { useEffect, useState } from 'react';
import {
  FolderTree,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Package,
  Layers,
} from 'lucide-react';
import { api, type CategoryItem } from '../services/api';

interface ShopByCategorySectionProps {
  onSelectCategory: (category: CategoryItem) => void;
  className?: string;
}

export const ShopByCategorySection: React.FC<ShopByCategorySectionProps> = ({
  onSelectCategory,
  className = '',
}) => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchCats = async () => {
      try {
        const res = await api.getCategories();
        if (isMounted && res.status && Array.isArray(res.data)) {
          // Keep only ACTIVE categories
          const active = res.data.filter((c) => c.status !== 'INACTIVE');
          setCategories(active);
        }
      } catch (err) {
        console.error('[ShopByCategorySection] Failed to fetch categories:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCats();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!loading && categories.length === 0) {
    return null;
  }

  // Mobile limit: show initial 2 categories when collapsed on small screens
  // We apply CSS classes / media queries so mobile collapses to 2 unless expanded, while desktop shows all
  const remainingCount = Math.max(0, categories.length - 2);

  return (
    <div
      className={`shop-by-category-section ${className}`}
      style={{
        marginBottom: 36,
        marginTop: 6,
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 18,
          paddingLeft: 4,
          paddingRight: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.15)',
            }}
          >
            <FolderTree size={18} />
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.01em',
              }}
            >
              Shop by Category
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: '#64748b',
                fontWeight: 500,
              }}
            >
              Discover wellness formulations and browse by specialized health categories
            </p>
          </div>
        </div>

        {categories.length > 0 && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Layers size={14} />
            <span>{categories.length} Categories Available</span>
          </div>
        )}
      </div>

      {/* Skeletons while loading */}
      {loading && (
        <div
          className="category-grid-loading"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 14,
          }}
        >
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              style={{
                height: 140,
                borderRadius: 14,
                background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                border: '1px solid #e2e8f0',
              }}
            />
          ))}
        </div>
      )}

      {/* Categories Grid */}
      {!loading && (
        <>
          <style>{`
            /* Default desktop/tablet layout */
            .category-responsive-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
              gap: 16px;
            }

            /* Phone / Mobile layout: exactly 2 columns */
            @media (max-width: 640px) {
              .category-responsive-grid {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 12px !important;
              }
              /* Hide items after the first 2 when collapsed on mobile */
              .category-responsive-grid.mobile-collapsed .category-card-item:nth-child(n+3) {
                display: none !important;
              }
            }
          `}</style>

          <div
            className={`category-responsive-grid ${!isExpanded ? 'mobile-collapsed' : ''}`}
          >
            {categories.map((cat) => {
              const catImg = cat.imageUrl || cat.image;
              const isHovered = hoveredId === cat._id;

              return (
                <div
                  key={cat._id}
                  className="category-card-item"
                  onClick={() => onSelectCategory(cat)}
                  onMouseEnter={() => setHoveredId(cat._id || null)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    background: '#ffffff',
                    borderRadius: 14,
                    border: `1.5px solid ${isHovered ? '#2563eb' : '#e2e8f0'}`,
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                    boxShadow: isHovered
                      ? '0 10px 24px -4px rgba(37, 99, 235, 0.16), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                      : '0 2px 6px rgba(0, 0, 0, 0.04)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Category Image or Fallback Icon */}
                  <div
                    style={{
                      width: '100%',
                      height: 104,
                      borderRadius: 10,
                      background: catImg
                        ? '#f8fafc'
                        : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {catImg ? (
                      <img
                        src={catImg}
                        alt={cat.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.35s ease',
                          transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                        }}
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          color: '#2563eb',
                        }}
                      >
                        <Package size={32} />
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                          Wellness
                        </span>
                      </div>
                    )}

                    {/* Subtle hover overlay badge */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: isHovered ? '#2563eb' : 'rgba(255,255,255,0.85)',
                        color: isHovered ? '#ffffff' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                      }}
                    >
                      <ChevronRight size={13} />
                    </div>
                  </div>

                  {/* Category Name */}
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: isHovered ? '#2563eb' : '#0f172a',
                      lineHeight: 1.3,
                      marginBottom: 4,
                      width: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      transition: 'color 0.2s ease',
                    }}
                  >
                    {cat.name}
                  </div>

                  {/* Subtitle / Indicator */}
                  <div
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      fontWeight: 500,
                    }}
                  >
                    {cat.subcategoryCount !== undefined && cat.subcategoryCount > 0
                      ? `${cat.subcategoryCount} Subcategories`
                      : 'Explore Products'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile "Click on More" Toggle Button */}
          {remainingCount > 0 && (
            <div
              className="category-mobile-more-btn"
              style={{
                marginTop: 14,
                textAlign: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 18px',
                  borderRadius: 20,
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isExpanded ? (
                  <>
                    <span>Show Fewer Categories</span>
                    <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    <span>View More Categories (+{remainingCount} More)</span>
                    <ChevronDown size={14} />
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ShopByCategorySection;
