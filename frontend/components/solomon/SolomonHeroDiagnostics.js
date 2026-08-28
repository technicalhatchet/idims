'use client';

import { useCallback, useEffect, useState } from 'react';

function rectSnapshot(el, stageRect) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const base = {
    x: Math.round(r.x),
    y: Math.round(r.y),
    w: Math.round(r.width),
    h: Math.round(r.height),
  };
  if (!stageRect) return base;
  return {
    ...base,
    relStageX: Math.round(r.x - stageRect.x),
    relStageY: Math.round(r.y - stageRect.y),
    relStageW: Math.round(r.width),
    relStageH: Math.round(r.height),
  };
}

function envSnapshot() {
  if (typeof window === 'undefined') return {};
  const vv = window.visualViewport;
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    visualViewport: vv
      ? {
        width: Math.round(vv.width),
        height: Math.round(vv.height),
        offsetTop: Math.round(vv.offsetTop),
        offsetLeft: Math.round(vv.offsetLeft),
        scale: vv.scale,
      }
      : null,
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    userAgent: navigator.userAgent,
  };
}

export function isSolomonHeroDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('solomon_hero_debug') === '1') return true;
    return new URLSearchParams(window.location.search).get('solomonDebug') === '1';
  } catch {
    return false;
  }
}

/**
 * Temporary forensic overlay — enable with ?solomonDebug=1 or localStorage solomon_hero_debug=1.
 * Does not alter layout coordinates.
 */
export default function SolomonHeroDiagnostics({ stageRef, cardRef, handRef }) {
  const [report, setReport] = useState(null);

  const measure = useCallback(() => {
    const stageEl = stageRef?.current;
    const cardEl = cardRef?.current;
    const handEl = handRef?.current;
    if (!stageEl) return;

    const stageRect = stageEl.getBoundingClientRect();
    const stageCs = getComputedStyle(stageEl);
    const handCs = handEl ? getComputedStyle(handEl) : null;

    const payload = {
      ts: new Date().toISOString(),
      env: envSnapshot(),
      stage: {
        ...rectSnapshot(stageEl),
        aspectRatio: stageCs.aspectRatio,
        width: stageCs.width,
        height: stageCs.height,
      },
      card: cardEl
        ? {
          ...rectSnapshot(cardEl, stageRect),
          computed: {
            left: getComputedStyle(cardEl).left,
            top: getComputedStyle(cardEl).top,
            width: getComputedStyle(cardEl).width,
          },
        }
        : null,
      hand: handEl
        ? {
          ...rectSnapshot(handEl, stageRect),
          natural: { w: handEl.naturalWidth, h: handEl.naturalHeight },
          computed: {
            left: handCs.left,
            top: handCs.top,
            width: handCs.width,
            height: handCs.height,
            objectFit: handCs.objectFit,
            objectPosition: handCs.objectPosition,
            transform: handCs.transform,
            transformOrigin: handCs.transformOrigin,
          },
        }
        : null,
      deltas: null,
    };

    if (payload.card && payload.hand) {
      payload.deltas = {
        handMinusCardY: payload.hand.relStageY - payload.card.relStageY,
        handMinusCardX: payload.hand.relStageX - payload.card.relStageX,
      };
    }

    setReport(payload);
    console.info('[SolomonHeroDiagnostics]', JSON.stringify(payload, null, 2));
  }, [stageRef, cardRef, handRef]);

  useEffect(() => {
    if (!isSolomonHeroDebugEnabled()) return undefined;

    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    const id = window.setInterval(measure, 2000);

    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.clearInterval(id);
    };
  }, [measure]);

  if (!isSolomonHeroDebugEnabled() || !report) return null;

  const lines = [
    `stage ${report.stage?.w}×${report.stage?.h} ar=${report.stage?.aspectRatio}`,
    report.card
      ? `card @ stage +${report.card.relStageX},+${report.card.relStageY} ${report.card.relStageW}×${report.card.relStageH}`
      : 'card (none)',
    report.hand
      ? `hand @ stage +${report.hand.relStageX},+${report.hand.relStageY} ${report.hand.relStageW}×${report.hand.relStageH}`
      : 'hand (none)',
    report.deltas
      ? `Δ hand−card: x=${report.deltas.handMinusCardX}px y=${report.deltas.handMinusCardY}px`
      : null,
    `hand object-fit=${report.hand?.computed?.objectFit} transform=${report.hand?.computed?.transform}`,
    `dpr=${report.env.devicePixelRatio} vv=${report.env.visualViewport?.width}×${report.env.visualViewport?.height}`,
  ].filter(Boolean);

  return (
    <div
      className="pointer-events-none fixed bottom-2 left-2 right-2 z-[9999] max-h-[45vh] overflow-auto rounded-lg border border-amber-400/50 bg-black/90 p-2 font-mono text-[9px] leading-snug text-amber-100 shadow-lg"
      aria-hidden
    >
      <p className="mb-1 font-bold text-amber-300">Solomon hero debug (temp)</p>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <p className="mt-1 break-all text-white/50">{report.env.userAgent}</p>
    </div>
  );
}
