import { useRouter } from 'next/router';
import { FaArrowLeft } from 'react-icons/fa';

/**
 * Minimal mobile back bar for tactical list pages (Master OPS, schedule-test).
 * Matches WO mobile dock chrome; default escape hatch is the field home hub.
 */
export default function TechMobileBackDock({
  fallbackHref = '/techboard',
  label = 'Back',
}) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  };

  return (
    <div
      className="md:hidden fixed inset-x-0 bottom-0 z-[1188] border-t border-white/10 bg-[#0B1120]/95 backdrop-blur-md px-3 pt-2 touch-manipulation"
      style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
      data-touch-surface
    >
      <button
        type="button"
        onClick={handleBack}
        className="h-10 w-full max-w-xs mx-auto rounded-xl border border-white/15 text-[11px] font-semibold uppercase tracking-wide text-gray-300 flex items-center justify-center gap-1.5 active:scale-[0.98]"
        aria-label={label}
      >
        <FaArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </button>
    </div>
  );
}

/** Reserve space above fixed back dock + safe area */
export const TECH_MOBILE_BACK_DOCK_SCROLL_PAD = 'pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))]';
