import React, { useState, useEffect } from 'react';
import { 
  Package, 
  CheckCircle2, 
  Coins, 
  Edit3, 
  Plus, 
  X, 
  AlertCircle,
  Share2,
  Check,
  Trash2,
  Table as TableIcon,
  LayoutGrid,
  Search,
  ShieldAlert,
  Sparkles,
  Shield
} from 'lucide-react';
import { api, type PackageItem } from '../services/api';

interface PackagesPageProps {
  user?: any;
  token?: string | null;
  onUserUpdate?: (updatedUser: any) => void;
}

// Harmonious themes matching Panchwati Wellness project design system
const TIER_THEMES = [
  {
    badge: 'STARTER',
    accent: '#2563eb', // Brand Blue
    lightBg: '#eff6ff',
    borderAccent: '#bfdbfe',
    popular: false,
    perks: [
      '1,250 Business Volume (BV) allocated',
      '1 RP reward qualification point',
      'Daily Binary Payout Cap: ₹ 4,000',
      'Binary placement eligible (Left / Right)',
      'Standard 20% binary matching payout'
    ]
  },
  {
    badge: 'EXECUTIVE',
    accent: '#10b981', // Emerald
    lightBg: '#ecfdf5',
    borderAccent: '#a7f3d0',
    popular: true,
    perks: [
      '2,500 Business Volume (BV) allocated',
      '2 RP reward qualification points',
      'Daily Binary Payout Cap: ₹ 8,000',
      'Eligible for consultancy bonus & pools',
      'Direct sponsor binary matching payout'
    ]
  },
  {
    badge: 'PROFESSIONAL',
    accent: '#8b5cf6', // Violet
    lightBg: '#f5f3ff',
    borderAccent: '#ddd6fe',
    popular: false,
    perks: [
      '5,000 Business Volume (BV) allocated',
      '4 RP reward qualification points',
      'Daily Binary Payout Cap: ₹ 12,000',
      'Accelerated team volume propagation',
      'Lifetime rewards milestone tracker'
    ]
  },
  {
    badge: 'ELITE VIP',
    accent: '#f59e0b', // Amber/Gold
    lightBg: '#fffbeb',
    borderAccent: '#fde68a',
    popular: false,
    perks: [
      '10,000 Business Volume (BV) allocated',
      '8 RP reward qualification points',
      'Maximum Daily Payout Cap: ₹ 16,000',
      'High-tier royalty pool qualification',
      'Priority rank advancement & stockist ready'
    ]
  },
];

export const PackagesPage: React.FC<PackagesPageProps> = ({ user: propUser, token: propToken, onUserUpdate }) => {
  // Resolve user and token from props or localStorage
  const savedToken = propToken || localStorage.getItem('wetala_token') || '';
  const savedUserStr = localStorage.getItem('wetala_user');
  const user = propUser || (savedUserStr ? JSON.parse(savedUserStr) : null);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Admin View Mode: 'table' vs 'cards' (Default: 'cards' for Member, 'table' for Admin)
  const [adminViewMode, setAdminViewMode] = useState<'table' | 'cards'>(isAdmin ? 'table' : 'cards');
  const [searchQuery, setSearchQuery] = useState('');

  // Admin CRUD Modals
  const [editingPkg, setEditingPkg] = useState<PackageItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingPkg, setDeletingPkg] = useState<PackageItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Member Buy Modal
  const [buyingPkg, setBuyingPkg] = useState<PackageItem | null>(null);
  const [buyingLoading, setBuyingLoading] = useState(false);

  // Dynamic Features state for form modal
  const [newFeatureText, setNewFeatureText] = useState('');

  // Form data for Edit / Create
  const [formData, setFormData] = useState<{
    name: string;
    packageNumber: number;
    badge: string;
    price: number;
    bv: number;
    rp: number;
    dailyCapping: number;
    description: string;
    features: string[];
    isPopular: boolean;
    isActive: boolean;
  }>({
    name: '',
    packageNumber: 1,
    badge: 'STARTER',
    price: 3000,
    bv: 1250,
    rp: 1,
    dailyCapping: 4000,
    description: '',
    features: [],
    isPopular: false,
    isActive: true,
  });

  const loadPackages = async () => {
    try {
      setLoading(true);
      const res = await api.getPackages();
      if (res.status && Array.isArray(res.data)) {
        setPackages(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load packages:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch packages from server.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const openCreateModal = () => {
    setNewFeatureText('');
    setFormData({
      name: `Package ${packages.length + 1}`,
      packageNumber: packages.length + 1,
      badge: 'PRO TIER',
      price: 5000,
      bv: 2000,
      rp: 2,
      dailyCapping: 6000,
      description: '',
      features: [
        '2,000 Business Volume (BV) allocated',
        '2 RP reward qualification points',
        'Daily Binary Payout Cap: ₹ 6,000',
        'Binary placement eligible (Left / Right)',
        'Standard binary matching commissions'
      ],
      isPopular: false,
      isActive: true,
    });
    setIsCreateOpen(true);
  };

  const openEditModal = (pkg: PackageItem) => {
    setEditingPkg(pkg);
    setNewFeatureText('');
    const themeMatch = TIER_THEMES[(pkg.packageNumber ? pkg.packageNumber - 1 : 0) % TIER_THEMES.length];
    setFormData({
      name: pkg.name,
      packageNumber: pkg.packageNumber ?? 1,
      badge: pkg.badge || themeMatch?.badge || 'STARTER',
      price: pkg.price ?? 0,
      bv: pkg.bv ?? 0,
      rp: pkg.rp !== undefined ? pkg.rp : 1,
      dailyCapping: pkg.dailyCapping !== undefined ? pkg.dailyCapping : 4000,
      description: pkg.description || '',
      features: Array.isArray(pkg.features) ? [...pkg.features] : (themeMatch ? [...themeMatch.perks] : []),
      isPopular: pkg.isPopular !== undefined ? pkg.isPopular : (themeMatch ? themeMatch.popular : false),
      isActive: pkg.isActive ?? true,
    });
  };

  const handleAddFeature = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newFeatureText.trim()) return;
    setFormData(prev => ({
      ...prev,
      features: [...prev.features, newFeatureText.trim()]
    }));
    setNewFeatureText('');
  };

  const handleRemoveFeature = (idxToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== idxToRemove)
    }));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPkg) return;
    try {
      setSubmitting(true);
      setFeedback(null);
      await api.updatePackage(editingPkg.packageId, formData, savedToken);
      setFeedback({ type: 'success', message: `Package "${formData.name}" updated successfully!` });
      setEditingPkg(null);
      await loadPackages();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update package rules.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFeedback(null);
      await api.createPackage(formData, savedToken);
      setFeedback({ type: 'success', message: `New Package "${formData.name}" created successfully!` });
      setIsCreateOpen(false);
      await loadPackages();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create package.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePackage = async (isHard: boolean) => {
    if (!deletingPkg) return;
    try {
      setSubmitting(true);
      setFeedback(null);
      const res = await api.deletePackage(deletingPkg.packageId, savedToken, isHard);
      setFeedback({ type: 'success', message: res.message || `Package ${deletingPkg.name} processed.` });
      setDeletingPkg(null);
      await loadPackages();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to remove package.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (pkg: PackageItem) => {
    try {
      setSubmitting(true);
      setFeedback(null);
      await api.updatePackage(pkg.packageId, { isActive: !pkg.isActive }, savedToken);
      setFeedback({ 
        type: 'success', 
        message: `Package "${pkg.name}" is now ${!pkg.isActive ? 'Active' : 'Inactive'}.` 
      });
      await loadPackages();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to toggle status.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuyPackage = async () => {
    if (!buyingPkg) return;
    try {
      setBuyingLoading(true);
      setFeedback(null);
      const res = await api.buyPackage(buyingPkg.packageId, savedToken);
      setFeedback({ type: 'success', message: res.message || `Successfully purchased ${buyingPkg.name}!` });
      
      // Update local storage user
      if (user && res.data) {
        const updatedUser = {
          ...user,
          packageName: res.data.packageName,
          packageBv: res.data.packageBv,
          packageRp: res.data.packageRp,
          dailyCapping: res.data.dailyCapping,
        };
        localStorage.setItem('wetala_user', JSON.stringify(updatedUser));
        if (onUserUpdate) onUserUpdate(updatedUser);
      }
      setBuyingPkg(null);
      await loadPackages();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to complete package purchase.' });
    } finally {
      setBuyingLoading(false);
    }
  };

  // Filter packages based on search query
  const filteredPackages = packages.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.packageId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.badge && p.badge.toLowerCase().includes(searchQuery.toLowerCase())) ||
    String(p.price).includes(searchQuery) ||
    String(p.bv).includes(searchQuery)
  );

  return (
    <div className="page-body">
      {/* Top Header */}
      <div className="welcome-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ 
              background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)', 
              color: 'white', 
              padding: '3px 10px', 
              borderRadius: '20px', 
              fontSize: '11px', 
              fontWeight: 800,
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              {isAdmin ? 'ADMIN CONTROL' : 'PANCHWATI WELLNESS'}
            </span>
            <span style={{ color: '#64748b', fontSize: '13px' }}>
              {isAdmin ? 'Manage joining packages & compensation rules' : 'Choose your joining package • Grow together'}
            </span>
          </div>

          <h1 className="page-title">
            {isAdmin ? 'Joining Packages Management' : 'Joining Packages & Business Volume (BV)'}
          </h1>

          <p className="page-subtitle">
            {isAdmin 
              ? 'Add new packages, configure prices, BV, RP, daily payout caps, customize feature perks, and toggle active status.' 
              : 'Select your preferred joining package to activate binary earnings, reward points, and daily binary capping limits.'}
          </p>
        </div>

        {/* Admin toolbar */}
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* View Mode Toggle */}
            <div style={{ 
              display: 'flex', 
              background: '#f1f5f9', 
              padding: '4px', 
              borderRadius: '10px',
              border: '1px solid #e2e8f0'
            }}>
              <button
                onClick={() => setAdminViewMode('table')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: adminViewMode === 'table' ? 'white' : 'transparent',
                  color: adminViewMode === 'table' ? '#0f172a' : '#64748b',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: adminViewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <TableIcon size={14} />
                <span>Table View</span>
              </button>

              <button
                onClick={() => setAdminViewMode('cards')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: adminViewMode === 'cards' ? 'white' : 'transparent',
                  color: adminViewMode === 'cards' ? '#0f172a' : '#64748b',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: adminViewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <LayoutGrid size={14} />
                <span>Cards View</span>
              </button>
            </div>

            <button 
              onClick={openCreateModal}
              className="primary-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={18} />
              <span>Create New Package</span>
            </button>
          </div>
        )}
      </div>

      {/* Alert Notifications */}
      {feedback && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '12px',
          marginBottom: '22px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: feedback.type === 'success' ? '#166534' : '#991b1b',
          fontSize: '14px',
          fontWeight: 600,
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span>{feedback.message}</span>
          <button 
            onClick={() => setFeedback(null)} 
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div style={{ width: '38px', height: '38px', border: '3px solid #e2e8f0', borderTopColor: '#1d72fe', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#64748b', fontSize: '14px' }}>Loading packages...</p>
        </div>
      )}

      {/* ADMIN TABLE VIEW */}
      {!loading && isAdmin && adminViewMode === 'table' && (
        <div className="dashboard-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '32px' }}>
          {/* Table Toolbar */}
          <div style={{ 
            padding: '16px 20px', 
            borderBottom: '1px solid #f1f5f9', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '10px' }} />
              <input
                type="text"
                placeholder="Search packages by name, tier, BV..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Showing <strong>{filteredPackages.length}</strong> package(s)
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '14px 18px' }}>Tier #</th>
                  <th style={{ padding: '14px 18px' }}>Package Name & Version</th>
                  <th style={{ padding: '14px 18px' }}>Joining Price</th>
                  <th style={{ padding: '14px 18px' }}>Business Volume (BV)</th>
                  <th style={{ padding: '14px 18px' }}>Reward Points (RP)</th>
                  <th style={{ padding: '14px 18px' }}>Daily Capping</th>
                  <th style={{ padding: '14px 18px' }}>Features</th>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPackages.map((pkg, idx) => {
                  const theme = TIER_THEMES[idx % TIER_THEMES.length];
                  const badgeText = pkg.badge || theme.badge;
                  const perksCount = Array.isArray(pkg.features) ? pkg.features.length : theme.perks.length;

                  return (
                    <tr key={pkg.packageId} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}>
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: theme.lightBg,
                          color: theme.accent,
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `1px solid ${theme.borderAccent}`,
                        }}>
                          {pkg.packageNumber || idx + 1}
                        </div>
                      </td>

                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>{pkg.name}</strong>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            color: theme.accent,
                            background: theme.lightBg,
                            padding: '1px 6px',
                            borderRadius: '4px'
                          }}>
                            {badgeText}
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {pkg.packageId}</span>
                        {pkg.description && (
                          <div style={{
                            fontSize: '11.5px',
                            color: '#64748b',
                            marginTop: '2px',
                            maxWidth: '220px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }} title={pkg.description}>
                            {pkg.description}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '16px 18px' }}>
                        <strong style={{ fontSize: '15px', color: '#0f172a' }}>₹ {pkg.price.toLocaleString()}</strong>
                      </td>

                      <td style={{ padding: '16px 18px' }}>
                        <span style={{
                          background: '#eff6ff',
                          color: '#2563eb',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontWeight: 800,
                          fontSize: '12px'
                        }}>
                          {pkg.bv.toLocaleString()} BV
                        </span>
                      </td>

                      <td style={{ padding: '16px 18px' }}>
                        <span style={{
                          background: '#fffbeb',
                          color: '#d97706',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontWeight: 800,
                          fontSize: '12px'
                        }}>
                          {pkg.rp ?? 0} RP
                        </span>
                      </td>

                      <td style={{ padding: '16px 18px' }}>
                        <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '13px' }}>
                          ₹ {(pkg.dailyCapping ?? 4000).toLocaleString()}
                        </span>
                      </td>

                      <td style={{ padding: '16px 18px' }}>
                        <span style={{
                          fontSize: '12px',
                          color: '#475569',
                          background: '#f1f5f9',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 600
                        }}>
                          {perksCount} perk(s)
                        </span>
                      </td>

                      <td style={{ padding: '16px 18px' }}>
                        <button
                          onClick={() => handleToggleStatus(pkg)}
                          title="Click to toggle status"
                          style={{
                            background: pkg.isActive ? '#ecfdf5' : '#f1f5f9',
                            color: pkg.isActive ? '#059669' : '#64748b',
                            border: `1px solid ${pkg.isActive ? '#a7f3d0' : '#cbd5e1'}`,
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {pkg.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      </td>

                      <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => openEditModal(pkg)}
                            className="outline-btn"
                            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Edit3 size={14} />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => setDeletingPkg(pkg)}
                            style={{
                              background: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODERN EXECUTIVE CARDS VIEW */}
      {!loading && (!isAdmin || adminViewMode === 'cards') && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
          gap: '24px',
          marginBottom: '32px'
        }}>
          {packages.map((pkg, idx) => {
            const theme = TIER_THEMES[idx % TIER_THEMES.length];
            const isCurrent = user?.packageName === pkg.name || user?.joiningPackageId === pkg.packageId;
            const isPopular = pkg.isPopular !== undefined ? pkg.isPopular : theme.popular;
            const badgeText = pkg.badge || theme.badge;
            const perksList = Array.isArray(pkg.features) ? pkg.features : theme.perks;

            return (
              <div
                key={pkg.packageId}
                className="dashboard-card"
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '24px',
                  borderRadius: '20px',
                  background: 'white',
                  border: isCurrent 
                    ? '2px solid #10b981' 
                    : isPopular 
                      ? '2px solid #2563eb' 
                      : '1px solid #e2e8f0',
                  boxShadow: isPopular 
                    ? '0 12px 28px -4px rgba(37, 99, 235, 0.12)' 
                    : isCurrent
                      ? '0 12px 28px -4px rgba(16, 185, 129, 0.12)'
                      : 'var(--shadow-card)',
                  transition: 'all 0.25s ease',
                }}
              >
                {/* Popular or Current Top Tag */}
                {isCurrent ? (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '24px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '3px 12px',
                    borderRadius: '9999px',
                    letterSpacing: '0.8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.35)'
                  }}>
                    <Check size={12} />
                    <span>CURRENT PLAN</span>
                  </div>
                ) : isPopular ? (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '24px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '3px 12px',
                    borderRadius: '9999px',
                    letterSpacing: '0.8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.35)'
                  }}>
                    <Sparkles size={12} />
                    <span>MOST POPULAR</span>
                  </div>
                ) : null}

                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: theme.lightBg,
                    color: theme.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${theme.borderAccent}`,
                    fontSize: '20px',
                    fontWeight: 900,
                    fontFamily: 'var(--font-display, sans-serif)',
                    flexShrink: 0
                  }}>
                    {pkg.packageNumber || idx + 1}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                        {pkg.name}
                      </h3>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: theme.accent,
                      background: theme.lightBg,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      letterSpacing: '0.5px'
                    }}>
                      {badgeText}
                    </span>
                  </div>
                </div>

                {/* Price Display */}
                <div style={{ 
                  margin: '4px 0 18px', 
                  paddingBottom: '16px', 
                  borderBottom: '1px solid #f1f5f9' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ 
                      fontFamily: 'var(--font-display, sans-serif)', 
                      fontSize: '32px', 
                      fontWeight: 900, 
                      color: '#0f172a',
                      letterSpacing: '-0.5px'
                    }}>
                      ₹ {pkg.price.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                      / one-time
                    </span>
                  </div>
                </div>

                {/* Key Metrics Capsules (BV, RP, Capping) */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '10px', 
                  marginBottom: '16px' 
                }}>
                  {/* BV Box */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      background: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Share2 size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Volume</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                        {pkg.bv.toLocaleString()} BV
                      </div>
                    </div>
                  </div>

                  {/* RP Box */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      background: '#fffbeb',
                      color: '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Coins size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Rewards</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                        {pkg.rp ?? 0} RP
                      </div>
                    </div>
                  </div>
                </div>

                {/* Daily Capping Bar */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: pkg.description ? '12px' : '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} color="#0284c7" />
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Daily Binary Cap:</span>
                  </div>
                  <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                    ₹ {(pkg.dailyCapping ?? 4000).toLocaleString()} / Day
                  </strong>
                </div>

                {/* Package Description (Rendered after Daily Cap) */}
                {pkg.description && (
                  <div style={{
                    fontSize: '12px',
                    color: '#475569',
                    background: '#f8fafc',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    borderLeft: `3px solid ${theme.accent}`,
                    marginBottom: '18px',
                    lineHeight: '1.45',
                  }}>
                    {pkg.description}
                  </div>
                )}

                {/* Dynamic Features List */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                  {perksList.map((perk, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12.5px', color: '#475569' }}>
                      <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span>{perk}</span>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div style={{ marginTop: 'auto' }}>
                  {isAdmin ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => openEditModal(pkg)}
                        className="outline-btn"
                        style={{ flex: 1, justifyContent: 'center', fontSize: '13px' }}
                      >
                        <Edit3 size={15} />
                        <span>Edit Rules</span>
                      </button>
                      <button
                        onClick={() => setDeletingPkg(pkg)}
                        style={{
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                        }}
                        title="Delete package"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setBuyingPkg(pkg)}
                      disabled={isCurrent}
                      className={isCurrent ? 'outline-btn' : 'primary-btn'}
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        fontWeight: 700,
                        padding: '12px',
                        cursor: isCurrent ? 'default' : 'pointer',
                        background: isCurrent ? '#f8fafc' : undefined,
                        color: isCurrent ? '#94a3b8' : undefined,
                        borderColor: isCurrent ? '#e2e8f0' : undefined,
                      }}
                    >
                      {isCurrent ? 'Current Active Package' : `Buy ${pkg.name}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Edit Package Rules Modal */}
      {editingPkg && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: '16px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '560px',
            maxWidth: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Edit Package ({editingPkg.name})
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  Customize tier version, features, and payout capping rules.
                </p>
              </div>
              <button onClick={() => setEditingPkg(null)} className="icon-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* Name, Badge, Tier Number */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Package Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Version / Badge Tag *
                    </label>
                    <input
                      type="text"
                      value={formData.badge}
                      onChange={(e) => setFormData({ ...formData, badge: e.target.value.toUpperCase() })}
                      required
                      placeholder="e.g. STARTER, VIP"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', textTransform: 'uppercase' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Tier # *
                    </label>
                    <input
                      type="number"
                      value={formData.packageNumber}
                      onChange={(e) => setFormData({ ...formData, packageNumber: Number(e.target.value) })}
                      min="1"
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                {/* Price & BV */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Joining Price (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Business Volume (BV) *
                    </label>
                    <input
                      type="number"
                      value={formData.bv}
                      onChange={(e) => setFormData({ ...formData, bv: Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                {/* RP & Daily Capping */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Reward Points (RP) *
                    </label>
                    <input
                      type="number"
                      value={formData.rp}
                      onChange={(e) => setFormData({ ...formData, rp: e.target.value === '' ? 0 : Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Daily Binary Capping (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.dailyCapping}
                      onChange={(e) => setFormData({ ...formData, dailyCapping: Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Short description"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                {/* DYNAMIC PACKAGE FEATURES & PERKS */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px',
                }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                    Package Features & Perks ({formData.features.length})
                  </label>

                  {/* List of current features */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px', maxHeight: '160px', overflowY: 'auto' }}>
                    {formData.features.map((feature, fIdx) => (
                      <div 
                        key={fIdx} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          background: 'white',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                          <CheckCircle2 size={14} color="#10b981" />
                          <span>{feature}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFeature(fIdx)}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                          title="Remove feature"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {formData.features.length === 0 && (
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No features added yet.</span>
                    )}
                  </div>

                  {/* Add feature input */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Add a new feature / perk (e.g. Free stockist voucher)..."
                      value={newFeatureText}
                      onChange={(e) => setNewFeatureText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFeature();
                        }
                      }}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddFeature()}
                      className="primary-btn"
                      style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                    >
                      + Add Perk
                    </button>
                  </div>
                </div>

                {/* Toggles */}
                <div style={{ display: 'flex', gap: '24px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="isPopularToggleEdit"
                      checked={formData.isPopular}
                      onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                    />
                    <label htmlFor="isPopularToggleEdit" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      Mark as "Most Popular"
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="isActiveToggleEdit"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#1d72fe' }}
                    />
                    <label htmlFor="isActiveToggleEdit" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      Active Plan
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <button type="button" onClick={() => setEditingPkg(null)} className="outline-btn" disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? 'Saving Rules...' : 'Save Package Rules'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Create New Package Modal */}
      {isCreateOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: '16px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '560px',
            maxWidth: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Create New Joining Package
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  Configure tier version, perks, and payout capping rules.
                </p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="icon-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePackage}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Package Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="e.g. Package 5"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Version / Badge *
                    </label>
                    <input
                      type="text"
                      value={formData.badge}
                      onChange={(e) => setFormData({ ...formData, badge: e.target.value.toUpperCase() })}
                      required
                      placeholder="e.g. MASTER"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', textTransform: 'uppercase' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Tier # *
                    </label>
                    <input
                      type="number"
                      value={formData.packageNumber}
                      onChange={(e) => setFormData({ ...formData, packageNumber: Number(e.target.value) })}
                      min="1"
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Price (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Business Volume (BV) *
                    </label>
                    <input
                      type="number"
                      value={formData.bv}
                      onChange={(e) => setFormData({ ...formData, bv: Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Reward Points (RP) *
                    </label>
                    <input
                      type="number"
                      value={formData.rp}
                      onChange={(e) => setFormData({ ...formData, rp: e.target.value === '' ? 0 : Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Daily Binary Capping (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.dailyCapping}
                      onChange={(e) => setFormData({ ...formData, dailyCapping: Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Short description of this package"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                {/* Features & Perks Manager */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px',
                }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                    Package Features & Perks ({formData.features.length})
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px', maxHeight: '160px', overflowY: 'auto' }}>
                    {formData.features.map((feature, fIdx) => (
                      <div 
                        key={fIdx} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          background: 'white',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                          <CheckCircle2 size={14} color="#10b981" />
                          <span>{feature}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFeature(fIdx)}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Add a new feature / perk..."
                      value={newFeatureText}
                      onChange={(e) => setNewFeatureText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFeature();
                        }
                      }}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddFeature()}
                      className="primary-btn"
                      style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                    >
                      + Add Perk
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '24px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="isPopularToggleCreate"
                      checked={formData.isPopular}
                      onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                    />
                    <label htmlFor="isPopularToggleCreate" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      Mark as "Most Popular"
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="outline-btn" disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? 'Creating Package...' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Delete Confirmation Modal */}
      {deletingPkg && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: '16px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '460px',
            maxWidth: '100%',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Delete Package "{deletingPkg.name}"?
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  Package ID: {deletingPkg.packageId} (₹{deletingPkg.price.toLocaleString()})
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '24px', lineHeight: '1.5' }}>
              You can choose to <strong>deactivate</strong> the package (hides it from registration & buy list while preserving history) or <strong>delete permanently</strong> from the database.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                onClick={() => setDeletingPkg(null)} 
                className="outline-btn" 
                disabled={submitting}
              >
                Cancel
              </button>

              <button 
                type="button" 
                onClick={() => handleDeletePackage(false)} 
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                disabled={submitting}
              >
                Deactivate (Soft)
              </button>

              <button 
                type="button" 
                onClick={() => handleDeletePackage(true)} 
                style={{
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                disabled={submitting}
              >
                {submitting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Buy Package Confirmation Modal */}
      {buyingPkg && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: '16px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '460px',
            maxWidth: '100%',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Package size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    Confirm Package Purchase
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b' }}>
                    Verify details before confirming your joining package.
                  </p>
                </div>
              </div>
              <button onClick={() => setBuyingPkg(null)} className="icon-btn">
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: '#f8fafc',
              borderRadius: '12px',
              padding: '18px',
              border: '1px solid #e2e8f0',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Selected Package:</span>
                <strong style={{ color: '#0f172a' }}>{buyingPkg.name} ({buyingPkg.badge || 'TIER'})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Package Price:</span>
                <strong style={{ color: '#0f172a', fontSize: '16px' }}>₹ {buyingPkg.price.toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Business Volume (BV):</span>
                <strong style={{ color: '#2563eb' }}>{buyingPkg.bv.toLocaleString()} BV</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Reward Points (RP):</span>
                <strong style={{ color: '#d97706' }}>{buyingPkg.rp ?? 0} RP</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Daily Binary Capping:</span>
                <strong style={{ color: '#0f172a' }}>₹ {(buyingPkg.dailyCapping ?? 4000).toLocaleString()} / Day</strong>
              </div>
              {buyingPkg.description && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
                  {buyingPkg.description}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setBuyingPkg(null)} className="outline-btn" disabled={buyingLoading}>
                Cancel
              </button>
              <button 
                onClick={handleBuyPackage} 
                className="primary-btn" 
                disabled={buyingLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle2 size={16} />
                <span>{buyingLoading ? 'Processing...' : 'Confirm & Buy Package'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackagesPage;
