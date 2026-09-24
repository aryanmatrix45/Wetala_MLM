import { useState } from 'react';
import { Check } from 'lucide-react';

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

  return (
    <div className="page-body">
      <div className="welcome-header">
        <div>
          <h1 className="page-title">Wallet & Payout Requests</h1>
          <p className="page-subtitle">Process distributor payout requests with automatic 5% TDS and 5% Admin deductions.</p>
        </div>
      </div>

      <div className="dashboard-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Txn ID</th>
              <th>Member Name</th>
              <th>Gross Amount</th>
              <th>TDS (5%)</th>
              <th>Admin Fee (5%)</th>
              <th>Net Payable</th>
              <th>Request Date</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((row) => (
              <tr key={row.id}>
                <td style={{ fontWeight: 600, color: '#1d72fe' }}>{row.id}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{row.member}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{row.memberId}</div>
                </td>
                <td style={{ fontWeight: 700 }}>₹ {row.amount.toLocaleString()}</td>
                <td style={{ color: '#ef4444' }}>- ₹ {row.tds}</td>
                <td style={{ color: '#ef4444' }}>- ₹ {row.admin}</td>
                <td style={{ fontWeight: 800, color: '#10b981' }}>₹ {row.net.toLocaleString()}</td>
                <td>{row.date}</td>
                <td>
                  <span className={`status-pill ${row.status === 'Paid' ? 'status-paid' : 'status-pending'}`}>
                    {row.status}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  {row.status === 'Pending' ? (
                    <button 
                      onClick={() => handleApprove(row.id)}
                      className="primary-btn" 
                      style={{ fontSize: '11px', padding: '5px 12px', background: '#10b981' }}
                    >
                      <Check size={14} /> Pay Now
                    </button>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Processed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
