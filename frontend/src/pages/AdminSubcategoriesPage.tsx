import React, { useState, useEffect } from 'react';
import {
  Layers,
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
  FolderTree,
} from 'lucide-react';
import { api, type SubcategoryItem, type CategoryItem } from '../services/api';

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
    status: 'ACTIVE' | 'INACTIVE';
  }>({
    name: '',
    slug: '',
    categoryId: '',
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
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || slugify(formData.name),
        categoryId: formData.categoryId,
        description: formData.description.trim(),
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

          <h1 className="page-title">Manage Subcategories</h1>
          <p className="page-subtitle">
            Subcategories belong strictly to a parent Category. Configure granular classification for products.
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
          <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '360px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search subcategories by name, slug..."
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#fff',
                color: '#334155',
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
              onClick={() => loadSubcategories(pagination.page)}
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

        {/* Subcategories Table */}
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
                <th style={{ padding: '12px 14px' }}>Subcategory</th>
                <th style={{ padding: '12px 14px' }}>Parent Category</th>
                <th style={{ padding: '12px 14px' }}>Slug</th>
                <th style={{ padding: '12px 14px' }}>Products Linked</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && subcategories.length === 0 ? (
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
                    Loading subcategories...
                  </td>
                </tr>
              ) : subcategories.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    <Layers size={40} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 600, fontSize: '15px', color: '#334155', marginBottom: '4px' }}>
                      No subcategories found
                    </p>
                    <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
                      Create a subcategory under an existing parent category.
                    </p>
                    <button onClick={openCreateModal} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
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
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Name & Description */}
                      <td style={{ padding: '14px' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px', marginBottom: '2px' }}>
                          {subcat.name}
                        </div>
                        {subcat.description && (
                          <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '280px' }}>
                            {subcat.description}
                          </div>
                        )}
                      </td>

                      {/* Parent Category Badge */}
                      <td style={{ padding: '14px' }}>
                        <span
                          style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            fontWeight: 600,
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <FolderTree size={12} color="#2563eb" />
                          <span>{parentCatName}</span>
                        </span>
                      </td>

                      {/* Slug */}
                      <td style={{ padding: '14px', fontFamily: 'monospace', color: '#475569', fontSize: '12px' }}>
                        {subcat.slug}
                      </td>

                      {/* Product Count */}
                      <td style={{ padding: '14px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                          {subcat.productCount ?? 0} Products
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
                          {subcat.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(subcat)}
                            title="Edit Subcategory"
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
                            onClick={() => handleToggleStatus(subcat)}
                            disabled={actionLoadingId === subcat._id}
                            title={isActive ? 'Deactivate Subcategory' : 'Activate Subcategory'}
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
                            onClick={() => handleDelete(subcat)}
                            disabled={actionLoadingId === subcat._id}
                            title="Delete Subcategory"
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
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} subcategories)
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadSubcategories(pagination.page - 1)}
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
                onClick={() => loadSubcategories(pagination.page + 1)}
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
                {editingSubcategory ? 'Edit Subcategory' : 'Create New Subcategory'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Parent Category Selection (Mandatory) */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Parent Category <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    background: '#fff',
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Subcategory Name <span style={{ color: '#ef4444' }}>*</span>
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
                  placeholder="protein-powders"
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
                  placeholder="Short description of products under this subcategory..."
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
