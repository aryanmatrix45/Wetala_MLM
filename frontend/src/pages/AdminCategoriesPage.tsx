import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Plus,
  Search,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from 'lucide-react';
import { api, type CategoryItem } from '../services/api';

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
    status: 'ACTIVE' | 'INACTIVE';
  }>({
    name: '',
    slug: '',
    description: '',
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
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
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
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || slugify(formData.name),
        description: formData.description.trim(),
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
              SUPERADMIN MODULE
            </span>
            <span style={{ color: '#64748b', fontSize: '13px' }}>
              Hierarchy & Taxonomy Management
            </span>
          </div>

          <h1 className="page-title">Manage Categories</h1>
          <p className="page-subtitle">
            Create, organize, and manage top-level product categories. All categories link dynamically to
            subcategories and products.
          </p>
        </div>

        <div>
          <button
            onClick={openCreateModal}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#1d72fe',
              color: '#fff',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(29, 114, 254, 0.2)',
            }}
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
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{feedback.message}</span>
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
      <div className="dashboard-card" style={{ padding: '24px' }}>
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
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search categories by name, slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
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
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#fff',
                color: '#334155',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>

            <button
              onClick={() => loadCategories(pagination.page)}
              style={{
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                background: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: '#475569',
              }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Categories Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid #e2e8f0',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  fontSize: '11px',
                  letterSpacing: '0.5px',
                }}
              >
                <th style={{ padding: '12px 14px' }}>Category</th>
                <th style={{ padding: '12px 14px' }}>Slug</th>
                <th style={{ padding: '12px 14px' }}>Subcategory Count</th>
                <th style={{ padding: '12px 14px' }}>Product Count</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && categories.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        border: '2px solid #cbd5e1',
                        borderTopColor: '#1d72fe',
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
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    <FolderTree size={40} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 600, fontSize: '15px', color: '#334155', marginBottom: '4px' }}>
                      No categories found
                    </p>
                    <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
                      Get started by creating your first product category.
                    </p>
                    <button onClick={openCreateModal} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
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
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Name & Description */}
                      <td style={{ padding: '14px' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px', marginBottom: '2px' }}>
                          {cat.name}
                        </div>
                        {cat.description && (
                          <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '300px' }}>
                            {cat.description}
                          </div>
                        )}
                      </td>

                      {/* Slug */}
                      <td style={{ padding: '14px', fontFamily: 'monospace', color: '#475569', fontSize: '12px' }}>
                        {cat.slug}
                      </td>

                      {/* Subcategory Count with Quick Link */}
                      <td style={{ padding: '14px' }}>
                        <button
                          type="button"
                          onClick={() => onNavigateSubcategories && onNavigateSubcategories(cat._id)}
                          style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            padding: '3px 10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>{cat.subcategoryCount ?? 0} Subcategories</span>
                          <span style={{ fontSize: '10px' }}>→</span>
                        </button>
                      </td>

                      {/* Product Count */}
                      <td style={{ padding: '14px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                          {cat.productCount ?? 0} Products
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 9px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: isActive ? '#ecfdf5' : '#fef2f2',
                            color: isActive ? '#059669' : '#dc2626',
                            border: `1px solid ${isActive ? '#a7f3d0' : '#fecaca'}`,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: isActive ? '#059669' : '#dc2626',
                            }}
                          />
                          {cat.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(cat)}
                            title="Edit Category"
                            style={{
                              padding: '6px 8px',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: '#2563eb',
                            }}
                          >
                            <Edit3 size={15} />
                          </button>

                          {/* Toggle Status */}
                          <button
                            onClick={() => handleToggleStatus(cat)}
                            disabled={actionLoadingId === cat._id}
                            title={isActive ? 'Deactivate Category' : 'Activate Category'}
                            style={{
                              padding: '6px 8px',
                              background: isActive ? '#fef2f2' : '#ecfdf5',
                              border: `1px solid ${isActive ? '#fecaca' : '#a7f3d0'}`,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: isActive ? '#dc2626' : '#16a34a',
                            }}
                          >
                            {isActive ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(cat)}
                            disabled={actionLoadingId === cat._id}
                            title="Delete Category"
                            style={{
                              padding: '6px 8px',
                              background: '#fff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: '#ef4444',
                            }}
                          >
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
              borderTop: '1px solid #e2e8f0',
              fontSize: '13px',
              color: '#64748b',
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
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: pagination.page <= 1 ? '#f1f5f9' : '#fff',
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
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: pagination.page >= pagination.totalPages ? '#f1f5f9' : '#fff',
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
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
              borderRadius: '12px',
              padding: '28px',
              width: '460px',
              maxWidth: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Category Name */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Category Name <span style={{ color: '#ef4444' }}>*</span>
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
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                  }}
                />
              </div>

              {/* Slug */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Slug <span style={{ color: '#ef4444' }}>*</span>
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
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
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
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                  }}
                />
              </div>

              {/* Status */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  Status
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'ACTIVE' })}
                    style={{
                      padding: '9px',
                      borderRadius: '6px',
                      border: formData.status === 'ACTIVE' ? '2px solid #10b981' : '1px solid #cbd5e1',
                      background: formData.status === 'ACTIVE' ? '#ecfdf5' : '#fff',
                      color: formData.status === 'ACTIVE' ? '#065f46' : '#64748b',
                      fontWeight: 700,
                      fontSize: '12px',
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
                      borderRadius: '6px',
                      border: formData.status === 'INACTIVE' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                      background: formData.status === 'INACTIVE' ? '#fef2f2' : '#fff',
                      color: formData.status === 'INACTIVE' ? '#991b1b' : '#64748b',
                      fontWeight: 700,
                      fontSize: '12px',
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
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: '#1d72fe',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
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
