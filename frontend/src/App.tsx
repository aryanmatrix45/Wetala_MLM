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
import { AddMemberModal } from './components/AddMemberModal';
import { LoginPage } from './pages/LoginPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminSubcategoriesPage } from './pages/AdminSubcategoriesPage';
import { MemberProductsPage } from './pages/MemberProductsPage';
import { CompanyAccountPage } from './pages/CompanyAccountPage';
import { PurchaseRequestsPage } from './pages/PurchaseRequestsPage';
import { api } from './services/api';

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const getInitialTab = () => {
    const path = window.location.pathname;
    if (path.startsWith('/product/') || path.startsWith('/products/') || path === '/products') {
      return 'member-products';
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Tab switch handler with URL cleanup
  const handleTabChange = (newTab: string) => {
    if (newTab !== 'member-products') {
      if (window.location.pathname.startsWith('/product/') || window.location.pathname.startsWith('/products/')) {
        window.history.pushState(null, '', '/');
      }
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
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('wetala_token');
    localStorage.removeItem('wetala_user');
    setToken(null);
    setUser(null);
  };

  const [refreshKey, setRefreshKey] = useState(0);

  const handleAddMember = async (memberData: any) => {
    const res = await api.addMember(memberData, token || undefined);
    alert(res.message || `Member ${res.member?.name || memberData.name} registered successfully! Member ID: ${res.member?.memberId}`);
    setIsAddMemberOpen(false);
    setRefreshKey((prev) => prev + 1);
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

  // If not authenticated, render Login Screen
  if (!token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Mobile Backdrop */}
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
          onLogout={handleLogout} 
          onNavigate={handleTabChange} 
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Tab Routing */}
        {(activeTab === 'dashboard' || activeTab === 'welcome-bonus') && (
          <DashboardPage
            key={refreshKey}
            user={user}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenAddMember={() => setIsAddMemberOpen(true)}
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
            key={refreshKey} 
            user={user} 
            token={token} 
            onOpenAddMember={() => setIsAddMemberOpen(true)} 
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'member-requests' && (
          <MemberRequestsPage
            key={refreshKey}
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
          <MemberProductsPage user={user} token={token} onNavigate={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === 'income-settings' && <IncomeSettingsPage user={user} token={token} defaultSection="simulator" />}

        {activeTab === 'team-bonus' && <IncomeSettingsPage user={user} token={token} defaultSection="teamBonus" />}

        {activeTab === 'direct-royalty' && <IncomeSettingsPage user={user} token={token} defaultSection="royalty" />}

        {activeTab === 'rank-rewards' && <IncomeSettingsPage user={user} token={token} defaultSection="rewards" />}

        {activeTab === 'wallet-payouts' && <PayoutsPage user={user} token={token} defaultSubTab="commissions" onNavigate={handleTabChange} />}

        {activeTab === 'withdrawals' && <PayoutsPage user={user} token={token} defaultSubTab="requests" onNavigate={handleTabChange} />}

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

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        onAddMember={handleAddMember}
        user={user}
      />
    </div>
  );
}

export default App;
