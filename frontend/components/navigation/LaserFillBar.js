import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LaserIcon, LaserSeam } from './LaserBarParts';
import {
  FILL_RING_DROPS,
  FILL_RING_INSETS,
  finEdgePath,
  finPath,
  sliceBounds,
  sliceBox,
  slicePoly,
} from '../../utils/laserFillGeometry';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Space kept clear of the home indicator under the button content. */
const HOME_PAD_CSS = 'max(8px, env(safe-area-inset-bottom, 0px) - 8px)';

// Gradients: [top stop, mid/bottom stop, (bottom)] per fill.
const HOT = {
  cyan: [['0%', '#CFFAFE'], ['22%', '#5EEAF8'], ['58%', '#22D3EE'], ['100%', '#0891B2']],
  orange: [['0%', '#FFE2C2'], ['22%', '#FFB46B'], ['58%', '#FB923C'], ['100%', '#C2410C']],
  red: [['0%', '#FECACA'], ['24%', '#F87171'], ['60%', '#EF4444'], ['100%', '#B91C1C']],
};
const HOT_LIT = {
  cyan: [['0%', '#FFFFFF'], ['30%', '#A5F3FC'], ['100%', '#22D3EE']],
  orange: [['0%', '#FFFFFF'], ['30%', '#FFD8B0'], ['100%', '#FB923C']],
  red: [['0%', '#FFFFFF'], ['30%', '#FECACA'], ['100%', '#EF4444']],
};
const SIDE = {
  cyan: [['0%', '#123447'], ['70%', '#0A1624']],
  orange: [['0%', '#3A2112'], ['70%', '#160F12']],
  back: [['0%', '#1A2433'], ['70%', '#0B111B']],
  off: [['0%', '#111A28'], ['70%', '#0A111C']],
};
const SIDE_LIT = {
  cyan: [['0%', '#1D6A82'], ['80%', '#0E2A3C']],
  orange: [['0%', '#6E3A16'], ['80%', '#2A160E']],
  back: [['0%', '#33465E'], ['80%', '#131C2A']],
  off: [['0%', '#111A28'], ['70%', '#0A111C']],
};
const RING = { cyan: 'rgba(165,243,252,0.8)', orange: 'rgba(255,214,170,0.85)', red: 'rgba(254,202,202,0.85)' };
const GLOW = { cyan: '#22D3EE', orange: '#FB923C', red: '#EF4444' };
const HOT_TEXT = { cyan: '#03161C', orange: '#1A0A00', red: '#1F0505' };
const SIDE_TEXT = { cyan: '#8FE6F3', orange: '#FFB46B', back: '#B8C7D6', off: '#5B6B80' };

const hotTone = (tone) => (HOT[tone] ? tone : null);
const sideKey = (slice) => {
  if (slice.role === 'back') return 'back';
  if (slice.tone === 'off') return 'off';
  return slice.tone === 'orange' ? 'orange' : 'cyan';
};

function Grad({ id, stops }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      {stops.map(([o, c]) => (
        <stop key={o} offset={o} stopColor={c} />
      ))}
    </linearGradient>
  );
}

function Blur({ id, w, h, sd }) {
  return (
    <filter id={id} filterUnits="userSpaceOnUse" x="-60" y="-60" width={w + 120} height={h + 120}>
      <feGaussianBlur stdDeviation={sd} />
    </filter>
  );
}

/**
 * The laser bar with its buttons filling the fin: slanted slices split by laser seams,
 * the primary lit with a light ring, a dark gap and a hot fill (the "double border").
 *
 * slices: [{ key, role: 'back'|'primary'|'side', tone, icon, label, showLabel?, ariaLabel?,
 *            disabled?, badge?, busy?, pressed?, contentKey?, className?, style?, onPress }]
 * dividers: split points as fractions of the width (slices.length - 1 of them).
 */
export default function LaserFillBar({ idPrefix, slices = [], dividers = [], children = null }) {
  const boxRef = useRef(null);
  const [size, setSize] = useState({ w: 390, h: 82 });

  useIsoLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      if (w > 0 && h > 0) setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w: W, h: H } = size;
  const id = (s) => `${idPrefix}-${s}`;
  const url = (s) => `url(#${id(s)})`;
  const count = slices.length;
  const primaryIndex = slices.findIndex((s) => s.role === 'primary');
  const primary = primaryIndex >= 0 ? slices[primaryIndex] : null;
  const primaryHot = primary && count > 1 ? hotTone(primary.tone) : null;
  const { divs, bounds } = sliceBounds({ width: W, dividers: dividers.slice(0, Math.max(0, count - 1)), primaryIndex });
  const fin = finPath(W, H);
  const edge = finEdgePath(W, H);
  const edgeGlow = (primaryHot && GLOW[primaryHot]) || GLOW.cyan;

  let hot = null;
  if (primaryHot) {
    const bd = bounds[primaryIndex];
    hot = {
      ring: slicePoly(bd, H, FILL_RING_INSETS.ring),
      gap: slicePoly(bd, H, FILL_RING_INSETS.gap),
      fill: slicePoly(bd, H, FILL_RING_INSETS.hot),
      bevL: [bd.L.t + 7, bd.L.b + 7],
      bevR: [bd.R.t - 7, bd.R.b - 7],
      specX: Math.round((bd.L.t + bd.R.t) / 2 - 6),
      specRx: Math.max(10, Math.round((bd.R.t - bd.L.t) * 0.36)),
    };
  }

  return (
    <div ref={boxRef} style={{ position: 'absolute', inset: 0 }}>
      <svg
        aria-hidden="true"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
      >
        <defs>
          <clipPath id={id('fin')}><path d={fin} /></clipPath>
          <clipPath id={id('fin-ring')}><path d={fin} transform={`translate(0 ${FILL_RING_DROPS.ring})`} /></clipPath>
          <clipPath id={id('fin-gap')}><path d={fin} transform={`translate(0 ${FILL_RING_DROPS.gap})`} /></clipPath>
          <clipPath id={id('fin-hot')}><path d={fin} transform={`translate(0 ${FILL_RING_DROPS.hot})`} /></clipPath>
          <linearGradient id={id('base')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#103042" />
            <stop offset="75%" stopColor="#08101C" />
          </linearGradient>
          {Object.entries(SIDE).map(([k, stops]) => <Grad key={`s-${k}`} id={id(`side-${k}`)} stops={stops} />)}
          {Object.entries(SIDE_LIT).map(([k, stops]) => <Grad key={`sl-${k}`} id={id(`side-${k}-lit`)} stops={stops} />)}
          {primaryHot ? <Grad id={id('hot')} stops={HOT[primaryHot]} /> : null}
          {primaryHot ? <Grad id={id('hot-lit')} stops={HOT_LIT[primaryHot]} /> : null}
          <linearGradient id={id('sheen')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="18%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id('shade')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="45%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.32" />
          </linearGradient>
          <radialGradient id={id('spec')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          {hot ? <clipPath id={id('hot-poly')}><polygon points={hot.fill} /></clipPath> : null}
          {/* SVG blurs, not CSS filter: iOS Safari ignores CSS blur on SVG shapes. */}
          <Blur id={id('b2')} w={W} h={H} sd={1.6} />
          <Blur id={id('b3')} w={W} h={H} sd={2.4} />
          <Blur id={id('b4')} w={W} h={H} sd={3.2} />
          <Blur id={id('b6')} w={W} h={H} sd={4.8} />
          <pattern id={id('lines')} width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="1" fill="#22D3EE" fillOpacity="0.07" />
          </pattern>
        </defs>

        <path d={fin} fill={url('base')} />

        <g clipPath={url('fin')}>
          {slices.map((s, i) => {
            if (hot && i === primaryIndex) return null;
            const k = sideKey(s);
            return (
              <polygon
                key={s.key}
                points={slicePoly(bounds[i], H, 0)}
                fill={url(`side-${k}${s.pressed ? '-lit' : ''}`)}
                style={{ transition: 'fill 0.18s' }}
              />
            );
          })}
          <rect width={W} height={H} fill={url('lines')} />
          {hot ? <polygon points={hot.ring} fill={GLOW[primaryHot]} opacity="0.4" filter={url('b6')} /> : null}
        </g>

        {hot ? (
          <>
            <g clipPath={url('fin-ring')}>
              <polygon points={hot.ring} fill={RING[primaryHot]} />
            </g>
            <g clipPath={url('fin')}>
              <path d={edge} fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="5" filter={url('b2')} />
            </g>
            <g clipPath={url('fin-gap')}>
              <polygon points={hot.gap} fill="#08101C" />
              <polygon points={hot.fill} fill={GLOW[primaryHot]} opacity="0.45" filter={url('b3')} />
            </g>
            <g clipPath={url('fin-hot')}>
              <polygon points={hot.fill} fill={url(primary.pressed ? 'hot-lit' : 'hot')} />
              <polygon points={hot.fill} fill={url('shade')} />
              <polygon points={hot.fill} fill={url('sheen')} opacity="0.5" />
              <ellipse cx={hot.specX} cy="34" rx={hot.specRx} ry="9" fill={url('spec')} clipPath={url('hot-poly')} />
              <path d={edge} transform="translate(0 10)" fill="none" stroke="#FFFFFF" strokeOpacity="0.95" strokeWidth="1.6" clipPath={url('hot-poly')} />
              <line x1={hot.bevL[0]} y1="-2" x2={hot.bevL[1]} y2={H + 2} stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="1.6" clipPath={url('hot-poly')} />
              <line x1={hot.bevR[0]} y1="-2" x2={hot.bevR[1]} y2={H + 2} stroke="#000000" strokeOpacity="0.32" strokeWidth="2" clipPath={url('hot-poly')} />
            </g>
          </>
        ) : null}

        <g clipPath={url('fin')}>
          {divs.map((d, k) => (
            // eslint-disable-next-line react/no-array-index-key
            <g key={k}>
              <line x1={d.t} y1="-2" x2={d.b} y2={H + 2} stroke="#22D3EE" strokeWidth="6" filter={url('b3')} />
              <line x1={d.t} y1="-2" x2={d.b} y2={H + 2} stroke="#E6FFFF" strokeWidth="1.5" />
            </g>
          ))}
        </g>

        <g className="lb-edge">
          <path d={edge} fill="none" stroke={edgeGlow} strokeOpacity="0.4" strokeWidth="6" filter={url('b4')} />
          <path d={edge} fill="none" stroke="#E6FFFF" strokeWidth="2" />
        </g>
      </svg>

      {children}

      {slices.map((s, i) => {
        const isHot = Boolean(hot) && i === primaryIndex;
        const single = count === 1;
        const box = sliceBox(bounds[i], i, count, W);
        const fg = isHot ? HOT_TEXT[primaryHot] : SIDE_TEXT[sideKey(s)];
        const showLabel = s.showLabel !== false && Boolean(s.label);
        // Icon above the label on every slice (the main button too); only a lone Back sits in a row.
        const row = single;
        const ariaLabel = s.ariaLabel || (s.badge != null && s.badge !== 0 ? `${s.label} (${s.badge})` : s.label);
        return (
          <button
            key={s.key}
            type="button"
            className={`lb-slice${s.className ? ` ${s.className}` : ''}`}
            disabled={s.disabled}
            aria-label={ariaLabel}
            aria-busy={s.busy || undefined}
            onClick={s.onPress}
            style={{
              position: 'absolute',
              top: 20,
              bottom: 0,
              left: box.left,
              width: box.width,
              // Centers the stack in what you see of the slice; the main button sits 1px higher than the sides.
              paddingTop: isHot ? 3 : 5,
              paddingBottom: HOME_PAD_CSS,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: fg,
              background: 'transparent',
              border: 0,
              overflow: 'hidden',
              touchAction: 'manipulation',
              cursor: s.disabled ? 'default' : 'pointer',
              WebkitTapHighlightColor: 'transparent',
              ...s.style,
            }}
          >
            <span
              key={s.contentKey}
              className={s.contentKey ? 'lb-slice-c lb-pop' : 'lb-slice-c'}
              style={{
                display: 'flex',
                flexDirection: row ? 'row' : 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: row ? 8 : 3,
                minWidth: 0,
                maxWidth: '100%',
                padding: '0 6px',
                opacity: s.disabled && !isHot ? 0.45 : s.busy ? 0.75 : 1,
                textShadow: isHot ? '0 1px 0 rgba(255,255,255,0.35)' : 'none',
                transition: 'opacity 0.2s',
              }}
            >
              <span style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
                <LaserIcon name={s.icon} size={isHot ? 20 : 18} strokeWidth={isHot ? 2.2 : 2.1} />
                {s.badge != null && s.badge !== 0 ? (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: -7,
                      left: 12,
                      minWidth: 16,
                      height: 16,
                      padding: '0 4px',
                      borderRadius: 8,
                      background: '#FF8A1F',
                      color: '#1A0A00',
                      fontSize: 9,
                      fontWeight: 800,
                      lineHeight: '16px',
                      textAlign: 'center',
                      textShadow: 'none',
                    }}
                  >
                    {s.badge}
                  </span>
                ) : null}
              </span>
              {showLabel ? (
                <span
                  style={{
                    fontSize: isHot ? 13 : single ? 12 : 10,
                    fontWeight: isHot ? 800 : 700,
                    letterSpacing: isHot ? '0.06em' : '0.08em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}
                >
                  {s.label}
                </span>
              ) : null}
            </span>
            {s.pressed ? <LaserSeam tone={isHot ? primaryHot : s.tone === 'orange' ? 'orange' : 'cyan'} /> : null}
          </button>
        );
      })}
    </div>
  );
}
