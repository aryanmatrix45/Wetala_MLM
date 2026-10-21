import React, { useState, useEffect } from 'react';
import { HomeSlider } from '../components/HomeSlider';
import { SocialMediaSection } from '../components/SocialMediaSection';
// Shop by Category is temporarily hidden on the homepage; uncomment this and the section below to restore it.
// import { ShopByCategorySection } from '../components/ShopByCategorySection';
import { HomeVideoSection } from '../components/HomeVideoSection';
import { AboutUsSection } from '../components/AboutUsSection';
import { HomeFooter } from '../components/HomeFooter';
import { HomeSectionHeader } from '../components/HomeSectionHeader';
import { api, type SliderItem, type ProductItem, getAssetUrl, retryWithImageFallback } from '../services/api';
import { ArrowRight, Check, Leaf, Package, ShoppingBag, ShoppingCart, Sparkles, Star } from 'lucide-react';

interface MemberHomePageProps {
  user?: any;
  token?: string | null;
  onNavigate?: (tab: string, params?: { categoryId?: string; subcategoryId?: string }) => void;
}

export const MemberHomePage: React.FC<MemberHomePageProps> = ({ user, onNavigate }) => {
  const [sliders, setSliders] = useState<SliderItem[]>([]);
  const [slidersLoading, setSlidersLoading] = useState(true);

  // Products Showcase State
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);

  // Cart action state
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchSliders = async () => {
    try {
      const res = await api.getSliders();
      if (res.status && res.data) {
        setSliders(res.data.all || []);
      }
    } catch (err) {
      console.error('[MemberHomePage] Failed to fetch sliders:', err);
    } finally {
      setSlidersLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      const res = await api.getProducts({ showOnHome: 'true', limit: 8 });
      if (res.status && Array.isArray(res.data)) {
        setProducts(res.data);
        if (res.pagination?.total) {
          setTotalProducts(res.pagination.total);
        } else {
          setTotalProducts(res.data.length);
        }
      }
    } catch (err) {
      console.error('[MemberHomePage] Failed to fetch home products:', err);
    } finally {
      setProductsLoading(false);
    }
  };

  const loadData = async () => {
    await Promise.all([fetchSliders(), fetchProducts()]);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddToCart = (product: ProductItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const saved = localStorage.getItem('wetala_cart');
      const cart: Array<{ product: ProductItem; quantity: number }> = saved ? JSON.parse(saved) : [];
      const prodId = product.productId || (product as any)._id;
      const existingIdx = cart.findIndex(
        (item) => (item.product.productId || (item.product as any)._id) === prodId
      );

      const stockAvail = product.stock ?? product.stockQuantity ?? 100;
      if (existingIdx >= 0) {
        cart[existingIdx].quantity = Math.min(stockAvail, cart[existingIdx].quantity + 1);
      } else {
        cart.push({ product, quantity: 1 });
      }

      localStorage.setItem('wetala_cart', JSON.stringify(cart));
      setAddedMap((prev) => ({ ...prev, [prodId]: true }));
      setToastMessage(`"${product.title || product.name}" added to cart!`);

      setTimeout(() => {
        setAddedMap((prev) => ({ ...prev, [prodId]: false }));
      }, 2000);

      setTimeout(() => {
        setToastMessage(null);
      }, 3500);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    }
  };

  const handleBuyNow = (product: ProductItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    handleAddToCart(product);
    if (onNavigate) {
      onNavigate('member-products');
    }
  };

  const handleProductClick = (product: ProductItem) => {
    if (product.slug) {
      window.history.pushState({ slug: product.slug }, '', `/products/${product.slug}`);
    }
    if (onNavigate) {
      onNavigate('member-products');
    }
  };

  const go = (tab: string) => onNavigate && onNavigate(tab);

  return (
    <div className="home-layout-wrapper">
      <div className="page-body member-home-page">
        {/* 1. Hero banner slider */}
        {(slidersLoading || sliders.length > 0) && (
          <section className="home-section home-slider-section" aria-label="Announcements">
            {slidersLoading ? (
              <div className="home-slider-skeleton">
                <div className="slider-shimmer" />
              </div>
            ) : (
              <HomeSlider sliders={sliders} autoPlayInterval={5000} />
            )}
          </section>
        )}

        {/* 2. Shop by Category (temporarily hidden; uncomment to restore, along with its import above)
        <ShopByCategorySection
          onSelectCategory={(category) => {
            if (onNavigate && category._id) {
              onNavigate('member-products', { categoryId: category._id });
            }
          }}
        />
        */}

        {/* 3. Featured Products */}
        <section className="home-section home-products-section" aria-labelledby="home-products-title">
          <HomeSectionHeader
            id="home-products-title"
            icon={<Sparkles size={18} />}
            tone="blue"
            title="Featured Wellness Products"
            subtitle="Distributor-exclusive formulations eligible for instant Business Volume (BV) credit."
            action={
              <button type="button" className="home-section-view-all" onClick={() => go('member-products')}>
                <span>View all{totalProducts > 0 ? ` (${totalProducts})` : ''}</span>
                <ArrowRight size={14} />
              </button>
            }
          />

          {productsLoading ? (
            <div className="home-products-grid">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="home-product-card is-skeleton" aria-hidden="true">
                  <div className="home-product-thumb-container">
                    <div className="home-skeleton-block" />
                  </div>
                  <div className="home-product-details">
                    <div className="home-skeleton-line" style={{ width: '40%' }} />
                    <div className="home-skeleton-line" style={{ width: '85%', height: 14 }} />
                    <div className="home-skeleton-line" style={{ width: '30%', height: 18, marginTop: 'auto' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="home-empty-state">
              <Package size={36} aria-hidden="true" />
              <h3>No featured products yet</h3>
              <p>
                {user?.role?.toLowerCase() === 'superadmin'
                  ? 'Turn on “Show on Home” for products in Catalog → Products to feature them here.'
                  : 'Featured products will appear here soon. Meanwhile, browse the full store.'}
              </p>
              <button type="button" className="btn btn-primary" onClick={() => go('member-products')}>
                Browse the full store
              </button>
            </div>
          ) : (
            <div className="home-products-grid">
              {products.map((prod) => {
                const prodId = prod.productId || (prod as any)._id;
                const primaryImg = prod.images?.find((img) => img.isPrimary) || prod.images?.[0];
                const title = prod.title || prod.name || 'Panchveda Product';
                const price = prod.price ?? 0;
                const mrp = prod.mrp ?? 0;
                const bv = prod.businessVolume ?? prod.bv ?? 0;
                const hasDiscount = mrp > price;
                const discountPercent = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
                const isAdded = addedMap[prodId];
                const catName =
                  typeof prod.categoryId === 'object' && prod.categoryId?.name
                    ? prod.categoryId.name
                    : prod.category || 'Wellness';

                return (
                  <article
                    key={prodId}
                    className="home-product-card"
                    role="link"
                    tabIndex={0}
                    aria-label={`View ${title}`}
                    onClick={() => handleProductClick(prod)}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleProductClick(prod);
                      }
                    }}
                  >
                    <div className="home-product-thumb-container">
                      {primaryImg?.url ? (
                        <img
                          src={getAssetUrl(primaryImg.url)}
                          referrerPolicy="no-referrer"
                          alt={primaryImg.alt || title}
                          className="home-product-thumb-img"
                          loading="lazy"
                          onError={(e) => {
                            if (retryWithImageFallback(e.currentTarget as HTMLImageElement)) return;
                            (e.currentTarget as any).src =
                              'https://placehold.co/400x320/f1f5f9/64748b?text=Panchveda+Wellness';
                          }}
                        />
                      ) : (
                        <div className="home-product-thumb-fallback">
                          <Package size={36} />
                        </div>
                      )}

                      <div className="home-product-badge-group">
                        {hasDiscount && (
                          <span className="home-product-badge-discount">{discountPercent}% OFF</span>
                        )}
                        {(prod.showOnHome || prod.isFeatured) && (
                          <span className="home-product-badge-featured">
                            <Star size={10} fill="currentColor" />
                            <span>Featured</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="home-product-details">
                      <div className="home-product-cat-brand">
                        <span>{catName}</span>
                        {prod.brand && <span>· {prod.brand}</span>}
                      </div>

                      <h3 className="home-product-title" title={title}>
                        {title}
                      </h3>

                      <div className="home-product-meta">
                        <div className="home-product-pricing">
                          <span className="home-product-price">₹{price.toLocaleString('en-IN')}</span>
                          {hasDiscount && (
                            <span className="home-product-mrp">₹{mrp.toLocaleString('en-IN')}</span>
                          )}
                        </div>
                        <span className="home-product-bv-pill">
                          <Leaf size={12} aria-hidden="true" />
                          {bv.toLocaleString('en-IN')} BV
                        </span>
                      </div>

                      <div className="home-product-btn-group">
                        <button
                          type="button"
                          className={`home-product-btn-cart ${isAdded ? 'is-added' : ''}`}
                          onClick={(e) => handleAddToCart(prod, e)}
                          aria-label={`Add ${title} to cart`}
                        >
                          {isAdded ? (
                            <>
                              <Check size={15} />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart size={15} />
                              <span>Add to cart</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          className="home-product-btn-buy"
                          onClick={(e) => handleBuyNow(prod, e)}
                          aria-label={`Buy ${title} now`}
                        >
                          <ShoppingBag size={15} />
                          <span>Buy now</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* 4. Video showcase */}
        <HomeVideoSection />

        {/* 5. About us */}
        <AboutUsSection />

        {/* 6. Official social channels */}
        <SocialMediaSection />

        {/* Toast Notification */}
        <div className="home-toast-region" role="status" aria-live="polite">
          {toastMessage && (
            <div className="home-toast-banner">
              <span className="home-toast-icon" aria-hidden="true">
                <Check size={14} />
              </span>
              <span className="home-toast-text">{toastMessage}</span>
              <button type="button" className="home-toast-action" onClick={() => go('member-products')}>
                View cart
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Full-width footer */}
      <HomeFooter />
    </div>
  );
};

export default MemberHomePage;
