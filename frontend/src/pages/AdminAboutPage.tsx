import React, { useState, useEffect } from 'react';
import {
  Info,
  Plus,
  Save,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import {
  api,
  type AboutSectionItem,
  normalizeGoogleDriveUrl,
} from '../services/api';
import { CKEditorField } from '../components/CKEditorField';

interface AdminAboutPageProps {
  user?: any;
  token?: string | null;
}

export const AdminAboutPage: React.FC<AdminAboutPageProps> = ({ token }) => {
  const [sections, setSections] = useState<AboutSectionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSection, setEditingSection] = useState<AboutSectionItem | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSubtitle, setFormSubtitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formOrder, setFormOrder] = useState<number>(1);

  const fetchSections = async () => {
    try {
      setLoading(true);
      const res = await api.adminGetAboutSections(token || undefined);
      if (res.status && Array.isArray(res.data)) {
        setSections(res.data);
      }
    } catch (err: any) {
      console.error('[AdminAboutPage] fetch error:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch about sections' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const openCreateModal = () => {
    setEditingSection(null);
    setFormTitle('');
    setFormSubtitle('');
    setFormDescription(
      '<p>Welcome to <strong>Wetala Wellness</strong>. We formulate pure, research-backed Ayurvedic wellness products crafted to restore natural vitality.</p>'
    );
    setFormImageUrl('');
    setFormStatus('ACTIVE');
    setFormOrder(sections.length + 1);
    setIsModalOpen(true);
  };

  const openEditModal = (sec: AboutSectionItem) => {
    setEditingSection(sec);
    setFormTitle(sec.title || '');
    setFormSubtitle(sec.subtitle || '');
    setFormDescription(sec.description || '');
    setFormImageUrl(sec.imageUrl || '');
    setFormStatus(sec.status || 'ACTIVE');
    setFormOrder(sec.order || 1);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      alert('Title is mandatory');
      return;
    }

    if (!formDescription.trim()) {
      alert('Description is required');
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      const payload = {
        title: formTitle.trim(),
        subtitle: formSubtitle.trim(),
        description: formDescription.trim(),
        imageUrl: formImageUrl.trim(),
        status: formStatus,
        order: Number(formOrder) || 1,
      };

      if (editingSection && editingSection._id) {
        await api.adminUpdateAboutSection(editingSection._id, payload, token || undefined);
        setFeedback({ type: 'success', message: 'About section updated successfully!' });
      } else {
        await api.adminCreateAboutSection(payload, token || undefined);
        setFeedback({ type: 'success', message: 'New About section created successfully!' });
      }

      setIsModalOpen(false);
      fetchSections();
    } catch (err: any) {
      console.error('[AdminAboutPage] save error:', err);
      alert(err.message || 'Failed to save about section');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (sec: AboutSectionItem) => {
    try {
      const newStatus = sec.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.adminToggleAboutSectionStatus(sec._id, newStatus, token || undefined);
      setSections((prev) =>
        prev.map((s) => (s._id === sec._id ? { ...s, status: newStatus } : s))
      );
      setFeedback({
        type: 'success',
        message: `"${sec.title}" is now ${newStatus === 'ACTIVE' ? 'Visible to Members' : 'Hidden from Members'}`,
      });
    } catch (err: any) {
      console.error('[AdminAboutPage] status error:', err);
      fetchSections();
      setFeedback({ type: 'error', message: err.message || 'Failed to update status' });
    }
  };

  const handleDelete = async (sec: AboutSectionItem) => {
    if (!window.confirm(`Are you sure you want to delete "${sec.title}"?`)) return;
    try {
      await api.adminDeleteAboutSection(sec._id, token || undefined);
      setSections((prev) => prev.filter((s) => s._id !== sec._id));
      setFeedback({ type: 'success', message: `"${sec.title}" has been deleted.` });
    } catch (err: any) {
      console.error('[AdminAboutPage] delete error:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to delete section' });
    }
  };

  const activeSections = sections.filter((s) => s.status === 'ACTIVE');
  const previewConvertedUrl = normalizeGoogleDriveUrl(formImageUrl);

  return (
    <div className="page-body admin-about-page" style={{ padding: '24px 32px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.15)',
            }}
          >
            <Info size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Manage About Us Section
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Configure the company story, mission & vision displayed on the member home page after products.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={fetchSections}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
            <span>Reload</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
          >
            <Plus size={16} />
            <span>Add About Section</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 13,
            fontWeight: 500,
            background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span style={{ flex: 1 }}>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            padding: 16,
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Live On Member Portal
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
            {activeSections.length} Active {activeSections.length === 1 ? 'Section' : 'Sections'}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            Displayed directly after Featured Products
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: 16,
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Google Drive Support
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2563eb', marginTop: 8 }}>
            Auto-Converted
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            Pasted Drive links render directly in HD
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: 16,
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Editor Engine
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginTop: 8 }}>
            CKEditor 5
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            Formatted text, lists, headings & quotes
          </div>
        </div>
      </div>

      {/* Sections Table / Cards */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          marginBottom: 28,
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
            Configured About Sections ({sections.length})
          </h2>
        </div>

        {sections.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            <Info size={40} style={{ margin: '0 auto 12px', color: '#cbd5e1' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No about sections configured yet.</p>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              Click "Add About Section" to publish your company story.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Image</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Title & Subtitle</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Order</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((sec) => {
                  const directImg = normalizeGoogleDriveUrl(sec.imageUrl);

                  return (
                    <tr
                      key={sec._id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div
                          style={{
                            width: 64,
                            height: 48,
                            borderRadius: 8,
                            background: '#f1f5f9',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {directImg ? (
                            <img
                              src={directImg}
                              alt={sec.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <ImageIcon size={20} color="#94a3b8" />
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{sec.title}</div>
                        {sec.subtitle && (
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {sec.subtitle}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px', fontWeight: 600, color: '#475569' }}>
                        #{sec.order}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(sec)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 14,
                            border: 'none',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: sec.status === 'ACTIVE' ? '#dcfce7' : '#f1f5f9',
                            color: sec.status === 'ACTIVE' ? '#15803d' : '#64748b',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: sec.status === 'ACTIVE' ? '#16a34a' : '#94a3b8',
                            }}
                          />
                          {sec.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(sec)}
                            title="Edit Section"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#2563eb',
                              cursor: 'pointer',
                            }}
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(sec)}
                            title="Delete Section"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#dc2626',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Member Preview */}
      {activeSections.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: 14,
            padding: '20px 24px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Eye size={16} color="#64748b" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
              Live Member View Preview (After Products Section)
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                color: '#059669',
                background: '#dcfce7',
                padding: '2px 8px',
                borderRadius: 12,
                fontWeight: 600,
              }}
            >
              Realtime
            </span>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              padding: '28px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: activeSections[0].imageUrl ? '1.15fr 0.85fr' : '1fr', gap: 24, alignItems: 'center' }}>
              <div>
                {activeSections[0].subtitle && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', marginBottom: 8 }}>
                    {activeSections[0].subtitle}
                  </div>
                )}
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0' }}>
                  {activeSections[0].title}
                </h3>
                <div
                  style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: activeSections[0].description }}
                />
              </div>

              {activeSections[0].imageUrl && (
                <div style={{ height: 220, borderRadius: 12, overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <img
                    src={normalizeGoogleDriveUrl(activeSections[0].imageUrl)}
                    alt={activeSections[0].title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit About Section */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 780,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {editingSection ? 'Edit About Us Section' : 'Create About Us Section'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} style={{ padding: '24px' }}>
              {/* Title (Mandatory) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Title <span style={{ color: '#ef4444' }}>* (Mandatory)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. About Wetala Wellness"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    color: '#0f172a',
                    fontWeight: 600,
                  }}
                />
              </div>

              {/* Subtitle (Optional) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Subtitle <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ancient Ayurvedic Wisdom Meets Modern Science"
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    color: '#0f172a',
                  }}
                />
              </div>

              {/* Image URL with Google Drive Support */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Image URL / Google Drive Share Link
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/file/d/... or direct image URL"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      fontFamily: 'monospace',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#0284c7', marginTop: 6 }}>
                  <Sparkles size={13} />
                  <span>
                    Google Drive links like <code>drive.google.com/file/d/ID/view</code> are automatically converted to direct rendering URLs!
                  </span>
                </div>

                {/* Instant Image Preview */}
                {previewConvertedUrl && (
                  <div
                    style={{
                      marginTop: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 10,
                      background: '#f8fafc',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <img
                      src={previewConvertedUrl}
                      alt="Preview"
                      style={{
                        width: 72,
                        height: 52,
                        objectFit: 'cover',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                      }}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div style={{ fontSize: 11, color: '#475569' }}>
                      <div style={{ fontWeight: 700, color: '#16a34a' }}>✓ Image Preview Active</div>
                      <div style={{ color: '#94a3b8', wordBreak: 'break-all' }}>{previewConvertedUrl}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Description (CKEditor) */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Description <span style={{ color: '#ef4444' }}>* (CKEditor Rich Text)</span>
                </label>
                <CKEditorField
                  value={formDescription}
                  onChange={(val) => setFormDescription(val)}
                  placeholder="Write formatted paragraphs, bullet points, and company story..."
                  minHeight="200px"
                />
              </div>

              {/* Row: Status & Order */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                    }}
                  >
                    <option value="ACTIVE">ACTIVE (Visible on Member Home)</option>
                    <option value="INACTIVE">INACTIVE (Hidden)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={formOrder}
                    onChange={(e) => setFormOrder(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 22px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  }}
                >
                  <Save size={15} />
                  <span>{saving ? 'Saving...' : 'Save Section'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAboutPage;
