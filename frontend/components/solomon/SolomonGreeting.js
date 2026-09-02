'use client';

import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { useUIPreferences } from '../../context/UIPreferencesContext';
import { resolveUserFirstName } from '../../utils/userDisplayName';
import {
  SOLOMON_GREETING,
  SOLOMON_Z,
  solomonStageWidthExpr,
} from './solomonHeroComposition';

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
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.9" />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="3.5"
        stroke="currentColor"
        strokeWidth="0.75"
        opacity="0.55"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="3.5"
        stroke="currentColor"
        strokeWidth="0.75"
        opacity="0.45"
        transform="rotate(60 12 12)"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="3.5"
        stroke="currentColor"
        strokeWidth="0.75"
        opacity="0.45"
        transform="rotate(120 12 12)"
      />
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
      <div className="flex items-start gap-[0.35em]">
        <span
          className="inline-flex shrink-0 text-cyan-300/80"
          style={{
            marginTop: `calc(${stageW} * 0.006)`,
            width: `calc(${stageW} * 0.038)`,
            height: `calc(${stageW} * 0.038)`,
          }}
        >
          <AtomGlyph />
        </span>

        <div className="min-w-0 flex-1">
          <p
            className="font-medium uppercase tracking-[0.14em] text-cyan-100/70"
            style={{
              fontSize: `calc(${stageW} * 0.024)`,
              lineHeight: 1.35,
              textShadow: '0 0 12px rgba(34, 211, 238, 0.18)',
            }}
          >
            {greetingLine}
          </p>

          <p
            className="font-semibold uppercase tracking-[0.06em] text-cyan-50"
            style={{
              fontSize: `calc(${stageW} * 0.052)`,
              lineHeight: 1.1,
              marginTop: `calc(${stageW} * 0.004)`,
              textShadow:
                '0 0 18px rgba(34, 211, 238, 0.28), 0 0 4px rgba(34, 211, 238, 0.35)',
            }}
          >
            {displayName}
          </p>

          <p
            className="font-light text-cyan-100/45"
            style={{
              fontSize: `calc(${stageW} * 0.021)`,
              lineHeight: 1.4,
              marginTop: `calc(${stageW} * 0.006)`,
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
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                right: `calc(${stageW} * 0.04)`,
                background:
                  'linear-gradient(90deg, rgba(34,211,238,0.45) 0%, rgba(34,211,238,0.12) 72%, transparent 100%)',
                boxShadow: '0 0 6px rgba(34, 211, 238, 0.2)',
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 rotate-45 border border-cyan-300/50 bg-cyan-400/20"
              style={{
                right: 0,
                width: `calc(${stageW} * 0.014)`,
                height: `calc(${stageW} * 0.014)`,
                boxShadow: '0 0 6px rgba(34, 211, 238, 0.35)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
