import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBell, FaChevronDown, FaUser, FaCog, FaSignOutAlt, FaBars } from 'react-icons/fa';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';

export default function Topbar({ user: userProp, onMenuClick }) {
  const { user: auth0User } = useUser();
  const [portalName, setPortalName] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('portal_client_name');
    if (stored) setPortalName(stored);
  }, []);

  const displayName = userProp?.name || portalName
    || (auth0User ? `${auth0User.given_name || ''} ${auth0User.family_name || ''}`.trim() || auth0User.name : 'Guest');
  const firstName = displayName.split(' ')[0] || 'there';
  const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  const user = { name: displayName, initials };
  const notifications = [
    { id: 1, title: 'Appointment Confirmed', message: 'Your repair is scheduled for May 24', time: '2 hours ago', unread: true },
    { id: 2, title: 'Invoice Ready', message: 'Invoice #INV-1023 is ready for download', time: '1 day ago', unread: false },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <header
      className="sticky top-0 z-30 flex min-h-[3.5rem] sm:min-h-16 items-center justify-between gap-3 border-b border-white/5 bg-[#0a0e17]/80 backdrop-blur-xl px-4 sm:px-6 lg:px-8 pt-[env(safe-area-inset-top)] -mt-[env(safe-area-inset-top)]"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-all shrink-0"
          aria-label="Open menu"
        >
          <FaBars className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">
            Welcome back, {firstName}!
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm truncate hidden sm:block">
            Here&apos;s what&apos;s happening with your services.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Notifications"
          >
            <FaBell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-cyan-500 text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 top-12 w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-[#0d1117] border border-white/10 shadow-xl overflow-hidden z-50"
              >
                <div className="p-4 border-b border-white/5">
                  <h3 className="text-white font-semibold">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
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
                          <p className="text-gray-500 text-xs mt-1">{notification.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl hover:bg-white/5 transition-all"
            aria-label="User menu"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {user.initials}
            </div>
            <span className="text-white text-sm font-medium hidden md:block max-w-[8rem] truncate">{user.name}</span>
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
                <Link href="/cxdashboard/settings">
                  <div className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-white/5 hover:text-white cursor-pointer">
                    <FaUser className="w-4 h-4" />
                    <span className="text-sm">My Profile</span>
                  </div>
                </Link>
                <Link href="/cxdashboard/settings">
                  <div className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-white/5 hover:text-white cursor-pointer">
                    <FaCog className="w-4 h-4" />
                    <span className="text-sm">Settings</span>
                  </div>
                </Link>
                <div className="border-t border-white/5">
                  <div
                    onClick={() => { window.location.href = '/api/auth/logout?returnTo=' + encodeURIComponent(window.location.origin + '/cxdashboard/login'); }}
                    className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 cursor-pointer"
                  >
                    <FaSignOutAlt className="w-4 h-4" />
                    <span className="text-sm">Sign Out</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
