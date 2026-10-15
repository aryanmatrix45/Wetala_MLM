import React, { useState, useEffect } from 'react';
import { HomeSlider } from '../components/HomeSlider';
import { api, type SliderItem } from '../services/api';
import { RefreshCw, Sparkles, ShoppingBag, Users, Wallet } from 'lucide-react';

interface MemberHomePageProps {
  user?: any;
  token?: string | null;
  onNavigate?: (tab: string) => void;
}

export const MemberHomePage: React.FC<MemberHomePageProps> = ({
  user,
  onNavigate,
}) => {
  const [sliders, setSliders] = useState<SliderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSliders = async () => {
    try {
      const res = await api.getSliders();
      if (res.status && res.data) {
        setSliders(res.data.all || []);
      }
    } catch (err) {
      console.error('[MemberHomePage] Failed to fetch sliders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSliders();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSliders();
  };

  return (
    <div className="page-body member-home-page">
      {/* Home Header */}
      <div className="welcome-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="badge-tag-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} /> Member Portal
            </span>
          </div>
          <h1 className="page-title">Welcome Home, {user?.name || 'Distributor'}!</h1>
          <p className="page-subtitle">
            Explore Panchveda Wellness announcements, latest offers, and business opportunities.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin-anim' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Hero Slider Section */}
      <div className="home-slider-section" style={{ marginBottom: 30 }}>
        {loading ? (
          <div className="home-slider-skeleton">
            <div className="slider-shimmer" />
          </div>
        ) : (
          <HomeSlider sliders={sliders} autoPlayInterval={5000} />
        )}
      </div>

      {/* Quick Launch Cards (Extensible container for upcoming member sections) */}
      <div className="home-quick-actions-grid" style={{ marginBottom: 24 }}>
        <div
          className="dashboard-card home-feature-card"
          onClick={() => onNavigate && onNavigate('dashboard')}
          style={{ cursor: 'pointer' }}
        >
          <div className="home-card-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
            <Wallet size={24} />
          </div>
          <div className="home-card-info">
            <h3 className="home-card-title">Compensation Dashboard</h3>
            <p className="home-card-desc">Track your matched pairs, BV ledger, wallet, and payouts.</p>
          </div>
        </div>

        <div
          className="dashboard-card home-feature-card"
          onClick={() => onNavigate && onNavigate('member-products')}
          style={{ cursor: 'pointer' }}
        >
          <div className="home-card-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <ShoppingBag size={24} />
          </div>
          <div className="home-card-info">
            <h3 className="home-card-title">Products & Store</h3>
            <p className="home-card-desc">Shop wellness products and earn repurchase Business Volume.</p>
          </div>
        </div>

        <div
          className="dashboard-card home-feature-card"
          onClick={() => onNavigate && onNavigate('genealogy')}
          style={{ cursor: 'pointer' }}
        >
          <div className="home-card-icon-wrap" style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#eab308' }}>
            <Users size={24} />
          </div>
          <div className="home-card-info">
            <h3 className="home-card-title">Network & Team Tree</h3>
            <p className="home-card-desc">View your binary placement tree and direct sponsor lineage.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default MemberHomePage;
