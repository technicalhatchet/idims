import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

/** Collapsible glass panel — matches Equipment / Notes mobile WO styling. */
export default function WoMobileGlassSection({
  title,
  summary,
  isOpen,
  onToggle,
  children,
  className = '',
}) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left active:bg-white/[0.05] touch-manipulation"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          {summary && !isOpen && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{summary}</p>
          )}
        </div>
        {isOpen ? (
          <FaChevronUp className="h-4 w-4 text-gray-500 flex-shrink-0" aria-hidden />
        ) : (
          <FaChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" aria-hidden />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-white/10 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

export const WO_MOBILE_FIELD_LABEL = 'text-xs font-medium text-gray-500';
export const WO_MOBILE_FIELD_VALUE = 'text-sm text-gray-100';
export const WO_MOBILE_SECTION_LABEL = 'text-sm font-medium text-gray-400 mb-2';
