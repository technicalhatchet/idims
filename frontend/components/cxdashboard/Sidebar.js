import { useEffect } from 'react';
import Link from 'next/link';
import PortalBrandLogo from './PortalBrandLogo';
import { portalIconClasses } from './portalIconClasses';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaHome, FaCalendarAlt, FaTools, FaFileInvoiceDollar, FaShieldAlt,
  FaEnvelope, FaCog, FaHeadset, FaTimes, FaBoxOpen, FaFolder, FaUser, FaSignOutAlt,
} from 'react-icons/fa';
import { portalSignOut } from './portalAuth';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: FaHome, href: '/cxdashboard' },
  { id: 'appointments', label: 'My Appointments', icon: FaCalendarAlt, href: '/cxdashboard/appointments' },
  { id: 'repairs', label: 'My Repairs', icon: FaTools, href: '/cxdashboard/repairs' },
  { id: 'invoices', label: 'Invoices & Payments', icon: FaFileInvoiceDollar, href: '/cxdashboard/invoices' },
  { id: 'documents', label: 'Documents', icon: FaFolder, href: '/cxdashboard/documents' },
  { id: 'warranty', label: 'Warranty', icon: FaShieldAlt, href: '/cxdashboard/warranty' },
  { id: 'messages', label: 'Messages', icon: FaEnvelope, href: '/cxdashboard/messages' },
  { id: 'appliances', label: 'My Appliances', icon: FaBoxOpen, href: '/cxdashboard/appliances' },
  { id: 'settings', label: 'Account Settings', icon: FaCog, href: '/cxdashboard/settings' },
];

const DRAWER_NAV_ITEMS = NAV_ITEMS.filter((item) => item.id !== 'settings');

function userInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
}

export default function Sidebar({ open = false, onClose, user }) {
  const router = useRouter();
  const currentPath = router.pathname;
  const displayName = user?.name || 'Guest';
  const email = user?.email || '';
  const initials = user?.initials || userInitials(displayName);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const main = document.querySelector('main');
    if (main) main.setAttribute('inert', '');
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (main) main.removeAttribute('inert');
    };
  }, [open, onClose]);

  const desktopHeader = (
    <div className="p-4 sm:p-6 border-b border-white/5">
      <PortalBrandLogo variant="sidebar-desktop" href="/cxdashboard" onNavigate={onClose} />
    </div>
  );

  const navList = (items) => (
    <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto overscroll-contain">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentPath === item.href
          || (item.href !== '/cxdashboard' && currentPath.startsWith(item.href));

        return (
          <Link key={item.id} href={item.href} onClick={onClose}>
            <motion.div
              whileHover={{ x: 4 }}
              className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl cursor-pointer transition-all ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className={`${portalIconClasses.navItem} shrink-0`} aria-hidden />
              <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
            </motion.div>
          </Link>
        );
      })}
    </nav>
  );

  const helpCard = (
    <div className="p-3 sm:p-4 border-t border-white/5 lg:border-t-0">
      <div className="p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
            <FaHeadset className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium">Need Help?</p>
            <p className="text-gray-500 text-xs truncate">Our support team is here for you.</p>
          </div>
        </div>
        <a
          href="tel:4197941689"
          onClick={onClose}
          className="block w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-sm font-semibold hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all text-center"
        >
          Contact Support
        </a>
      </div>
    </div>
  );

  const drawerAccountFooter = (
    <>
      <div className="px-3 pb-2 pt-1 space-y-0.5 border-t border-white/5">
        <Link
          href="/cxdashboard/settings"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <FaUser className={`${portalIconClasses.navItem} shrink-0`} aria-hidden />
          <span className="text-sm font-medium">My Profile</span>
        </Link>
        <Link
          href="/cxdashboard/settings"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <FaCog className={`${portalIconClasses.navItem} shrink-0`} aria-hidden />
          <span className="text-sm font-medium">Account Settings</span>
        </Link>
      </div>
      <div className="p-3 pt-2 border-t border-white/10 bg-black/20">
        <button
          type="button"
          onClick={() => {
            onClose();
            portalSignOut();
          }}
          className="flex w-full items-center gap-3 px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-left font-medium"
        >
          <FaSignOutAlt className={`${portalIconClasses.navItem} shrink-0`} aria-hidden />
          <span className="text-sm">Sign Out</span>
        </button>
      </div>
    </>
  );

  const drawerUserHeader = (
    <div className="px-4 pt-3 pb-4 border-b border-white/5 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">{displayName}</p>
          {email ? (
            <p className="text-gray-500 text-xs truncate mt-0.5">{email}</p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className={`${portalIconClasses.headerTap} rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white shrink-0`}
        aria-label="Close menu"
      >
        <FaTimes className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <motion.aside
        initial={false}
        animate={{ x: open ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[min(88vw,300px)] flex-col bg-[#0a0e17]/98 backdrop-blur-xl border-r border-white/5 lg:hidden ${open ? '' : 'pointer-events-none'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="md:hidden">{drawerUserHeader}</div>
        <div className="hidden md:flex lg:hidden items-center justify-end px-3 py-2 border-b border-white/5">
          <button
            type="button"
            onClick={onClose}
            className={`${portalIconClasses.headerTap} rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white`}
            aria-label="Close menu"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>
        {navList(DRAWER_NAV_ITEMS)}
        {helpCard}
        <div className="mt-auto">{drawerAccountFooter}</div>
      </motion.aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-50 h-screen w-64 flex-col bg-[#0a0e17]/95 backdrop-blur-xl border-r border-white/5">
        {desktopHeader}
        {navList(NAV_ITEMS)}
        {helpCard}
      </aside>
    </>
  );
}
