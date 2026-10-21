import React, { useEffect, useId } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

/* Shared UI primitives. Styling lives in styles/components.css. */

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export const PageHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, icon, actions }) => (
  <div className="page-header">
    <div className="page-header-main">
      {icon && <span className="page-header-icon" aria-hidden="true">{icon}</span>}
      <div style={{ minWidth: 0 }}>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="page-header-actions">{actions}</div>}
  </div>
);

export const Badge: React.FC<{
  tone?: Tone;
  icon?: React.ReactNode;
  size?: 'md' | 'lg';
  className?: string;
  title?: string;
  children: React.ReactNode;
}> = ({ tone = 'neutral', icon, size = 'md', className = '', title, children }) => (
  <span className={`badge badge-${tone}${size === 'lg' ? ' badge-lg' : ''} ${className}`.trim()} title={title}>
    {icon}
    {children}
  </span>
);

const STATUS_TONES: Record<string, Tone> = {
  PAID: 'success', ACTIVE: 'success', VERIFIED: 'success', COMPLETED: 'success', CREDITED: 'success',
  VERIFIED_AND_PAID: 'success', SUCCESS: 'success', ELIGIBLE: 'success', SETTLED: 'success',
  APPROVED: 'primary', PROCESSING: 'primary', PAYMENT_INSTRUCTIONS_SENT: 'info', SUBMITTED: 'info',
  PAYMENT_SUBMITTED: 'accent',
  PENDING: 'warning', REQUESTED: 'warning', ON_HOLD: 'warning', UNDER_REVIEW: 'warning',
  REJECTED: 'danger', FAILED: 'danger', CANCELLED: 'danger', BLOCKED: 'danger', SUSPENDED: 'danger',
  INACTIVE: 'neutral', DRAFT: 'neutral',
};

/** Tone for a backend status string (case/space insensitive); unknown statuses are neutral */
export const statusTone = (status?: string | null): Tone =>
  STATUS_TONES[String(status || '').trim().toUpperCase().replace(/[\s-]+/g, '_')] || 'neutral';

const formatStatus = (status: string) =>
  status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export const StatusBadge: React.FC<{ status?: string | null; label?: React.ReactNode; icon?: React.ReactNode }> = ({
  status,
  label,
  icon,
}) => (
  <Badge tone={statusTone(status)} icon={icon}>
    {label ?? formatStatus(String(status || '—'))}
  </Badge>
);

const ALERT_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export const Alert: React.FC<{
  tone?: 'success' | 'error' | 'warning' | 'info';
  title?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ tone = 'info', title, onClose, className = '', style, children }) => {
  const Icon = ALERT_ICONS[tone];
  return (
    <div className={`alert alert-${tone} ${className}`.trim()} role={tone === 'error' ? 'alert' : 'status'} style={style}>
      <Icon size={18} aria-hidden="true" />
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        {children}
      </div>
      {onClose && (
        <button type="button" className="alert-close" onClick={onClose} aria-label="Dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: React.ReactNode;
  text?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}> = ({ icon, title, text, action, compact }) => (
  <div className="empty-state" style={compact ? { padding: 'var(--space-6) var(--space-4)' } : undefined}>
    {icon && <span className="empty-state-icon" aria-hidden="true">{icon}</span>}
    <div className="empty-state-title">{title}</div>
    {text && <div className="empty-state-text">{text}</div>}
    {action}
  </div>
);

export const LoadingState: React.FC<{ label?: string; compact?: boolean }> = ({ label = 'Loading…', compact }) => (
  <div className="loading-state" role="status" style={compact ? { padding: 'var(--space-6) var(--space-4)' } : undefined}>
    <span className="spinner" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  block,
  ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  block?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className={`segmented${block ? ' is-block' : ''}`} role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          disabled={opt.disabled}
          className={`segmented-btn${value === opt.value ? ' is-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon}
          <span>{opt.label}</span>
          {!!opt.count && <span className="segmented-count">{opt.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const Field: React.FC<{
  label?: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  full?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, error, full, htmlFor, children }) => (
  <div className={`form-field${full ? ' is-full' : ''}`}>
    {label && (
      <label className="form-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="required" aria-hidden="true">*</span>}
      </label>
    )}
    {children}
    {error ? <span className="form-error">{error}</span> : hint ? <span className="form-hint">{hint}</span> : null}
  </div>
);

export const Modal: React.FC<{
  open?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
  /** Block closing via backdrop / Escape (e.g. while a request is in flight) */
  dismissible?: boolean;
  bodyStyle?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ open = true, onClose, title, subtitle, size = 'md', footer, dismissible = true, bodyStyle, children }) => {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        {title && (
          <div className="modal-header">
            <div style={{ minWidth: 0 }}>
              <h2 className="modal-title" id={titleId}>{title}</h2>
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close" disabled={!dismissible}>
              <X size={18} />
            </button>
          </div>
        )}
        <div className="modal-body" style={bodyStyle}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};
