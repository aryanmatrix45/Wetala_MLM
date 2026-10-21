import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Eye, EyeOff, LayoutGrid, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { api, type HighlightScrollSpeed, type HomeHighlightItem, type HomeHighlightSettings } from '../services/api';
import { Alert, Badge, EmptyState, Field, LoadingState, Modal, PageHeader, SegmentedControl } from '../components/ui';
import { HIGHLIGHT_ICONS, HighlightIcon } from '../components/highlightIcons';
import { HomeHighlightsSection } from '../components/HomeHighlightsSection';

interface AdminHomeHighlightsPageProps {
  user?: any;
  token?: string | null;
}

type CardForm = {
  icon: string;
  title: string;
  subtitle: string;
  isHighlighted: boolean;
  order: number;
  status: 'ACTIVE' | 'INACTIVE';
};

const TITLE_MAX = 60;
const SUBTITLE_MAX = 120;

const emptyForm = (order: number): CardForm => ({
  icon: 'leaf',
  title: '',
  subtitle: '',
  isHighlighted: false,
  order,
  status: 'ACTIVE',
});

const DEFAULT_SETTINGS: HomeHighlightSettings = { heading: '', subheading: '', isActive: true, scrollSpeed: 'NORMAL' };

export const AdminHomeHighlightsPage: React.FC<AdminHomeHighlightsPageProps> = ({ token }) => {
  const authToken = token || undefined;
  const [items, setItems] = useState<HomeHighlightItem[]>([]);
  const [settings, setSettings] = useState<HomeHighlightSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<CardForm>(emptyForm(1));
  const [formError, setFormError] = useState('');
  const [savingCard, setSavingCard] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetHomeHighlights(authToken);
      if (res?.status) {
        setItems(res.data.highlights || []);
        setSettings({ ...DEFAULT_SETTINGS, ...res.data.settings });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load highlights' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [authToken]);

  const activeItems = useMemo(
    () => items.filter((i) => i.status === 'ACTIVE').sort((a, b) => a.order - b.order),
    [items]
  );

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setFeedback(null);
    try {
      const res = await api.adminUpdateHomeHighlightSettings(
        {
          heading: settings.heading || '',
          subheading: settings.subheading || '',
          isActive: settings.isActive,
          scrollSpeed: settings.scrollSpeed,
        },
        authToken
      );
      setSettings({ ...DEFAULT_SETTINGS, ...res.data });
      setFeedback({ type: 'success', message: 'Section settings saved' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm((items.reduce((max, i) => Math.max(max, i.order), 0) || 0) + 1));
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (item: HomeHighlightItem) => {
    setEditingId(item._id);
    setForm({
      icon: item.icon,
      title: item.title,
      subtitle: item.subtitle || '',
      isHighlighted: item.isHighlighted,
      order: item.order,
      status: item.status,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError('Please enter a title.');
      return;
    }
    setSavingCard(true);
    setFormError('');
    try {
      const payload = { ...form, title: form.title.trim(), subtitle: form.subtitle.trim() };
      if (editingId) {
        await api.adminUpdateHomeHighlight(editingId, payload, authToken);
        setFeedback({ type: 'success', message: 'Card updated' });
      } else {
        await api.adminCreateHomeHighlight(payload, authToken);
        setFeedback({ type: 'success', message: 'Card added' });
      }
      setIsModalOpen(false);
      load();
    } catch (err: any) {
      setFormError(`Could not save: ${err.message || 'unknown error'}`);
      console.error('[Home Highlights] Save failed:', err);
    } finally {
      setSavingCard(false);
    }
  };

  const handleToggle = async (item: HomeHighlightItem) => {
    try {
      const res = await api.adminToggleHomeHighlightStatus(item._id, authToken);
      setItems((prev) => prev.map((i) => (i._id === item._id ? res.data : i)));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to change status' });
    }
  };

  const handleDelete = async (item: HomeHighlightItem) => {
    if (!window.confirm(`Delete the card "${item.title}"? This cannot be undone.`)) return;
    try {
      await api.adminDeleteHomeHighlight(item._id, authToken);
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      setFeedback({ type: 'success', message: 'Card deleted' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete card' });
    }
  };

  const previewCard: HomeHighlightItem = {
    _id: 'preview',
    icon: form.icon,
    title: form.title || 'Card title',
    subtitle: form.subtitle || 'Short supporting line',
    isHighlighted: form.isHighlighted,
    order: form.order,
    status: 'ACTIVE',
  };

  return (
    <div className="page-body">
      <PageHeader
        title="Home Highlights"
        subtitle="Cards shown on the home page right after the slider. With 4 or more visible cards they scroll continuously."
        actions={
          <>
            <button type="button" onClick={load} disabled={loading} className="btn btn-secondary">
              <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
              <span>Reload</span>
            </button>
            <button type="button" onClick={openCreate} className="btn btn-primary">
              <Plus size={16} />
              <span>Add card</span>
            </button>
          </>
        }
      />

      {feedback && (
        <Alert tone={feedback.type === 'success' ? 'success' : 'error'} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {loading ? (
        <LoadingState label="Loading highlights…" />
      ) : (
        <>
          {/* Section settings */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="card-header-row">
              <div>
                <h2 className="card-title">Section settings</h2>
                <p className="card-subtitle">Heading and subheading are optional; leave them empty to show only the cards.</p>
              </div>
              <label className="checkbox-row" style={{ padding: 'var(--space-2) var(--space-3)' }}>
                <input
                  type="checkbox"
                  checked={settings.isActive}
                  onChange={(e) => setSettings({ ...settings, isActive: e.target.checked })}
                />
                <span>Show on home page</span>
              </label>
            </div>

            <div className="form-grid">
              <Field label="Heading" hint="Optional" htmlFor="hl-heading">
                <input
                  id="hl-heading"
                  className="form-input"
                  maxLength={120}
                  placeholder="e.g. What we offer"
                  value={settings.heading || ''}
                  onChange={(e) => setSettings({ ...settings, heading: e.target.value })}
                />
              </Field>
              <Field label="Subheading" hint="Optional" htmlFor="hl-subheading">
                <input
                  id="hl-subheading"
                  className="form-input"
                  maxLength={240}
                  placeholder="e.g. Natural solutions for every part of life"
                  value={settings.subheading || ''}
                  onChange={(e) => setSettings({ ...settings, subheading: e.target.value })}
                />
              </Field>
              <Field label="Scroll speed" hint="Used when 4 or more cards are visible">
                <SegmentedControl
                  ariaLabel="Scroll speed"
                  value={settings.scrollSpeed}
                  onChange={(v) => setSettings({ ...settings, scrollSpeed: v as HighlightScrollSpeed })}
                  options={[
                    { value: 'SLOW', label: 'Slow' },
                    { value: 'NORMAL', label: 'Normal' },
                    { value: 'FAST', label: 'Fast' },
                  ]}
                />
              </Field>
            </div>

            <div className="form-actions">
              <button type="button" onClick={handleSaveSettings} disabled={savingSettings} className="btn btn-primary">
                <Save size={16} />
                {savingSettings ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </div>

          {/* Live preview */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="card-header-row" style={{ marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 className="card-title">Preview</h2>
                <p className="card-subtitle">
                  {settings.isActive
                    ? `${activeItems.length} visible card${activeItems.length === 1 ? '' : 's'}${activeItems.length >= 4 ? ' · scrolling' : ''}`
                    : 'Hidden from the home page'}
                </p>
              </div>
            </div>
            {settings.isActive && activeItems.length > 0 ? (
              <div className="hl-preview">
                <HomeHighlightsSection previewItems={activeItems} previewSettings={settings} />
              </div>
            ) : (
              <EmptyState
                compact
                icon={<EyeOff size={22} />}
                title={settings.isActive ? 'No visible cards' : 'Section is hidden'}
                text={settings.isActive ? 'Add a card or make one visible to show this section.' : 'Turn on “Show on home page” and save.'}
              />
            )}
          </div>

          {/* Cards */}
          <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.length === 0 ? (
              <EmptyState
                icon={<LayoutGrid size={22} />}
                title="No cards yet"
                text="Add your first highlight card."
                action={
                  <button type="button" onClick={openCreate} className="btn btn-primary">
                    <Plus size={16} /> Add card
                  </button>
                }
              />
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>Icon</th>
                      <th>Card</th>
                      <th>Style</th>
                      <th>Order</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...items].sort((a, b) => a.order - b.order).map((item) => (
                      <tr key={item._id}>
                        <td>
                          <span className={`hl-table-icon${item.isHighlighted ? ' is-highlighted' : ''}`}>
                            <HighlightIcon name={item.icon} size={22} />
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.title}</div>
                          {item.subtitle && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{item.subtitle}</div>}
                        </td>
                        <td>{item.isHighlighted ? <Badge tone="success">Highlighted</Badge> : <Badge>Standard</Badge>}</td>
                        <td>#{item.order}</td>
                        <td>
                          <button
                            type="button"
                            className={`btn btn-sm ${item.status === 'ACTIVE' ? 'btn-soft' : 'btn-secondary'}`}
                            onClick={() => handleToggle(item)}
                            title={item.status === 'ACTIVE' ? 'Hide from home page' : 'Show on home page'}
                          >
                            {item.status === 'ACTIVE' ? <Eye size={14} /> : <EyeOff size={14} />}
                            {item.status === 'ACTIVE' ? 'Visible' : 'Hidden'}
                          </button>
                        </td>
                        <td>
                          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-sm btn-icon btn-secondary" onClick={() => openEdit(item)} aria-label={`Edit ${item.title}`} title="Edit">
                              <Edit2 size={14} />
                            </button>
                            <button type="button" className="btn btn-sm btn-icon btn-danger-outline" onClick={() => handleDelete(item)} aria-label={`Delete ${item.title}`} title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        dismissible={!savingCard}
        size="lg"
        title={editingId ? 'Edit card' : 'Add card'}
        footer={
          <>
            {formError && (
              <span className="form-error modal-footer-error" role="alert">
                {formError}
              </span>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={savingCard}>
              Cancel
            </button>
            <button type="submit" form="hl-card-form" className="btn btn-primary" disabled={savingCard}>
              <Save size={16} />
              {savingCard ? 'Saving…' : editingId ? 'Save changes' : 'Add card'}
            </button>
          </>
        }
      >
        <form id="hl-card-form" onSubmit={handleSaveCard} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Field label="Icon" required hint="Scroll to see all icons">
            <div className="icon-picker" role="radiogroup" aria-label="Choose an icon">
              {HIGHLIGHT_ICONS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={form.icon === key}
                  title={label}
                  className={`icon-picker-option${form.icon === key ? ' is-selected' : ''}`}
                  onClick={() => setForm({ ...form, icon: key })}
                >
                  <Icon size={26} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </Field>

          <div className="form-grid">
            <Field label="Title" required hint={`${form.title.length}/${TITLE_MAX}`} htmlFor="hl-title">
              <input
                id="hl-title"
                className="form-input"
                maxLength={TITLE_MAX}
                placeholder="e.g. Health & Wellness"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Display order" hint="Lower numbers appear first" htmlFor="hl-order">
              <input
                id="hl-order"
                type="number"
                min={1}
                className="form-input"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 1 })}
              />
            </Field>
            <Field label="Subtitle" hint={`${form.subtitle.length}/${SUBTITLE_MAX}`} htmlFor="hl-subtitle" full>
              <input
                id="hl-subtitle"
                className="form-input"
                maxLength={SUBTITLE_MAX}
                placeholder="e.g. Build inner strength naturally"
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </Field>
          </div>

          <div className="form-grid">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isHighlighted} onChange={(e) => setForm({ ...form, isHighlighted: e.target.checked })} />
              <span>Highlight this card (dark green)</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.status === 'ACTIVE'}
                onChange={(e) => setForm({ ...form, status: e.target.checked ? 'ACTIVE' : 'INACTIVE' })}
              />
              <span>Visible on home page</span>
            </label>
          </div>

          <div>
            <div className="form-label" style={{ marginBottom: 6 }}>Preview</div>
            <ul className="hl-row hl-count-1" style={{ maxWidth: 440 }}>
              <li className={`hl-card${previewCard.isHighlighted ? ' is-highlighted' : ''}`}>
                <span className="hl-card-icon"><HighlightIcon name={previewCard.icon} size={34} /></span>
                <span className="hl-card-text">
                  <span className="hl-card-title">{previewCard.title}</span>
                  <span className="hl-card-subtitle">{previewCard.subtitle}</span>
                </span>
              </li>
            </ul>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminHomeHighlightsPage;
