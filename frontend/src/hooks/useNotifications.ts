import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

/**
 * Polls the latest notifications for the signed-in user (admin or member).
 * Called once in App and shared by the top header and the mobile bottom nav.
 */
export function useNotifications(user?: { memberId?: string; role?: string } | null) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const isAdmin = user?.role === 'superadmin';

  const reload = useCallback(() => {
    const request = isAdmin
      ? api.getAdminNotifications()
      : user?.memberId
        ? api.getMemberNotifications(user.memberId)
        : null;
    if (!request) return;

    request
      .then((res: any) => {
        if (res?.status && res?.data) {
          setNotifications(res.data.slice(0, 5));
          setUnreadCount(res.unreadCount || 0);
        }
      })
      .catch(() => {});
  }, [isAdmin, user?.memberId]);

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 15000);
    return () => clearInterval(interval);
  }, [reload]);

  return { notifications, unreadCount, isAdmin, reload };
}

/** BV Wallet notifications (BV received, reversals) open the BV Wallet. */
export const isBVNotification = (n: any): boolean =>
  Boolean(n?.metadata?.module === 'BV_WALLET' || String(n?.type || '').startsWith('BV_'));

/** Notifications about capping limits link to package upgrades instead of payouts. */
export const isCappingNotification = (n: any): boolean =>
  Boolean(
    n?.title?.toLowerCase().includes('capping') ||
      n?.message?.toLowerCase().includes('capping') ||
      n?.metadata?.action === 'UPGRADE_PACKAGE'
  );
