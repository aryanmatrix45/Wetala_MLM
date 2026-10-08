import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  ArrowRight,
  Image as ImageIcon,
} from 'lucide-react';
import { api, type ProductItem, type CategoryItem, type SubcategoryItem } from '../services/api';

interface MemberProductsPageProps {
  user?: any;
  token?: string | null;
}

interface CartItem {
  product: ProductItem;
  quantity: number;
}

export const MemberProductsPage: React.FC<MemberProductsPageProps> = ({ user: propUser }) => {
  const savedUserStr = localStorage.getItem('wetala_user');
  const user = propUser || (savedUserStr ? JSON.parse(savedUserStr) : null);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('ALL');
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);
  const [subcategoriesList, setSubcategoriesList] = useState<SubcategoryItem[]>([]);

  // Selected product for details modal
  const [viewProduct, setViewProduct] = useState<ProductItem | null>(null);
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
  const [checkoutLoading, setCheckoutLoading] = useState(false);
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
      alert('You must be logged in as an active member to checkout.');
      return;
    }

    try {
      setCheckoutLoading(true);
      setFeedback(null);

      // Map cart items for backend order creation
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
        notes: `Product Repurchase order placed by member ${user.name || user.memberId}`,
      });

      if (res.status && res.data) {
        setCart([]);
        setIsCartOpen(false);
        setFeedback({
          type: 'success',
          message: `Order #${res.data.purchaseId} placed successfully! ${res.data.totalBV?.toLocaleString()} BV credited to your account.`,
          purchase: res.data,
        });
        // Reload products to reflect updated inventory
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

  return (
    <div className="page-body">
      {/* Top Banner */}
      <div className="welcome-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
                color: 'white',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              MEMBER STORE
            </span>
            <span style={{ color: '#64748b', fontSize: '13px' }}>
              Panchwati Wellness • Ayurvedic & Health Products
            </span>
          </div>

          <h1 className="page-title">Products & Repurchase</h1>
          <p className="page-subtitle">
            Browse genuine products, earn independent Business Volume (BV) with every purchase, and qualify for
            repurchase binary team bonuses.
          </p>
        </div>

        {/* Floating Cart Button */}
        <div>
          <button
            onClick={() => setIsCartOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: '#1d72fe',
              color: '#fff',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(29, 114, 254, 0.3)',
              position: 'relative',
            }}
          >
            <ShoppingCart size={18} />
            <span>Cart ({cartItemCount})</span>
            {cartTotalAmount > 0 && (
              <span
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              >
                ₹{cartTotalAmount.toLocaleString()}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Order Feedback Alert */}
      {feedback && (
        <div
          style={{
            padding: '14px 18px',
            marginBottom: '24px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{feedback.message}</div>
              {feedback.purchase && (
                <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.9 }}>
                  Transaction ID: {feedback.purchase.transactionId} • Total Amount: ₹
                  {feedback.purchase.totalAmount?.toLocaleString()}
                </div>
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
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
          />
          <input
            type="text"
            placeholder="Search products by name, benefits, or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              background: '#fff',
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
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: selectedCategoryId === 'ALL' ? '1px solid #2563eb' : '1px solid #cbd5e1',
              background: selectedCategoryId === 'ALL' ? '#eff6ff' : '#fff',
              color: selectedCategoryId === 'ALL' ? '#1d4ed8' : '#64748b',
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
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: selectedCategoryId === cat._id ? '1px solid #2563eb' : '1px solid #cbd5e1',
                background: selectedCategoryId === cat._id ? '#eff6ff' : '#fff',
                color: selectedCategoryId === cat._id ? '#1d4ed8' : '#64748b',
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Subcategory Pills (when a specific category is selected and has subcategories) */}
      {selectedCategoryId !== 'ALL' && subcategoriesList.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
            padding: '10px 16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            overflowX: 'auto',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginRight: '4px', flexShrink: 0 }}>
            Subcategories:
          </span>
          <button
            onClick={() => setSelectedSubcategoryId('ALL')}
            style={{
              padding: '4px 12px',
              borderRadius: '16px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              border: selectedSubcategoryId === 'ALL' ? '1px solid #0284c7' : '1px solid #cbd5e1',
              background: selectedSubcategoryId === 'ALL' ? '#e0f2fe' : '#fff',
              color: selectedSubcategoryId === 'ALL' ? '#0369a1' : '#64748b',
              flexShrink: 0,
            }}
          >
            All
          </button>
          {subcategoriesList.map((subcat) => (
            <button
              key={subcat._id}
              onClick={() => setSelectedSubcategoryId(subcat._id)}
              style={{
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                border: selectedSubcategoryId === subcat._id ? '1px solid #0284c7' : '1px solid #cbd5e1',
                background: selectedSubcategoryId === subcat._id ? '#e0f2fe' : '#fff',
                color: selectedSubcategoryId === subcat._id ? '#0369a1' : '#64748b',
                flexShrink: 0,
              }}
            >
              {subcat.name}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid #cbd5e1',
              borderTopColor: '#1d72fe',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ fontWeight: 500 }}>Loading active products catalog...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="dashboard-card" style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          <ShoppingBag size={48} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
            No Active Products Found
          </h3>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
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
                  border: '1px solid #e2e8f0',
                }}
              >
                {/* Image Banner */}
                <div
                  style={{
                    position: 'relative',
                    height: '210px',
                    background: '#f8fafc',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setViewProduct(prod);
                    setActiveImageIdx(0);
                    setDetailQty(1);
                  }}
                >
                  {primaryImg?.url ? (
                    <img
                      src={primaryImg.url}
                      alt={primaryImg.alt || prod.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.currentTarget as any).src = 'https://placehold.co/300x200?text=Product';
                      }}
                    />
                  ) : (
                    <ImageIcon size={48} color="#cbd5e1" />
                  )}

                  {/* Top Badges */}
                  <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px' }}>
                    <span
                      style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      {bv.toLocaleString()} BV
                    </span>
                    {savings > 0 && (
                      <span
                        style={{
                          background: '#ecfdf5',
                          color: '#059669',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
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
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: isOutOfStock ? '#fef2f2' : '#ecfdf5',
                        color: isOutOfStock ? '#dc2626' : '#16a34a',
                        border: `1px solid ${isOutOfStock ? '#fecaca' : '#a7f3d0'}`,
                      }}
                    >
                      {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {/* Category / Subcategory */}
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    <span>
                      {typeof prod.categoryId === 'object' && prod.categoryId?.name ? prod.categoryId.name : (prod.category || 'General')}
                    </span>
                    {(prod.subcategoryId && typeof prod.subcategoryId === 'object' ? prod.subcategoryId.name : prod.subcategory) && (
                      <span style={{ color: '#0284c7' }}>
                        • {typeof prod.subcategoryId === 'object' ? prod.subcategoryId.name : prod.subcategory}
                      </span>
                    )}
                  </div>

                  {/* Product Title */}
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#0f172a',
                      marginBottom: '6px',
                      lineHeight: '1.4',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setViewProduct(prod);
                      setActiveImageIdx(0);
                      setDetailQty(1);
                    }}
                  >
                    {prod.title || prod.name}
                  </h3>

                  {/* Short description */}
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#64748b',
                      lineHeight: '1.4',
                      marginBottom: '14px',
                      flex: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {prod.shortDescription || 'High-quality health and wellness product.'}
                  </p>

                  {/* Price & BV Info Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginBottom: '14px',
                      paddingTop: '10px',
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                        ₹{prod.price?.toLocaleString()}
                      </span>
                      {prod.mrp && prod.mrp > prod.price && (
                        <span style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'line-through', marginLeft: '6px' }}>
                          ₹{prod.mrp?.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>
                      +{bv.toLocaleString()} BV
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setViewProduct(prod);
                        setActiveImageIdx(0);
                        setDetailQty(1);
                      }}
                      style={{
                        padding: '8px 12px',
                        background: '#f8fafc',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <Eye size={14} /> Details
                    </button>

                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => handleAddToCart(prod, 1)}
                      style={{
                        padding: '8px 12px',
                        background: isOutOfStock ? '#e2e8f0' : '#1d72fe',
                        color: isOutOfStock ? '#94a3b8' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
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

      {/* ======================================================== */}
      {/* PRODUCT DETAILS MODAL                                    */}
      {/* ======================================================== */}
      {viewProduct && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '840px',
              maxWidth: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              padding: '28px',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setViewProduct(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '28px' }}>
              {/* Left: Image Gallery */}
              <div>
                {/* Main Large Image */}
                <div
                  style={{
                    width: '100%',
                    height: '280px',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {viewProduct.images && viewProduct.images.length > 0 ? (
                    <img
                      src={viewProduct.images[activeImageIdx]?.url || viewProduct.images[0]?.url}
                      alt={viewProduct.title}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <ImageIcon size={48} color="#cbd5e1" />
                  )}
                </div>

                {/* Thumbnail strip */}
                {viewProduct.images && viewProduct.images.length > 1 && (
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                    {viewProduct.images.map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setActiveImageIdx(i)}
                        style={{
                          width: '54px',
                          height: '54px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          border: activeImageIdx === i ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Product Specs & Actions */}
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    Category: {typeof viewProduct.categoryId === 'object' && viewProduct.categoryId?.name ? viewProduct.categoryId.name : (viewProduct.category || 'General')}
                  </span>
                  {(viewProduct.subcategoryId && typeof viewProduct.subcategoryId === 'object' ? viewProduct.subcategoryId.name : viewProduct.subcategory) && (
                    <span
                      style={{
                        background: '#e0f2fe',
                        color: '#0369a1',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      Subcategory: {typeof viewProduct.subcategoryId === 'object' ? viewProduct.subcategoryId.name : viewProduct.subcategory}
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: '#64748b' }}>SKU: {viewProduct.sku}</span>
                </div>

                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                  {viewProduct.title || viewProduct.name}
                </h2>

                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                  {viewProduct.shortDescription}
                </p>

                {/* Price & BV Box */}
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '16px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>
                      ₹{viewProduct.price?.toLocaleString()}
                    </div>
                    {viewProduct.mrp && viewProduct.mrp > viewProduct.price && (
                      <div style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'line-through' }}>
                        MRP ₹{viewProduct.mrp?.toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontWeight: 800,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      {(viewProduct.businessVolume ?? viewProduct.bv ?? 0).toLocaleString()} BV
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      Credited upon purchase
                    </div>
                  </div>
                </div>

                {/* Stock status */}
                <div style={{ marginBottom: '16px', fontSize: '13px' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>Availability: </span>
                  {(() => {
                    const stock = viewProduct.stock ?? viewProduct.stockQuantity ?? 0;
                    return (
                      <span style={{ fontWeight: 700, color: stock > 0 ? '#16a34a' : '#dc2626' }}>
                        {stock > 0 ? `${stock} units in stock` : 'Currently Out of Stock'}
                      </span>
                    );
                  })()}
                </div>

                {/* Quantity and Add to Cart Row */}
                {(viewProduct.stock ?? viewProduct.stockQuantity ?? 0) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => setDetailQty(Math.max(1, detailQty - 1))}
                        style={{ padding: '8px 12px', background: '#f8fafc', border: 'none', cursor: 'pointer' }}
                      >
                        <Minus size={14} />
                      </button>
                      <span style={{ padding: '8px 16px', fontWeight: 700, fontSize: '14px' }}>{detailQty}</span>
                      <button
                        onClick={() =>
                          setDetailQty(
                            Math.min(viewProduct.stock ?? viewProduct.stockQuantity ?? 100, detailQty + 1)
                          )
                        }
                        style={{ padding: '8px 12px', background: '#f8fafc', border: 'none', cursor: 'pointer' }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        handleAddToCart(viewProduct, detailQty);
                        setViewProduct(null);
                      }}
                      className="btn-primary"
                      style={{
                        flex: 1,
                        padding: '12px',
                        fontSize: '14px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      <ShoppingCart size={16} /> Add {detailQty} to Cart
                    </button>
                  </div>
                )}

                {/* Rich Description */}
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Product Details & Directions
                  </h4>
                  <div
                    style={{
                      maxHeight: '180px',
                      overflowY: 'auto',
                      padding: '12px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      color: '#475569',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: viewProduct.description || '<em>No additional description provided.</em>',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CART DRAWER / MODAL                                      */}
      {/* ======================================================== */}
      {isCartOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1100,
          }}
        >
          <div
            style={{
              width: '420px',
              maxWidth: '100%',
              height: '100%',
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-10px 0 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Cart Header */}
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={20} color="#1d72fe" />
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>Your Repurchase Cart</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Cart Items List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                  <ShoppingBag size={48} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
                  <p style={{ fontWeight: 600, fontSize: '15px', color: '#334155', marginBottom: '4px' }}>
                    Your cart is empty
                  </p>
                  <p style={{ fontSize: '13px' }}>Explore the products catalog to add items.</p>
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
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                        }}
                      >
                        {/* Thumbnail */}
                        <div
                          style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            flexShrink: 0,
                          }}
                        >
                          {primaryImg?.url ? (
                            <img
                              src={primaryImg.url}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <ImageIcon size={24} color="#cbd5e1" style={{ margin: '18px auto' }} />
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '2px' }}>
                            {item.product.title || item.product.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, marginBottom: '6px' }}>
                            ₹{item.product.price?.toLocaleString()} • {bv.toLocaleString()} BV
                          </div>

                          {/* Quantity control */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                background: '#fff',
                              }}
                            >
                              <button
                                onClick={() => handleUpdateCartQty(prodId, item.quantity - 1)}
                                style={{ padding: '3px 8px', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                <Minus size={11} />
                              </button>
                              <span style={{ fontSize: '12px', fontWeight: 700, padding: '0 6px' }}>
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
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
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
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}
              >
                {/* Summary Rows */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>Total Items:</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{cartItemCount} units</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#1d4ed8',
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
                    fontSize: '18px',
                    fontWeight: 800,
                    color: '#0f172a',
                    marginBottom: '18px',
                    paddingTop: '8px',
                    borderTop: '1px dashed #cbd5e1',
                  }}
                >
                  <span>Payable Amount:</span>
                  <span>₹{cartTotalAmount.toLocaleString()}</span>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#1d72fe',
                    color: '#fff',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '14px',
                    border: 'none',
                    cursor: checkoutLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(29, 114, 254, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <ArrowRight size={16} />
                  <span>{checkoutLoading ? 'Processing Order...' : 'Place Repurchase Order'}</span>
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
                    color: '#94a3b8',
                    fontSize: '12px',
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
    </div>
  );
};
