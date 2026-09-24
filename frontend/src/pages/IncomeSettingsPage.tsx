import { Percent, Award, Store, Users } from 'lucide-react';

export const IncomeSettingsPage: React.FC = () => {
  return (
    <div className="page-body">
      <div className="welcome-header">
        <div>
          <h1 className="page-title">Income & Compensation Engine Settings</h1>
          <p className="page-subtitle">Configure binary matching formulas, repurchase slabs, rewards, and franchise percentages.</p>
        </div>
        <button className="primary-btn" onClick={() => alert('Settings saved successfully!')}>
          Save Configurations
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
        {/* Card 1: Binary Income & Welcome Pool (Page 1) */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <div className="card-title-group">
              <Percent size={18} color="#2563eb" />
              <h2 className="card-title">1. Binary Income & Welcome Pool (Notebook P.1)</h2>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                First Pair Qualification Ratio
              </label>
              <input 
                type="text" 
                defaultValue="1:2 or 2:1 (Subsequent 1:1)" 
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Binary Commission (%)
                </label>
                <input 
                  type="text" 
                  defaultValue="20%" 
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Daily Capping Limit (₹)
                </label>
                <input 
                  type="text" 
                  defaultValue="₹ 4,000 / Day" 
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Welcome Pool (Company Turnover)
                </label>
                <input 
                  type="text" 
                  defaultValue="4% Turnover" 
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Sponsor Binary Income (%)
                </label>
                <input 
                  type="text" 
                  defaultValue="20% on Direct's Payout" 
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Re-Purchase Team Bonus Slabs (Page 2) */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <div className="card-title-group">
              <Users size={18} color="#10b981" />
              <h2 className="card-title">2. Team Re-Purchase Matching Slabs (Notebook P.2)</h2>
            </div>
          </div>

          <table className="data-table" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th>L : R Volume (BV)</th>
                <th>Bonus %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1,000 : 1,000</td><td style={{ fontWeight: 700, color: '#2563eb' }}>15%</td><td><span className="status-pill status-active">Active</span></td></tr>
              <tr><td>2,500 : 2,500</td><td style={{ fontWeight: 700, color: '#2563eb' }}>10%</td><td><span className="status-pill status-active">Active</span></td></tr>
              <tr><td>7,500 : 7,500</td><td style={{ fontWeight: 700, color: '#2563eb' }}>7%</td><td><span className="status-pill status-active">Active</span></td></tr>
              <tr><td>20,000 : 20,000</td><td style={{ fontWeight: 700, color: '#2563eb' }}>6%</td><td><span className="status-pill status-active">Active</span></td></tr>
              <tr><td>35,000 : 35,000</td><td style={{ fontWeight: 700, color: '#2563eb' }}>5%</td><td><span className="status-pill status-active">Active</span></td></tr>
              <tr><td>70,000 : 70,000</td><td style={{ fontWeight: 700, color: '#2563eb' }}>4%</td><td><span className="status-pill status-active">Active</span></td></tr>
              <tr><td>150,000 : 150,000</td><td style={{ fontWeight: 700, color: '#2563eb' }}>3%</td><td><span className="status-pill status-active">Active</span></td></tr>
              <tr><td>300,000 : 300,000</td><td style={{ fontWeight: 700, color: '#2563eb' }}>2%</td><td><span className="status-pill status-active">Active</span></td></tr>
            </tbody>
          </table>
        </div>

        {/* Card 3: Franchise / Stock Point Slabs (Page 2) */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <div className="card-title-group">
              <Store size={18} color="#d97706" />
              <h2 className="card-title">3. Franchise / Stock Point Model (Notebook P.2)</h2>
            </div>
          </div>

          <table className="data-table" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th>Stock Point Investment</th>
                <th>Franchise Margin</th>
                <th>Upline Sponsor Bonus</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>₹ 50,000</td><td style={{ fontWeight: 700, color: '#d97706' }}>5%</td><td>2%</td></tr>
              <tr><td>₹ 1,00,000</td><td style={{ fontWeight: 700, color: '#d97706' }}>8%</td><td>2%</td></tr>
              <tr><td>₹ 5,00,000</td><td style={{ fontWeight: 700, color: '#d97706' }}>10%</td><td>2%</td></tr>
              <tr><td>₹ 10,00,000</td><td style={{ fontWeight: 700, color: '#d97706' }}>12%</td><td>2%</td></tr>
            </tbody>
          </table>
        </div>

        {/* Card 4: Rank Rewards Milestone (Page 3) */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <div className="card-title-group">
              <Award size={18} color="#7c3aed" />
              <h2 className="card-title">4. Rank & Rewards Milestone (Notebook P.3)</h2>
            </div>
          </div>

          <table className="data-table" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th>Pair Ratio (L : R)</th>
                <th>Reward Cash Payout</th>
                <th>Pool Contribution</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>5 : 5 Pairs</td><td style={{ fontWeight: 700, color: '#10b981' }}>₹ 1,000</td><td>₹ 200 per joining</td></tr>
              <tr><td>10 : 10 Pairs</td><td style={{ fontWeight: 700, color: '#10b981' }}>₹ 2,000</td><td>₹ 200 per joining</td></tr>
              <tr><td>50 : 50 Pairs</td><td style={{ fontWeight: 700, color: '#10b981' }}>₹ 10,000</td><td>₹ 200 per joining</td></tr>
              <tr><td>100 : 100 Pairs</td><td style={{ fontWeight: 700, color: '#10b981' }}>₹ 25,000</td><td>₹ 200 per joining</td></tr>
              <tr><td>250 : 250 Pairs</td><td style={{ fontWeight: 700, color: '#10b981' }}>₹ 60,000</td><td>₹ 200 per joining</td></tr>
              <tr><td>500 : 500 Pairs</td><td style={{ fontWeight: 700, color: '#10b981' }}>₹ 1,50,000</td><td>₹ 200 per joining</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
