import React, { useState, useEffect } from 'react';
import {
  Video,
  Plus,
  Save,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Film,
  Sparkles,
  Play,
  Palette,
} from 'lucide-react';
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
    headerTitle: '<span style="color: #dc2626">Featured</span> Official Presentation',
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
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 16px' }}>
      {/* Top Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          padding: '20px 24px',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.2)',
            }}
          >
            <Video size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
              Home Video Showcase Manager
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Manage the dedicated YouTube video section shown to members right before the Products section.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setShowLivePreview(!showLivePreview)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: showLivePreview ? '#f1f5f9' : '#ffffff',
              color: '#334155',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Eye size={16} />
            <span>{showLivePreview ? 'Hide Member View' : 'Live Member View'}</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
            }}
          >
            <Plus size={16} />
            <span>Add YouTube Video</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 14,
            fontWeight: 500,
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Live Member Preview Strip (if enabled) */}
      {showLivePreview && (
        <div
          style={{
            marginBottom: 24,
            padding: 20,
            background: '#ffffff',
            borderRadius: 16,
            border: '2px dashed #93c5fd',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Sparkles size={18} color="#2563eb" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
              Live Preview (How Members See This On Home Page)
            </h3>
          </div>

          <div
            style={{
              padding: 20,
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <div
                style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}
                dangerouslySetInnerHTML={{ __html: settings.headerTitle }}
              />
              {settings.headerSubtitle && (
                <div
                  style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}
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
                    background: '#ffffff',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
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
                    <h4 style={{ margin: '0 0 6px 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                      {v.title}
                    </h4>
                    <div
                      style={{ fontSize: 12.5, color: '#64748b' }}
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
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
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
                borderRadius: 8,
                background: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Palette size={16} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                Section Header & Typography Settings
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
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
              fontSize: 13,
              fontWeight: 600,
              color: settings.isActive ? '#059669' : '#dc2626',
            }}
          >
            <input
              type="checkbox"
              checked={settings.isActive}
              onChange={(e) => setSettings({ ...settings, isActive: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#059669' }}
            />
            <span>{settings.isActive ? 'Section Visible on Member Home' : 'Section Hidden'}</span>
          </label>
        </div>

        <form onSubmit={handleSaveSettings}>
          {/* Quick Color Presets */}
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Quick Color Presets:</span>
            {[
              { label: 'Crimson Red', color: '#dc2626' },
              { label: 'Royal Blue', color: '#2563eb' },
              { label: 'Emerald Green', color: '#059669' },
              { label: 'Purple Violet', color: '#7c3aed' },
              { label: 'Amber Orange', color: '#d97706' },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyColorPreset(p.color, p.label)}
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: `1px solid ${p.color}`,
                  background: '#ffffff',
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
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
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
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
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
              disabled={savingSettings}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                borderRadius: 10,
                background: '#0f172a',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.2)',
              }}
            >
              <Save size={16} />
              <span>{savingSettings ? 'Saving Settings...' : 'Save Header Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Videos List / CRUD Table */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
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
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
              YouTube Videos ({videos.length})
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>
              Videos are shown in the grid on Member Home, ordered by sequence number.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              background: '#dc2626',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            <span>Add Video</span>
          </button>
        </div>

        {/* Video Cards Grid */}
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: 14 }}>Loading videos...</p>
          </div>
        ) : videos.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              border: '2px dashed #cbd5e1',
              borderRadius: 14,
              background: '#f8fafc',
            }}
          >
            <Video size={42} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: '#334155' }}>
              No Videos Added Yet
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748b', maxWidth: 420 }}>
              Paste any YouTube video link along with a description to showcase presentations on the member homepage.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                borderRadius: 8,
                background: '#dc2626',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
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
                  background: '#ffffff',
                  borderRadius: 14,
                  border: '1px solid #e2e8f0',
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
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      }}
                    >
                      <Play size={22} fill="#ffffff" style={{ marginLeft: 2 }} />
                    </div>
                  </div>

                  {/* Order & Status Badges */}
                  <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
                    <span
                      style={{
                        background: 'rgba(15, 23, 42, 0.85)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
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
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
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
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#0f172a',
                      lineHeight: 1.35,
                    }}
                  >
                    {vid.title || 'Untitled Presentation'}
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Video ID:</span>
                    <code style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                      {vid.videoId}
                    </code>
                    <a
                      href={vid.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#2563eb', display: 'inline-flex', alignItems: 'center', marginLeft: 'auto' }}
                      title="Open on YouTube"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>

                  {/* Description below video */}
                  <div
                    style={{
                      fontSize: 13,
                      color: '#475569',
                      lineHeight: 1.5,
                      marginBottom: 16,
                      flex: 1,
                      maxHeight: 120,
                      overflowY: 'auto',
                      padding: '8px 10px',
                      background: '#f8fafc',
                      borderRadius: 8,
                      border: '1px solid #f1f5f9',
                    }}
                    dangerouslySetInnerHTML={{ __html: vid.description || '<em>No description provided</em>' }}
                  />

                  {/* Actions */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid #f1f5f9',
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
                        fontSize: 12,
                        fontWeight: 600,
                        color: vid.status === 'ACTIVE' ? '#dc2626' : '#059669',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {vid.status === 'ACTIVE' ? 'Set Inactive' : 'Activate'}
                    </button>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => openEditModal(vid)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#334155',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteVideo(vid)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #fecaca',
                          background: '#fff5f5',
                          color: '#dc2626',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: 16,
            backdropFilter: 'blur(3px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 18,
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
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
                    borderRadius: 10,
                    background: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Film size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    {editingVideo ? 'Edit YouTube Video' : 'Add New YouTube Video'}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
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
                  fontSize: 22,
                  color: '#94a3b8',
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
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
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
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                  Supports standard watch links, youtu.be, shorts, and embed URLs. The video ID is auto-extracted.
                </span>

                {/* Live ID & Thumbnail Preview */}
                {parsedCurrentVideoId && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      background: '#f8fafc',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <img
                      src={`https://img.youtube.com/vi/${parsedCurrentVideoId}/hqdefault.jpg`}
                      alt="Thumbnail preview"
                      style={{ width: 90, height: 50, objectFit: 'cover', borderRadius: 6 }}
                    />
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', display: 'block' }}>
                        ✓ Valid YouTube Link Detected
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        Video ID: <strong>{parsedCurrentVideoId}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
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
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Description via CKEditor */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
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
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
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
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 14,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 14,
                      background: '#fff',
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
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: 16,
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVideo}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 22px',
                    borderRadius: 8,
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                  }}
                >
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
