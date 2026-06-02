import { buildGoogleMapsDestinationUrl } from '../../utils/google-maps-service';

/** Icon-only button — opens Google Maps directions to an address (techboard / schedule modal). */
export default function MapsNavigateButton({
  address,
  ariaLabel = 'Open address in Google Maps',
  className = 'tech-btn-glow flex items-center justify-center w-8 h-8 rounded-md shrink-0 overflow-hidden relative active:scale-95 transition-transform',
}) {
  const dest = (address || '').trim();
  if (!dest) return null;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = buildGoogleMapsDestinationUrl(dest);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className={className}
      style={{
        background: 'rgba(13, 21, 37, 0.25)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(34,211,238,0.3)',
      }}
    >
      <span className="tech-btn-sweep" />
      <svg
        viewBox="0 0 24 24"
        className="w-3.5 h-3.5 relative z-10"
        style={{
          stroke: '#22D3EE',
          strokeWidth: 1.75,
          fill: 'none',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.7))',
        }}
        aria-hidden
      >
        <polygon points="3 11 22 2 13 21 11 13 3 11" />
      </svg>
    </button>
  );
}
