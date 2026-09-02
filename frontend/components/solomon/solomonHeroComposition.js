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
 * Primary CTA top is anchored to artboard Y% (scales with stage width, not rem).
 */
export const SOLOMON_LAYOUT = {
  stageOffsetY: '0px',
  /** Logo row height — viewport-scaled (rem breaks Android spacer math). */
  headerFlowScale: 0.1,
  /** Reserve when InstallHint banner is visible (hint + mb-6). */
  installHintFlowEstimate: '6.25rem',
  /** Artboard % gap below session card bottom → primary CTA top (with session). */
  sessionCardToCtaGapArtboard: '8.5%',
  /** Artboard Y% for primary CTA top when no session card on stage. */
  primaryCtaArtboardYWithoutSession: '44%',
};

/**
 * Session card — artboard coordinates (same % frame as wiznoleft / wizfronthand).
 * Reference: iPhone 17 Pro Max PWA (left 3.1%, width 49%, ~30.1% from stage top).
 */
export const SOLOMON_SESSION = {
  /** height = stable artboard bounding box (scales with stage, not card content) */
  card: { x: '3.1%', y: '28.3%', width: '49%', height: '11.8%' },
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

/**
 * Greeting overlay — upper-left negative space on the artboard.
 * Anchored to the same % coordinate frame as session card / wizard layers.
 */
export const SOLOMON_GREETING = {
  x: '3.8%',
  y: '13.8%',
  maxWidth: '42%',
};

export const SOLOMON_Z = {
  backdrop: 0,
  greeting: 10,
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
  'box-border flex min-h-[52px] shrink-0 items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#0089B9] to-[#006a94] px-3 py-2.5 shadow-[0_4px_16px_rgba(0,137,185,0.35)] hover:from-[#0099cc] hover:to-[#007aa8] transition-colors';

/** CTA label block — viewport-scaled px (not rem) so Android font settings cannot inflate it. */
export function solomonPrimaryCtaLabelStyle({ longTitle = false, singleLine = false } = {}) {
  const titleScale = longTitle ? 0.92 : 1;
  const w = solomonStageWidthExpr();
  return {
    WebkitTextSizeAdjust: '100%',
    textSizeAdjust: '100%',
    title: {
      fontSize: `calc(${w} * ${0.037 * titleScale})`,
      lineHeight: singleLine ? 1.35 : 1.25,
    },
    subtitle: {
      fontSize: `calc(${w} * 0.029)`,
      lineHeight: 1.25,
    },
  };
}

/** CSS length for full artboard height at current viewport (matches max-w-lg). */
export function solomonStageHeightExpr() {
  const { ratio } = SOLOMON_ARTBOARD;
  return `calc(${solomonStageWidthExpr()} * ${ratio})`;
}

/** Session card bottom edge in artboard % (y + height). */
export function solomonSessionCardBottomPercent() {
  const { y, height } = SOLOMON_SESSION.card;
  return parseFloat(y) + parseFloat(height);
}

/** Artboard Y% where the primary CTA top should align. */
export function solomonPrimaryCtaArtboardPercent(hasActiveSession) {
  if (hasActiveSession) {
    return (
      solomonSessionCardBottomPercent()
      + parseFloat(SOLOMON_LAYOUT.sessionCardToCtaGapArtboard)
    );
  }
  return parseFloat(SOLOMON_LAYOUT.primaryCtaArtboardYWithoutSession);
}

/** Document-flow header row — viewport-scaled, not rem. */
export function solomonHeaderFlowExpr() {
  return `calc(${solomonStageWidthExpr()} * ${SOLOMON_LAYOUT.headerFlowScale})`;
}

/**
 * Spacer below header so primary CTA top lands on the artboard anchor.
 * Accounts for stage translateY and optional install-hint banner.
 */
export function solomonContentSpacerStyle({
  hasActiveSession = false,
  installHintVisible = false,
} = {}) {
  const y = solomonPrimaryCtaArtboardPercent(hasActiveSession);
  const { ratio } = SOLOMON_ARTBOARD;
  const header = solomonHeaderFlowExpr();
  const hint = installHintVisible ? SOLOMON_LAYOUT.installHintFlowEstimate : '0px';
  const stageOffset = SOLOMON_LAYOUT.stageOffsetY;

  return {
    height: `max(0px, calc(${solomonStageWidthExpr()} * ${ratio} * ${y / 100} - ${header} - ${hint} + ${stageOffset}))`,
  };
}
