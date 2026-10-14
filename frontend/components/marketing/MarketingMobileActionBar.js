import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaPhone } from 'react-icons/fa';
import { MARKETING_PHONE_TEL } from '../../constants/marketingSiteContent';

const HIDDEN_PREFIXES = ['/book', '/cxdashboard', '/techboard', '/dashboard', '/solomon', '/login', '/api'];

function isMarketingRoute(pathname) {
  if (!pathname) return false;
  return !HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function MarketingMobileActionBar() {
  const router = useRouter();

  if (!isMarketingRoute(router.pathname)) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-white/10 bg-[#000208]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Call or book"
    >
      <div className="grid grid-cols-2 gap-2 p-3 max-w-lg mx-auto">
        <a
          href={`tel:${MARKETING_PHONE_TEL}`}
          className="flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-[0_0_20px_rgba(34,211,238,0.25)] active:from-cyan-400 active:to-cyan-500"
        >
          <FaPhone className="w-4 h-4" />
          Call
        </a>
        <Link
          href="/book"
          prefetch={false}
          className="flex items-center justify-center py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 shadow-[0_0_20px_rgba(249,115,22,0.35)] active:from-orange-400 active:to-orange-500"
        >
          Book
        </Link>
      </div>
    </div>
  );
}
