import { FaChevronDown } from 'react-icons/fa';

/**
 * Collapsible billing subsection (payments, overrides). Collapsed header shows title + summary.
 */
export default function WorkOrderBillingAccordion({
  title,
  summary,
  open,
  onToggle,
  children,
  className = '',
}) {
  return (
    <div
      className={`mt-4 pt-4 border-t border-white/10 md:border-gray-200 md:dark:border-gray-700 ${className}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 text-left group"
        aria-expanded={open}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 md:text-sm md:font-medium md:normal-case md:tracking-normal md:text-gray-700 md:dark:text-gray-300">
          {title}
        </span>
        <span className="flex items-center gap-2 min-w-0">
          {!open && summary ? (
            <span className="text-xs text-gray-400 md:text-gray-500 truncate">{summary}</span>
          ) : null}
          <FaChevronDown
            className={`shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </span>
      </button>
      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </div>
  );
}
