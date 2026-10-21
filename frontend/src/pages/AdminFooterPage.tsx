import React, { useState, useEffect } from 'react';
import { Alert, PageHeader } from '../components/ui';
import {
  api,
  type FooterConfig,
  type FooterLinkItem,
  normalizeGoogleDriveUrl,
} from '../services/api';
import { ArrowDown, ArrowUp, Building2, ExternalLink, HelpCircle, Info, Phone, Plus, RefreshCw, RotateCcw, Save, Share2, Shield, Trash2 } from 'lucide-react';

interface AdminFooterPageProps {
  user?: any;
  token?: string | null;
  onNavigate?: (tab: string) => void;
}

export const AdminFooterPage: React.FC<AdminFooterPageProps> = ({
  token,
  onNavigate,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'brand' | 'help' | 'care' | 'contact' | 'legal'>('brand');

  // Form State
  const [brandName, setBrandName] = useState('');
  const [brandTrademark, setBrandTrademark] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [aboutText, setAboutText] = useState('');

  const [helpTitle, setHelpTitle] = useState('');
  const [helpLinks, setHelpLinks] = useState<FooterLinkItem[]>([]);

  const [customerCareTitle, setCustomerCareTitle] = useState('');
  const [customerCareLinks, setCustomerCareLinks] = useState<FooterLinkItem[]>([]);

  const [contactTitle, setContactTitle] = useState('');

  const [emailTitle, setEmailTitle] = useState('');
  const [emailsText, setEmailsText] = useState('');
  const [phoneTitle, setPhoneTitle] = useState('');
  const [phonesText, setPhonesText] = useState('');

  const [businessHoursTitle, setBusinessHoursTitle] = useState('');
  const [businessHoursWeekdays, setBusinessHoursWeekdays] = useState('');
  const [businessHoursWeekend, setBusinessHoursWeekend] = useState('');

  const [showSocialLinks, setShowSocialLinks] = useState(true);
  const [copyrightText, setCopyrightText] = useState('');
  const [disclaimerText, setDisclaimerText] = useState('');

  // New Link inputs
  const [newHelpLabel, setNewHelpLabel] = useState('');
  const [newHelpUrl, setNewHelpUrl] = useState('#');
  const [newHelpNewTab, setNewHelpNewTab] = useState(false);

  const [newCareLabel, setNewCareLabel] = useState('');
  const [newCareUrl, setNewCareUrl] = useState('#');
  const [newCareNewTab, setNewCareNewTab] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.adminGetFooterConfig(token || undefined);
      if (res.status && res.data) {
        populateForm(res.data);
      }
    } catch (err: any) {
      console.error('[AdminFooterPage] Error fetching footer data:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to load footer settings' });
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (cfg: FooterConfig) => {
    setBrandName(cfg.brandName || '');
    setBrandTrademark(cfg.brandTrademark || '');
    setTagline(cfg.tagline || '');
    setLogoUrl(cfg.logoUrl || '');
    setAboutText(cfg.aboutText || '');

    setHelpTitle(cfg.helpTitle || '');
    setHelpLinks(cfg.helpLinks || []);

    setCustomerCareTitle(cfg.customerCareTitle || '');
    setCustomerCareLinks(cfg.customerCareLinks || []);

    setContactTitle(cfg.contactTitle || '');

    setEmailTitle(cfg.emailTitle || '');
    setEmailsText((cfg.emails || []).join(', '));
    setPhoneTitle(cfg.phoneTitle || '');
    setPhonesText((cfg.phoneNumbers || []).join(', '));

    setBusinessHoursTitle(cfg.businessHoursTitle || '');
    setBusinessHoursWeekdays(cfg.businessHoursWeekdays || '');
    setBusinessHoursWeekend(cfg.businessHoursWeekend || '');

    setShowSocialLinks(cfg.showSocialLinks !== false);
    setCopyrightText(cfg.copyrightText || '');
    setDisclaimerText(cfg.disclaimerText || '');
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      // Parse emails and phones from comma-separated string
      const parsedEmails = emailsText
        .split(/[,;\n]/)
        .map((e) => e.trim())
        .filter(Boolean);

      const parsedPhones = phonesText
        .split(/[,;\n]/)
        .map((p) => p.trim())
        .filter(Boolean);

      const payload: Partial<FooterConfig> = {
        brandName,
        brandTrademark,
        tagline,
        logoUrl,
        aboutText,
        helpTitle,
        helpLinks,
        customerCareTitle,
        customerCareLinks,
        contactTitle,
        emailTitle,
        emails: parsedEmails,
        phoneTitle,
        phoneNumbers: parsedPhones,
        businessHoursTitle,
        businessHoursWeekdays,
        businessHoursWeekend,
        showSocialLinks,
        copyrightText,
        disclaimerText,
      };

      const res = await api.adminUpdateFooterConfig(payload, token || undefined);
      if (res.status && res.data) {
        populateForm(res.data);
        setMessage({ type: 'success', text: 'Footer configuration saved successfully!' });
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (err: any) {
      console.error('[AdminFooterPage] Failed to save footer:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save changes' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset the footer to default values? Any custom modifications will be replaced.')) {
      return;
    }

    try {
      setResetting(true);
      setMessage(null);
      const res = await api.adminResetFooterConfig(token || undefined);
      if (res.status && res.data) {
        populateForm(res.data);
        setMessage({ type: 'success', text: 'Footer reset to factory defaults successfully!' });
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (err: any) {
      console.error('[AdminFooterPage] Failed to reset footer:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to reset settings' });
    } finally {
      setResetting(false);
    }
  };

  // Help Links handlers
  const addHelpLink = () => {
    if (!newHelpLabel.trim()) return;
    const newLink: FooterLinkItem = {
      label: newHelpLabel.trim(),
      url: newHelpUrl.trim() || '#',
      openInNewTab: newHelpNewTab,
      isActive: true,
      order: helpLinks.length + 1,
    };
    setHelpLinks([...helpLinks, newLink]);
    setNewHelpLabel('');
    setNewHelpUrl('#');
    setNewHelpNewTab(false);
  };

  const removeHelpLink = (idx: number) => {
    setHelpLinks(helpLinks.filter((_, i) => i !== idx));
  };

  const moveHelpLink = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= helpLinks.length) return;
    const copy = [...helpLinks];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    setHelpLinks(copy);
  };

  const toggleHelpLinkActive = (idx: number) => {
    setHelpLinks(
      helpLinks.map((item, i) => (i === idx ? { ...item, isActive: !item.isActive } : item))
    );
  };

  // Customer Care Links handlers
  const addCareLink = () => {
    if (!newCareLabel.trim()) return;
    const newLink: FooterLinkItem = {
      label: newCareLabel.trim(),
      url: newCareUrl.trim() || '#',
      openInNewTab: newCareNewTab,
      isActive: true,
      order: customerCareLinks.length + 1,
    };
    setCustomerCareLinks([...customerCareLinks, newLink]);
    setNewCareLabel('');
    setNewCareUrl('#');
    setNewCareNewTab(false);
  };

  const removeCareLink = (idx: number) => {
    setCustomerCareLinks(customerCareLinks.filter((_, i) => i !== idx));
  };

  const moveCareLink = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= customerCareLinks.length) return;
    const copy = [...customerCareLinks];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    setCustomerCareLinks(copy);
  };

  const toggleCareLinkActive = (idx: number) => {
    setCustomerCareLinks(
      customerCareLinks.map((item, i) => (i === idx ? { ...item, isActive: !item.isActive } : item))
    );
  };

  if (loading) {
    return (
      <div className="dashboard-card" style={{ padding: 48, textAlign: 'center' }}>
        <RefreshCw size={28} className="spin-anim" style={{ color: 'var(--primary)', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading footer configuration...</p>
      </div>
    );
  }

  return (
    <div className="page-body admin-footer-page">
      <PageHeader
        title="Footer & Company Info"
        subtitle="Brand logo, about text, help links, customer-care policies, contact details and business hours."
        actions={
          <>
            <button
              type="button"
              className="btn btn-danger-outline"
              onClick={handleReset}
              disabled={resetting || saving}
              title="Reset footer to default configuration"
            >
              <RotateCcw size={16} />
              <span>{resetting ? 'Resetting…' : 'Reset to default'}</span>
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || resetting}>
              <Save size={16} />
              <span>{saving ? 'Saving…' : 'Save changes'}</span>
            </button>
          </>
        }
      />

      {message && (
        <Alert tone={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>
      )}

      {/* Tabs */}
      <div className="admin-footer-tabs">
        <button
          type="button"
          className={`admin-footer-tab-btn ${activeTab === 'brand' ? 'active' : ''}`}
          onClick={() => setActiveTab('brand')}
        >
          <Building2 size={16} />
          <span>Brand & About Bio</span>
        </button>

        <button
          type="button"
          className={`admin-footer-tab-btn ${activeTab === 'help' ? 'active' : ''}`}
          onClick={() => setActiveTab('help')}
        >
          <HelpCircle size={16} />
          <span>Help Links ({helpLinks.length})</span>
        </button>

        <button
          type="button"
          className={`admin-footer-tab-btn ${activeTab === 'care' ? 'active' : ''}`}
          onClick={() => setActiveTab('care')}
        >
          <Shield size={16} />
          <span>Customer Care ({customerCareLinks.length})</span>
        </button>

        <button
          type="button"
          className={`admin-footer-tab-btn ${activeTab === 'contact' ? 'active' : ''}`}
          onClick={() => setActiveTab('contact')}
        >
          <Phone size={16} />
          <span>Contact Details</span>
        </button>

        <button
          type="button"
          className={`admin-footer-tab-btn ${activeTab === 'legal' ? 'active' : ''}`}
          onClick={() => setActiveTab('legal')}
        >
          <Info size={16} />
          <span>Social Media & Copyright</span>
        </button>
      </div>

      {/* TAB 1: Brand & About */}
      {activeTab === 'brand' && (
        <div className="footer-form-card">
          <h3 className="section-title" style={{ margin: '0 0 16px' }}>Brand Identity & About Description</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: 16 }}>
            <div className="footer-field-group">
              <label className="footer-field-label">Brand Name</label>
              <input
                type="text"
                className="footer-field-input"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g. Treandora or Wetala Wellness"
              />
            </div>

            <div className="footer-field-group">
              <label className="footer-field-label">Brand Trademark (e.g. TM, ® or blank)</label>
              <input
                type="text"
                className="footer-field-input"
                value={brandTrademark}
                onChange={(e) => setBrandTrademark(e.target.value)}
                placeholder="TM or ®"
              />
            </div>

            <div className="footer-field-group">
              <label className="footer-field-label">Tagline (under logo)</label>
              <input
                type="text"
                className="footer-field-input"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Shop with the trend"
              />
            </div>
          </div>

          <div className="footer-field-group">
            <label className="footer-field-label">
              Logo Image URL (Optional - supports Direct Image, Google Drive, or Dropbox links)
            </label>
            <input
              type="text"
              className="footer-field-input"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/... or direct image URL"
            />
            {logoUrl && (
              <div style={{ marginTop: 10, padding: 12, background: 'var(--text-strong)', borderRadius: 'var(--radius-md)', display: 'inline-block' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-light)', display: 'block', marginBottom: 4 }}>Logo Preview on Dark Footer:</span>
                <img
                  src={normalizeGoogleDriveUrl(logoUrl)}
                  alt="Logo preview"
                  style={{ maxHeight: 48, maxWidth: 180, objectFit: 'contain' }}
                  onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                />
              </div>
            )}
          </div>

          <div className="footer-field-group">
            <label className="footer-field-label">About Us Story / Summary</label>
            <textarea
              className="footer-field-textarea"
              rows={5}
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              placeholder="Enter brief description about the company, e-commerce platform, or MLM ecosystem..."
            />
          </div>
        </div>
      )}

      {/* TAB 2: Help Links */}
      {activeTab === 'help' && (
        <div className="footer-form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 className="section-title" style={{ margin: 0 }}>Column 2: Help Links</h3>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-base)', color: 'var(--text-muted)' }}>
                Navigational links for user help, documentation, and support tickets.
              </p>
            </div>
            <div style={{ width: 220 }}>
              <input
                type="text"
                className="footer-field-input"
                value={helpTitle}
                onChange={(e) => setHelpTitle(e.target.value)}
                placeholder="Column Title (e.g. Help)"
              />
            </div>
          </div>

          {/* Add Link Form */}
          <div
            style={{
              padding: 16,
              background: 'var(--surface-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-strong)',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 200px' }}>
              <label className="footer-field-label">Link Label</label>
              <input
                type="text"
                className="footer-field-input"
                placeholder="e.g. How to Shop Guide"
                value={newHelpLabel}
                onChange={(e) => setNewHelpLabel(e.target.value)}
              />
            </div>
            <div style={{ flex: '2 1 260px' }}>
              <label className="footer-field-label">Target URL / Hash</label>
              <input
                type="text"
                className="footer-field-input"
                placeholder="e.g. /shop-guide or https://..."
                value={newHelpUrl}
                onChange={(e) => setNewHelpUrl(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10 }}>
              <input
                type="checkbox"
                id="newHelpNewTab"
                checked={newHelpNewTab}
                onChange={(e) => setNewHelpNewTab(e.target.checked)}
              />
              <label htmlFor="newHelpNewTab" style={{ fontSize: 'var(--fs-base)', cursor: 'pointer' }}>
                Open in new tab
              </label>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={addHelpLink}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 42 }}
            >
              <Plus size={16} />
              <span>Add Link</span>
            </button>
          </div>

          {/* Links Table */}
          <table className="footer-links-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Label</th>
                <th>Target URL</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 120 }}>Reorder</th>
                <th style={{ width: 60 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {helpLinks.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ color: 'var(--text-light)' }}>{idx + 1}</td>
                  <td>
                    <input
                      type="text"
                      className="footer-field-input"
                      style={{ padding: '6px 10px', fontSize: 'var(--fs-base)' }}
                      value={item.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHelpLinks(helpLinks.map((l, i) => (i === idx ? { ...l, label: val } : l)));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="footer-field-input"
                      style={{ padding: '6px 10px', fontSize: 'var(--fs-base)' }}
                      value={item.url}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHelpLinks(helpLinks.map((l, i) => (i === idx ? { ...l, url: val } : l)));
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleHelpLinkActive(idx)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 600,
                        background: item.isActive ? 'var(--success-light)' : 'var(--surface-muted)',
                        color: item.isActive ? 'var(--success)' : 'var(--text-muted)',
                      }}
                    >
                      {item.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => moveHelpLink(idx, 'up')}
                        disabled={idx === 0} className="btn btn-secondary">
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveHelpLink(idx, 'down')}
                        disabled={idx === helpLinks.length - 1} className="btn btn-secondary">
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeHelpLink(idx)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}
                      title="Delete link"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: Customer Care Links */}
      {activeTab === 'care' && (
        <div className="footer-form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 className="section-title" style={{ margin: 0 }}>Column 3: Customer Care & Policies</h3>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-base)', color: 'var(--text-muted)' }}>
                Refund, privacy, terms & conditions, cancellation, and earning disclaimers.
              </p>
            </div>
            <div style={{ width: 220 }}>
              <input
                type="text"
                className="footer-field-input"
                value={customerCareTitle}
                onChange={(e) => setCustomerCareTitle(e.target.value)}
                placeholder="Column Title (e.g. Customer Care)"
              />
            </div>
          </div>

          {/* Add Care Link Form */}
          <div
            style={{
              padding: 16,
              background: 'var(--surface-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-strong)',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 200px' }}>
              <label className="footer-field-label">Policy / Link Label</label>
              <input
                type="text"
                className="footer-field-input"
                placeholder="e.g. Return & Refund Policy"
                value={newCareLabel}
                onChange={(e) => setNewCareLabel(e.target.value)}
              />
            </div>
            <div style={{ flex: '2 1 260px' }}>
              <label className="footer-field-label">Target URL / Hash</label>
              <input
                type="text"
                className="footer-field-input"
                placeholder="e.g. /refund-policy or https://..."
                value={newCareUrl}
                onChange={(e) => setNewCareUrl(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10 }}>
              <input
                type="checkbox"
                id="newCareNewTab"
                checked={newCareNewTab}
                onChange={(e) => setNewCareNewTab(e.target.checked)}
              />
              <label htmlFor="newCareNewTab" style={{ fontSize: 'var(--fs-base)', cursor: 'pointer' }}>
                Open in new tab
              </label>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={addCareLink}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 42 }}
            >
              <Plus size={16} />
              <span>Add Policy Link</span>
            </button>
          </div>

          {/* Table */}
          <table className="footer-links-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Label</th>
                <th>Target URL</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 120 }}>Reorder</th>
                <th style={{ width: 60 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {customerCareLinks.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ color: 'var(--text-light)' }}>{idx + 1}</td>
                  <td>
                    <input
                      type="text"
                      className="footer-field-input"
                      style={{ padding: '6px 10px', fontSize: 'var(--fs-base)' }}
                      value={item.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomerCareLinks(customerCareLinks.map((l, i) => (i === idx ? { ...l, label: val } : l)));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="footer-field-input"
                      style={{ padding: '6px 10px', fontSize: 'var(--fs-base)' }}
                      value={item.url}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomerCareLinks(customerCareLinks.map((l, i) => (i === idx ? { ...l, url: val } : l)));
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleCareLinkActive(idx)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 600,
                        background: item.isActive ? 'var(--success-light)' : 'var(--surface-muted)',
                        color: item.isActive ? 'var(--success)' : 'var(--text-muted)',
                      }}
                    >
                      {item.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => moveCareLink(idx, 'up')}
                        disabled={idx === 0} className="btn btn-secondary">
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCareLink(idx, 'down')}
                        disabled={idx === customerCareLinks.length - 1} className="btn btn-secondary">
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeCareLink(idx)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}
                      title="Delete link"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: Contact & Office Details */}
      {activeTab === 'contact' && (
        <div className="footer-form-card">
          <h3 className="section-title" style={{ margin: '0 0 16px' }}>Column 4: Contact Us Details</h3>

          {/* Emails & Phones */}
          <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 16, marginBottom: 16 }}>
            <div className="footer-field-group">
              <label className="footer-field-label">Email Label</label>
              <input
                type="text"
                className="footer-field-input"
                value={emailTitle}
                onChange={(e) => setEmailTitle(e.target.value)}
                placeholder="Email:"
              />
            </div>
            <div className="footer-field-group">
              <label className="footer-field-label">Support Email(s) (Comma separated)</label>
              <input
                type="text"
                className="footer-field-input"
                value={emailsText}
                onChange={(e) => setEmailsText(e.target.value)}
                placeholder="support@treandora.com, marketing@treandora.com"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 16, marginBottom: 16 }}>
            <div className="footer-field-group">
              <label className="footer-field-label">Phone Label</label>
              <input
                type="text"
                className="footer-field-input"
                value={phoneTitle}
                onChange={(e) => setPhoneTitle(e.target.value)}
                placeholder="Phone:"
              />
            </div>
            <div className="footer-field-group">
              <label className="footer-field-label">Helpline Phone Number(s) (Comma separated)</label>
              <input
                type="text"
                className="footer-field-input"
                value={phonesText}
                onChange={(e) => setPhonesText(e.target.value)}
                placeholder="+91 97375 43491, +91 99989 20494"
              />
            </div>
          </div>

          {/* Business Hours */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: 16 }}>
            <div className="footer-field-group">
              <label className="footer-field-label">Hours Title</label>
              <input
                type="text"
                className="footer-field-input"
                value={businessHoursTitle}
                onChange={(e) => setBusinessHoursTitle(e.target.value)}
                placeholder="Business Hours:"
              />
            </div>

            <div className="footer-field-group">
              <label className="footer-field-label">Weekdays Hours</label>
              <input
                type="text"
                className="footer-field-input"
                value={businessHoursWeekdays}
                onChange={(e) => setBusinessHoursWeekdays(e.target.value)}
                placeholder="Monday – Saturday: 10:00 AM – 7:00 PM"
              />
            </div>

            <div className="footer-field-group">
              <label className="footer-field-label">Sunday / Weekend Status</label>
              <input
                type="text"
                className="footer-field-input"
                value={businessHoursWeekend}
                onChange={(e) => setBusinessHoursWeekend(e.target.value)}
                placeholder="Sunday: Closed"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Social Media & Copyright */}
      {activeTab === 'legal' && (
        <div className="footer-form-card">
          <h3 className="section-title" style={{ margin: '0 0 16px' }}>Social Media Integration & Legal Bar</h3>

          {/* Social Links Banner */}
          <div
            style={{
              padding: 18,
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary-light)',
              border: '1px solid var(--primary-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--primary)',
                  color: 'var(--text-inverse)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Share2 size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--primary-strong)' }}>
                  Live Social Media Channels Integration
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-base)', color: 'var(--primary)' }}>
                  The footer automatically renders active YouTube, Facebook, WhatsApp, Instagram, Telegram, and X links from your existing Social Links module.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onNavigate && onNavigate('manage-social-links')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)' }}
              >
                <ExternalLink size={14} />
                <span>Manage Social Media Links</span>
              </button>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--primary-strong)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showSocialLinks}
                  onChange={(e) => setShowSocialLinks(e.target.checked)}
                />
                <span>Show in Footer</span>
              </label>
            </div>
          </div>

          {/* Copyright & Disclaimer */}
          <div className="footer-field-group">
            <label className="footer-field-label">Copyright Statement</label>
            <input
              type="text"
              className="footer-field-input"
              value={copyrightText}
              onChange={(e) => setCopyrightText(e.target.value)}
              placeholder="© 2026 Treandora / Wetala. All Rights Reserved."
            />
          </div>

          <div className="footer-field-group">
            <label className="footer-field-label">Regulatory / Earnings Disclaimer (Optional small print)</label>
            <textarea
              className="footer-field-textarea"
              rows={3}
              value={disclaimerText}
              onChange={(e) => setDisclaimerText(e.target.value)}
              placeholder="e.g. Treandora does not guarantee income. Earnings are based on individual product sales and network building effort..."
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFooterPage;
