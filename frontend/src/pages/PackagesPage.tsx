import React from 'react';
import { Package, CheckCircle2 } from 'lucide-react';

export const PackagesPage: React.FC = () => {
  const packages = [
    {
      id: '1',
      name: 'Package 1 (Starter)',
      price: '₹ 3,000',
      bv: '1,250 BV',
      capping: '₹ 4,000 / Day',
      popular: false,
      color: '#3b82f6',
      bgLight: '#eff6ff',
      features: [
        '1,250 Business Volume (BV)',
        'Binary placement eligible (LEFT or RIGHT)',
        'Standard 20% binary matching payout',
        'Daily binary capping ₹ 4,000',
        'Eligible for Welcome Bonus (Configurable 4:1)'
      ]
    },
    {
      id: '2',
      name: 'Package 2 (Executive)',
      price: '₹ 6,500',
      bv: '2,500 BV',
      capping: '₹ 4,000 / Day',
      popular: true,
      color: '#10b981',
      bgLight: '#ecfdf5',
      features: [
        '2,500 Business Volume (BV)',
        'Binary matching payout 20%',
        'Daily binary capping ₹ 4,000',
        'Eligible for Consultancy Bonus',
        '8% Self-purchase bonus on repurchase',
        'Direct sponsor binary income 20%'
      ]
    },
    {
      id: '3',
      name: 'Package 3 (Professional)',
      price: '₹ 12,000',
      bv: '5,000 BV',
      capping: '₹ 4,000 / Day',
      popular: false,
      color: '#8b5cf6',
      bgLight: '#f5f3ff',
      features: [
        '5,000 Business Volume (BV)',
        'Accelerated leg volume propagation',
        'Standard 20% binary matching payout',
        'Team Performance bonus qualification',
        'Lifetime reward qualification tracker',
        '2% Upline bonus on team purchases'
      ]
    },
    {
      id: '4',
      name: 'Package 4 (Elite VIP)',
      price: '₹ 24,000',
      bv: '10,000 BV',
      capping: '₹ 4,000 / Day',
      popular: false,
      color: '#f59e0b',
      bgLight: '#fffbeb',
      features: [
        '10,000 Business Volume (BV)',
        'Maximum volume generation per placement',
        'Standard 20% binary matching payout',
        'Franchise / Stockist incentive ready',
        'Priority qualification for Gold & Diamond ranks',
        'Royalty pool participation candidate'
      ]
    }
  ];

  return (
    <div className="page-body">
      <div className="welcome-header">
        <div>
          <h1 className="page-title">Joining Packages & Business Volume (BV)</h1>
          <p className="page-subtitle">Configured packages derived directly from handwritten compensation rules (₹3,000 to ₹24,000).</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="dashboard-card"
            style={{
              position: 'relative',
              borderColor: pkg.popular ? '#2563eb' : '#e2e8f0',
              borderWidth: pkg.popular ? '2px' : '1px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: pkg.popular ? '0 12px 28px -4px rgba(37, 99, 235, 0.15)' : 'var(--shadow-card)',
              transition: 'all 0.25s ease'
            }}
          >
            {pkg.popular && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                right: '24px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white',
                fontSize: '10.5px',
                fontWeight: 800,
                padding: '4px 12px',
                borderRadius: '9999px',
                letterSpacing: '0.8px',
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.4)'
              }}>
                MOST POPULAR
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: pkg.bgLight,
                color: pkg.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 10px ${pkg.color}25`
              }}>
                <Package size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{pkg.name}</h3>
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: 800, 
                  color: pkg.color,
                  background: pkg.bgLight,
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  {pkg.bv}
                </span>
              </div>
            </div>

            <div style={{ margin: '14px 0 20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                {pkg.price}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Daily Payout Cap: <strong style={{ color: '#d97706' }}>{pkg.capping}</strong>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pkg.features.map((feat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#475569' }}>
                  <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            <button 
              className={pkg.popular ? 'primary-btn' : 'outline-btn'} 
              style={{ width: '100%', justifyContent: 'center', marginTop: '26px' }}
              onClick={() => alert(`Package rules for ${pkg.name}: ${pkg.bv} Business Volume at ${pkg.price}.`)}
            >
              Configure Tier Rules
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
