import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  ShoppingBag,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Send,
  Search,
  Filter,
  RefreshCw,
  Landmark,
  User,
  FileText,
  X,
  CreditCard,
  Copy,
  Check,
  Users,
  Layers,
  Phone,
  Mail,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
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
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin';
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
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
            <Clock size={13} /> New Request
          </span>
        );
      case 'PAYMENT_INSTRUCTIONS_SENT':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
            <Send size={13} /> Payment Details Sent
          </span>
        );
      case 'PAYMENT_SUBMITTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#ede9fe', color: '#6d28d9', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
            <CreditCard size={13} /> Verify UTR
          </span>
        );
      case 'VERIFIED_AND_PAID':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
            <CheckCircle2 size={13} /> Paid & Volume Credited
          </span>
        );
      case 'REJECTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#fef2f2', color: '#b91c1c', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
            <XCircle size={13} /> Rejected
          </span>
        );
      default:
        return <span>{stage}</span>;
    }
  };

  const actionNeededCount = memberGroups.filter((g) => g.newRequestsCount > 0 || g.paymentSubmittedCount > 0).length;
  const newRequestsMembersCount = memberGroups.filter((g) => g.newRequestsCount > 0).length;
  const verifyUtrMembersCount = memberGroups.filter((g) => g.paymentSubmittedCount > 0).length;

  return (
    <div className="page-body">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '22px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Package & Product Purchase Requests
              </h1>
              <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Verify member purchase requests, dispatch company payment instructions, audit UTR payments, and credit business volume.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isAdmin && (
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setAdminViewMode('MEMBER_WORKSPACE')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: adminViewMode === 'MEMBER_WORKSPACE' ? '#ffffff' : 'transparent',
                  color: adminViewMode === 'MEMBER_WORKSPACE' ? '#2563eb' : '#64748b',
                  boxShadow: adminViewMode === 'MEMBER_WORKSPACE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Users size={14} />
                <span>Member Workspace</span>
                {actionNeededCount > 0 && (
                  <span style={{ background: '#f59e0b', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '9999px', fontWeight: 800 }}>
                    {actionNeededCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setAdminViewMode('GLOBAL_PIPELINE')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: adminViewMode === 'GLOBAL_PIPELINE' ? '#ffffff' : 'transparent',
                  color: adminViewMode === 'GLOBAL_PIPELINE' ? '#2563eb' : '#64748b',
                  boxShadow: adminViewMode === 'GLOBAL_PIPELINE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Layers size={14} />
                <span>Global Pipeline View</span>
              </button>
            </div>
          )}

          <button
            onClick={fetchPurchases}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              padding: '9px 15px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '13px',
              color: '#334155',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Orders'}
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? '#f0fdf4' : '#fff1f2',
            border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecdd3'}`,
            color: feedback.type === 'success' ? '#166534' : '#9f1239',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. SUPER ADMIN MEMBER-CENTRIC WORKSPACE (MASTER-DETAIL)   */}
      {/* ======================================================== */}
      {isAdmin && adminViewMode === 'MEMBER_WORKSPACE' ? (
        <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          {/* Mobile Navigation Tabs (< 1024px) */}
          {isMobile && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: '100%', boxSizing: 'border-box' }}>
              <button
                type="button"
                onClick={() => setMobileActivePane('QUEUE')}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: mobileActivePane === 'QUEUE' ? '#ffffff' : 'transparent',
                  color: mobileActivePane === 'QUEUE' ? '#0f172a' : '#64748b',
                  boxShadow: mobileActivePane === 'QUEUE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <Users size={14} />
                <span>Queue ({memberGroups.length})</span>
                {actionNeededCount > 0 && (
                  <span style={{ background: '#f59e0b', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '9999px', fontWeight: 800 }}>
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
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: mobileActivePane === 'DETAILS' ? '#2563eb' : 'transparent',
                  color: mobileActivePane === 'DETAILS' ? '#ffffff' : selectedMemberGroup ? '#64748b' : '#cbd5e1',
                  boxShadow: mobileActivePane === 'DETAILS' ? '0 1px 3px rgba(37,99,235,0.3)' : 'none',
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
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
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
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} className="text-blue-600" />
                  <span>Member Queue</span>
                </h3>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                  {memberGroups.length} Members
                </span>
              </div>

              {/* Member Search */}
              <div style={{ position: 'relative', marginTop: '6px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search Member ID, Name, Phone..."
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
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
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: memberFilterType === 'ALL' ? '#0f172a' : '#f1f5f9',
                  color: memberFilterType === 'ALL' ? '#fff' : '#64748b',
                }}
              >
                All ({memberGroups.length})
              </button>

              <button
                onClick={() => setMemberFilterType('ACTION_NEEDED')}
                style={{
                  padding: '4px 9px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: memberFilterType === 'ACTION_NEEDED' ? '#dc2626' : '#fee2e2',
                  color: memberFilterType === 'ACTION_NEEDED' ? '#fff' : '#b91c1c',
                }}
              >
                ⚡ Action Needed ({actionNeededCount})
              </button>

              <button
                onClick={() => setMemberFilterType('NEW_REQUESTS')}
                style={{
                  padding: '4px 9px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: memberFilterType === 'NEW_REQUESTS' ? '#d97706' : '#fef3c7',
                  color: memberFilterType === 'NEW_REQUESTS' ? '#fff' : '#b45309',
                }}
              >
                New ({newRequestsMembersCount})
              </button>

              <button
                onClick={() => setMemberFilterType('VERIFY_UTR')}
                style={{
                  padding: '4px 9px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: memberFilterType === 'VERIFY_UTR' ? '#7c3aed' : '#ede9fe',
                  color: memberFilterType === 'VERIFY_UTR' ? '#fff' : '#6d28d9',
                }}
              >
                Verify UTR ({verifyUtrMembersCount})
              </button>
            </div>

            {/* Scrollable Members List */}
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
              {loading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  Loading members queue...
                </div>
              ) : filteredMemberGroups.length === 0 ? (
                <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                  No members matching this filter.
                </div>
              ) : (
                filteredMemberGroups.map((group) => {
                  const isSelected = selectedMemberId === group.memberId;
                  const hasNewRequest = group.newRequestsCount > 0;
                  const hasVerifyUtr = group.paymentSubmittedCount > 0;
                  const hasAwaiting = group.awaitingPaymentCount > 0;

                  // Dynamic Card Styling based on status
                  let borderStyle = '1px solid #e2e8f0';
                  let bgStyle = '#ffffff';

                  if (hasNewRequest) {
                    borderStyle = '2px solid #f59e0b';
                    bgStyle = '#fffdf5';
                  } else if (hasVerifyUtr) {
                    borderStyle = '2px solid #8b5cf6';
                    bgStyle = '#faf5ff';
                  } else if (hasAwaiting) {
                    borderStyle = '1px solid #bfdbfe';
                    bgStyle = '#f0f9ff';
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
                        borderRadius: '12px',
                        border: isSelected ? '2px solid #2563eb' : borderStyle,
                        background: isSelected ? '#eff6ff' : bgStyle,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 4px 14px rgba(37,99,235,0.18)' : '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              color: hasNewRequest ? '#b45309' : hasVerifyUtr ? '#6d28d9' : '#1e3a8a',
                              background: hasNewRequest ? '#fef3c7' : hasVerifyUtr ? '#ede9fe' : '#e0f2fe',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              letterSpacing: '0.4px',
                            }}
                          >
                            {group.memberId}
                          </span>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
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
                                background: '#f59e0b',
                                color: '#ffffff',
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '9999px',
                                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.4)',
                              }}
                            >
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff' }} />
                              NEW ({group.newRequestsCount})
                            </span>
                          )}

                          {hasVerifyUtr && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#8b5cf6',
                                color: '#ffffff',
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '9999px',
                                boxShadow: '0 2px 6px rgba(139, 92, 246, 0.4)',
                              }}
                            >
                              VERIFY UTR ({group.paymentSubmittedCount})
                            </span>
                          )}

                          {!hasNewRequest && !hasVerifyUtr && hasAwaiting && (
                            <span
                              style={{
                                background: '#e0f2fe',
                                color: '#0369a1',
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              Awaiting Payment
                            </span>
                          )}

                          {!hasNewRequest && !hasVerifyUtr && !hasAwaiting && (
                            <span
                              style={{
                                background: '#ecfdf5',
                                color: '#059669',
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              ✓ Settled
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
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
                  onClick={() => setMobileActivePane('QUEUE')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#1e293b',
                    cursor: 'pointer',
                    marginBottom: '14px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>← Back to Member Queue</span>
                </button>
              )}

              {!selectedMemberGroup ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                  <Users size={40} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#334155', margin: '0 0 6px 0' }}>No member selected</h3>
                  <p style={{ margin: 0, fontSize: '13px' }}>Select a member from the queue on the left to review their purchase pipeline.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Member Header Card */}
                  <div
                    style={{
                      background: '#ffffff',
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
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
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        fontWeight: 900,
                        boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                      }}
                    >
                      {selectedMemberGroup.memberName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          {selectedMemberGroup.memberName}
                        </h2>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px' }}>
                          {selectedMemberGroup.memberId}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
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

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end', width: isMobile ? '100%' : 'auto', gap: '12px', borderTop: isMobile ? '1px solid #f1f5f9' : 'none', paddingTop: isMobile ? '12px' : 0 }}>
                    <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Volume & Purchases</div>
                      <div style={{ fontSize: isMobile ? '13px' : '15px', fontWeight: 800, color: '#059669' }}>
                        +{selectedMemberGroup.totalBVSum.toLocaleString()} BV • ₹{selectedMemberGroup.totalAmountSum.toLocaleString()}
                      </div>
                    </div>

                    <button
                      onClick={() => openMemberDossier(selectedMemberGroup.memberId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 15px',
                        background: '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.25)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <FileText size={14} />
                      <span>Lifetime Dossier</span>
                    </button>
                  </div>
                </div>

                {/* Section 1: Actionable / Active Requests Pipeline */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Sparkles size={16} className="text-amber-500" />
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Active Requests Pipeline ({selectedMemberGroup.requests.filter((r) => r.approvalStage !== 'VERIFIED_AND_PAID' && r.approvalStage !== 'REJECTED').length})
                    </h3>
                  </div>

                  {selectedMemberGroup.requests.filter((r) => r.approvalStage !== 'VERIFIED_AND_PAID' && r.approvalStage !== 'REJECTED').length === 0 ? (
                    <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', textAlign: 'center', color: '#64748b' }}>
                      <CheckCircle2 size={32} style={{ color: '#10b981', margin: '0 auto 8px' }} />
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>All caught up!</div>
                      <p style={{ margin: '4px 0 0', fontSize: '12px' }}>No pending requests requiring action for this member.</p>
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
                                background: '#ffffff',
                                borderRadius: '16px',
                                border: pur.approvalStage === 'REQUESTED'
                                  ? '2px solid #f59e0b'
                                  : pur.approvalStage === 'PAYMENT_SUBMITTED'
                                  ? '2px solid #8b5cf6'
                                  : '1px solid #cbd5e1',
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
                                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                                      Order #{pur.purchaseId}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        color: isPackage ? '#b45309' : '#047857',
                                        background: isPackage ? '#fef3c7' : '#ecfdf5',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      {isPackage ? 'Package Joining/Upgrade' : 'Product Repurchase'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                                    Requested on {new Date(pur.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#059669' }}>
                                    ₹ {pur.totalAmount.toLocaleString()}
                                  </div>
                                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>
                                    +{pur.totalBV.toLocaleString()} BV
                                  </div>
                                </div>
                              </div>

                              {/* Interactive 4-Step Pipeline Stepper */}
                              <div
                                style={{
                                  background: '#f8fafc',
                                  borderRadius: '12px',
                                  padding: isMobile ? '10px 8px' : '14px 18px',
                                  border: '1px solid #e2e8f0',
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
                                          background: st.done ? '#10b981' : st.active ? '#2563eb' : '#e2e8f0',
                                          color: st.done || st.active ? '#ffffff' : '#64748b',
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
                                      <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: 800, color: st.active ? '#1e3a8a' : '#475569', lineHeight: 1.2 }}>
                                        {st.title}
                                      </div>
                                      <div style={{ fontSize: isMobile ? '8px' : '10px', color: '#94a3b8', lineHeight: 1.2, marginTop: '2px' }}>
                                        {st.desc}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Items Breakdown */}
                              <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', padding: '12px 14px', background: '#ffffff' }}>
                                <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                                  Requested Items
                                </div>
                                {pur.items.map((it, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                                    <span>
                                      {it.name} <strong style={{ color: '#64748b' }}>× {it.quantity}</strong>
                                    </span>
                                    <span>₹ {it.totalPrice.toLocaleString()} ({it.totalBV.toLocaleString()} BV)</span>
                                  </div>
                                ))}
                              </div>

                              {/* STAGE ACTION PANEL */}
                              {pur.approvalStage === 'REQUESTED' && (
                                <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: '12px', padding: '16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 800, fontSize: '13px', marginBottom: '6px' }}>
                                    <Clock size={16} />
                                    <span>Step 1: Super Admin Action Required</span>
                                  </div>
                                  <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#78350f', lineHeight: '1.5' }}>
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
                                        background: '#0284c7',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Send size={15} /> Approve & Dispatch Payment Details
                                    </button>

                                    <button
                                      onClick={() => {
                                        setSelectedPurchase(pur);
                                        setIsRejectModalOpen(true);
                                      }}
                                      style={{
                                        padding: '10px 16px',
                                        background: '#fee2e2',
                                        color: '#b91c1c',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              )}

                              {pur.approvalStage === 'PAYMENT_INSTRUCTIONS_SENT' && (
                                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0369a1', fontWeight: 800, fontSize: '13px', marginBottom: '6px' }}>
                                    <Send size={16} />
                                    <span>Step 2: Awaiting Member Payment & UTR</span>
                                  </div>
                                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#0369a1', lineHeight: '1.5' }}>
                                    Company bank details and UPI instructions were sent. Waiting for <strong>{selectedMemberGroup.memberName}</strong> to transfer funds and submit their transaction reference UTR.
                                  </p>
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                      onClick={() => {
                                        setSelectedPurchase(pur);
                                        setIsVerifyModalOpen(true);
                                      }}
                                      style={{
                                        padding: '8px 14px',
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        color: '#334155',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Manual Verification / Mark Paid
                                    </button>
                                  </div>
                                </div>
                              )}

                              {pur.approvalStage === 'PAYMENT_SUBMITTED' && (
                                <div style={{ background: '#faf5ff', border: '1.5px solid #8b5cf6', borderRadius: '12px', padding: '16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6d28d9', fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>
                                    <CreditCard size={18} />
                                    <span>Step 3: Verify Payment Proof (UTR)</span>
                                  </div>
                                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#581c87' }}>
                                    Member has completed the transfer and submitted the payment proof below. Verify with company bank statements.
                                  </p>

                                  {/* Submitted Proof Card */}
                                  <div
                                    style={{
                                      background: '#ffffff',
                                      border: '1px solid #e9d5ff',
                                      borderRadius: '10px',
                                      padding: '14px',
                                      marginBottom: '14px',
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                      gap: '12px',
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontSize: '10px', color: '#7e22ce', fontWeight: 800, textTransform: 'uppercase' }}>UTR / Reference ID</div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 900, color: '#3b0764', fontFamily: 'monospace' }}>
                                          {pur.utrNumber}
                                        </span>
                                        <button
                                          onClick={() => handleCopyUtr(pur.utrNumber || '')}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', padding: 0 }}
                                          title="Copy UTR"
                                        >
                                          {copiedUtr === pur.utrNumber ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                        </button>
                                      </div>
                                    </div>

                                    <div>
                                      <div style={{ fontSize: '10px', color: '#7e22ce', fontWeight: 800, textTransform: 'uppercase' }}>Payer Name</div>
                                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#3b0764', marginTop: '2px' }}>
                                        {pur.payerName || selectedMemberGroup.memberName}
                                      </div>
                                    </div>

                                    <div>
                                      <div style={{ fontSize: '10px', color: '#7e22ce', fontWeight: 800, textTransform: 'uppercase' }}>Mode</div>
                                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#3b0764', marginTop: '2px' }}>
                                        {pur.paymentMode || 'UPI'}
                                      </div>
                                    </div>

                                    <div>
                                      <div style={{ fontSize: '10px', color: '#7e22ce', fontWeight: 800, textTransform: 'uppercase' }}>Submitted At</div>
                                      <div style={{ fontSize: '12px', color: '#581c87', marginTop: '2px' }}>
                                        {pur.paymentSubmittedAt ? new Date(pur.paymentSubmittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                      onClick={() => {
                                        setSelectedPurchase(pur);
                                        setIsVerifyModalOpen(true);
                                      }}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '10px 20px',
                                        background: '#059669',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 800,
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
                                      }}
                                    >
                                      <CheckCircle2 size={16} /> Verify UTR & Mark as Paid
                                    </button>

                                    <button
                                      onClick={() => {
                                        setSelectedPurchase(pur);
                                        setIsRejectModalOpen(true);
                                      }}
                                      style={{
                                        padding: '10px 16px',
                                        background: '#fee2e2',
                                        color: '#b91c1c',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                      }}
                                    >
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
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Settled Requests History ({selectedMemberGroup.requests.filter((r) => r.approvalStage === 'VERIFIED_AND_PAID' || r.approvalStage === 'REJECTED').length})
                    </h3>
                  </div>

                  {selectedMemberGroup.requests.filter((r) => r.approvalStage === 'VERIFIED_AND_PAID' || r.approvalStage === 'REJECTED').length === 0 ? (
                    <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      No previous settled purchases for this member yet.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                            <th style={{ padding: '10px 14px' }}>Date</th>
                            <th style={{ padding: '10px 14px' }}>Order ID</th>
                            <th style={{ padding: '10px 14px' }}>Item Details</th>
                            <th style={{ padding: '10px 14px' }}>Amount / BV</th>
                            <th style={{ padding: '10px 14px' }}>UTR / Reference</th>
                            <th style={{ padding: '10px 14px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedMemberGroup.requests
                            .filter((r) => r.approvalStage === 'VERIFIED_AND_PAID' || r.approvalStage === 'REJECTED')
                            .map((h) => (
                              <tr key={h._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 14px', color: '#64748b' }}>
                                  {new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                                  {h.purchaseId}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span style={{ fontWeight: 700, color: h.items[0]?.itemType === 'PACKAGE' ? '#b45309' : '#047857' }}>
                                    [{h.items[0]?.itemType === 'PACKAGE' ? 'PACKAGE' : 'PRODUCT'}]
                                  </span>{' '}
                                  {h.items.map((it) => `${it.name} (x${it.quantity})`).join(', ')}
                                </td>
                                <td style={{ padding: '10px 14px', fontWeight: 800 }}>
                                  ₹ {h.totalAmount.toLocaleString()} <span style={{ color: '#0284c7' }}>({h.totalBV.toLocaleString()} BV)</span>
                                </td>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#581c87' }}>
                                  {h.utrNumber || '-'}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
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
            <div style={{ marginBottom: '18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} className="text-blue-600" />
                  <span>Filter by Member:</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'none' }}>
                    (Click any Member to view their requests across all 6 steps)
                  </span>
                </div>
                {globalSelectedMemberId && (
                  <button
                    type="button"
                    onClick={() => setGlobalSelectedMemberId(null)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#2563eb',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '4px 10px',
                    }}
                  >
                    ✕ Show All Members
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
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: globalSelectedMemberId === null ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: globalSelectedMemberId === null ? '#eff6ff' : '#ffffff',
                    color: globalSelectedMemberId === null ? '#1d4ed8' : '#475569',
                    whiteSpace: 'nowrap',
                    boxShadow: globalSelectedMemberId === null ? '0 2px 6px rgba(37,99,235,0.15)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>🌐 All Members</span>
                  <span style={{ background: globalSelectedMemberId === null ? '#2563eb' : '#f1f5f9', color: globalSelectedMemberId === null ? '#fff' : '#64748b', padding: '1px 7px', borderRadius: '9999px', fontSize: '10px', fontWeight: 800 }}>
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
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: isSelected
                          ? '2px solid #2563eb'
                          : hasNew
                          ? '1.5px solid #f59e0b'
                          : hasUtr
                          ? '1.5px solid #8b5cf6'
                          : '1px solid #cbd5e1',
                        background: isSelected
                          ? '#eff6ff'
                          : hasNew
                          ? '#fffdf5'
                          : hasUtr
                          ? '#faf5ff'
                          : '#ffffff',
                        color: isSelected
                          ? '#1d4ed8'
                          : hasNew
                          ? '#b45309'
                          : hasUtr
                          ? '#6d28d9'
                          : '#334155',
                        whiteSpace: 'nowrap',
                        boxShadow: isSelected ? '0 2px 6px rgba(37,99,235,0.15)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>👤 {g.memberId} ({g.memberName})</span>
                      {hasNew && (
                        <span style={{ background: '#f59e0b', color: '#fff', padding: '1px 6px', borderRadius: '9999px', fontSize: '10px', fontWeight: 800 }}>
                          {g.newRequestsCount} NEW
                        </span>
                      )}
                      {hasUtr && (
                        <span style={{ background: '#8b5cf6', color: '#fff', padding: '1px 6px', borderRadius: '9999px', fontSize: '10px', fontWeight: 800 }}>
                          {g.paymentSubmittedCount} UTR
                        </span>
                      )}
                      <span style={{ background: isSelected ? '#2563eb' : '#f1f5f9', color: isSelected ? '#fff' : '#64748b', padding: '1px 6px', borderRadius: '9999px', fontSize: '10px', fontWeight: 800 }}>
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
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                padding: '10px 16px',
                marginBottom: '16px',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1e40af' }}>
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
                  }}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Open in Workspace →
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalSelectedMemberId(null)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ✕ Show All Members
                </button>
              </div>
            </div>
          )}

          {/* 6 Step Tabs with Dynamic Counts */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
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
                    borderRadius: '8px',
                    fontWeight: isActive ? 700 : 600,
                    fontSize: '13px',
                    background: isActive ? '#0f172a' : '#f8fafc',
                    color: isActive ? '#ffffff' : '#475569',
                    border: '1px solid',
                    borderColor: isActive ? '#0f172a' : '#e2e8f0',
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
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 800,
                      background: isActive ? '#334155' : '#e2e8f0',
                      color: isActive ? '#ffffff' : '#475569',
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
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search Member ID, Name, UTR / Txn No, or Order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  background: '#fff',
                }}
              />
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={15} style={{ color: '#64748b' }} />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  background: '#fff',
                  color: '#334155',
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
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              Loading purchase requests...
            </div>
          ) : displayedGlobalPurchases.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              <ShoppingCart size={40} style={{ color: '#cbd5e1', margin: '0 auto 14px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#334155', margin: '0 0 6px 0' }}>
                No purchase records found
              </h3>
              <p style={{ margin: '0 0 14px', fontSize: '13px' }}>
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
                  onClick={() => setGlobalSelectedMemberId(null)}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
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
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
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
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {pur.purchaseId}
                        </span>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                          {new Date(pur.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {stageBadge(pur.approvalStage)}
                    </div>

                    {/* Member Details */}
                    <div
                      style={{
                        background: '#f8fafc',
                        borderRadius: '8px',
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
                            title={`Click to filter all pipeline steps for ${pur.memberId}`}
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1d4ed8',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            {pur.memberId}
                          </button>
                          <button
                            type="button"
                            onClick={() => openMemberDossier(pur.memberId)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              fontSize: '14px',
                              fontWeight: 700,
                              color: '#0f172a',
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <User size={15} className="text-slate-400" />
                            {pur.memberName || pur.memberId}
                          </button>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                          {pur.memberMobile || pur.memberEmail || 'Registered Member'}
                        </div>
                      </div>
                      <button
                        onClick={() => openMemberDossier(pur.memberId)}
                        style={{
                          background: '#e0f2fe',
                          border: 'none',
                          color: '#0369a1',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        View Dossier
                      </button>
                    </div>

                    {/* Items Box */}
                    <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isPackage ? <Package size={14} className="text-amber-500" /> : <ShoppingBag size={14} className="text-emerald-500" />}
                        {isPackage ? 'Package Details' : 'Product Order Items'}
                      </div>
                      {pur.items.map((it, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                          <span>
                            {it.name} <strong style={{ color: '#64748b' }}>× {it.quantity}</strong>
                          </span>
                          <span>₹ {it.totalPrice.toLocaleString()} ({it.totalBV.toLocaleString()} BV)</span>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                        <span>Total Payable</span>
                        <span style={{ color: '#059669' }}>
                          ₹ {pur.totalAmount.toLocaleString()} <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>({pur.totalBV.toLocaleString()} BV)</span>
                        </span>
                      </div>
                    </div>

                    {/* Payment Submission Details (If submitted) */}
                    {pur.utrNumber && (
                      <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b21a8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Landmark size={14} /> Member Payment Submission
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                          <div>
                            <span style={{ color: '#7e22ce', fontWeight: 600 }}>UTR / Txn ID:</span>
                            <div style={{ fontWeight: 800, color: '#3b0764', fontSize: '13px' }}>{pur.utrNumber}</div>
                          </div>
                          <div>
                            <span style={{ color: '#7e22ce', fontWeight: 600 }}>Payer Name:</span>
                            <div style={{ fontWeight: 700, color: '#3b0764' }}>{pur.payerName || '-'}</div>
                          </div>
                          <div>
                            <span style={{ color: '#7e22ce', fontWeight: 600 }}>Payment Mode:</span>
                            <div style={{ fontWeight: 700, color: '#3b0764' }}>{pur.paymentMode || 'UPI'}</div>
                          </div>
                          <div>
                            <span style={{ color: '#7e22ce', fontWeight: 600 }}>Submitted At:</span>
                            <div style={{ color: '#581c87' }}>
                              {pur.paymentSubmittedAt ? new Date(pur.paymentSubmittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Rejection notice */}
                    {pur.rejectionReason && (
                      <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#9f1239' }}>
                        <strong>Rejection Note:</strong> {pur.rejectionReason}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
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
                                  background: '#0284c7',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '10px',
                                  borderRadius: '8px',
                                  fontWeight: 700,
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                }}
                              >
                                <Send size={15} /> Approve & Send Bank Details
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPurchase(pur);
                                  setIsRejectModalOpen(true);
                                }}
                                style={{
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  border: 'none',
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  fontWeight: 700,
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                }}
                              >
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
                                }}
                                style={{
                                  flex: 1,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  background: '#059669',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '10px',
                                  borderRadius: '8px',
                                  fontWeight: 700,
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                }}
                              >
                                <CheckCircle2 size={15} /> Verify & Mark as Paid
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPurchase(pur);
                                  setIsRejectModalOpen(true);
                                }}
                                style={{
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  border: 'none',
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  fontWeight: 700,
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                }}
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {pur.approvalStage === 'PAYMENT_INSTRUCTIONS_SENT' && (
                            <button
                              onClick={() => {
                                setSelectedPurchase(pur);
                                setIsVerifyModalOpen(true);
                              }}
                              style={{
                                flex: 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                background: '#f8fafc',
                                color: '#334155',
                                border: '1px solid #cbd5e1',
                                padding: '10px',
                                borderRadius: '8px',
                                fontWeight: 600,
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                            >
                              Awaiting Member Payment (Manual Mark Paid)
                            </button>
                          )}

                          {pur.approvalStage === 'VERIFIED_AND_PAID' && (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>
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
                                background: '#7c3aed',
                                color: '#ffffff',
                                border: 'none',
                                padding: '10px',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: 'pointer',
                              }}
                            >
                              <CreditCard size={15} /> Make Payment & Submit UTR
                            </button>
                          )}

                          {pur.approvalStage === 'PAYMENT_SUBMITTED' && (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6d28d9', fontWeight: 700 }}>
                              <Clock size={16} /> Payment Proof Submitted • Verification in Progress
                            </div>
                          )}

                          {pur.approvalStage === 'VERIFIED_AND_PAID' && (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>
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
      {isSendInstructionsOpen && selectedPurchase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '520px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={20} className="text-sky-600" />
                Send Payment Instructions
              </h3>
              <button onClick={() => setIsSendInstructionsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              You are approving the purchase request for <strong>{selectedPurchase.memberName || selectedPurchase.memberId}</strong>. The company bank details, UPI ID, and QR code configured in Company Account will automatically be attached.
            </p>

            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Item Requested:</span>
                <strong style={{ color: '#0f172a' }}>{selectedPurchase.items.map((i) => i.name).join(', ')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Order Amount:</span>
                <strong style={{ color: '#059669' }}>₹ {selectedPurchase.totalAmount.toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Business Volume:</span>
                <strong style={{ color: '#0284c7' }}>{selectedPurchase.totalBV.toLocaleString()} BV</strong>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Custom Instruction Note (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Please make the payment via UPI or IMPS and enter the 12-digit UTR in your portal."
                value={adminInstructionNote}
                onChange={(e) => setAdminInstructionNote(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsSendInstructionsOpen(false)}
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleSendInstructions}
                style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#0284c7', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                {actionLoading ? 'Dispatching...' : 'Approve & Send to Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Verify & Mark as Paid */}
      {isVerifyModalOpen && selectedPurchase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '520px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} className="text-emerald-600" />
                Verify Payment & Activate
              </h3>
              <button onClick={() => setIsVerifyModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Confirming this will mark the order as <strong>PAID</strong>, credit <strong>{selectedPurchase.totalBV.toLocaleString()} BV</strong> to member <strong>{selectedPurchase.memberName || selectedPurchase.memberId}</strong>, activate package capping, and distribute binary commission volume.
            </p>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px', marginBottom: '20px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#166534' }}>Bank UTR / Txn ID:</span>
                <strong style={{ color: '#14532d', fontSize: '14px' }}>{selectedPurchase.utrNumber || 'Manual Super Admin Verification'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#166534' }}>Payer Name:</span>
                <strong style={{ color: '#14532d' }}>{selectedPurchase.payerName || selectedPurchase.memberName || '-'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#166534' }}>Total Received:</span>
                <strong style={{ color: '#047857', fontSize: '15px' }}>₹ {selectedPurchase.totalAmount.toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#166534' }}>Volume to Credit:</span>
                <strong style={{ color: '#047857' }}>{selectedPurchase.totalBV.toLocaleString()} BV</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsVerifyModalOpen(false)}
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleVerifyAndPay}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                {actionLoading ? 'Activating...' : 'Confirm Verification & Mark Paid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Reject Purchase Request */}
      {isRejectModalOpen && selectedPurchase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <XCircle size={20} />
                Reject Purchase Request
              </h3>
              <button onClick={() => setIsRejectModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Please provide a reason for rejecting order <strong>{selectedPurchase.purchaseId}</strong>.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Rejection Reason *
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Transaction UTR not matching our bank statement, or payment underpaid."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleReject}
                style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Unified Member Purchase Dossier / History Modal */}
      {dossierMemberId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '26px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={22} className="text-sky-600" />
                  Member Purchase Dossier & History
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Complete lifetime purchases, package upgrades, and requests history for <strong>{dossierData?.member?.name || dossierMemberId}</strong>.
                </p>
              </div>
              <button onClick={() => setDossierMemberId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={22} />
              </button>
            </div>

            {dossierLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading member history...</div>
            ) : dossierData ? (
              <div>
                {/* Member Profile Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Current Package</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{dossierData.member?.currentPackage || 'None'}</div>
                    <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>Cap: ₹{(dossierData.member?.dailyCapping || 0).toLocaleString()}/day</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Lifetime Requests</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{dossierData.summary?.totalRequests || 0} Orders</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{dossierData.summary?.packageRequestsCount} Pkg | {dossierData.summary?.productRequestsCount} Prod</div>
                  </div>
                  <div style={{ background: '#f0fdf4', padding: '12px 14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Total Paid Amount</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>₹ {(dossierData.summary?.totalSpent || 0).toLocaleString()}</div>
                    <div style={{ fontSize: '11px', color: '#16a34a' }}>Lifetime settlements</div>
                  </div>
                  <div style={{ background: '#f0f9ff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>Total BV Credited</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>{(dossierData.summary?.totalBvCredited || 0).toLocaleString()} BV</div>
                    <div style={{ fontSize: '11px', color: '#0284c7' }}>Personal volume added</div>
                  </div>
                </div>

                {/* History Table */}
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Chronological Requests History</h4>
                {dossierData.history?.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No requests recorded for this member.</div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                          <th style={{ padding: '10px 12px' }}>Date</th>
                          <th style={{ padding: '10px 12px' }}>Order ID</th>
                          <th style={{ padding: '10px 12px' }}>Type & Items</th>
                          <th style={{ padding: '10px 12px' }}>Amount / BV</th>
                          <th style={{ padding: '10px 12px' }}>UTR / Reference</th>
                          <th style={{ padding: '10px 12px' }}>Stage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dossierData.history.map((h: any) => (
                          <tr key={h._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>
                              {new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{h.purchaseId}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontWeight: 700, color: h.items[0]?.itemType === 'PACKAGE' ? '#b45309' : '#047857' }}>
                                [{h.items[0]?.itemType === 'PACKAGE' ? 'PACKAGE' : 'PRODUCT'}]
                              </span>{' '}
                              {h.items.map((i: any) => `${i.name} (x${i.quantity})`).join(', ')}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                              ₹ {h.totalAmount.toLocaleString()} <span style={{ color: '#0284c7' }}>({h.totalBV.toLocaleString()} BV)</span>
                            </td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#581c87' }}>
                              {h.utrNumber || '-'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>{stageBadge(h.approvalStage)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setDossierMemberId(null)}
                style={{ padding: '8px 18px', borderRadius: '8px', background: '#0f172a', color: '#fff', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Member Submit Payment Details */}
      {isSubmitPaymentModalOpen && selectedPurchase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={20} className="text-purple-600" />
                Submit Payment Details & UTR
              </h3>
              <button onClick={() => setIsSubmitPaymentModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {/* Bank details preview */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Landmark size={15} className="text-sky-600" /> Company Deposit Account
              </div>
              <div style={{ fontSize: '12px', color: '#334155', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div><span style={{ color: '#64748b' }}>Bank:</span> <strong>{selectedPurchase.companyAccountSnapshot?.bankName || 'State Bank of India'}</strong></div>
                <div><span style={{ color: '#64748b' }}>A/C No:</span> <strong style={{ color: '#0284c7' }}>{selectedPurchase.companyAccountSnapshot?.accountNumber || '9876543210123'}</strong></div>
                <div><span style={{ color: '#64748b' }}>IFSC:</span> <strong>{selectedPurchase.companyAccountSnapshot?.ifscCode || 'SBIN0001234'}</strong></div>
                <div><span style={{ color: '#64748b' }}>UPI ID:</span> <strong style={{ color: '#7e22ce' }}>{selectedPurchase.companyAccountSnapshot?.upiId || 'panchveda@sbi'}</strong></div>
              </div>
            </div>

            <form onSubmit={handleMemberSubmitPayment}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Bank UTR / Transaction ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 423456789012 or UPI Ref Number"
                    value={memberUtr}
                    onChange={(e) => setMemberUtr(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Payer Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Name on bank account / UPI account"
                    value={memberPayerName}
                    onChange={(e) => setMemberPayerName(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Payment Mode
                  </label>
                  <select
                    value={memberPaymentMode}
                    onChange={(e) => setMemberPaymentMode(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                  >
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="IMPS">IMPS Instant Bank Transfer</option>
                    <option value="NEFT">NEFT Bank Transfer</option>
                    <option value="QR_SCAN">QR Code Scan</option>
                    <option value="NET_BANKING">Net Banking</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsSubmitPaymentModalOpen(false)}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  {actionLoading ? 'Submitting...' : 'Submit Payment Proof'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseRequestsPage;
