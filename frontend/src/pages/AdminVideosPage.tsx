import React, { useState, useEffect } from 'react';
import { Alert, PageHeader } from '../components/ui';
import { Edit2, ExternalLink, Eye, Film, Palette, Play, Plus, RefreshCw, Save, Sparkles, Trash2, Video } from 'lucide-react';
import {
  api,
  type HomeVideoItem,
  type HomeVideoSettings,
  extractYouTubeId,
} from '../services/api';
import { CKEditorField } from '../components/CKEditorField';

interface AdminVideosPageProps {
  user?: any;
  token?: string | null;
}

export const AdminVideosPage: React.FC<AdminVideosPageProps> = ({ token }) => {
  const [settings, setSettings] = useState<HomeVideoSettings>({
    headerTitle: '<span style="color: var(--danger)">Featured</span> Official Presentation',
    headerSubtitle: 'Watch our curated video presentations, compensation overview, and wellness guides.',
    isActive: true,
  });
  const [videos, setVideos] = useState<HomeVideoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingVideo, setEditingVideo] = useState<HomeVideoItem | null>(null);

  // Video Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formYoutubeUrl, setFormYoutubeUrl] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formOrder, setFormOrder] = useState<number>(1);
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [savingVideo, setSavingVideo] = useState<boolean>(false);

  // Live preview toggle
  const [showLivePreview, setShowLivePreview] = useState<boolean>(false);

  // Fetch settings & videos
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.adminGetHomeVideos(token || undefined);
      if (res.status && res.data) {
        if (res.data.settings) {
          setSettings(res.data.settings);
        }
        setVideos(res.data.videos || []);
      }
    } catch (err: any) {
      console.error('[AdminVideosPage] Fetch error:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch videos' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setFeedback(null);
      const res = await api.adminUpdateHomeVideoSettings(
        {
          headerTitle: settings.headerTitle,
          headerSubtitle: settings.headerSubtitle,
          isActive: settings.isActive,
        },
        token || undefined
      );

      if (res.status) {
        setFeedback({ type: 'success', message: 'Video section header settings saved successfully!' });
      }
    } catch (err: any) {
      console.error('[AdminVideosPage] Save settings error:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to save settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingVideo(null);
    setFormTitle('');
    setFormYoutubeUrl('');
    setFormDescription('<p>Watch this official presentation to understand our proven system.</p>');
    setFormOrder(videos.length + 1);
    setFormStatus('ACTIVE');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (vid: HomeVideoItem) => {
    setEditingVideo(vid);
    setFormTitle(vid.title || '');
    setFormYoutubeUrl(vid.youtubeUrl || '');
    setFormDescription(vid.description || '');
    setFormOrder(vid.order || 1);
    setFormStatus(vid.status || 'ACTIVE');
    setIsModalOpen(true);
  };

  // Save Video
  const handleSaveVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    const extracted = extractYouTubeId(formYoutubeUrl.trim());
    if (!extracted) {
      alert('Please enter a valid YouTube video link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)');
      return;
    }

    try {
      setSavingVideo(true);
      setFeedback(null);

      const payload = {
        title: formTitle.trim(),
        youtubeUrl: formYoutubeUrl.trim(),
        description: formDescription.trim(),
        order: Number(formOrder) || 1,
        status: formStatus,
      };

      if (editingVideo && editingVideo._id) {
        await api.adminUpdateHomeVideo(editingVideo._id, payload, token || undefined);
        setFeedback({ type: 'success', message: 'Video updated successfully!' });
      } else {
        await api.adminCreateHomeVideo(payload, token || undefined);
        setFeedback({ type: 'success', message: 'New video added successfully!' });
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('[AdminVideosPage] Save video error:', err);
      alert(err.message || 'Failed to save video');
    } finally {
      setSavingVideo(false);
    }
  };

  // Toggle Video Status
  const handleToggleStatus = async (vid: HomeVideoItem) => {
    try {
      const newStatus = vid.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.adminToggleHomeVideoStatus(vid._id, newStatus, token || undefined);
      setVideos((prev) =>
        prev.map((v) => (v._id === vid._id ? { ...v, status: newStatus } : v))
      );
      setFeedback({
        type: 'success',
        message: `Video "${vid.title || vid.videoId}" is now ${newStatus.toLowerCase()}.`,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Delete Video
  const handleDeleteVideo = async (vid: HomeVideoItem) => {
    if (!window.confirm(`Are you sure you want to delete video "${vid.title || vid.videoId}"?`)) {
      return;
    }

    try {
      await api.adminDeleteHomeVideo(vid._id, token || undefined);
      setVideos((prev) => prev.filter((v) => v._id !== vid._id));
      setFeedback({ type: 'success', message: 'Video deleted successfully' });
    } catch (err: any) {
      alert(err.message || 'Failed to delete video');
    }
  };

  // Helper for quick color insertion into header title
  const applyColorPreset = (colorHex: string, label: string) => {
    setSettings((prev) => ({
      ...prev,
      headerTitle: `<span style="color: ${colorHex}">${label}</span> Official Video Showcase`,
    }));
  };

  const parsedCurrentVideoId = extractYouTubeId(formYoutubeUrl);

  return (
    <div className="page-body">
      <PageHeader
        title="Home Videos"
        subtitle="YouTube videos shown on the home page, just before the Products section."
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowLivePreview(!showLivePreview)}
              className={`btn ${showLivePreview ? 'btn-soft' : 'btn-secondary'}`}
              aria-pressed={showLivePreview}
            >
              <Eye size={16} />
              <span>{showLivePreview ? 'Hide preview' : 'Preview'}</span>
            </button>
            <button type="button" onClick={fetchData} disabled={loading} className="btn btn-secondary">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button type="button" onClick={openCreateModal} className="btn btn-primary">
              <Plus size={16} />
              <span>Add video</span>
            </button>
          </>
        }
      />

      {feedback && (
        <Alert tone={feedback.type === 'success' ? 'success' : 'error'} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Live Member Preview Strip (if enabled) */}
      {showLivePreview && (
        <div
          style={{
            marginBottom: 24,
            padding: 20,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '2px dashed var(--primary-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Sparkles size={18} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-strong)' }}>
              Live Preview (How Members See This On Home Page)
            </h3>
          </div>

          <div
            style={{
              padding: 20,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <div
                style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text-main)' }}
                dangerouslySetInnerHTML={{ __html: settings.headerTitle }}
              />
              {settings.headerSubtitle && (
                <div
                  style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)', marginTop: 4 }}
                  dangerouslySetInnerHTML={{ __html: settings.headerSubtitle }}
                />
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              {videos.filter((v) => v.status === 'ACTIVE').map((v) => (
                <div
                  key={v._id}
                  style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ aspectRatio: '16 / 9', background: '#000' }}>
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${v.videoId}`}
                      title={v.title}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                  </div>
                  <div style={{ padding: 14 }}>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-main)' }}>
                      {v.title}
                    </h4>
                    <div
                      style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}
                      dangerouslySetInnerHTML={{ __html: v.description }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grid: 1. Section Header Settings (Managed by Super Admin with CKEditor) */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '22px 24px',
          marginBottom: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md)',
                background: 'var(--danger-light)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Palette size={16} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-main)' }}>
                Section Header & Typography Settings
              </h2>
              <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                Admin-controlled title and subtitle with CKEditor rich text formatting and color customization.
              </p>
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 'var(--fs-base)',
              fontWeight: 600,
              color: settings.isActive ? 'var(--success)' : 'var(--danger)',
            }}
          >
            <input
              type="checkbox"
              checked={settings.isActive}
              onChange={(e) => setSettings({ ...settings, isActive: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--success)' }}
            />
            <span>{settings.isActive ? 'Section Visible on Member Home' : 'Section Hidden'}</span>
          </label>
        </div>

        <form onSubmit={handleSaveSettings}>
          {/* Quick Color Presets */}
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Quick Color Presets:</span>
            {[
              { label: 'Crimson Red', color: 'var(--danger)' },
              { label: 'Royal Blue', color: 'var(--primary)' },
              { label: 'Emerald Green', color: 'var(--success)' },
              { label: 'Purple Violet', color: 'var(--accent)' },
              { label: 'Amber Orange', color: 'var(--warning)' },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyColorPreset(p.color, p.label)}
                style={{
                  fontSize: 'var(--fs-xs)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${p.color}`,
                  background: 'var(--surface)',
                  color: p.color,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ● {p.label}
              </button>
            ))}
          </div>

          {/* Title with CKEditor */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
              Section Title (Rich Text & Color Text via CKEditor) *
            </label>
            <CKEditorField
              value={settings.headerTitle}
              onChange={(val) => setSettings({ ...settings, headerTitle: val })}
              placeholder="Enter section title with colors, headings, bold text..."
              minHeight="100px"
            />
          </div>

          {/* Subtitle with CKEditor */}
          <div style={{ marginBottom: 18 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
              Section Subtitle (Rich Text via CKEditor)
            </label>
            <CKEditorField
              value={settings.headerSubtitle}
              onChange={(val) => setSettings({ ...settings, headerSubtitle: val })}
              placeholder="Enter optional description or subtitle..."
              minHeight="90px"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={savingSettings} className="btn btn-primary">
              <Save size={16} />
              <span>{savingSettings ? 'Saving Settings...' : 'Save Header Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Videos List / CRUD Table */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '22px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-main)' }}>
              YouTube Videos ({videos.length})
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              Videos are shown in the grid on Member Home, ordered by sequence number.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal} className="btn btn-danger">
            <Plus size={16} />
            <span>Add Video</span>
          </button>
        </div>

        {/* Video Cards Grid */}
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: 'var(--fs-md)' }}>Loading videos...</p>
          </div>
        ) : videos.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              border: '2px dashed var(--border-strong)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-subtle)',
            }}
          >
            <Video size={42} style={{ color: 'var(--text-light)', margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-body)' }}>
              No Videos Added Yet
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 'var(--fs-base)', color: 'var(--text-muted)', maxWidth: 420 }}>
              Paste any YouTube video link along with a description to showcase presentations on the member homepage.
            </p>
            <button
              type="button"
              onClick={openCreateModal} className="btn btn-danger">
              <Plus size={16} />
              <span>Add First Video</span>
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: 20,
            }}
          >
            {videos.map((vid) => (
              <div
                key={vid._id}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  opacity: vid.status === 'INACTIVE' ? 0.65 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {/* Thumbnail / Player preview */}
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', backgroundColor: '#000' }}>
                  <img
                    src={`https://img.youtube.com/vi/${vid.videoId}/hqdefault.jpg`}
                    alt={vid.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      // Fallback if hqdefault fails
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: 'rgba(220, 38, 38, 0.9)',
                        color: 'var(--text-inverse)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      }}
                    >
                      <Play size={22} fill="var(--text-inverse)" style={{ marginLeft: 2 }} />
                    </div>
                  </div>

                  {/* Order & Status Badges */}
                  <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
                    <span
                      style={{
                        background: 'rgba(15, 23, 42, 0.85)',
                        color: 'var(--text-inverse)',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      #{vid.order}
                    </span>
                  </div>

                  <div style={{ position: 'absolute', top: 10, right: 10 }}>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(vid)}
                      style={{
                        background: vid.status === 'ACTIVE' ? 'rgba(5, 150, 105, 0.9)' : 'rgba(220, 38, 38, 0.9)',
                        color: 'var(--text-inverse)',
                        border: 'none',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {vid.status}
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3
                    style={{
                      margin: '0 0 6px 0',
                      fontSize: 'var(--fs-lg)',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      lineHeight: 1.35,
                    }}
                  >
                    {vid.title || 'Untitled Presentation'}
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Video ID:</span>
                    <code style={{ fontSize: 'var(--fs-xs)', background: 'var(--surface-muted)', padding: '2px 6px', borderRadius: 'var(--radius-xs)' }}>
                      {vid.videoId}
                    </code>
                    <a
                      href={vid.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', marginLeft: 'auto' }}
                      title="Open on YouTube"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>

                  {/* Description below video */}
                  <div
                    style={{
                      fontSize: 'var(--fs-base)',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      marginBottom: 16,
                      flex: 1,
                      maxHeight: 120,
                      overflowY: 'auto',
                      padding: '8px 10px',
                      background: 'var(--surface-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                    }}
                    dangerouslySetInnerHTML={{ __html: vid.description || '<em>No description provided</em>' }}
                  />

                  {/* Actions */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--border-light)',
                      paddingTop: 12,
                      marginTop: 'auto',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(vid)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 600,
                        color: vid.status === 'ACTIVE' ? 'var(--danger)' : 'var(--success)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {vid.status === 'ACTIVE' ? 'Set Inactive' : 'Activate'}
                    </button>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => openEditModal(vid)} className="btn btn-secondary btn-sm">
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteVideo(vid)} className="btn btn-danger-outline btn-sm">
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Video Modal */}
      {isModalOpen && (
        <div className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}>
          <div className="modal modal-legacy" style={{ maxWidth: 720, display: 'flex', flexDirection: 'column' }} role="dialog" aria-modal="true">
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--danger-soft)',
                    color: 'var(--danger)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Film size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text-main)' }}>
                    {editingVideo ? 'Edit YouTube Video' : 'Add New YouTube Video'}
                  </h3>
                  <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    Paste your YouTube link and provide video details with rich text.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '22px',
                  color: 'var(--text-light)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveVideo} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* YouTube Link Field */}
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  YouTube Video Link / URL *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ or https://youtu.be/..."
                  value={formYoutubeUrl}
                  onChange={(e) => setFormYoutubeUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 'var(--fs-md)',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Supports standard watch links, youtu.be, shorts, and embed URLs. The video ID is auto-extracted.
                </span>

                {/* Live ID & Thumbnail Preview */}
                {parsedCurrentVideoId && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      background: 'var(--surface-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <img
                      src={`https://img.youtube.com/vi/${parsedCurrentVideoId}/hqdefault.jpg`}
                      alt="Thumbnail preview"
                      style={{ width: 90, height: 50, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                    />
                    <div>
                      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--success)', display: 'block' }}>
                        ✓ Valid YouTube Link Detected
                      </span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                        Video ID: <strong>{parsedCurrentVideoId}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Video Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wetala Business & Wellness Opportunity 2026"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 'var(--fs-md)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Description via CKEditor */}
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Video Description (Displayed directly below the video) *
                </label>
                <CKEditorField
                  value={formDescription}
                  onChange={(val) => setFormDescription(val)}
                  placeholder="Write presentation notes, key timestamps, or instructions below this video..."
                  minHeight="140px"
                />
              </div>

              {/* Order & Status row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formOrder}
                    onChange={(e) => setFormOrder(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-md)',
                    }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-md)',
                      background: 'var(--surface)',
                    }}
                  >
                    <option value="ACTIVE">ACTIVE (Visible on Home)</option>
                    <option value="INACTIVE">INACTIVE (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                  marginTop: 10,
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: 16,
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVideo} className="btn btn-danger">
                  <Save size={16} />
                  <span>{savingVideo ? 'Saving Video...' : editingVideo ? 'Update Video' : 'Add Video'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
