import React, { useState, useEffect, useRef } from 'react';
import {
  Mail, Phone, Calendar, CalendarDays, MapPin, Lock, UserRound, LayoutGrid, FileCheck2, Share2,
  ShieldCheck, ArrowRight, Award, Package, Network, Users,
} from 'lucide-react';
import { api, type KycDetails, type KycStatus } from '../services/api';
import { KycSection } from '../components/KycSection';
import { KycDocumentImage } from '../components/KycDocumentImage';
import { NomineeCard, type NomineeDetails } from '../components/NomineeCard';
import { ReferralCard } from '../components/ReferralCard';

interface ProfilePageProps {
  user: any;
  token?: string | null;
  onNavigate?: (tab: string) => void;
  onUserUpdate?: (user: any) => void;
}

type ProfileTab = 'overview' | 'kyc' | 'referral';

const KYC_META: Record<KycStatus, { label: string; tone: string }> = {
  not_submitted: { label: 'KYC Not Submitted', tone: 'is-muted' },
  pending: { label: 'KYC Under Review', tone: 'is-warning' },
  approved: { label: 'KYC Verified', tone: 'is-success' },
  rejected: { label: 'KYC Rejected', tone: 'is-danger' },
};

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, token, onUserUpdate }) => {
  const isSuperAdmin = user?.role?.toLowerCase() === 'superadmin';
  const [rootSponsorId, setRootSponsorId] = useState<string>('MEM0001');
  const [kyc, setKyc] = useState<KycDetails | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // If logged in as Super Admin, dynamically fetch the Company Root Member ID
  useEffect(() => {
    if (isSuperAdmin) {
      api.getRootSponsor()
        .then((res: any) => {
          if (res?.data?.memberId) {
            setRootSponsorId(res.data.memberId);
          }
        })
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  // For regular members: user.memberId. For Super Admin: Company Root ID (MEM0001)
  const memberId = isSuperAdmin ? rootSponsorId : (user?.memberId || 'MEM0001');

  const displayName =
    user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || (isSuperAdmin ? 'Super Admin' : 'Member');
  const initial = displayName.charAt(0).toUpperCase();
  const isActiveStatus = user?.status?.toLowerCase() === 'active' || Boolean(user?.isActive);
  const kycStatus: KycStatus = kyc?.status || user?.kycStatus || 'not_submitted';
  const kycMeta = KYC_META[kycStatus] || KYC_META.not_submitted;
  const profilePhoto = kyc?.documents.profilePhoto;

  // KYC address is the current one; older accounts may still have an address from registration
  const fullAddress = (kyc?.address
    ? [kyc.address, kyc.state, kyc.pincode]
    : [user?.address, user?.city, user?.state, user?.pincode]
  ).filter(Boolean).join(', ');

  const joinedOn = user?.joinDate || (user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '');

  const tabs: Array<{ id: ProfileTab; label: string; icon: React.ElementType }> = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    ...(!isSuperAdmin ? [{ id: 'kyc' as const, label: 'KYC', icon: FileCheck2 }] : []),
    { id: 'referral', label: 'Refer & Grow', icon: Share2 },
  ];

  const selectTab = (tab: ProfileTab) => setActiveTab(tab);

  // Arrow keys move between tabs (WAI-ARIA tabs pattern)
  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const handleNomineeSaved = (nominee: NomineeDetails) => {
    onUserUpdate?.({ ...user, ...nominee });
  };

  const accountRows: Array<{ label: string; icon: React.ElementType; value: React.ReactNode }> = [
    {
      label: 'Account Status',
      icon: ShieldCheck,
      value: (
        <span className={`profile-status-pill ${isSuperAdmin ? 'is-info' : isActiveStatus ? 'is-success' : 'is-warning'}`}>
          {isSuperAdmin ? 'Super Admin' : user?.status ? user.status.toLowerCase() : 'Active'}
        </span>
      ),
    },
    { label: 'Current Rank', icon: Award, value: isSuperAdmin ? 'Company Administrator' : user?.rank || 'Distributor' },
    { label: 'Active Package', icon: Package, value: isSuperAdmin ? 'Executive Management' : user?.packageName || 'No package yet' },
    {
      label: isSuperAdmin ? 'Company Sponsor ID' : 'Sponsor ID',
      icon: Users,
      value: isSuperAdmin ? rootSponsorId : user?.sponsorId || 'None (Root Member)',
    },
    {
      label: 'Binary Tree',
      icon: Network,
      value: (
        <span className={`profile-status-pill ${user?.isBinaryActive ? 'is-success' : 'is-muted'}`}>
          {user?.isBinaryActive ? 'Qualified (100+ BV)' : 'Needs 100 BV'}
        </span>
      ),
    },
    ...(joinedOn ? [{ label: 'Joined On', icon: CalendarDays, value: joinedOn }] : []),
  ];

  // Email and mobile are fixed for login and identity; gender / date of birth only exist on older accounts
  const contactRows: Array<{ label: string; icon: React.ElementType; value: string; locked?: boolean }> = [
    { label: 'Email Address', icon: Mail, value: user?.email || 'Not specified', locked: true },
    { label: 'Mobile Number', icon: Phone, value: user?.mobile || user?.phone || 'Not specified', locked: true },
    ...(fullAddress ? [{ label: 'Address', icon: MapPin, value: fullAddress }] : []),
    ...(user?.gender ? [{ label: 'Gender', icon: UserRound, value: user.gender }] : []),
    ...(user?.dob ? [{ label: 'Date of Birth', icon: Calendar, value: user.dob }] : []),
  ];

  return (
    <div className="page-body profile-page">
      {/* Identity header */}
      <section className="profile-hero" aria-label="Profile summary">
        <div className="profile-hero-avatar" aria-hidden="true">
          {profilePhoto && token ? (
            <KycDocumentImage
              source={profilePhoto.source === 'upload' ? { kind: 'upload', fileKey: profilePhoto.fileKey } : { kind: 'drive', url: profilePhoto.url }}
              token={token}
              alt=""
              className="profile-avatar-photo"
              fallback={initial}
            />
          ) : (
            initial
          )}
        </div>

        <div className="profile-hero-main">
          <h1 className="profile-hero-name">{displayName}</h1>
          <p className="profile-hero-meta">
            <span className="profile-hero-id">{isSuperAdmin ? 'Platform Owner (Super Admin)' : memberId}</span>
            {joinedOn && <span>Joined {joinedOn}</span>}
          </p>
          <div className="profile-hero-chips">
            <span className={`profile-status-pill ${isSuperAdmin ? 'is-info' : isActiveStatus ? 'is-success' : 'is-warning'}`}>
              {isSuperAdmin ? 'Super Admin' : isActiveStatus ? 'Active Account' : user?.status || 'Inactive'}
            </span>
            {!isSuperAdmin && <span className={`profile-status-pill ${kycMeta.tone}`}>{kycMeta.label}</span>}
            {!isSuperAdmin && (
              <span className={`profile-status-pill ${user?.isBinaryActive ? 'is-success' : 'is-muted'}`}>
                {user?.isBinaryActive ? 'Binary Qualified' : 'Binary: needs 100 BV'}
              </span>
            )}
          </div>
        </div>

        <div className="profile-hero-sponsor">
          <span className="profile-sponsor-label">{isSuperAdmin ? 'Company Sponsor ID' : 'Your Referral ID'}</span>
          <span className="profile-sponsor-id">{memberId}</span>
        </div>
      </section>

      {/* Nudge members to finish KYC */}
      {!isSuperAdmin && activeTab !== 'kyc' && (kycStatus === 'not_submitted' || kycStatus === 'rejected') && (
        <div className={`profile-kyc-callout ${kycStatus === 'rejected' ? 'is-danger' : ''}`}>
          <FileCheck2 size={20} aria-hidden="true" />
          <div className="profile-kyc-callout-text">
            <strong>{kycStatus === 'rejected' ? 'Your KYC needs attention' : 'Complete your KYC'}</strong>
            <span>
              {kycStatus === 'rejected'
                ? 'Your KYC was not approved. Review the reason and resubmit your details.'
                : 'Add your bank, payment and identity details to get verified.'}
            </span>
          </div>
          <button type="button" className="primary-btn profile-kyc-callout-btn" onClick={() => selectTab('kyc')}>
            <span>{kycStatus === 'rejected' ? 'Review KYC' : 'Start KYC'}</span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Section tabs */}
      <div className="profile-tabs" role="tablist" aria-label="Profile sections">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              type="button"
              role="tab"
              id={`profile-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`profile-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={`profile-tab ${selected ? 'is-active' : ''}`}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{tab.label}</span>
              {tab.id === 'kyc' && <span className={`profile-tab-dot ${kycMeta.tone}`} aria-label={kycMeta.label} />}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      <div
        role="tabpanel"
        id="profile-panel-overview"
        aria-labelledby="profile-tab-overview"
        hidden={activeTab !== 'overview'}
        className="profile-tabpanel"
      >
        <div className="profile-overview-grid">
          <section className="profile-card" aria-labelledby="profile-account-title">
            <h3 className="profile-card-title" id="profile-account-title">Account Details</h3>
            <dl className="profile-info-list">
              {accountRows.map(({ label, icon: Icon, value }) => (
                <div key={label} className="profile-info-row">
                  <dt><Icon size={15} aria-hidden="true" />{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="profile-overview-stack">
            <section className="profile-card" aria-labelledby="profile-contact-title">
              <h3 className="profile-card-title" id="profile-contact-title">Contact Information</h3>
              <dl className="profile-info-list">
                {contactRows.map(({ label, icon: Icon, value, locked }) => (
                  <div key={label} className="profile-info-row">
                    <dt><Icon size={15} aria-hidden="true" />{label}</dt>
                    <dd>
                      <span>{value}</span>
                      {locked && (
                        <span className="profile-locked-badge" title="This field cannot be changed">
                          <Lock size={11} aria-hidden="true" />
                          <span className="sr-only">(cannot be changed)</span>
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="profile-card-footnote">
                <Lock size={12} aria-hidden="true" /> Email and mobile number are used to identify your account and can't be changed here.
              </p>
            </section>

            {!isSuperAdmin && token && (
              <NomineeCard user={user} token={token} onSaved={handleNomineeSaved} />
            )}
          </div>
        </div>
      </div>

      {/* KYC: kept mounted so its status and photo feed the header, and drafts survive tab switches */}
      {!isSuperAdmin && token && (
        <div
          role="tabpanel"
          id="profile-panel-kyc"
          aria-labelledby="profile-tab-kyc"
          hidden={activeTab !== 'kyc'}
          className="profile-tabpanel"
        >
          <KycSection token={token} onKycLoaded={setKyc} />
        </div>
      )}

      {/* Referral */}
      <div
        role="tabpanel"
        id="profile-panel-referral"
        aria-labelledby="profile-tab-referral"
        hidden={activeTab !== 'referral'}
        className="profile-tabpanel"
      >
        <ReferralCard memberId={memberId} isSuperAdmin={isSuperAdmin} />
      </div>
    </div>
  );
};
