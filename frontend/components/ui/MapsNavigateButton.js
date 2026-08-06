import { openGoogleMapsDestination } from '../../utils/google-maps-service';
import {
  WO_DETAILS_ICON_BTN_CLASS,
  WO_DETAILS_ICON_BTN_STYLE,
} from '../work_orders/woMobileDetailsTokens';

const DEFAULT_CLASS =
  'tech-btn-glow flex items-center justify-center w-8 h-8 rounded-md shrink-0 overflow-hidden relative active:scale-95 transition-transform';

const DEFAULT_STYLE = {
  background: 'rgba(13, 21, 37, 0.25)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(34,211,238,0.3)',
};

/** Icon-only button — opens Google Maps directions to an address (techboard / schedule modal). */
export default function MapsNavigateButton({
  address,
  ariaLabel = 'Open address in Google Maps',
  variant = 'default',
  className,
}) {
  const dest = (address || '').trim();
  if (!dest) return null;

  const isMinimal = variant === 'minimal';
  const btnClass = className ?? (isMinimal ? WO_DETAILS_ICON_BTN_CLASS : DEFAULT_CLASS);
  const btnStyle = isMinimal ? WO_DETAILS_ICON_BTN_STYLE : DEFAULT_STYLE;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openGoogleMapsDestination(dest);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className={btnClass}
      style={btnStyle}
    >
      {!isMinimal && <span className="tech-btn-sweep" />}
      <svg
        viewBox="0 0 24 24"
        className={`relative z-10 ${isMinimal ? 'w-[18px] h-[18px]' : 'w-3.5 h-3.5'}`}
        style={{
          stroke: isMinimal ? 'rgba(34, 211, 238, 0.85)' : '#22D3EE',
          strokeWidth: isMinimal ? 1.5 : 1.75,
          fill: 'none',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          filter: isMinimal ? undefined : 'drop-shadow(0 0 4px rgba(0,212,255,0.7))',
        }}
        aria-hidden
      >
        <polygon points="3 11 22 2 13 21 11 13 3 11" />
      </svg>
    </button>
  );
}
