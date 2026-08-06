import {
  WO_DETAILS_LABEL_CLASS,
  WO_DETAILS_PRIMARY_CLASS,
  WO_DETAILS_SECONDARY_CLASS,
  WO_DETAILS_TERTIARY_CLASS,
  WO_DETAILS_SURFACE_CLASS,
  WO_DETAILS_SURFACE_STYLE,
} from './woMobileDetailsTokens';

function DetailsChevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4 text-white/[0.32] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/**
 * Minimal summary row for mobile work order Details.
 */
export default function WoMobileDetailsSummaryCard({
  label,
  title,
  subtitle,
  meta,
  icon,
  /** When true, appliance-style soft frame; otherwise icon only with faint glow. */
  iconFramed = false,
  trailing,
  onPress,
  showChevron = false,
  titleClassName = WO_DETAILS_PRIMARY_CLASS,
  className = '',
}) {
  const interactive = Boolean(onPress);
  const Wrapper = interactive ? 'button' : 'div';
  const wrapperProps = interactive
    ? {
        type: 'button',
        onClick: onPress,
        className: 'w-full text-left touch-manipulation active:opacity-90',
      }
    : { className: '' };

  return (
    <div
      className={`${WO_DETAILS_SURFACE_CLASS} ${className}`}
      style={WO_DETAILS_SURFACE_STYLE}
      data-wo-details-card
    >
      <Wrapper {...wrapperProps}>
        <div className="px-5 py-5">
          {label && <p className={WO_DETAILS_LABEL_CLASS}>{label}</p>}
          <div className={`flex items-start gap-3.5 ${label ? 'mt-3' : ''}`}>
            {icon && (
              iconFramed ? (
                <div
                  className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  {icon}
                </div>
              ) : (
                <div
                  className="flex-shrink-0 pt-0.5"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.2))' }}
                >
                  {icon}
                </div>
              )
            )}
            <div className="min-w-0 flex-1">
              {title && <p className={titleClassName}>{title}</p>}
              {subtitle && <p className={`${WO_DETAILS_SECONDARY_CLASS} mt-1`}>{subtitle}</p>}
              {meta && <p className={`${WO_DETAILS_TERTIARY_CLASS} mt-1`}>{meta}</p>}
            </div>
            <div
              className="flex items-center gap-1 shrink-0 self-center"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {trailing}
              {showChevron && <DetailsChevron />}
            </div>
          </div>
        </div>
      </Wrapper>
    </div>
  );
}
