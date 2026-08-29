'use client';

import { useRef } from 'react';
import SolomonActiveSessionCard from './SolomonActiveSessionCard';
import SolomonHeroDiagnostics from './SolomonHeroDiagnostics';
import {
  SOLOMON_ARTBOARD,
  SOLOMON_BACKDROP,
  SOLOMON_FRONT_HAND,
  SOLOMON_HERO_ASSETS,
  SOLOMON_LAYOUT,
  SOLOMON_SESSION,
  SOLOMON_Z,
  solomonAbsoluteStyle,
  solomonSessionCardShellStyle,
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
export default function SolomonHeroArtboard({
  hasActiveSession,
  continueTarget,
  ctaRef,
  topInset = '0px',
}) {
  const stageRef = useRef(null);
  const cardRef = useRef(null);
  const handRef = useRef(null);
  const { card } = SOLOMON_SESSION;
  const stageTransform = SOLOMON_LAYOUT.stageOffsetY !== '0px'
    ? `translateY(${SOLOMON_LAYOUT.stageOffsetY})`
    : undefined;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 mx-auto w-full max-w-lg overflow-visible"
      style={{ zIndex: SOLOMON_Z.backdrop, top: topInset, transform: stageTransform }}
    >
      <div ref={stageRef} className={`relative w-full ${SOLOMON_ARTBOARD.aspectClass}`} data-solomon-stage>
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
            ref={cardRef}
            data-solomon-session-card
            className="pointer-events-auto absolute transition-opacity duration-300"
            style={{
              ...solomonSessionCardShellStyle(card),
              zIndex: SOLOMON_Z.sessionCard,
            }}
          >
            <SolomonActiveSessionCard target={continueTarget} variant="heroOverlay" />
          </div>
        ) : null}

        {hasActiveSession ? (
          <img
            ref={handRef}
            data-solomon-front-hand
            src={SOLOMON_HERO_ASSETS.wizfronthand}
            alt=""
            className="pointer-events-none absolute left-0 top-0 h-full w-full max-w-none select-none object-contain"
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
      <SolomonHeroDiagnostics
        stageRef={stageRef}
        cardRef={cardRef}
        handRef={handRef}
        ctaRef={ctaRef}
        hasActiveSession={hasActiveSession}
      />
    </div>
  );
}
