/**
 * Solomon hero artboard — single 1124×1920 coordinate space.
 * Backdrop, session card, and foreground hand share one stage so they scale together.
 */
export const SOLOMON_ARTBOARD = {
  width: 1124,
  height: 1920,
  ratio: 1920 / 1124,
  maxWidth: '32rem',
  aspectClass: 'aspect-[1124/1920]',
};

export const SOLOMON_HERO_ASSETS = {
  officialbg: '/images/solomonwiz/wizadvanced/officialbg.png',
  wiznoleft: '/images/solomonwiz/wizadvanced/wiznoleft.png',
  wizbook: '/images/solomonwiz/wizadvanced/wizbook.png',
  wizbookhand: '/images/solomonwiz/wizadvanced/wizbookhand.png',
  wizfronthand: '/images/solomonwiz/wizadvanced/wizfronthand.png',
  wrenchwiz: '/images/solomonwiz/wizadvanced/wrenchwiz.png',
};

/** Character / scenery layers — artboard percentages */
export const SOLOMON_BACKDROP = {
  background: { x: '0%', y: '0%', width: '100%', scale: 1 },
  wizard: { x: '0%', y: '0%', width: '100%', scale: 1 },
  wrench: { x: '0%', y: '0%', width: '100%', scale: 1 },
  book: { x: '0%', y: '0%', width: '100%', scale: 1 },
  bookHand: { x: '0%', y: '0%', width: '100%', scale: 1 },
};

/**
 * Layout tuning — artboard-relative where possible.
 * contentStartArtboardY: where scrollable UI should begin, as % of stage height
 * (tuned from iPhone 17 Pro Max PWA reference, propagates with stage scale).
 */
export const SOLOMON_LAYOUT = {
  stageOffsetY: '10px',
  headerFlowEstimate: '5.5rem',
  contentStartArtboardY: {
    withSession: '48%',
    withoutSession: '43%',
  },
  sessionToNewDiagnosticGap: '1.5rem',
};

/**
 * Session card — artboard coordinates (same % frame as wiznoleft / wizfronthand).
 * Reference: iPhone 17 Pro Max PWA (left 3.1%, width 49%, ~30.1% from stage top).
 */
export const SOLOMON_SESSION = {
  card: { x: '3.1%', y: '31.1%', width: '49%' },
};

/**
 * Foreground hand — artboard coordinates.
 * Visible pixels (~158×125) sit near 16.7% / 41.4% on the PNG canvas.
 */
export const SOLOMON_FRONT_HAND = {
  x: '0%',
  y: '0%',
  width: '100%',
  scale: 1,
  originX: '16.7%',
  originY: '41.4%',
};

export const SOLOMON_Z = {
  backdrop: 0,
  sessionCard: 15,
  frontHand: 16,
  pageContent: 20,
  header: 30,
};

export function solomonAbsoluteStyle({ x, y, width, scale, originX, originY }) {
  return {
    position: 'absolute',
    left: x,
    top: y,
    width,
    transform: scale === 1 ? undefined : `scale(${scale})`,
    transformOrigin: `${originX ?? '0%'} ${originY ?? '0%'}`,
  };
}

/** CSS length for full artboard height at current viewport (matches max-w-lg). */
export function solomonStageHeightExpr() {
  const { ratio, maxWidth } = SOLOMON_ARTBOARD;
  return `calc(min(100vw, ${maxWidth}) * ${ratio})`;
}

/** Spacer below header so UI clears the hero overlap — derived from artboard %. */
export function solomonContentSpacerStyle(hasActiveSession) {
  const y = hasActiveSession
    ? SOLOMON_LAYOUT.contentStartArtboardY.withSession
    : SOLOMON_LAYOUT.contentStartArtboardY.withoutSession;
  const { ratio, maxWidth } = SOLOMON_ARTBOARD;
  const header = SOLOMON_LAYOUT.headerFlowEstimate;
  const gap = hasActiveSession ? ` + ${SOLOMON_LAYOUT.sessionToNewDiagnosticGap}` : '';

  return {
    height: `max(0px, calc(min(100vw, ${maxWidth}) * ${ratio} * ${parseFloat(y) / 100} - ${header}${gap}))`,
  };
}
