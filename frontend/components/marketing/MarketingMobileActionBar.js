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
          className="flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-white border border-white/20"
        >
          <FaPhone className="w-4 h-4" />
          Call
        </a>
        <Link
          href="/book"
          prefetch={false}
          className="flex items-center justify-center py-3 rounded-lg font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' }}
        >
          Book
        </Link>
      </div>
    </div>
  );
}
