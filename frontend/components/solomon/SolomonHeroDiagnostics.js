'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  isSolomonHeroDebugEnabled,
  setSolomonHeroDebugEnabled,
  SOLOMON_HERO_DEBUG_EVENT,
} from './solomonHeroDebug';
import {
  solomonPrimaryCtaArtboardPercent,
  solomonSessionCardBottomPercent,
} from './solomonHeroComposition';

function rectSnapshot(el, stageRect) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
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

/**
 * Temporary forensic overlay — enable with ?solomonDebug=1, or tap Solomon logo 5× on home.
 * Renders via portal (stage transform traps position:fixed descendants).
 */
export default function SolomonHeroDiagnostics({
  stageRef,
  cardRef,
  handRef,
  ctaRef,
  hasActiveSession = false,
}) {
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [report, setReport] = useState(null);

  useEffect(() => {
    const sync = () => setDebugEnabled(isSolomonHeroDebugEnabled());
    if (new URLSearchParams(window.location.search).get('solomonDebug') === '1') {
      setSolomonHeroDebugEnabled(true);
    }
    sync();
    window.addEventListener(SOLOMON_HERO_DEBUG_EVENT, sync);
    return () => window.removeEventListener(SOLOMON_HERO_DEBUG_EVENT, sync);
  }, []);

  const measure = useCallback(() => {
    const stageEl = stageRef?.current;
    const cardEl = cardRef?.current;
    const handEl = handRef?.current;
    const ctaEl = ctaRef?.current
      ?? document.querySelector('[data-solomon-primary-cta]');
    const spacerEl = document.querySelector('[data-solomon-content-spacer]');
    const headerEl = document.querySelector('[data-solomon-home-header]');
    const mainEl = stageEl.closest('main');
    if (!stageEl) return;

    const stageRect = stageEl.getBoundingClientRect();
    const stageH = stageRect.height;
    const ctaTargetPct = solomonPrimaryCtaArtboardPercent(hasActiveSession);
    const expectedCtaRelStageY = Math.round(stageH * (ctaTargetPct / 100));
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
      cta: ctaEl
        ? {
          ...rectSnapshot(ctaEl, stageRect),
          viewportY: Math.round(ctaEl.getBoundingClientRect().y),
        }
        : null,
      flow: {
        headerH: headerEl ? Math.round(headerEl.getBoundingClientRect().height) : null,
        spacerH: spacerEl ? Math.round(spacerEl.getBoundingClientRect().height) : null,
        mainPaddingTop: mainEl
          ? Math.round(parseFloat(getComputedStyle(mainEl).paddingTop) || 0)
          : null,
      },
      ctaAnchor: {
        targetPct: ctaTargetPct,
        expectedRelStageY: expectedCtaRelStageY,
        cardBottomPct: solomonSessionCardBottomPercent(),
      },
      deltas: null,
      ctaDeltas: null,
    };

    if (payload.card && payload.hand) {
      payload.deltas = {
        handMinusCardY: payload.hand.relStageY - payload.card.relStageY,
        handMinusCardX: payload.hand.relStageX - payload.card.relStageX,
      };
    }

    if (payload.cta) {
      const cardBottom = payload.card
        ? payload.card.relStageY + payload.card.relStageH
        : null;
      payload.ctaDeltas = {
        actualMinusExpectedY: payload.cta.relStageY - expectedCtaRelStageY,
        ctaMinusCardBottom: cardBottom != null ? payload.cta.relStageY - cardBottom : null,
      };
    }

    setReport(payload);
    console.info('[SolomonHeroDiagnostics]', JSON.stringify(payload, null, 2));
  }, [stageRef, cardRef, handRef, ctaRef, hasActiveSession]);

  useEffect(() => {
    if (!debugEnabled) return undefined;

    const run = () => requestAnimationFrame(measure);
    run();
    const onResize = () => run();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    const id = window.setInterval(run, 2000);

    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.clearInterval(id);
    };
  }, [debugEnabled, measure]);

  if (!debugEnabled || typeof document === 'undefined') return null;

  const lines = report
    ? [
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
      report.cta
        ? `cta @ stage +${report.cta.relStageX},+${report.cta.relStageY} ${report.cta.relStageW}×${report.cta.relStageH} (viewport y=${report.cta.viewportY})`
        : 'cta (none)',
      report.ctaAnchor
        ? `cta target ${report.ctaAnchor.targetPct}% → expected stage y=${report.ctaAnchor.expectedRelStageY}`
        : null,
      report.ctaDeltas
        ? `Δ cta−expected: ${report.ctaDeltas.actualMinusExpectedY}px · cta−cardBottom: ${report.ctaDeltas.ctaMinusCardBottom ?? 'n/a'}px`
        : null,
      report.flow?.headerH != null && report.flow?.spacerH != null
        ? `flow header=${report.flow.headerH}px spacer=${report.flow.spacerH}px mainPadTop=${report.flow.mainPaddingTop ?? 'n/a'}px`
        : null,
      `hand object-fit=${report.hand?.computed?.objectFit} transform=${report.hand?.computed?.transform}`,
      `dpr=${report.env.devicePixelRatio} vv=${report.env.visualViewport?.width}×${report.env.visualViewport?.height}`,
    ].filter(Boolean)
    : ['measuring…'];

  return createPortal(
    <div
      className="pointer-events-none fixed bottom-2 left-2 right-2 z-[99999] max-h-[45vh] overflow-auto rounded-lg border border-amber-400/50 bg-black/90 p-2 font-mono text-[9px] leading-snug text-amber-100 shadow-lg"
      aria-hidden
    >
      <p className="mb-1 font-bold text-amber-300">Solomon hero debug (tap logo 5× to toggle)</p>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {report?.env?.userAgent ? (
        <p className="mt-1 break-all text-white/50">{report.env.userAgent}</p>
      ) : null}
    </div>,
    document.body,
  );
}
