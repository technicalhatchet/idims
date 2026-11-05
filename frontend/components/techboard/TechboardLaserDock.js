import { useEffect, useState } from 'react';
import {
  LASER_BAR_HEIGHT_CSS,
  LaserBarStyles,
  LaserTag,
  usePressThenRun,
} from '../navigation/LaserBarParts';
import LaserFillBar from '../navigation/LaserFillBar';

/** Call | primary | contextual, split into balanced slices (fractions of the width). */
const DOCK_DIVIDERS = [0.323, 0.677];

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
        <LaserFillBar
          idPrefix="td-dock"
          dividers={DOCK_DIVIDERS}
          slices={slots.map((slot, i) => ({
            key: slot.key,
            role: i === 1 ? 'primary' : 'side',
            tone: slot.tone || 'cyan',
            icon: slot.icon,
            label: slot.label,
            badge: slot.badge,
            disabled: slot.disabled,
            pressed: pressedKey === slot.key,
            className: 'lb-btn-in',
            style: { animationDelay: `${0.55 + i * 0.06}s` },
            onPress: () => press(slot.key, slot.onPress),
          }))}
        >
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
        </LaserFillBar>
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
