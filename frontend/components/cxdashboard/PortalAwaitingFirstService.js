import Link from 'next/link';
import { FaCalendarCheck, FaTools } from 'react-icons/fa';
import { MARKETING_PHONE_DISPLAY, MARKETING_PHONE_TEL } from '../../constants/marketingSiteContent';
import { MarketingPhoneIcon } from '../marketing/MarketingCta';

/**
 * Shown when the user is signed in but has no linked client record (no service yet).
 */
export default function PortalAwaitingFirstService() {
  return (
    <div className="max-w-lg mx-auto text-center py-12 md:py-16 px-6 rounded-2xl border border-white/[0.08] bg-[#0D1525]">
      <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center mx-auto mb-5">
        <FaTools className="w-7 h-7 text-cyan-400" aria-hidden />
      </div>
      <p className="text-gray-300 text-base leading-relaxed mb-8">
        Your account is set up after your first service with us. Book a diagnostic and we&apos;ll save your
        appliances for you.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
        <Link
          href="/book"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00D4FF] text-[#0A0F1E] px-6 py-3 text-sm font-bold hover:bg-cyan-300 transition-colors"
        >
          <FaCalendarCheck className="w-4 h-4" aria-hidden />
          Book Service
        </Link>
        <a
          href={`tel:${MARKETING_PHONE_TEL}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 text-white px-6 py-3 text-sm font-semibold hover:bg-white/5 transition-colors"
        >
          <MarketingPhoneIcon className="w-4 h-4 text-orange-400" />
          {MARKETING_PHONE_DISPLAY}
        </a>
      </div>
    </div>
  );
}
