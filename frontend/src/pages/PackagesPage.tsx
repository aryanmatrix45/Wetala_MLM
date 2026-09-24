import { Package, CheckCircle2 } from 'lucide-react';

export const PackagesPage: React.FC = () => {
  const packages = [
    {
      id: '1',
      name: 'Starter',
      price: '₹ 3,000',
      bv: '1,250 BV',
      capping: '₹ 4,000 / Day',
      popular: false,
      features: [
        '1,250 Business Volume (BV)',
        '1:2 or 2:1 First pair matching qualification',
        '20% Binary matching payout',
        'Daily capping limit ₹ 4,000',
        'Eligible for Welcome Reward Pool (4%)'
      ]
    },
    {
      id: '2',
      name: 'Executive',
      price: '₹ 6,500',
      bv: '2,500 BV',
      capping: '₹ 4,000 / Day',
      popular: true,
      features: [
        '2,500 Business Volume (BV)',
        'Standard binary qualification',
        '20% Binary matching payout',
        'Daily capping limit ₹ 4,000',
        'Consultancy Bonus eligible',
        'Self purchase bonus 8%'
      ]
    },
    {
      id: '3',
      name: 'Premium',
      price: '₹ 15,000',
      bv: '5,000 BV',
      capping: '₹ 8,000 / Day',
      popular: false,
      features: [
        '5,000 Business Volume (BV)',
        'Accelerated binary points',
        '20% Binary matching payout',
        'Higher Daily Capping: ₹ 8,000',
        'Team Performance Bonus qualified',
        'Sponsor Binary Income 20%'
      ]
    },
    {
      id: '4',
      name: 'Elite',
      price: '₹ 35,000',
      bv: '12,500 BV',
      capping: '₹ 15,000 / Day',
      popular: false,
      features: [
        '12,500 Business Volume (BV)',
        'Maximum BV generation',
        '20% Binary matching payout',
        'VIP Daily Capping: ₹ 15,000',
        'Priority Rank & Lifetime Rewards',
        'Franchise stock point option'
      ]
    }
  ];

  return (
    <div className="page-body">
      <div className="welcome-header">
        <div>
          <h1 className="page-title">Joining Packages & Business Volume (BV)</h1>
          <p className="page-subtitle">Configure joining tiers, Business Volume (BV), and daily capping limits directly from notebook rules.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="dashboard-card"
            style={{
              position: 'relative',
              borderColor: pkg.popular ? '#1d72fe' : '#e2e8f0',
              borderWidth: pkg.popular ? '2px' : '1px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {pkg.popular && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                right: '20px',
                background: '#1d72fe',
                color: 'white',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '12px'
              }}>
                MOST POPULAR
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: pkg.popular ? '#eff6ff' : '#f8fafc',
                color: pkg.popular ? '#1d72fe' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Package size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{pkg.name}</h3>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>{pkg.bv}</span>
              </div>
            </div>

            <div style={{ margin: '14px 0 20px' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>{pkg.price}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Daily Capping: <strong style={{ color: '#d97706' }}>{pkg.capping}</strong>
              </div>
            </div>

            <div style={{ flex: 1, borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pkg.features.map((feat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#475569' }}>
                  <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            <button 
              className={pkg.popular ? 'primary-btn' : 'outline-btn'} 
              style={{ width: '100%', justifyContent: 'center', marginTop: '24px' }}
              onClick={() => alert(`Edit package config for ${pkg.name}`)}
            >
              Edit Package Rules
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
