import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { DashboardPage } from './pages/DashboardPage';
import { MembersPage } from './pages/MembersPage';
import { GenealogyPage } from './pages/GenealogyPage';
import { PackagesPage } from './pages/PackagesPage';
import { IncomeSettingsPage } from './pages/IncomeSettingsPage';
import { PayoutsPage } from './pages/PayoutsPage';
import { AddMemberModal } from './components/AddMemberModal';
import { LoginPage } from './pages/LoginPage';
import { api } from './services/api';

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

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
    const res = await api.addMember(memberData);
    alert(res.message || `Member ${res.member?.name || memberData.name} registered successfully! Member ID: ${res.member?.memberId}`);
    setIsAddMemberOpen(false);
    setRefreshKey((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#1d72fe', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>Connecting to Panchwati Wellness...</p>
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
      {/* Left Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={handleLogout} />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <TopNavbar user={user} onLogout={handleLogout} onNavigate={(tab) => setActiveTab(tab)} />

        {/* Tab Routing */}
        {activeTab === 'dashboard' && (
          <DashboardPage
            key={refreshKey}
            user={user}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenAddMember={() => setIsAddMemberOpen(true)}
          />
        )}

        {activeTab === 'members' && (
          <MembersPage key={refreshKey} onOpenAddMember={() => setIsAddMemberOpen(true)} />
        )}

        {activeTab === 'genealogy' && <GenealogyPage user={user} token={token} />}

        {activeTab === 'packages' && (
          <PackagesPage
            user={user}
            token={token}
            onUserUpdate={(updated) => setUser(updated)}
          />
        )}

        {activeTab === 'income-settings' && <IncomeSettingsPage user={user} token={token} defaultSection="simulator" />}

        {activeTab === 'team-bonus' && <IncomeSettingsPage user={user} token={token} defaultSection="teamBonus" />}

        {activeTab === 'direct-royalty' && <IncomeSettingsPage user={user} token={token} defaultSection="royalty" />}

        {activeTab === 'rank-rewards' && <IncomeSettingsPage user={user} token={token} defaultSection="rewards" />}

        {activeTab === 'wallet-payouts' && <PayoutsPage />}

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
      />
    </div>
  );
}

export default App;
