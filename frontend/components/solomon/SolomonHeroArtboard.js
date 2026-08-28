'use client';

import SolomonActiveSessionCard from './SolomonActiveSessionCard';
import {
  SOLOMON_ARTBOARD,
  SOLOMON_BACKDROP,
  SOLOMON_FRONT_HAND,
  SOLOMON_HERO_ASSETS,
  SOLOMON_LAYOUT,
  SOLOMON_SESSION,
  SOLOMON_Z,
  solomonAbsoluteStyle,
} from './solomonHeroComposition';

function BackdropLayer({ src, layer, className = '' }) {
  return (
    <img
      src={src}
      alt=""
      className={`pointer-events-none absolute left-0 top-0 h-full w-full max-w-none select-none object-contain ${className}`}
      style={solomonAbsoluteStyle(layer)}
      decoding="async"
      draggable={false}
    />
  );
}

/** Unified 1124×1920 hero stage — backdrop, session card, and front hand share one frame. */
export default function SolomonHeroArtboard({ hasActiveSession, continueTarget }) {
  const { card } = SOLOMON_SESSION;
  const stageTransform = SOLOMON_LAYOUT.stageOffsetY !== '0px'
    ? `translateY(${SOLOMON_LAYOUT.stageOffsetY})`
    : undefined;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 mx-auto w-full max-w-lg overflow-visible"
      style={{ zIndex: SOLOMON_Z.backdrop, transform: stageTransform }}
    >
      <div className={`relative w-full ${SOLOMON_ARTBOARD.aspectClass}`}>
        <img
          src={SOLOMON_HERO_ASSETS.officialbg}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none object-contain"
          decoding="async"
          draggable={false}
        />

        <div className="absolute inset-0">
          <BackdropLayer src={SOLOMON_HERO_ASSETS.wiznoleft} layer={SOLOMON_BACKDROP.wizard} />
          <BackdropLayer src={SOLOMON_HERO_ASSETS.wrenchwiz} layer={SOLOMON_BACKDROP.wrench} />

          {!hasActiveSession ? (
            <>
              <BackdropLayer src={SOLOMON_HERO_ASSETS.wizbook} layer={SOLOMON_BACKDROP.book} />
              <BackdropLayer src={SOLOMON_HERO_ASSETS.wizbookhand} layer={SOLOMON_BACKDROP.bookHand} />
            </>
          ) : null}
        </div>

        {hasActiveSession && continueTarget ? (
          <div
            className="pointer-events-auto absolute transition-opacity duration-300"
            style={{
              left: card.x,
              top: card.y,
              width: card.width,
              zIndex: SOLOMON_Z.sessionCard,
            }}
          >
            <SolomonActiveSessionCard target={continueTarget} variant="heroOverlay" />
          </div>
        ) : null}

        {hasActiveSession ? (
          <img
            src={SOLOMON_HERO_ASSETS.wizfronthand}
            alt=""
            className="pointer-events-none absolute max-w-none select-none object-contain"
            style={{
              ...solomonAbsoluteStyle(SOLOMON_FRONT_HAND),
              height: '100%',
              zIndex: SOLOMON_Z.frontHand,
            }}
            decoding="async"
            draggable={false}
          />
        ) : null}
      </div>
    </div>
  );
}
