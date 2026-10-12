/**
 * Decorative hero visual for marketing homepage (desktop lg+). Animated atom SVG.
 */

function FarHalfMask({ id }) {
  return (
    <mask id={id} maskUnits="userSpaceOnUse">
      <rect x="0" y="0" width="400" height="200" fill="white" />
    </mask>
  );
}

function NearHalfMask({ id }) {
  return (
    <mask id={id} maskUnits="userSpaceOnUse">
      <rect x="0" y="200" width="400" height="200" fill="white" />
    </mask>
  );
}

const ORBIT_DEPTH_KEY_SPLINES = '.45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1';

function OrbitIconVisual({ iconId, stroke, fill, dur, begin }) {
  return (
    <g>
      <animateTransform
        attributeName="transform"
        type="scale"
        values="0.925;1;0.925;0.85;0.925"
        keyTimes="0;.25;.5;.75;1"
        calcMode="spline"
        keySplines={ORBIT_DEPTH_KEY_SPLINES}
        dur={dur}
        begin={begin}
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values="0.85;1;0.85;0.7;0.85"
        keyTimes="0;.25;.5;.75;1"
        calcMode="spline"
        keySplines={ORBIT_DEPTH_KEY_SPLINES}
        dur={dur}
        begin={begin}
        repeatCount="indefinite"
      />
      <circle r="19" fill={fill} stroke={stroke} strokeWidth="1.6" filter="url(#ah-glow)" />
      <use
        href={`#${iconId}`}
        fill="none"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function FlatOrbitSatellite({ iconId, dur, begin }) {
  return (
    <g>
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite">
        <mpath href="#ah-orbit" />
      </animateMotion>
      <OrbitIconVisual iconId={iconId} stroke="#22d3ee" fill="#0b1520" dur={dur} begin={begin} />
    </g>
  );
}

function TiltedOrbitSatellite({ iconId, dur, begin, upright }) {
  const isRange = iconId === 'ah-range';
  return (
    <g>
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite">
        <mpath href="#ah-orbit" />
      </animateMotion>
      <g transform={`rotate(${upright})`}>
        <OrbitIconVisual
          iconId={iconId}
          stroke={isRange ? '#f59e0b' : '#22d3ee'}
          fill={isRange ? '#1a1007' : '#0b1520'}
          dur={dur}
          begin={begin}
        />
      </g>
    </g>
  );
}

function FlatOrbitIcons({ back }) {
  const maskId = back ? 'ah-flat-far' : 'ah-flat-near';
  return (
    <g>
      {back ? <FarHalfMask id={maskId} /> : <NearHalfMask id={maskId} />}
      <g mask={`url(#${maskId})`}>
        <FlatOrbitSatellite iconId="ah-fridge" dur="14s" />
        <FlatOrbitSatellite iconId="ah-tv" dur="14s" begin="-7s" />
      </g>
    </g>
  );
}

function TiltedOrbitIcons({ planeRotate, upright, iconId, dur, begin, back, maskKey }) {
  const maskId = back ? `${maskKey}-far` : `${maskKey}-near`;
  return (
    <g transform={`rotate(${planeRotate} 200 200)`}>
      {back ? <FarHalfMask id={maskId} /> : <NearHalfMask id={maskId} />}
      <g mask={`url(#${maskId})`}>
        <TiltedOrbitSatellite iconId={iconId} dur={dur} begin={begin} upright={upright} />
      </g>
    </g>
  );
}

export default function HomeHeroDiagnosticVisual() {
  return (
    <div
      className="atom-hero relative flex items-center justify-center min-h-[420px] w-full mx-auto"
      role="img"
      aria-label="Atomic Repair: fridge, range, washer and TV orbiting crossed wrenches"
    >
      <style jsx>{`
        .atom-hero {
          max-width: 500px;
          aspect-ratio: 1;
        }
        .atom-hero :global(svg) {
          width: 100%;
          height: 100%;
          display: block;
          overflow: visible;
        }
        .atom-hero :global(.spin-slow) {
          transform-origin: 200px 200px;
          animation: ah-spin 40s linear infinite;
        }
        .atom-hero :global(.spin-rev) {
          transform-origin: 200px 200px;
          animation: ah-spin 60s linear infinite reverse;
        }
        .atom-hero :global(.pulse) {
          transform-origin: 200px 200px;
          animation: ah-pulse 3s ease-in-out infinite;
        }
        .atom-hero :global(.float) {
          animation: ah-float 5s ease-in-out infinite;
        }
        @keyframes ah-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        .atom-hero :global(.twinkle) {
          animation: ah-twinkle 2.4s ease-in-out infinite;
        }
        @keyframes ah-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes ah-pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.08);
            opacity: 1;
          }
        }
        @keyframes ah-twinkle {
          0%,
          100% {
            opacity: 0.15;
          }
          50% {
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .atom-hero :global(*) {
            animation: none !important;
          }
        }
      `}</style>

      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="ah-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="ah-bigglow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <radialGradient id="ah-core" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#fff7e6" />
            <stop offset="35%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#ea580c" />
          </radialGradient>
          <radialGradient id="ah-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" />
            <stop offset="70%" stopColor="#22d3ee" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ah-blue" gradientUnits="userSpaceOnUse" x1="-22" y1="0" x2="22" y2="0">
            <stop offset="0" stopColor="#0c3d5e" />
            <stop offset=".3" stopColor="#1d9bd8" />
            <stop offset=".5" stopColor="#bff0ff" />
            <stop offset=".68" stopColor="#2bb0ea" />
            <stop offset="1" stopColor="#083049" />
          </linearGradient>
          <linearGradient id="ah-orange" gradientUnits="userSpaceOnUse" x1="-22" y1="0" x2="22" y2="0">
            <stop offset="0" stopColor="#6b2a06" />
            <stop offset=".3" stopColor="#e88a0c" />
            <stop offset=".5" stopColor="#fff1c2" />
            <stop offset=".68" stopColor="#f5a312" />
            <stop offset="1" stopColor="#5a2205" />
          </linearGradient>
          <mask id="ah-wmask" maskUnits="userSpaceOnUse" x="-40" y="-100" width="80" height="200">
            <rect x="-40" y="-100" width="80" height="200" fill="#fff" />
            <circle cx="0" cy="-58" r="10" fill="#000" />
            <rect x="-10" y="-100" width="20" height="42" fill="#000" />
            <circle cx="0" cy="58" r="6.5" fill="#000" />
          </mask>
          <filter id="ah-shadow" x="-60%" y="-30%" width="220%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.7" />
          </filter>
          <path id="ah-orbit" d="M30,200 a170,62 0 1,0 340,0 a170,62 0 1,0 -340,0" />

          <g id="ah-fridge">
            <rect x="-7" y="-10" width="14" height="20" rx="2" />
            <line x1="-7" y1="-2" x2="7" y2="-2" />
            <line x1="-3.5" y1="-7" x2="-3.5" y2="-4.5" />
            <line x1="-3.5" y1="1" x2="-3.5" y2="5" />
          </g>
          <g id="ah-range">
            <rect x="-9" y="-9" width="18" height="18" rx="2" />
            <line x1="-9" y1="-4" x2="9" y2="-4" />
            <circle cx="-4.5" cy="-6.5" r="0.9" />
            <circle cx="0" cy="-6.5" r="0.9" />
            <circle cx="4.5" cy="-6.5" r="0.9" />
            <rect x="-5.5" y="0" width="11" height="5.5" rx="1" />
          </g>
          <g id="ah-washer">
            <rect x="-8" y="-9.5" width="16" height="19" rx="2" />
            <line x1="-5" y1="-6.5" x2="-1" y2="-6.5" />
            <circle cx="0" cy="2" r="5" />
            <circle cx="0" cy="2" r="2" />
          </g>
          <g id="ah-tv">
            <rect x="-10" y="-8" width="20" height="13" rx="2" />
            <line x1="0" y1="5" x2="0" y2="8.5" />
            <line x1="-5" y1="8.5" x2="5" y2="8.5" />
          </g>
        </defs>

        <circle cx="200" cy="200" r="195" fill="url(#ah-halo)" />
        <g className="spin-slow">
          <circle
            cx="200"
            cy="200"
            r="188"
            fill="none"
            stroke="#22d3ee"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            strokeDasharray="2 10"
          />
        </g>
        <g className="spin-rev">
          <circle
            cx="200"
            cy="200"
            r="176"
            fill="none"
            stroke="#f59e0b"
            strokeOpacity="0.35"
            strokeWidth="1.5"
            strokeDasharray="40 14 4 14"
          />
        </g>

        <g fill="#22d3ee">
          <circle className="twinkle" cx="62" cy="88" r="2.1" />
          <circle className="twinkle" cx="338" cy="70" r="1.8" style={{ animationDelay: '0.8s' }} />
          <circle className="twinkle" cx="350" cy="300" r="2.3" style={{ animationDelay: '1.4s' }} />
          <circle className="twinkle" cx="48" cy="296" r="1.7" style={{ animationDelay: '0.4s' }} />
          <circle className="twinkle" cx="200" cy="22" r="1.9" style={{ animationDelay: '1.9s' }} />
        </g>
        <g fill="#fbbf24">
          <circle className="twinkle" cx="300" cy="140" r="1.7" style={{ animationDelay: '1.1s' }} />
          <circle className="twinkle" cx="110" cy="350" r="1.9" style={{ animationDelay: '0.2s' }} />
        </g>

        <g fill="none" strokeWidth="2" filter="url(#ah-glow)">
          <use href="#ah-orbit" stroke="#22d3ee" strokeOpacity="0.75" />
          <use href="#ah-orbit" stroke="#f59e0b" strokeOpacity="0.75" transform="rotate(60 200 200)" />
          <use href="#ah-orbit" stroke="#22d3ee" strokeOpacity="0.75" transform="rotate(120 200 200)" />
        </g>

        <FlatOrbitIcons back />
        <TiltedOrbitIcons
          planeRotate={60}
          upright={-60}
          iconId="ah-range"
          dur="11s"
          begin="-3s"
          back
          maskKey="ah-orbit-60"
        />
        <TiltedOrbitIcons
          planeRotate={120}
          upright={-120}
          iconId="ah-washer"
          dur="17s"
          begin="-10s"
          back
          maskKey="ah-orbit-120"
        />

        <g className="pulse">
          <circle cx="170" cy="200" r="48" fill="#22d3ee" opacity="0.35" filter="url(#ah-bigglow)" />
          <circle cx="230" cy="200" r="48" fill="#f59e0b" opacity="0.35" filter="url(#ah-bigglow)" />
        </g>
        <g className="float">
          <image
            href="/images/wrenches.webp"
            x="132"
            y="132"
            width="136"
            height="136"
            filter="url(#ah-shadow)"
          />
        </g>

        <FlatOrbitIcons />
        <TiltedOrbitIcons
          planeRotate={60}
          upright={-60}
          iconId="ah-range"
          dur="11s"
          begin="-3s"
          maskKey="ah-orbit-60-front"
        />
        <TiltedOrbitIcons
          planeRotate={120}
          upright={-120}
          iconId="ah-washer"
          dur="17s"
          begin="-10s"
          maskKey="ah-orbit-120-front"
        />
      </svg>
    </div>
  );
}
