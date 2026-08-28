'use client';

import SolomonActiveSessionCard from './SolomonActiveSessionCard';
import {
  SOLOMON_FRONT_HAND,
  SOLOMON_HERO_ASSETS,
  SOLOMON_LAYOUT,
  SOLOMON_SESSION,
  SOLOMON_Z,
  solomonAbsoluteStyle,
} from './solomonHeroComposition';

/** Session card — independent from backdrop scale/position. */
export default function SolomonSessionOverlay({ hasActiveSession, continueTarget }) {
  if (!hasActiveSession || !continueTarget) return null;

  const { card } = SOLOMON_SESSION;

  return (
    <>
      <div
        className="absolute inset-x-0 top-0 mx-auto w-full max-w-lg"
        style={{ zIndex: SOLOMON_Z.sessionCard }}
      >
        <div
          className="absolute transition-opacity duration-300"
          style={{
            left: card.left,
            top: card.top,
            width: card.width,
          }}
        >
          <SolomonActiveSessionCard target={continueTarget} variant="heroOverlay" />
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto w-full max-w-lg overflow-visible"
        style={{
          zIndex: SOLOMON_Z.frontHand,
          transform: `translateY(${SOLOMON_LAYOUT.backdropOffsetY})`,
        }}
      >
        <div className="relative w-full aspect-[1124/1920]">
          <img
            src={SOLOMON_HERO_ASSETS.wizfronthand}
            alt=""
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              ...solomonAbsoluteStyle(SOLOMON_FRONT_HAND),
              height: '100%',
              objectFit: 'contain',
            }}
            decoding="async"
            draggable={false}
          />
        </div>
      </div>
    </>
  );
}
