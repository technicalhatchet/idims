import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import {
  WO_DETAILS_SURFACE_CLASS,
  WO_DETAILS_SURFACE_STYLE,
  WO_DETAILS_PAD_X,
  WO_DETAILS_PAD_Y,
  WO_DETAILS_PAD_Y_COMPACT,
} from './woMobileDetailsTokens';

function SubtleChevron({ up }) {
  const Icon = up ? FaChevronUp : FaChevronDown;
  return <Icon className="h-3.5 w-3.5 text-white/[0.28] flex-shrink-0" aria-hidden />;
}

/** Collapsible glass panel — matches Equipment / Notes mobile WO styling. */
export default function WoMobileGlassSection({
  title,
  summary,
  isOpen,
  onToggle,
  children,
  className = '',
  variant = 'default',
}) {
  const isDetails = variant === 'details';

  if (isDetails) {
    return (
      <div className={`${WO_DETAILS_SURFACE_CLASS} ${className}`} style={WO_DETAILS_SURFACE_STYLE}>
        <button
          type="button"
          onClick={onToggle}
          className={`w-full flex items-center justify-between gap-3 ${WO_DETAILS_PAD_X} ${WO_DETAILS_PAD_Y} text-left active:opacity-90 touch-manipulation`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium text-white/[0.92]">{title}</p>
            {summary && !isOpen && (
              <p className="text-[13px] text-white/40 truncate mt-1">{summary}</p>
            )}
          </div>
          <SubtleChevron up={isOpen} />
        </button>
        {isOpen && (
          <div className={`${WO_DETAILS_PAD_X} ${WO_DETAILS_PAD_Y_COMPACT} pt-0 border-t border-white/[0.05] space-y-4`}>
            {children}
          </div>
        )}
      </div>
    );
  }

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
