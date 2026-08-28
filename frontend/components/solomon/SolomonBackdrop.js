'use client';

import {
  SOLOMON_BACKDROP,
  SOLOMON_HERO_ASSETS,
  SOLOMON_LAYOUT,
  SOLOMON_Z,
  solomonAbsoluteStyle,
} from './solomonHeroComposition';

function BackdropLayer({ src, layer, className = '' }) {
  return (
    <img
      src={src}
      alt=""
      className={`pointer-events-none absolute left-0 top-0 w-full max-w-none select-none ${className}`}
      style={solomonAbsoluteStyle(layer)}
      decoding="async"
      draggable={false}
    />
  );
}

/** Full-width scenery + Solomon body. Not a hero panel — extends behind page content. */
export default function SolomonBackdrop({ hasActiveSession }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-visible"
      style={{ zIndex: SOLOMON_Z.backdrop }}
      aria-hidden
    >
      <div
        className="relative mx-auto w-full max-w-lg"
        style={{ transform: `translateY(${SOLOMON_LAYOUT.backdropOffsetY})` }}
      >
        <img
          src={SOLOMON_HERO_ASSETS.officialbg}
          alt=""
          className="block w-full h-auto max-w-none select-none"
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
      </div>
    </div>
  );
}
