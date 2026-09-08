'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ProcedureImage } from '../types';

interface ProcedureStepImagesProps {
  images?: ProcedureImage[];
}

export default function ProcedureStepImages({ images }: ProcedureStepImagesProps) {
  const validImages = (images ?? []).filter((image) => image.assetPath);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const close = useCallback(() => setOpen(false), []);

  const openViewer = () => {
    setIndex(0);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(0, current - 1));
      if (event.key === 'ArrowRight') {
        setIndex((current) => Math.min(validImages.length - 1, current + 1));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close, open, validImages.length]);

  if (!validImages.length) return null;

  const label =
    validImages.length === 1 ? 'View OEM diagram' : `View OEM diagrams (${validImages.length})`;
  const current = validImages[index];
  const hasMultiple = validImages.length > 1;

  return (
    <>
      <button
        type="button"
        onClick={openViewer}
        className="w-full rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/60 px-4 py-2.5 text-sm font-medium text-[var(--solomon-text-primary)] transition-colors hover:bg-[var(--solomon-surface)]/90 focus:outline-none focus:ring-1 focus:ring-[color:var(--solomon-focus-ring)]"
      >
        {label}
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[99999] isolate flex flex-col bg-[#0a0f1a] touch-manipulation"
              role="dialog"
              aria-modal="true"
              aria-label="OEM service manual diagram"
            >
              <div
                className="flex shrink-0 items-start gap-3 border-b border-white/10 bg-[#0a0f1a] px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--solomon-status-reference)]/90">
                    OEM diagram
                    {hasMultiple ? ` · ${index + 1} of ${validImages.length}` : ''}
                  </p>
                  <p className="mt-1 text-sm leading-snug text-[var(--solomon-text-primary)]">
                    {current.caption}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close diagram viewer"
                  className="inline-flex h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-[#1e293b] text-2xl font-semibold leading-none text-white shadow-lg hover:bg-[#334155] focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                >
                  ×
                </button>
              </div>

              <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#0a0f1a] px-3 py-4">
                {hasMultiple ? (
                  <button
                    type="button"
                    onClick={() => setIndex((currentIndex) => Math.max(0, currentIndex - 1))}
                    disabled={index === 0}
                    aria-label="Previous diagram"
                    className="absolute left-2 z-[1] inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-lg text-white disabled:opacity-30"
                  >
                    ‹
                  </button>
                ) : null}

                <img
                  src={current.assetPath}
                  alt={current.caption}
                  className="max-h-full max-w-full object-contain bg-white/95"
                />

                {hasMultiple ? (
                  <button
                    type="button"
                    onClick={() =>
                      setIndex((currentIndex) =>
                        Math.min(validImages.length - 1, currentIndex + 1),
                      )
                    }
                    disabled={index === validImages.length - 1}
                    aria-label="Next diagram"
                    className="absolute right-2 z-[1] inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-lg text-white disabled:opacity-30"
                  >
                    ›
                  </button>
                ) : null}
              </div>

              <div
                className="shrink-0 border-t border-white/10 bg-[#0a0f1a] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3"
              >
                <button
                  type="button"
                  onClick={close}
                  className="w-full rounded-xl border border-[color:var(--solomon-primary-border)] bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-4 py-4 text-base font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                >
                  Back to measurement
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
