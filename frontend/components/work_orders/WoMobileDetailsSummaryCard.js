import { FaChevronRight } from 'react-icons/fa';

/**
 * Mockup-style summary row for mobile work order Details (label, icon tile, text, trailing actions).
 */
export default function WoMobileDetailsSummaryCard({
  label,
  title,
  subtitle,
  meta,
  icon,
  trailing,
  onPress,
  showChevron = false,
  titleClassName = 'text-base font-semibold text-white leading-snug',
  className = '',
}) {
  const interactive = Boolean(onPress);
  const Wrapper = interactive ? 'button' : 'div';
  const wrapperProps = interactive
    ? { type: 'button', onClick: onPress, className: 'w-full text-left touch-manipulation active:bg-white/[0.04]' }
    : { className: '' };

  return (
    <div
      className={`rounded-xl border border-white/[0.08] bg-[#0D1525]/60 overflow-hidden ${className}`}
      data-wo-details-card
    >
      <Wrapper {...wrapperProps}>
        <div className="px-4 pt-3 pb-1">
          {label && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-400/90">
              {label}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 px-4 pb-4 pt-0">
          {icon && (
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#080C14', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {title && (
              <p className={titleClassName}>{title}</p>
            )}
            {subtitle && (
              <p className="text-sm text-gray-400 mt-0.5 leading-snug">{subtitle}</p>
            )}
            {meta && (
              <p className="text-xs text-gray-500 mt-1 leading-snug">{meta}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {trailing}
            {showChevron && (
              <FaChevronRight className="h-3.5 w-3.5 text-gray-600" aria-hidden />
            )}
          </div>
        </div>
      </Wrapper>
    </div>
  );
}
