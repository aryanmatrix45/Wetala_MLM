import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, CalendarDays, Download, IndianRupee, RefreshCw, RotateCcw, ShoppingCart, Tag } from 'lucide-react';
import { Alert, Badge, EmptyState, Field as SharedField, LoadingState, Modal, PageHeader, SegmentedControl } from '../components/ui';
import {
  api,
  type BVRateInfo,
  type CompanyEarningEntry,
  type CompanyEarningType,
  type CompanyEarningsSummary,
} from '../services/api';

interface CompanyEarningsPageProps {
  user?: any;
  token?: string | null;
}

type Tab = 'earnings' | 'rate';

// Shared with the BV Wallet page: the Super Admin login is shared, so actions record an operator
const OPERATOR_STORAGE_KEY = 'wetala_bv_operator_name';

const readStoredOperator = () => {
  try {
    return localStorage.getItem(OPERATOR_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const storeOperator = (name: string) => {
  try {
    localStorage.setItem(OPERATOR_STORAGE_KEY, name);
  } catch {
    // Per-browser convenience only
  }
};

const formatINR = (value: number | null | undefined) =>
  `₹${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatSignedINR = (value: number) => `${value < 0 ? '−' : '+'}${formatINR(Math.abs(value))}`;
const formatBV = (value: number | undefined) => `${(value || 0).toLocaleString('en-IN')} BV`;
const formatDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const TYPE_INFO: Record<CompanyEarningType, { label: string; tone: 'success' | 'danger' | 'warning' | 'primary' }> = {
  BV_SALE: { label: 'BV sale', tone: 'success' },
  BV_SALE_REVERSED: { label: 'Sale reversed', tone: 'danger' },
  BV_RETURNED: { label: 'BV returned', tone: 'warning' },
  ORDER_PAID: { label: 'Order paid', tone: 'primary' },
  ORDER_REFUNDED: { label: 'Order refunded', tone: 'danger' },
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--fs-md)',
  outline: 'none',
  background: 'var(--surface)',
  minHeight: 'var(--control-h)',
};

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div style={{ marginBottom: 'var(--space-4)' }}>
    <SharedField label={label} hint={hint}>{children}</SharedField>
  </div>
);

const KpiCard: React.FC<{ tone: 'green' | 'gold' | 'blue' | 'purple'; icon: React.ReactNode; label: string; value: string; sub?: string }> = ({
  tone,
  icon,
  label,
  value,
  sub,
}) => (
  <div className={`kpi-card kpi-card-${tone}`}>
    <div className={`kpi-icon-box kpi-icon-${tone}`}>{icon}</div>
    <div className="kpi-content">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  </div>
);

export const CompanyEarningsPage: React.FC<CompanyEarningsPageProps> = ({ user, token }) => {
  const isAdmin = user?.role?.toLowerCase() === 'superadmin';
  const authToken = token || undefined;
  const [tab, setTab] = useState<Tab>('earnings');
  const [summary, setSummary] = useState<CompanyEarningsSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSummary = useCallback(() => {
    api
      .getCompanyEarningsSummary(authToken)
      .then((res) => {
        if (res?.status && res.data) {
          setSummary(res.data);
          setSummaryError('');
        } else {
          setSummaryError(res?.message || 'Could not load earnings.');
        }
      })
      .catch(() => setSummaryError('Could not load earnings.'));
  }, [authToken]);

  useEffect(() => {
    if (isAdmin) loadSummary();
  }, [isAdmin, loadSummary, refreshKey]);

  if (!isAdmin) {
    return (
      <div className="page-body">
        <Alert tone="error">Only the Super Admin can view company earnings.</Alert>
      </div>
    );
  }

  const refreshAll = () => setRefreshKey((k) => k + 1);

  return (
    <div className="page-body">
      <PageHeader
        title="Company Earnings"
        subtitle="BV sold to members at the BV rate, plus package and product orders paid by bank or UPI, minus reversals, returns and refunds."
        actions={
          <button type="button" onClick={refreshAll} className="btn btn-secondary btn-icon" title="Refresh" aria-label="Refresh">
            <RefreshCw size={16} />
          </button>
        }
      />

      {summaryError && <Alert tone="error">{summaryError}</Alert>}
      {summary && !summary.currentRate && (
        <Alert tone="warning" title="No BV rate set">
          BV cannot be sold to members until you set the BV rate.{' '}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setTab('rate')}>
            Set BV rate
          </button>
        </Alert>
      )}

      <div className="kpi-grid">
        <KpiCard
          tone="green"
          icon={<IndianRupee size={20} />}
          label="Total earnings"
          value={formatINR(summary?.total)}
          sub={`Today ${formatINR(summary?.today)} · This week ${formatINR(summary?.thisWeek)}`}
        />
        <KpiCard tone="blue" icon={<CalendarDays size={20} />} label="This month" value={formatINR(summary?.thisMonth)} sub="Net of reversals, returns and refunds" />
        <KpiCard
          tone="purple"
          icon={<Tag size={20} />}
          label="BV sales"
          value={formatINR(summary?.bvSales.amount)}
          sub={`${formatBV(summary?.bvSales.bv)} sold · ${formatBV(summary?.netBVSold)} net of returns`}
        />
        <KpiCard
          tone="gold"
          icon={<ShoppingCart size={20} />}
          label="Package & product orders"
          value={formatINR(summary?.orders.amount)}
          sub={`${summary?.orders.count || 0} order(s) by bank / UPI`}
        />
        <KpiCard
          tone="gold"
          icon={<RotateCcw size={20} />}
          label="BV returned"
          value={formatINR(Math.abs(summary?.bvReturns.amount || 0))}
          sub={`${formatBV(summary?.bvReturns.bv)} · ${summary?.pendingReturns.count || 0} pending (${formatINR(summary?.pendingReturns.amount)})`}
        />
        <KpiCard
          tone="blue"
          icon={<ArrowDownLeft size={20} />}
          label="BV rate"
          value={summary?.currentRate ? `${formatINR(summary.currentRate.rate)} / BV` : 'Not set'}
          sub={summary?.currentRate ? `Since ${formatDateTime(summary.currentRate.createdAt)}` : 'Set it before selling BV'}
        />
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <SegmentedControl
          ariaLabel="Section"
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: 'earnings', label: 'Earnings' },
            { value: 'rate', label: 'BV rate' },
          ]}
        />
      </div>

      {tab === 'earnings' && <EarningsTable token={authToken} refreshKey={refreshKey} />}
      {tab === 'rate' && <RateSection token={authToken} current={summary?.currentRate || null} refreshKey={refreshKey} onChange={refreshAll} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Earnings entries
// ---------------------------------------------------------------------------

const EarningsTable: React.FC<{ token?: string; refreshKey: number }> = ({ token, refreshKey }) => {
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CompanyEarningEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filteredAmount, setFilteredAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [type, search, from, to]);

  const filters = { type, search: search.trim(), from, to };

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      api
        .getCompanyEarnings({ ...filters, page, limit: 20 }, token)
        .then((res: any) => {
          if (res?.status) {
            setItems(res.data || []);
            setTotal(res.total || 0);
            setTotalPages(res.totalPages || 1);
            setFilteredAmount(res.filteredAmount || 0);
            setError('');
          } else {
            setError(res?.message || 'Could not load earnings.');
          }
        })
        .catch(() => setError('Could not load earnings.'))
        .finally(() => setLoading(false));
    }, search ? 300 : 0);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, search, from, to, page, token, refreshKey]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.downloadCompanyEarningsCsv(filters, token);
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const selectStyle: React.CSSProperties = { ...inputStyle, width: 'auto', padding: '8px 10px', fontSize: 'var(--fs-base)' };
  const filtered = Boolean(type || search.trim() || from || to);

  return (
    <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-subtle)' }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle} aria-label="Type">
          <option value="">All types</option>
          {(Object.keys(TYPE_INFO) as CompanyEarningType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_INFO[t].label}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Member, order or transaction ID"
          style={{ ...inputStyle, width: 'auto', flex: '1 1 200px', padding: '8px 10px', fontSize: 'var(--fs-base)' }}
          aria-label="Search earnings"
        />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={selectStyle} aria-label="From date" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={selectStyle} aria-label="To date" />
        <button type="button" className="btn btn-sm btn-secondary" onClick={exportCsv} disabled={exporting || total === 0}>
          <Download size={14} />
          <span>{exporting ? 'Exporting…' : 'Export CSV'}</span>
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', padding: '10px 16px', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
        <span>{total} entr{total === 1 ? 'y' : 'ies'}</span>
        <span>
          {filtered ? 'Filtered total' : 'Total'}: <strong style={{ color: filteredAmount < 0 ? 'var(--danger-hover)' : 'var(--text-main)' }}>{formatINR(filteredAmount)}</strong>
        </span>
      </div>

      {error ? (
        <div style={{ padding: '0 16px 16px' }}>
          <Alert tone="error" style={{ marginBottom: 0 }}>{error}</Alert>
        </div>
      ) : loading && items.length === 0 ? (
        <LoadingState label="Loading earnings…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<IndianRupee size={22} />}
          title={filtered ? 'No entries match these filters' : 'No earnings yet'}
          text={filtered ? undefined : 'Earnings appear when you sell BV to a member or mark a bank / UPI order as paid.'}
        />
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Member</th>
                <th style={{ textAlign: 'right' }}>BV</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Source</th>
                <th>Operator / note</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.entryId}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.createdAt)}</td>
                  <td>
                    <Badge tone={TYPE_INFO[e.type]?.tone ?? 'neutral'}>{TYPE_INFO[e.type]?.label || e.type}</Badge>
                  </td>
                  <td>
                    {e.memberName} <span style={{ color: 'var(--text-light)' }}>({e.memberId})</span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {e.bv.toLocaleString('en-IN')}
                    {e.rate !== null && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>@ {formatINR(e.rate)}</div>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap', color: e.amount < 0 ? 'var(--danger-hover)' : 'var(--success-hover)' }}>
                    {formatSignedINR(e.amount)}
                  </td>
                  <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 'var(--fs-sm)' }}>
                    {e.sourceId}
                    {e.paymentMode && <div style={{ fontFamily: 'inherit', color: 'var(--text-muted)' }}>{e.paymentMode}</div>}
                  </td>
                  <td style={{ maxWidth: '240px' }}>
                    {(e.performedBy.operatorName || e.performedBy.email) && <div style={{ fontWeight: 600 }}>{e.performedBy.operatorName || e.performedBy.email}</div>}
                    {e.note && <div style={{ color: 'var(--text-muted)' }}>{e.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', padding: '12px 16px' }}>
          <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <button type="button" className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// BV rate
// ---------------------------------------------------------------------------

const RateSection: React.FC<{ token?: string; current: BVRateInfo | null; refreshKey: number; onChange: () => void }> = ({
  token,
  current,
  refreshKey,
  onChange,
}) => {
  const [rate, setRate] = useState('');
  const [note, setNote] = useState('');
  const [operatorName, setOperatorName] = useState(readStoredOperator);
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [history, setHistory] = useState<BVRateInfo[]>([]);

  useEffect(() => {
    api
      .getBVRateHistory(token)
      .then((res) => {
        if (res?.status) setHistory(res.data || []);
      })
      .catch(() => {});
  }, [token, refreshKey]);

  const rateNumber = Number(rate);
  const validationError =
    !rate || !Number.isFinite(rateNumber) || rateNumber <= 0
      ? 'Enter a rate greater than ₹0.'
      : Math.abs(Math.round(rateNumber * 100) - rateNumber * 100) > 1e-6
        ? 'Use at most two decimal places.'
        : current && Math.round(rateNumber * 100) === current.ratePaise
          ? 'That is already the current rate.'
          : !operatorName.trim()
            ? 'Enter your name as operator.'
            : '';

  const submit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      storeOperator(operatorName.trim());
      const res = await api.setBVRate({ rate: rateNumber, note: note.trim(), operatorName: operatorName.trim(), password }, token);
      setPassword('');
      if (res?.status) {
        setConfirming(false);
        setMessage({ tone: 'success', text: res.message });
        setRate('');
        setNote('');
        onChange();
      } else {
        setMessage({ tone: 'error', text: res?.message || 'Could not change the rate.' });
        if (!/password/i.test(res?.message || '')) setConfirming(false);
      }
    } catch {
      setConfirming(false);
      setMessage({ tone: 'error', text: 'Network error. Check the rate history before retrying.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="dashboard-card" style={{ maxWidth: '640px' }}>
        <div className="card-header-row" style={{ marginBottom: '12px' }}>
          <h2 className="card-title">BV rate</h2>
        </div>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 0 }}>
          The price of 1 BV when you send BV to a member. Each BV you send adds BV × rate to Super Admin earnings. Changing the rate only affects
          future sales. Package and product prices are not affected.
        </p>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginBottom: '16px' }}>
          Current rate: {current ? `${formatINR(current.rate)} per BV` : 'not set'}
        </div>
        {message && (
          <Alert tone={message.tone} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}
        <Field label={current ? 'New rate (₹ per BV)' : 'Rate (₹ per BV)'}>
          <input type="number" min={0.01} step={0.01} value={rate} onChange={(e) => setRate(e.target.value)} style={inputStyle} placeholder="e.g. 1.00" />
        </Field>
        <Field label="Note (optional)">
          <input type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} placeholder="e.g. New price from November" />
        </Field>
        <Field label="Operator name" hint="Who is changing the rate on the shared Super Admin account.">
          <input type="text" maxLength={60} value={operatorName} onChange={(e) => setOperatorName(e.target.value)} style={inputStyle} />
        </Field>
        {rate && validationError && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--warning-hover)', marginBottom: '10px' }}>{validationError}</div>}
        <button type="button" className="btn btn-primary" disabled={!!validationError} onClick={() => setConfirming(true)}>
          {current ? 'Change rate' : 'Set rate'}
        </button>
      </div>

      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header-row" style={{ padding: '14px 16px', margin: 0, borderBottom: '1px solid var(--border-color)' }}>
          <h2 className="card-title">Rate history</h2>
        </div>
        {history.length === 0 ? (
          <EmptyState compact title="No rate set yet" />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Set on</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th>Set by</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={h.rateId}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(h.createdAt)}
                      {i === 0 && <Badge tone="success" className="ml-2">Current</Badge>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(h.rate)}</td>
                    <td>{h.setBy.operatorName || h.setBy.email}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{h.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirming && (
        <Modal title="Confirm BV rate" size="sm" onClose={() => !submitting && setConfirming(false)} dismissible={!submitting}>
          <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-body)', marginTop: 0 }}>
            Set the BV rate to <strong>{formatINR(rateNumber)} per BV</strong>
            {current ? ` (was ${formatINR(current.rate)})` : ''}? BV sent from now on is valued at this rate.
          </p>
          {message?.tone === 'error' && <Alert tone="error">{message.text}</Alert>}
          <Field label="Super Admin password">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password && !submitting) submit();
              }}
              autoFocus
            />
          </Field>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-sm btn-secondary" disabled={submitting} onClick={() => setConfirming(false)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" disabled={submitting || !password} onClick={submit}>
              {submitting ? 'Saving…' : 'Confirm rate'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default CompanyEarningsPage;
