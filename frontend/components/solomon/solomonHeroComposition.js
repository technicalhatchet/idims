/**
 * Solomon layered composition — backdrop, session card, and hand are tuned independently.
 * Character assets share a 1124×1920 coordinate space at width: 100%.
 */
export const SOLOMON_HERO_ASSETS = {
  officialbg: '/images/solomonwiz/wizadvanced/officialbg.png',
  wiznoleft: '/images/solomonwiz/wizadvanced/wiznoleft.png',
  wizbook: '/images/solomonwiz/wizadvanced/wizbook.png',
  wizbookhand: '/images/solomonwiz/wizadvanced/wizbookhand.png',
  wizfronthand: '/images/solomonwiz/wizadvanced/wizfronthand.png',
  wrenchwiz: '/images/solomonwiz/wizadvanced/wrenchwiz.png',
};

/** Backdrop character / scenery — independent from session card */
export const SOLOMON_BACKDROP = {
  background: { x: '0%', y: '0%', width: '100%', scale: 1 },
  wizard: { x: '0%', y: '0%', width: '100%', scale: 1 },
  wrench: { x: '0%', y: '0%', width: '100%', scale: 1 },
  book: { x: '0%', y: '0%', width: '100%', scale: 1 },
  bookHand: { x: '0%', y: '0%', width: '100%', scale: 1 },
};

/** Surgical layout offsets — backdrop vs UI stack are independent */
export const SOLOMON_LAYOUT = {
  backdropOffsetY: '-20px',
  uiStackOffsetY: '80px',
  sessionToNewDiagnosticGap: '2rem',
};

/** Session card — page coordinates, NOT inside backdrop sizing */
export const SOLOMON_SESSION = {
  card: { left: '3.1%', top: 'calc(10.5rem + 53px)', width: '49%' },
};

/**
 * Foreground hand — independent stage coordinates (1124×1920 canvas).
 * Visible pixels (~158×125) sit near 10% / 38% on the PNG; scale from that
 * anchor so the grip reads at wizard proportions, NOT vs session-card width.
 */
export const SOLOMON_FRONT_HAND = {
  x: '-0%',
  y: '-0%',
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
