import React, { useEffect, useState, useCallback } from 'react';
import { Alert, EmptyState, Field, LoadingState, Modal, PageHeader, SegmentedControl, StatusBadge } from '../components/ui';
import { Pencil, RefreshCw, Store, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { api } from '../services/api';
import type { FranchiseeRequestItem, FranchiseeStoreItem } from '../services/api';

interface AdminFranchiseePageProps {
  user: any;
  token?: string | null;
}

type StoreForm = {
  storeId: string;
  storeName: string;
  ownerName: string;
  city: string;
  fullAddress: string;
  pinCode: string;
};

const EMPTY_FORM: StoreForm = {
  storeId: '',
  storeName: '',
  ownerName: '',
  city: '',
  fullAddress: '',
  pinCode: '',
};

const REQUIRED_FIELDS: Array<{ key: keyof StoreForm; label: string }> = [
  { key: 'storeId', label: 'Store ID' },
  { key: 'storeName', label: 'Store Name' },
  { key: 'ownerName', label: 'Owner Name' },
  { key: 'city', label: 'City' },
  { key: 'fullAddress', label: 'Full Address' },
  { key: 'pinCode', label: 'Pin Code' },
];

type View = 'stores' | 'requests';

interface MemberSearchResult {
  memberId: string;
  name: string;
  mobile?: string;
  city?: string;
}

export const AdminFranchiseePage: React.FC<AdminFranchiseePageProps> = ({ token }) => {
  const [view, setView] = useState<View>('stores');
  const [stores, setStores] = useState<FranchiseeStoreItem[]>([]);
  const [requests, setRequests] = useState<FranchiseeRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Store create / edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<FranchiseeStoreItem | null>(null);
  const [form, setForm] = useState<StoreForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Assign-to-member modal
  const [assignStore, setAssignStore] = useState<FranchiseeStoreItem | null>(null);
  const [assignMemberId, setAssignMemberId] = useState('');
  const [assignError, setAssignError] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<MemberSearchResult[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);

  // Reject modal
  const [rejectRequest, setRejectRequest] = useState<FranchiseeRequestItem | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [storeRes, requestRes] = await Promise.all([
        api.adminFranchiseeRequest('GET', '/stores', undefined, token || undefined),
        api.adminFranchiseeRequest('GET', '/requests', undefined, token || undefined),
      ]);
      setStores(storeRes.data || []);
      setRequests(requestRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load franchisee stores');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced member search by Member ID or name, used by the Assign Member dialog
  useEffect(() => {
    const q = memberQuery.trim();
    if (!assignStore || !q) {
      setMemberResults([]);
      return;
    }
    setSearchingMembers(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.adminFranchiseeRequest(
          'GET',
          `/members/search?q=${encodeURIComponent(q)}`,
          undefined,
          token || undefined
        );
        setMemberResults(res.data || []);
      } catch (err: any) {
        setAssignError(err.message || 'Member search failed');
      } finally {
        setSearchingMembers(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [memberQuery, assignStore, token]);

  // Runs an admin action, shows its message and reloads the lists
  const runAction = async (id: string, action: () => Promise<any>, message: string) => {
    setBusyId(id);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(message);
      await load();
      return true;
    } catch (err: any) {
      setError(err.message || 'Action failed');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const openCreate = () => {
    setEditingStore(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (store: FranchiseeStoreItem) => {
    setEditingStore(store);
    setForm({
      storeId: store.storeId,
      storeName: store.storeName,
      ownerName: store.ownerName,
      city: store.city,
      fullAddress: store.fullAddress,
      pinCode: store.pinCode,
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async () => {
    const missing = REQUIRED_FIELDS.find((f) => !form[f.key].trim());
    if (missing) {
      setFormError(`${missing.label} is required`);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingStore) {
        await api.adminFranchiseeRequest('PUT', `/stores/${editingStore._id}`, form, token || undefined);
        setSuccess('Franchisee store updated');
      } else {
        await api.adminFranchiseeRequest('POST', '/stores', form, token || undefined);
        setSuccess('Franchisee store created');
      }
      setFormOpen(false);
      await load();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save store');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (store: FranchiseeStoreItem) => {
    if (!window.confirm(`Delete store ${store.storeId} (${store.storeName})?`)) return;
    runAction(store._id, () => api.adminFranchiseeRequest('DELETE', `/stores/${store._id}`, undefined, token || undefined), 'Franchisee store deleted');
  };

  const handleUnassign = (store: FranchiseeStoreItem) => {
    if (!window.confirm(`Make ${store.storeId} available again? It is currently bought by ${store.buyerMemberId}.`)) return;
    runAction(store._id, () => api.adminFranchiseeRequest('POST', `/stores/${store._id}/unassign`, undefined, token || undefined), 'Store is available again');
  };

  const handleAssign = async () => {
    if (!assignStore) return;
    if (!assignMemberId.trim()) {
      setAssignError('Search and select a member first');
      return;
    }
    setAssignError('');
    const ok = await runAction(
      assignStore._id,
      () =>
        api.adminFranchiseeRequest(
          'POST',
          `/stores/${assignStore._id}/assign`,
          { memberId: assignMemberId.trim().toUpperCase() },
          token || undefined
        ),
      `Store ${assignStore.storeId} assigned to ${assignMemberId.trim().toUpperCase()}`
    );
    if (ok) {
      setAssignStore(null);
      setAssignMemberId('');
    }
  };

  const handleApprove = (request: FranchiseeRequestItem) => {
    runAction(
      request._id,
      () => api.adminFranchiseeRequest('POST', `/requests/${request._id}/approve`, undefined, token || undefined),
      `Approved. ${request.storeId} assigned to ${request.memberId}`
    );
  };

  const handleReject = async () => {
    if (!rejectRequest) return;
    const ok = await runAction(
      rejectRequest._id,
      () =>
        api.adminFranchiseeRequest(
          'POST',
          `/requests/${rejectRequest._id}/reject`,
          { adminNote: rejectNote },
          token || undefined
        ),
      'Request rejected'
    );
    if (ok) {
      setRejectRequest(null);
      setRejectNote('');
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  return (
    <div className="page-body">
      <PageHeader
        icon={<Store size={20} />}
        title="Franchisee Stores"
        subtitle="Manage franchisee stores, assign them to members and review member requests"
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}>
              <RefreshCw size={16} /> Refresh
            </button>
            {view === 'stores' && (
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                Add Store
              </button>
            )}
          </div>
        }
      />

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <SegmentedControl
          ariaLabel="View"
          value={view}
          onChange={(next) => setView(next as View)}
          options={[
            { value: 'stores', label: `Stores (${stores.length})` },
            { value: 'requests', label: `Member Requests (${pendingRequests.length})` },
          ]}
        />
      </div>

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

      {loading && stores.length === 0 && requests.length === 0 ? (
        <LoadingState label="Loading franchisee stores…" />
      ) : view === 'stores' ? (
        stores.length === 0 ? (
          <EmptyState
            icon={<Store size={28} />}
            title="No franchisee stores yet"
            text="Add a store with its ID, name, owner, city, address and pin code."
            action={
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                Add Store
              </button>
            }
          />
        ) : (
          <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-framed" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Store ID</th>
                    <th>Store Name</th>
                    <th>Owner</th>
                    <th>City</th>
                    <th>Pin Code</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store) => (
                    <tr key={store._id}>
                      <td>{store.storeId}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{store.storeName}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{store.fullAddress}</div>
                      </td>
                      <td>{store.ownerName}</td>
                      <td>{store.city}</td>
                      <td>{store.pinCode}</td>
                      <td>
                        {store.status === 'sold' ? (
                          <StatusBadge status="sold" label={`Bought by ${store.buyerMemberId}${store.buyerName ? ` (${store.buyerName})` : ''}`} />
                        ) : (
                          <StatusBadge status="available" label="Available" />
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {store.status === 'sold' ? (
                            <button type="button" className="btn btn-sm btn-secondary" disabled={busyId === store._id} onClick={() => handleUnassign(store)}>
                              <UserMinus size={14} /> Unassign
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => {
                                setAssignStore(store);
                                setAssignMemberId('');
                                setMemberQuery('');
                                setMemberResults([]);
                                setAssignError('');
                              }}
                            >
                              <UserPlus size={14} /> Assign Member
                            </button>
                          )}
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => openEdit(store)}>
                            <Pencil size={14} /> Edit
                          </button>
                          {store.status !== 'sold' && (
                            <button type="button" className="btn btn-sm btn-danger-outline" disabled={busyId === store._id} onClick={() => handleDelete(store)}>
                              <Trash2 size={14} /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : requests.length === 0 ? (
        <EmptyState icon={<Store size={28} />} title="No member requests" text="Requests to buy a franchisee store will appear here." />
      ) : (
        <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table-framed" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Store ID</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{req.memberName || req.memberId}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{req.memberId}</div>
                    </td>
                    <td>{req.storeId}</td>
                    <td>{new Date(req.createdAt).toLocaleDateString('en-IN')}</td>
                    <td>
                      <StatusBadge status={req.status} />
                      {req.adminNote && req.status === 'rejected' && (
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{req.adminNote}</div>
                      )}
                    </td>
                    <td>
                      {req.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                          <button type="button" className="btn btn-sm btn-primary" disabled={busyId === req._id} onClick={() => handleApprove(req)}>
                            Approve &amp; Assign
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger-outline"
                            disabled={busyId === req._id}
                            onClick={() => {
                              setRejectRequest(req);
                              setRejectNote('');
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / edit store */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingStore ? `Edit ${editingStore.storeId}` : 'Add Franchisee Store'}
        size="md"
        dismissible={!saving}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingStore ? 'Save Changes' : 'Create Store'}
            </button>
          </>
        }
      >
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="form-grid">
          {REQUIRED_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} required full={f.key === 'fullAddress'} htmlFor={`fs-${f.key}`}>
              {f.key === 'fullAddress' ? (
                <textarea
                  id={`fs-${f.key}`}
                  className="form-input"
                  rows={2}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              ) : (
                <input
                  id={`fs-${f.key}`}
                  className="form-input"
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              )}
            </Field>
          ))}
        </div>
      </Modal>

      {/* Assign store to member */}
      <Modal
        open={!!assignStore}
        onClose={() => setAssignStore(null)}
        title={assignStore ? `Assign ${assignStore.storeId}` : 'Assign'}
        subtitle="Enter the Member ID of the member who bought this store"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAssignStore(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleAssign} disabled={!!assignStore && busyId === assignStore._id}>
              Assign Store
            </button>
          </>
        }
      >
        {assignError && <Alert tone="error">{assignError}</Alert>}
        <Field label="Search member" required htmlFor="fs-assign-member" hint="Search by Member ID or name, then pick the member">
          <input
            id="fs-assign-member"
            className="form-input"
            placeholder="e.g. MEM0001 or Rahul"
            value={memberQuery}
            onChange={(e) => {
              setMemberQuery(e.target.value);
              setAssignMemberId('');
            }}
            autoComplete="off"
          />
        </Field>
        {assignMemberId && (
          <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--fs-sm)', color: 'var(--text-main)' }}>
            Selected: <strong>{assignMemberId}</strong>
          </div>
        )}
        {memberQuery.trim() && !assignMemberId && (
          <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {searchingMembers ? (
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Searching…</span>
            ) : memberResults.length === 0 ? (
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>No members found</span>
            ) : (
              memberResults.map((m) => (
                <button
                  key={m.memberId}
                  type="button"
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => {
                    setAssignMemberId(m.memberId);
                    setMemberQuery(m.name ? `${m.name} (${m.memberId})` : m.memberId);
                    setMemberResults([]);
                  }}
                >
                  <strong>{m.memberId}</strong>
                  <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>{m.name}</span>
                  {m.city && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>· {m.city}</span>}
                </button>
              ))
            )}
          </div>
        )}
      </Modal>

      {/* Reject request */}
      <Modal
        open={!!rejectRequest}
        onClose={() => setRejectRequest(null)}
        title="Reject Request"
        subtitle={rejectRequest ? `${rejectRequest.memberId} → ${rejectRequest.storeId}` : undefined}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRejectRequest(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={handleReject}>
              Reject Request
            </button>
          </>
        }
      >
        <Field label="Note for the member (optional)" htmlFor="fs-reject-note">
          <textarea id="fs-reject-note" className="form-input" rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
};

export default AdminFranchiseePage;
