import React, { useState, useEffect } from 'react';
import { Alert, Badge, PageHeader } from '../components/ui';
import { Edit2, Eye, ImageIcon, Info, Plus, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
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
    <div className="page-body admin-about-page">
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            About Us
            <Badge tone={activeSections.length ? 'success' : 'neutral'} size="lg">{activeSections.length} live</Badge>
          </span>
        }
        subtitle="Company story, mission and vision shown on the home page after Featured Products. Google Drive image links are converted automatically."
        actions={
          <>
            <button type="button" onClick={fetchSections} disabled={loading} className="btn btn-secondary">
              <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
              <span>Reload</span>
            </button>
            <button type="button" onClick={openCreateModal} className="btn btn-primary">
              <Plus size={16} />
              <span>Add section</span>
            </button>
          </>
        }
      />

      {feedback && (
        <Alert tone={feedback.type === 'success' ? 'success' : 'error'} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Sections Table / Cards */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          marginBottom: 28,
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            Configured About Sections ({sections.length})
          </h2>
        </div>

        {sections.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>
            <Info size={40} style={{ margin: '0 auto 12px', color: 'var(--text-disabled)' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No about sections configured yet.</p>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-light)', marginTop: 4 }}>
              Click "Add About Section" to publish your company story.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Title & Subtitle</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((sec) => {
                  const directImg = normalizeGoogleDriveUrl(sec.imageUrl);

                  return (
                    <tr
                      key={sec._id}
                      style={{
                        borderBottom: '1px solid var(--border-light)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td>
                        <div
                          style={{
                            width: 64,
                            height: 48,
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--surface-muted)',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          {directImg ? (
                            <img
                              src={directImg}
                              alt={sec.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <ImageIcon size={20} color="var(--text-light)" />
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{sec.title}</div>
                        {sec.subtitle && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                            {sec.subtitle}
                          </div>
                        )}
                      </td>

                      <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        #{sec.order}
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(sec)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-lg)',
                            border: 'none',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: sec.status === 'ACTIVE' ? 'var(--success-soft)' : 'var(--surface-muted)',
                            color: sec.status === 'ACTIVE' ? 'var(--success-hover)' : 'var(--text-muted)',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: sec.status === 'ACTIVE' ? 'var(--success)' : 'var(--text-light)',
                            }}
                          />
                          {sec.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(sec)}
                            title="Edit Section" className="btn btn-secondary">
                            <Edit2 size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(sec)}
                            title="Delete Section" className="btn btn-danger-outline">
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
            background: 'var(--surface-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Eye size={16} color="var(--text-muted)" />
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-body)' }}>
              Live Member View Preview (After Products Section)
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 'var(--fs-xs)',
                color: 'var(--success)',
                background: 'var(--success-soft)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-lg)',
                fontWeight: 600,
              }}
            >
              Realtime
            </span>
          </div>

          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '28px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: activeSections[0].imageUrl ? '1.15fr 0.85fr' : '1fr', gap: 24, alignItems: 'center' }}>
              <div>
                {activeSections[0].subtitle && (
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 8 }}>
                    {activeSections[0].subtitle}
                  </div>
                )}
                <h3 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 12px 0' }}>
                  {activeSections[0].title}
                </h3>
                <div
                  style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: activeSections[0].description }}
                />
              </div>

              {activeSections[0].imageUrl && (
                <div style={{ height: 220, borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--surface-subtle)', border: '1px solid var(--border-color)' }}>
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
        <div className="modal-backdrop">
          <div className="modal modal-legacy" style={{ maxWidth: 780, display: 'flex', flexDirection: 'column' }} role="dialog" aria-modal="true">
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                {editingSection ? 'Edit About Us Section' : 'Create About Us Section'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 'var(--fs-2xl)', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} style={{ padding: '24px' }}>
              {/* Title (Mandatory) */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Title <span style={{ color: 'var(--danger)' }}>* (Mandatory)</span>
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
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 'var(--fs-md)',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                  }}
                />
              </div>

              {/* Subtitle (Optional) */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Subtitle <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ancient Ayurvedic Wisdom Meets Modern Science"
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 'var(--fs-base)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              {/* Image URL with Google Drive Support */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
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
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-base)',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--info)', marginTop: 6 }}>
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
                      background: 'var(--surface-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <img
                      src={previewConvertedUrl}
                      alt="Preview"
                      style={{
                        width: 72,
                        height: 52,
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-strong)',
                      }}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 700, color: 'var(--success)' }}>✓ Image Preview Active</div>
                      <div style={{ color: 'var(--text-light)', wordBreak: 'break-all' }}>{previewConvertedUrl}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Description (CKEditor) */}
              <div style={{ marginBottom: 18 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Description <span style={{ color: 'var(--danger)' }}>* (CKEditor Rich Text)</span>
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
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-base)',
                    }}
                  >
                    <option value="ACTIVE">ACTIVE (Visible on Member Home)</option>
                    <option value="INACTIVE">INACTIVE (Hidden)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
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
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-base)',
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving} className="btn btn-primary">
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
