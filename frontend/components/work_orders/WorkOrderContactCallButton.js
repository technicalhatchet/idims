import { useState } from 'react';

const CALL_BTN_CLASS =
  'tech-btn-glow flex items-center justify-center w-10 h-10 rounded-lg shrink-0 overflow-hidden relative active:scale-95 transition-transform';

const CALL_BTN_STYLE = {
  background: 'rgba(13, 21, 37, 0.25)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(34,211,238,0.3)',
};

const CALL_ICON = (
  <svg
    viewBox="0 0 24 24"
    className="w-4 h-4 relative z-10"
    style={{
      stroke: '#22D3EE',
      strokeWidth: 1.75,
      fill: 'none',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }}
    aria-hidden
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4A2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

/** Client / tenant call control — same behavior as techboard next-job card. */
export default function WorkOrderContactCallButton({
  clientPhone,
  clientName,
  tenantPhone,
  tenantName,
  ownerLabel = 'Call Owner',
}) {
  const [showCallOptions, setShowCallOptions] = useState(false);
  const hasClientPhone = Boolean(clientPhone);
  const hasTenantPhone = Boolean(tenantPhone);

  if (!hasClientPhone && !hasTenantPhone) return null;

  const handleCallClick = (e) => {
    e.stopPropagation();
    if (hasClientPhone && hasTenantPhone) {
      setShowCallOptions((open) => !open);
    } else if (hasClientPhone) {
      window.location.href = `tel:${clientPhone}`;
    } else if (hasTenantPhone) {
      window.location.href = `tel:${tenantPhone}`;
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCallClick}
        className={CALL_BTN_CLASS}
        style={CALL_BTN_STYLE}
        aria-label="Call contact"
      >
        <span className="tech-btn-sweep" />
        {CALL_ICON}
      </button>

      {showCallOptions && hasClientPhone && hasTenantPhone && (
        <div
          className="absolute right-0 top-full mt-2 min-w-[220px] rounded-lg overflow-hidden z-50"
          style={{
            background: 'rgba(13, 21, 37, 0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(34,211,238,0.4)',
            boxShadow: '0 0 20px rgba(0,212,255,0.3)',
          }}
        >
          <div className="p-2 space-y-1">
            <a
              href={`tel:${clientPhone}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowCallOptions(false);
              }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium">{ownerLabel}</p>
                <p className="text-xs text-gray-400 truncate">{clientName || 'Client'}</p>
              </div>
            </a>
            <a
              href={`tel:${tenantPhone}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowCallOptions(false);
              }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium">Call Tenant</p>
                <p className="text-xs text-gray-400 truncate">{tenantName || 'At property'}</p>
              </div>
            </a>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowCallOptions(false);
            }}
            className="w-full px-3 py-2 text-xs text-gray-400 hover:text-white border-t border-white/10 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
