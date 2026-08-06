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

function SummaryRow({
  label,
  title,
  subtitle,
  meta,
  icon,
  trailing,
  onPress,
  showChevron,
  titleClassName = WO_DETAILS_PRIMARY_CLASS,
  dividerTop = false,
  compactPadding = false,
  iconProminent = false,
}) {
  const interactive = Boolean(onPress);
  const Wrapper = interactive ? 'button' : 'div';
  const wrapperProps = interactive
    ? {
        type: 'button',
        onClick: onPress,
        className: 'w-full text-left touch-manipulation active:opacity-90',
      }
    : { className: 'w-full' };

  return (
    <div className={dividerTop ? 'border-t border-white/[0.06]' : ''}>
      <Wrapper {...wrapperProps}>
        <div className={compactPadding ? 'px-5 py-4' : 'px-5 py-5'}>
          {label && <p className={WO_DETAILS_LABEL_CLASS}>{label}</p>}
          <div
            className={`flex gap-3.5 ${iconProminent ? 'items-center' : 'items-start'} ${label ? 'mt-2.5' : ''}`}
          >
            {icon && (
              <div
                className={`flex-shrink-0 ${iconProminent ? '' : 'pt-0.5'}`}
                style={
                  iconProminent
                    ? undefined
                    : { filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.2))' }
                }
              >
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {title && <p className={titleClassName}>{title}</p>}
              {subtitle && <p className={`${WO_DETAILS_SECONDARY_CLASS} mt-1`}>{subtitle}</p>}
              {meta && <p className={`${WO_DETAILS_TERTIARY_CLASS} mt-1`}>{meta}</p>}
            </div>
            {(trailing || showChevron) && (
              <div
                className="flex items-center gap-1 shrink-0 self-start -mt-0.5"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {trailing}
                {showChevron && <DetailsChevron />}
              </div>
            )}
          </div>
        </div>
      </Wrapper>
    </div>
  );
}

/**
 * Minimal summary row for mobile work order Details.
 */
export default function WoMobileDetailsSummaryCard(props) {
  return (
    <div
      className={`${WO_DETAILS_SURFACE_CLASS} ${props.className || ''}`}
      style={WO_DETAILS_SURFACE_STYLE}
      data-wo-details-card
    >
      <SummaryRow {...props} />
    </div>
  );
}

/** Multiple rows in one surface (e.g. Client + Service location). */
export function WoMobileDetailsSummaryCardGroup({ children, className = '' }) {
  return (
    <div
      className={`${WO_DETAILS_SURFACE_CLASS} ${className}`}
      style={WO_DETAILS_SURFACE_STYLE}
      data-wo-details-card-group
    >
      {children}
    </div>
  );
}

export { SummaryRow as WoMobileDetailsSummaryRow };
