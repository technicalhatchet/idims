import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { apiClient } from '../../utils/api-client';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function TechDeckNotificationsBell({
  align = 'right',
  onOpenChange,
}) {
  const router = useRouter();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const setOpenSafe = useCallback(
    (next) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient('/notifications?limit=20');
      const list = data?.notifications || [];
      setItems(list);
      setUnreadCount(
        typeof data?.unread_count === 'number'
          ? data.unread_count
          : list.filter((n) => !n.is_read).length
      );
    } catch (err) {
      console.error('[TechDeckNotificationsBell] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpenSafe(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, setOpenSafe]);

  const markRead = async (notification) => {
    if (!notification?.id || notification.is_read) return;
    try {
      await apiClient(`/notifications/${notification.id}/read`, { method: 'PUT' });
      setItems((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('[TechDeckNotificationsBell] mark read failed:', err);
    }
  };

  const handleItemClick = async (notification) => {
    await markRead(notification);
    setOpenSafe(false);
    if (notification.related_type === 'work_order' && notification.reference_id) {
      router.push(`/techboard/work-orders/${notification.reference_id}`);
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient('/notifications/read-all', { method: 'PUT' });
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[TechDeckNotificationsBell] mark all read failed:', err);
    }
  };

  const alignClass = align === 'left' ? 'left-0' : 'right-0';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpenSafe(next);
          if (next) loadNotifications();
        }}
        className="relative w-10 h-10 flex items-center justify-center rounded-lg transition-all hover:bg-white/5"
        style={{
          border: open ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(255,255,255,0.07)',
          background: open ? 'rgba(34,211,238,0.1)' : 'transparent',
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          style={{
            stroke: open ? '#22D3EE' : '#9CA3AF',
            strokeWidth: 1.75,
            fill: 'none',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: '#EF4444' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute mt-2 w-80 max-h-[min(24rem,70vh)] overflow-hidden rounded-lg shadow-lg flex flex-col z-[1300] ${alignClass}`}
          style={{
            background: '#0D1525',
            border: '1px solid rgba(34,211,238,0.3)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-sm font-semibold text-white">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && items.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                      style={{
                        background: !n.is_read ? 'rgba(34,211,238,0.06)' : 'transparent',
                      }}
                    >
                      <div className="flex justify-between gap-2 items-start">
                        <p className="text-sm font-medium text-gray-100 line-clamp-2">
                          {n.title || 'Notification'}
                        </p>
                        <span className="text-[10px] text-gray-500 shrink-0">
                          {formatWhen(n.created_at)}
                        </span>
                      </div>
                      {n.message && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-3">{n.message}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
