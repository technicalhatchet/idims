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
  /** height = stable artboard bounding box (scales with stage, not card content) */
  card: { x: '3.1%', y: '29.1%', width: '49%', height: '11.8%' },
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

/** Stage width expression — shared by spacer, card shell, and typography scale. */
export function solomonStageWidthExpr() {
  const { maxWidth } = SOLOMON_ARTBOARD;
  return `min(100vw, ${maxWidth})`;
}

/** Artboard length from a height % (fallback when % height resolves inconsistently). */
export function solomonArtboardHeightPercentExpr(percent) {
  const { ratio } = SOLOMON_ARTBOARD;
  return `calc(${solomonStageWidthExpr()} * ${ratio} * ${parseFloat(percent) / 100})`;
}

/** Session card shell — scales typography with stage width; prevents Android text inflation. */
export function solomonSessionCardShellStyle(card) {
  return {
    left: card.x,
    top: card.y,
    width: card.width,
    height: card.height,
    minHeight: solomonArtboardHeightPercentExpr(card.height),
    fontSize: `calc(${solomonStageWidthExpr()} * 0.0265)`,
    WebkitTextSizeAdjust: '100%',
    textSizeAdjust: '100%',
  };
}

/** Primary CTA below hero — fixed box, px type, no Android rem inflation. */
export const SOLOMON_PRIMARY_CTA_CLASS =
  'box-border flex h-[52px] min-h-[52px] max-h-[52px] shrink-0 items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#0089B9] to-[#006a94] px-3 shadow-[0_4px_16px_rgba(0,137,185,0.35)] hover:from-[#0099cc] hover:to-[#007aa8] transition-colors';

/** CTA label block — viewport-scaled px (not rem) so Android font settings cannot inflate it. */
export function solomonPrimaryCtaLabelStyle({ longTitle = false } = {}) {
  const titleScale = longTitle ? 0.92 : 1;
  const w = solomonStageWidthExpr();
  return {
    WebkitTextSizeAdjust: '100%',
    textSizeAdjust: '100%',
    title: {
      fontSize: `calc(${w} * ${0.037 * titleScale})`,
      lineHeight: '17px',
      height: '17px',
    },
    subtitle: {
      fontSize: `calc(${w} * 0.029)`,
      lineHeight: '14px',
      height: '14px',
    },
  };
}

/** CSS length for full artboard height at current viewport (matches max-w-lg). */
export function solomonStageHeightExpr() {
  const { ratio } = SOLOMON_ARTBOARD;
  return `calc(${solomonStageWidthExpr()} * ${ratio})`;
}

/** Spacer below header so UI clears the hero overlap — derived from artboard %. */
export function solomonContentSpacerStyle(hasActiveSession) {
  const y = hasActiveSession
    ? SOLOMON_LAYOUT.contentStartArtboardY.withSession
    : SOLOMON_LAYOUT.contentStartArtboardY.withoutSession;
  const { ratio } = SOLOMON_ARTBOARD;
  const header = SOLOMON_LAYOUT.headerFlowEstimate;
  const gap = hasActiveSession ? ` + ${SOLOMON_LAYOUT.sessionToNewDiagnosticGap}` : '';

  return {
    height: `max(0px, calc(${solomonStageWidthExpr()} * ${ratio} * ${parseFloat(y) / 100} - ${header}${gap}))`,
  };
}
