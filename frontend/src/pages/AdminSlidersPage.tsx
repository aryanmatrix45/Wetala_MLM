import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Plus,
  Search,
  Edit3,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Monitor,
  Smartphone,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  X,
  Layers,
  Check,
  Copy,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { api, getAssetUrl, normalizeDirectImageUrl, type SliderItem } from '../services/api';

// Exact banner resolutions the member home slider is designed around (keep in sync with backend SLIDER_BACKEND_SPECS)
export const SLIDER_SPECS = {
  parent: {
    width: 1920,
    height: 480,
    label: 'desktop slider',
    header: 'Drag & Drop your desktop slider image here',
    subHeader: 'or click to browse',
    footnote: 'Required size: exactly 1920 x 480px (4:1 landscape banner)',
  },
  child: {
    width: 1080,
    height: 540,
    label: 'mobile slider',
    header: 'Drag & Drop your mobile slider image here',
    subHeader: 'or click to browse',
    footnote: 'Required size: exactly 1080 x 540px (2:1 landscape banner)',
  },
};

export const checkImageDimensions = (
  src: string,
  type: 'parent' | 'child'
): Promise<{ width: number; height: number; isValid: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      const spec = SLIDER_SPECS[type];

      if (width !== spec.width || height !== spec.height) {
        resolve({
          width,
          height,
          isValid: false,
          error: `Invalid dimensions (${width} x ${height}px). For ${spec.label}, image must be exactly ${spec.width} x ${spec.height}px.`,
        });
      } else {
        resolve({
          width,
          height,
          isValid: true,
        });
      }
    };
    img.onerror = () => {
      resolve({
        width: 0,
        height: 0,
        isValid: false,
        error: 'Unable to load image from the provided URL or file. Please check the image source.',
      });
    };
    img.src = src;
  });
};

interface AdminSlidersPageProps {
  user?: any;
  token?: string | null;
}

export const AdminSlidersPage: React.FC<AdminSlidersPageProps> = ({ token: propToken }) => {
  const token = propToken || localStorage.getItem('wetala_token') || '';

  const [sliders, setSliders] = useState<SliderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'parent' | 'child'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [metrics, setMetrics] = useState({
    total: 0,
    desktop: 0,
    mobile: 0,
    active: 0,
    inactive: 0,
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);
  const [editingSlider, setEditingSlider] = useState<SliderItem | null>(null);

  // Form states (Add / Edit)
  const [formTitle, setFormTitle] = useState('');
  const [formLink, setFormLink] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formBase64, setFormBase64] = useState('');
  const [formType, setFormType] = useState<'parent' | 'child'>('parent');
  const [formOrder, setFormOrder] = useState<number>(1);
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [dimensionNotice, setDimensionNotice] = useState<string | null>(null);
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);

  // Bulk Upload states
  const [bulkType, setBulkType] = useState<'parent' | 'child'>('parent');
  const [bulkFiles, setBulkFiles] = useState<Array<{ name: string; base64: string }>>([]);
  const [bulkUrls, setBulkUrls] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const fetchSliders = async () => {
    try {
      setRefreshing(true);
      const res = await api.adminGetSliders(
        {
          type: typeFilter !== 'all' ? typeFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: search.trim() || undefined,
        },
        token
      );
      if (res.status && res.data) {
        setSliders(res.data);
        if (res.metrics) {
          setMetrics(res.metrics);
        }
      }
    } catch (err: any) {
      console.error('[AdminSlidersPage] Error fetching sliders:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch sliders.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSliders();
  }, [typeFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSliders();
  };

  const handleClearSearch = () => {
    setSearch('');
    setTimeout(fetchSliders, 50);
  };

  // Open Add Modal
  const openAddModal = () => {
    const defaultType = typeFilter === 'child' ? 'child' : 'parent';
    const currentList = sliders.filter((s) => s.type === defaultType);
    const maxOrder = currentList.length > 0 ? Math.max(...currentList.map((s) => s.order || 0)) : 0;

    setEditingSlider(null);
    setFormTitle('');
    setFormLink('');
    setFormImageUrl('');
    setFormBase64('');
    setFormType(defaultType);
    setFormOrder(maxOrder + 1);
    setFormStatus('active');
    setFormError('');
    setDimensionNotice(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (slider: SliderItem) => {
    setEditingSlider(slider);
    setFormTitle(slider.title || '');
    setFormLink(slider.link || '');
    setFormImageUrl(slider.imageUrl || slider.image || '');
    setFormBase64('');
    setFormType(slider.type || 'parent');
    setFormOrder(slider.order || 1);
    setFormStatus(slider.status || 'active');
    setFormError('');
    setDimensionNotice(null);
    setIsAddModalOpen(true);
  };

  // Validate and process single file
  const processSingleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (PNG, JPG, WEBP, SVG)');
      return;
    }

    setFormError('');
    setDimensionNotice(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const result = reader.result as string;
      const check = await checkImageDimensions(result, formType);
      if (!check.isValid) {
        setFormError(check.error || 'Image size is not valid.');
        setFormBase64('');
        setFormImageUrl('');
        setDimensionNotice(null);
      } else {
        setFormBase64(result);
        setFormImageUrl(result);
        setFormError('');
        setDimensionNotice(`✓ Validated ${SLIDER_SPECS[formType].label}: ${check.width} x ${check.height}px`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSingleFile(file);
    }
  };

  // Validate URL explicitly
  const validateCurrentUrl = async (url: string, type: 'parent' | 'child' = formType) => {
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith('data:')) return;
    const normalized = normalizeDirectImageUrl(trimmed);
    if (normalized !== formImageUrl) {
      setFormImageUrl(normalized);
    }

    setIsValidatingUrl(true);
    setFormError('');
    setDimensionNotice(null);

    const check = await checkImageDimensions(getAssetUrl(normalized), type);
    setIsValidatingUrl(false);

    if (!check.isValid) {
      setFormError(check.error || 'Image size from URL is not valid.');
      setDimensionNotice(null);
    } else {
      setFormError('');
      setDimensionNotice(`✓ Validated ${SLIDER_SPECS[type].label}: ${check.width} x ${check.height}px`);
    }
  };

  // Re-validate when device type switches in modal
  const handleTypeChange = async (newType: 'parent' | 'child') => {
    setFormType(newType);
    setFormError('');
    setDimensionNotice(null);

    const checkSrc = formBase64 || formImageUrl;
    if (checkSrc) {
      const fullSrc = checkSrc.startsWith('data:') ? checkSrc : getAssetUrl(checkSrc);
      const check = await checkImageDimensions(fullSrc, newType);
      if (!check.isValid) {
        setFormError(check.error || `Current image is not valid for ${SLIDER_SPECS[newType].label}.`);
        setDimensionNotice(null);
      } else {
        setFormError('');
        setDimensionNotice(`✓ Validated ${SLIDER_SPECS[newType].label}: ${check.width} x ${check.height}px`);
      }
    }
  };

  // Save Single Slider (Create or Update)
  const handleSaveSlider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formImageUrl && !formBase64) {
      setFormError('Please upload an image or provide an Image URL.');
      return;
    }

    const normalizedUrl = normalizeDirectImageUrl(formImageUrl.trim());

    // Verify dimensions before saving
    const checkSrc = formBase64 || getAssetUrl(normalizedUrl);
    const check = await checkImageDimensions(checkSrc, formType);
    if (!check.isValid) {
      setFormError(check.error || 'Image size does not meet the required dimensions.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      if (editingSlider && (editingSlider._id || editingSlider.id)) {
        const id = (editingSlider._id || editingSlider.id) as string;
        await api.adminUpdateSlider(
          id,
          {
            title: formTitle,
            link: formLink,
            imageUrl: normalizedUrl,
            base64Image: formBase64 || undefined,
            type: formType,
            order: formOrder,
            status: formStatus,
          },
          token
        );
        setFeedback({ type: 'success', message: 'Slider updated successfully!' });
      } else {
        await api.adminCreateSlider(
          {
            title: formTitle,
            link: formLink,
            imageUrl: normalizedUrl,
            base64Image: formBase64 || undefined,
            type: formType,
            order: formOrder,
            status: formStatus,
          },
          token
        );
        setFeedback({ type: 'success', message: 'New slider published successfully!' });
      }

      setIsAddModalOpen(false);
      fetchSliders();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save slider');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle status
  const handleToggleStatus = async (slider: SliderItem) => {
    const id = (slider._id || slider.id) as string;
    const newStatus = slider.status === 'active' ? 'inactive' : 'active';
    try {
      await api.adminUpdateSliderStatus(id, newStatus, token);
      setSliders((prev) =>
        prev.map((s) => ((s._id || s.id) === id ? { ...s, status: newStatus } : s))
      );
      setFeedback({
        type: 'success',
        message: `Slider status changed to ${newStatus === 'active' ? 'Active' : 'Inactive'}.`,
      });
      fetchSliders();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update slider status.' });
    }
  };

  // Delete Slider
  const handleDeleteSlider = async (slider: SliderItem) => {
    const id = (slider._id || slider.id) as string;
    if (!window.confirm(`Are you sure you want to delete this slider? This action cannot be undone.`)) return;

    try {
      await api.adminDeleteSlider(id, token);
      setSliders((prev) => prev.filter((s) => (s._id || s.id) !== id));
      setFeedback({ type: 'success', message: 'Slider deleted successfully.' });
      fetchSliders();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete slider.' });
    }
  };

  // Quick move order
  const handleShiftOrder = async (slider: SliderItem, direction: 'up' | 'down') => {
    const id = (slider._id || slider.id) as string;
    const currentOrder = slider.order || 1;
    const targetOrder = direction === 'up' ? Math.max(1, currentOrder - 1) : currentOrder + 1;

    if (currentOrder === targetOrder) return;

    try {
      await api.adminUpdateSlider(id, { order: targetOrder }, token);
      fetchSliders();
    } catch (err: any) {
      alert(err.message || 'Failed to update order');
    }
  };

  // Copy URL to clipboard
  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle multiple files for bulk upload with dimension validation
  const handleBulkFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processBulkFiles(Array.from(files));
  };

  const processBulkFiles = async (files: File[]) => {
    const fileList: Array<{ name: string; base64: string }> = [];
    const rejectedList: string[] = [];
    let processed = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const check = await checkImageDimensions(base64, bulkType);
        if (!check.isValid) {
          rejectedList.push(`${f.name} (${check.width}x${check.height}px)`);
        } else {
          fileList.push({
            name: f.name,
            base64,
          });
        }
        processed++;
        if (processed === files.length) {
          if (rejectedList.length > 0) {
            setBulkError(
              `Rejected ${rejectedList.length} file(s) not matching the required ${SLIDER_SPECS[bulkType].label} size (exactly ${SLIDER_SPECS[bulkType].width}x${SLIDER_SPECS[bulkType].height}px): ${rejectedList.join(', ')}`
            );
          } else {
            setBulkError('');
          }
          if (fileList.length > 0) {
            setBulkFiles((prev) => [...prev, ...fileList]);
          }
        }
      };
      reader.readAsDataURL(f);
    }
  };

  // Submit Bulk Upload with dimension validation for URLs
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkSubmitting(true);
    setBulkError('');

    try {
      const urlList = bulkUrls
        .split('\n')
        .map((u) => normalizeDirectImageUrl(u.trim()))
        .filter((u) => u.length > 0);

      // Validate each URL dimensions
      if (urlList.length > 0) {
        for (let i = 0; i < urlList.length; i++) {
          const u = urlList[i];
          const check = await checkImageDimensions(getAssetUrl(u), bulkType);
          if (!check.isValid) {
            setBulkError(
              `URL #${i + 1} (${u.substring(0, 45)}...) is invalid: ${check.error || 'Does not match the required dimensions'}`
            );
            setBulkSubmitting(false);
            return;
          }
        }
      }

      const items: Array<{ image?: string; imageUrl?: string; base64?: string }> = [
        ...bulkFiles.map((f) => ({ base64: f.base64, image: f.base64 })),
        ...urlList.map((u) => ({ imageUrl: u, image: u })),
      ];

      if (items.length === 0) {
        setBulkError('Please select at least one valid image file or paste at least one valid image URL.');
        setBulkSubmitting(false);
        return;
      }

      await api.adminBulkCreateSliders(
        {
          type: bulkType,
          sliders: items,
        },
        token
      );

      setFeedback({ type: 'success', message: `Successfully batch uploaded ${items.length} slider(s)!` });
      setIsBulkModalOpen(false);
      setBulkFiles([]);
      setBulkUrls('');
      fetchSliders();
    } catch (err: any) {
      setBulkError(err.message || 'Failed to bulk upload sliders');
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <div className="page-body admin-sliders-page">
      {/* Top Header Banner */}
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
              Panchveda Wellness • Homepage Banner Slider Management
            </span>
          </div>

          <h1 className="page-title">Home Page Sliders</h1>
          <p className="page-subtitle">
            Configure desktop and mobile promotional banners, set redirect destinations, and reorder sliders in real-time.
          </p>
        </div>

        {/* Top Header Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={fetchSliders}
            disabled={refreshing}
            title="Refresh Slider Data"
          >
            <RefreshCw size={15} className={refreshing ? 'spin-anim' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setBulkFiles([]);
              setBulkUrls('');
              setBulkError('');
              setIsBulkModalOpen(true);
            }}
          >
            <Layers size={15} />
            <span>Bulk Upload</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={openAddModal}
          >
            <Plus size={17} />
            <span>Add Slider</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} color="#059669" /> : <AlertCircle size={18} color="#dc2626" />}
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        {/* Total Sliders */}
        <div className="kpi-card kpi-card-blue">
          <div className="kpi-icon-box kpi-icon-blue">
            <Sliders size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Sliders</div>
            <div className="kpi-value">{metrics.total}</div>
            <div className="kpi-trend-pill" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <span>Across all devices</span>
            </div>
          </div>
        </div>

        {/* Desktop Sliders */}
        <div className="kpi-card kpi-card-purple">
          <div className="kpi-icon-box kpi-icon-purple">
            <Monitor size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Desktop (Parent)</div>
            <div className="kpi-value">{metrics.desktop}</div>
            <div className="kpi-trend-pill" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <span>Wide Banner (16:9)</span>
            </div>
          </div>
        </div>

        {/* Mobile Sliders */}
        <div className="kpi-card kpi-card-green">
          <div className="kpi-icon-box kpi-icon-green">
            <Smartphone size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Mobile (Child)</div>
            <div className="kpi-value">{metrics.mobile}</div>
            <div className="kpi-trend-pill" style={{ background: '#ecfdf5', color: '#059669' }}>
              <span>Phone Optimized</span>
            </div>
          </div>
        </div>

        {/* Live Published Status */}
        <div className="kpi-card kpi-card-gold">
          <div className="kpi-icon-box kpi-icon-gold">
            <CheckCircle2 size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Published Live</div>
            <div className="kpi-value" style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              {metrics.active}
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                / {metrics.total}
              </span>
            </div>
            <div className="kpi-trend-pill" style={{ background: '#fffbeb', color: '#b45309' }}>
              <span>{metrics.inactive} in Draft</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container Card: Search, Filter Tabs & Slider List */}
      <div className="dashboard-card" style={{ padding: '24px', marginBottom: '30px' }}>
        {/* Search & Filter Toolbar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '14px',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            paddingBottom: '18px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          {/* Filter Chips / Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Device Type Chips */}
            <button
              type="button"
              className={`filter-chip ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              All Types ({metrics.total})
            </button>
            <button
              type="button"
              className={`filter-chip ${typeFilter === 'parent' ? 'active' : ''}`}
              onClick={() => setTypeFilter('parent')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Monitor size={14} /> Desktop ({metrics.desktop})
            </button>
            <button
              type="button"
              className={`filter-chip ${typeFilter === 'child' ? 'active' : ''}`}
              onClick={() => setTypeFilter('child')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Smartphone size={14} /> Mobile ({metrics.mobile})
            </button>

            {/* Divider */}
            <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }} />

            {/* Status Filter Dropdown / Chips */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: '7px 12px',
                borderRadius: '9999px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                background: '#ffffff',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive (Draft)</option>
            </select>
          </div>

          {/* Search Input Box */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '280px', flex: '0 1 360px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}
              />
              <input
                type="text"
                placeholder="Search by title, redirect link..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 34px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  background: '#f8fafc',
                  color: '#0f172a',
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="btn-secondary"
              style={{ padding: '8px 14px', height: '38px' }}
            >
              Search
            </button>
          </form>
        </div>

        {/* Loading State */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '70px 20px', color: '#64748b' }}>
            <div className="spin-anim" style={{ display: 'inline-block', marginBottom: '16px', color: '#1d72fe' }}>
              <RefreshCw size={32} />
            </div>
            <h4 style={{ color: '#0f172a', fontSize: '16px', fontWeight: 600, margin: '0 0 6px 0' }}>Loading Sliders...</h4>
            <p style={{ margin: 0, fontSize: '13px' }}>Fetching configuration from database</p>
          </div>
        ) : sliders.length === 0 ? (
          /* Empty State */
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: '#f8fafc',
              borderRadius: '14px',
              border: '1px dashed #cbd5e1',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#eff6ff',
                color: '#1d72fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 4px 12px rgba(29, 114, 254, 0.15)',
              }}
            >
              <Sliders size={28} />
            </div>
            <h3 style={{ color: '#0f172a', fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>
              No Home Sliders Found
            </h3>
            <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '440px', margin: '0 auto 24px', lineHeight: 1.6 }}>
              No sliders match your current filter settings. Upload promotional images for desktop and mobile displays to engage members.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={openAddModal}
              >
                <Plus size={16} /> Add Single Slider
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setBulkFiles([]);
                  setBulkUrls('');
                  setBulkError('');
                  setIsBulkModalOpen(true);
                }}
              >
                <Layers size={16} /> Bulk Upload Batch
              </button>
            </div>
          </div>
        ) : (
          /* Sliders Grid */
          <div className="admin-slider-grid">
            {sliders.map((slider) => {
              const id = (slider._id || slider.id) as string;
              const imgSrc = getAssetUrl(slider.imageUrl || slider.image);
              const isDesktop = slider.type === 'parent';
              const isActive = slider.status === 'active';

              return (
                <div key={id} className="admin-slider-card">
                  {/* Media Viewport */}
                  <div className="admin-slider-card-media">
                    <img
                      src={imgSrc}
                      alt={slider.title || 'Slider preview'}
                      className="admin-slider-card-img"
                      onError={(e: any) => {
                        e.target.src = 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&q=80';
                      }}
                    />

                    {/* Quick Preview Icon Overlay */}
                    <button
                      type="button"
                      title="Enlarge Image"
                      onClick={() => setPreviewModalImage(imgSrc)}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(4px)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                      }}
                      className="slider-preview-btn"
                    >
                      <Eye size={18} />
                    </button>

                    {/* Top Badges */}
                    <div className="admin-slider-badges">
                      {/* Device Tag */}
                      <span className={`badge-device ${isDesktop ? 'desktop' : 'mobile'}`}>
                        {isDesktop ? <Monitor size={12} /> : <Smartphone size={12} />}
                        <span>{isDesktop ? 'Desktop (Parent)' : 'Mobile (Child)'}</span>
                      </span>

                      {/* Status Tag */}
                      <span
                        className={`badge-status-pill ${isActive ? 'active' : 'inactive'}`}
                        onClick={() => handleToggleStatus(slider)}
                        style={{ cursor: 'pointer' }}
                        title="Click to toggle status"
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isActive ? '#34d399' : '#94a3b8',
                            display: 'inline-block',
                          }}
                        />
                        <span>{isActive ? 'Active' : 'Inactive'}</span>
                      </span>
                    </div>

                    {/* Order Tag */}
                    <div className="admin-slider-order-tag">
                      Order #{slider.order || 1}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="admin-slider-card-body">
                    <h3 className="admin-slider-card-title">
                      {slider.title || <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 400 }}>Untitled Banner</span>}
                    </h3>

                    {/* Link */}
                    <div className="admin-slider-card-link" style={{ marginTop: '8px' }}>
                      {slider.link ? (
                        <a
                          href={slider.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        >
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                            {slider.link}
                          </span>
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>No redirect link configured</span>
                      )}
                    </div>

                    {/* Image URL preview with Copy button */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        marginTop: '10px',
                        fontSize: '11px',
                        color: '#64748b',
                      }}
                    >
                      <span
                        style={{
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          maxWidth: '220px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {slider.imageUrl || slider.image}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(slider.imageUrl || slider.image, id)}
                        title="Copy Image URL"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedId === id ? '#10b981' : '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '2px',
                        }}
                      >
                        {copiedId === id ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>

                    {/* Action Bar */}
                    <div className="admin-slider-card-actions">
                      {/* Order shift buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn-icon-subtle"
                          title="Move Order Up"
                          onClick={() => handleShiftOrder(slider, 'up')}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon-subtle"
                          title="Move Order Down"
                          onClick={() => handleShiftOrder(slider, 'down')}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px', fontWeight: 600 }}>
                          #{slider.order || 1}
                        </span>
                      </div>

                      {/* Right action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-icon-subtle"
                          title="Edit Slider"
                          onClick={() => openEditModal(slider)}
                        >
                          <Edit3 size={14} />
                        </button>

                        <button
                          type="button"
                          className="btn-icon-danger"
                          title="Delete Slider"
                          onClick={() => handleDeleteSlider(slider)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* ADD / EDIT SLIDER MODAL                                  */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '580px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid #f1f5f9',
                background: '#fafbfc',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                  {editingSlider ? 'Edit Slider' : 'Add New Slider'}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  {editingSlider ? 'Update slide settings and redirect link' : 'Upload image or specify external banner link'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSlider}>
              <div style={{ padding: '24px', maxHeight: '72vh', overflowY: 'auto' }}>
                {formError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      marginBottom: '16px',
                    }}
                  >
                    {formError}
                  </div>
                )}

                {/* Device Type Select Boxes */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    Target Device Type <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div
                      className={`type-radio-box ${formType === 'parent' ? 'active' : ''}`}
                      onClick={() => handleTypeChange('parent')}
                      style={{ cursor: 'pointer' }}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Monitor size={18} />
                      </div>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>Desktop (`parent`)</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Exactly 1920 x 480px (4:1 banner)</span>
                      </div>
                    </div>

                    <div
                      className={`type-radio-box ${formType === 'child' ? 'active' : ''}`}
                      onClick={() => handleTypeChange('child')}
                      style={{ cursor: 'pointer' }}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: '#ecfdf5',
                          color: '#059669',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Smartphone size={18} />
                      </div>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>Mobile (`child`)</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Exactly 1080 x 540px (2:1 banner)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* File Upload Dropzone */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Upload Image File
                  </label>
                  <div
                    className="file-upload-dropzone"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        processSingleFile(e.dataTransfer.files[0]);
                      }
                    }}
                    style={{
                      border: '2px dashed #94a3b8',
                      borderRadius: '12px',
                      padding: '24px 16px',
                      background: '#f8fafc',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      id="single-slider-upload"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="single-slider-upload" style={{ cursor: 'pointer', textAlign: 'center', display: 'block' }}>
                      <p style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        {SLIDER_SPECS[formType].header}
                      </p>
                      <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}>
                        {SLIDER_SPECS[formType].subHeader}
                      </p>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 500 }}>
                        {SLIDER_SPECS[formType].footnote}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Direct Image URL Field */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                      Or Direct Image URL <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional if uploaded)</span>
                    </label>
                    {isValidatingUrl && (
                      <span style={{ fontSize: '12px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <RefreshCw size={12} className="spin-anim" /> Checking size...
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="https://example.com/banner.jpg or Google Drive / Dropbox link"
                      value={formImageUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        const normalized = normalizeDirectImageUrl(val);
                        setFormImageUrl(normalized);
                        setFormBase64('');
                        setDimensionNotice(null);
                        setFormError('');
                      }}
                      onBlur={() => validateCurrentUrl(formImageUrl, formType)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => validateCurrentUrl(formImageUrl, formType)}
                      disabled={isValidatingUrl || !formImageUrl || formImageUrl.startsWith('data:')}
                      style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                    >
                      Check Size
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                    Paste a direct image link or Google Drive link. Must be exactly {SLIDER_SPECS[formType].width} x {SLIDER_SPECS[formType].height}px.
                  </span>

                  {dimensionNotice && (
                    <div style={{ marginTop: '8px', padding: '6px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', color: '#047857', fontSize: '12px', fontWeight: 600 }}>
                      {dimensionNotice}
                    </div>
                  )}
                </div>

                {/* Live Image Preview */}
                {formImageUrl && (
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Image Preview
                    </label>
                    <div
                      style={{
                        position: 'relative',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        height: '180px',
                        background: '#0f172a',
                        border: '1px solid #cbd5e1',
                      }}
                    >
                      <img
                        src={getAssetUrl(formImageUrl)}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={(e: any) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Title Input */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Banner Title / Headline
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Welcome Reward 4% Turnover"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Redirect Link Input */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Target Redirect Link
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. /products or https://t.me/..."
                    value={formLink}
                    onChange={(e) => setFormLink(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Order & Status Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Display Order #
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formOrder}
                      onChange={(e) => setFormOrder(Number(e.target.value) || 1)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Publish Status
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as 'active' | 'inactive')}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                        background: '#ffffff',
                      }}
                    >
                      <option value="active">Active (Visible)</option>
                      <option value="inactive">Inactive (Draft)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  padding: '16px 24px',
                  borderTop: '1px solid #f1f5f9',
                  background: '#fafbfc',
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? 'Saving...' : editingSlider ? 'Save Changes' : 'Create Slider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BULK UPLOAD MODAL                                        */}
      {/* ======================================================== */}
      {isBulkModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setIsBulkModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid #f1f5f9',
                background: '#fafbfc',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                  Bulk Upload Sliders
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Upload multiple image files or paste image URLs to create sliders in batch
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '6px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBulkSubmit}>
              <div style={{ padding: '24px', maxHeight: '72vh', overflowY: 'auto' }}>
                {bulkError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      marginBottom: '16px',
                    }}
                  >
                    {bulkError}
                  </div>
                )}

                {/* Target Device Type */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    Device Type for this Batch
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div
                      className={`type-radio-box ${bulkType === 'parent' ? 'active' : ''}`}
                      onClick={() => setBulkType('parent')}
                      style={{ cursor: 'pointer' }}
                    >
                      <Monitor size={18} color="#2563eb" />
                      <div>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>Desktop (`parent`)</strong>
                      </div>
                    </div>
                    <div
                      className={`type-radio-box ${bulkType === 'child' ? 'active' : ''}`}
                      onClick={() => setBulkType('child')}
                      style={{ cursor: 'pointer' }}
                    >
                      <Smartphone size={18} color="#059669" />
                      <div>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>Mobile (`child`)</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multiple File Upload */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Select Image Files
                  </label>
                  <div
                    className="file-upload-dropzone"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        processBulkFiles(Array.from(e.dataTransfer.files));
                      }
                    }}
                    style={{
                      border: '2px dashed #94a3b8',
                      borderRadius: '12px',
                      padding: '24px 16px',
                      background: '#f8fafc',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleBulkFilesChange}
                      id="bulk-files-input"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="bulk-files-input" style={{ cursor: 'pointer', textAlign: 'center', display: 'block' }}>
                      <p style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        Drag & Drop your {bulkType === 'parent' ? 'desktop' : 'mobile'} slider images here
                      </p>
                      <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}>
                        or click to browse
                      </p>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 500 }}>
                        {SLIDER_SPECS[bulkType].footnote}
                      </span>
                    </label>
                  </div>

                  {bulkFiles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                      {bulkFiles.map((file, idx) => (
                        <div key={idx} className="chip-file-tag">
                          <span>{file.name}</span>
                          <X
                            size={12}
                            style={{ cursor: 'pointer', marginLeft: '6px' }}
                            onClick={() => setBulkFiles((prev) => prev.filter((_, i) => i !== idx))}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Multiple URLs Textarea */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Or Paste Multiple Image URLs (One URL per line)
                  </label>
                  <textarea
                    rows={4}
                    placeholder={"https://example.com/banner1.jpg\nhttps://example.com/banner2.jpg"}
                    value={bulkUrls}
                    onChange={(e) => setBulkUrls(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      fontFamily: 'monospace',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  padding: '16px 24px',
                  borderTop: '1px solid #f1f5f9',
                  background: '#fafbfc',
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsBulkModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={bulkSubmitting}
                >
                  {bulkSubmitting ? 'Uploading Batch...' : 'Upload All Sliders'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* IMAGE ENLARGE PREVIEW LIGHTBOX                           */}
      {/* ======================================================== */}
      {previewModalImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '24px',
          }}
          onClick={() => setPreviewModalImage(null)}
        >
          <div style={{ position: 'relative', maxWidth: '1000px', width: '100%', maxHeight: '90vh' }}>
            <button
              onClick={() => setPreviewModalImage(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#fff',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
            <img
              src={previewModalImage}
              alt="Enlarged preview"
              style={{
                width: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSlidersPage;
