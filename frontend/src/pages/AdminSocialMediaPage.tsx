import React, { useState, useEffect } from 'react';
import { Alert, Badge, PageHeader } from '../components/ui';
import { ExternalLink, Eye, Facebook, Globe, Instagram, Linkedin, Plus, RefreshCw, Save, Share2, Sparkles, Trash2, Youtube } from 'lucide-react';
import { api, type SocialLinkItem, type SocialPlatformType } from '../services/api';

// Platform icons
const TwitterXIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const WhatsAppIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.12-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.18-.47-.3" />
  </svg>
);

const TelegramIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
  </svg>
);

const PLATFORM_META: Record<
  string,
  {
    name: string;
    placeholder: string;
    badgeBg: string;
    badgeColor: string;
    icon: React.ReactNode;
  }
> = {
  youtube: {
    name: 'YouTube Channel',
    placeholder: 'https://youtube.com/@channelName',
    badgeBg: '#FF0000',
    badgeColor: 'var(--text-inverse)',
    icon: <Youtube size={18} />,
  },
  instagram: {
    name: 'Instagram Profile',
    placeholder: 'https://instagram.com/company_official',
    badgeBg: 'linear-gradient(45deg, #f09433, #dc2743, #bc1888)',
    badgeColor: 'var(--text-inverse)',
    icon: <Instagram size={18} />,
  },
  twitter: {
    name: 'X (Twitter)',
    placeholder: 'https://x.com/company_official',
    badgeBg: '#09090b',
    badgeColor: 'var(--text-inverse)',
    icon: <TwitterXIcon size={16} />,
  },
  facebook: {
    name: 'Facebook Page',
    placeholder: 'https://facebook.com/company_page',
    badgeBg: '#1877F2',
    badgeColor: 'var(--text-inverse)',
    icon: <Facebook size={18} />,
  },
  whatsapp: {
    name: 'WhatsApp Channel / Group',
    placeholder: 'https://chat.whatsapp.com/... or https://wa.me/91...',
    badgeBg: '#25D366',
    badgeColor: 'var(--text-inverse)',
    icon: <WhatsAppIcon size={18} />,
  },
  telegram: {
    name: 'Telegram Channel',
    placeholder: 'https://t.me/company_channel',
    badgeBg: '#229ED9',
    badgeColor: 'var(--text-inverse)',
    icon: <TelegramIcon size={18} />,
  },
  linkedin: {
    name: 'LinkedIn Page',
    placeholder: 'https://linkedin.com/company/...',
    badgeBg: '#0A66C2',
    badgeColor: 'var(--text-inverse)',
    icon: <Linkedin size={18} />,
  },
  website: {
    name: 'Official Website',
    placeholder: 'https://www.company.com',
    badgeBg: 'var(--accent)',
    badgeColor: 'var(--text-inverse)',
    icon: <Globe size={18} />,
  },
  custom: {
    name: 'Custom Social Link',
    placeholder: 'https://...',
    badgeBg: 'var(--info)',
    badgeColor: 'var(--text-inverse)',
    icon: <Share2 size={18} />,
  },
};

interface AdminSocialMediaPageProps {
  user?: any;
  token?: string | null;
}

export const AdminSocialMediaPage: React.FC<AdminSocialMediaPageProps> = ({ token }) => {
  const [links, setLinks] = useState<SocialLinkItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newPlatform, setNewPlatform] = useState<SocialPlatformType>('custom');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newSubtitle, setNewSubtitle] = useState<string>('');
  const [newUrl, setNewUrl] = useState<string>('');

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const res = await api.adminGetSocialLinks(token || undefined);
      if (res.status && Array.isArray(res.data)) {
        setLinks(res.data);
      }
    } catch (err: any) {
      console.error('[AdminSocialMediaPage] fetch error:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch social links' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleFieldChange = (id: string, field: keyof SocialLinkItem, value: any) => {
    setLinks((prev) =>
      prev.map((item) => (item._id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setFeedback(null);
      const res = await api.adminBulkUpdateSocialLinks(links, token || undefined);
      if (res.status) {
        setFeedback({ type: 'success', message: 'All social media links saved successfully!' });
        fetchLinks();
      }
    } catch (err: any) {
      console.error('[AdminSocialMediaPage] save error:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to save social media links' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (item: SocialLinkItem) => {
    try {
      const updatedStatus = !item.isActive;
      handleFieldChange(item._id, 'isActive', updatedStatus);
      await api.adminToggleSocialLinkStatus(item._id, updatedStatus, token || undefined);
      setFeedback({
        type: 'success',
        message: `${item.title} is now ${updatedStatus ? 'Visible to Members' : 'Hidden from Members'}`,
      });
    } catch (err: any) {
      console.error('[AdminSocialMediaPage] status toggle error:', err);
      fetchLinks();
      setFeedback({ type: 'error', message: err.message || 'Failed to update status' });
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await api.adminDeleteSocialLink(id, token || undefined);
      setLinks((prev) => prev.filter((item) => item._id !== id));
      setFeedback({ type: 'success', message: `"${title}" has been deleted.` });
    } catch (err: any) {
      console.error('[AdminSocialMediaPage] delete error:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to delete social link' });
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Please enter a title');
      return;
    }
    try {
      setSaving(true);
      const res = await api.adminCreateSocialLink(
        {
          platform: newPlatform,
          title: newTitle.trim(),
          subtitle: newSubtitle.trim(),
          url: newUrl.trim(),
          order: links.length + 1,
          isActive: true,
        },
        token || undefined
      );
      if (res.status) {
        setShowAddModal(false);
        setNewTitle('');
        setNewSubtitle('');
        setNewUrl('');
        fetchLinks();
        setFeedback({ type: 'success', message: 'New link added successfully!' });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add link');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = links.filter((l) => l.isActive && l.url?.trim()).length;
  const configuredCount = links.filter((l) => l.url?.trim()).length;

  return (
    <div className="page-body admin-social-page">
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            Social Links
            <Badge tone={activeCount ? 'success' : 'neutral'} size="lg">{activeCount} live</Badge>
          </span>
        }
        subtitle={`Company channels shown on the home page below the slider. ${configuredCount} of ${links.length} platforms have a link.`}
        actions={
          <>
            <button type="button" onClick={fetchLinks} disabled={loading} className="btn btn-secondary">
              <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
              <span>Reload</span>
            </button>
            <button type="button" onClick={() => setShowAddModal(true)} className="btn btn-secondary">
              <Plus size={16} />
              <span>Add link</span>
            </button>
            <button type="button" onClick={handleSaveAll} disabled={saving} className="btn btn-primary">
              <Save size={16} />
              <span>{saving ? 'Saving…' : 'Save all'}</span>
            </button>
          </>
        }
      />

      {feedback && (
        <Alert tone={feedback.type === 'success' ? 'success' : 'error'} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Live Member Preview Strip */}
      <div
        style={{
          background: 'var(--surface-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          border: '1px solid var(--border-color)',
          marginBottom: 28,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Eye size={16} color="var(--text-muted)" />
          <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-body)' }}>
            Live Member View Preview (How it looks on Member Home)
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

        {activeCount === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-light)',
              fontSize: 'var(--fs-base)',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-strong)',
            }}
          >
            No active social media links are currently visible. Enter a URL below and ensure the toggle is ON to display it to members.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: 12,
            }}
          >
            {links
              .filter((l) => l.isActive && l.url?.trim())
              .map((item) => {
                const meta = PLATFORM_META[item.platform] || PLATFORM_META.custom;
                return (
                  <div
                    key={item._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 'var(--radius-md)',
                        background: meta.badgeBg,
                        color: meta.badgeColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {meta.icon}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 'var(--fs-base)',
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title || meta.name}
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--fs-2xs)',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.subtitle || 'Click to visit'}
                      </div>
                    </div>
                    <ExternalLink size={13} color="var(--text-light)" />
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Social Platforms Configuration List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {links.map((item) => {
          const meta = PLATFORM_META[item.platform] || PLATFORM_META.custom;
          const isUrlValid = Boolean(item.url && item.url.trim().length > 0);

          return (
            <div
              key={item._id}
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-lg)',
                border: item.isActive && isUrlValid ? '1.5px solid var(--border-color)' : '1px solid var(--border-light)',
                boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
                padding: '18px 20px',
                transition: 'border 0.2s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 16,
                  paddingBottom: 14,
                  borderBottom: '1px solid var(--border-light)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 'var(--radius-md)',
                      background: meta.badgeBg,
                      color: meta.badgeColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    }}
                  >
                    {meta.icon}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-main)' }}>
                        {meta.name}
                      </span>
                      {item.platform === 'custom' && (
                        <span
                          style={{
                            fontSize: 'var(--fs-2xs)',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: 'var(--surface-muted)',
                            color: 'var(--text-secondary)',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-xs)',
                          }}
                        >
                          Custom
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                      {item.isActive
                        ? isUrlValid
                          ? 'Shown on the home page'
                          : 'Hidden until a URL is entered'
                        : 'Disabled — hidden from members'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Test link button */}
                  {isUrlValid && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 'var(--fs-sm)',
                        color: 'var(--primary)',
                        fontWeight: 600,
                        textDecoration: 'none',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--primary-light)',
                      }}
                    >
                      <ExternalLink size={13} />
                      <span>Test URL</span>
                    </a>
                  )}

                  {/* Toggle Active / Inactive */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 'var(--fs-base)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.isActive}
                      onChange={() => handleToggleStatus(item)}
                      style={{
                        width: 18,
                        height: 18,
                        cursor: 'pointer',
                        accentColor: 'var(--primary)',
                      }}
                    />
                    <span style={{ color: item.isActive ? 'var(--success-hover)' : 'var(--text-light)' }}>
                      {item.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </label>

                  {/* Delete button (for custom or extra links) */}
                  {item.platform === 'custom' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item._id, item.title)}
                      title="Delete Link"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        padding: 6,
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Form Input Fields */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 16,
                }}
              >
                {/* URL Input */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}
                  >
                    Link URL <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="url"
                    value={item.url || ''}
                    placeholder={meta.placeholder}
                    onChange={(e) => handleFieldChange(item._id, 'url', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-base)',
                      color: 'var(--text-main)',
                      outline: 'none',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>

                {/* Display Title */}
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}
                  >
                    Title Label
                  </label>
                  <input
                    type="text"
                    value={item.title || ''}
                    placeholder={meta.name}
                    onChange={(e) => handleFieldChange(item._id, 'title', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-base)',
                      color: 'var(--text-main)',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Subtitle / Description */}
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}
                  >
                    Subtitle / Action Hint
                  </label>
                  <input
                    type="text"
                    value={item.subtitle || ''}
                    placeholder="e.g. Follow for live updates"
                    onChange={(e) => handleFieldChange(item._id, 'subtitle', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-base)',
                      color: 'var(--text-main)',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Order */}
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}
                  >
                    Display Sequence (Order)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={item.order || 1}
                    onChange={(e) => handleFieldChange(item._id, 'order', Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      fontSize: 'var(--fs-base)',
                      color: 'var(--text-main)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Bar for Convenience */}
      <div
        style={{
          position: 'sticky',
          bottom: 20,
          marginTop: 28,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          padding: '14px 20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-base)', color: 'var(--text-secondary)' }}>
          <Sparkles size={16} color="var(--primary)" />
          <span>Click <strong>"Save All Changes"</strong> once you finish editing links.</span>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving} className="btn btn-primary">
          <Save size={16} />
          <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
        </button>
      </div>

      {/* Modal: Add New Social Link */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal modal-legacy" style={{ maxWidth: 480, padding: 24 }} role="dialog" aria-modal="true">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Add Social Channel
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 'var(--fs-2xl)', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateCustom}>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Platform Type
                </label>
                <select
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value as SocialPlatformType)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 'var(--fs-base)',
                    color: 'var(--text-main)',
                  }}
                >
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                  <option value="twitter">X (Twitter)</option>
                  <option value="facebook">Facebook</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="website">Website</option>
                  <option value="custom">Custom / Other</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Title <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WhatsApp VIP Group"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 'var(--fs-base)',
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Subtitle
                </label>
                <input
                  type="text"
                  placeholder="e.g. Join our broadcast group"
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 'var(--fs-base)',
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Link URL <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 'var(--fs-base)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving} className="btn btn-primary">
                  {saving ? 'Adding...' : 'Add Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSocialMediaPage;
