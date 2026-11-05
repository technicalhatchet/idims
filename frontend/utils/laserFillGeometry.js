/**
 * Geometry for the "filled fin" laser bars: the curved fin outline and the slanted
 * slices the buttons fill, computed in real pixels for the bar's measured size so the
 * curve, seams and glows never stretch.
 */

/** Seam slant (px each side of the divider) and half the seam gap. */
export const FILL_SLANT = 7;
export const FILL_HALF_GAP = 2.5;
/** Insets for the primary's light ring, dark gap and hot fill. */
export const FILL_RING_INSETS = { ring: 0, gap: 2.5, hot: 6 };
/** How far each primary layer's fin clip is pushed down so the fin edge never covers it. */
export const FILL_RING_DROPS = { ring: 3, gap: 5.5, hot: 9 };

const r1 = (n) => Math.round(n * 10) / 10;

/** Open fin outline (no closing edge) for width w and height h. */
export function finEdgePath(w, h) {
  const W = Math.max(w, 120);
  return `M0 ${h} C12 ${h} 16 22 40 22 Q${r1(W / 2)} 8 ${r1(W - 40)} 22 C${r1(W - 16)} 22 ${r1(W - 12)} ${h} ${r1(W)} ${h}`;
}

/** Closed fin shape. */
export function finPath(w, h) {
  return `${finEdgePath(w, h)} Z`;
}

/**
 * Slice bounds for `count` slices split at `dividers` (fractions of the width).
 * Dividers left of the primary lean "/", the rest lean "\", so the primary stands
 * like a pedestal. Each bound is { L: { t, b }, R: { t, b } }: x at the top and bottom.
 */
export function sliceBounds({ width, dividers = [], primaryIndex = -1 }) {
  const W = width;
  const divs = dividers.map((f, k) => {
    const x = f * W;
    const leansRight = primaryIndex >= 0 && k < primaryIndex;
    return leansRight ? { t: x + FILL_SLANT, b: x - FILL_SLANT } : { t: x - FILL_SLANT, b: x + FILL_SLANT };
  });
  const count = dividers.length + 1;
  const bounds = [];
  for (let i = 0; i < count; i += 1) {
    const L = i === 0 ? { t: -6, b: -6 } : { t: divs[i - 1].t + FILL_HALF_GAP, b: divs[i - 1].b + FILL_HALF_GAP };
    const R = i === count - 1 ? { t: W + 6, b: W + 6 } : { t: divs[i].t - FILL_HALF_GAP, b: divs[i].b - FILL_HALF_GAP };
    bounds.push({ L, R });
  }
  return { divs, bounds };
}

/** Polygon points for a slice, shrunk sideways by `inset`, spanning y -2..h+2. */
export function slicePoly(bound, h, inset = 0) {
  const { L, R } = bound;
  return [
    `${r1(L.t + inset)},-2`,
    `${r1(R.t - inset)},-2`,
    `${r1(R.b - inset)},${h + 2}`,
    `${r1(L.b + inset)},${h + 2}`,
  ].join(' ');
}

/** Horizontal box for a slice's tap area: the seam midpoints, kept off the curved ends. */
export function sliceBox(bound, index, count, width) {
  let l = (bound.L.t + bound.L.b) / 2;
  let r = (bound.R.t + bound.R.b) / 2;
  if (index === 0) l = 14;
  if (index === count - 1) r = width - 14;
  return { left: Math.round(l), width: Math.max(0, Math.round(r - l)) };
}
