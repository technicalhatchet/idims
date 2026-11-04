import { useEffect, useRef, useState } from 'react';
import { useSweepNavigate } from '../../hooks/useSweepNavigate';
import { useCriticalMassOrders } from '../../hooks/useCriticalMassOrders';
import { TECH_MASS_PATH } from '../../lib/techRoutes';
import { FrostedCardBackdrop, FrostedCardContent, LiveRepaintValue } from './frostedCardRepaint';
import { StatValueSkeleton, StatValueUnavailable } from './StatValue';
import CriticalMassPanel from './CriticalMassPanel';

/*
 * Card CSS it relies on lives on the Techboard page (.tech-glass-card, .tech-breathing-pulse,
 * .tech-sweep-*, .cm-card-seam, .cm-card-clear).
 */
// ── Critical Mass Card: slices open in place to show the most overdue jobs ───
export default function CriticalMassCard({ count, loading = false, failed = false, onRetry }) {
  const [sweeping, setSweeping] = useState(false);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [clearFlash, setClearFlash] = useState(0);
  const timers = useRef([]);
  const { push: sweepPush } = useSweepNavigate(600);
  const isActive = !loading && count > 0;
  const overdue = useCriticalMassOrders({ enabled: mounted });

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  // Nothing overdue any more (live count): fold the panel away.
  useEffect(() => {
    if (!isActive && mounted) {
      setOpen(false);
      setMounted(false);
    }
  }, [isActive, mounted]);

  const toggle = () => {
    if (!isActive) {
      if (!loading && !failed) setClearFlash((n) => n + 1);
      return;
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (open) {
      setOpen(false);
      setClosing(true);
      later(() => {
        setMounted(false);
        setClosing(false);
      }, 280);
      return;
    }
    // Laser seam across the card, then the panel slices open.
    setPressing(true);
    later(() => {
      setPressing(false);
      setClosing(false);
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    }, 160);
  };

  // When the count failed to load, the Retry inside is its own button, so the header
  // can't be one too (nested buttons break taps on iOS). Nothing to expand then anyway.
  const Header = failed ? 'div' : 'button';
  const headerProps = failed
    ? {}
    : {
      type: 'button',
      onClick: toggle,
      'aria-expanded': isActive ? open : undefined,
      'aria-controls': isActive ? 'critical-mass-panel' : undefined,
    };

  const openFullList = () => {
    sweepPush(TECH_MASS_PATH, { onSweepStart: () => setSweeping(true) });
  };

  return (
    <div
      className={`tech-glass-card mb-4 ${mounted ? '' : 'tech-hover-lift'} ${sweeping ? 'tech-sweep-active' : ''} ${isActive && !mounted ? 'tech-breathing-pulse' : ''}`}
      data-sweep-color={isActive ? 'orange' : 'cyan'}
      data-techboard-card
    >
      <div
        className={`relative overflow-hidden ${mounted ? 'rounded-t-lg' : 'rounded-lg'}`}
        style={{
          border: isActive ? '1px solid rgba(251,146,60,0.6)' : '1px solid rgba(255,255,255,0.07)',
          transition: 'border-radius .25s',
        }}
      >
        <FrostedCardBackdrop />
        <div
          className="tech-sweep-overlay"
          style={{
            background: sweeping
              ? `linear-gradient(120deg, transparent 0%, ${isActive ? 'rgba(251, 146, 60, 0.4)' : 'rgba(0, 212, 255, 0.4)'} 50%, transparent 100%)`
              : undefined,
          }}
        />
        {isActive && (
          <div className="pointer-events-none absolute inset-0 rounded-lg z-[1]" style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(251,146,60,0.1) 0%, transparent 60%), radial-gradient(ellipse at 100% 0%, rgba(251,146,60,0.1) 0%, transparent 60%), radial-gradient(ellipse at 0% 100%, rgba(251,146,60,0.1) 0%, transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(251,146,60,0.1) 0%, transparent 60%)' }} />
        )}
        <FrostedCardContent className="p-0">
          <Header
            {...headerProps}
            className="relative flex w-full items-center gap-4 overflow-hidden p-4 text-left touch-manipulation"
          >
            <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 tech-icon-wrap" style={{ background: '#080C14' }}>
              <svg viewBox="0 0 24 24" className="w-7 h-7" aria-hidden="true" style={{
                stroke: isActive ? '#FB923C' : '#374151',
                strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round',
                filter: isActive ? 'drop-shadow(0 0 6px rgba(251,146,60,0.8))' : 'none',
              }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: isActive ? '#FB923C' : '#6B7280', textShadow: isActive ? '0 0 8px rgba(251,146,60,0.5)' : 'none' }}>
                Critical Mass
              </p>
              <p className="text-xs mt-0.5" style={{ color: isActive ? '#9CA3AF' : '#4B5563' }}>
                {loading
                  ? 'Loading overdue count…'
                  : open
                    ? 'Tap to collapse'
                    : (
                      <LiveRepaintValue
                        value={isActive ? count : 'clear'}
                      >
                        {isActive
                          ? `${count} order${count > 1 ? 's' : ''} past scheduled date — needs attention`
                          : 'All clear — no overdue orders'}
                      </LiveRepaintValue>
                    )}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2.5">
              {failed
                ? <StatValueUnavailable onRetry={onRetry} />
                : loading
                  ? <StatValueSkeleton />
                  : (
                    <p className="text-2xl font-bold" style={{ color: isActive ? '#FB923C' : '#374151' }}>
                      <LiveRepaintValue value={count} />
                    </p>
                  )}
              {isActive ? (
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{
                  stroke: '#FB923C', strokeWidth: 2.4, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round',
                  transition: 'transform .3s cubic-bezier(.2,.9,.3,1.2)', transform: open ? 'rotate(180deg)' : 'none',
                }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              ) : null}
            </div>
            {pressing ? <span className="cm-card-seam" aria-hidden="true" /> : null}
            {clearFlash ? (
              <span key={clearFlash} className="cm-card-clear" aria-live="polite">ALL CLEAR</span>
            ) : null}
          </Header>
        </FrostedCardContent>
      </div>
      {mounted ? (
        <CriticalMassPanel
          id="critical-mass-panel"
          open={open}
          closing={closing}
          rows={overdue.rows}
          total={overdue.total}
          loading={overdue.loading}
          error={overdue.error}
          onRetry={() => overdue.refetch()}
          onOpenList={openFullList}
        />
      ) : null}
    </div>
  );
}
