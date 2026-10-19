import React, { useState, useEffect } from 'react';
import { HomeSlider } from '../components/HomeSlider';
import { SocialMediaSection } from '../components/SocialMediaSection';
import { ShopByCategorySection } from '../components/ShopByCategorySection';
import { api, type SliderItem, type ProductItem } from '../services/api';
import {
  RefreshCw,
  ShoppingBag,
  Users,
  Wallet,
  Sparkles,
  ArrowRight,
  Check,
  Star,
  Package,
  ShoppingCart,
} from 'lucide-react';

interface MemberHomePageProps {
  user?: any;
  token?: string | null;
  onNavigate?: (tab: string, params?: { categoryId?: string; subcategoryId?: string }) => void;
}

export const MemberHomePage: React.FC<MemberHomePageProps> = ({
  user,
  onNavigate,
}) => {
  const [sliders, setSliders] = useState<SliderItem[]>([]);
  const [slidersLoading, setSlidersLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

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

  return (
    <div className="page-body member-home-page">
      {/* Home Header */}
      <div className="welcome-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Welcome Home, {user?.name || 'Distributor'}!</h1>
          <p className="page-subtitle">
            Explore Panchveda Wellness announcements, latest offers, and business opportunities.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin-anim' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 1. Hero Slider Section */}
      {(slidersLoading || sliders.length > 0) && (
        <div className="home-slider-section" style={{ marginBottom: 30 }}>
          {slidersLoading ? (
            <div className="home-slider-skeleton">
              <div className="slider-shimmer" />
            </div>
          ) : (
            <HomeSlider sliders={sliders} autoPlayInterval={5000} />
          )}
        </div>
      )}

      {/* 1.5 Official Social Media Connect Section */}
      <SocialMediaSection key={refreshing ? 'refreshing' : 'normal'} />

      {/* 1.8 Shop by Category Section (with 2-column mobile view & view-more toggle) */}
      <ShopByCategorySection
        onSelectCategory={(category) => {
          if (onNavigate && category._id) {
            onNavigate('member-products', { categoryId: category._id });
          }
        }}
      />

      {/* 2. Featured Products Section (Directly after Slider, Social Connect & Shop by Category) */}
      <div className="home-products-section">
        <div className="home-section-head">
          <div className="home-section-title-wrap">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.15)',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="home-section-title">Featured Wellness Products</h2>
              <p className="home-section-subtitle">
                Distributor-exclusive wellness formulations eligible for instant Business Volume (BV) credit.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="home-section-view-all"
            onClick={() => onNavigate && onNavigate('member-products')}
          >
            <span>Explore All Products</span>
            {totalProducts > 0 && <span style={{ opacity: 0.85 }}>({totalProducts})</span>}
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Products Grid */}
        {productsLoading ? (
          <div className="home-products-grid">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="home-product-card"
                style={{ height: 380, background: '#f8fafc', position: 'relative', overflow: 'hidden' }}
              >
                <div className="slider-shimmer" style={{ width: '100%', height: '100%' }} />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div
            className="dashboard-card"
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: 16,
            }}
          >
            <Package size={40} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              No Featured Products Configured Yet
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', maxWidth: 460, margin: '0 auto 16px' }}>
              Products flagged with "Show on Home" in the Admin panel will be displayed here for all members.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate && onNavigate('member-products')}
              style={{ fontSize: 13, padding: '8px 18px' }}
            >
              Browse Complete Store
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
                <div
                  key={prodId}
                  className="home-product-card"
                  onClick={() => handleProductClick(prod)}
                >
                  {/* Thumbnail Image Container */}
                  <div className="home-product-thumb-container">
                    {primaryImg?.url ? (
                      <img
                        src={primaryImg.url}
                        alt={primaryImg.alt || title}
                        className="home-product-thumb-img"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as any).src =
                            'https://placehold.co/400x320/f1f5f9/64748b?text=Panchveda+Wellness';
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#94a3b8',
                          background: '#f1f5f9',
                        }}
                      >
                        <Package size={36} />
                      </div>
                    )}

                    {/* Badges Overlay */}
                    <div className="home-product-badge-group">
                      {hasDiscount && (
                        <span className="home-product-badge-discount">{discountPercent}% OFF</span>
                      )}
                      {(prod.showOnHome || prod.isFeatured) && (
                        <span className="home-product-badge-featured">
                          <Star size={11} fill="#fff" />
                          <span>Featured</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="home-product-details">
                    <div className="home-product-cat-brand">
                      <span>{catName}</span>
                      {prod.brand && <span>• {prod.brand}</span>}
                    </div>

                    <h3 className="home-product-title" title={title}>
                      {title}
                    </h3>

                    {/* Business Volume (BV) Pill */}
                    <div className="home-product-bv-pill">
                      <span>🌿</span>
                      <span>{bv.toLocaleString()} BV</span>
                    </div>

                    {/* Pricing */}
                    <div className="home-product-pricing">
                      <span className="home-product-price">₹{price.toLocaleString()}</span>
                      {hasDiscount && (
                        <span className="home-product-mrp">₹{mrp.toLocaleString()}</span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="home-product-btn-group">
                      <button
                        type="button"
                        className="home-product-btn-cart"
                        onClick={(e) => handleAddToCart(prod, e)}
                        title="Add to shopping cart"
                      >
                        {isAdded ? (
                          <>
                            <Check size={14} color="#10b981" />
                            <span style={{ color: '#047857', fontWeight: 700 }}>Added!</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart size={14} />
                            <span>Cart</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        className="home-product-btn-buy"
                        onClick={(e) => handleBuyNow(prod, e)}
                        title="Proceed to checkout"
                      >
                        <ShoppingBag size={14} />
                        <span>Buy Now</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Quick Launch Navigation Cards */}
      <div className="home-quick-actions-grid" style={{ marginBottom: 24 }}>
        <div
          className="dashboard-card home-feature-card"
          onClick={() => onNavigate && onNavigate('dashboard')}
          style={{ cursor: 'pointer' }}
        >
          <div className="home-card-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
            <Wallet size={24} />
          </div>
          <div className="home-card-info">
            <h3 className="home-card-title">Compensation Dashboard</h3>
            <p className="home-card-desc">Track your matched pairs, BV ledger, wallet, and payouts.</p>
          </div>
        </div>

        <div
          className="dashboard-card home-feature-card"
          onClick={() => onNavigate && onNavigate('member-products')}
          style={{ cursor: 'pointer' }}
        >
          <div className="home-card-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <ShoppingBag size={24} />
          </div>
          <div className="home-card-info">
            <h3 className="home-card-title">Products & Store</h3>
            <p className="home-card-desc">Shop wellness products and earn repurchase Business Volume.</p>
          </div>
        </div>

        <div
          className="dashboard-card home-feature-card"
          onClick={() => onNavigate && onNavigate('genealogy')}
          style={{ cursor: 'pointer' }}
        >
          <div className="home-card-icon-wrap" style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#eab308' }}>
            <Users size={24} />
          </div>
          <div className="home-card-info">
            <h3 className="home-card-title">Network & Team Tree</h3>
            <p className="home-card-desc">View your binary placement tree and direct sponsor lineage.</p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="home-toast-banner">
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={14} color="#fff" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{toastMessage}</span>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('member-products')}
            style={{
              marginLeft: 10,
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(255, 255, 255, 0.18)',
              border: 'none',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            View Cart →
          </button>
        </div>
      )}
    </div>
  );
};

export default MemberHomePage;
