import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import {
  FaHome, FaCalendarAlt, FaTools, FaFileInvoiceDollar, FaShieldAlt,
  FaFolder, FaEnvelope, FaLaptop, FaCog, FaHeadset
} from 'react-icons/fa';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: FaHome, href: '/cxdashboard' },
  { id: 'appointments', label: 'My Appointments', icon: FaCalendarAlt, href: '/cxdashboard/appointments' },
  { id: 'repairs', label: 'My Repairs', icon: FaTools, href: '/cxdashboard/repairs' },
  { id: 'invoices', label: 'Invoices & Payments', icon: FaFileInvoiceDollar, href: '/cxdashboard/invoices' },
  { id: 'warranty', label: 'Warranty', icon: FaShieldAlt, href: '/cxdashboard/warranty' },
  /*{ id: 'documents', label: 'Documents', icon: FaFolder, href: '/cxdashboard/documents' },*/
  { id: 'messages', label: 'Messages', icon: FaEnvelope, href: '/cxdashboard/messages', badge: 2 },
  { id: 'devices', label: 'My Devices', icon: FaLaptop, href: '/cxdashboard/devices' },
  { id: 'settings', label: 'Account Settings', icon: FaCog, href: '/cxdashboard/settings' },
];

export default function Sidebar() {
  const router = useRouter();
  const currentPath = router.pathname;

  return (
    <div className="w-64 h-screen fixed left-0 top-0 bg-[#0a0e17]/95 backdrop-blur-xl border-r border-white/5 flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <Link href="/cxdashboard" className="flex items-center gap-3">
        <img src="/arblock.png" alt="Atomic Repair" style={{ height: '48px', objectFit: 'contain' }} />
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Client Portal</p>
        </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.href || 
            (item.href !== '/cxdashboard' && currentPath.startsWith(item.href));

          return (
            <Link key={item.id} href={item.href}>
              <motion.div
                whileHover={{ x: 4 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {item.badge && (
                  <span className="w-5 h-5 rounded-full bg-cyan-500 text-[10px] font-bold text-white flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Support Card */}
      <div className="p-4">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <FaHeadset className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">Need Help?</p>
              <p className="text-gray-500 text-xs">Our support team is here for you.</p>
            </div>
          </div>
          <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-sm font-semibold hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}
