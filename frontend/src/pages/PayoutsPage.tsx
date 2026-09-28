import React, { useState } from 'react';
import { Check, Wallet, ShieldAlert, ArrowDownRight, IndianRupee } from 'lucide-react';

export const PayoutsPage: React.FC = () => {
  const [payouts, setPayouts] = useState([
    { id: 'PAY1001', member: 'Ramesh Kumar', memberId: 'MEM0120', amount: 12500, tds: 625, admin: 625, net: 11250, date: '12 Sep 2025', status: 'Paid' },
    { id: 'PAY1002', member: 'Sunita Devi', memberId: 'MEM0119', amount: 8000, tds: 400, admin: 400, net: 7200, date: '11 Sep 2025', status: 'Paid' },
    { id: 'PAY1003', member: 'Amit Sharma', memberId: 'MEM0118', amount: 6400, tds: 320, admin: 320, net: 5760, date: '10 Sep 2025', status: 'Pending' },
    { id: 'PAY1004', member: 'Pooja Singh', memberId: 'MEM0121', amount: 5200, tds: 260, admin: 260, net: 4680, date: '10 Sep 2025', status: 'Paid' },
    { id: 'PAY1005', member: 'Rajesh Meena', memberId: 'MEM0117', amount: 4800, tds: 240, admin: 240, net: 4320, date: '09 Sep 2025', status: 'Pending' }
  ]);

  const handleApprove = (id: string) => {
    setPayouts(prev => prev.map(p => p.id === id ? { ...p, status: 'Paid' } : p));
  };

  const totalGross = payouts.reduce((sum, p) => sum + p.amount, 0);
  const totalNet = payouts.reduce((sum, p) => sum + p.net, 0);
  const totalTds = payouts.reduce((sum, p) => sum + p.tds, 0);
  const totalAdmin = payouts.reduce((sum, p) => sum + p.admin, 0);

  return (
    <div className="page-body">
      <div className="welcome-header">
        <div>
          <h1 className="page-title">Wallet & Payout Requests</h1>
          <p className="page-subtitle">Process distributor payout requests with automatic 5% TDS and 5% Admin fee deductions.</p>
        </div>
      </div>

      {/* Payout Summary KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '26px' }}>
        <div className="kpi-card kpi-card-blue">
          <div className="kpi-icon-box kpi-icon-blue">
            <IndianRupee size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Gross Requested</div>
            <div className="kpi-value">₹ {totalGross.toLocaleString()}</div>
          </div>
        </div>

        <div className="kpi-card kpi-card-coral">
          <div className="kpi-icon-box kpi-icon-coral">
            <ShieldAlert size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">TDS Deducted (5%)</div>
            <div className="kpi-value">₹ {totalTds.toLocaleString()}</div>
          </div>
        </div>

        <div className="kpi-card kpi-card-gold">
          <div className="kpi-icon-box kpi-icon-gold">
            <ArrowDownRight size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Admin Fee (5%)</div>
            <div className="kpi-value">₹ {totalAdmin.toLocaleString()}</div>
          </div>
        </div>

        <div className="kpi-card kpi-card-green">
          <div className="kpi-icon-box kpi-icon-green">
            <Wallet size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Net Disbursed</div>
            <div className="kpi-value">₹ {totalNet.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Txn ID</th>
                <th>Member Details</th>
                <th>Gross Commission</th>
                <th>TDS (5%)</th>
                <th>Admin (5%)</th>
                <th>Net Payable</th>
                <th>Request Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((row) => {
                const initials = row.member.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <tr key={row.id}>
                    <td>
                      <span style={{ fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: '6px', fontSize: '12px' }}>
                        {row.id}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.member}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{row.memberId}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>₹ {row.amount.toLocaleString()}</td>
                    <td style={{ color: '#ef4444', fontWeight: 600 }}>- ₹ {row.tds}</td>
                    <td style={{ color: '#ef4444', fontWeight: 600 }}>- ₹ {row.admin}</td>
                    <td>
                      <span style={{ fontWeight: 800, color: '#059669', fontSize: '14px', background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px' }}>
                        ₹ {row.net.toLocaleString()}
                      </span>
                    </td>
                    <td style={{ fontSize: '12.5px', color: '#64748b' }}>{row.date}</td>
                    <td>
                      <span className={`status-pill ${row.status === 'Paid' ? 'status-paid' : 'status-pending'}`}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: row.status === 'Paid' ? '#10b981' : '#f59e0b'
                        }} />
                        {row.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.status === 'Pending' ? (
                        <button 
                          onClick={() => handleApprove(row.id)}
                          className="primary-btn" 
                          style={{ fontSize: '11.5px', padding: '6px 14px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                        >
                          <Check size={14} /> Pay Net
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>✓ Settled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
