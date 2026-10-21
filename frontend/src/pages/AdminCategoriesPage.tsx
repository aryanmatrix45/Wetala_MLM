import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, CheckCircle2, ChevronLeft, ChevronRight, Edit3, FolderTree, ImageIcon, Plus, RefreshCw, Search, Trash2, X, XCircle } from 'lucide-react';
import { api, type CategoryItem, getAssetUrl, retryWithImageFallback } from '../services/api';

interface AdminCategoriesPageProps {
  user?: any;
  token?: string | null;
  onNavigateSubcategories?: (categoryId?: string) => void;
}

export const AdminCategoriesPage: React.FC<AdminCategoriesPageProps> = ({
  token: propToken,
  onNavigateSubcategories,
}) => {
  const savedToken = propToken || localStorage.getItem('wetala_token') || '';

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    slug: string;
    description: string;
    imageUrl: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>({
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    status: 'ACTIVE',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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

  const handleNameChange = (val: string) => {
    setFormData((prev) => ({
      ...prev,
      name: val,
      slug: !editingCategory ? slugify(val) : prev.slug,
    }));
  };

  const loadCategories = async (page = pagination.page) => {
    try {
      setLoading(true);
      setFeedback(null);
      const res = await api.adminGetCategories(
        {
          page,
          limit: pagination.limit,
          search: searchQuery,
          status: statusFilter,
        },
        savedToken
      );

      if (res.status && Array.isArray(res.data)) {
        setCategories(res.data);
        if (res.pagination) {
          setPagination({
            page: res.pagination.page,
            limit: res.pagination.limit,
            total: res.pagination.total,
            totalPages: res.pagination.totalPages,
          });
        }
      } else {
        setCategories([]);
      }
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load categories.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories(1);
  }, [searchQuery, statusFilter]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      imageUrl: '',
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      imageUrl: cat.imageUrl || cat.image || '',
      status: cat.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFeedback({ type: 'error', message: 'Category name is required.' });
      return;
    }

    try {
      setSubmitting(true);
      const imgVal = formData.imageUrl.trim();
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || slugify(formData.name),
        description: formData.description.trim(),
        image: imgVal,
        imageUrl: imgVal,
        status: formData.status,
      };

      let res;
      if (editingCategory) {
        res = await api.adminUpdateCategory(editingCategory._id as string, payload, savedToken);
      } else {
        res = await api.adminCreateCategory(payload, savedToken);
      }

      if (res.status) {
        setFeedback({
          type: 'success',
          message: editingCategory ? 'Category updated successfully!' : 'Category created successfully!',
        });
        setIsModalOpen(false);
        await loadCategories(1);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Operation failed.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error saving category.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (cat: CategoryItem) => {
    try {
      setActionLoadingId(cat._id as string);
      const newStatus = cat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await api.adminUpdateCategoryStatus(cat._id as string, newStatus, savedToken);
      if (res.status) {
        setFeedback({
          type: 'success',
          message: `Category "${cat.name}" is now ${newStatus}.`,
        });
        await loadCategories(pagination.page);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to toggle status.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to toggle status.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (cat: CategoryItem) => {
    if ((cat.subcategoryCount ?? 0) > 0) {
      alert(
        `Cannot delete "${cat.name}" because it has ${cat.subcategoryCount} subcategory/subcategories linked to it. Please reassign or delete them first, or deactivate this category.`
      );
      return;
    }
    if ((cat.productCount ?? 0) > 0) {
      alert(
        `Cannot delete "${cat.name}" because ${cat.productCount} product(s) are currently assigned to it. Please reassign the products first, or deactivate this category.`
      );
      return;
    }

    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      setActionLoadingId(cat._id as string);
      const res = await api.adminDeleteCategory(cat._id as string, savedToken);
      if (res.status) {
        setFeedback({ type: 'success', message: res.message || 'Category deleted successfully.' });
        await loadCategories(pagination.page);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to delete category.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete category.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="page-body">
      {/* Header Banner */}
      <div className="welcome-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Manage Categories</h1>
          <p className="page-subtitle">
            Create, organize, and manage top-level product categories. All categories link dynamically to
            subcategories and products.
          </p>
        </div>

        <div>
          <button
            onClick={openCreateModal}
            className="btn btn-primary"
          >
            <Plus size={18} />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
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

      {/* Main Table Card */}
      <div className="dashboard-card">
        {/* Search & Filters */}
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
          <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '400px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}
            />
            <input
              type="text"
              placeholder="Search categories by name, slug..."
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

            <button
              onClick={() => loadCategories(pagination.page)} className="btn btn-secondary">
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Categories Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontSize: 'var(--fs-xs)',
                  letterSpacing: '0.5px',
                }}
              >
                <th>Category</th>
                <th>Slug</th>
                <th>Subcategory Count</th>
                <th>Product Count</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && categories.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-light)' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        border: '2px solid var(--border-strong)',
                        borderTopColor: 'var(--primary)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        margin: '0 auto 12px',
                      }}
                    />
                    Loading categories...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <FolderTree size={40} style={{ color: 'var(--text-disabled)', margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 600, fontSize: 'var(--fs-lg)', color: 'var(--text-body)', marginBottom: '4px' }}>
                      No categories found
                    </p>
                    <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-light)', marginBottom: '16px' }}>
                      Get started by creating your first product category.
                    </p>
                    <button onClick={openCreateModal} className="btn btn-primary">
                      + Add First Category
                    </button>
                  </td>
                </tr>
              ) : (
                categories.map((cat) => {
                  const isActive = cat.status === 'ACTIVE';

                  return (
                    <tr
                      key={cat._id}
                      style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Name & Description with Image */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {cat.imageUrl || cat.image ? (
                            <img
                              src={getAssetUrl(cat.imageUrl || cat.image)}
                              referrerPolicy="no-referrer"
                              alt={cat.name}
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: 'var(--radius-md)',
                                objectFit: 'cover',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                flexShrink: 0,
                                background: 'var(--surface-subtle)',
                              }}
                              onError={(e) => {
                                if (retryWithImageFallback(e.currentTarget as HTMLImageElement)) return;
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--surface-muted)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-light)',
                                flexShrink: 0,
                              }}
                            >
                              <FolderTree size={18} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--fs-md)', marginBottom: '2px' }}>
                              {cat.name}
                            </div>
                            {cat.description && (
                              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', maxWidth: '300px' }}>
                                {cat.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Slug */}
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {cat.slug}
                      </td>

                      {/* Subcategory Count with Quick Link */}
                      <td>
                        <button
                          type="button"
                          onClick={() => onNavigateSubcategories && onNavigateSubcategories(cat._id)} className="btn btn-soft btn-sm">
                          <span>{cat.subcategoryCount ?? 0} Subcategories</span>
                          <span style={{ fontSize: 'var(--fs-2xs)' }}>→</span>
                        </button>
                      </td>

                      {/* Product Count */}
                      <td>
                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {cat.productCount ?? 0} Products
                        </span>
                      </td>

                      {/* Status */}
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
                          {cat.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(cat)}
                            title="Edit Category" className="btn btn-soft">
                            <Edit3 size={15} />
                          </button>

                          {/* Toggle Status */}
                          <button
                            onClick={() => handleToggleStatus(cat)}
                            disabled={actionLoadingId === cat._id}
                            title={isActive ? 'Deactivate Category' : 'Activate Category'}
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
                            onClick={() => handleDelete(cat)}
                            disabled={actionLoadingId === cat._id}
                            title="Delete Category" className="btn btn-secondary">
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

        {/* Pagination */}
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
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} categories)
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadCategories(pagination.page - 1)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-strong)',
                  background: pagination.page <= 1 ? 'var(--surface-muted)' : 'var(--surface)',
                  cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadCategories(pagination.page + 1)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-strong)',
                  background: pagination.page >= pagination.totalPages ? 'var(--surface-muted)' : 'var(--surface)',
                  cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal modal-legacy" style={{ maxWidth: 460, padding: 'var(--space-6)' }} role="dialog" aria-modal="true">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="section-title">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Category Name */}
              <div style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Category Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Health Supplements"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 'var(--fs-md)',
                  }}
                />
              </div>

              {/* Slug */}
              <div style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Slug <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="health-supplements"
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
              </div>

              {/* Description */}
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Short description of products under this category..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 'var(--fs-base)',
                  }}
                />
              </div>

              {/* Image URL */}
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Category Image URL (Optional)
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/... or image link"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-base)',
                    }}
                  />
                  {formData.imageUrl ? (
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-strong)',
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: 'var(--surface-subtle)',
                      }}
                    >
                      <img
                        key={formData.imageUrl}
                        src={getAssetUrl(formData.imageUrl)}
                        referrerPolicy="no-referrer"
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          if (retryWithImageFallback(e.currentTarget as HTMLImageElement)) return;
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px dashed var(--border-strong)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-light)',
                        flexShrink: 0,
                      }}
                    >
                      <ImageIcon size={18} />
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>
                  Paste any web image URL (Google, Unsplash, CDN).
                </span>
              </div>

              {/* Status */}
              <div style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Status
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'ACTIVE' })}
                    style={{
                      padding: '9px',
                      borderRadius: 'var(--radius-sm)',
                      border: formData.status === 'ACTIVE' ? '2px solid var(--success)' : '1px solid var(--border-strong)',
                      background: formData.status === 'ACTIVE' ? 'var(--success-light)' : 'var(--surface)',
                      color: formData.status === 'ACTIVE' ? 'var(--success-strong)' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: 'var(--fs-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    ACTIVE
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'INACTIVE' })}
                    style={{
                      padding: '9px',
                      borderRadius: 'var(--radius-sm)',
                      border: formData.status === 'INACTIVE' ? '2px solid var(--danger)' : '1px solid var(--border-strong)',
                      background: formData.status === 'INACTIVE' ? 'var(--danger-light)' : 'var(--surface)',
                      color: formData.status === 'INACTIVE' ? 'var(--danger-strong)' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: 'var(--fs-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    INACTIVE
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  <Check size={16} />
                  <span>{submitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
