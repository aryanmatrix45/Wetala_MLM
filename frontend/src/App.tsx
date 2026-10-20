import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { DashboardPage } from './pages/DashboardPage';
import { MembersPage } from './pages/MembersPage';
import { MemberRequestsPage } from './pages/MemberRequestsPage';
import { GenealogyPage } from './pages/GenealogyPage';
import { PackagesPage } from './pages/PackagesPage';
import { IncomeSettingsPage } from './pages/IncomeSettingsPage';
import { PayoutsPage } from './pages/PayoutsPage';
import { SponsorIncomePage } from './pages/SponsorIncomePage';
import { BinaryLedgerPage } from './pages/BinaryLedgerPage';
import { LoginPage } from './pages/LoginPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminSubcategoriesPage } from './pages/AdminSubcategoriesPage';
import { MemberProductsPage } from './pages/MemberProductsPage';
import { CompanyAccountPage } from './pages/CompanyAccountPage';
import { PurchaseRequestsPage } from './pages/PurchaseRequestsPage';
import { PreRegistrationPage } from './pages/PreRegistrationPage';
import { FullRegistrationPage } from './pages/FullRegistrationPage';
import { ProfilePage } from './pages/ProfilePage';
import { BVWalletPage } from './pages/BVWalletPage';
import { MemberHomePage } from './pages/MemberHomePage';
import { AdminSlidersPage } from './pages/AdminSlidersPage';
import { AdminSocialMediaPage } from './pages/AdminSocialMediaPage';
import { AdminAboutPage } from './pages/AdminAboutPage';
import { AdminVideosPage } from './pages/AdminVideosPage';
import { AdminFooterPage } from './pages/AdminFooterPage';
import { MobileBottomNav } from './components/MobileBottomNav';
import { PublicTopNavbar } from './components/PublicTopNavbar';
import { useNotifications } from './hooks/useNotifications';
import { api } from './services/api';

type AuthView = 'public' | 'login' | 'pre-registration' | 'register';

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  // Polled once here and shared by the top header (desktop) and bottom nav (mobile)
  const { notifications, unreadCount, isAdmin: isAdminUser } = useNotifications(token ? user : null);

  const getInitialTab = () => {
    const path = window.location.pathname;
    if (path.startsWith('/product/') || path.startsWith('/products/') || path === '/products') {
      return 'member-products';
    }
    const savedUser = localStorage.getItem('wetala_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u?.role?.toLowerCase() !== 'superadmin') {
          return 'home';
        }
      } catch {}
      return 'dashboard';
    }
    return 'home';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Public routing state: 'public' is the open website; login & registration have their own paths
  const getAuthViewFromPath = (): AuthView => {
    const path = window.location.pathname;
    if (path === '/pre-registration') return 'pre-registration';
    if (path === '/register') return 'register';
    if (path === '/login') return 'login';
    // Legacy referral links on "/" (e.g. /?ref=MEM0001) still open the referral sign-up flow
    const params = new URLSearchParams(window.location.search);
    if (params.get('ref') || params.get('sponsorId')) return 'pre-registration';
    return 'public';
  };

  const [authView, setAuthView] = useState<AuthView>(getAuthViewFromPath);
  // Tab to open after a visitor signs in (e.g. back to Products after starting checkout)
  const [postLoginTab, setPostLoginTab] = useState<string | null>(null);
  // Sponsor & position confirmed on the pre-registration step; required to open the registration form
  const [registrationPrefill, setRegistrationPrefill] = useState<{
    sponsorId: string;
    sponsorName: string;
    position: 'LEFT' | 'RIGHT';
  } | null>(null);

  const [categoryNav, setCategoryNav] = useState<{
    categoryId?: string;
    subcategoryId?: string;
  } | null>(null);

  const navigateAuth = (view: AuthView, urlPath?: string) => {
    setAuthView(view);
    if (urlPath) {
      window.history.pushState(null, '', urlPath);
    }
  };

  // Tab switch handler with URL cleanup and category params support
  const handleTabChange = (
    newTab: string,
    params?: { categoryId?: string; subcategoryId?: string }
  ) => {
    if (newTab !== 'member-products') {
      if (window.location.pathname.startsWith('/product/') || window.location.pathname.startsWith('/products/')) {
        window.history.pushState(null, '', '/');
      }
      setCategoryNav(null);
    } else if (params) {
      setCategoryNav(params);
    }
    setActiveTab(newTab);
    setIsSidebarOpen(false);
  };

  // Listen to browser popstate to handle back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/product/') || path.startsWith('/products/')) {
        setActiveTab('member-products');
      }
      setAuthView(getAuthViewFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check saved session on app load
  useEffect(() => {
    const savedToken = localStorage.getItem('wetala_token');
    const savedUser = localStorage.getItem('wetala_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        setUser(null);
      }
      
      // Verify token freshness with backend
      api.getProfile(savedToken)
        .then((res) => {
          if (res.status && res.data) {
            setUser(res.data);
            localStorage.setItem('wetala_user', JSON.stringify(res.data));
          } else {
            // Token expired or invalid
            handleLogout();
          }
        })
        .catch(() => {
          // If offline or network issue, maintain stored session
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLoginSuccess = (userData: any, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    // Signed-in users land on their dashboard, unless they were mid-checkout
    setActiveTab(postLoginTab || 'dashboard');
    setPostLoginTab(null);
    setAuthView('public');
    if (['/login', '/pre-registration', '/register'].includes(window.location.pathname)) {
      window.history.replaceState(null, '', '/');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wetala_token');
    localStorage.removeItem('wetala_user');
    setToken(null);
    setUser(null);
    // Back to the public website
    setActiveTab('home');
    setAuthView('public');
    if (window.location.pathname !== '/') {
      window.history.pushState(null, '', '/');
    }
  };

  const openLogin = () => navigateAuth('login', '/login');
  const openSignUp = () => navigateAuth('pre-registration', '/pre-registration');
  const goToPublicHome = () => {
    setPostLoginTab(null);
    setActiveTab('home');
    navigateAuth('public', '/');
  };

  // Visitors can only open public sections; anything else asks them to sign in
  const PUBLIC_TABS = ['home', 'member-products'];
  const handleGuestNavigate = (tab: string, params?: { categoryId?: string; subcategoryId?: string }) => {
    if (PUBLIC_TABS.includes(tab)) {
      handleTabChange(tab, params);
    } else {
      setPostLoginTab(tab);
      openLogin();
    }
  };

  const handleRequireLoginForCheckout = () => {
    setPostLoginTab('member-products');
    openLogin();
  };

  // Desktop "Social Media" link: open Home and scroll to the social section once it has rendered
  const handleShowSocial = () => {
    handleTabChange('home');
    let attempts = 0;
    const tryScroll = () => {
      const section = document.querySelector('.member-home-page .social-media-connect-section');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (attempts++ < 30) {
        setTimeout(tryScroll, 100);
      }
    };
    setTimeout(tryScroll, 50);
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1120' }}>
        <div style={{ textAlign: 'center' }}>
          <img 
            src="/logo.png" 
            alt="Panchveda Wellness" 
            style={{ width: '68px', height: '68px', borderRadius: '50%', marginBottom: '16px', border: '2px solid rgba(234, 179, 8, 0.4)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} 
          />
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>Connecting to Panchveda Wellness...</p>
        </div>
      </div>
    );
  }

  // Not signed in: the public website, or the login / registration screens
  if (!token) {
    if (authView === 'public') {
      const guestTab = activeTab === 'member-products' ? 'member-products' : 'home';
      return (
        <div className="app-container layout-home-immersive is-public">
          <div className="main-wrapper">
            <PublicTopNavbar
              activeTab={guestTab}
              onNavigate={handleGuestNavigate}
              onShowSocial={handleShowSocial}
              onLogin={openLogin}
              onSignUp={openSignUp}
            />

            {guestTab === 'home' ? (
              <MemberHomePage user={null} token={null} onNavigate={handleGuestNavigate} />
            ) : (
              <MemberProductsPage
                user={null}
                token={null}
                initialCategoryId={categoryNav?.categoryId}
                initialSubcategoryId={categoryNav?.subcategoryId}
                onNavigate={handleGuestNavigate}
                onRequireLogin={handleRequireLoginForCheckout}
              />
            )}
          </div>

          <MobileBottomNav
            activeTab={guestTab}
            onNavigate={handleGuestNavigate}
            notifications={[]}
            unreadCount={0}
            isGuest
            onLogin={openLogin}
            onSignUp={openSignUp}
          />
        </div>
      );
    }

    const backToHome = (
      <button type="button" className="auth-back-home" onClick={goToPublicHome}>
        ← Back to Home
      </button>
    );

    if (authView === 'register' && registrationPrefill) {
      return (
        <>
          {backToHome}
          <FullRegistrationPage
            initialData={registrationPrefill}
            onBackToPreReg={() => navigateAuth('pre-registration', '/pre-registration')}
            onGoToLogin={() => {
              setRegistrationPrefill(null);
              openLogin();
            }}
          />
        </>
      );
    }

    // Opening /register directly (without a confirmed sponsor) falls back to the referral step
    if (authView === 'pre-registration' || authView === 'register') {
      return (
        <>
          {backToHome}
          <PreRegistrationPage
            onProceed={(data) => {
              setRegistrationPrefill(data);
              navigateAuth('register', '/register');
            }}
            onGoToLogin={openLogin}
          />
        </>
      );
    }

    return (
      <>
        {backToHome}
        <LoginPage onLoginSuccess={handleLoginSuccess} onGoToPreReg={openSignUp} />
      </>
    );
  }

  return (
    <div className={`app-container ${activeTab === 'home' ? 'layout-home-immersive' : ''}`}>
      {/* Drawer / Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        user={user} 
        onLogout={handleLogout} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <TopNavbar 
          user={user} 
          activeTab={activeTab}
          onLogout={handleLogout} 
          onNavigate={handleTabChange} 
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          notifications={notifications}
          unreadCount={unreadCount}
        />

        {/* Tab Routing */}
        {activeTab === 'home' && (
          <MemberHomePage
            user={user}
            token={token}
            onNavigate={handleTabChange}
          />
        )}

        {(activeTab === 'dashboard' || activeTab === 'welcome-bonus') && (
          <DashboardPage
            user={user}
            onNavigate={(tab) => setActiveTab(tab)}
            initialSection={activeTab === 'welcome-bonus' ? 'welcome-bonus' : undefined}
          />
        )}

        {activeTab === 'sponsor-income' && (
          <SponsorIncomePage user={user} token={token} />
        )}

        {activeTab === 'binary-ledger' && (
          <BinaryLedgerPage user={user} token={token} />
        )}

        {activeTab === 'members' && (
          <MembersPage 
            user={user} 
            token={token} 
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'member-requests' && (
          <MemberRequestsPage
            user={user}
            token={token}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'genealogy' && <GenealogyPage user={user} token={token} />}

        {activeTab === 'packages' && (
          <PackagesPage
            user={user}
            token={token}
            onUserUpdate={(updated) => setUser(updated)}
          />
        )}

        {activeTab === 'purchase-requests' && (
          <PurchaseRequestsPage user={user} token={token || undefined} />
        )}

        {activeTab === 'company-account' && (
          <CompanyAccountPage user={user} token={token} />
        )}

        {activeTab === 'manage-sliders' && (
          <AdminSlidersPage user={user} token={token} />
        )}

        {activeTab === 'manage-social-links' && (
          <AdminSocialMediaPage user={user} token={token} />
        )}

        {activeTab === 'manage-about' && (
          <AdminAboutPage user={user} token={token} />
        )}

        {activeTab === 'manage-footer' && (
          <AdminFooterPage user={user} token={token} onNavigate={handleTabChange} />
        )}

        {activeTab === 'manage-videos' && (
          <AdminVideosPage user={user} token={token} />
        )}

        {activeTab === 'manage-categories' && (
          <AdminCategoriesPage user={user} token={token} />
        )}

        {activeTab === 'manage-subcategories' && (
          <AdminSubcategoriesPage user={user} token={token} />
        )}

        {activeTab === 'manage-products' && (
          <AdminProductsPage user={user} token={token} />
        )}

        {activeTab === 'member-products' && (
          <MemberProductsPage
            user={user}
            token={token}
            initialCategoryId={categoryNav?.categoryId}
            initialSubcategoryId={categoryNav?.subcategoryId}
            onNavigate={handleTabChange}
          />
        )}

        {activeTab === 'income-settings' && <IncomeSettingsPage user={user} token={token} defaultSection="simulator" />}

        {activeTab === 'team-bonus' && <IncomeSettingsPage user={user} token={token} defaultSection="teamBonus" />}

        {activeTab === 'direct-royalty' && <IncomeSettingsPage user={user} token={token} defaultSection="royalty" />}

        {activeTab === 'rank-rewards' && <IncomeSettingsPage user={user} token={token} defaultSection="rewards" />}

        {activeTab === 'wallet-payouts' && <PayoutsPage user={user} token={token} defaultSubTab="commissions" onNavigate={handleTabChange} />}

        {activeTab === 'bv-wallet' && <BVWalletPage user={user} token={token} />}

        {activeTab === 'withdrawals' && <PayoutsPage user={user} token={token} defaultSubTab="requests" onNavigate={handleTabChange} />}

        {activeTab === 'profile' && (
          <ProfilePage
            user={user}
            token={token}
            onNavigate={handleTabChange}
            onUserUpdate={(updated) => {
              setUser(updated);
              localStorage.setItem('wetala_user', JSON.stringify(updated));
            }}
          />
        )}

        {(activeTab === 'reports' || activeTab === 'cms-content' || activeTab === 'settings') && (
          <div className="page-body">
            <div className="welcome-header">
              <div>
                <h1 className="page-title">{activeTab.toUpperCase()}</h1>
                <p className="page-subtitle">Module is active and configured.</p>
              </div>
            </div>
            <div className="dashboard-card">
              <p style={{ color: '#64748b' }}>
                All calculations and live stats for {activeTab} are linked with the backend binary calculation engine.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile bottom navigation (hidden on desktop) */}
      <MobileBottomNav
        activeTab={activeTab}
        onNavigate={handleTabChange}
        notifications={notifications}
        unreadCount={unreadCount}
        isAdmin={isAdminUser}
        memberId={user?.memberId}
      />
    </div>
  );
}

export default App;
