import { useEffect, useState } from 'react';
import {
  LASER_BAR_BUTTON_TOP,
  LASER_BAR_HEIGHT_CSS,
  LASER_IDLE_TILE,
  LaserBarStyles,
  LaserFin,
  LaserIcon,
  LaserSeam,
  LaserTag,
  laserTileStyle,
  usePressThenRun,
} from '../navigation/LaserBarParts';

const BOOT_KEY = 'td_laser_dock_booted';

// Decided once per page load (effects can run twice in dev / on remount).
let bootDecision = null;

/** Play the laser boot once per app session (per tab). */
function useBootOncePerSession() {
  const [state, setState] = useState({ ready: false, boot: false });
  useEffect(() => {
    if (bootDecision === null) {
      let seen = false;
      try {
        seen = window.sessionStorage.getItem(BOOT_KEY) === '1';
        window.sessionStorage.setItem(BOOT_KEY, '1');
      } catch {
        seen = false;
      }
      bootDecision = !seen;
    }
    setState({ ready: true, boot: bootDecision });
  }, []);
  return state;
}

/**
 * Techboard bottom dock: three slots, middle one is the primary action.
 * slots: [{ key, label, icon, tone: 'cyan'|'orange', badge?, disabled?, onPress }]
 */
export default function TechboardLaserDock({ slots = [], tag = null }) {
  const { ready, boot } = useBootOncePerSession();
  const [pressedKey, press] = usePressThenRun(300);

  return (
    <div
      className={`lb-root fixed bottom-0 left-0 right-0 max-w-lg mx-auto${boot ? ' lb-boot' : ''}`}
      style={{
        height: LASER_BAR_HEIGHT_CSS,
        zIndex: 40,
        // Hidden for the first frame until we know whether to play the boot.
        visibility: ready ? 'visible' : 'hidden',
      }}
    >
      <LaserBarStyles />
      <LaserTag text={tag?.text} tone={tag?.tone} />
      <nav aria-label="Quick actions" className="lb-panel" style={{ position: 'absolute', inset: 0 }}>
        <LaserFin idPrefix="td-dock" />
        <div
          aria-hidden="true"
          className="lb-scan"
          style={{
            position: 'absolute',
            top: 22,
            bottom: 0,
            left: 0,
            width: 50,
            background: 'linear-gradient(90deg, rgba(165,243,252,0), rgba(165,243,252,0.35), rgba(165,243,252,0))',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: LASER_BAR_BUTTON_TOP,
            left: 'max(12px, 11%)',
            right: 'max(12px, 11%)',
            height: 44,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {slots.map((slot, i) => {
            const isPrimary = i === 1;
            const pressed = pressedKey === slot.key;
            const idle = LASER_IDLE_TILE[slot.tone] || LASER_IDLE_TILE.cyan;
            const look = isPrimary || pressed
              ? laserTileStyle(slot.tone || 'cyan', { pressed })
              : { ...idle, transform: 'translateY(0)' };
            return (
              <div key={slot.key} className="lb-btn-in" style={{ animationDelay: `${0.55 + i * 0.06}s`, minWidth: 0 }}>
                <button
                  type="button"
                  className="lb-tile"
                  disabled={slot.disabled}
                  aria-label={slot.badge != null ? `${slot.label} (${slot.badge})` : slot.label}
                  onClick={() => press(slot.key, slot.onPress)}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    width: '100%',
                    height: 44,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: isPrimary ? 700 : 600,
                    letterSpacing: isPrimary ? '0.04em' : 0,
                    textTransform: isPrimary ? 'uppercase' : 'none',
                    whiteSpace: 'nowrap',
                    touchAction: 'manipulation',
                    opacity: slot.disabled ? 0.45 : 1,
                    transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.25s, box-shadow 0.3s, color 0.2s',
                    ...look,
                  }}
                >
                  <LaserIcon name={slot.icon} size={isPrimary ? 17 : 16} strokeWidth={isPrimary ? 2.1 : 1.9} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.label}</span>
                  {slot.badge != null && slot.badge !== 0 ? (
                    <span
                      aria-hidden="true"
                      style={{
                        minWidth: 18,
                        height: 18,
                        padding: '0 5px',
                        borderRadius: 9,
                        background: '#FF8A1F',
                        color: '#1A0A00',
                        fontSize: 10,
                        fontWeight: 800,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {slot.badge}
                    </span>
                  ) : null}
                  {pressed ? <LaserSeam tone={slot.tone} /> : null}
                </button>
              </div>
            );
          })}
        </div>
      </nav>
      <div
        aria-hidden="true"
        className="lb-laser"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: '#F0FFFF', boxShadow: '0 0 6px #A5F3FC, 0 0 18px #22D3EE, 0 0 40px #22D3EE', pointerEvents: 'none' }}
      />
      <div
        aria-hidden="true"
        className="lb-spark"
        style={{ position: 'absolute', bottom: -5, width: 12, height: 12, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 0 10px #FFFFFF, 0 0 24px #22D3EE, 0 0 44px #22D3EE', pointerEvents: 'none' }}
      />
    </div>
  );
}
