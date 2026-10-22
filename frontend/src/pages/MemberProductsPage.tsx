import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock, Eye, FileText, ImageIcon, Info, Minus, Package, Plus, Search, Send, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, Trash2, X } from 'lucide-react';
import { api, newRequestKey, type ProductItem, type CategoryItem, type SubcategoryItem, type PaymentMethod, getAssetUrl, retryWithImageFallback } from '../services/api';
import { PaymentMethodPicker } from '../components/PaymentMethodPicker';
import { htmlToPlainText } from '../utils/text';

interface MemberProductsPageProps {
  user?: any;
  token?: string | null;
  onNavigate?: (tab: string, params?: { categoryId?: string; subcategoryId?: string }) => void;
  initialCategoryId?: string;
  initialSubcategoryId?: string;
  /** Called when a visitor who is not signed in tries to check out */
  onRequireLogin?: () => void;
}

interface CartItem {
  product: ProductItem;
  quantity: number;
}

export const MemberProductsPage: React.FC<MemberProductsPageProps> = ({
  user: propUser,
  onNavigate,
  initialCategoryId,
  initialSubcategoryId,
  onRequireLogin,
}) => {
  const savedUserStr = localStorage.getItem('wetala_user');
  const user = propUser || (savedUserStr ? JSON.parse(savedUserStr) : null);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId || 'ALL');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(initialSubcategoryId || 'ALL');
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);
  const [subcategoriesList, setSubcategoriesList] = useState<SubcategoryItem[]>([]);

  // Selected product for full page details view
  const [viewProduct, setViewProduct] = useState<ProductItem | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [detailQty, setDetailQty] = useState(1);

  // Cart state (stored in session / localStorage for convenience)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('wetala_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [checkoutRequestKey, setCheckoutRequestKey] = useState(newRequestKey);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; purchase?: any } | null>(null);

  // Synchronize cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wetala_cart', JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // Load Active Categories from API
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await api.getCategories();
        if (res.status && Array.isArray(res.data)) {
          setCategoriesList(res.data);
        }
      } catch (err) {
        console.error('Failed to load active categories for members:', err);
      }
    };
    fetchCats();
  }, []);

  // When selectedCategoryId changes, load active subcategories
  useEffect(() => {
    if (selectedCategoryId !== 'ALL') {
      api.getSubcategories({ categoryId: selectedCategoryId })
        .then((res) => {
          if (res.status && Array.isArray(res.data)) {
            setSubcategoriesList(res.data);
          } else {
            setSubcategoriesList([]);
          }
        })
        .catch(() => setSubcategoriesList([]));
    } else {
      setSubcategoriesList([]);
    }
  }, [selectedCategoryId]);

  // Synchronize when initial category navigation props change from home page
  useEffect(() => {
    if (initialCategoryId) {
      setSelectedCategoryId(initialCategoryId);
      setSelectedSubcategoryId(initialSubcategoryId || 'ALL');
    }
  }, [initialCategoryId, initialSubcategoryId]);

  // Load Active Products from API
  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await api.getProducts({
        search: searchQuery,
        categoryId: selectedCategoryId !== 'ALL' ? selectedCategoryId : undefined,
        subcategoryId: selectedSubcategoryId !== 'ALL' ? selectedSubcategoryId : undefined,
      });

      if (res.status && Array.isArray(res.data)) {
        setProducts(res.data);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      console.error('Failed to load member products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [searchQuery, selectedCategoryId, selectedSubcategoryId]);

  // ==========================================
  // URL SLUG SYNCHRONIZATION
  // ==========================================

  // Extract slug from URL path (e.g. /products/:slug or /product/:slug) or query params
  const extractSlugFromUrl = (): string | null => {
    const pathname = window.location.pathname;
    const match = pathname.match(/^\/(?:products|product)\/([^/?#]+)/i);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    const params = new URLSearchParams(window.location.search);
    const qSlug = params.get('product') || params.get('slug');
    if (qSlug) return qSlug;
    return null;
  };

  // Fetch product by slug from backend
  const fetchProductBySlug = async (slug: string) => {
    try {
      setProductLoading(true);
      const res = await api.getProductBySlug(slug);
      if (res.status && res.data) {
        setViewProduct(res.data);
        setActiveImageIdx(0);
        setDetailQty(1);
      } else {
        // Fallback: check in products array
        const found = products.find(
          (p) => p.slug?.toLowerCase() === slug.toLowerCase() || p.productId === slug
        );
        if (found) {
          setViewProduct(found);
          setActiveImageIdx(0);
          setDetailQty(1);
        } else {
          setFeedback({
            type: 'error',
            message: `Product '${slug}' could not be found or is unavailable.`,
          });
          setViewProduct(null);
          window.history.replaceState(null, '', '/products');
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch product by slug:', err);
      // Fallback
      const found = products.find(
        (p) => p.slug?.toLowerCase() === slug.toLowerCase() || p.productId === slug
      );
      if (found) {
        setViewProduct(found);
        setActiveImageIdx(0);
        setDetailQty(1);
      } else {
        setFeedback({
          type: 'error',
          message: `Product '${slug}' could not be loaded.`,
        });
        setViewProduct(null);
      }
    } finally {
      setProductLoading(false);
    }
  };

  // On mount: check if URL contains product slug
  useEffect(() => {
    const slug = extractSlugFromUrl();
    if (slug) {
      fetchProductBySlug(slug);
    }
  }, []);

  // Listen to browser Back / Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const slug = extractSlugFromUrl();
      if (slug) {
        if (viewProduct?.slug?.toLowerCase() !== slug.toLowerCase()) {
          fetchProductBySlug(slug);
        }
      } else {
        setViewProduct(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [viewProduct, products]);

  // Open product details and update URL to /products/:slug
  const handleOpenProduct = (product: ProductItem) => {
    setViewProduct(product);
    setActiveImageIdx(0);
    setDetailQty(1);
    const slug = product.slug || product.productId || (product as any)._id;
    if (slug) {
      window.history.pushState({ slug }, '', `/products/${slug}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Close product details and revert URL to /products
  const handleBackToProducts = () => {
    setViewProduct(null);
    window.history.pushState(null, '', '/products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add Product to Cart
  const handleAddToCart = (product: ProductItem, qty = 1) => {
    const stockAvailable = product.stock ?? product.stockQuantity ?? 0;
    if (stockAvailable <= 0) {
      alert(`"${product.title}" is currently out of stock.`);
      return;
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) => (item.product.productId || (item.product as any)._id) === (product.productId || (product as any)._id)
      );

      if (existingIdx >= 0) {
        const currentQty = prev[existingIdx].quantity;
        const newQty = Math.min(stockAvailable, currentQty + qty);
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: newQty };
        return updated;
      } else {
        return [...prev, { product, quantity: Math.min(stockAvailable, qty) }];
      }
    });

    setIsCartOpen(true);
  };

  // Buy Now: adds to cart and opens cart drawer for immediate checkout
  const handleBuyNow = (product: ProductItem, qty = 1) => {
    handleAddToCart(product, qty);
    setIsCartOpen(true);
  };

  // Update Cart Item Quantity
  const handleUpdateCartQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if ((item.product.productId || (item.product as any)._id) === productId) {
          const maxStock = item.product.stock ?? item.product.stockQuantity ?? 100;
          return { ...item, quantity: Math.min(maxStock, newQty) };
        }
        return item;
      })
    );
  };

  // Remove from Cart
  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) =>
      prev.filter((item) => (item.product.productId || (item.product as any)._id) !== productId)
    );
  };

  // Clear Cart
  const handleClearCart = () => {
    setCart([]);
  };

  // Cart Calculations
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotalAmount = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartTotalBV = cart.reduce(
    (sum, item) => sum + (item.product.businessVolume ?? item.product.bv ?? 0) * item.quantity,
    0
  );

  // Checkout Handler
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!user || !user.memberId) {
      if (onRequireLogin) {
        setIsReviewModalOpen(false);
        onRequireLogin();
      } else {
        alert('You must be logged in as an active member to checkout.');
      }
      return;
    }

    try {
      setCheckoutLoading(true);
      setFeedback(null);

      const itemsPayload = cart.map((item) => ({
        itemId: item.product.productId || (item.product as any)._id,
        productId: (item.product as any)._id || item.product.productId,
        name: item.product.title || item.product.name,
        quantity: item.quantity,
        itemType: 'PRODUCT',
      }));

      const res = await api.createPurchase({
        memberId: user.memberId,
        type: 'REPURCHASE',
        items: itemsPayload,
        notes: orderNotes.trim() || `Product Repurchase order placed by member ${user.name || user.memberId}`,
        paymentMethod,
        requestKey: checkoutRequestKey,
      });

      if (res.status && res.data) {
        setCart([]);
        localStorage.removeItem('wetala_cart');
        setIsCartOpen(false);
        setIsReviewModalOpen(false);
        setOrderNotes('');
        setPaymentMethod('BANK_TRANSFER');
        setCheckoutRequestKey(newRequestKey());
        setFeedback({
          type: 'success',
          message:
            paymentMethod === 'BV_WALLET'
              ? `Order #${res.data.purchaseId} placed and ${(res.data.bvAmount || 0).toLocaleString('en-IN')} BV paid from your BV Wallet. Super Admin will verify and activate it.`
              : `Repurchase request #${res.data.purchaseId} submitted to Super Admin! Super Admin will review and provide company payment details.`,
          purchase: res.data,
        });
        await loadProducts();
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Failed to complete order. Please check stock and try again.',
        });
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Network error during checkout. Please try again.',
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Helper variables for viewProduct
  const productCategoryName = viewProduct
    ? (typeof viewProduct.categoryId === 'object' && viewProduct.categoryId?.name
        ? viewProduct.categoryId.name
        : viewProduct.category || 'General')
    : '';

  const productSubcategoryName = viewProduct
    ? (viewProduct.subcategoryId && typeof viewProduct.subcategoryId === 'object'
        ? viewProduct.subcategoryId.name
        : viewProduct.subcategory || '')
    : '';

  const productStock = viewProduct ? (viewProduct.stock ?? viewProduct.stockQuantity ?? 0) : 0;
  const isProductOutOfStock = productStock <= 0;
  const productBV = viewProduct ? (viewProduct.businessVolume ?? viewProduct.bv ?? 0) : 0;
  const productSavings = viewProduct && viewProduct.mrp && viewProduct.mrp > viewProduct.price
    ? viewProduct.mrp - viewProduct.price
    : 0;

  // Related products from same category
  const relatedProducts = viewProduct
    ? products
        .filter((p) => {
          const pId = p.productId || (p as any)._id;
          const currentId = viewProduct.productId || (viewProduct as any)._id;
          return pId !== currentId;
        })
        .slice(0, 4)
    : [];

  return (
    <div className="page-body">
      {/* Order Feedback Alert */}
      {feedback && (
        <div
          style={{
            padding: '14px 18px',
            marginBottom: '24px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            color: feedback.type === 'success' ? 'var(--success-strong)' : 'var(--danger-strong)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>{feedback.message}</div>
              {feedback.purchase && (
                <div style={{ fontSize: 'var(--fs-sm)', marginTop: '4px', opacity: 0.9 }}>
                  Request ID: {feedback.purchase.purchaseId || feedback.purchase.transactionId} • Total Amount: ₹
                  {feedback.purchase.totalAmount?.toLocaleString()}
                </div>
              )}
              {feedback.type === 'success' && onNavigate && (
                <button
                  onClick={() => onNavigate('purchase-requests')} className="btn btn-success btn-sm" style={{ marginTop: '8px' }}>
                  <Clock size={13} />
                  <span>Track in Purchase Requests</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW PRODUCT LOADING STATE                               */}
      {/* ======================================================== */}
      {productLoading && (
        <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--border-strong)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ fontWeight: 600, fontSize: 'var(--fs-lg)', color: 'var(--text-body)' }}>Loading product details...</p>
        </div>
      )}

      {/* ======================================================== */}
      {/* FULL PAGE PRODUCT DETAILS VIEW (AFTER SIDEBAR)          */}
      {/* ======================================================== */}
      {!productLoading && viewProduct && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Top Breadcrumb & Actions Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleBackToProducts} className="btn btn-secondary">
                <ArrowLeft size={16} /> Back to Products
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: 'var(--fs-base)' }}>
                <span
                  style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}
                  onClick={handleBackToProducts}
                >
                  Store
                </span>
                <ChevronRight size={14} color="var(--text-light)" />
                <span style={{ fontWeight: 600, color: 'var(--text-body)' }}>{productCategoryName}</span>
                {productSubcategoryName && (
                  <>
                    <ChevronRight size={14} color="var(--text-light)" />
                    <span style={{ fontWeight: 600, color: 'var(--info)' }}>{productSubcategoryName}</span>
                  </>
                )}
                <ChevronRight size={14} color="var(--text-light)" />
                <span
                  style={{
                    color: 'var(--text-main)',
                    fontWeight: 700,
                    maxWidth: '300px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {viewProduct.title || viewProduct.name}
                </span>
              </div>
            </div>

            {/* Quick Cart Trigger */}
            <button
              onClick={() => setIsCartOpen(true)} className="btn btn-primary">
              <ShoppingCart size={18} />
              <span>Cart ({cartItemCount})</span>
              {cartTotalAmount > 0 && (
                <span
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 'var(--fs-sm)',
                  }}
                >
                  ₹{cartTotalAmount.toLocaleString()}
                </span>
              )}
            </button>
          </div>

          {/* Main Product Showcase Box */}
          <div
            className="dashboard-card"
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '36px',
              boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06)',
              marginBottom: '32px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                gap: '30px',
                alignItems: 'start',
              }}
            >
              {/* Left Column: Visual Gallery */}
              <div>
                {/* Main Large Image Display */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '420px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    marginBottom: '16px',
                  }}
                >
                  {viewProduct.images && viewProduct.images.length > 0 ? (
                    <img
                      src={getAssetUrl(viewProduct.images[activeImageIdx]?.url || viewProduct.images[0]?.url)}
                      referrerPolicy="no-referrer"
                      alt={viewProduct.images[activeImageIdx]?.alt || viewProduct.title}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      onError={(e) => {
                        if (retryWithImageFallback(e.currentTarget as HTMLImageElement)) return;
                        (e.currentTarget as any).src = 'https://placehold.co/500x500?text=Product';
                      }}
                    />
                  ) : (
                    <ImageIcon size={64} color="var(--text-disabled)" />
                  )}

                  {/* Floating Top Badges */}
                  <div style={{ position: 'absolute', top: '14px', left: '14px', display: 'flex', gap: '8px' }}>
                    <span
                      style={{
                        background: 'var(--primary-light)',
                        color: 'var(--primary-hover)',
                        fontWeight: 800,
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--fs-base)',
                        border: '1px solid var(--primary-border)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                      }}
                    >
                      +{productBV.toLocaleString()} BV
                    </span>
                    {productSavings > 0 && (
                      <span
                        style={{
                          background: 'var(--success-light)',
                          color: 'var(--success)',
                          fontWeight: 800,
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--fs-base)',
                          border: '1px solid var(--success-border)',
                        }}
                      >
                        SAVE ₹{productSavings.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div style={{ position: 'absolute', top: '14px', right: '14px' }}>
                    <span
                      style={{
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 700,
                        padding: '5px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: isProductOutOfStock ? 'var(--danger-light)' : 'var(--success-light)',
                        color: isProductOutOfStock ? 'var(--danger)' : 'var(--success)',
                        border: `1px solid ${isProductOutOfStock ? 'var(--danger-border)' : 'var(--success-border)'}`,
                      }}
                    >
                      {isProductOutOfStock ? 'Out of Stock' : 'In Stock'}
                    </span>
                  </div>
                </div>

                {/* Thumbnails Row */}
                {viewProduct.images && viewProduct.images.length > 1 && (
                  <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
                    {viewProduct.images.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveImageIdx(i)}
                        style={{
                          width: '74px',
                          height: '74px',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          border: activeImageIdx === i ? '2.5px solid var(--primary)' : '1px solid var(--border-strong)',
                          background: 'var(--surface)',
                          padding: '2px',
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                          transform: activeImageIdx === i ? 'scale(1.03)' : 'scale(1)',
                          boxShadow: activeImageIdx === i ? 'none' : 'none',
                        }}
                      >
                        <img
                          src={getAssetUrl(img.url)}
                          referrerPolicy="no-referrer"
                          alt={img.alt || ''}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                          onError={(e) => {
                            retryWithImageFallback(e.currentTarget);
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Direct Selling Assurance Badges */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                    gap: '10px',
                    marginTop: '20px',
                    padding: '16px',
                    background: 'var(--surface-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-light)',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <ShieldCheck size={20} color="var(--success)" style={{ margin: '0 auto 4px' }} />
                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-body)' }}>100% Genuine</div>
                    <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-light)' }}>Certified Herbal</div>
                  </div>
                  <div>
                    <Sparkles size={20} color="var(--primary)" style={{ margin: '0 auto 4px' }} />
                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-body)' }}>Instant BV</div>
                    <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-light)' }}>Binary Credited</div>
                  </div>
                  <div>
                    <Package size={20} color="var(--accent)" style={{ margin: '0 auto 4px' }} />
                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-body)' }}>Safe Packaging</div>
                    <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-light)' }}>Fast Dispatch</div>
                  </div>
                </div>
              </div>

              {/* Right Column: Specifications & Purchase Actions */}
              <div>
                {/* Categories & SKU Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <span
                    style={{
                      background: 'var(--surface-muted)',
                      color: 'var(--text-secondary)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--fs-sm)',
                      fontWeight: 700,
                    }}
                  >
                    Category: {productCategoryName}
                  </span>
                  {productSubcategoryName && (
                    <span
                      style={{
                        background: 'var(--info-soft)',
                        color: 'var(--info-strong)',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 700,
                      }}
                    >
                      Subcategory: {productSubcategoryName}
                    </span>
                  )}
                  <span
                    style={{
                      background: 'var(--accent-light)',
                      color: 'var(--accent-hover)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--fs-sm)',
                      fontWeight: 700,
                      border: '1px solid var(--accent-light)',
                    }}
                  >
                    SKU: {viewProduct.sku}
                  </span>
                </div>

                {/* Product Title */}
                <h1
                  style={{
                    fontSize: 'var(--fs-4xl)',
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    marginBottom: '10px',
                    lineHeight: '1.3',
                  }}
                >
                  {viewProduct.title || viewProduct.name}
                </h1>

                {/* Brand name if available */}
                {viewProduct.brand && (
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Brand: <strong style={{ color: 'var(--text-strong)' }}>{viewProduct.brand}</strong>
                  </div>
                )}

                {/* Short description */}
                {viewProduct.shortDescription && (
                  <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
                    {htmlToPlainText(viewProduct.shortDescription)}
                  </p>
                )}

                {/* Price & Business Volume Highlight Box */}
                <div
                  style={{
                    background: 'var(--surface-subtle)',
                    padding: '24px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--primary-soft)',
                    marginBottom: '24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '20px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                      <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-main)' }}>
                        ₹{viewProduct.price?.toLocaleString()}
                      </span>
                      {viewProduct.mrp && viewProduct.mrp > viewProduct.price && (
                        <span style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-light)', textDecoration: 'line-through' }}>
                          MRP ₹{viewProduct.mrp?.toLocaleString()}
                        </span>
                      )}
                      {productSavings > 0 && viewProduct.mrp && (
                        <span
                          style={{
                            background: 'var(--success)',
                            color: 'var(--text-inverse)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          {Math.round((productSavings / viewProduct.mrp) * 100)}% OFF
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Inclusive of all applicable taxes
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'var(--primary)',
                        color: 'var(--text-inverse)',
                        fontWeight: 800,
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--fs-lg)',
                        boxShadow: 'none',
                      }}
                    >
                      <Sparkles size={16} /> {productBV.toLocaleString()} BV
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--primary-hover)', fontWeight: 600, marginTop: '4px' }}>
                      Credited directly to binary volume
                    </div>
                  </div>
                </div>

                {/* Stock Status */}
                <div style={{ marginBottom: '24px', fontSize: 'var(--fs-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-body)' }}>Availability:</span>
                  {isProductOutOfStock ? (
                    <span
                      style={{
                        fontWeight: 700,
                        color: 'var(--danger)',
                        background: 'var(--danger-light)',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--danger-border)',
                      }}
                    >
                      Currently Out of Stock
                    </span>
                  ) : (
                    <span
                      style={{
                        fontWeight: 700,
                        color: 'var(--success)',
                        background: 'var(--success-light)',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--success-border)',
                      }}
                    >
                      {productStock} units in stock
                    </span>
                  )}
                </div>

                {/* Quantity Stepper & Action Buttons */}
                {!isProductOutOfStock ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-body)' }}>Quantity:</div>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          background: 'var(--surface)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setDetailQty(Math.max(1, detailQty - 1))} className="btn btn-secondary">
                          <Minus size={15} />
                        </button>
                        <span style={{ padding: '10px 20px', fontWeight: 800, fontSize: 'var(--fs-lg)', color: 'var(--text-main)' }}>
                          {detailQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDetailQty(Math.min(productStock, detailQty + 1))} className="btn btn-secondary">
                          <Plus size={15} />
                        </button>
                      </div>
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                        Subtotal: <strong>₹{(viewProduct.price * detailQty).toLocaleString()}</strong> (+{(productBV * detailQty).toLocaleString()} BV)
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleAddToCart(viewProduct, detailQty)} className="btn btn-primary">
                        <ShoppingCart size={18} /> Add {detailQty} to Cart
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBuyNow(viewProduct, detailQty)} className="btn btn-success">
                        <ArrowRight size={18} /> Buy Now
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '16px',
                      background: 'var(--danger-light)',
                      border: '1px solid var(--danger-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--danger-strong)',
                      marginBottom: '24px',
                      fontSize: 'var(--fs-base)',
                    }}
                  >
                    This item is currently sold out. Please browse other products in the store.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Description & Directions Full-Width Card */}
          <div
            className="dashboard-card"
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '32px',
              marginBottom: '32px',
              boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)',
            }}
          >
            <h3
              style={{
                fontSize: 'var(--fs-xl)',
                fontWeight: 800,
                color: 'var(--text-main)',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--border-light)',
              }}
            >
              Product Details & Directions
            </h3>

            <div
              style={{
                fontSize: 'var(--fs-md)',
                lineHeight: '1.7',
                color: 'var(--text-body)',
              }}
              dangerouslySetInnerHTML={{
                __html: viewProduct.description || '<em>No additional description provided.</em>',
              }}
            />
          </div>

          {/* Product Specifications Grid */}
          <div
            className="dashboard-card"
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '32px',
              marginBottom: '32px',
              boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)',
            }}
          >
            <h3
              style={{
                fontSize: 'var(--fs-xl)',
                fontWeight: 800,
                color: 'var(--text-main)',
                marginBottom: '18px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--border-light)',
              }}
            >
              Specifications & Parameters
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '16px',
              }}
            >
              <div style={{ padding: '14px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>SKU Code</div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>{viewProduct.sku}</div>
              </div>

              <div style={{ padding: '14px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Category</div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>{productCategoryName}</div>
              </div>

              <div style={{ padding: '14px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Subcategory</div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>{productSubcategoryName || 'General'}</div>
              </div>

              <div style={{ padding: '14px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Business Volume (BV)</div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>{productBV.toLocaleString()} BV</div>
              </div>

              <div style={{ padding: '14px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Inventory Status</div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: isProductOutOfStock ? 'var(--danger)' : 'var(--success)', marginTop: '4px' }}>
                  {isProductOutOfStock ? 'Out of Stock' : `${productStock} in stock`}
                </div>
              </div>

              <div style={{ padding: '14px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Direct Selling Eligibility</div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>Binary & Repurchase Bonus</div>
              </div>
            </div>
          </div>

          {/* Related Products in Store */}
          {relatedProducts.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 className="section-title">
                  More Products in {productCategoryName}
                </h3>
                <button
                  type="button"
                  onClick={handleBackToProducts} className="link-btn">
                  View All Products →
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                {relatedProducts.map((relProd) => {
                  const relImg = relProd.images?.find((img) => img.isPrimary) || relProd.images?.[0];
                  const relStock = relProd.stock ?? relProd.stockQuantity ?? 0;
                  const relOutOfStock = relStock <= 0;
                  const relBV = relProd.businessVolume ?? relProd.bv ?? 0;

                  return (
                    <div
                      key={relProd.productId || (relProd as any)._id}
                      className="dashboard-card"
                      style={{
                        padding: 0,
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{ height: '170px', background: 'var(--surface-subtle)', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => handleOpenProduct(relProd)}
                      >
                        {relImg?.url ? (
                          <img src={getAssetUrl(relImg.url)} referrerPolicy="no-referrer" alt={relProd.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { retryWithImageFallback(e.currentTarget); }} />
                        ) : (
                          <ImageIcon size={36} color="var(--text-disabled)" />
                        )}
                      </div>

                      <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <h4
                          onClick={() => handleOpenProduct(relProd)}
                          style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', cursor: 'pointer', lineHeight: '1.3' }}
                        >
                          {relProd.title || relProd.name}
                        </h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'auto', paddingTop: '10px' }}>
                          <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)' }}>₹{relProd.price?.toLocaleString()}</span>
                          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--primary)' }}>+{relBV.toLocaleString()} BV</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenProduct(relProd)} className="btn btn-secondary btn-sm">
                            Details
                          </button>
                          <button
                            type="button"
                            disabled={relOutOfStock}
                            onClick={() => handleAddToCart(relProd, 1)}
                            style={{
                              padding: '6px 10px',
                              background: relOutOfStock ? 'var(--surface-sunken)' : 'var(--primary)',
                              color: relOutOfStock ? 'var(--text-light)' : 'var(--text-inverse)',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 'var(--fs-sm)',
                              fontWeight: 700,
                              cursor: relOutOfStock ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* CATALOG LIST VIEW (WHEN NO PRODUCT IS OPEN)             */}
      {/* ======================================================== */}
      {!productLoading && !viewProduct && (
        <>
          {/* Top Banner */}
          <div className="welcome-header" style={{ marginBottom: '24px' }}>
            <div>
              <h1 className="page-title">Products</h1>
              <p className="page-subtitle">
                Browse genuine products and earn independent Business Volume (BV) with every purchase.
              </p>
            </div>

            {/* Floating Cart Button */}
            <div>
              <button
                onClick={() => setIsCartOpen(true)} className="btn btn-primary" style={{ position: 'relative' }}>
                <ShoppingCart size={18} />
                <span>Cart ({cartItemCount})</span>
                {cartTotalAmount > 0 && (
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: 'var(--fs-sm)',
                    }}
                  >
                    ₹{cartTotalAmount.toLocaleString()}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}
          >
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '260px', maxWidth: '420px' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}
              />
              <input
                type="text"
                placeholder="Search products by name, benefits, or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-strong)',
                  fontSize: 'var(--fs-base)',
                  background: 'var(--surface)',
                }}
              />
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setSelectedCategoryId('ALL');
                  setSelectedSubcategoryId('ALL');
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-xl)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: selectedCategoryId === 'ALL' ? '1px solid var(--primary)' : '1px solid var(--border-strong)',
                  background: selectedCategoryId === 'ALL' ? 'var(--primary-light)' : 'var(--surface)',
                  color: selectedCategoryId === 'ALL' ? 'var(--primary-hover)' : 'var(--text-muted)',
                }}
              >
                All Products
              </button>
              {categoriesList.map((cat) => (
                <button
                  key={cat._id}
                  onClick={() => {
                    setSelectedCategoryId(cat._id);
                    setSelectedSubcategoryId('ALL');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-xl)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: selectedCategoryId === cat._id ? '1px solid var(--primary)' : '1px solid var(--border-strong)',
                    background: selectedCategoryId === cat._id ? 'var(--primary-light)' : 'var(--surface)',
                    color: selectedCategoryId === cat._id ? 'var(--primary-hover)' : 'var(--text-muted)',
                  }}
                >
                  {(cat.imageUrl || cat.image) && (
                    <img
                      src={getAssetUrl(cat.imageUrl || cat.image)}
                      referrerPolicy="no-referrer"
                      alt=""
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        if (retryWithImageFallback(e.currentTarget as HTMLImageElement)) return;
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Visual Subcategories Showcase (When a Category is Selected) */}
          {selectedCategoryId !== 'ALL' && (
            <div
              style={{
                background: 'var(--surface-subtle)',
                borderRadius: 'var(--radius-lg)',
                border: '1.5px solid var(--border-color)',
                padding: '20px',
                marginBottom: '26px',
              }}
            >
              {/* Category Breadcrumbs & Title */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '16px',
                  paddingBottom: '14px',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: 'var(--fs-base)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId('ALL');
                      setSelectedSubcategoryId('ALL');
                    }} className="link-btn">
                    All Categories
                  </button>
                  <ChevronRight size={14} color="var(--text-light)" />
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {categoriesList.find((c) => c._id === selectedCategoryId)?.name || 'Selected Category'}
                  </span>
                  {selectedSubcategoryId !== 'ALL' && (
                    <>
                      <ChevronRight size={14} color="var(--text-light)" />
                      <span style={{ fontWeight: 700, color: 'var(--info)' }}>
                        {subcategoriesList.find((s) => s._id === selectedSubcategoryId)?.name}
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId('ALL');
                    setSelectedSubcategoryId('ALL');
                  }} className="btn btn-secondary btn-sm">
                  <ArrowLeft size={13} />
                  <span>View All Categories</span>
                </button>
              </div>

              {/* Subcategories Grid */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.04em' }}>
                  Choose a Subcategory:
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '12px',
                  }}
                >
                  {/* Card for "All in Category" */}
                  <div
                    onClick={() => setSelectedSubcategoryId('ALL')}
                    style={{
                      background: selectedSubcategoryId === 'ALL' ? 'var(--primary-light)' : 'var(--surface)',
                      border: selectedSubcategoryId === 'ALL' ? '2px solid var(--primary)' : '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      boxShadow: selectedSubcategoryId === 'ALL' ? 'none' : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-md)',
                        background: selectedSubcategoryId === 'ALL' ? 'var(--primary)' : 'var(--surface-muted)',
                        color: selectedSubcategoryId === 'ALL' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 8px',
                      }}
                    >
                      <Sparkles size={18} />
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: selectedSubcategoryId === 'ALL' ? 'var(--primary-hover)' : 'var(--text-main)' }}>
                      All Products
                    </div>
                    <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Entire Category
                    </div>
                  </div>

                  {/* Cards for each Subcategory */}
                  {subcategoriesList.map((subcat) => {
                    const isSelected = selectedSubcategoryId === subcat._id;
                    const subImg = subcat.imageUrl || subcat.image;

                    return (
                      <div
                        key={subcat._id}
                        onClick={() => setSelectedSubcategoryId(subcat._id)}
                        style={{
                          background: isSelected ? 'var(--primary-light)' : 'var(--surface)',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-strong)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '12px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                          boxShadow: isSelected ? 'none' : 'none',
                        }}
                      >
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--surface-subtle)',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 8px',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          {subImg ? (
                            <img
                              src={getAssetUrl(subImg)}
                              referrerPolicy="no-referrer"
                              alt={subcat.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                if (retryWithImageFallback(e.currentTarget as HTMLImageElement)) return;
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Package size={18} color="var(--primary)" />
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--fs-sm)',
                            fontWeight: 700,
                            color: isSelected ? 'var(--primary-hover)' : 'var(--text-main)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {subcat.name}
                        </div>
                        <div style={{ fontSize: 'var(--fs-2xs)', color: isSelected ? 'var(--primary)' : 'var(--text-muted)', marginTop: '2px' }}>
                          {isSelected ? '✓ Selected' : 'View Products'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Active Category & Subcategory Filter Status Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div>
              <h3 className="section-title" style={{ margin: 0 }}>
                {selectedSubcategoryId !== 'ALL'
                  ? `${subcategoriesList.find((s) => s._id === selectedSubcategoryId)?.name || 'Subcategory'} Products`
                  : selectedCategoryId !== 'ALL'
                  ? `All ${categoriesList.find((c) => c._id === selectedCategoryId)?.name || 'Category'} Products`
                  : 'All Available Products'}
              </h3>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Showing {products.length} {products.length === 1 ? 'product' : 'products'} available for purchase
              </p>
            </div>

            {(selectedCategoryId !== 'ALL' || selectedSubcategoryId !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('ALL');
                  setSelectedSubcategoryId('ALL');
                  setSearchQuery('');
                }} className="btn btn-soft btn-sm">
                Clear Filters
              </button>
            )}
          </div>

          {/* Products Grid */}
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid var(--border-strong)',
                  borderTopColor: 'var(--primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 16px',
                }}
              />
              <p style={{ fontWeight: 500 }}>Loading active products catalog...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="dashboard-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShoppingBag size={48} style={{ color: 'var(--text-disabled)', margin: '0 auto 16px' }} />
              <h3 className="section-title" style={{ marginBottom: '6px' }}>
                No Active Products Found
              </h3>
              <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-light)' }}>
                There are currently no products matching your filter criteria.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {products.map((prod) => {
                const primaryImg = prod.images?.find((img) => img.isPrimary) || prod.images?.[0];
                const stockAvailable = prod.stock ?? prod.stockQuantity ?? 0;
                const isOutOfStock = stockAvailable <= 0;
                const bv = prod.businessVolume ?? prod.bv ?? 0;
                const savings = prod.mrp && prod.mrp > prod.price ? prod.mrp - prod.price : 0;

                return (
                  <div
                    key={prod.productId || (prod as any)._id}
                    className="dashboard-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      padding: 0,
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {/* Image Banner */}
                    <div
                      style={{
                        position: 'relative',
                        height: '210px',
                        background: 'var(--surface-subtle)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleOpenProduct(prod)}
                    >
                      {primaryImg?.url ? (
                        <img
                          src={getAssetUrl(primaryImg.url)}
                          referrerPolicy="no-referrer"
                          alt={primaryImg.alt || prod.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            if (retryWithImageFallback(e.currentTarget as HTMLImageElement)) return;
                            (e.currentTarget as any).src = 'https://placehold.co/300x200?text=Product';
                          }}
                        />
                      ) : (
                        <ImageIcon size={48} color="var(--text-disabled)" />
                      )}

                      {/* Top Badges */}
                      <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px' }}>
                        <span
                          style={{
                            background: 'var(--primary-light)',
                            color: 'var(--primary-hover)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--primary-border)',
                          }}
                        >
                          {bv.toLocaleString()} BV
                        </span>
                        {savings > 0 && (
                          <span
                            style={{
                              background: 'var(--success-light)',
                              color: 'var(--success)',
                              fontSize: 'var(--fs-xs)',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            SAVE ₹{savings.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Stock Indicator */}
                      <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                        <span
                          style={{
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: isOutOfStock ? 'var(--danger-light)' : 'var(--success-light)',
                            color: isOutOfStock ? 'var(--danger)' : 'var(--success)',
                            border: `1px solid ${isOutOfStock ? 'var(--danger-border)' : 'var(--success-border)'}`,
                          }}
                        >
                          {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      {/* Category / Subcategory */}
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <span>
                          {typeof prod.categoryId === 'object' && prod.categoryId?.name ? prod.categoryId.name : (prod.category || 'General')}
                        </span>
                        {(prod.subcategoryId && typeof prod.subcategoryId === 'object' ? prod.subcategoryId.name : prod.subcategory) && (
                          <span style={{ color: 'var(--info)' }}>
                            • {typeof prod.subcategoryId === 'object' ? prod.subcategoryId.name : prod.subcategory}
                          </span>
                        )}
                      </div>

                      {/* Product Title */}
                      <h3
                        style={{
                          fontSize: 'var(--fs-lg)',
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          marginBottom: '6px',
                          lineHeight: '1.4',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleOpenProduct(prod)}
                      >
                        {prod.title || prod.name}
                      </h3>

                      {/* Short description */}
                      <p
                        style={{
                          fontSize: 'var(--fs-sm)',
                          color: 'var(--text-muted)',
                          lineHeight: '1.4',
                          marginBottom: '14px',
                          flex: 1,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {htmlToPlainText(prod.shortDescription) || 'High-quality health and wellness product.'}
                      </p>

                      {/* Price & BV Info Row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          marginBottom: '14px',
                          paddingTop: '10px',
                          borderTop: '1px solid var(--border-light)',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-main)' }}>
                            ₹{prod.price?.toLocaleString()}
                          </span>
                          {prod.mrp && prod.mrp > prod.price && (
                            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-light)', textDecoration: 'line-through', marginLeft: '6px' }}>
                              ₹{prod.mrp?.toLocaleString()}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--primary)' }}>
                          +{bv.toLocaleString()} BV
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenProduct(prod)} className="btn btn-secondary btn-sm">
                          <Eye size={14} /> Details
                        </button>

                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => handleAddToCart(prod, 1)}
                          style={{
                            padding: '8px 12px',
                            background: isOutOfStock ? 'var(--surface-sunken)' : 'var(--primary)',
                            color: isOutOfStock ? 'var(--text-light)' : 'var(--text-inverse)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--fs-sm)',
                            fontWeight: 700,
                            cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <ShoppingCart size={14} /> {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* CART DRAWER                                              */}
      {/* ======================================================== */}
      {isCartOpen && (
        <div className="modal-backdrop">
          <div className="modal modal-legacy" style={{ maxWidth: 420, display: 'flex', flexDirection: 'column' }} role="dialog" aria-modal="true">
            {/* Cart Header */}
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={20} color="var(--primary)" />
                <h3 className="section-title">Your Repurchase Cart</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Cart Items List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-light)' }}>
                  <ShoppingBag size={48} style={{ color: 'var(--text-disabled)', margin: '0 auto 16px' }} />
                  <p style={{ fontWeight: 600, fontSize: 'var(--fs-lg)', color: 'var(--text-body)', marginBottom: '4px' }}>
                    Your cart is empty
                  </p>
                  <p style={{ fontSize: 'var(--fs-base)' }}>Explore the products catalog to add items.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {cart.map((item) => {
                    const prodId = item.product.productId || (item.product as any)._id;
                    const primaryImg = item.product.images?.find((img) => img.isPrimary) || item.product.images?.[0];
                    const bv = item.product.businessVolume ?? item.product.bv ?? 0;

                    return (
                      <div
                        key={prodId}
                        style={{
                          display: 'flex',
                          gap: '12px',
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          background: 'var(--surface-subtle)',
                        }}
                      >
                        {/* Thumbnail */}
                        <div
                          style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: 'var(--radius-sm)',
                            overflow: 'hidden',
                            background: 'var(--surface)',
                            border: '1px solid var(--border-color)',
                            flexShrink: 0,
                          }}
                        >
                          {primaryImg?.url ? (
                            <img
                              src={getAssetUrl(primaryImg.url)}
                              referrerPolicy="no-referrer"
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                retryWithImageFallback(e.currentTarget);
                              }}
                            />
                          ) : (
                            <ImageIcon size={24} color="var(--text-disabled)" style={{ margin: '18px auto' }} />
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 'var(--fs-base)', color: 'var(--text-strong)', marginBottom: '2px' }}>
                            {item.product.title || item.product.name}
                          </div>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--primary)', fontWeight: 700, marginBottom: '6px' }}>
                            ₹{item.product.price?.toLocaleString()} • {bv.toLocaleString()} BV
                          </div>

                          {/* Quantity control */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 'var(--radius-xs)',
                                background: 'var(--surface)',
                              }}
                            >
                              <button
                                onClick={() => handleUpdateCartQty(prodId, item.quantity - 1)}
                                style={{ padding: '3px 8px', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                <Minus size={11} />
                              </button>
                              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, padding: '0 6px' }}>
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleUpdateCartQty(prodId, item.quantity + 1)}
                                style={{ padding: '3px 8px', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                <Plus size={11} />
                              </button>
                            </div>

                            <button
                              onClick={() => handleRemoveFromCart(prodId)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div
                style={{
                  padding: '20px',
                  borderTop: '1px solid var(--border-color)',
                  background: 'var(--surface-subtle)',
                }}
              >
                {/* Summary Rows */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-base)', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Items:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{cartItemCount} units</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 'var(--fs-md)',
                    fontWeight: 700,
                    color: 'var(--primary-hover)',
                    marginBottom: '8px',
                  }}
                >
                  <span>Business Volume (BV):</span>
                  <span>{cartTotalBV.toLocaleString()} BV</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 'var(--fs-xl)',
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    marginBottom: '18px',
                    paddingTop: '8px',
                    borderTop: '1px dashed var(--border-strong)',
                  }}
                >
                  <span>Payable Amount:</span>
                  <span>₹{cartTotalAmount.toLocaleString()}</span>
                </div>

                {/* Review Order & Proceed Button */}
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    // Visitors sign in first; the cart is kept in localStorage across login
                    if (!user?.memberId && onRequireLogin) {
                      onRequireLogin();
                      return;
                    }
                    setIsReviewModalOpen(true);
                  }}
                  disabled={checkoutLoading || cart.length === 0}
                  style={{
                    width: '100%',
                    padding: '13px',
                    background: 'var(--primary)',
                    color: 'var(--text-inverse)',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 700,
                    fontSize: 'var(--fs-md)',
                    border: 'none',
                    cursor: checkoutLoading || cart.length === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <FileText size={16} />
                  <span>Review Order & Proceed</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  onClick={handleClearCart}
                  disabled={checkoutLoading}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-light)',
                    fontSize: 'var(--fs-sm)',
                    cursor: 'pointer',
                  }}
                >
                  Clear Cart
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ORDER REVIEW & PURCHASE REQUEST CONFIRMATION MODAL       */}
      {/* ======================================================== */}
      {isReviewModalOpen && (
        <div className="modal-backdrop">
          <div className="modal modal-legacy" style={{ maxWidth: '600px', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '20px' }} role="dialog" aria-modal="true">
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ShoppingBag size={22} />
                </div>
                <div>
                  <h3 className="section-title" style={{ margin: 0 }}>
                    Review Repurchase Order
                  </h3>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                    Verify items before submitting your purchase request to Super Admin
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsReviewModalOpen(false);
                  setIsCartOpen(true);
                }}
                className="icon-btn"
                style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Selected Products List */}
            <div>
              <div
                style={{
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Order Items ({cartItemCount})
              </div>
              <div
                style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--surface-subtle)',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {cart.map((item) => {
                  const prodId = item.product.productId || (item.product as any)._id;
                  const primaryImg = item.product.images?.find((img) => img.isPrimary) || item.product.images?.[0];
                  const bv = (item.product.businessVolume ?? item.product.bv ?? 0) * item.quantity;
                  const itemTotal = item.product.price * item.quantity;

                  return (
                    <div
                      key={prodId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: 'var(--radius-sm)',
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)',
                            background: 'var(--surface-subtle)',
                            flexShrink: 0,
                          }}
                        >
                          {primaryImg?.url ? (
                            <img src={getAssetUrl(primaryImg.url)} referrerPolicy="no-referrer" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { retryWithImageFallback(e.currentTarget); }} />
                          ) : (
                            <ImageIcon size={18} color="var(--text-disabled)" style={{ margin: '12px auto' }} />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 'var(--fs-base)',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '220px',
                            }}
                          >
                            {item.product.title || item.product.name}
                          </div>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                            Qty: <strong style={{ color: 'var(--text-main)' }}>{item.quantity}</strong> × ₹{item.product.price.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-main)' }}>
                          ₹{itemTotal.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--primary)' }}>
                          +{bv.toLocaleString()} BV
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Metrics Highlights Card */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
              }}
            >
              <div
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total Items
                </div>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  {cartItemCount} Units
                </div>
              </div>

              <div
                style={{
                  background: 'var(--primary-light)',
                  border: '1px solid var(--primary-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total Volume
                </div>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--primary-hover)', marginTop: '2px' }}>
                  +{cartTotalBV.toLocaleString()} BV
                </div>
              </div>

              <div
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Payable Total
                </div>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  ₹{cartTotalAmount.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Explanation / Multi-Step Pipeline Notice */}
            <div
              style={{
                background: 'var(--info-light)',
                border: '1px solid var(--info-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--info-strong)',
                  fontWeight: 700,
                  fontSize: 'var(--fs-base)',
                  marginBottom: '8px',
                }}
              >
                <Info size={16} />
                <span>Next Steps in the Purchase Workflow</span>
              </div>
              {paymentMethod === 'BV_WALLET' ? (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: 'var(--fs-sm)', color: 'var(--info-strong)', lineHeight: '1.6' }}>
                  <li>The BV is deducted from your BV Wallet when you submit.</li>
                  <li>Super Admin verifies the order; if it is rejected, the BV returns to your wallet.</li>
                  <li><strong>+{cartTotalBV.toLocaleString()} BV</strong> will be credited to your account upon verification.</li>
                </ul>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: 'var(--fs-sm)', color: 'var(--info-strong)', lineHeight: '1.6' }}>
                  <li>Your request will be submitted directly to Super Admin for approval.</li>
                  <li>Once approved, you will receive company bank account & UPI QR details to make payment.</li>
                  <li>Submit your transaction ID (UTR) after payment for instant admin verification.</li>
                  <li><strong>+{cartTotalBV.toLocaleString()} BV</strong> will be credited to your account upon verification.</li>
                </ul>
              )}
            </div>

            <PaymentMethodPicker
              amountInr={cartTotalAmount}
              amountBV={cartTotalBV}
              value={paymentMethod}
              onChange={setPaymentMethod}
              disabled={checkoutLoading}
            />

            {/* Optional Delivery / Order Notes */}
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 6 }}
              >
                Delivery Note / Instructions (Optional)
              </label>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="e.g. Please ship via standard courier to registered address"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-strong)',
                  fontSize: 'var(--fs-base)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsReviewModalOpen(false);
                  setIsCartOpen(true);
                }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                <ArrowLeft size={16} />
                <span>Back to Cart</span>
              </button>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={checkoutLoading} className="btn btn-primary" style={{ flex: 1.6 }}>
                <Send size={16} />
                <span>
                  {checkoutLoading
                    ? 'Submitting Request...'
                    : paymentMethod === 'BV_WALLET'
                      ? 'Pay with BV & Send to Super Admin'
                      : 'Send Request to Super Admin'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberProductsPage;
