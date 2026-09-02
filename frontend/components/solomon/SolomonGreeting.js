'use client';

import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { useUIPreferences } from '../../context/UIPreferencesContext';
import { resolveUserFirstName } from '../../utils/userDisplayName';
import {
  SOLOMON_GREETING,
  SOLOMON_Z,
  solomonStageWidthExpr,
} from './solomonHeroComposition';

const CYAN_LIGHT = '#9eeaf7';
const CYAN_NAME = '#d4f8ff';

const NAME_GLOW =
  '0 0 6px rgba(164, 243, 255, 0.95), 0 0 16px rgba(103, 232, 249, 0.8), 0 0 28px rgba(34, 211, 238, 0.55), 0 0 42px rgba(34, 211, 238, 0.28)';

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function AtomGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="h-full w-full shrink-0"
    >
      <defs>
        <filter id="solomon-atom-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#solomon-atom-glow)">
        <circle cx="12" cy="12" r="2.35" fill="currentColor" />
        <ellipse
          cx="12"
          cy="12"
          rx="9"
          ry="3.5"
          stroke="currentColor"
          strokeWidth="0.9"
          opacity="0.85"
        />
        <ellipse
          cx="12"
          cy="12"
          rx="9"
          ry="3.5"
          stroke="currentColor"
          strokeWidth="0.85"
          opacity="0.7"
          transform="rotate(60 12 12)"
        />
        <ellipse
          cx="12"
          cy="12"
          rx="9"
          ry="3.5"
          stroke="currentColor"
          strokeWidth="0.85"
          opacity="0.7"
          transform="rotate(120 12 12)"
        />
      </g>
    </svg>
  );
}

/** Arcane HUD greeting — absolute overlay on the hero artboard only. */
export default function SolomonGreeting() {
  const { user } = useSolomonAuth();
  const { preferences } = useUIPreferences();
  const firstName = resolveUserFirstName({ preferences, user });

  if (!firstName) return null;

  const stageW = solomonStageWidthExpr();
  const greetingLine = `${greetingForHour(new Date().getHours())},`;
  const displayName = firstName.toUpperCase();
  const atomSize = `calc(${stageW} * 0.054)`;

  return (
    <div
      data-solomon-greeting
      className="pointer-events-none absolute select-none"
      style={{
        left: SOLOMON_GREETING.x,
        top: SOLOMON_GREETING.y,
        maxWidth: SOLOMON_GREETING.maxWidth,
        zIndex: SOLOMON_Z.greeting,
        WebkitTextSizeAdjust: '100%',
        textSizeAdjust: '100%',
      }}
      aria-label={`${greetingLine} ${displayName}. The workshop awaits.`}
    >
      <div className="flex items-start gap-[0.4em]">
        <span
          className="inline-flex shrink-0"
          style={{
            marginTop: `calc(${stageW} * 0.002)`,
            width: atomSize,
            height: atomSize,
            color: CYAN_LIGHT,
            filter:
              'drop-shadow(0 0 4px rgba(126, 232, 255, 0.95)) drop-shadow(0 0 10px rgba(56, 189, 248, 0.75)) drop-shadow(0 0 18px rgba(34, 211, 238, 0.45))',
          }}
        >
          <AtomGlyph />
        </span>

        <div className="min-w-0 flex-1">
          <p
            className="font-medium uppercase tracking-[0.14em]"
            style={{
              color: CYAN_LIGHT,
              fontSize: `calc(${stageW} * 0.024)`,
              lineHeight: 1.35,
            }}
          >
            {greetingLine}
          </p>

          <p
            className="font-semibold uppercase tracking-[0.06em]"
            style={{
              color: CYAN_NAME,
              fontSize: `calc(${stageW} * 0.052)`,
              lineHeight: 1.1,
              marginTop: `calc(${stageW} * 0.004)`,
              textShadow: NAME_GLOW,
            }}
          >
            {displayName}
          </p>

          <p
            className="font-light"
            style={{
              color: CYAN_LIGHT,
              fontSize: `calc(${stageW} * 0.021)`,
              lineHeight: 1.4,
              marginTop: `calc(${stageW} * 0.006)`,
              opacity: 0.88,
            }}
          >
            The workshop awaits.
          </p>

          <div
            className="relative mt-[0.35em]"
            style={{ height: `calc(${stageW} * 0.004)` }}
            aria-hidden
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, rgba(158,234,247,0.55) 0%, rgba(158,234,247,0.15) 72%, transparent 100%)',
                boxShadow: '0 0 8px rgba(126, 232, 255, 0.35)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
