import React, { useState } from 'react';
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
  ArrowUpRight,
  GitMerge,
  Zap
} from 'lucide-react';

interface DashboardPageProps {
  user?: any;
  onNavigate: (tab: string) => void;
  onOpenAddMember: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, onNavigate, onOpenAddMember }) => {
  const [trendRange, setTrendRange] = useState('30');
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin';

  // Live registrations data
  const recentRegistrations = [
    { name: 'Amit Kumar', id: 'MEM0126', package: 'Premium', bv: '5,000 BV', date: '12 Sep 2025', status: 'Active', leg: 'LEFT' },
    { name: 'Priya Singh', id: 'MEM0125', package: 'Basic', bv: '1,250 BV', date: '12 Sep 2025', status: 'Active', leg: 'RIGHT' },
    { name: 'Neha Verma', id: 'MEM0124', package: 'Premium', bv: '5,000 BV', date: '11 Sep 2025', status: 'Active', leg: 'LEFT' },
    { name: 'Suresh Yadav', id: 'MEM0123', package: 'Basic', bv: '1,250 BV', date: '11 Sep 2025', status: 'Active', leg: 'RIGHT' },
    { name: 'Manish Jain', id: 'MEM0122', package: 'Elite', bv: '10,000 BV', date: '10 Sep 2025', status: 'Active', leg: 'LEFT' }
  ];

  const recentPayouts = [
    { member: 'Ramesh Kumar', id: 'MEM0120', amount: '₹ 12,500', net: '₹ 11,250', date: '12 Sep 2025', status: 'Paid' },
    { member: 'Sunita Devi', id: 'MEM0119', amount: '₹ 8,000', net: '₹ 7,200', date: '11 Sep 2025', status: 'Paid' },
    { member: 'Amit Sharma', id: 'MEM0118', amount: '₹ 6,400', net: '₹ 5,760', date: '10 Sep 2025', status: 'Pending' },
    { member: 'Pooja Singh', id: 'MEM0121', amount: '₹ 5,200', net: '₹ 4,680', date: '10 Sep 2025', status: 'Paid' },
    { member: 'Rajesh Meena', id: 'MEM0117', amount: '₹ 4,800', net: '₹ 4,320', date: '09 Sep 2025', status: 'Paid' }
  ];

  return (
    <div className="page-body">
      {/* Welcome Banner */}
      <div className="welcome-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 800, 
              background: '#dbeafe', 
              color: '#1d4ed8', 
              padding: '3px 10px', 
              borderRadius: '9999px',
              letterSpacing: '0.5px'
            }}>
              COMPENSATION PORTAL ACTIVE
            </span>
          </div>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="page-subtitle">Real-time performance analytics, binary volumes, and automated payout ledger.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="date-pill">
            <Calendar size={15} color="#64748b" />
            <span>Today, 12 Sep 2025</span>
          </div>

          <button onClick={onOpenAddMember} className="primary-btn">
            <UserPlus size={16} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="kpi-grid">
        {/* Total Members */}
        <div className="kpi-card kpi-card-blue">
          <div className="kpi-icon-box kpi-icon-blue">
            <Users size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Distributors</div>
            <div className="kpi-value">1,256</div>
            <div className="kpi-trend-pill kpi-trend-up">
              <ArrowUpRight size={13} />
              <span>+14.8% this month</span>
            </div>
          </div>
        </div>

        {/* New Registrations */}
        <div className="kpi-card kpi-card-green">
          <div className="kpi-icon-box kpi-icon-green">
            <UserPlus size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">New Registrations</div>
            <div className="kpi-value">84</div>
            <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
              Today: +12 members joined
            </div>
          </div>
        </div>

        {/* Total Income */}
        <div className="kpi-card kpi-card-gold">
          <div className="kpi-icon-box kpi-icon-gold">
            <IndianRupee size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Gross Revenue</div>
            <div className="kpi-value">₹ 1,86,350</div>
            <div className="kpi-trend-pill kpi-trend-up">
              <ArrowUpRight size={13} />
              <span>+8.2% vs last cycle</span>
            </div>
          </div>
        </div>

        {/* Total Payout */}
        <div className="kpi-card kpi-card-coral">
          <div className="kpi-icon-box kpi-icon-coral">
            <Wallet size={26} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Payouts</div>
            <div className="kpi-value">₹ 1,73,900</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Pending: <strong style={{ color: '#d97706' }}>₹ 11,200</strong>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Binary Volume Live Matching & Capping Strip */}
      <div className="dashboard-card" style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <div className="card-header-row" style={{ marginBottom: '16px' }}>
          <div className="card-title-group">
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '10px', 
              background: '#eff6ff', 
              color: '#2563eb', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <GitMerge size={20} />
            </div>
            <div>
              <h2 className="card-title">{isAdmin ? 'Live Binary Volume Matching & Engine' : 'Live Binary Volume Matching & Daily Cap'}</h2>
              <p style={{ fontSize: '12px', color: '#64748b' }}>Root Distributor Node: <strong>MEM0001 (Rohit Sharma)</strong></p>
            </div>
          </div>

          <button 
            onClick={() => onNavigate('income-settings')} 
            className="primary-btn" 
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            <Zap size={14} /> Open Simulator
          </button>
        </div>

        {/* Binary Volume Split Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '20px', alignItems: 'center' }}>
          {/* Leg Balance Meter */}
          <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>LEFT LEG: 15,000 BV</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>RIGHT LEG: 12,000 BV</span>
            </div>

            {/* Split Bar */}
            <div style={{ height: '12px', width: '100%', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: '55%', background: '#3b82f6' }} title="Left Leg: 15,000 BV" />
              <div style={{ width: '45%', background: '#10b981' }} title="Right Leg: 12,000 BV" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
              <span>Matched: <strong style={{ color: '#0f172a' }}>12,000 BV</strong></span>
              <span>Carry Left: <strong style={{ color: '#2563eb' }}>3,000 BV</strong></span>
            </div>
          </div>

          {/* Raw Commission Estimate */}
          <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Standard Binary Commission (20%)</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)', margin: '4px 0' }}>
              ₹ 2,400
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
              Calculated on 12,000 Matched BV
            </div>
          </div>

          {/* Daily Cap / Payout Policy Progress */}
          <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            {isAdmin ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  <span>Payout Limit Policy</span>
                  <span style={{ color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px' }}>Uncapped</span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)', margin: '8px 0 4px' }}>
                  Super Admin Account
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Binary capping is disabled for Admin roles.
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  <span>Daily Cap Utilization</span>
                  <span style={{ color: '#d97706', fontWeight: 700 }}>60%</span>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden', margin: '8px 0' }}>
                  <div style={{ width: '60%', height: '100%', background: 'linear-gradient(90deg, #f59e0b, #d97706)', borderRadius: '9999px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                  <span>Earned Today: <strong>₹ 2,400</strong></span>
                  <span>Cap: <strong>₹ {user?.dailyCapping ? user.dailyCapping.toLocaleString() : '4,000'}</strong></span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Middle Grid: Trend Chart & Quick Stats */}
      <div className="dashboard-grid-2">
        {/* Registrations Trend Chart */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <div className="card-title-group">
              <TrendingUp size={20} color="#2563eb" />
              <div>
                <h2 className="card-title">Network Growth Trend</h2>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Daily distributor enrollments & team activations</span>
              </div>
            </div>
            <select 
              className="pill-select" 
              value={trendRange}
              onChange={(e) => setTrendRange(e.target.value)}
            >
              <option value="30">Last 30 Days</option>
              <option value="7">Last 7 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>

          {/* SVG Trend Graph */}
          <div style={{ height: '230px', width: '100%', position: 'relative' }}>
            <svg viewBox="0 0 600 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="20" x2="580" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="65" x2="580" y2="65" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="110" x2="580" y2="110" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="155" x2="580" y2="155" stroke="#f1f5f9" strokeDasharray="3 3" />

              {/* Axis labels */}
              <text x="20" y="24" fontSize="10" fill="#94a3b8" fontWeight="600">50</text>
              <text x="20" y="69" fontSize="10" fill="#94a3b8" fontWeight="600">40</text>
              <text x="20" y="114" fontSize="10" fill="#94a3b8" fontWeight="600">30</text>
              <text x="20" y="159" fontSize="10" fill="#94a3b8" fontWeight="600">10</text>

              {/* Area & Polyline */}
              <path
                d="M 50 160 L 110 145 L 170 152 L 230 115 L 290 128 L 350 140 L 410 100 L 470 108 L 530 65 L 560 50 L 560 180 L 50 180 Z"
                fill="url(#trendGradient)"
              />
              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="50,160 110,145 170,152 230,115 290,128 350,140 410,100 470,108 530,65 560,50"
              />

              {/* Interactive Dots */}
              {[
                { cx: 50, cy: 160 }, { cx: 110, cy: 145 }, { cx: 170, cy: 152 },
                { cx: 230, cy: 115 }, { cx: 290, cy: 128 }, { cx: 350, cy: 140 },
                { cx: 410, cy: 100 }, { cx: 470, cy: 108 }, { cx: 530, cy: 65 }, { cx: 560, cy: 50 }
              ].map((pt, i) => (
                <circle key={i} cx={pt.cx} cy={pt.cy} r="4.5" fill="#ffffff" stroke="#2563eb" strokeWidth="3" />
              ))}

              {/* Date Markers */}
              <text x="50" y="195" fontSize="10" fill="#94a3b8" fontWeight="600" textAnchor="middle">13 Aug</text>
              <text x="170" y="195" fontSize="10" fill="#94a3b8" fontWeight="600" textAnchor="middle">21 Aug</text>
              <text x="290" y="195" fontSize="10" fill="#94a3b8" fontWeight="600" textAnchor="middle">29 Aug</text>
              <text x="410" y="195" fontSize="10" fill="#94a3b8" fontWeight="600" textAnchor="middle">06 Sep</text>
              <text x="540" y="195" fontSize="10" fill="#94a3b8" fontWeight="600" textAnchor="middle">12 Sep</text>
            </svg>
          </div>
        </div>

        {/* Quick Stats Panel */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <h2 className="card-title">Network Vital Stats</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Active Members */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Active Distributors</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>892 (71%)</span>
              </div>
              <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: '71%', height: '100%', background: '#10b981', borderRadius: '9999px' }} />
              </div>
            </div>

            {/* Inactive Members */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Inactive Distributors</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>364 (29%)</span>
              </div>
              <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: '29%', height: '100%', background: '#ef4444', borderRadius: '9999px' }} />
              </div>
            </div>

            {/* Total Orders */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShoppingBag size={18} color="#8b5cf6" />
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Total Package Orders</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>1,024</span>
            </div>

            {/* Product Sales */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShoppingCart size={18} color="#0284c7" />
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Repurchase Turnover</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>₹ 12,40,000</span>
            </div>

            {/* Ranks Achieved */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={18} color="#f59e0b" />
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Rank Achievers</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>32</span>
            </div>
          </div>
        </div>
      </div>

      {/* Split Tables: Recent Registrations & Recent Payouts */}
      <div className="dashboard-grid-2">
        {/* Recent Registrations Table */}
        <div className="dashboard-card" style={{ padding: '24px 0 0' }}>
          <div className="card-header-row" style={{ padding: '0 24px 16px' }}>
            <h2 className="card-title">Recent Enrollments</h2>
            <button onClick={() => onNavigate('members')} className="primary-btn" style={{ fontSize: '11px', padding: '6px 12px' }}>
              View All
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member</th>
                  <th>Package</th>
                  <th>BV</th>
                  <th>Placement</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRegistrations.map((row, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{row.id}</div>
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: row.package === 'Elite' ? '#fdf2f8' : row.package === 'Premium' ? '#f5f3ff' : '#eff6ff',
                        color: row.package === 'Elite' ? '#db2777' : row.package === 'Premium' ? '#7c3aed' : '#2563eb'
                      }}>
                        {row.package}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#059669' }}>{row.bv}</td>
                    <td>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: row.leg === 'LEFT' ? '#2563eb' : '#10b981',
                        background: row.leg === 'LEFT' ? '#eff6ff' : '#ecfdf5',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        {row.leg}
                      </span>
                    </td>
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
        <div className="dashboard-card" style={{ padding: '24px 0 0' }}>
          <div className="card-header-row" style={{ padding: '0 24px 16px' }}>
            <h2 className="card-title">Recent Payout Transactions</h2>
            <button onClick={() => onNavigate('wallet-payouts')} className="primary-btn" style={{ fontSize: '11px', padding: '6px 12px' }}>
              View All
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Net Payout</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPayouts.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.member}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{row.id}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{row.net}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>Gross: {row.amount}</div>
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>{row.date}</td>
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

      {/* Quick Action Strip */}
      <div className="quick-actions-strip">
        <button onClick={onOpenAddMember} className="quick-action-btn">
          <UserPlus size={20} color="#2563eb" />
          <span>Add Member</span>
        </button>

        <button onClick={() => onNavigate('genealogy')} className="quick-action-btn">
          <GitMerge size={20} color="#059669" />
          <span>Genealogy Tree</span>
        </button>

        <button onClick={() => onNavigate('income-settings')} className="quick-action-btn">
          <Zap size={20} color="#d97706" />
          <span>Rule Simulator</span>
        </button>

        <button onClick={() => onNavigate('packages')} className="quick-action-btn">
          <Package size={20} color="#7c3aed" />
          <span>Joining Packages</span>
        </button>

        <button onClick={() => onNavigate('wallet-payouts')} className="quick-action-btn">
          <Wallet size={20} color="#dc2626" />
          <span>Process Payouts</span>
        </button>
      </div>
    </div>
  );
};
