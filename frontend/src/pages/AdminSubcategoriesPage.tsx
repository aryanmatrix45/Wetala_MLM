import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, CheckCircle2, ChevronLeft, ChevronRight, Edit3, FolderTree, ImageIcon, Layers, Plus, RefreshCw, Search, Trash2, X, XCircle } from 'lucide-react';
import { api, type SubcategoryItem, type CategoryItem, getAssetUrl, retryWithImageFallback } from '../services/api';

interface AdminSubcategoriesPageProps {
  user?: any;
  token?: string | null;
  initialCategoryId?: string | null;
}

export const AdminSubcategoriesPage: React.FC<AdminSubcategoriesPageProps> = ({
  token: propToken,
  initialCategoryId,
}) => {
  const savedToken = propToken || localStorage.getItem('wetala_token') || '';

  const [subcategories, setSubcategories] = useState<SubcategoryItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategoryId || 'ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<SubcategoryItem | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    slug: string;
    categoryId: string;
    description: string;
    imageUrl: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>({
    name: '',
    slug: '',
    categoryId: '',
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
      slug: !editingSubcategory ? slugify(val) : prev.slug,
    }));
  };

  // Load Categories for Dropdowns
  const loadCategoriesDropdown = async () => {
    try {
      const res = await api.adminGetCategories({ limit: 100 }, savedToken);
      if (res.status && Array.isArray(res.data)) {
        setCategories(res.data);
      }
    } catch (err) {
      console.error('Failed to load categories for dropdown:', err);
    }
  };

  const loadSubcategories = async (page = pagination.page) => {
    try {
      setLoading(true);
      setFeedback(null);
      const res = await api.adminGetSubcategories(
        {
          page,
          limit: pagination.limit,
          search: searchQuery,
          categoryId: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          status: statusFilter,
        },
        savedToken
      );

      if (res.status && Array.isArray(res.data)) {
        setSubcategories(res.data);
        if (res.pagination) {
          setPagination({
            page: res.pagination.page,
            limit: res.pagination.limit,
            total: res.pagination.total,
            totalPages: res.pagination.totalPages,
          });
        }
      } else {
        setSubcategories([]);
      }
    } catch (err: any) {
      console.error('Failed to load subcategories:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load subcategories.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategoriesDropdown();
  }, []);

  useEffect(() => {
    loadSubcategories(1);
  }, [searchQuery, categoryFilter, statusFilter]);

  const openCreateModal = () => {
    setEditingSubcategory(null);
    setFormData({
      name: '',
      slug: '',
      categoryId: categoryFilter !== 'ALL' ? categoryFilter : categories[0]?._id || '',
      description: '',
      imageUrl: '',
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (subcat: SubcategoryItem) => {
    setEditingSubcategory(subcat);
    const catId = typeof subcat.categoryId === 'object' ? subcat.categoryId._id : subcat.categoryId;
    setFormData({
      name: subcat.name,
      slug: subcat.slug,
      categoryId: catId || '',
      description: subcat.description || '',
      imageUrl: subcat.imageUrl || subcat.image || '',
      status: subcat.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFeedback({ type: 'error', message: 'Subcategory name is required.' });
      return;
    }
    if (!formData.categoryId) {
      setFeedback({ type: 'error', message: 'Parent category is required.' });
      return;
    }

    try {
      setSubmitting(true);
      const imgVal = formData.imageUrl.trim();
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || slugify(formData.name),
        categoryId: formData.categoryId,
        description: formData.description.trim(),
        image: imgVal,
        imageUrl: imgVal,
        status: formData.status,
      };

      let res;
      if (editingSubcategory) {
        res = await api.adminUpdateSubcategory(editingSubcategory._id as string, payload, savedToken);
      } else {
        res = await api.adminCreateSubcategory(payload, savedToken);
      }

      if (res.status) {
        setFeedback({
          type: 'success',
          message: editingSubcategory ? 'Subcategory updated successfully!' : 'Subcategory created successfully!',
        });
        setIsModalOpen(false);
        await loadSubcategories(1);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Operation failed.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error saving subcategory.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (subcat: SubcategoryItem) => {
    try {
      setActionLoadingId(subcat._id as string);
      const newStatus = subcat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await api.adminUpdateSubcategoryStatus(subcat._id as string, newStatus, savedToken);
      if (res.status) {
        setFeedback({
          type: 'success',
          message: `Subcategory "${subcat.name}" is now ${newStatus}.`,
        });
        await loadSubcategories(pagination.page);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to toggle status.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to toggle status.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (subcat: SubcategoryItem) => {
    if ((subcat.productCount ?? 0) > 0) {
      alert(
        `Cannot delete "${subcat.name}" because ${subcat.productCount} product(s) are currently assigned to it. Please reassign the products first, or deactivate this subcategory.`
      );
      return;
    }

    if (!window.confirm(`Are you sure you want to delete subcategory "${subcat.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      setActionLoadingId(subcat._id as string);
      const res = await api.adminDeleteSubcategory(subcat._id as string, savedToken);
      if (res.status) {
        setFeedback({ type: 'success', message: res.message || 'Subcategory deleted successfully.' });
        await loadSubcategories(pagination.page);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to delete subcategory.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete subcategory.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="page-body">
      {/* Header Banner */}
      <div className="welcome-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Manage Subcategories</h1>
          <p className="page-subtitle">
            Subcategories belong strictly to a parent Category. Configure granular classification for products.
          </p>
        </div>

        <div>
          <button
            onClick={openCreateModal}
            className="btn btn-primary"
          >
            <Plus size={18} />
            <span>Add Subcategory</span>
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
          <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '360px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}
            />
            <input
              type="text"
              placeholder="Search subcategories by name, slug..."
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-strong)',
                fontSize: 'var(--fs-base)',
                background: 'var(--surface)',
                color: 'var(--text-body)',
              }}
            >
              <option value="ALL">All Parent Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>

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

            <button
              onClick={() => loadSubcategories(pagination.page)} className="btn btn-secondary">
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Subcategories Table */}
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
                <th>Subcategory</th>
                <th>Parent Category</th>
                <th>Slug</th>
                <th>Products Linked</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && subcategories.length === 0 ? (
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
                    Loading subcategories...
                  </td>
                </tr>
              ) : subcategories.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Layers size={40} style={{ color: 'var(--text-disabled)', margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 600, fontSize: 'var(--fs-lg)', color: 'var(--text-body)', marginBottom: '4px' }}>
                      No subcategories found
                    </p>
                    <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-light)', marginBottom: '16px' }}>
                      Create a subcategory under an existing parent category.
                    </p>
                    <button onClick={openCreateModal} className="btn btn-primary">
                      + Add Subcategory
                    </button>
                  </td>
                </tr>
              ) : (
                subcategories.map((subcat) => {
                  const isActive = subcat.status === 'ACTIVE';
                  const parentCatName =
                    typeof subcat.categoryId === 'object' && subcat.categoryId !== null
                      ? (subcat.categoryId as any).name
                      : 'Unknown Category';

                  return (
                    <tr
                      key={subcat._id}
                      style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Name & Description with Image */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {subcat.imageUrl || subcat.image ? (
                            <img
                              src={getAssetUrl(subcat.imageUrl || subcat.image)}
                              referrerPolicy="no-referrer"
                              alt={subcat.name}
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
                              <Layers size={18} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--fs-md)', marginBottom: '2px' }}>
                              {subcat.name}
                            </div>
                            {subcat.description && (
                              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', maxWidth: '280px' }}>
                                {subcat.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Parent Category Badge */}
                      <td>
                        <span
                          style={{
                            background: 'var(--surface-muted)',
                            color: 'var(--text-body)',
                            fontWeight: 600,
                            padding: '3px 9px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--fs-sm)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <FolderTree size={12} color="var(--primary)" />
                          <span>{parentCatName}</span>
                        </span>
                      </td>

                      {/* Slug */}
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {subcat.slug}
                      </td>

                      {/* Product Count */}
                      <td>
                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {subcat.productCount ?? 0} Products
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
                          {subcat.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(subcat)}
                            title="Edit Subcategory" className="btn btn-soft">
                            <Edit3 size={15} />
                          </button>

                          {/* Toggle Status */}
                          <button
                            onClick={() => handleToggleStatus(subcat)}
                            disabled={actionLoadingId === subcat._id}
                            title={isActive ? 'Deactivate Subcategory' : 'Activate Subcategory'}
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
                            onClick={() => handleDelete(subcat)}
                            disabled={actionLoadingId === subcat._id}
                            title="Delete Subcategory" className="btn btn-secondary">
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
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} subcategories)
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadSubcategories(pagination.page - 1)}
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
                onClick={() => loadSubcategories(pagination.page + 1)}
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
                {editingSubcategory ? 'Edit Subcategory' : 'Create New Subcategory'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Parent Category Selection (Mandatory) */}
              <div style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Parent Category <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 'var(--fs-md)',
                    background: 'var(--surface)',
                  }}
                >
                  <option value="" disabled>
                    Select Parent Category
                  </option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory Name */}
              <div style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Subcategory Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Protein Powders"
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
                  placeholder="protein-powders"
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
                  placeholder="Short description of products under this subcategory..."
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
                  Subcategory Image URL (Optional)
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
                  <span>{submitting ? 'Saving...' : editingSubcategory ? 'Update Subcategory' : 'Create Subcategory'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
