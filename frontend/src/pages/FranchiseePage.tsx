import React, { useEffect, useState, useCallback } from 'react';
import { Alert, Badge, EmptyState, LoadingState, PageHeader, StatusBadge } from '../components/ui';
import { CheckCircle2, MapPin, RefreshCw, Store } from 'lucide-react';
import { api } from '../services/api';
import type { FranchiseeOverview, FranchiseeStoreItem } from '../services/api';

interface FranchiseePageProps {
  user: any;
  token?: string | null;
}

const StoreDetails: React.FC<{ store: FranchiseeStoreItem }> = ({ store }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <Badge tone="neutral">{store.storeId}</Badge>
      <strong style={{ color: 'var(--text-main)' }}>{store.storeName}</strong>
    </div>
    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Owner: {store.ownerName}</div>
    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
      <MapPin size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <span>
        {store.fullAddress}, {store.city} - {store.pinCode}
      </span>
    </div>
  </div>
);

export const FranchiseePage: React.FC<FranchiseePageProps> = ({ token }) => {
  const [overview, setOverview] = useState<FranchiseeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getFranchiseeOverview(token || undefined);
      setOverview(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load franchisee stores');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingStoreIds = new Set(
    (overview?.requests || []).filter((r) => r.status === 'pending').map((r) => r.storeId)
  );
  const ownsStore = (overview?.ownedStores.length || 0) > 0;

  const handleRequest = async (store: FranchiseeStoreItem) => {
    setSubmittingId(store._id);
    setError('');
    setSuccess('');
    try {
      const res = await api.requestFranchiseeStore(store.storeId, token || undefined);
      setSuccess(res.message);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="page-body">
      <PageHeader
        icon={<Store size={20} />}
        title="Franchisee Store"
        subtitle="Your franchisee store and how to request one"
        actions={
          <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />

      {error && (
        <Alert tone="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert tone="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {loading && !overview ? (
        <LoadingState label="Loading franchisee stores…" />
      ) : overview ? (
        <>
          {ownsStore ? (
            <section className="dashboard-card" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <CheckCircle2 size={20} color="var(--success)" aria-hidden="true" />
                <strong style={{ color: 'var(--text-main)' }}>
                  Franchisee store purchased
                </strong>
              </div>
              <p style={{ margin: '0 0 var(--space-3)', color: 'var(--text-muted)' }}>
                You have bought {overview.ownedStores.length > 1 ? 'these franchisee stores' : 'this franchisee store'}.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {overview.ownedStores.map((store) => (
                  <div key={store._id} className="dashboard-card" style={{ margin: 0 }}>
                    <StoreDetails store={store} />
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <Alert tone="info" style={{ marginBottom: 'var(--space-4)' }}>
              You have not purchased a franchisee store yet. You can request one from the stores below.
            </Alert>
          )}

          <section className="dashboard-card" style={{ marginBottom: 'var(--space-4)' }}>
            <h2 className="page-title" style={{ fontSize: 'var(--fs-md)', marginBottom: 'var(--space-3)' }}>
              Available Franchisee Stores
            </h2>
            {overview.availableStores.length === 0 ? (
              <EmptyState
                compact
                icon={<Store size={28} />}
                title="No stores available right now"
                text="New franchisee stores will appear here when they are added."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {overview.availableStores.map((store) => {
                  const isPending = pendingStoreIds.has(store.storeId);
                  return (
                    <div key={store._id} className="dashboard-card" style={{ margin: 0 }}>
                      <StoreDetails store={store} />
                      <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'flex-end' }}>
                        {isPending ? (
                          <StatusBadge status="pending" label="Request pending" />
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={submittingId === store._id || ownsStore}
                            onClick={() => handleRequest(store)}
                            title={ownsStore ? 'You already own a franchisee store' : undefined}
                          >
                            {submittingId === store._id ? 'Submitting…' : 'Request to buy'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {overview.requests.length > 0 && (
            <section className="dashboard-card">
              <h2 className="page-title" style={{ fontSize: 'var(--fs-md)', marginBottom: 'var(--space-3)' }}>
                My Requests
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {overview.requests.map((req) => (
                  <div
                    key={req._id}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}
                  >
                    <span style={{ color: 'var(--text-main)' }}>
                      {req.storeId} · {new Date(req.createdAt).toLocaleDateString('en-IN')}
                      {req.adminNote && req.status === 'rejected' ? ` — ${req.adminNote}` : ''}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
};

export default FranchiseePage;
