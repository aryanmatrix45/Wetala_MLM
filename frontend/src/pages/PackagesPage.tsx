import React, { useState, useEffect } from 'react';
import { Alert, EmptyState, LoadingState, PageHeader, SegmentedControl } from '../components/ui';
import { ArrowRight, CheckCircle2, Clock, Coins, CreditCard, Edit3, Landmark, LayoutGrid, Package, Plus, QrCode, Search, Send, Share2, Shield, ShieldAlert, Sparkles, TableIcon, Trash2, TrendingUp, X } from 'lucide-react';
import { api, newRequestKey, type PackageItem, type PaymentMethod } from '../services/api';
import { PaymentMethodPicker } from '../components/PaymentMethodPicker';

interface PackagesPageProps {
  user?: any;
  token?: string | null;
  onUserUpdate?: (updatedUser: any) => void;
}

// Harmonious themes matching Panchveda Wellness project design system
const TIER_THEMES = [
  {
    badge: 'STARTER',
    accent: 'var(--primary)', // Brand Blue
    lightBg: 'var(--primary-light)',
    borderAccent: 'var(--primary-border)',
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
    accent: 'var(--success)', // Emerald
    lightBg: 'var(--success-light)',
    borderAccent: 'var(--success-border)',
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
    accent: 'var(--accent)', // Violet
    lightBg: 'var(--accent-light)',
    borderAccent: 'var(--accent-border)',
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
    accent: 'var(--warning)', // Amber/Gold
    lightBg: 'var(--warning-light)',
    borderAccent: 'var(--warning-border)',
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

/**
 * Robustly matches the logged-in member to their current active package in the system.
 * Handles packageId, packageName, badge name (e.g. STARTER), and daily capping limits.
 */
export const findUserPackage = (user: any, pkgs: PackageItem[]): PackageItem | null => {
  if (!user || user.role === 'superadmin' || !pkgs || pkgs.length === 0) {
    return null;
  }

  // A member MUST have an explicit package assigned (packageName, joiningPackageId, or packageId)
  const userPkgName = (user.packageName || user.package || '').trim();
  const userPkgId = (user.joiningPackageId || user.packageId || '').trim();

  // If the member has no package assigned, they are a free / unactivated member with NO active package
  if (!userPkgName && !userPkgId) {
    return null;
  }

  // 1. Direct match on joiningPackageId / packageId
  if (userPkgId) {
    const byId = pkgs.find(p => 
      p.packageId?.toLowerCase() === userPkgId.toLowerCase() ||
      (p as any)._id === userPkgId
    );
    if (byId) return byId;
  }

  // 2. Match on packageName or package field (case-insensitive & badge check)
  if (userPkgName && userPkgName.toLowerCase() !== 'null' && userPkgName.toLowerCase() !== 'undefined') {
    const lowerName = userPkgName.toLowerCase();
    // Exact name match (e.g. 'Package 1')
    const byName = pkgs.find(p => p.name.trim().toLowerCase() === lowerName);
    if (byName) return byName;

    // Exact badge match (e.g. 'STARTER' matches 'Starter')
    const byBadge = pkgs.find(p => p.badge?.trim().toLowerCase() === lowerName);
    if (byBadge) return byBadge;

    // Substring match
    const bySub = pkgs.find(p => 
      p.name.toLowerCase().includes(lowerName) || 
      lowerName.includes(p.name.toLowerCase()) ||
      (p.badge && (p.badge.toLowerCase().includes(lowerName) || lowerName.includes(p.badge.toLowerCase())))
    );
    if (bySub) return bySub;
  }

  return null;
};

export const PackagesPage: React.FC<PackagesPageProps> = ({ user: propUser, token: propToken, onUserUpdate }) => {
  // Resolve user and token from props or localStorage
  const savedToken = propToken || localStorage.getItem('wetala_token') || '';
  const savedUserStr = localStorage.getItem('wetala_user');
  const user = propUser || (savedUserStr ? JSON.parse(savedUserStr) : null);

  const isAdmin = user?.role === 'superadmin';

  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Current package active for this member
  const userCurrentPkg = findUserPackage(user, packages);

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [buyRequestKey, setBuyRequestKey] = useState(newRequestKey);

  // Each time the buy dialog opens it starts on bank payment with a fresh request key
  useEffect(() => {
    if (buyingPkg) {
      setPaymentMethod('BANK_TRANSFER');
      setBuyRequestKey(newRequestKey());
    }
  }, [buyingPkg]);

  // Active Multi-Stage Package Request for current member
  const [activePackageRequest, setActivePackageRequest] = useState<any | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);
  const [paymentForm, setPaymentForm] = useState({
    utrNumber: '',
    payerName: user?.name || '',
    paymentMode: 'UPI',
    notes: '',
  });

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

  const loadMemberRequests = async () => {
    if (isAdmin || !user?.memberId) return;
    try {
      const res = await api.getPurchases({ memberId: user.memberId, type: 'JOINING' }, savedToken);
      if (res.status && Array.isArray(res.data)) {
        const pending = res.data.find((p: any) =>
          ['REQUESTED', 'PAYMENT_INSTRUCTIONS_SENT', 'PAYMENT_SUBMITTED'].includes(p.approvalStage)
        );
        setActivePackageRequest(pending || null);
      }
    } catch (e) {
      console.warn('Could not load package requests:', e);
    }
  };

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
    loadMemberRequests();
    // Silently refresh current member profile in background to keep session 100% synchronized
    if (savedToken && !isAdmin) {
      api.getProfile(savedToken)
        .then((res) => {
          if (res.status && res.data) {
            localStorage.setItem('wetala_user', JSON.stringify(res.data));
            if (onUserUpdate) onUserUpdate(res.data);
          }
        })
        .catch(() => {});
    }
  }, [savedToken]);

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
      const res = await api.buyPackage(buyingPkg.packageId, savedToken, { paymentMethod, requestKey: buyRequestKey });
      setFeedback({ 
        type: 'success', 
        message: res.message || `Package request for ${buyingPkg.name} submitted to Super Admin! Please await payment instructions.` 
      });
      setBuyingPkg(null);
      await loadMemberRequests();
      await loadPackages();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to submit package request.' });
    } finally {
      setBuyingLoading(false);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePackageRequest) return;
    if (!paymentForm.utrNumber.trim()) {
      setFeedback({ type: 'error', message: 'Please provide Bank UTR / Transaction reference ID.' });
      return;
    }
    if (!paymentForm.payerName.trim()) {
      setFeedback({ type: 'error', message: 'Please provide Payer Full Name.' });
      return;
    }
    try {
      setSubmittingPayment(true);
      setFeedback(null);
      const res = await api.submitPurchasePayment(activePackageRequest.purchaseId, paymentForm, savedToken);
      setFeedback({ type: 'success', message: res.message || 'Payment details submitted for verification!' });
      await loadMemberRequests();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to submit payment details.' });
    } finally {
      setSubmittingPayment(false);
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
      <PageHeader
        title={isAdmin ? 'Packages' : 'Joining Packages'}
        subtitle={
          isAdmin
            ? 'Prices, BV, reward points, daily caps, features and availability for joining packages.'
            : 'Choose a joining package to activate binary earnings, reward points and your daily capping limit.'
        }
        actions={
          isAdmin && (
            <>
              <SegmentedControl
                ariaLabel="View"
                value={adminViewMode}
                onChange={(v) => setAdminViewMode(v as typeof adminViewMode)}
                options={[
                  { value: 'table', label: 'Table', icon: <TableIcon size={14} /> },
                  { value: 'cards', label: 'Cards', icon: <LayoutGrid size={14} /> },
                ]}
              />
              <button type="button" onClick={openCreateModal} className="btn btn-primary">
                <Plus size={16} />
                <span>New package</span>
              </button>
            </>
          )
        }
      />

      {/* Alert Notifications */}
      {/* Alert Notifications */}
      {feedback && (
        <Alert tone={feedback.type === 'success' ? 'success' : 'error'} onClose={() => setFeedback(null)}>{feedback.message}</Alert>
      )}

      {/* Loading state */}
      {loading && (
        <LoadingState label="Loading packages…" />
      )}

      {/* ADMIN TABLE VIEW */}
      {!loading && isAdmin && adminViewMode === 'table' && (
        <div className="dashboard-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '32px' }}>
          {/* Table Toolbar */}
          <div style={{ 
            padding: '16px 20px', 
            borderBottom: '1px solid var(--border-light)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} color="var(--text-light)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
              <input
                type="text"
                placeholder="Search packages by name, tier, BV..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-strong)',
                  fontSize: 'var(--fs-base)',
                }}
              />
            </div>

            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)' }}>
              Showing <strong>{filteredPackages.length}</strong> package(s)
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tier #</th>
                  <th>Package Name & Version</th>
                  <th>Joining Price</th>
                  <th>Business Volume (BV)</th>
                  <th>Reward Points (RP)</th>
                  <th>Daily Capping</th>
                  <th>Features</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPackages.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        icon={<Package size={22} />}
                        title={packages.length ? 'No matching packages' : 'No packages yet'}
                        text={packages.length ? 'Try a different search.' : 'Create the first joining package to make it available to members.'}
                      />
                    </td>
                  </tr>
                )}
                {filteredPackages.map((pkg, idx) => {
                  const theme = TIER_THEMES[idx % TIER_THEMES.length];
                  const badgeText = pkg.badge || theme.badge;
                  const perksCount = Array.isArray(pkg.features) ? pkg.features.length : theme.perks.length;

                  return (
                    <tr key={pkg.packageId} style={{ transition: 'background 0.15s ease' }}>
                      <td>
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

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: 'var(--fs-md)', color: 'var(--text-main)' }}>{pkg.name}</strong>
                          <span style={{
                            fontSize: 'var(--fs-2xs)',
                            fontWeight: 800,
                            color: theme.accent,
                            background: theme.lightBg,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-xs)'
                          }}>
                            {badgeText}
                          </span>
                        </div>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-light)' }}>ID: {pkg.packageId}</span>
                        {pkg.description && (
                          <div style={{
                            fontSize: 'var(--fs-sm)',
                            color: 'var(--text-muted)',
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

                      <td>
                        <strong style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-main)' }}>₹ {pkg.price.toLocaleString()}</strong>
                      </td>

                      <td>
                        <span style={{
                          background: 'var(--primary-light)',
                          color: 'var(--primary)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 800,
                          fontSize: 'var(--fs-sm)'
                        }}>
                          {pkg.bv.toLocaleString()} BV
                        </span>
                      </td>

                      <td>
                        <span style={{
                          background: 'var(--warning-light)',
                          color: 'var(--warning)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 800,
                          fontSize: 'var(--fs-sm)'
                        }}>
                          {pkg.rp ?? 0} RP
                        </span>
                      </td>

                      <td>
                        <span style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: 'var(--fs-base)' }}>
                          ₹ {(pkg.dailyCapping ?? 4000).toLocaleString()}
                        </span>
                      </td>

                      <td>
                        <span style={{
                          fontSize: 'var(--fs-sm)',
                          color: 'var(--text-secondary)',
                          background: 'var(--surface-muted)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 600
                        }}>
                          {perksCount} perk(s)
                        </span>
                      </td>

                      <td>
                        <button
                          onClick={() => handleToggleStatus(pkg)}
                          title="Click to toggle status"
                          style={{
                            background: pkg.isActive ? 'var(--success-light)' : 'var(--surface-muted)',
                            color: pkg.isActive ? 'var(--success)' : 'var(--text-muted)',
                            border: `1px solid ${pkg.isActive ? 'var(--success-border)' : 'var(--border-strong)'}`,
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-lg)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {pkg.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => openEditModal(pkg)}
                            className="btn btn-secondary btn-sm"
                          >
                            <Edit3 size={14} />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => setDeletingPkg(pkg)} className="btn btn-danger-outline btn-sm">
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

      {/* Member Active Package Overview Banner */}
      {!loading && !isAdmin && userCurrentPkg && (
        <div style={{
          background: 'var(--surface-inverse)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          marginBottom: '28px',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700 }}>
                  Active Membership Tier
                </span>
                <span style={{ background: 'var(--success)', color: 'white', fontSize: 'var(--fs-2xs)', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-lg)' }}>
                  ACTIVE
                </span>
              </div>
              <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'white', margin: 0 }}>
                {userCurrentPkg.name} <span style={{ color: 'var(--info)', fontSize: 'var(--fs-md)', fontWeight: 700 }}>({userCurrentPkg.badge || 'STARTER'})</span>
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-light)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Daily Binary Cap</span>
              <strong style={{ fontSize: 'var(--fs-md)', color: 'var(--surface-subtle)' }}>₹ {(userCurrentPkg.dailyCapping ?? 4000).toLocaleString()} / Day</strong>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-light)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Active Volume</span>
              <strong style={{ fontSize: 'var(--fs-md)', color: 'var(--primary-muted)' }}>{userCurrentPkg.bv.toLocaleString()} BV</strong>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-light)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Reward Points</span>
              <strong style={{ fontSize: 'var(--fs-md)', color: 'var(--warning-muted)' }}>{userCurrentPkg.rp ?? 1} RP</strong>
            </div>
          </div>
        </div>
      )}

      {/* Member Active Package Request & Payment Instructions Workflow */}
      {!loading && !isAdmin && activePackageRequest && (
        <div style={{ marginBottom: '28px' }}>
          {activePackageRequest.approvalStage === 'REQUESTED' && (
            <div style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-lg)', padding: '18px 22px', boxShadow: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--warning-strong)', fontWeight: 800, fontSize: 'var(--fs-lg)', marginBottom: '6px' }}>
                <Clock size={20} />
                Package Request Pending Super Admin Approval
              </div>
              <p style={{ margin: 0, fontSize: 'var(--fs-base)', color: 'var(--warning-hover)', lineHeight: 1.5 }}>
                You have requested <strong>{activePackageRequest.items[0]?.name}</strong> (Order #{activePackageRequest.purchaseId}) for <strong>₹{activePackageRequest.totalAmount.toLocaleString()}</strong> ({activePackageRequest.totalBV.toLocaleString()} BV). Super Admin will review your request and send company bank details, UPI ID, and QR code to complete payment.
              </p>
            </div>
          )}

          {activePackageRequest.approvalStage === 'PAYMENT_INSTRUCTIONS_SENT' && (
            <div style={{ background: 'var(--surface)', border: '2px solid var(--info)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: '0 8px 30px rgba(2, 132, 199, 0.12)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                <div>
                  <span style={{ background: 'var(--info)', color: 'white', padding: '3px 10px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--fs-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ACTION REQUIRED • STEP 2: MAKE PAYMENT
                  </span>
                  <h3 className="section-title" style={{ margin: '8px 0 0 0' }}>
                    Payment Instructions for {activePackageRequest.items[0]?.name}
                  </h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Amount to Pay</div>
                  <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: 'var(--success)' }}>
                    ₹ {activePackageRequest.totalAmount.toLocaleString()}{' '}
                    <span style={{ fontSize: 'var(--fs-base)', color: 'var(--info)', fontWeight: 700 }}>({activePackageRequest.totalBV.toLocaleString()} BV)</span>
                  </div>
                </div>
              </div>

              {/* Admin Note */}
              {activePackageRequest.adminMessage && (
                <div style={{ background: 'var(--info-light)', border: '1px solid var(--info-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '18px', fontSize: 'var(--fs-base)', color: 'var(--info-strong)', lineHeight: 1.5 }}>
                  <strong style={{ display: 'block', marginBottom: '2px' }}>Super Admin Message:</strong>
                  {activePackageRequest.adminMessage}
                </div>
              )}

              {/* Company Account Snapshot Cards */}
              {(() => {
                const acct = activePackageRequest.companyAccountSnapshot;
                const val = (v?: string) => v || <span style={{ color: 'var(--text-light)', fontWeight: 500 }}>Not configured</span>;
                return (
                  <div className="stat-panel-grid">
                    <div className="stat-panel is-muted">
                      <div className="icon-text" style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: 'var(--space-2)' }}>
                        <Landmark size={16} /> Company bank account
                      </div>
                      <div className="detail-list">
                        <div className="detail-row"><span>Bank</span><span>{val(acct?.bankName)}</span></div>
                        <div className="detail-row"><span>Account holder</span><span>{acct?.accountHolderName || 'Panchveda Wellness Pvt Ltd'}</span></div>
                        <div className="detail-row"><span>Account no.</span><span className="text-mono">{val(acct?.accountNumber)}</span></div>
                        <div className="detail-row"><span>IFSC</span><span className="text-mono">{val(acct?.ifscCode)}</span></div>
                        <div className="detail-row"><span>Branch</span><span>{val(acct?.branchName)}</span></div>
                      </div>
                    </div>

                    <div className="stat-panel is-muted" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                      {acct?.qrCodeUrl && (
                        <img
                          src={acct.qrCodeUrl}
                          alt="Company payment QR code"
                          style={{ width: 96, height: 96, objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--surface)', flexShrink: 0 }}
                        />
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="icon-text" style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: 'var(--space-2)' }}>
                          <QrCode size={16} /> Company UPI
                        </div>
                        <div className="detail-list">
                          <div className="detail-row"><span>UPI ID</span><span className="text-mono">{val(acct?.upiId)}</span></div>
                          <div className="detail-row"><span>Payee</span><span>{acct?.upiHolderName || 'Panchveda Wellness'}</span></div>
                        </div>
                        <div className="form-hint" style={{ marginTop: 'var(--space-2)' }}>Pay with GPay, PhonePe, Paytm or BHIM.</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Payment Proof Submission Form */}
              <form onSubmit={handleSubmitPayment} style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--accent-strong)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={18} />
                  Submit Your Payment Proof & UTR Reference
                </h4>
                <p style={{ margin: '0 0 14px 0', fontSize: 'var(--fs-sm)', color: 'var(--accent-strong)' }}>
                  After completing the transfer, enter the transaction UTR number and the sender name below. Super Admin will verify and activate your package immediately.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Bank UTR / Transaction ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 423456789012 or UPI Ref"
                      value={paymentForm.utrNumber}
                      onChange={(e) => setPaymentForm({ ...paymentForm, utrNumber: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-border)', fontSize: 'var(--fs-base)', background: 'var(--surface)' }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Payer Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Name on bank / UPI account"
                      value={paymentForm.payerName}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payerName: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-border)', fontSize: 'var(--fs-base)', background: 'var(--surface)' }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Payment Mode
                    </label>
                    <select
                      value={paymentForm.paymentMode}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-border)', fontSize: 'var(--fs-base)', background: 'var(--surface)' }}
                    >
                      <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                      <option value="IMPS">IMPS Instant Bank Transfer</option>
                      <option value="NEFT">NEFT Bank Transfer</option>
                      <option value="QR_SCAN">QR Code Scan</option>
                      <option value="NET_BANKING">Net Banking</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingPayment}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--accent)',
                    color: 'var(--text-inverse)',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 700,
                    fontSize: 'var(--fs-base)',
                    cursor: 'pointer',
                    boxShadow: 'none',
                  }}
                >
                  <CheckCircle2 size={16} />
                  {submittingPayment ? 'Submitting Details...' : 'Submit Payment Details for Verification'}
                </button>
              </form>
            </div>
          )}

          {activePackageRequest.approvalStage === 'PAYMENT_SUBMITTED' && (
            <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-lg)', padding: '18px 22px', boxShadow: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-strong)', fontWeight: 800, fontSize: 'var(--fs-lg)', marginBottom: '6px' }}>
                <Clock size={20} />
                Payment Verification in Progress
              </div>
              <p style={{ margin: 0, fontSize: 'var(--fs-base)', color: 'var(--accent-strong)', lineHeight: 1.5 }}>
                {activePackageRequest.paymentMethod === 'BV_WALLET' ? (
                  <>
                    You paid <strong>{(activePackageRequest.bvAmount || 0).toLocaleString('en-IN')} BV</strong> from your BV Wallet for <strong>{activePackageRequest.items[0]?.name}</strong> (ref <strong>{activePackageRequest.bvTransactionId}</strong>). The Super Admin is verifying the order. Upon approval, your package and business volume will be activated; if it is rejected, the BV returns to your wallet.
                  </>
                ) : (
                  <>
                    Your payment details (UTR: <strong>{activePackageRequest.utrNumber}</strong>, Payer: <strong>{activePackageRequest.payerName}</strong>) for <strong>{activePackageRequest.items[0]?.name}</strong> have been submitted. The Super Admin is verifying the credit. Upon verification, your package and business volume will be activated immediately.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* MODERN EXECUTIVE CARDS VIEW */}
      {!loading && (!isAdmin || adminViewMode === 'cards') && packages.length === 0 && (
        <div className="card">
          <EmptyState icon={<Package size={22} />} title="No packages available" text={isAdmin ? 'Create the first joining package.' : 'Joining packages will appear here once they are published.'} />
        </div>
      )}

      {!loading && (!isAdmin || adminViewMode === 'cards') && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
          gap: '24px',
          marginBottom: '32px'
        }}>
          {packages.map((pkg, idx) => {
            const theme = TIER_THEMES[idx % TIER_THEMES.length];
            const isCurrent = userCurrentPkg ? (
              userCurrentPkg.packageId === pkg.packageId ||
              (userCurrentPkg as any)._id === (pkg as any)._id
            ) : Boolean(user?.packageName && user.packageName.trim() !== '' && user.packageName === pkg.name);

            const currentTierNum = userCurrentPkg?.packageNumber || (userCurrentPkg ? packages.findIndex(p => p.packageId === userCurrentPkg.packageId) + 1 : 0);
            const currentPrice = userCurrentPkg?.price || 0;
            const thisTierNum = pkg.packageNumber || (idx + 1);

            const isUpgrade = Boolean(userCurrentPkg && !isCurrent && (thisTierNum > currentTierNum || pkg.price > currentPrice));
            const isLowerTier = Boolean(userCurrentPkg && !isCurrent && (thisTierNum < currentTierNum || pkg.price < currentPrice));

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
                  borderRadius: 'var(--radius-xl)',
                  background: 'white',
                  border: isCurrent 
                    ? '2px solid var(--success)' 
                    : isUpgrade
                      ? '1px solid var(--primary-border)'
                      : isPopular 
                        ? '2px solid var(--primary)' 
                        : '1px solid var(--border-color)',
                  boxShadow: isCurrent
                    ? '0 12px 28px -4px rgba(16, 185, 129, 0.16)'
                    : isPopular 
                      ? '0 12px 28px -4px rgba(37, 99, 235, 0.12)' 
                      : 'var(--shadow-card)',
                  transition: 'all 0.25s ease',
                }}
              >
                {/* Top Badge: Current vs Upgrade vs Popular */}
                {isCurrent ? (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '24px',
                    background: 'var(--success)',
                    color: 'white',
                    fontSize: 'var(--fs-2xs)',
                    fontWeight: 800,
                    padding: '3px 12px',
                    borderRadius: 'var(--radius-full)',
                    letterSpacing: '0.8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: 'none'
                  }}>
                    <CheckCircle2 size={12} />
                    <span>CURRENT ACTIVE PLAN</span>
                  </div>
                ) : isUpgrade ? (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '24px',
                    background: isPopular 
                      ? 'var(--primary)' 
                      : 'var(--accent)',
                    color: 'white',
                    fontSize: 'var(--fs-2xs)',
                    fontWeight: 800,
                    padding: '3px 12px',
                    borderRadius: 'var(--radius-full)',
                    letterSpacing: '0.8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: isPopular 
                      ? '0 4px 10px rgba(37, 99, 235, 0.35)' 
                      : '0 4px 10px rgba(124, 58, 237, 0.35)'
                  }}>
                    <TrendingUp size={12} />
                    <span>{isPopular ? 'RECOMMENDED UPGRADE' : 'UPGRADE AVAILABLE'}</span>
                  </div>
                ) : isPopular ? (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '24px',
                    background: 'var(--primary)',
                    color: 'white',
                    fontSize: 'var(--fs-2xs)',
                    fontWeight: 800,
                    padding: '3px 12px',
                    borderRadius: 'var(--radius-full)',
                    letterSpacing: '0.8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: 'none'
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
                    borderRadius: 'var(--radius-lg)',
                    background: theme.lightBg,
                    color: theme.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${theme.borderAccent}`,
                    fontSize: 'var(--fs-2xl)',
                    fontWeight: 900,
                    fontFamily: 'var(--font-display, sans-serif)',
                    flexShrink: 0
                  }}>
                    {pkg.packageNumber || idx + 1}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h3 className="section-title">
                        {pkg.name}
                      </h3>
                    </div>
                    <span style={{
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 800,
                      color: theme.accent,
                      background: theme.lightBg,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
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
                  borderBottom: '1px solid var(--border-light)' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ 
                      fontFamily: 'var(--font-display, sans-serif)', 
                      fontSize: '32px', 
                      fontWeight: 900, 
                      color: 'var(--text-main)',
                      letterSpacing: '-0.5px'
                    }}>
                      ₹ {pkg.price.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', fontWeight: 600 }}>
                      / one-time
                    </span>
                  </div>

                  {/* Status Pills under Price */}
                  {isCurrent && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'var(--success-light)',
                      color: 'var(--success)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 700,
                      marginTop: '8px',
                    }}>
                      <CheckCircle2 size={13} />
                      <span>Active on your account</span>
                    </div>
                  )}

                  {isUpgrade && userCurrentPkg && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 700,
                      marginTop: '8px',
                    }}>
                      <TrendingUp size={13} />
                      <span>+₹{((pkg.dailyCapping ?? 4000) - (userCurrentPkg.dailyCapping ?? 4000)).toLocaleString()}/day Capping Boost</span>
                    </div>
                  )}
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
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Share2 size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Volume</div>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-main)' }}>
                        {pkg.bv.toLocaleString()} BV
                      </div>
                    </div>
                  </div>

                  {/* RP Box */}
                  <div style={{
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--warning-light)',
                      color: 'var(--warning)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Coins size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Rewards</div>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-main)' }}>
                        {pkg.rp ?? 0} RP
                      </div>
                    </div>
                  </div>
                </div>

                {/* Daily Capping Bar */}
                <div style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: pkg.description ? '12px' : '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} color="var(--info)" />
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>Daily Binary Cap:</span>
                  </div>
                  <strong style={{ fontSize: 'var(--fs-base)', color: 'var(--text-main)' }}>
                    ₹ {(pkg.dailyCapping ?? 4000).toLocaleString()} / Day
                  </strong>
                </div>

                {/* Package Description */}
                {pkg.description && (
                  <div style={{
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--text-secondary)',
                    background: 'var(--surface-subtle)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
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
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                      <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: '1px' }} />
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
                        className="btn btn-secondary"
                        style={{ flex: 1 }}
                      >
                        <Edit3 size={15} />
                        <span>Edit Rules</span>
                      </button>
                      <button
                        onClick={() => setDeletingPkg(pkg)} className="btn btn-danger-outline"
                        title="Delete package">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : isCurrent ? (
                    <button
                      disabled
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        fontWeight: 800,
                        padding: '12px',
                        cursor: 'default',
                        background: 'var(--success-light)',
                        color: 'var(--success)',
                        border: '1.5px solid var(--success-border)',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: 'var(--fs-base)',
                      }}
                    >
                      <CheckCircle2 size={16} />
                      <span>Already Purchased (Active Plan)</span>
                    </button>
                  ) : isUpgrade ? (
                    <button
                      onClick={() => setBuyingPkg(pkg)}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                    >
                      <TrendingUp size={16} />
                      <span>Upgrade to {pkg.name}</span>
                    </button>
                  ) : isLowerTier ? (
                    <button
                      disabled
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%' }}
                    >
                      <span>Included in Current Plan</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setBuyingPkg(pkg)}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                    >
                      Buy {pkg.name}
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
        <div className="modal-backdrop">
          <div className="modal modal-legacy" style={{ maxWidth: '560px', padding: '28px' }} role="dialog" aria-modal="true">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 className="section-title">
                  Edit Package ({editingPkg.name})
                </h3>
                <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Package Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Version / Badge Tag *
                    </label>
                    <input
                      type="text"
                      value={formData.badge}
                      onChange={(e) => setFormData({ ...formData, badge: e.target.value.toUpperCase() })}
                      required
                      placeholder="e.g. STARTER, VIP"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)', textTransform: 'uppercase' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Tier # *
                    </label>
                    <input
                      type="number"
                      value={formData.packageNumber}
                      onChange={(e) => setFormData({ ...formData, packageNumber: Number(e.target.value) })}
                      min="1"
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                    />
                  </div>
                </div>

                {/* Price & BV */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Joining Price (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Business Volume (BV) *
                    </label>
                    <input
                      type="number"
                      value={formData.bv}
                      onChange={(e) => setFormData({ ...formData, bv: Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                    />
                  </div>
                </div>

                {/* RP & Daily Capping */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Reward Points (RP) *
                    </label>
                    <input
                      type="number"
                      value={formData.rp}
                      onChange={(e) => setFormData({ ...formData, rp: e.target.value === '' ? 0 : Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Daily Binary Capping (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.dailyCapping}
                      onChange={(e) => setFormData({ ...formData, dailyCapping: Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Short description"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                  />
                </div>

                {/* DYNAMIC PACKAGE FEATURES & PERKS */}
                <div style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                }}>
                  <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
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
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)',
                          fontSize: 'var(--fs-sm)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-body)' }}>
                          <CheckCircle2 size={14} color="var(--success)" />
                          <span>{feature}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFeature(fIdx)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '2px' }}
                          title="Remove feature"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {formData.features.length === 0 && (
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-light)', fontStyle: 'italic' }}>No features added yet.</span>
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
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-sm)' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddFeature()}
                      className="btn btn-primary btn-sm"
                      style={{ whiteSpace: 'nowrap' }}
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
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <label htmlFor="isPopularToggleEdit" className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Mark as "Most Popular"
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="isActiveToggleEdit"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <label htmlFor="isActiveToggleEdit" className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Active Plan
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                <button type="button" onClick={() => setEditingPkg(null)} className="btn btn-secondary" disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving Rules...' : 'Save Package Rules'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Create New Package Modal */}
      {isCreateOpen && (
        <div className="modal-backdrop">
          <div className="modal modal-legacy" style={{ maxWidth: '560px', padding: '28px' }} role="dialog" aria-modal="true">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 className="section-title">
                  Create New Joining Package
                </h3>
                <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)' }}>
                  Configure tier version, perks, and payout capping rules.
                </p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="icon-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePackage}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Package Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="e.g. Package 5"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Version / Badge *
                    </label>
                    <input
                      type="text"
                      value={formData.badge}
                      onChange={(e) => setFormData({ ...formData, badge: e.target.value.toUpperCase() })}
                      required
                      placeholder="e.g. MASTER"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)', textTransform: 'uppercase' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Tier # *
                    </label>
                    <input
                      type="number"
                      value={formData.packageNumber}
                      onChange={(e) => setFormData({ ...formData, packageNumber: Number(e.target.value) })}
                      min="1"
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Price (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Business Volume (BV) *
                    </label>
                    <input
                      type="number"
                      value={formData.bv}
                      onChange={(e) => setFormData({ ...formData, bv: Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Reward Points (RP) *
                    </label>
                    <input
                      type="number"
                      value={formData.rp}
                      onChange={(e) => setFormData({ ...formData, rp: e.target.value === '' ? 0 : Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Daily Binary Capping (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.dailyCapping}
                      onChange={(e) => setFormData({ ...formData, dailyCapping: Number(e.target.value) })}
                      min="0"
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Short description of this package"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-base)' }}
                  />
                </div>

                {/* Features & Perks Manager */}
                <div style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                }}>
                  <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
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
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)',
                          fontSize: 'var(--fs-sm)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-body)' }}>
                          <CheckCircle2 size={14} color="var(--success)" />
                          <span>{feature}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFeature(fIdx)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '2px' }}
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
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-sm)' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddFeature()}
                      className="btn btn-primary btn-sm"
                      style={{ whiteSpace: 'nowrap' }}
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
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <label htmlFor="isPopularToggleCreate" className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Mark as "Most Popular"
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="btn btn-secondary" disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating Package...' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Delete Confirmation Modal */}
      {deletingPkg && (
        <div className="modal-backdrop">
          <div className="modal modal-legacy" style={{ maxWidth: '460px', padding: '28px' }} role="dialog" aria-modal="true">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--danger-light)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="section-title">
                  Delete Package "{deletingPkg.name}"?
                </h3>
                <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)' }}>
                  Package ID: {deletingPkg.packageId} (₹{deletingPkg.price.toLocaleString()})
                </p>
              </div>
            </div>

            <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
              You can choose to <strong>deactivate</strong> the package (hides it from registration & buy list while preserving history) or <strong>delete permanently</strong> from the database.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                onClick={() => setDeletingPkg(null)} 
                className="btn btn-secondary" 
                disabled={submitting}
              >
                Cancel
              </button>

              <button 
                type="button" 
                onClick={() => handleDeletePackage(false)} className="btn btn-secondary"
                disabled={submitting}>
                Deactivate (Soft)
              </button>

              <button 
                type="button" 
                onClick={() => handleDeletePackage(true)} className="btn btn-danger"
                disabled={submitting}>
                {submitting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Buy / Upgrade Package Confirmation Modal */}
      {buyingPkg && (() => {
        const isUpgradeModal = Boolean(userCurrentPkg && userCurrentPkg.packageId !== buyingPkg.packageId);
        const capDifference = (buyingPkg.dailyCapping ?? 4000) - (userCurrentPkg?.dailyCapping ?? 4000);
        const bvDifference = buyingPkg.bv - (userCurrentPkg?.bv ?? 0);
        const rpDifference = (buyingPkg.rp ?? 0) - (userCurrentPkg?.rp ?? 0);

        return (
          <div className="modal-backdrop">
            <div className="modal modal-legacy" style={{ maxWidth: '490px', padding: '28px' }} role="dialog" aria-modal="true">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {isUpgradeModal ? <TrendingUp size={24} /> : <Package size={24} />}
                  </div>
                  <div>
                    <h3 className="section-title">
                      {isUpgradeModal ? 'Confirm Package Upgrade' : 'Confirm Package Purchase'}
                    </h3>
                    <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                      {isUpgradeModal
                        ? `Upgrade tier to unlock higher daily payout caps & volume benefits.`
                        : 'Verify details before confirming your joining package.'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setBuyingPkg(null)} className="icon-btn">
                  <X size={18} />
                </button>
              </div>

              {/* Upgrade Visual Comparison */}
              {isUpgradeModal && userCurrentPkg && (
                <div style={{
                  background: 'var(--surface-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px 18px',
                  border: '1px solid var(--primary-border)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Current Plan</div>
                    <strong style={{ fontSize: 'var(--fs-md)', color: 'var(--text-body)' }}>{userCurrentPkg.name}</strong>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--success)', fontWeight: 600 }}>₹{(userCurrentPkg.dailyCapping ?? 4000).toLocaleString()}/day cap</div>
                  </div>

                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <ArrowRight size={16} />
                  </div>

                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase' }}>Upgraded Tier</div>
                    <strong style={{ fontSize: 'var(--fs-md)', color: 'var(--primary-strong)' }}>{buyingPkg.name}</strong>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--primary)', fontWeight: 700 }}>₹{(buyingPkg.dailyCapping ?? 4000).toLocaleString()}/day cap</div>
                  </div>
                </div>
              )}

              <div style={{
                background: 'var(--surface-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
                border: '1px solid var(--border-color)',
                marginBottom: '20px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: 'var(--fs-base)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{isUpgradeModal ? 'Upgraded Package:' : 'Selected Package:'}</span>
                  <strong style={{ color: 'var(--text-main)' }}>{buyingPkg.name} ({buyingPkg.badge || 'TIER'})</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: 'var(--fs-base)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{isUpgradeModal ? 'Upgrade Price:' : 'Package Price:'}</span>
                  <strong style={{ color: 'var(--text-main)', fontSize: 'var(--fs-lg)', fontFamily: 'var(--font-display, sans-serif)' }}>
                    ₹ {buyingPkg.price.toLocaleString()}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: 'var(--fs-base)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Business Volume (BV):</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ color: 'var(--primary)' }}>{buyingPkg.bv.toLocaleString()} BV</strong>
                    {isUpgradeModal && bvDifference > 0 && (
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--success)', background: 'var(--success-light)', padding: '1px 6px', borderRadius: 'var(--radius-xs)', fontWeight: 700 }}>
                        +{bvDifference.toLocaleString()} BV
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: 'var(--fs-base)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Reward Points (RP):</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ color: 'var(--warning)' }}>{buyingPkg.rp ?? 0} RP</strong>
                    {isUpgradeModal && rpDifference > 0 && (
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--warning-hover)', background: 'var(--warning-light)', padding: '1px 6px', borderRadius: 'var(--radius-xs)', fontWeight: 700 }}>
                        +{rpDifference} RP
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-base)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Daily Binary Capping:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ color: 'var(--text-main)' }}>₹ {(buyingPkg.dailyCapping ?? 4000).toLocaleString()} / Day</strong>
                    {isUpgradeModal && capDifference > 0 && (
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--success)', background: 'var(--success-light)', padding: '1px 6px', borderRadius: 'var(--radius-xs)', fontWeight: 700 }}>
                        +₹{capDifference.toLocaleString()}/Day Boost
                      </span>
                    )}
                  </div>
                </div>

                {buyingPkg.description && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    {buyingPkg.description}
                  </div>
                )}
                <PaymentMethodPicker
                  amountInr={buyingPkg.price}
                  amountBV={buyingPkg.bv}
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  disabled={buyingLoading}
                />
                <div style={{ background: 'var(--info-light)', border: '1px solid var(--info-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '16px', fontSize: 'var(--fs-sm)', color: 'var(--info-strong)' }}>
                  <Send size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                  {paymentMethod === 'BV_WALLET'
                    ? 'The BV is deducted from your BV Wallet now. Super Admin will verify and activate your package; if the request is rejected, the BV comes back to your wallet.'
                    : 'Your request will be submitted to Super Admin. Once approved, the company bank details, UPI ID, and QR code will be provided to complete payment.'}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={() => setBuyingPkg(null)} className="btn btn-secondary" disabled={buyingLoading}>
                  Cancel
                </button>
                <button 
                  onClick={handleBuyPackage} 
                  className="btn btn-primary" 
                  disabled={buyingLoading}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontWeight: 800,
                    padding: '10px 18px',
                    background: isUpgradeModal ? 'var(--primary)' : undefined 
                  }}
                >
                  <Send size={16} />
                  <span>
                    {buyingLoading 
                      ? 'Submitting Request...' 
                      : paymentMethod === 'BV_WALLET'
                        ? 'Pay with BV & Submit'
                        : (isUpgradeModal ? `Submit Upgrade Request` : 'Submit Purchase Request')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PackagesPage;
