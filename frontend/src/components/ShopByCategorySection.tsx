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
import { HomeSectionHeader } from './HomeSectionHeader';

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

  // Mobile limit: show the first 4 categories (two rows) when collapsed on small screens
  // We apply CSS classes / media queries so mobile collapses to 4 unless expanded, while desktop shows all
  const remainingCount = Math.max(0, categories.length - 4);

  return (
    <section
      className={`home-section shop-by-category-section ${className}`}
      aria-labelledby="home-categories-title"
    >
      <HomeSectionHeader
        id="home-categories-title"
        icon={<FolderTree size={18} />}
        tone="green"
        title="Shop by Category"
        subtitle="Browse wellness formulations by health focus."
        action={
          categories.length > 0 ? (
            <span className="home-section-meta">
              <Layers size={14} aria-hidden="true" />
              {categories.length} categories
            </span>
          ) : undefined
        }
      />

      {loading ? (
        <div className="category-responsive-grid" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="category-card-item is-skeleton">
              <div className="category-card-media home-skeleton-block" />
              <div className="home-skeleton-line" style={{ width: '70%', margin: '0 auto' }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className={`category-responsive-grid ${!isExpanded ? 'mobile-collapsed' : ''}`}>
            {categories.map((cat) => {
              const catImg = cat.imageUrl || cat.image;

              return (
                <button
                  key={cat._id}
                  type="button"
                  className="category-card-item"
                  onClick={() => onSelectCategory(cat)}
                >
                  <span className={`category-card-media ${catImg ? '' : 'is-fallback'}`}>
                    {catImg ? (
                      <img
                        src={catImg}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          // Hide broken images, leaving the tinted media box
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Package size={30} aria-hidden="true" />
                    )}
                    <span className="category-card-arrow" aria-hidden="true">
                      <ChevronRight size={13} />
                    </span>
                  </span>

                  <span className="category-card-name">{cat.name}</span>
                  <span className="category-card-sub">
                    {cat.subcategoryCount !== undefined && cat.subcategoryCount > 0
                      ? `${cat.subcategoryCount} subcategories`
                      : 'Explore products'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mobile-only expand toggle (desktop always shows every category) */}
          {remainingCount > 0 && (
            <div className="category-mobile-more-btn">
              <button
                type="button"
                className="home-pill-btn"
                onClick={() => setIsExpanded((prev) => !prev)}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <>
                    <span>Show fewer</span>
                    <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    <span>View {remainingCount} more</span>
                    <ChevronDown size={14} />
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default ShopByCategorySection;
