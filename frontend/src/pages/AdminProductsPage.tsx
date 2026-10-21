import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, DollarSign, Edit3, Eye, ImageIcon, Layers, MoveLeft, MoveRight, Package, Plus, RefreshCw, Search, Sparkles, Star, Tag, Trash2, UploadCloud, X, XCircle } from 'lucide-react';
import { api, type ProductItem, type ProductImage, type CategoryItem, type SubcategoryItem, getAssetUrl, retryWithImageFallback } from '../services/api';
import { CKEditorField } from '../components/CKEditorField';
import { htmlToPlainText } from '../utils/text';

interface AdminProductsPageProps {
  user?: any;
  token?: string | null;
}

export const AdminProductsPage: React.FC<AdminProductsPageProps> = ({ token: propToken }) => {
  const savedToken = propToken || localStorage.getItem('wetala_token') || '';

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('ALL');
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);
  const [filterSubcategories, setFilterSubcategories] = useState<SubcategoryItem[]>([]);

  // Subcategories available for current form's selected category
  const [formSubcategories, setFormSubcategories] = useState<SubcategoryItem[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);

  // View Mode: 'list' | 'create' | 'edit' | 'details'
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit' | 'details'>('list');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Notifications / Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State for Create & Edit
  const [formData, setFormData] = useState<{
    title: string;
    slug: string;
    sku: string;
    categoryId: string;
    subcategoryId: string;
    brand: string;
    shortDescription: string;
    description: string;
    price: number | string;
    mrp: number | string;
    businessVolume: number | string;
    stock: number | string;
    status: 'ACTIVE' | 'INACTIVE';
    showOnHome: boolean;
    homeOrder: number | string;
    images: ProductImage[];
  }>({
    title: '',
    slug: '',
    sku: '',
    categoryId: '',
    subcategoryId: '',
    brand: '',
    shortDescription: '',
    description: '',
    price: '',
    mrp: '',
    businessVolume: '',
    stock: 100,
    status: 'ACTIVE',
    showOnHome: false,
    homeOrder: 0,
    images: [],
  });

  // Manual URL input modal for images
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [manualImageAlt, setManualImageAlt] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceIndexRef = useRef<number | null>(null);

  // Auto-slugify generator
  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  const handleTitleChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      title: val,
      // Only auto-update slug if in create mode or slug was matching previous title
      slug: viewMode === 'create' ? slugify(val) : prev.slug,
    }));
  };

  // Generate unique SKU
  const generateSKU = () => {
    const prefix = 'WET';
    const selectedCat = categoriesList.find(c => c._id === formData.categoryId);
    const catCode = (selectedCat?.slug || 'GEN').substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const sku = `${prefix}-${catCode}-${random}`;
    setFormData(prev => ({ ...prev, sku }));
  };

  // Fetch Categories for Dropdowns & Filters
  const loadCategories = async () => {
    try {
      const res = await api.adminGetCategories({ limit: 100 }, savedToken);
      if (res.status && Array.isArray(res.data)) {
        setCategoriesList(res.data);
      }
    } catch (err) {
      console.error('Failed to load categories for admin products:', err);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // When categoryFilter changes, load filter subcategories
  useEffect(() => {
    if (categoryFilter !== 'ALL') {
      api.adminGetSubcategories({ categoryId: categoryFilter, limit: 100 }, savedToken)
        .then((res) => {
          if (res.status && Array.isArray(res.data)) {
            setFilterSubcategories(res.data);
          } else {
            setFilterSubcategories([]);
          }
        })
        .catch(() => setFilterSubcategories([]));
    } else {
      setFilterSubcategories([]);
    }
  }, [categoryFilter]);

  // Fetch Products from API
  const loadProducts = async (page = pagination.page) => {
    try {
      setLoading(true);
      setFeedback(null);
      const res = await api.adminGetProducts(
        {
          page,
          limit: pagination.limit,
          search: searchQuery,
          status: statusFilter,
          categoryId: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          subcategoryId: subcategoryFilter !== 'ALL' ? subcategoryFilter : undefined,
        },
        savedToken
      );

      if (res.status && Array.isArray(res.data)) {
        setProducts(res.data);
        if (res.pagination) {
          setPagination({
            page: res.pagination.page,
            limit: res.pagination.limit,
            total: res.pagination.total,
            totalPages: res.pagination.totalPages,
          });
        }
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      console.error('Failed to load admin products:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch products from backend.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts(1);
  }, [searchQuery, statusFilter, categoryFilter, subcategoryFilter]);

  // Handle Category selection change in Create / Edit form
  const handleCategoryChange = async (catId: string) => {
    setFormData(prev => ({
      ...prev,
      categoryId: catId,
      subcategoryId: '', // Clear subcategory on category change
    }));

    if (catId) {
      try {
        setLoadingSubcategories(true);
        const res = await api.adminGetSubcategories({ categoryId: catId, status: 'ACTIVE', limit: 100 }, savedToken);
        if (res.status && Array.isArray(res.data)) {
          setFormSubcategories(res.data);
        } else {
          setFormSubcategories([]);
        }
      } catch (err) {
        console.error('Failed to load subcategories for category:', err);
        setFormSubcategories([]);
      } finally {
        setLoadingSubcategories(false);
      }
    } else {
      setFormSubcategories([]);
    }
  };

  // Open Create Form
  const openCreateForm = () => {
    const defaultCatId = categoriesList.length > 0 ? categoriesList[0]._id : '';
    setFormData({
      title: '',
      slug: '',
      sku: `WET-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      categoryId: defaultCatId,
      subcategoryId: '',
      brand: 'Panchveda Wellness',
      shortDescription: '',
      description: '<p>Enter comprehensive product details, benefits, ingredients, and usage guidelines here.</p>',
      price: '',
      mrp: '',
      businessVolume: '',
      stock: 50,
      status: 'ACTIVE',
      showOnHome: false,
      homeOrder: 0,
      images: [],
    });
    setSelectedProduct(null);
    setViewMode('create');

    if (defaultCatId) {
      handleCategoryChange(defaultCatId);
    } else {
      setFormSubcategories([]);
    }
  };

  // Open Edit Form
  const openEditForm = async (prod: ProductItem) => {
    setSelectedProduct(prod);
    const catId = typeof prod.categoryId === 'object' && prod.categoryId ? (prod.categoryId as any)._id : (prod.categoryId || '');
    const subcatId = typeof prod.subcategoryId === 'object' && prod.subcategoryId ? (prod.subcategoryId as any)._id : (prod.subcategoryId || '');

    setFormData({
      title: prod.title || prod.name || '',
      slug: prod.slug || '',
      sku: prod.sku || '',
      categoryId: catId,
      subcategoryId: subcatId,
      brand: prod.brand || '',
      shortDescription: prod.shortDescription || '',
      description: prod.description || '',
      price: prod.price !== undefined ? prod.price : '',
      mrp: prod.mrp !== undefined ? prod.mrp : '',
      businessVolume: prod.businessVolume !== undefined ? prod.businessVolume : (prod.bv !== undefined ? prod.bv : ''),
      stock: prod.stock !== undefined ? prod.stock : (prod.stockQuantity !== undefined ? prod.stockQuantity : 0),
      status: prod.status || (prod.isActive ? 'ACTIVE' : 'INACTIVE'),
      showOnHome: Boolean(prod.showOnHome || prod.isFeatured),
      homeOrder: prod.homeOrder !== undefined ? prod.homeOrder : 0,
      images: Array.isArray(prod.images) ? [...prod.images] : [],
    });

    if (catId) {
      try {
        setLoadingSubcategories(true);
        const res = await api.adminGetSubcategories({ categoryId: catId, limit: 100 }, savedToken);
        if (res.status && Array.isArray(res.data)) {
          setFormSubcategories(res.data);
        } else {
          setFormSubcategories([]);
        }
      } catch {
        setFormSubcategories([]);
      } finally {
        setLoadingSubcategories(false);
      }
    } else {
      setFormSubcategories([]);
    }

    setViewMode('edit');
  };

  // Open Details Modal / View
  const openDetailsView = (prod: ProductItem) => {
    setSelectedProduct(prod);
    setViewMode('details');
  };

  // Toggle Active / Inactive Status
  const handleToggleStatus = async (prod: ProductItem) => {
    try {
      setSubmitting(true);
      const newStatus = prod.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await api.adminUpdateProductStatus(prod.productId || (prod as any)._id, newStatus, savedToken);
      if (res.status) {
        setFeedback({
          type: 'success',
          message: `Product "${prod.title}" is now ${newStatus}.`,
        });
        await loadProducts(pagination.page);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Status toggle failed.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to toggle status.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Show on Home Showcase
  const handleToggleShowOnHome = async (prod: ProductItem) => {
    try {
      setSubmitting(true);
      const nextVal = !prod.showOnHome;
      const res = await api.adminToggleProductShowOnHome(prod.productId || (prod as any)._id, nextVal, savedToken);
      if (res.status) {
        setFeedback({
          type: 'success',
          message: res.message || `Product "${prod.title}" homepage showcase updated.`,
        });
        await loadProducts(pagination.page);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Showcase toggle failed.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to toggle homepage showcase.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (prod: ProductItem) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${prod.title}"? This cannot be undone.`)) {
      return;
    }
    try {
      setDeletingId(prod.productId || (prod as any)._id);
      const res = await api.adminDeleteProduct(prod.productId || (prod as any)._id, savedToken);
      if (res.status) {
        setFeedback({ type: 'success', message: res.message || 'Product deleted successfully.' });
        await loadProducts(pagination.page);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to delete product.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error deleting product.' });
    } finally {
      setDeletingId(null);
    }
  };

  // Image Upload Handling (Base64 -> Storage API)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    const replaceIndex = replaceIndexRef.current;
    replaceIndexRef.current = null;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Data = event.target?.result as string;
          const res = await api.adminUploadProductImage(
            {
              data: base64Data,
              filename: file.name,
              alt: file.name.replace(/\.[^/.]+$/, ''),
            },
            savedToken
          );

          if (res.status && res.data) {
            const uploadedImg: ProductImage = {
              url: res.data.url,
              key: res.data.key,
              alt: res.data.alt || file.name,
              isPrimary: formData.images.length === 0,
              sortOrder: formData.images.length,
            };

            setFormData(prev => {
              if (replaceIndex !== null && replaceIndex >= 0 && replaceIndex < prev.images.length) {
                // Replace image at specific index
                const updated = [...prev.images];
                updated[replaceIndex] = {
                  ...uploadedImg,
                  isPrimary: prev.images[replaceIndex].isPrimary,
                  sortOrder: prev.images[replaceIndex].sortOrder,
                };
                return { ...prev, images: updated };
              } else {
                // Append image
                const nextImages = [...prev.images, uploadedImg];
                if (!nextImages.some(img => img.isPrimary)) {
                  nextImages[0].isPrimary = true;
                }
                return { ...prev, images: nextImages };
              }
            });
          } else {
            alert(res.message || 'Image upload failed.');
          }
        } catch (err: any) {
          console.error('Image upload failed:', err);
          alert('Failed to upload image to server.');
        } finally {
          setUploadingImage(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Add Image via Direct URL
  const handleAddManualUrl = () => {
    if (!manualImageUrl.trim()) return;
    const newImg: ProductImage = {
      url: manualImageUrl.trim(),
      key: `url_${Date.now()}`,
      alt: manualImageAlt.trim() || formData.title,
      isPrimary: formData.images.length === 0,
      sortOrder: formData.images.length,
    };
    setFormData(prev => {
      const nextImages = [...prev.images, newImg];
      if (!nextImages.some(img => img.isPrimary)) {
        nextImages[0].isPrimary = true;
      }
      return { ...prev, images: nextImages };
    });
    setManualImageUrl('');
    setManualImageAlt('');
    setIsUrlModalOpen(false);
  };

  // Set Primary Image
  const handleSetPrimaryImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.map((img, i) => ({
        ...img,
        isPrimary: i === index,
      })),
    }));
  };

  // Reorder Images (Move Left / Right)
  const handleMoveImage = (index: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= formData.images.length) return;

    setFormData(prev => {
      const images = [...prev.images];
      const temp = images[index];
      images[index] = images[targetIdx];
      images[targetIdx] = temp;
      return {
        ...prev,
        images: images.map((img, idx) => ({ ...img, sortOrder: idx })),
      };
    });
  };

  // Delete Individual Image
  const handleDeleteImage = (index: number) => {
    setFormData(prev => {
      const filtered = prev.images.filter((_, i) => i !== index);
      if (filtered.length > 0 && !filtered.some(img => img.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return {
        ...prev,
        images: filtered.map((img, idx) => ({ ...img, sortOrder: idx })),
      };
    });
  };

  // Trigger Image Replacement
  const handleReplaceImage = (index: number) => {
    replaceIndexRef.current = index;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Form Submission (Create or Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!formData.title.trim()) {
      setFeedback({ type: 'error', message: 'Product title is required.' });
      return;
    }
    if (!formData.sku.trim()) {
      setFeedback({ type: 'error', message: 'Product SKU is required.' });
      return;
    }
    if (formData.price === '' || Number(formData.price) < 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid price >= 0.' });
      return;
    }
    if (formData.businessVolume === '' || Number(formData.businessVolume) < 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid Business Volume (BV) >= 0.' });
      return;
    }
    if (!formData.categoryId) {
      setFeedback({ type: 'error', message: 'Please select a product Category.' });
      return;
    }

    try {
      setSubmitting(true);
      const selectedCatDoc = categoriesList.find(c => c._id === formData.categoryId);
      const selectedSubcatDoc = formSubcategories.find(s => s._id === formData.subcategoryId);

      const payload = {
        title: formData.title.trim(),
        slug: formData.slug.trim() || slugify(formData.title),
        sku: formData.sku.trim().toUpperCase(),
        categoryId: formData.categoryId,
        subcategoryId: formData.subcategoryId || null,
        category: selectedCatDoc ? selectedCatDoc.name : 'General',
        subcategory: selectedSubcatDoc ? selectedSubcatDoc.name : undefined,
        brand: formData.brand.trim(),
        shortDescription: formData.shortDescription.trim(),
        description: formData.description,
        price: Number(formData.price),
        mrp: formData.mrp !== '' ? Number(formData.mrp) : Number(formData.price),
        businessVolume: Number(formData.businessVolume),
        stock: Number(formData.stock || 0),
        status: formData.status,
        showOnHome: formData.showOnHome,
        homeOrder: Number(formData.homeOrder) || 0,
        images: formData.images,
      };

      let res;
      if (viewMode === 'create') {
        res = await api.adminCreateProduct(payload, savedToken);
      } else {
        const idToUpdate = selectedProduct?.productId || (selectedProduct as any)?._id;
        res = await api.adminUpdateProduct(idToUpdate, payload, savedToken);
      }

      if (res.status) {
        setFeedback({
          type: 'success',
          message: viewMode === 'create' ? 'Product created successfully!' : 'Product updated successfully!',
        });
        setViewMode('list');
        await loadProducts(1);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Operation failed.' });
      }
    } catch (err: any) {
      console.error('Error saving product:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to save product.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-body">
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* Header Banner */}
      <div className="welcome-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">
            {viewMode === 'list' && 'Product Management'}
            {viewMode === 'create' && 'Add New Product'}
            {viewMode === 'edit' && `Edit Product: ${formData.title}`}
            {viewMode === 'details' && `Product Details: ${selectedProduct?.title}`}
          </h1>

          <p className="page-subtitle">
            {viewMode === 'list' &&
              'Manage catalog, configure independent Business Volume (BV), upload multiple images, and toggle status.'}
            {viewMode === 'create' &&
              'Configure rich descriptions with CKEditor, upload gallery images, inventory, and MLM BV allocation.'}
            {viewMode === 'edit' &&
              'Update product pricing, stock availability, multi-image gallery, and specifications.'}
            {viewMode === 'details' &&
              'View authoritative SKU, image gallery, customer preview, and immutable BV configuration.'}
          </p>
        </div>

        {/* Top Action Button */}
        <div>
          {viewMode === 'list' ? (
            <button
              onClick={openCreateForm}
              className="btn btn-primary"
            >
              <Plus size={18} />
              <span>Add Product</span>
            </button>
          ) : (
            <button
              onClick={() => setViewMode('list')}
              className="btn btn-secondary"
            >
              <ArrowLeft size={16} />
              <span>Back to Products</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            color: feedback.type === 'success' ? 'var(--success-strong)' : 'var(--danger-strong)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span style={{ fontSize: 'var(--fs-md)', fontWeight: 500 }}>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. PRODUCT LIST VIEW                                      */}
      {/* ======================================================== */}
      {viewMode === 'list' && (
        <div className="dashboard-card">
          {/* Search & Filters Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '280px', flex: 1, maxWidth: '400px' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}
              />
              <input
                type="text"
                placeholder="Search by title, SKU, brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-strong)',
                  fontSize: 'var(--fs-base)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Filter Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-strong)',
                  fontSize: 'var(--fs-base)',
                  background: 'var(--surface)',
                  color: 'var(--text-body)',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setSubcategoryFilter('ALL');
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-strong)',
                  fontSize: 'var(--fs-base)',
                  background: 'var(--surface)',
                  color: 'var(--text-body)',
                }}
              >
                <option value="ALL">All Categories</option>
                {categoriesList.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Subcategory Filter (dependent on selected Category) */}
              {categoryFilter !== 'ALL' && (
                <select
                  value={subcategoryFilter}
                  onChange={(e) => setSubcategoryFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 'var(--fs-base)',
                    background: 'var(--surface)',
                    color: 'var(--text-body)',
                  }}
                >
                  <option value="ALL">All Subcategories</option>
                  {filterSubcategories.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Refresh Button */}
              <button
                onClick={() => loadProducts(pagination.page)}
                className="btn btn-secondary"
                title="Refresh table"
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>Image</th>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>BV</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Home Showcase</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && products.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-light)' }}>
                      <div style={{ width: '24px', height: '24px', border: '2px solid var(--border-strong)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                      Loading products...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Package size={40} style={{ color: 'var(--text-disabled)', margin: '0 auto 12px' }} />
                      <p style={{ fontWeight: 600, fontSize: 'var(--fs-lg)', color: 'var(--text-body)', marginBottom: '4px' }}>No products found</p>
                      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-light)', marginBottom: '16px' }}>Try adjusting your search criteria or add your first product.</p>
                      <button onClick={openCreateForm} className="btn btn-primary">
                        + Add First Product
                      </button>
                    </td>
                  </tr>
                ) : (
                  products.map((prod) => {
                    const primaryImg = prod.images?.find((img) => img.isPrimary) || prod.images?.[0];
                    const effectiveStatus = prod.status || (prod.isActive ? 'ACTIVE' : 'INACTIVE');
                    const isActive = effectiveStatus === 'ACTIVE';

                    return (
                      <tr
                        key={prod.productId || (prod as any)._id}
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-subtle)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Image Thumbnail */}
                        <td>
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--surface-muted)',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            {primaryImg?.url ? (
                              <img
                                src={getAssetUrl(primaryImg.url)}
                                referrerPolicy="no-referrer"
                                alt={primaryImg.alt || prod.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  if (retryWithImageFallback(e.currentTarget as HTMLImageElement)) return;
                                  (e.currentTarget as any).src = 'https://placehold.co/100x100?text=No+Img';
                                }}
                              />
                            ) : (
                              <ImageIcon size={20} style={{ color: 'var(--text-light)' }} />
                            )}
                          </div>
                        </td>

                        {/* Title & Category / Subcategory */}
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: 'var(--fs-md)', marginBottom: '2px' }}>
                            {prod.title || prod.name}
                          </div>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {(() => {
                              const catName = typeof prod.categoryId === 'object' && prod.categoryId?.name
                                ? prod.categoryId.name
                                : (categoriesList.find(c => c._id === prod.categoryId)?.name || prod.category || 'General');
                              const subcatName = typeof prod.subcategoryId === 'object' && prod.subcategoryId?.name
                                ? prod.subcategoryId.name
                                : prod.subcategory;
                              return (
                                <>
                                  <span style={{ background: 'var(--surface-muted)', color: 'var(--text-body)', padding: '1px 6px', borderRadius: 'var(--radius-xs)', fontWeight: 600 }}>
                                    {catName}
                                  </span>
                                  {subcatName && (
                                    <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '1px 6px', borderRadius: 'var(--radius-xs)', fontWeight: 500 }}>
                                      › {subcatName}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                            {prod.brand && <span>Brand: {prod.brand}</span>}
                          </div>
                        </td>

                        {/* SKU */}
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {prod.sku}
                        </td>

                        {/* Business Volume (BV) */}
                        <td>
                          <span
                            style={{
                              background: 'var(--primary-light)',
                              color: 'var(--primary-hover)',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 'var(--fs-sm)',
                              border: '1px solid var(--primary-border)',
                            }}
                          >
                            {(prod.businessVolume ?? prod.bv ?? 0).toLocaleString()} BV
                          </span>
                        </td>

                        {/* Price & MRP */}
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>₹{prod.price?.toLocaleString()}</div>
                          {prod.mrp && prod.mrp > prod.price && (
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-light)', textDecoration: 'line-through' }}>
                              MRP ₹{prod.mrp?.toLocaleString()}
                            </div>
                          )}
                        </td>

                        {/* Stock Quantity */}
                        <td>
                          {(() => {
                            const stockCount = prod.stock ?? prod.stockQuantity ?? 0;
                            const isLow = stockCount <= 10;
                            const isOut = stockCount <= 0;
                            return (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: 'var(--fs-sm)',
                                  fontWeight: 600,
                                  color: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)',
                                }}
                              >
                                {isOut ? 'Out of Stock' : `${stockCount} units`}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Status (Active / Inactive) */}
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 9px',
                              borderRadius: 'var(--radius-xl)',
                              fontSize: 'var(--fs-xs)',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.3px',
                              background: isActive ? 'var(--success-light)' : 'var(--danger-light)',
                              color: isActive ? 'var(--success)' : 'var(--danger)',
                              border: `1px solid ${isActive ? 'var(--success-border)' : 'var(--danger-border)'}`,
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: isActive ? 'var(--success)' : 'var(--danger)',
                              }}
                            />
                            {effectiveStatus}
                          </span>
                        </td>

                        {/* Home Showcase Toggle */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleShowOnHome(prod)}
                            disabled={submitting}
                            title={prod.showOnHome ? "Featured on Member Home - Click to remove" : "Click to feature on Member Home"}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-xl)',
                              fontSize: 'var(--fs-xs)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: prod.showOnHome ? '1px solid var(--warning-border)' : '1px solid var(--border-color)',
                              transition: 'all 0.15s ease',
                              background: prod.showOnHome ? 'var(--warning-soft)' : 'var(--surface-subtle)',
                              color: prod.showOnHome ? 'var(--warning-hover)' : 'var(--text-muted)',
                            }}
                          >
                            <Star size={13} fill={prod.showOnHome ? 'var(--warning)' : 'none'} color={prod.showOnHome ? 'var(--warning)' : 'var(--text-light)'} />
                            <span>{prod.showOnHome ? 'On Home' : 'Standard'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {/* View Details */}
                            <button
                              onClick={() => openDetailsView(prod)}
                              title="View Product Details" className="btn btn-secondary">
                              <Eye size={15} />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => openEditForm(prod)}
                              title="Edit Product" className="btn btn-soft">
                              <Edit3 size={15} />
                            </button>

                            {/* Toggle Status */}
                            <button
                              onClick={() => handleToggleStatus(prod)}
                              disabled={submitting}
                              title={isActive ? 'Deactivate Product' : 'Activate Product'}
                              style={{
                                padding: '6px 8px',
                                background: isActive ? 'var(--danger-light)' : 'var(--success-light)',
                                border: `1px solid ${isActive ? 'var(--danger-border)' : 'var(--success-border)'}`,
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                color: isActive ? 'var(--danger)' : 'var(--success)',
                              }}
                            >
                              {isActive ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteProduct(prod)}
                              disabled={deletingId === (prod.productId || (prod as any)._id)}
                              title="Delete Product" className="btn btn-secondary">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-color)',
                fontSize: 'var(--fs-base)',
                color: 'var(--text-muted)',
              }}
            >
              <div>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total products)
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => loadProducts(pagination.page - 1)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-strong)',
                    background: pagination.page <= 1 ? 'var(--surface-muted)' : 'var(--surface)',
                    color: pagination.page <= 1 ? 'var(--text-light)' : 'var(--text-body)',
                    cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadProducts(pagination.page + 1)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-strong)',
                    background: pagination.page >= pagination.totalPages ? 'var(--surface-muted)' : 'var(--surface)',
                    color: pagination.page >= pagination.totalPages ? 'var(--text-light)' : 'var(--text-body)',
                    cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. CREATE & EDIT PRODUCT FORM                             */}
      {/* ======================================================== */}
      {(viewMode === 'create' || viewMode === 'edit') && (
        <form onSubmit={handleSubmitForm}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '24px' }}>
            {/* Left Column: Core Fields & Rich Text */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Card 1: Basic Information */}
              <div className="dashboard-card">
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Tag size={18} color="var(--primary)" />
                  <span>Basic Information</span>
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  {/* Product Title */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Product Title / Name <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Organic Herbal Face Cream (100g)"
                      value={formData.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-strong)',
                        fontSize: 'var(--fs-md)',
                      }}
                    />
                  </div>

                  {/* Product Slug */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      URL Slug <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="organic-herbal-face-cream-100g"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: slugify(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-strong)',
                        fontSize: 'var(--fs-base)',
                        fontFamily: 'monospace',
                      }}
                    />
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Used for clean URLs (/api/products/:slug)</span>
                  </div>

                  {/* SKU */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                        SKU <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <button
                        type="button"
                        onClick={generateSKU} className="link-btn">
                        Auto-generate
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="WET-SKN-01"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-strong)',
                        fontSize: 'var(--fs-base)',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    />
                  </div>

                  {/* Category (Required) */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Category <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <select
                      required
                      value={formData.categoryId}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-strong)',
                        fontSize: 'var(--fs-base)',
                        background: 'var(--surface)',
                        color: 'var(--text-strong)',
                      }}
                    >
                      <option value="">Select Category *</option>
                      {categoriesList.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} {c.status === 'INACTIVE' ? '(Inactive)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subcategory (Optional, dependent on Category) */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Subcategory <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <select
                      value={formData.subcategoryId}
                      onChange={(e) => setFormData(prev => ({ ...prev, subcategoryId: e.target.value }))}
                      disabled={!formData.categoryId || formSubcategories.length === 0}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-strong)',
                        fontSize: 'var(--fs-base)',
                        background: (!formData.categoryId || formSubcategories.length === 0) ? 'var(--surface-subtle)' : 'var(--surface)',
                        color: (!formData.categoryId || formSubcategories.length === 0) ? 'var(--text-light)' : 'var(--text-strong)',
                      }}
                    >
                      {!formData.categoryId ? (
                        <option value="">Select Category first</option>
                      ) : loadingSubcategories ? (
                        <option value="">Loading subcategories...</option>
                      ) : formSubcategories.length === 0 ? (
                        <option value="">No subcategories available</option>
                      ) : (
                        <>
                          <option value="">None (No subcategory)</option>
                          {formSubcategories.map((s) => (
                            <option key={s._id} value={s._id}>
                              {s.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    {formData.categoryId && !loadingSubcategories && formSubcategories.length === 0 && (
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        No subcategories available. Product can still be saved.
                      </span>
                    )}
                  </div>

                  {/* Brand */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Brand
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Panchveda Wellness"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-strong)',
                        fontSize: 'var(--fs-base)',
                      }}
                    />
                  </div>
                </div>

                {/* Short Description */}
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Short Summary / Tagline
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief 1-2 sentence preview for product catalog cards..."
                    value={formData.shortDescription}
                    onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-base)',
                    }}
                  />
                </div>
              </div>

              {/* Card 2: CKEditor Rich Description */}
              <div className="dashboard-card">
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} color="var(--primary)" />
                  <span>Product Description (CKEditor)</span>
                </h3>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Use headings, lists, tables, bold, italic, and formatting. The output is safely sanitized and stored in MongoDB.
                </p>

                <CKEditorField
                  value={formData.description}
                  onChange={(val) => setFormData(prev => ({ ...prev, description: val }))}
                  minHeight="260px"
                />
              </div>

              {/* Card 3: Images Management */}
              <div className="dashboard-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ImageIcon size={18} color="var(--primary)" />
                      <span>Product Images Gallery</span>
                    </h3>
                    <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                      Manage multiple images. Set primary image, reorder, and replace images.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Upload File Button */}
                    <button
                      type="button"
                      onClick={() => {
                        replaceIndexRef.current = null;
                        if (fileInputRef.current) fileInputRef.current.click();
                      }}
                      disabled={uploadingImage} className="btn btn-primary btn-sm">
                      <UploadCloud size={15} />
                      <span>{uploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                    </button>

                    {/* Direct URL Button */}
                    <button
                      type="button"
                      onClick={() => setIsUrlModalOpen(true)} className="btn btn-secondary btn-sm">
                      + Image URL
                    </button>
                  </div>
                </div>

                {/* Images Grid */}
                {formData.images.length === 0 ? (
                  <div
                    onClick={() => {
                      replaceIndexRef.current = null;
                      if (fileInputRef.current) fileInputRef.current.click();
                    }}
                    style={{
                      border: '2px dashed var(--border-strong)',
                      borderRadius: 'var(--radius-md)',
                      padding: '36px',
                      textAlign: 'center',
                      background: 'var(--surface-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    <UploadCloud size={36} color="var(--text-light)" style={{ margin: '0 auto 10px' }} />
                    <p style={{ fontWeight: 600, fontSize: 'var(--fs-md)', color: 'var(--text-body)', marginBottom: '4px' }}>
                      No images added yet
                    </p>
                    <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                      Click here to upload PNG, JPG, or WebP images from your computer.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
                    {formData.images.map((img, idx) => (
                      <div
                        key={img.key || idx}
                        style={{
                          border: img.isPrimary ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          background: 'var(--surface)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          position: 'relative',
                        }}
                      >
                        {/* Primary Badge */}
                        {img.isPrimary && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '8px',
                              left: '8px',
                              background: 'var(--primary)',
                              color: 'var(--text-inverse)',
                              fontSize: 'var(--fs-2xs)',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-lg)',
                              zIndex: 2,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <Star size={10} fill="var(--text-inverse)" /> PRIMARY
                          </div>
                        )}

                        {/* Image Preview */}
                        <div style={{ height: '130px', background: 'var(--surface-subtle)', overflow: 'hidden' }}>
                          <img
                            src={getAssetUrl(img.url)}
                            referrerPolicy="no-referrer"
                            alt={img.alt || `Product Image ${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              if (retryWithImageFallback(e.currentTarget as HTMLImageElement)) return;
                              (e.currentTarget as any).src = 'https://placehold.co/200x150?text=Preview';
                            }}
                          />
                        </div>

                        {/* Image Controls */}
                        <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {/* Set Primary Button */}
                          {!img.isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryImage(idx)} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                              Set as Primary
                            </button>
                          )}

                          {/* Reorder and Delete Row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveImage(idx, 'left')}
                                title="Move Left" className="btn btn-secondary">
                                <MoveLeft size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === formData.images.length - 1}
                                onClick={() => handleMoveImage(idx, 'right')}
                                title="Move Right" className="btn btn-secondary">
                                <MoveRight size={12} />
                              </button>
                            </div>

                            <div style={{ display: 'flex', gap: '4px' }}>
                              {/* Replace button */}
                              <button
                                type="button"
                                onClick={() => handleReplaceImage(idx)}
                                title="Replace image" className="btn btn-secondary btn-sm">
                                Replace
                              </button>

                              {/* Delete button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteImage(idx)}
                                title="Remove image" className="btn btn-danger-outline">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Pricing, MLM BV, Inventory, Status, Save */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Card 4: Pricing & Business Volume (BV) */}
              <div className="dashboard-card">
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={18} color="var(--success)" />
                  <span>Pricing & MLM BV</span>
                </h3>

                {/* Selling Price */}
                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Selling Price (₹) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="e.g. 1250"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-md)',
                      fontWeight: 600,
                    }}
                  />
                </div>

                {/* MRP */}
                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    MRP (₹) <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>(Optional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 1500"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-base)',
                    }}
                  />
                </div>

                {/* Business Volume (BV) */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Business Volume (BV) <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <span style={{ fontSize: 'var(--fs-2xs)', background: 'var(--primary-soft)', color: 'var(--primary-strong)', padding: '1px 6px', borderRadius: 'var(--radius-xs)', fontWeight: 700 }}>
                      INDEPENDENT
                    </span>
                  </div>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    placeholder="e.g. 500"
                    value={formData.businessVolume}
                    onChange={(e) => setFormData({ ...formData, businessVolume: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid var(--primary-border)',
                      background: 'var(--primary-light)',
                      fontSize: 'var(--fs-md)',
                      fontWeight: 700,
                      color: 'var(--primary-strong)',
                    }}
                  />
                  <div style={{ marginTop: '8px', background: 'var(--surface-subtle)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    <strong>MLM Rule:</strong> BV is credited to binary matching & repurchase commissions independently of price. When ordered, snapshot is preserved.
                  </div>
                </div>
              </div>

              {/* Card 5: Inventory & Status */}
              <div className="dashboard-card">
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} color="var(--info)" />
                  <span>Inventory & Status</span>
                </h3>

                {/* Stock Quantity */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Available Stock Quantity
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    placeholder="e.g. 100"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-md)',
                      fontWeight: 600,
                    }}
                  />
                </div>

                {/* Status Toggle */}
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Product Visibility Status
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'ACTIVE' })}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        border: formData.status === 'ACTIVE' ? '2px solid var(--success)' : '1px solid var(--border-strong)',
                        background: formData.status === 'ACTIVE' ? 'var(--success-light)' : 'var(--surface)',
                        color: formData.status === 'ACTIVE' ? 'var(--success-strong)' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: 'var(--fs-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <CheckCircle2 size={16} /> ACTIVE
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'INACTIVE' })}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        border: formData.status === 'INACTIVE' ? '2px solid var(--danger)' : '1px solid var(--border-strong)',
                        background: formData.status === 'INACTIVE' ? 'var(--danger-light)' : 'var(--surface)',
                        color: formData.status === 'INACTIVE' ? 'var(--danger-strong)' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: 'var(--fs-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <XCircle size={16} /> INACTIVE
                    </button>
                  </div>
                  <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Only ACTIVE products are shown in member portal and purchasable.
                  </span>
                </div>
              </div>

              {/* Card 6: Homepage Showcase Placement */}
              <div className="dashboard-card">
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Star size={18} color="var(--warning)" fill={formData.showOnHome ? 'var(--warning)' : 'none'} />
                  <span>Homepage Showcase</span>
                </h3>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Choose whether this product appears on the member home screen directly below the main slider banner.
                </p>

                {/* Showcase Switch / Buttons */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, showOnHome: true })}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        border: formData.showOnHome ? '2px solid var(--warning)' : '1px solid var(--border-strong)',
                        background: formData.showOnHome ? 'var(--warning-light)' : 'var(--surface)',
                        color: formData.showOnHome ? 'var(--warning-hover)' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: 'var(--fs-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Star size={14} fill={formData.showOnHome ? 'var(--warning)' : 'none'} />
                      <span>Show on Home</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, showOnHome: false })}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        border: !formData.showOnHome ? '2px solid var(--text-light)' : '1px solid var(--border-strong)',
                        background: !formData.showOnHome ? 'var(--surface-muted)' : 'var(--surface)',
                        color: !formData.showOnHome ? 'var(--text-body)' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: 'var(--fs-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>Store Only</span>
                    </button>
                  </div>
                </div>

                {/* Display Priority Order */}
                {formData.showOnHome && (
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Showcase Priority / Sort Order (Lower numbers appear first)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 1"
                      value={formData.homeOrder}
                      onChange={(e) => setFormData({ ...formData, homeOrder: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-strong)',
                        fontSize: 'var(--fs-base)',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
                  <Check size={18} />
                  <span>{submitting ? 'Saving Product...' : viewMode === 'create' ? 'Create Product' : 'Save Changes'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  disabled={submitting} className="btn btn-secondary" style={{ width: '100%' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* 3. PRODUCT DETAILS VIEW                                  */}
      {/* ======================================================== */}
      {viewMode === 'details' && selectedProduct && (
        <div className="dashboard-card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '32px' }}>
            {/* Left: Images Carousel / Gallery */}
            <div>
              {/* Primary Image View */}
              {(() => {
                const primary = selectedProduct.images?.find((img) => img.isPrimary) || selectedProduct.images?.[0];
                return (
                  <div
                    style={{
                      width: '100%',
                      height: '320px',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border-color)',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {primary?.url ? (
                      <img
                        src={getAssetUrl(primary.url)}
                        referrerPolicy="no-referrer"
                        alt={primary.alt || selectedProduct.title}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={(e) => {
                          retryWithImageFallback(e.currentTarget);
                        }}
                      />
                    ) : (
                      <ImageIcon size={48} color="var(--text-disabled)" />
                    )}
                  </div>
                );
              })()}

              {/* Thumbnails */}
              {selectedProduct.images && selectedProduct.images.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {selectedProduct.images.map((img, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        border: img.isPrimary ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        flexShrink: 0,
                      }}
                    >
                      <img src={getAssetUrl(img.url)} referrerPolicy="no-referrer" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { retryWithImageFallback(e.currentTarget); }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Specifications & Rich Description */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {(() => {
                  const catName = typeof selectedProduct.categoryId === 'object' && selectedProduct.categoryId?.name
                    ? selectedProduct.categoryId.name
                    : (categoriesList.find(c => c._id === selectedProduct.categoryId)?.name || selectedProduct.category || 'General');
                  const subcatName = typeof selectedProduct.subcategoryId === 'object' && selectedProduct.subcategoryId?.name
                    ? selectedProduct.subcategoryId.name
                    : selectedProduct.subcategory;
                  return (
                    <>
                      <span style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
                        Category: {catName}
                      </span>
                      {subcatName && (
                        <span style={{ background: 'var(--primary-light)', color: 'var(--primary-hover)', padding: '3px 8px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
                          Subcategory: {subcatName}
                        </span>
                      )}
                    </>
                  );
                })()}
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 700,
                    background: (selectedProduct.status || (selectedProduct.isActive ? 'ACTIVE' : 'INACTIVE')) === 'ACTIVE' ? 'var(--success-light)' : 'var(--danger-light)',
                    color: (selectedProduct.status || (selectedProduct.isActive ? 'ACTIVE' : 'INACTIVE')) === 'ACTIVE' ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {selectedProduct.status || (selectedProduct.isActive ? 'ACTIVE' : 'INACTIVE')}
                </span>
              </div>

              <h2 className="section-title" style={{ marginBottom: '8px' }}>
                {selectedProduct.title || selectedProduct.name}
              </h2>

              <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {htmlToPlainText(selectedProduct.shortDescription) || 'No short description provided.'}
              </p>

              {/* Key Specs Card */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '12px',
                  background: 'var(--surface-subtle)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '24px',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SKU</div>
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'monospace' }}>
                    {selectedProduct.sku}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Price</div>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)' }}>
                    ₹{selectedProduct.price?.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Business Volume</div>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--primary-hover)' }}>
                    {(selectedProduct.businessVolume ?? selectedProduct.bv ?? 0).toLocaleString()} BV
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inventory</div>
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: (selectedProduct.stock ?? selectedProduct.stockQuantity ?? 0) > 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {(selectedProduct.stock ?? selectedProduct.stockQuantity ?? 0)} in stock
                  </div>
                </div>
              </div>

              {/* Formatted Rich Description */}
              <div>
                <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-body)', marginBottom: '8px' }}>
                  Full Description
                </h4>
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-color)',
                    fontSize: 'var(--fs-md)',
                    lineHeight: '1.6',
                    color: 'var(--text-body)',
                  }}
                  dangerouslySetInnerHTML={{ __html: selectedProduct.description || '<em>No description provided.</em>' }}
                />
              </div>

              {/* Edit Button */}
              <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => openEditForm(selectedProduct)}
                  className="btn btn-primary"
                >
                  <Edit3 size={16} /> Edit Product
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className="btn btn-secondary"
                >
                  Back to List
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual URL Modal */}
      {isUrlModalOpen && (
        <div className="modal-backdrop">
          <div className="modal modal-legacy" style={{ maxWidth: 420, padding: 'var(--space-6)' }} role="dialog" aria-modal="true">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="section-title">Add Image via URL</h3>
              <button
                onClick={() => setIsUrlModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                Image Web URL
              </label>
              <input
                type="url"
                placeholder="https://example.com/product.jpg"
                value={manualImageUrl}
                onChange={(e) => setManualImageUrl(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                Alt Description / Caption
              </label>
              <input
                type="text"
                placeholder="Product packaging view"
                value={manualImageAlt}
                onChange={(e) => setManualImageAlt(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsUrlModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddManualUrl} className="btn btn-primary">
                Add Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
