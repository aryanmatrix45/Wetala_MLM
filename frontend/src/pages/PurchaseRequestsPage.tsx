import React, { useState, useEffect } from 'react';
import { Alert, Badge, EmptyState, Field, LoadingState, Modal, PageHeader, SegmentedControl, StatusBadge } from '../components/ui';
import { ArrowLeft, Check, CheckCircle2, Clock, Copy, CreditCard, FileText, Filter, Landmark, Layers, Mail, Package, Phone, RefreshCw, Search, Send, ShoppingBag, ShoppingCart, Sparkles, User, Users, XCircle } from 'lucide-react';

import { api } from '../services/api';

interface PurchaseItem {
  itemId: string;
  itemType: 'PACKAGE' | 'PRODUCT';
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  totalBV: number;
}

interface CompanyAccountSnapshot {
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  accountType?: string;
  upiId?: string;
  upiHolderName?: string;
  qrCodeUrl?: string;
  depositInstructions?: string;
  supportPhone?: string;
}

interface PurchaseRecord {
  _id: string;
  purchaseId: string;
  memberId: string;
  memberName?: string;
  memberMobile?: string;
  memberEmail?: string;
  type: string;
  items: PurchaseItem[];
  totalAmount: number;
  totalBV: number;
  status: string;
  paymentStatus: string;
  approvalStage: 'REQUESTED' | 'PAYMENT_INSTRUCTIONS_SENT' | 'PAYMENT_SUBMITTED' | 'VERIFIED_AND_PAID' | 'REJECTED';
  adminMessage?: string;
  companyAccountSnapshot?: CompanyAccountSnapshot;
  payerName?: string;
  utrNumber?: string;
  paymentMode?: string;
  paymentMethod?: string;
  bvAmount?: number;
  bvTransactionId?: string;
  paymentSubmittedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface MemberRequestGroup {
  memberId: string;
  memberName: string;
  memberMobile?: string;
  memberEmail?: string;
  totalRequests: number;
  newRequestsCount: number; // approvalStage === 'REQUESTED'
  paymentSubmittedCount: number; // approvalStage === 'PAYMENT_SUBMITTED'
  awaitingPaymentCount: number; // approvalStage === 'PAYMENT_INSTRUCTIONS_SENT'
  completedCount: number; // approvalStage === 'VERIFIED_AND_PAID'
  rejectedCount: number; // approvalStage === 'REJECTED'
  latestRequestAt: string;
  totalAmountSum: number;
  totalBVSum: number;
  requests: PurchaseRecord[];
}

interface PurchaseRequestsPageProps {
  user: any;
  token?: string;
}

export const PurchaseRequestsPage: React.FC<PurchaseRequestsPageProps> = ({ user, token }) => {
  const isAdmin = user?.role?.toLowerCase() === 'superadmin';
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'REQUESTED' | 'PAYMENT_SUBMITTED' | 'PAYMENT_INSTRUCTIONS_SENT' | 'VERIFIED_AND_PAID' | 'REJECTED'>('REQUESTED');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'JOINING' | 'REPURCHASE'>('ALL');

  // Super Admin Member-Centric Workspace State
  const [adminViewMode, setAdminViewMode] = useState<'MEMBER_WORKSPACE' | 'GLOBAL_PIPELINE'>('MEMBER_WORKSPACE');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberFilterType, setMemberFilterType] = useState<'ALL' | 'ACTION_NEEDED' | 'NEW_REQUESTS' | 'VERIFY_UTR'>('ALL');
  const [memberSearchTerm, setMemberSearchTerm] = useState<string>('');
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  // Responsive Mobile Navigation State
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const [mobileActivePane, setMobileActivePane] = useState<'QUEUE' | 'DETAILS'>('QUEUE');

  // Global Pipeline View Member Filter
  const [globalSelectedMemberId, setGlobalSelectedMemberId] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Modals state
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRecord | null>(null);
  const [isSendInstructionsOpen, setIsSendInstructionsOpen] = useState<boolean>(false);
  const [adminInstructionNote, setAdminInstructionNote] = useState<string>('');
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Member Payment Submission Modal State
  const [isSubmitPaymentModalOpen, setIsSubmitPaymentModalOpen] = useState<boolean>(false);
  const [memberUtr, setMemberUtr] = useState<string>('');
  const [memberPayerName, setMemberPayerName] = useState<string>(user?.name || '');
  const [memberPaymentMode, setMemberPaymentMode] = useState<string>('UPI');

  // Member dossier state
  const [dossierMemberId, setDossierMemberId] = useState<string | null>(null);
  const [dossierData, setDossierData] = useState<any | null>(null);
  const [dossierLoading, setDossierLoading] = useState<boolean>(false);

  const fetchPurchases = async () => {
    try {
      setRefreshing(true);
      // For Admin, fetch complete records so member queue & global pipeline tabs are fully populated with counts
      const stageFilter = isAdmin
        ? undefined
        : (activeTab === 'ALL' ? undefined : activeTab);

      const res = await api.getPurchases(
        {
          stage: stageFilter,
          type: typeFilter === 'ALL' ? undefined : typeFilter,
          search: searchTerm.trim() || undefined,
          memberId: isAdmin ? undefined : user?.memberId,
        },
        token
      );
      if (res.status && Array.isArray(res.data)) {
        setPurchases(res.data);
      }
    } catch (err: any) {
      console.error('Error loading purchase orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [isAdmin ? null : activeTab, typeFilter, adminViewMode]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPurchases();
  };

  const handleCopyUtr = (utr: string) => {
    if (!utr) return;
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  // Group purchases by Member
  const memberGroups: MemberRequestGroup[] = React.useMemo(() => {
    const map = new Map<string, MemberRequestGroup>();

    purchases.forEach((p) => {
      const mId = p.memberId || 'UNKNOWN';
      let group = map.get(mId);
      if (!group) {
        group = {
          memberId: mId,
          memberName: p.memberName || mId,
          memberMobile: p.memberMobile,
          memberEmail: p.memberEmail,
          totalRequests: 0,
          newRequestsCount: 0,
          paymentSubmittedCount: 0,
          awaitingPaymentCount: 0,
          completedCount: 0,
          rejectedCount: 0,
          latestRequestAt: p.createdAt,
          totalAmountSum: 0,
          totalBVSum: 0,
          requests: [],
        };
        map.set(mId, group);
      }

      group.totalRequests += 1;
      group.totalAmountSum += p.totalAmount || 0;
      group.totalBVSum += p.totalBV || 0;
      group.requests.push(p);

      if (p.approvalStage === 'REQUESTED') group.newRequestsCount += 1;
      else if (p.approvalStage === 'PAYMENT_SUBMITTED') group.paymentSubmittedCount += 1;
      else if (p.approvalStage === 'PAYMENT_INSTRUCTIONS_SENT') group.awaitingPaymentCount += 1;
      else if (p.approvalStage === 'VERIFIED_AND_PAID') group.completedCount += 1;
      else if (p.approvalStage === 'REJECTED') group.rejectedCount += 1;

      if (new Date(p.createdAt) > new Date(group.latestRequestAt)) {
        group.latestRequestAt = p.createdAt;
      }
    });

    // Sort: Members needing action come first (New Requests -> Payment Submitted -> Awaiting -> date)
    const list = Array.from(map.values());
    list.sort((a, b) => {
      const aScore = (a.newRequestsCount > 0 ? 100 : 0) + (a.paymentSubmittedCount > 0 ? 50 : 0) + (a.awaitingPaymentCount > 0 ? 10 : 0);
      const bScore = (b.newRequestsCount > 0 ? 100 : 0) + (b.paymentSubmittedCount > 0 ? 50 : 0) + (b.awaitingPaymentCount > 0 ? 10 : 0);
      if (aScore !== bScore) return bScore - aScore;
      return new Date(b.latestRequestAt).getTime() - new Date(a.latestRequestAt).getTime();
    });

    return list;
  }, [purchases]);

  // Auto-select first member if none selected or selection not in list
  useEffect(() => {
    if (memberGroups.length > 0) {
      if (!selectedMemberId || !memberGroups.some((g) => g.memberId === selectedMemberId)) {
        setSelectedMemberId(memberGroups[0].memberId);
      }
    }
  }, [memberGroups, selectedMemberId]);

  // Filtered member groups based on quick filter and search
  const filteredMemberGroups = React.useMemo(() => {
    return memberGroups.filter((g) => {
      if (memberFilterType === 'ACTION_NEEDED' && g.newRequestsCount === 0 && g.paymentSubmittedCount === 0) {
        return false;
      }
      if (memberFilterType === 'NEW_REQUESTS' && g.newRequestsCount === 0) {
        return false;
      }
      if (memberFilterType === 'VERIFY_UTR' && g.paymentSubmittedCount === 0) {
        return false;
      }
      if (memberSearchTerm.trim()) {
        const q = memberSearchTerm.toLowerCase();
        const matchesId = g.memberId.toLowerCase().includes(q);
        const matchesName = g.memberName.toLowerCase().includes(q);
        const matchesMobile = (g.memberMobile || '').toLowerCase().includes(q);
        return matchesId || matchesName || matchesMobile;
      }
      return true;
    });
  }, [memberGroups, memberFilterType, memberSearchTerm]);

  const selectedMemberGroup = React.useMemo(() => {
    return memberGroups.find((g) => g.memberId === selectedMemberId) || filteredMemberGroups[0] || null;
  }, [memberGroups, selectedMemberId, filteredMemberGroups]);

  // Global Pipeline View Tab Counts (dynamically calculates for selected member or all members)
  const globalTabCounts = React.useMemo(() => {
    const list = globalSelectedMemberId
      ? purchases.filter((p) => p.memberId === globalSelectedMemberId)
      : purchases;

    return {
      all: list.length,
      requested: list.filter((p) => (p.approvalStage || 'REQUESTED') === 'REQUESTED').length,
      paymentSubmitted: list.filter((p) => p.approvalStage === 'PAYMENT_SUBMITTED').length,
      awaitingPayment: list.filter((p) => p.approvalStage === 'PAYMENT_INSTRUCTIONS_SENT').length,
      verifiedAndPaid: list.filter((p) => p.approvalStage === 'VERIFIED_AND_PAID').length,
      rejected: list.filter((p) => p.approvalStage === 'REJECTED').length,
    };
  }, [purchases, globalSelectedMemberId]);

  const globalSelectedMemberGroup = React.useMemo(() => {
    if (!globalSelectedMemberId) return null;
    return memberGroups.find((g) => g.memberId === globalSelectedMemberId) || null;
  }, [memberGroups, globalSelectedMemberId]);

  // Filtered purchases to display in Global Pipeline View
  const displayedGlobalPurchases = React.useMemo(() => {
    return purchases.filter((pur) => {
      // 1. Member filter
      if (globalSelectedMemberId && pur.memberId !== globalSelectedMemberId) {
        return false;
      }
      // 2. Tab filter
      const stage = pur.approvalStage || 'REQUESTED';
      if (activeTab !== 'ALL' && stage !== activeTab) {
        return false;
      }
      // 3. Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchId = (pur.memberId || '').toLowerCase().includes(q);
        const matchName = (pur.memberName || '').toLowerCase().includes(q);
        const matchUtr = (pur.utrNumber || '').toLowerCase().includes(q);
        const matchPurId = (pur.purchaseId || '').toLowerCase().includes(q);
        if (!matchId && !matchName && !matchUtr && !matchPurId) return false;
      }
      // 4. Type filter
      if (typeFilter !== 'ALL') {
        const isPkg = pur.items.some((it) => it.itemType === 'PACKAGE');
        if (typeFilter === 'JOINING' && !isPkg) return false;
        if (typeFilter === 'REPURCHASE' && isPkg) return false;
      }
      return true;
    });
  }, [purchases, globalSelectedMemberId, activeTab, searchTerm, typeFilter]);

  // Open Dossier
  const openMemberDossier = async (memId: string) => {
    try {
      setDossierMemberId(memId);
      setDossierLoading(true);
      const res = await api.getMemberPurchaseHistory(memId, token);
      if (res.status && res.data) {
        setDossierData(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to load member dossier');
      setDossierMemberId(null);
    } finally {
      setDossierLoading(false);
    }
  };

  // Action: Approve & Send Payment Instructions
  const handleSendInstructions = async () => {
    if (!selectedPurchase) return;
    try {
      setActionLoading(true);
      const res = await api.approvePurchaseInstructions(
        selectedPurchase.purchaseId,
        adminInstructionNote.trim() || undefined,
        token
      );
      setFeedback({ type: 'success', message: res.message || 'Payment instructions sent to member!' });
      setIsSendInstructionsOpen(false);
      setSelectedPurchase(null);
      setAdminInstructionNote('');
      fetchPurchases();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to send payment instructions.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Verify & Mark as Paid
  const handleVerifyAndPay = async () => {
    if (!selectedPurchase) return;
    try {
      setActionLoading(true);
      const res = await api.verifyAndPayPurchase(selectedPurchase.purchaseId, token);
      setFeedback({ type: 'success', message: res.message || 'Purchase marked as Paid & BV credited successfully!' });
      setIsVerifyModalOpen(false);
      setSelectedPurchase(null);
      fetchPurchases();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Verification failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Reject
  const handleReject = async () => {
    if (!selectedPurchase) return;
    try {
      setActionLoading(true);
      const res = await api.rejectPurchase(selectedPurchase.purchaseId, rejectionReason.trim() || undefined, token);
      setFeedback({ type: 'success', message: res.message || 'Purchase request rejected.' });
      setIsRejectModalOpen(false);
      setSelectedPurchase(null);
      setRejectionReason('');
      fetchPurchases();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Rejection failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleMemberSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchase) return;
    if (!memberUtr.trim()) {
      alert('Please provide Bank UTR / Transaction reference ID.');
      return;
    }
    try {
      setActionLoading(true);
      const res = await api.submitPurchasePayment(
        selectedPurchase.purchaseId,
        {
          utrNumber: memberUtr.trim(),
          payerName: memberPayerName.trim() || user?.name || '',
          paymentMode: memberPaymentMode,
        },
        token
      );
      setFeedback({ type: 'success', message: res.message || 'Payment details submitted! Super Admin will verify.' });
      setIsSubmitPaymentModalOpen(false);
      setSelectedPurchase(null);
      setMemberUtr('');
      fetchPurchases();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to submit payment details.' });
    } finally {
      setActionLoading(false);
    }
  };

  const stageBadge = (stage: string) => {
    switch (stage) {
      case 'REQUESTED':
        return <StatusBadge status="REQUESTED" icon={<Clock size={12} />} label="New request" />;
      case 'PAYMENT_INSTRUCTIONS_SENT':
        return <StatusBadge status="PAYMENT_INSTRUCTIONS_SENT" icon={<Send size={12} />} label="Payment details sent" />;
      case 'PAYMENT_SUBMITTED':
        return <StatusBadge status="PAYMENT_SUBMITTED" icon={<CreditCard size={12} />} label="Verify UTR" />;
      case 'VERIFIED_AND_PAID':
        return <StatusBadge status="VERIFIED_AND_PAID" icon={<CheckCircle2 size={12} />} label="Paid & volume credited" />;
      case 'REJECTED':
        return <StatusBadge status="REJECTED" icon={<XCircle size={12} />} label="Rejected" />;
      default:
        return <StatusBadge status={stage} />;
    }
  };

  const actionNeededCount = memberGroups.filter((g) => g.newRequestsCount > 0 || g.paymentSubmittedCount > 0).length;
  const newRequestsMembersCount = memberGroups.filter((g) => g.newRequestsCount > 0).length;
  const verifyUtrMembersCount = memberGroups.filter((g) => g.paymentSubmittedCount > 0).length;

  return (
    <div className="page-body">
      <PageHeader
        title={isAdmin ? 'Purchase Requests' : 'My Orders'}
        subtitle={
          isAdmin
            ? 'Review requests, send payment instructions, verify UTR payments and credit business volume.'
            : 'Track your package and product orders and complete pending payments.'
        }
        actions={
          <>
            {isAdmin && (
              <SegmentedControl
                ariaLabel="View"
                value={adminViewMode}
                onChange={(v) => setAdminViewMode(v as typeof adminViewMode)}
                options={[
                  { value: 'MEMBER_WORKSPACE', label: 'By member', icon: <Users size={14} />, count: actionNeededCount },
                  { value: 'GLOBAL_PIPELINE', label: 'All requests', icon: <Layers size={14} /> },
                ]}
              />
            )}
            <button type="button" onClick={fetchPurchases} disabled={refreshing} className="btn btn-secondary">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </>
        }
      />

      {feedback && (
        <Alert tone={feedback.type === 'success' ? 'success' : 'error'} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* ======================================================== */}
      {/* 1. SUPER ADMIN MEMBER-CENTRIC WORKSPACE (MASTER-DETAIL)   */}
      {/* ======================================================== */}
      {isAdmin && adminViewMode === 'MEMBER_WORKSPACE' ? (
        <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          {/* Mobile Navigation Tabs (< 1024px) */}
          {isMobile && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', background: 'var(--surface-muted)', padding: '4px', borderRadius: 'var(--radius-lg)', width: '100%', boxSizing: 'border-box' }}>
              <button
                type="button"
                onClick={() => setMobileActivePane('QUEUE')}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 'var(--fs-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: mobileActivePane === 'QUEUE' ? 'var(--surface)' : 'transparent',
                  color: mobileActivePane === 'QUEUE' ? 'var(--text-main)' : 'var(--text-muted)',
                  boxShadow: mobileActivePane === 'QUEUE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <Users size={14} />
                <span>Queue ({memberGroups.length})</span>
                {actionNeededCount > 0 && (
                  <span style={{ background: 'var(--warning)', color: 'var(--text-inverse)', fontSize: 'var(--fs-2xs)', padding: '1px 6px', borderRadius: 'var(--radius-full)', fontWeight: 800 }}>
                    {actionNeededCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedMemberGroup) setMobileActivePane('DETAILS');
                }}
                disabled={!selectedMemberGroup}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 'var(--fs-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: mobileActivePane === 'DETAILS' ? 'var(--primary)' : 'transparent',
                  color: mobileActivePane === 'DETAILS' ? 'var(--text-inverse)' : selectedMemberGroup ? 'var(--text-muted)' : 'var(--text-disabled)',
                  boxShadow: mobileActivePane === 'DETAILS' ? 'none' : 'none',
                  cursor: selectedMemberGroup ? 'pointer' : 'not-allowed',
                }}
              >
                <Sparkles size={14} />
                <span>{selectedMemberGroup ? `${selectedMemberGroup.memberId} Pipeline` : 'Select Member'}</span>
              </button>
            </div>
          )}

          <div
            style={
              isMobile
                ? { display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }
                : { display: 'grid', gridTemplateColumns: 'minmax(320px, 360px) 1fr', gap: '22px', alignItems: 'start', width: '100%', boxSizing: 'border-box' }
            }
          >
            {/* LEFT: Member Directory / Queue */}
            {(!isMobile || mobileActivePane === 'QUEUE') && (
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)',
                  padding: isMobile ? '14px' : '18px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  maxHeight: isMobile ? 'none' : 'calc(100vh - 160px)',
                  position: isMobile ? 'static' : 'sticky',
                  top: '20px',
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} color="var(--primary)" />
                  <span>Member Queue</span>
                </h3>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-muted)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                  {memberGroups.length} Members
                </span>
              </div>

              {/* Member Search */}
              <div style={{ position: 'relative', marginTop: '6px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input
                  type="text"
                  placeholder="Search Member ID, Name, Phone..."
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 'var(--fs-sm)',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Quick Status Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setMemberFilterType('ALL')}
                style={{
                  padding: '4px 9px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: memberFilterType === 'ALL' ? 'var(--surface-inverse)' : 'var(--surface-muted)',
                  color: memberFilterType === 'ALL' ? 'var(--text-inverse)' : 'var(--text-muted)',
                }}
              >
                All ({memberGroups.length})
              </button>

              <button
                onClick={() => setMemberFilterType('ACTION_NEEDED')}
                style={{
                  padding: '4px 9px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: memberFilterType === 'ACTION_NEEDED' ? 'var(--danger)' : 'var(--danger-soft)',
                  color: memberFilterType === 'ACTION_NEEDED' ? 'var(--text-inverse)' : 'var(--danger-hover)',
                }}
              >
                Action needed ({actionNeededCount})
              </button>

              <button
                onClick={() => setMemberFilterType('NEW_REQUESTS')}
                style={{
                  padding: '4px 9px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: memberFilterType === 'NEW_REQUESTS' ? 'var(--warning)' : 'var(--warning-soft)',
                  color: memberFilterType === 'NEW_REQUESTS' ? 'var(--text-inverse)' : 'var(--warning-hover)',
                }}
              >
                New ({newRequestsMembersCount})
              </button>

              <button
                onClick={() => setMemberFilterType('VERIFY_UTR')}
                style={{
                  padding: '4px 9px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: memberFilterType === 'VERIFY_UTR' ? 'var(--accent)' : 'var(--accent-soft)',
                  color: memberFilterType === 'VERIFY_UTR' ? 'var(--text-inverse)' : 'var(--accent-hover)',
                }}
              >
                Verify UTR ({verifyUtrMembersCount})
              </button>
            </div>

            {/* Scrollable Members List */}
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
              {loading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-base)' }}>
                  Loading members queue...
                </div>
              ) : filteredMemberGroups.length === 0 ? (
                <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-light)', fontSize: 'var(--fs-sm)' }}>
                  No members matching this filter.
                </div>
              ) : (
                filteredMemberGroups.map((group) => {
                  const isSelected = selectedMemberId === group.memberId;
                  const hasNewRequest = group.newRequestsCount > 0;
                  const hasVerifyUtr = group.paymentSubmittedCount > 0;
                  const hasAwaiting = group.awaitingPaymentCount > 0;

                  // Dynamic Card Styling based on status
                  let borderStyle = '1px solid var(--border-color)';
                  let bgStyle = 'var(--surface)';

                  if (hasNewRequest) {
                    borderStyle = '2px solid var(--warning)';
                    bgStyle = 'var(--warning-light)';
                  } else if (hasVerifyUtr) {
                    borderStyle = '2px solid var(--accent)';
                    bgStyle = 'var(--accent-light)';
                  } else if (hasAwaiting) {
                    borderStyle = '1px solid var(--primary-border)';
                    bgStyle = 'var(--info-light)';
                  }

                  return (
                    <div
                      key={group.memberId}
                      onClick={() => {
                        setSelectedMemberId(group.memberId);
                        if (isMobile) {
                          setMobileActivePane('DETAILS');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-lg)',
                        border: isSelected ? '2px solid var(--primary)' : borderStyle,
                        background: isSelected ? 'var(--primary-light)' : bgStyle,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div>
                          <span
                            style={{
                              fontSize: 'var(--fs-xs)',
                              fontWeight: 800,
                              color: hasNewRequest ? 'var(--warning-hover)' : hasVerifyUtr ? 'var(--accent-hover)' : 'var(--primary-strong)',
                              background: hasNewRequest ? 'var(--warning-soft)' : hasVerifyUtr ? 'var(--accent-soft)' : 'var(--info-soft)',
                              padding: '2px 7px',
                              borderRadius: 'var(--radius-xs)',
                              letterSpacing: '0.4px',
                            }}
                          >
                            {group.memberId}
                          </span>
                          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                            {group.memberName}
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end' }}>
                          {hasNewRequest && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'var(--warning)',
                                color: 'var(--text-inverse)',
                                fontSize: 'var(--fs-2xs)',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-full)',
                                boxShadow: 'none',
                              }}
                            >
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--surface)' }} />
                              NEW ({group.newRequestsCount})
                            </span>
                          )}

                          {hasVerifyUtr && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'var(--accent)',
                                color: 'var(--text-inverse)',
                                fontSize: 'var(--fs-2xs)',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-full)',
                                boxShadow: 'none',
                              }}
                            >
                              VERIFY UTR ({group.paymentSubmittedCount})
                            </span>
                          )}

                          {!hasNewRequest && !hasVerifyUtr && hasAwaiting && (
                            <span
                              style={{
                                background: 'var(--info-soft)',
                                color: 'var(--info-strong)',
                                fontSize: 'var(--fs-2xs)',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-xs)',
                              }}
                            >
                              Awaiting Payment
                            </span>
                          )}

                          {!hasNewRequest && !hasVerifyUtr && !hasAwaiting && (
                            <span
                              style={{
                                background: 'var(--success-light)',
                                color: 'var(--success)',
                                fontSize: 'var(--fs-2xs)',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-xs)',
                              }}
                            >
                              ✓ Settled
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '6px' }}>
                        <span>
                          {group.totalRequests} Request{group.totalRequests > 1 ? 's' : ''} • +{group.totalBVSum.toLocaleString()} BV
                        </span>
                        <span>
                          ₹{group.totalAmountSum.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
            )}

          {/* RIGHT: Selected Member Workspace & Pipeline */}
          {(!isMobile || mobileActivePane === 'DETAILS') && (
            <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setMobileActivePane('QUEUE')} className="btn btn-secondary" style={{ marginBottom: '14px' }}>
                  <ArrowLeft size={16} />
                  <span>← Back to Member Queue</span>
                </button>
              )}

              {!selectedMemberGroup ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <Users size={40} style={{ color: 'var(--text-disabled)', margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-body)', margin: '0 0 6px 0' }}>No member selected</h3>
                  <p style={{ margin: 0, fontSize: 'var(--fs-base)' }}>Select a member from the queue on the left to review their purchase pipeline.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Member Header Card */}
                  <div
                    style={{
                      background: 'var(--surface)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-color)',
                      padding: isMobile ? '16px' : '20px 24px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: isMobile ? 'flex-start' : 'center',
                      flexDirection: isMobile ? 'column' : 'row',
                      gap: '14px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: isMobile ? '100%' : 'auto' }}>
                    <div
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--primary)',
                        color: 'var(--text-inverse)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'var(--fs-2xl)',
                        fontWeight: 900,
                        boxShadow: 'none',
                      }}
                    >
                      {selectedMemberGroup.memberName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h2 className="section-title" style={{ margin: 0 }}>
                          {selectedMemberGroup.memberName}
                        </h2>
                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                          {selectedMemberGroup.memberId}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {selectedMemberGroup.memberMobile && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={12} /> {selectedMemberGroup.memberMobile}
                          </span>
                        )}
                        {selectedMemberGroup.memberEmail && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={12} /> {selectedMemberGroup.memberEmail}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end', width: isMobile ? '100%' : 'auto', gap: '12px', borderTop: isMobile ? '1px solid var(--border-light)' : 'none', paddingTop: isMobile ? '12px' : 0 }}>
                    <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Volume & Purchases</div>
                      <div style={{ fontSize: isMobile ? '13px' : '15px', fontWeight: 800, color: 'var(--success)' }}>
                        +{selectedMemberGroup.totalBVSum.toLocaleString()} BV • ₹{selectedMemberGroup.totalAmountSum.toLocaleString()}
                      </div>
                    </div>

                    <button
                      onClick={() => openMemberDossier(selectedMemberGroup.memberId)} className="btn btn-primary btn-sm">
                      <FileText size={14} />
                      <span>Lifetime Dossier</span>
                    </button>
                  </div>
                </div>

                {/* Section 1: Actionable / Active Requests Pipeline */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Sparkles size={16} color="var(--warning)" />
                    <h3 className="section-title" style={{ margin: 0 }}>
                      Active Requests Pipeline ({selectedMemberGroup.requests.filter((r) => r.approvalStage !== 'VERIFIED_AND_PAID' && r.approvalStage !== 'REJECTED').length})
                    </h3>
                  </div>

                  {selectedMemberGroup.requests.filter((r) => r.approvalStage !== 'VERIFIED_AND_PAID' && r.approvalStage !== 'REJECTED').length === 0 ? (
                    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={32} style={{ color: 'var(--success)', margin: '0 auto 8px' }} />
                      <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--fs-md)' }}>All caught up!</div>
                      <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)' }}>No pending requests requiring action for this member.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {selectedMemberGroup.requests
                        .filter((r) => r.approvalStage !== 'VERIFIED_AND_PAID' && r.approvalStage !== 'REJECTED')
                        .map((pur) => {
                          const isPackage = pur.items.some((it) => it.itemType === 'PACKAGE');

                          return (
                            <div
                              key={pur._id}
                              style={{
                                background: 'var(--surface)',
                                borderRadius: 'var(--radius-lg)',
                                border: pur.approvalStage === 'REQUESTED'
                                  ? '2px solid var(--warning)'
                                  : pur.approvalStage === 'PAYMENT_SUBMITTED'
                                  ? '2px solid var(--accent)'
                                  : '1px solid var(--border-strong)',
                                padding: '22px',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                              }}
                            >
                              {/* Request Header */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-main)' }}>
                                      Order #{pur.purchaseId}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 'var(--fs-xs)',
                                        fontWeight: 800,
                                        color: isPackage ? 'var(--warning-hover)' : 'var(--success-hover)',
                                        background: isPackage ? 'var(--warning-soft)' : 'var(--success-light)',
                                        padding: '2px 8px',
                                        borderRadius: 'var(--radius-sm)',
                                      }}
                                    >
                                      {isPackage ? 'Package Joining/Upgrade' : 'Product Repurchase'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '3px' }}>
                                    Requested on {new Date(pur.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: 'var(--success)' }}>
                                    ₹ {pur.totalAmount.toLocaleString()}
                                  </div>
                                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--primary)' }}>
                                    +{pur.totalBV.toLocaleString()} BV
                                  </div>
                                </div>
                              </div>

                              {/* Interactive 4-Step Pipeline Stepper */}
                              <div
                                style={{
                                  background: 'var(--surface-subtle)',
                                  borderRadius: 'var(--radius-lg)',
                                  padding: isMobile ? '10px 8px' : '14px 18px',
                                  border: '1px solid var(--border-color)',
                                }}
                              >
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: isMobile ? '4px' : '8px', position: 'relative' }}>
                                  {[
                                    { step: 1, title: '1. Request', desc: 'Member Intent', active: true, done: true },
                                    {
                                      step: 2,
                                      title: '2. Bank Info',
                                      desc: 'Instructions Sent',
                                      active: pur.approvalStage === 'PAYMENT_INSTRUCTIONS_SENT' || pur.approvalStage === 'PAYMENT_SUBMITTED',
                                      done: pur.approvalStage === 'PAYMENT_INSTRUCTIONS_SENT' || pur.approvalStage === 'PAYMENT_SUBMITTED',
                                    },
                                    {
                                      step: 3,
                                      title: '3. Verify UTR',
                                      desc: 'Payment Proof',
                                      active: pur.approvalStage === 'PAYMENT_SUBMITTED',
                                      done: false,
                                    },
                                    {
                                      step: 4,
                                      title: '4. Activated',
                                      desc: 'BV Credited',
                                      active: false,
                                      done: false,
                                    },
                                  ].map((st) => (
                                    <div key={st.step} style={{ textAlign: 'center' }}>
                                      <div
                                        style={{
                                          width: isMobile ? '22px' : '26px',
                                          height: isMobile ? '22px' : '26px',
                                          borderRadius: '50%',
                                          background: st.done ? 'var(--success)' : st.active ? 'var(--primary)' : 'var(--surface-sunken)',
                                          color: st.done || st.active ? 'var(--text-inverse)' : 'var(--text-muted)',
                                          margin: '0 auto 4px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: isMobile ? '10px' : '11px',
                                          fontWeight: 800,
                                        }}
                                      >
                                        {st.done ? '✓' : st.step}
                                      </div>
                                      <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: 800, color: st.active ? 'var(--primary-strong)' : 'var(--text-secondary)', lineHeight: 1.2 }}>
                                        {st.title}
                                      </div>
                                      <div style={{ fontSize: isMobile ? '8px' : '10px', color: 'var(--text-light)', lineHeight: 1.2, marginTop: '2px' }}>
                                        {st.desc}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Items Breakdown */}
                              <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 14px', background: 'var(--surface)' }}>
                                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                  Requested Items
                                </div>
                                {pur.items.map((it, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-base)', color: 'var(--text-strong)', marginBottom: '4px' }}>
                                    <span>
                                      {it.name} <strong style={{ color: 'var(--text-muted)' }}>× {it.quantity}</strong>
                                    </span>
                                    <span>₹ {it.totalPrice.toLocaleString()} ({it.totalBV.toLocaleString()} BV)</span>
                                  </div>
                                ))}
                              </div>

                              {/* STAGE ACTION PANEL */}
                              {pur.approvalStage === 'REQUESTED' && (
                                <div style={{ background: 'var(--warning-light)', border: '1.5px solid var(--warning)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning-hover)', fontWeight: 800, fontSize: 'var(--fs-base)', marginBottom: '6px' }}>
                                    <Clock size={16} />
                                    <span>Step 1: Super Admin Action Required</span>
                                  </div>
                                  <p style={{ margin: '0 0 14px', fontSize: 'var(--fs-sm)', color: 'var(--warning-strong)', lineHeight: '1.5' }}>
                                    The member wants to buy this package/product. Approve the request to automatically dispatch the company bank details, UPI ID, and QR code to the member.
                                  </p>
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                      onClick={() => {
                                        setSelectedPurchase(pur);
                                        setIsSendInstructionsOpen(true);
                                      }}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '10px 18px',
                                        background: 'var(--info)',
                                        color: 'var(--text-inverse)',
                                        border: 'none',
                                        borderRadius: 'var(--radius-md)',
                                        fontWeight: 700,
                                        fontSize: 'var(--fs-base)',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Send size={15} /> Approve & Dispatch Payment Details
                                    </button>

                                    <button
                                      onClick={() => {
                                        setSelectedPurchase(pur);
                                        setIsRejectModalOpen(true);
                                      }} className="btn btn-danger-outline">
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              )}

                              {pur.approvalStage === 'PAYMENT_INSTRUCTIONS_SENT' && (
                                <div style={{ background: 'var(--info-light)', border: '1px solid var(--info-border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--info-strong)', fontWeight: 800, fontSize: 'var(--fs-base)', marginBottom: '6px' }}>
                                    <Send size={16} />
                                    <span>Step 2: Awaiting Member Payment & UTR</span>
                                  </div>
                                  <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-sm)', color: 'var(--info-strong)', lineHeight: '1.5' }}>
                                    Company bank details and UPI instructions were sent. Waiting for <strong>{selectedMemberGroup.memberName}</strong> to transfer funds and submit their transaction reference UTR.
                                  </p>
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                      onClick={() => {
                                        setSelectedPurchase(pur);
                                        setIsVerifyModalOpen(true);
                                      }} className="btn btn-secondary btn-sm">
                                      Manual Verification / Mark Paid
                                    </button>
                                  </div>
                                </div>
                              )}

                              {pur.approvalStage === 'PAYMENT_SUBMITTED' && (
                                <div style={{ background: 'var(--accent-light)', border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-hover)', fontWeight: 800, fontSize: 'var(--fs-md)', marginBottom: '8px' }}>
                                    <CreditCard size={18} />
                                    <span>Step 3: Verify Payment Proof (UTR)</span>
                                  </div>
                                  <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-sm)', color: 'var(--accent-strong)' }}>
                                    Member has completed the transfer and submitted the payment proof below. Verify with company bank statements.
                                  </p>

                                  {/* Submitted Proof Card */}
                                  <div
                                    style={{
                                      background: 'var(--surface)',
                                      border: '1px solid var(--accent-border)',
                                      borderRadius: 'var(--radius-md)',
                                      padding: '14px',
                                      marginBottom: '14px',
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                      gap: '12px',
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--accent-hover)', fontWeight: 800, textTransform: 'uppercase' }}>UTR / Reference ID</div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                        <span style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: 'var(--accent-strong)', fontFamily: 'monospace' }}>
                                          {pur.utrNumber}
                                        </span>
                                        <button
                                          onClick={() => handleCopyUtr(pur.utrNumber || '')}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0 }}
                                          title="Copy UTR"
                                        >
                                          {copiedUtr === pur.utrNumber ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                                        </button>
                                      </div>
                                    </div>

                                    <div>
                                      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--accent-hover)', fontWeight: 800, textTransform: 'uppercase' }}>Payer Name</div>
                                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--accent-strong)', marginTop: '2px' }}>
                                        {pur.payerName || selectedMemberGroup.memberName}
                                      </div>
                                    </div>

                                    <div>
                                      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--accent-hover)', fontWeight: 800, textTransform: 'uppercase' }}>Mode</div>
                                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--accent-strong)', marginTop: '2px' }}>
                                        {pur.paymentMethod === 'BV_WALLET' ? (
                                          <span style={{ background: 'var(--accent-soft)', color: 'var(--accent-hover)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>
                                            Paid with BV: {(pur.bvAmount || 0).toLocaleString('en-IN')} BV
                                          </span>
                                        ) : (
                                          pur.paymentMode || 'UPI'
                                        )}
                                      </div>
                                    </div>

                                    <div>
                                      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--accent-hover)', fontWeight: 800, textTransform: 'uppercase' }}>Submitted At</div>
                                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent-strong)', marginTop: '2px' }}>
                                        {pur.paymentSubmittedAt ? new Date(pur.paymentSubmittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                      onClick={() => {
                                        setSelectedPurchase(pur);
                                        setIsVerifyModalOpen(true);
                                      }} className="btn btn-success">
                                      <CheckCircle2 size={16} /> Verify UTR & Mark as Paid
                                    </button>

                                    <button
                                      onClick={() => {
                                        setSelectedPurchase(pur);
                                        setIsRejectModalOpen(true);
                                      }} className="btn btn-danger-outline">
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Section 2: Settled History for this Member */}
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <CheckCircle2 size={16} color="var(--success)" />
                    <h3 className="section-title" style={{ margin: 0 }}>
                      Settled Requests History ({selectedMemberGroup.requests.filter((r) => r.approvalStage === 'VERIFIED_AND_PAID' || r.approvalStage === 'REJECTED').length})
                    </h3>
                  </div>

                  {selectedMemberGroup.requests.filter((r) => r.approvalStage === 'VERIFIED_AND_PAID' || r.approvalStage === 'REJECTED').length === 0 ? (
                    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', textAlign: 'center', color: 'var(--text-light)', fontSize: 'var(--fs-base)' }}>
                      No previous settled purchases for this member yet.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Order ID</th>
                            <th>Item Details</th>
                            <th>Amount / BV</th>
                            <th>UTR / Reference</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedMemberGroup.requests
                            .filter((r) => r.approvalStage === 'VERIFIED_AND_PAID' || r.approvalStage === 'REJECTED')
                            .map((h) => (
                              <tr key={h._id}>
                                <td style={{ color: 'var(--text-muted)' }}>
                                  {new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                                  {h.purchaseId}
                                </td>
                                <td>
                                  <span style={{ fontWeight: 700, color: h.items[0]?.itemType === 'PACKAGE' ? 'var(--warning-hover)' : 'var(--success-hover)' }}>
                                    [{h.items[0]?.itemType === 'PACKAGE' ? 'PACKAGE' : 'PRODUCT'}]
                                  </span>{' '}
                                  {h.items.map((it) => `${it.name} (x${it.quantity})`).join(', ')}
                                </td>
                                <td style={{ fontWeight: 800 }}>
                                  ₹ {h.totalAmount.toLocaleString()} <span style={{ color: 'var(--info)' }}>({h.totalBV.toLocaleString()} BV)</span>
                                </td>
                                <td style={{ fontFamily: 'monospace', color: 'var(--accent-strong)' }}>
                                  {h.utrNumber || '-'}
                                </td>
                                <td>
                                  {stageBadge(h.approvalStage)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  ) : (
        /* ======================================================== */
        /* 2. GLOBAL PIPELINE / REGULAR MEMBER TABULAR CARDS VIEW    */
        /* ======================================================== */
        <div>
          {/* Member Filter Bar for Global Pipeline */}
          {isAdmin && (
            <div style={{ marginBottom: '18px', background: 'var(--surface-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-body)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} color="var(--primary)" />
                  <span>Filter by Member:</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'none' }}>
                    (Click any Member to view their requests across all 6 steps)
                  </span>
                </div>
                {globalSelectedMemberId && (
                  <button
                    type="button"
                    onClick={() => setGlobalSelectedMemberId(null)} className="btn btn-secondary btn-sm">
                    Show all members
                  </button>
                )}
              </div>

              {/* Horizontal Scrollable Member Filter Chips */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {/* 1. All Members */}
                <button
                  type="button"
                  onClick={() => setGlobalSelectedMemberId(null)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-xl)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: globalSelectedMemberId === null ? '2px solid var(--primary)' : '1px solid var(--border-strong)',
                    background: globalSelectedMemberId === null ? 'var(--primary-light)' : 'var(--surface)',
                    color: globalSelectedMemberId === null ? 'var(--primary-hover)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    boxShadow: globalSelectedMemberId === null ? 'none' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>All members</span>
                  <span style={{ background: globalSelectedMemberId === null ? 'var(--primary)' : 'var(--surface-muted)', color: globalSelectedMemberId === null ? 'var(--text-inverse)' : 'var(--text-muted)', padding: '1px 7px', borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-2xs)', fontWeight: 800 }}>
                    {purchases.length}
                  </span>
                </button>

                {/* 2. Specific Members from memberGroups */}
                {memberGroups.map((g) => {
                  const isSelected = globalSelectedMemberId === g.memberId;
                  const hasNew = g.newRequestsCount > 0;
                  const hasUtr = g.paymentSubmittedCount > 0;
                  return (
                    <button
                      key={g.memberId}
                      type="button"
                      onClick={() => setGlobalSelectedMemberId(isSelected ? null : g.memberId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px',
                        borderRadius: 'var(--radius-xl)',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: isSelected
                          ? '2px solid var(--primary)'
                          : hasNew
                          ? '1.5px solid var(--warning)'
                          : hasUtr
                          ? '1.5px solid var(--accent)'
                          : '1px solid var(--border-strong)',
                        background: isSelected
                          ? 'var(--primary-light)'
                          : hasNew
                          ? 'var(--warning-light)'
                          : hasUtr
                          ? 'var(--accent-light)'
                          : 'var(--surface)',
                        color: isSelected
                          ? 'var(--primary-hover)'
                          : hasNew
                          ? 'var(--warning-hover)'
                          : hasUtr
                          ? 'var(--accent-hover)'
                          : 'var(--text-body)',
                        whiteSpace: 'nowrap',
                        boxShadow: isSelected ? 'none' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{g.memberId} ({g.memberName})</span>
                      {hasNew && (
                        <span style={{ background: 'var(--warning)', color: 'var(--text-inverse)', padding: '1px 6px', borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-2xs)', fontWeight: 800 }}>
                          {g.newRequestsCount} NEW
                        </span>
                      )}
                      {hasUtr && (
                        <span style={{ background: 'var(--accent)', color: 'var(--text-inverse)', padding: '1px 6px', borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-2xs)', fontWeight: 800 }}>
                          {g.paymentSubmittedCount} UTR
                        </span>
                      )}
                      <span style={{ background: isSelected ? 'var(--primary)' : 'var(--surface-muted)', color: isSelected ? 'var(--text-inverse)' : 'var(--text-muted)', padding: '1px 6px', borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-2xs)', fontWeight: 800 }}>
                        {g.totalRequests}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Filter Banner if Member is Selected */}
          {globalSelectedMemberId && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--primary-light)',
                border: '1px solid var(--primary-border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 16px',
                marginBottom: '16px',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--fs-base)', color: 'var(--primary-strong)' }}>
                <User size={16} />
                <span>
                  Showing all steps for Member: <strong>{globalSelectedMemberGroup ? globalSelectedMemberGroup.memberName : globalSelectedMemberId}</strong> (ID: <strong>{globalSelectedMemberId}</strong>) • {globalTabCounts.all} Request{globalTabCounts.all > 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMemberId(globalSelectedMemberId);
                    setAdminViewMode('MEMBER_WORKSPACE');
                  }} className="btn btn-primary btn-sm">
                  Open in Workspace →
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalSelectedMemberId(null)} className="btn btn-secondary btn-sm">
                  Show all members
                </button>
              </div>
            </div>
          )}

          {/* 6 Step Tabs with Dynamic Counts */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
            {[
              { key: 'REQUESTED', label: '1. New Requests', icon: Clock, count: globalTabCounts.requested },
              { key: 'PAYMENT_SUBMITTED', label: '2. Payment Verification', icon: CreditCard, count: globalTabCounts.paymentSubmitted },
              { key: 'PAYMENT_INSTRUCTIONS_SENT', label: 'Awaiting Member Payment', icon: Send, count: globalTabCounts.awaitingPayment },
              { key: 'VERIFIED_AND_PAID', label: 'Paid & Completed', icon: CheckCircle2, count: globalTabCounts.verifiedAndPaid },
              { key: 'ALL', label: 'All Records', icon: FileText, count: globalTabCounts.all },
              { key: 'REJECTED', label: 'Rejected', icon: XCircle, count: globalTabCounts.rejected },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 15px',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: isActive ? 700 : 600,
                    fontSize: 'var(--fs-base)',
                    background: isActive ? 'var(--surface-inverse)' : 'var(--surface-subtle)',
                    color: isActive ? 'var(--text-inverse)' : 'var(--text-secondary)',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--text-main)' : 'var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <IconComponent size={15} />
                  <span>{tab.label}</span>
                  <span
                    style={{
                      padding: '1px 7px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 800,
                      background: isActive ? 'var(--text-body)' : 'var(--surface-sunken)',
                      color: isActive ? 'var(--text-inverse)' : 'var(--text-secondary)',
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Filters Bar */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
            <form onSubmit={handleSearchSubmit} style={{ flex: '1 1 300px', display: 'flex', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input
                type="text"
                placeholder="Search Member ID, Name, UTR / Txn No, or Order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-strong)',
                  fontSize: 'var(--fs-base)',
                  background: 'var(--surface)',
                }}
              />
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={15} style={{ color: 'var(--text-muted)' }} />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-strong)',
                  fontSize: 'var(--fs-base)',
                  background: 'var(--surface)',
                  color: 'var(--text-body)',
                }}
              >
                <option value="ALL">All Purchase Types</option>
                <option value="JOINING">Package Purchases</option>
                <option value="REPURCHASE">Product Repurchases</option>
              </select>
            </div>
          </div>

          {/* Cards List */}
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--success)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              Loading purchase requests...
            </div>
          ) : displayedGlobalPurchases.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <ShoppingCart size={40} style={{ color: 'var(--text-disabled)', margin: '0 auto 14px' }} />
              <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-body)', margin: '0 0 6px 0' }}>
                No purchase records found
              </h3>
              <p style={{ margin: '0 0 14px', fontSize: 'var(--fs-base)' }}>
                {globalSelectedMemberId
                  ? `No records in this step for Member ${globalSelectedMemberId}.`
                  : activeTab === 'REQUESTED'
                  ? 'No new requests awaiting payment details.'
                  : activeTab === 'PAYMENT_SUBMITTED'
                  ? 'No payments pending verification.'
                  : 'Try adjusting your search or tab filters.'}
              </p>
              {globalSelectedMemberId && (
                <button
                  type="button"
                  onClick={() => setGlobalSelectedMemberId(null)} className="btn btn-primary">
                  Show All Members' Records
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '18px' }}>
              {displayedGlobalPurchases.map((pur) => {
                const isPackage = pur.items.some((it) => it.itemType === 'PACKAGE');
                return (
                  <div
                    key={pur._id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    {/* Header: Order ID & Stage Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {pur.purchaseId}
                        </span>
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-light)', marginTop: '2px' }}>
                          {new Date(pur.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {stageBadge(pur.approvalStage)}
                    </div>

                    {/* Member Details */}
                    <div
                      style={{
                        background: 'var(--surface-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => setGlobalSelectedMemberId(pur.memberId)}
                            title={`Click to filter all pipeline steps for ${pur.memberId}`} className="btn btn-soft btn-sm">
                            {pur.memberId}
                          </button>
                          <button
                            type="button"
                            onClick={() => openMemberDossier(pur.memberId)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              fontSize: 'var(--fs-md)',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <User size={15} color="var(--text-light)" />
                            {pur.memberName || pur.memberId}
                          </button>
                        </div>
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '3px' }}>
                          {pur.memberMobile || pur.memberEmail || 'Registered Member'}
                        </div>
                      </div>
                      <button
                        onClick={() => openMemberDossier(pur.memberId)}
                        style={{
                          background: 'var(--info-soft)',
                          border: 'none',
                          color: 'var(--info-strong)',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--fs-xs)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        View Dossier
                      </button>
                    </div>

                    {/* Items Box */}
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isPackage ? <Package size={14} color="var(--warning)" /> : <ShoppingBag size={14} color="var(--success)" />}
                        {isPackage ? 'Package Details' : 'Product Order Items'}
                      </div>
                      {pur.items.map((it, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-base)', color: 'var(--text-strong)', marginBottom: '4px' }}>
                          <span>
                            {it.name} <strong style={{ color: 'var(--text-muted)' }}>× {it.quantity}</strong>
                          </span>
                          <span>₹ {it.totalPrice.toLocaleString()} ({it.totalBV.toLocaleString()} BV)</span>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px dashed var(--border-strong)', paddingTop: '8px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 'var(--fs-md)', color: 'var(--text-main)' }}>
                        <span>Total Payable</span>
                        <span style={{ color: 'var(--success)' }}>
                          ₹ {pur.totalAmount.toLocaleString()} <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>({pur.totalBV.toLocaleString()} BV)</span>
                        </span>
                      </div>
                    </div>

                    {/* Payment Submission Details (If submitted) */}
                    {pur.utrNumber && (
                      <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-strong)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Landmark size={14} /> Member Payment Submission
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: 'var(--fs-sm)' }}>
                          <div>
                            <span style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>UTR / Txn ID:</span>
                            <div style={{ fontWeight: 800, color: 'var(--accent-strong)', fontSize: 'var(--fs-base)' }}>{pur.utrNumber}</div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>Payer Name:</span>
                            <div style={{ fontWeight: 700, color: 'var(--accent-strong)' }}>{pur.payerName || '-'}</div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>Payment Mode:</span>
                            <div style={{ fontWeight: 700, color: 'var(--accent-strong)' }}>
                              {pur.paymentMethod === 'BV_WALLET' ? `BV Wallet (${(pur.bvAmount || 0).toLocaleString('en-IN')} BV)` : pur.paymentMode || 'UPI'}
                            </div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>Submitted At:</span>
                            <div style={{ color: 'var(--accent-strong)' }}>
                              {pur.paymentSubmittedAt ? new Date(pur.paymentSubmittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Rejection notice */}
                    {pur.rejectionReason && (
                      <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', padding: '10px', fontSize: 'var(--fs-sm)', color: 'var(--danger-strong)' }}>
                        <strong>Rejection Note:</strong> {pur.rejectionReason}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                      {isAdmin ? (
                        <>
                          {pur.approvalStage === 'REQUESTED' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedPurchase(pur);
                                  setIsSendInstructionsOpen(true);
                                }}
                                style={{
                                  flex: 1,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  background: 'var(--info)',
                                  color: 'var(--text-inverse)',
                                  border: 'none',
                                  padding: '10px',
                                  borderRadius: 'var(--radius-md)',
                                  fontWeight: 700,
                                  fontSize: 'var(--fs-base)',
                                  cursor: 'pointer',
                                }}
                              >
                                <Send size={15} /> Approve & Send Bank Details
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPurchase(pur);
                                  setIsRejectModalOpen(true);
                                }} className="btn btn-danger-outline">
                                Reject
                              </button>
                            </>
                          )}

                          {pur.approvalStage === 'PAYMENT_SUBMITTED' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedPurchase(pur);
                                  setIsVerifyModalOpen(true);
                                }} className="btn btn-success" style={{ flex: 1 }}>
                                <CheckCircle2 size={15} /> Verify & Mark as Paid
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPurchase(pur);
                                  setIsRejectModalOpen(true);
                                }} className="btn btn-danger-outline">
                                Reject
                              </button>
                            </>
                          )}

                          {pur.approvalStage === 'PAYMENT_INSTRUCTIONS_SENT' && (
                            <button
                              onClick={() => {
                                setSelectedPurchase(pur);
                                setIsVerifyModalOpen(true);
                              }} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                              Awaiting Member Payment (Manual Mark Paid)
                            </button>
                          )}

                          {pur.approvalStage === 'VERIFIED_AND_PAID' && (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--fs-sm)', color: 'var(--success)', fontWeight: 700 }}>
                              <CheckCircle2 size={16} /> Fully Verified & Volume Distributed
                            </div>
                          )}
                        </>
                      ) : (
                        /* Member Actions */
                        <>
                          {(pur.approvalStage === 'PAYMENT_INSTRUCTIONS_SENT' || pur.approvalStage === 'REQUESTED') && (
                            <button
                              onClick={() => {
                                setSelectedPurchase(pur);
                                setMemberUtr('');
                                setMemberPayerName(user?.name || '');
                                setIsSubmitPaymentModalOpen(true);
                              }}
                              style={{
                                flex: 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                background: 'var(--accent)',
                                color: 'var(--text-inverse)',
                                border: 'none',
                                padding: '10px',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: 700,
                                fontSize: 'var(--fs-base)',
                                cursor: 'pointer',
                              }}
                            >
                              <CreditCard size={15} /> Make Payment & Submit UTR
                            </button>
                          )}

                          {pur.approvalStage === 'PAYMENT_SUBMITTED' && (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--fs-sm)', color: 'var(--accent-hover)', fontWeight: 700 }}>
                              <Clock size={16} /> Payment Proof Submitted • Verification in Progress
                            </div>
                          )}

                          {pur.approvalStage === 'VERIFIED_AND_PAID' && (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--fs-sm)', color: 'var(--success)', fontWeight: 700 }}>
                              <CheckCircle2 size={16} /> Order Completed • Volume & Benefits Credited
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* ACTION MODALS                                            */}
      {/* ======================================================== */}

      {/* Modal 1: Approve & Send Payment Instructions */}
      <Modal
        open={isSendInstructionsOpen && !!selectedPurchase}
        onClose={() => setIsSendInstructionsOpen(false)}
        dismissible={!actionLoading}
        title="Send payment instructions"
        footer={
          <>
            <button type="button" onClick={() => setIsSendInstructionsOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" disabled={actionLoading} onClick={handleSendInstructions} className="btn btn-primary">
              <Send size={16} />
              {actionLoading ? 'Sending…' : 'Approve & send to member'}
            </button>
          </>
        }
      >
        {selectedPurchase && (
          <>
            <p className="form-hint" style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-base)' }}>
              Approving the request for <strong>{selectedPurchase.memberName || selectedPurchase.memberId}</strong>. The
              company bank details, UPI ID and QR code from Company Account are attached automatically.
            </p>
            <div className="detail-list stat-panel is-muted" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-2) var(--space-4)' }}>
              <div className="detail-row"><span>Items</span><span>{selectedPurchase.items.map((i) => i.name).join(', ')}</span></div>
              <div className="detail-row"><span>Order amount</span><span>₹ {selectedPurchase.totalAmount.toLocaleString()}</span></div>
              <div className="detail-row"><span>Business volume</span><span>{selectedPurchase.totalBV.toLocaleString()} BV</span></div>
            </div>
            <Field label="Instruction note" hint="Optional" htmlFor="pr-instruction-note">
              <textarea
                id="pr-instruction-note"
                rows={3}
                className="form-textarea"
                placeholder="e.g. Please pay via UPI or IMPS and enter the 12-digit UTR in your portal."
                value={adminInstructionNote}
                onChange={(e) => setAdminInstructionNote(e.target.value)}
              />
            </Field>
          </>
        )}
      </Modal>

      {/* Modal 2: Verify & Mark as Paid */}
      <Modal
        open={isVerifyModalOpen && !!selectedPurchase}
        onClose={() => setIsVerifyModalOpen(false)}
        dismissible={!actionLoading}
        title="Verify payment & activate"
        footer={
          <>
            <button type="button" onClick={() => setIsVerifyModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" disabled={actionLoading} onClick={handleVerifyAndPay} className="btn btn-success">
              <CheckCircle2 size={16} />
              {actionLoading ? 'Activating…' : 'Confirm & mark paid'}
            </button>
          </>
        }
      >
        {selectedPurchase && (
          <>
            <p className="form-hint" style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-base)' }}>
              This marks the order as <strong>paid</strong>, credits <strong>{selectedPurchase.totalBV.toLocaleString()} BV</strong> to{' '}
              <strong>{selectedPurchase.memberName || selectedPurchase.memberId}</strong>, activates package capping and
              distributes binary volume.
            </p>
            <div className="detail-list stat-panel" style={{ padding: 'var(--space-2) var(--space-4)', borderColor: 'var(--success-border)', background: 'var(--success-light)' }}>
              <div className="detail-row"><span>Bank UTR / Txn ID</span><span className="text-mono">{selectedPurchase.utrNumber || 'Manual Super Admin Verification'}</span></div>
              <div className="detail-row"><span>Payer name</span><span>{selectedPurchase.payerName || selectedPurchase.memberName || '-'}</span></div>
              <div className="detail-row"><span>Total received</span><span>₹ {selectedPurchase.totalAmount.toLocaleString()}</span></div>
              <div className="detail-row"><span>Volume to credit</span><span>{selectedPurchase.totalBV.toLocaleString()} BV</span></div>
            </div>
          </>
        )}
      </Modal>

      {/* Modal 3: Reject Purchase Request */}
      <Modal
        open={isRejectModalOpen && !!selectedPurchase}
        onClose={() => setIsRejectModalOpen(false)}
        dismissible={!actionLoading}
        size="sm"
        title="Reject purchase request"
        subtitle={selectedPurchase ? `Order ${selectedPurchase.purchaseId}` : undefined}
        footer={
          <>
            <button type="button" onClick={() => setIsRejectModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" disabled={actionLoading} onClick={handleReject} className="btn btn-danger">
              {actionLoading ? 'Rejecting…' : 'Confirm rejection'}
            </button>
          </>
        }
      >
        <Field label="Rejection reason" required htmlFor="pr-reject-reason">
          <textarea
            id="pr-reject-reason"
            rows={3}
            className="form-textarea"
            placeholder="e.g. UTR does not match our bank statement, or payment is short."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
        </Field>
      </Modal>

      {/* Modal 4: Member purchase history */}
      <Modal
        open={!!dossierMemberId}
        onClose={() => setDossierMemberId(null)}
        size="lg"
        title="Member purchase history"
        subtitle={<>Lifetime purchases, package upgrades and requests for <strong>{dossierData?.member?.name || dossierMemberId}</strong></>}
        footer={
          <button type="button" onClick={() => setDossierMemberId(null)} className="btn btn-secondary">
            Close
          </button>
        }
      >
        {dossierLoading ? (
          <LoadingState label="Loading member history…" />
        ) : dossierData ? (
          <>
            <div className="stat-panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))' }}>
              <div className="stat-panel is-muted">
                <div className="stat-panel-label">Current package</div>
                <div className="stat-panel-value" style={{ fontSize: 'var(--fs-lg)' }}>{dossierData.member?.currentPackage || 'None'}</div>
                <div className="form-hint">Cap ₹{(dossierData.member?.dailyCapping || 0).toLocaleString()}/day</div>
              </div>
              <div className="stat-panel is-muted">
                <div className="stat-panel-label">Lifetime requests</div>
                <div className="stat-panel-value" style={{ fontSize: 'var(--fs-lg)' }}>{dossierData.summary?.totalRequests || 0} orders</div>
                <div className="form-hint">{dossierData.summary?.packageRequestsCount} packages · {dossierData.summary?.productRequestsCount} products</div>
              </div>
              <div className="stat-panel is-muted">
                <div className="stat-panel-label">Total paid</div>
                <div className="stat-panel-value" style={{ fontSize: 'var(--fs-lg)', color: 'var(--success)' }}>₹ {(dossierData.summary?.totalSpent || 0).toLocaleString()}</div>
                <div className="form-hint">Lifetime settlements</div>
              </div>
              <div className="stat-panel is-muted">
                <div className="stat-panel-label">BV credited</div>
                <div className="stat-panel-value" style={{ fontSize: 'var(--fs-lg)' }}>{(dossierData.summary?.totalBvCredited || 0).toLocaleString()} BV</div>
                <div className="form-hint">Personal volume added</div>
              </div>
            </div>

            <h4 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>Request history</h4>
            {dossierData.history?.length === 0 ? (
              <EmptyState compact title="No requests recorded" text="This member has no purchase requests yet." />
            ) : (
              <div className="table-responsive table-framed">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Order ID</th>
                      <th>Type & Items</th>
                      <th>Amount / BV</th>
                      <th>UTR / Reference</th>
                      <th>Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossierData.history.map((h: any) => (
                      <tr key={h._id}>
                        <td className="nowrap" style={{ color: 'var(--text-muted)' }}>
                          {new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="text-mono">{h.purchaseId}</td>
                        <td>
                          <Badge tone={h.items[0]?.itemType === 'PACKAGE' ? 'warning' : 'success'}>
                            {h.items[0]?.itemType === 'PACKAGE' ? 'Package' : 'Product'}
                          </Badge>{' '}
                          {h.items.map((i: any) => `${i.name} (x${i.quantity})`).join(', ')}
                        </td>
                        <td className="nowrap" style={{ fontWeight: 600 }}>
                          ₹ {h.totalAmount.toLocaleString()} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {h.totalBV.toLocaleString()} BV</span>
                        </td>
                        <td className="text-mono">{h.utrNumber || '-'}</td>
                        <td>{stageBadge(h.approvalStage)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </Modal>

      {/* Modal 5: Member Submit Payment Details */}
      <Modal
        open={isSubmitPaymentModalOpen && !!selectedPurchase}
        onClose={() => setIsSubmitPaymentModalOpen(false)}
        dismissible={!actionLoading}
        title="Submit payment details"
      >
        {selectedPurchase && (() => {
          const acct = selectedPurchase.companyAccountSnapshot;
          const hasAccount = Boolean(acct?.accountNumber || acct?.upiId);
          return (
            <>
              <div className="stat-panel is-muted" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="icon-text" style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: 'var(--space-2)' }}>
                  <Landmark size={15} /> Company deposit account
                </div>
                {hasAccount ? (
                  <div className="detail-list">
                    <div className="detail-row"><span>Bank</span><span>{acct?.bankName || '—'}</span></div>
                    <div className="detail-row"><span>Account no.</span><span className="text-mono">{acct?.accountNumber || '—'}</span></div>
                    <div className="detail-row"><span>IFSC</span><span className="text-mono">{acct?.ifscCode || '—'}</span></div>
                    <div className="detail-row"><span>UPI ID</span><span className="text-mono">{acct?.upiId || '—'}</span></div>
                  </div>
                ) : (
                  <Alert tone="warning" style={{ marginBottom: 0 }}>
                    Company payment details were not attached to this order. Check <strong>Company Bank & QR</strong> or
                    contact support before paying.
                  </Alert>
                )}
              </div>

              <form onSubmit={handleMemberSubmitPayment} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Field label="Bank UTR / transaction ID" required htmlFor="pr-utr">
                  <input
                    id="pr-utr"
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. 423456789012 or UPI reference"
                    value={memberUtr}
                    onChange={(e) => setMemberUtr(e.target.value)}
                  />
                </Field>
                <Field label="Payer full name" required htmlFor="pr-payer">
                  <input
                    id="pr-payer"
                    type="text"
                    required
                    className="form-input"
                    placeholder="Name on the bank / UPI account"
                    value={memberPayerName}
                    onChange={(e) => setMemberPayerName(e.target.value)}
                  />
                </Field>
                <Field label="Payment mode" htmlFor="pr-mode">
                  <select id="pr-mode" className="form-select" value={memberPaymentMode} onChange={(e) => setMemberPaymentMode(e.target.value)}>
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="IMPS">IMPS instant bank transfer</option>
                    <option value="NEFT">NEFT bank transfer</option>
                    <option value="QR_SCAN">QR code scan</option>
                    <option value="NET_BANKING">Net banking</option>
                  </select>
                </Field>
                <div className="form-actions" style={{ marginTop: 0 }}>
                  <button type="button" onClick={() => setIsSubmitPaymentModalOpen(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={actionLoading} className="btn btn-primary">
                    <CreditCard size={16} />
                    {actionLoading ? 'Submitting…' : 'Submit payment proof'}
                  </button>
                </div>
              </form>
            </>
          );
        })()}
      </Modal>
    </div>
  );
};

export default PurchaseRequestsPage;
