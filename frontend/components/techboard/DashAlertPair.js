import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useCriticalMassOrders } from '../../hooks/useCriticalMassOrders';
import { useAwaitingPayment } from '../../hooks/useAwaitingPayment';
import { TECH_AWAITING_PAY_PATH, TECH_MASS_PATH } from '../../lib/techRoutes';
import { awaitingSummary, formatMoneyShort } from '../../utils/awaitingPayment';
import { FrostedCardBackdrop, FrostedCardContent, LiveRepaintValue } from './frostedCardRepaint';
import { StatValueSkeleton, StatValueUnavailable } from './StatValue';
import CriticalMassPanel from './CriticalMassPanel';
import AwaitingPayPanel from './AwaitingPayPanel';

/*
 * Critical Mass + Awaiting Pay, side by side at the stat cards' height. Tapping either
 * tile slices one full-width panel open underneath; tapping the other swaps it, tapping
 * the same one folds it shut. .cm-card-clear lives on the Techboard page; the rest is below.
 */

const ORANGE = '#FB923C';
const YELLOW = '#FACC15';

/*
 * Everything here animates transform / opacity only, so iOS can run it on the compositor:
 * the glow pulse fades a pre-drawn shadow layer, the press seam slides with translateX.
 * (Animating box-shadow, left, or opacity on a backdrop-filter card repaints every frame.)
 */
const PAIR_CSS = `
@keyframes dap-glow{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes dap-seam{0%{transform:translate3d(-100%,0,0);opacity:1}80%{opacity:1}100%{transform:translate3d(100%,0,0);opacity:0}}
.dap-tile{position:relative;border-radius:.5rem;transition:transform .15s ease;-webkit-tap-highlight-color:transparent}
.dap-tile:active{transform:scale(.98)}
.dap-tile.is-lit:active{transform:none}
.dap-tile::after{content:'';position:absolute;inset:0;border-radius:.5rem;pointer-events:none;opacity:0;box-shadow:0 0 18px var(--dap-glow),0 0 36px var(--dap-glow-soft);will-change:opacity}
.dap-tile.is-pulsing::after{animation:dap-glow 2.5s ease-in-out infinite}
.dap-seam{position:absolute;inset:0;pointer-events:none;overflow:hidden;animation:dap-seam .3s cubic-bezier(.5,0,.3,1) both;will-change:transform}
.dap-seam::before{content:'';position:absolute;top:0;bottom:0;right:0;width:3px;background:#fff;box-shadow:0 0 8px #fff,0 0 18px var(--dap-seam)}
@media (prefers-reduced-motion: reduce){.dap-tile.is-pulsing::after{animation:none;opacity:.6}}
`;

function Tile({
  tone, active, lit, dim, pulsing, pressing, clearFlash, panelId, onPress, failed, loading, onRetry,
  icon, label, value, note,
}) {
  const Header = failed ? 'div' : 'button';
  const headerProps = failed
    ? {}
    : {
      type: 'button',
      onClick: onPress,
      'aria-expanded': active ? lit : undefined,
      'aria-controls': active ? panelId : undefined,
    };
  // Border as longhands only. Mixing the `border` shorthand with borderBottomColor made React
  // clear the bottom color on collapse, which then fell back to white (currentColor).
  const edge = active ? (lit ? tone.strong : tone.soft) : 'rgba(255,255,255,0.07)';
  // "Dim" the other tile with colors, not opacity (opacity on a blurred card is costly on iOS).
  const color = active ? (dim ? tone.dimColor : tone.color) : '#6B7280';
  const valueColor = active ? (dim ? tone.dimColor : tone.value) : '#374151';

  return (
    <div
      className={`dap-tile ${lit ? 'is-lit' : ''} ${pulsing ? 'is-pulsing' : ''}`}
      data-techboard-card
      style={{ '--dap-glow': tone.pulseGlow, '--dap-glow-soft': tone.pulseGlowSoft, '--dap-seam': tone.color }}
    >
      <div
        className={`relative overflow-hidden ${lit ? 'rounded-t-lg' : 'rounded-lg'}`}
        style={{
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: edge,
          borderBottomColor: lit ? 'transparent' : edge,
        }}
      >
        <FrostedCardBackdrop />
        <FrostedCardContent className="p-0">
          <Header
            {...headerProps}
            className="relative flex h-[80px] w-full flex-col justify-between overflow-hidden px-3 py-2.5 text-left touch-manipulation"
          >
            <span className="flex min-w-0 items-center gap-2">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="flex-shrink-0" style={{
                stroke: active ? color : '#374151', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round',
                filter: active && !dim ? `drop-shadow(0 0 5px ${tone.glow})` : 'none',
              }}>
                {icon}
              </svg>
              <span className="min-w-0 flex-1 truncate text-xs font-bold" style={{ color }}>{label}</span>
              {active ? (
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="flex-shrink-0" style={{
                  stroke: color, strokeWidth: 2.4, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round',
                  transition: 'transform .3s cubic-bezier(.2,.9,.3,1.2)', transform: lit ? 'rotate(180deg)' : 'none',
                }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              ) : null}
            </span>
            <span className="flex min-w-0 items-baseline gap-1.5">
              {failed
                ? <StatValueUnavailable onRetry={onRetry} />
                : loading
                  ? <StatValueSkeleton />
                  : (
                    <span className="text-2xl font-bold leading-none" style={{ color: valueColor, textShadow: active && !dim ? `0 0 8px ${tone.glow}` : 'none' }}>
                      <LiveRepaintValue value={value} />
                    </span>
                  )}
              {!failed && !loading ? (
                <span className="min-w-0 truncate text-xs" style={{ color: active && !dim ? tone.note : '#4B5563' }}>{note}</span>
              ) : null}
            </span>
            {pressing ? <span className="dap-seam" aria-hidden="true" /> : null}
            {clearFlash ? (
              <span key={clearFlash} className="cm-card-clear" aria-live="polite" style={{ right: 10, top: 6 }}>ALL CLEAR</span>
            ) : null}
          </Header>
        </FrostedCardContent>
      </div>
    </div>
  );
}

export default function DashAlertPair({ criticalCount, loading = false, failed = false, onRetry }) {
  const [which, setWhich] = useState('');       // panel shown: '' | 'cm' | 'ap'
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pressing, setPressing] = useState('');
  const [clearFlash, setClearFlash] = useState({ cm: 0, ap: 0 });
  const timers = useRef([]);
  const router = useRouter();

  const awaiting = useAwaitingPayment();
  const owed = awaiting.data;
  const apActive = Boolean(owed && owed.count > 0);
  const cmActive = !loading && criticalCount > 0;
  const overdue = useCriticalMassOrders({ enabled: which === 'cm' });

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  // The open side cleared out (live count): fold away.
  useEffect(() => {
    if ((which === 'cm' && !cmActive) || (which === 'ap' && !apActive)) {
      setOpen(false);
      setWhich('');
    }
  }, [which, cmActive, apActive]);

  const toggle = (key, isActive, isLoading, isFailed) => {
    if (!isActive) {
      if (!isLoading && !isFailed) setClearFlash((f) => ({ ...f, [key]: f[key] + 1 }));
      return;
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (open && which === key) {
      setOpen(false);
      setClosing(true);
      later(() => { setWhich(''); setClosing(false); }, 280);
      return;
    }
    setOpen(false);
    setPressing(key);
    later(() => {
      setPressing('');
      setClosing(false);
      setWhich(key);
      requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    }, which ? 120 : 160);
  };

  const go = (path) => router.push(path);

  const cmTone = { color: ORANGE, value: ORANGE, note: '#C9895A', dimColor: '#8A5A36', glow: 'rgba(251,146,60,0.7)', strong: 'rgba(251,146,60,0.85)', soft: 'rgba(251,146,60,0.6)', pulseGlow: 'rgba(251,146,60,0.38)', pulseGlowSoft: 'rgba(251,146,60,0.16)' };
  const apTone = { color: YELLOW, value: '#FDE68A', note: '#B8A35A', dimColor: '#8A7A3A', glow: 'rgba(250,204,21,0.55)', strong: 'rgba(250,204,21,0.8)', soft: 'rgba(250,204,21,0.5)', pulseGlow: 'rgba(250,204,21,0.3)', pulseGlowSoft: 'rgba(250,204,21,0.12)' };
  // Glow only while both are closed: nothing else animating while a panel folds.
  const calm = !which && !pressing;

  return (
    <div className="mb-4">
      <style>{PAIR_CSS}</style>
      <div className="grid grid-cols-2 gap-3">
        <Tile
          tone={cmTone}
          active={cmActive}
          lit={which === 'cm'}
          dim={which === 'ap'}
          pressing={pressing === 'cm'}
          pulsing={calm && cmActive}
          clearFlash={clearFlash.cm}
          panelId="critical-mass-panel"
          onPress={() => toggle('cm', cmActive, loading, failed)}
          failed={failed}
          loading={loading}
          onRetry={onRetry}
          label="Critical Mass"
          value={cmActive ? criticalCount : 0}
          note={cmActive ? 'overdue' : 'all clear'}
          icon={<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>}
        />
        <Tile
          tone={apTone}
          active={apActive}
          lit={which === 'ap'}
          dim={which === 'cm'}
          pressing={pressing === 'ap'}
          pulsing={calm && apActive}
          clearFlash={clearFlash.ap}
          panelId="awaiting-pay-panel"
          onPress={() => toggle('ap', apActive, awaiting.isLoading, Boolean(awaiting.error))}
          failed={Boolean(awaiting.error) && !owed}
          loading={awaiting.isLoading}
          onRetry={() => awaiting.refetch()}
          label="Awaiting Pay"
          value={apActive ? formatMoneyShort(owed.total_due) : '$0'}
          note={apActive ? awaitingSummary(owed) : 'all paid'}
          icon={<path d="M3 10h18M3 6h18v12H3zM7 15h4" />}
        />
      </div>

      {which === 'cm' ? (
        <CriticalMassPanel
          id="critical-mass-panel"
          open={open}
          closing={closing}
          rows={overdue.rows}
          total={overdue.total}
          loading={overdue.loading}
          error={overdue.error}
          onRetry={() => overdue.refetch()}
          onOpenList={() => go(TECH_MASS_PATH)}
        />
      ) : null}
      {which === 'ap' ? (
        <AwaitingPayPanel
          id="awaiting-pay-panel"
          open={open}
          closing={closing}
          data={owed}
          loading={awaiting.isLoading}
          error={awaiting.error}
          onRetry={() => awaiting.refetch()}
          onOpenList={() => go(TECH_AWAITING_PAY_PATH)}
        />
      ) : null}
    </div>
  );
}
