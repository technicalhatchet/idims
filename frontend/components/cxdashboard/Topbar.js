import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBell, FaChevronDown, FaCog, FaSignOutAlt, FaBars } from 'react-icons/fa';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '@auth0/nextjs-auth0/client';
import { formatDistanceToNow, format } from 'date-fns';
import { portalFetch, getPortalSessionToken } from '../../utils/portalFetch';
import { parseApiDateTime } from '../../utils/parseApiDateTime';
import PortalBrandLogo from './PortalBrandLogo';
import { portalIconClasses } from './portalIconClasses';
import { buildPortalNotificationsFromWorkOrders } from '../../utils/portalNotifications';
import { getPortalImpersonateClientName } from '../../utils/portalPreview';
import { portalSignOut } from './portalAuth';

const MOBILE_HEADER_SIDE = 'w-11';

function formatNotificationTime(createdAt) {
  const date = parseApiDateTime(createdAt);
  if (!date) return '';
  try {
    const relative = formatDistanceToNow(date, { addSuffix: true });
    const absolute = format(date, 'MMM d, h:mm a');
    return `${relative} · ${absolute}`;
  } catch {
    return '';
  }
}

export default function Topbar({
  user: userProp,
  onMenuClick,
  title = 'Client Portal',
  workOrders = [],
}) {
  const router = useRouter();
  const { user: auth0User } = useUser();
  const [portalName, setPortalName] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [apiNotifications, setApiNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const previewName = getPortalImpersonateClientName();
    const stored = previewName || sessionStorage.getItem('portal_client_name');
    if (stored) setPortalName(stored.replace(/\s*\([^)]*\)\s*$/, '').trim());
  }, []);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const token = await getPortalSessionToken();
      if (!token) return;

      const data = await portalFetch(`notifications?limit=20`, token);
      const items = data.notifications || data.items || [];
      setApiNotifications(
        items.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message || n.content || '',
          time: formatNotificationTime(n.created_at),
          unread: !n.is_read,
          relatedType: n.related_type,
          relatedId: n.related_id || n.reference_id,
        })),
      );
    } catch {
      setApiNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const workOrderAlerts = useMemo(() => {
    return buildPortalNotificationsFromWorkOrders(workOrders).map((n) => ({
      ...n,
      time: n.created_at ? formatNotificationTime(n.created_at) : '',
    }));
  }, [workOrders]);

  const notifications = useMemo(() => {
    const seen = new Set();
    const merged = [];
    [...workOrderAlerts, ...apiNotifications].forEach((n) => {
      if (seen.has(n.id)) return;
      seen.add(n.id);
      merged.push(n);
    });
    return merged;
  }, [workOrderAlerts, apiNotifications]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (showNotifications) loadNotifications();
  }, [showNotifications, loadNotifications]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    }
    function onPointerDown(e) {
      if (showNotifications && notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [showNotifications, showUserMenu]);

  const markNotificationRead = async (notificationId) => {
    if (String(notificationId).startsWith('parts-')) return;
    try {
      const token = await getPortalSessionToken();
      if (!token) return;
      await portalFetch(`notifications/${notificationId}/read`, token, { method: 'PUT' });
      setApiNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, unread: false } : n)),
      );
    } catch {
      // Non-blocking
    }
  };

  const handleNotificationClick = async (notification) => {
    if (notification.unread) {
      await markNotificationRead(notification.id);
    }
    setShowNotifications(false);

    if (notification.relatedType === 'work_order' && notification.relatedId) {
      router.push(`/cxdashboard/repairs?work_order=${notification.relatedId}`);
      return;
    }
    if (notification.relatedType === 'invoice') {
      router.push('/cxdashboard/invoices');
    }
  };

  const displayName = userProp?.name || portalName
    || (auth0User ? `${auth0User.given_name || ''} ${auth0User.family_name || ''}`.trim() || auth0User.name : 'Guest');
  const initials = displayName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  const unreadCount = notifications.filter((n) => n.unread).length;

  const openNotifications = () => {
    setShowUserMenu(false);
    setShowNotifications((v) => !v);
  };

  const openUserMenu = () => {
    setShowNotifications(false);
    setShowUserMenu((v) => !v);
  };

  return (
    <header
      className="sticky top-0 z-30 border-b border-white/5 bg-[#0a0e17]/80 backdrop-blur-xl pt-[env(safe-area-inset-top)] -mt-[env(safe-area-inset-top)]"
    >
      <div className="relative flex items-center min-h-[4.25rem] max-h-[4.5rem] lg:min-h-16 lg:max-h-none px-3 sm:px-4 lg:px-8">
        <div className={`lg:hidden ${MOBILE_HEADER_SIDE} shrink-0 z-10`}>
          <button
            type="button"
            onClick={onMenuClick}
            className={`${portalIconClasses.headerTap} rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-all`}
            aria-label="Open menu"
          >
            <FaBars className="w-5 h-5" />
          </button>
        </div>

        <h1 className="hidden lg:block min-w-0 flex-1 text-lg font-semibold text-white truncate pr-4">
          {title}
        </h1>

        <div
          className="lg:hidden absolute inset-0 flex items-center justify-center pointer-events-none px-[3.25rem] sm:px-14"
        >
          <div className="pointer-events-auto min-w-0 flex justify-center max-w-full">
            <PortalBrandLogo variant="header-mobile" href="/cxdashboard" />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0 z-10">
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={openNotifications}
              className={`relative ${portalIconClasses.headerTap} rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all`}
              aria-label="Notifications"
              aria-expanded={showNotifications}
            >
              <FaBell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-[#0a0e17]" aria-hidden />
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="fixed lg:absolute right-4 lg:right-0 top-[calc(4.25rem+env(safe-area-inset-top))] lg:top-12 w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-[#0d1117] border border-white/10 shadow-xl overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-white/5">
                    <h3 className="text-white font-semibold">Notifications</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notificationsLoading && notifications.length === 0 ? (
                      <p className="p-4 text-gray-500 text-sm">Loading…</p>
                    ) : notifications.length === 0 ? (
                      <p className="p-4 text-gray-500 text-sm">No notifications yet.</p>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleNotificationClick(notification)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleNotificationClick(notification);
                            }
                          }}
                          className={`p-4 border-b border-white/5 hover:bg-white/5 cursor-pointer ${
                            notification.unread ? 'bg-cyan-500/5' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {notification.unread && (
                              <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                            )}
                            <div className={notification.unread ? '' : 'ml-5'}>
                              <p className="text-white text-sm font-medium">{notification.title}</p>
                              <p className="text-gray-400 text-xs mt-1">{notification.message}</p>
                              {notification.time && (
                                <p className="text-gray-500 text-xs mt-1">{notification.time}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative hidden md:block" ref={userMenuRef}>
            <button
              type="button"
              onClick={openUserMenu}
              className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 min-h-11 rounded-xl hover:bg-white/5 transition-all"
              aria-label="User menu"
              aria-expanded={showUserMenu}
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {initials}
              </div>
              <span className="text-white text-sm font-medium hidden lg:block max-w-[8rem] truncate">{displayName}</span>
              <FaChevronDown className="w-3 h-3 text-gray-400 hidden sm:block" />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 top-12 w-48 rounded-xl bg-[#0d1117] border border-white/10 shadow-xl overflow-hidden z-50"
                >
                  <Link href="/cxdashboard/settings" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-white/5 hover:text-white">
                    <FaCog className="w-4 h-4" />
                    <span className="text-sm">Settings</span>
                  </Link>
                  <div className="border-t border-white/5">
                    <button
                      type="button"
                      onClick={portalSignOut}
                      className="flex w-full items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 text-left"
                    >
                      <FaSignOutAlt className="w-4 h-4" />
                      <span className="text-sm">Sign Out</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
