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
              background: isCapping ? (n.isRead ? '#fffbeb' : '#fef2f2') : (n.isRead ? '#f8fafc' : '#eff6ff'),
              border: `1.5px solid ${isCapping ? (n.isRead ? '#fde68a' : '#fca5a5') : (n.isRead ? '#e2e8f0' : '#bfdbfe')}`,
              borderRadius: '8px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 700, color: isCapping ? '#b91c1c' : '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                {isCapping && <span aria-hidden="true">⚠️</span>}
                <span>{n.title}</span>
              </span>
              {isCapping ? (
                <span style={{ fontSize: '10px', fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: '4px' }}>
                  UPGRADE
                </span>
              ) : n.amount ? (
                <span style={{ color: '#059669' }}>{isBV ? `${n.amount.toLocaleString('en-IN')} BV` : `₹${n.amount.toLocaleString()}`}</span>
              ) : null}
            </div>
            <div style={{ color: '#475569', fontSize: '11px', marginTop: '3px', lineHeight: '1.4' }}>{n.message}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '10px', marginTop: '4px' }}>
              <span>{n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              {isCapping && <span style={{ color: '#dc2626', fontWeight: 700 }}>Upgrade Package →</span>}
            </div>
          </button>
        );
      })
    ) : (
      <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: '12px' }}>
        No recent notifications
      </div>
    )}
  </div>
);

export default NotificationList;
