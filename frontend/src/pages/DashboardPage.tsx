import React from 'react';
import { 
  Users, 
  UserPlus, 
  IndianRupee, 
  Wallet, 
  Calendar, 
  TrendingUp, 
  ShoppingBag, 
  ShoppingCart, 
  Award,
  Package,
  Settings,
  FileSpreadsheet
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
  onOpenAddMember: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenAddMember }) => {
  // Mock data matching Image 4
  const recentRegistrations = [
    { name: 'Amit Kumar', id: 'MEM0126', package: 'Premium', date: '12 Sep 2025', status: 'Active' },
    { name: 'Priya Singh', id: 'MEM0125', package: 'Basic', date: '12 Sep 2025', status: 'Active' },
    { name: 'Neha Verma', id: 'MEM0124', package: 'Premium', date: '11 Sep 2025', status: 'Active' },
    { name: 'Suresh Yadav', id: 'MEM0123', package: 'Basic', date: '11 Sep 2025', status: 'Active' },
    { name: 'Manish Jain', id: 'MEM0122', package: 'Premium', date: '10 Sep 2025', status: 'Active' }
  ];

  const recentPayouts = [
    { member: 'Ramesh Kumar', amount: '₹ 12,500', date: '12 Sep 2025', status: 'Paid' },
    { member: 'Sunita Devi', amount: '₹ 8,000', date: '11 Sep 2025', status: 'Paid' },
    { member: 'Amit Sharma', amount: '₹ 6,400', date: '10 Sep 2025', status: 'Pending' },
    { member: 'Pooja Singh', amount: '₹ 5,200', date: '10 Sep 2025', status: 'Paid' },
    { member: 'Rajesh Meena', amount: '₹ 4,800', date: '09 Sep 2025', status: 'Paid' }
  ];

  return (
    <div className="page-body">
      {/* Welcome & Date Header */}
      <div className="welcome-header">
        <div>
          <h1 className="page-title">Welcome back, Admin!</h1>
          <p className="page-subtitle">Here's a quick overview of your platform.</p>
        </div>
        <div className="date-pill">
          <Calendar size={16} color="#64748b" />
          <span>12 Sep 2025 Friday, 10:45 AM</span>
        </div>
      </div>

      {/* Top 4 KPI Metrics (Matching Image 4) */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-blue">
            <Users size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Members</div>
            <div className="kpi-value">1,256</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-green">
            <UserPlus size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">New Registrations</div>
            <div className="kpi-value">84</div>
            <div className="kpi-subtext">Today: 12</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-gold">
            <IndianRupee size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Income</div>
            <div className="kpi-value">₹ 1,86,350</div>
            <div className="kpi-subtext">This Month</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-coral">
            <Wallet size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Payout</div>
            <div className="kpi-value">₹ 1,73,900</div>
            <div className="kpi-subtext">This Month</div>
          </div>
        </div>
      </div>

      {/* Middle Grid: Trend Chart & Quick Stats */}
      <div className="dashboard-grid-2">
        {/* Registrations Trend Chart */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <div className="card-title-group">
              <TrendingUp size={18} color="#2563eb" />
              <h2 className="card-title">Registrations Trend</h2>
            </div>
            <select className="pill-select" defaultValue="30">
              <option value="30">Last 30 Days</option>
              <option value="7">Last 7 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>

          {/* SVG Trend Graph */}
          <div style={{ height: '220px', width: '100%', position: 'relative' }}>
            <svg viewBox="0 0 600 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="20" x2="580" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="65" x2="580" y2="65" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="110" x2="580" y2="110" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="155" x2="580" y2="155" stroke="#f1f5f9" strokeDasharray="3 3" />

              {/* Axis labels */}
              <text x="20" y="24" fontSize="10" fill="#94a3b8">50</text>
              <text x="20" y="69" fontSize="10" fill="#94a3b8">40</text>
              <text x="20" y="114" fontSize="10" fill="#94a3b8">30</text>
              <text x="20" y="159" fontSize="10" fill="#94a3b8">10</text>

              {/* Area & Polyline */}
              <path
                d="M 50 160 L 110 145 L 170 152 L 230 115 L 290 128 L 350 140 L 410 100 L 470 108 L 530 65 L 560 50 L 560 180 L 50 180 Z"
                fill="url(#trendGradient)"
              />
              <polyline
                fill="none"
                stroke="#1d72fe"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="50,160 110,145 170,152 230,115 290,128 350,140 410,100 470,108 530,65 560,50"
              />

              {/* Dots */}
              {[
                { cx: 50, cy: 160 }, { cx: 110, cy: 145 }, { cx: 170, cy: 152 },
                { cx: 230, cy: 115 }, { cx: 290, cy: 128 }, { cx: 350, cy: 140 },
                { cx: 410, cy: 100 }, { cx: 470, cy: 108 }, { cx: 530, cy: 65 }, { cx: 560, cy: 50 }
              ].map((pt, i) => (
                <circle key={i} cx={pt.cx} cy={pt.cy} r="4.5" fill="#ffffff" stroke="#1d72fe" strokeWidth="2.5" />
              ))}

              {/* Date Markers */}
              <text x="50" y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">13 Aug</text>
              <text x="170" y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">21 Aug</text>
              <text x="290" y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">29 Aug</text>
              <text x="410" y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">06 Sep</text>
              <text x="540" y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">12 Sep</text>
            </svg>
          </div>
        </div>

        {/* Quick Stats Panel */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <h2 className="card-title">Quick Stats</h2>
          </div>

          <div className="quick-stats-list">
            <div className="quick-stat-row">
              <div className="stat-row-left">
                <Users size={16} color="#10b981" />
                <span>Active Members</span>
              </div>
              <div className="stat-row-right">
                <span className="stat-value">892</span>
                <span className="badge-green">71%</span>
              </div>
            </div>

            <div className="quick-stat-row">
              <div className="stat-row-left">
                <Users size={16} color="#ef4444" />
                <span>Inactive Members</span>
              </div>
              <div className="stat-row-right">
                <span className="stat-value">364</span>
                <span className="badge-coral">29%</span>
              </div>
            </div>

            <div className="quick-stat-row">
              <div className="stat-row-left">
                <ShoppingBag size={16} color="#8b5cf6" />
                <span>Total Orders</span>
              </div>
              <div className="stat-row-right">
                <span className="stat-value">1,024</span>
              </div>
            </div>

            <div className="quick-stat-row">
              <div className="stat-row-left">
                <ShoppingCart size={16} color="#0284c7" />
                <span>Product Sales</span>
              </div>
              <div className="stat-row-right">
                <span className="stat-value">₹ 12,40,000</span>
              </div>
            </div>

            <div className="quick-stat-row">
              <div className="stat-row-left">
                <Award size={16} color="#f59e0b" />
                <span>Ranks Achieved</span>
              </div>
              <div className="stat-row-right">
                <span className="stat-value">32</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Split Tables: Recent Registrations & Recent Payouts */}
      <div className="dashboard-grid-2">
        {/* Recent Registrations Table */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <h2 className="card-title">Recent Registrations</h2>
            <button onClick={() => onNavigate('members')} className="primary-btn" style={{ fontSize: '11px', padding: '4px 10px' }}>
              View All
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Package</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRegistrations.map((row, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td>{row.id}</td>
                    <td>{row.package}</td>
                    <td>{row.date}</td>
                    <td>
                      <span className="status-pill status-active">{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Payouts Table */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <h2 className="card-title">Recent Payouts</h2>
            <button onClick={() => onNavigate('wallet-payouts')} className="primary-btn" style={{ fontSize: '11px', padding: '4px 10px' }}>
              View All
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPayouts.map((row, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{row.member}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{row.amount}</td>
                    <td>{row.date}</td>
                    <td>
                      <span className={`status-pill ${row.status === 'Paid' ? 'status-paid' : 'status-pending'}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Action Strip (Image 4 Bottom) */}
      <div className="quick-actions-strip">
        <button onClick={onOpenAddMember} className="quick-action-btn">
          <UserPlus size={18} color="#2563eb" />
          <span>Add Member</span>
        </button>

        <button onClick={() => onNavigate('packages')} className="quick-action-btn">
          <Package size={18} color="#10b981" />
          <span>Manage Packages</span>
        </button>

        <button onClick={() => onNavigate('income-settings')} className="quick-action-btn">
          <Settings size={18} color="#8b5cf6" />
          <span>Income Settings</span>
        </button>

        <button onClick={() => onNavigate('wallet-payouts')} className="quick-action-btn">
          <Wallet size={18} color="#f59e0b" />
          <span>Process Payout</span>
        </button>

        <button onClick={() => onNavigate('reports')} className="quick-action-btn">
          <FileSpreadsheet size={18} color="#ef4444" />
          <span>View Reports</span>
        </button>
      </div>
    </div>
  );
};
