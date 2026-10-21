import React from 'react';
import { api } from '../services/api';
import { isBVNotification, isCappingNotification } from '../hooks/useNotifications';

interface NotificationListProps {
  notifications: any[];
  onNavigate?: (tab: string) => void;
  /** Called before navigating, e.g. to close the dropdown or sheet */
  onItemClick?: () => void;
  maxHeight?: string;
}

/**
 * Notification items shared by the header dropdown (desktop) and the bottom-nav sheet (mobile).
 * Clicking an item marks it read and opens Packages (capping alerts), the BV Wallet (BV transfers) or Withdrawals.
 */
export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onNavigate,
  onItemClick,
  maxHeight = '340px',
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight, overflowY: 'auto' }}>
    {notifications.length > 0 ? (
      notifications.map((n, i) => {
        const isCapping = isCappingNotification(n);
        const isBV = isBVNotification(n);

        return (
          <button
            type="button"
            key={n._id || i}
            onClick={() => {
              onItemClick?.();
              if (n._id || n.notificationId) {
                api.markNotificationRead(n._id || n.notificationId).catch(() => {});
              }
              onNavigate?.(isCapping ? 'packages' : isBV ? 'bv-wallet' : 'withdrawals');
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              background: isCapping ? (n.isRead ? 'var(--warning-light)' : 'var(--danger-light)') : (n.isRead ? 'var(--surface-subtle)' : 'var(--primary-light)'),
              border: `1.5px solid ${isCapping ? (n.isRead ? 'var(--warning-border)' : 'var(--danger-border)') : (n.isRead ? 'var(--border-color)' : 'var(--primary-border)')}`,
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--fs-sm)',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 700, color: isCapping ? 'var(--danger-hover)' : 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                {isCapping && <span aria-hidden="true">⚠️</span>}
                <span>{n.title}</span>
              </span>
              {isCapping ? (
                <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 800, background: 'var(--danger-soft)', color: 'var(--danger)', padding: '1px 6px', borderRadius: 'var(--radius-xs)' }}>
                  UPGRADE
                </span>
              ) : n.amount ? (
                <span style={{ color: 'var(--success)' }}>{isBV ? `${n.amount.toLocaleString('en-IN')} BV` : `₹${n.amount.toLocaleString()}`}</span>
              ) : null}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginTop: '3px', lineHeight: '1.4' }}>{n.message}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-light)', fontSize: 'var(--fs-2xs)', marginTop: '4px' }}>
              <span>{n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              {isCapping && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Upgrade Package →</span>}
            </div>
          </button>
        );
      })
    ) : (
      <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-light)', fontSize: 'var(--fs-sm)' }}>
        No recent notifications
      </div>
    )}
  </div>
);

export default NotificationList;
