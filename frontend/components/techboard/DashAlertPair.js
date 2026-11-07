import { useEffect, useRef, useState } from 'react';
import { useSweepNavigate } from '../../hooks/useSweepNavigate';
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
 * the same one folds it shut. Card CSS (.tech-glass-card, .tech-breathing-pulse,
 * .cm-card-seam, .cm-card-clear) lives on the Techboard page.
 */

const ORANGE = '#FB923C';
const YELLOW = '#FACC15';

const PAIR_CSS = `
@keyframes ap-breathe{0%,100%{box-shadow:0 0 10px rgba(250,204,21,.16),0 0 20px rgba(250,204,21,.08)}50%{box-shadow:0 0 18px rgba(250,204,21,.32),0 0 36px rgba(250,204,21,.16)}}
.ap-breathing-pulse > div{animation:ap-breathe 2.5s ease-in-out infinite}
.ap-card-seam{position:absolute;top:0;bottom:0;width:3px;background:#fff;box-shadow:0 0 8px #fff,0 0 18px ${YELLOW};pointer-events:none;animation:cm-card-seam .3s cubic-bezier(.5,0,.3,1) both}
`;

function Tile({
  tone, active, lit, dim, pressing, clearFlash, panelId, onPress, failed, loading, onRetry,
  icon, label, value, note, seamClass,
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
  const border = active
    ? (lit ? `1px solid ${tone.strong}` : `1px solid ${tone.soft}`)
    : '1px solid rgba(255,255,255,0.07)';
  const color = active ? tone.color : '#6B7280';

  return (
    <div
      className={`tech-glass-card ${lit ? '' : 'tech-hover-lift'} ${active && !lit && !dim ? tone.pulse : ''}`}
      data-sweep-color={tone.sweep}
      data-techboard-card
      style={{ opacity: dim ? 0.55 : 1, transition: 'opacity .25s' }}
    >
      <div
        className={`relative overflow-hidden ${lit ? 'rounded-t-lg' : 'rounded-lg'}`}
        style={{ border, borderBottomColor: lit ? 'transparent' : undefined, transition: 'border-radius .25s' }}
      >
        <FrostedCardBackdrop />
        <FrostedCardContent className="p-0">
          <Header
            {...headerProps}
            className="relative flex h-[80px] w-full flex-col justify-between overflow-hidden px-3 py-2.5 text-left touch-manipulation"
          >
            <span className="flex min-w-0 items-center gap-2">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="flex-shrink-0" style={{
                stroke: active ? tone.color : '#374151', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round',
                filter: active ? `drop-shadow(0 0 5px ${tone.glow})` : 'none',
              }}>
                {icon}
              </svg>
              <span className="min-w-0 flex-1 truncate text-xs font-bold" style={{ color }}>{label}</span>
              {active ? (
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="flex-shrink-0" style={{
                  stroke: tone.color, strokeWidth: 2.4, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round',
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
                    <span className="text-2xl font-bold leading-none" style={{ color: active ? tone.value : '#374151', textShadow: active ? `0 0 8px ${tone.glow}` : 'none' }}>
                      <LiveRepaintValue value={value} />
                    </span>
                  )}
              {!failed && !loading ? (
                <span className="min-w-0 truncate text-xs" style={{ color: active ? tone.note : '#4B5563' }}>{note}</span>
              ) : null}
            </span>
            {pressing ? <span className={seamClass} aria-hidden="true" /> : null}
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
  const [sweeping, setSweeping] = useState(false);
  const timers = useRef([]);
  const { push: sweepPush } = useSweepNavigate(600);

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

  const go = (path) => sweepPush(path, { onSweepStart: () => setSweeping(true) });

  const cmTone = { color: ORANGE, value: ORANGE, note: '#C9895A', glow: 'rgba(251,146,60,0.7)', strong: 'rgba(251,146,60,0.85)', soft: 'rgba(251,146,60,0.6)', pulse: 'tech-breathing-pulse', sweep: 'orange' };
  const apTone = { color: YELLOW, value: '#FDE68A', note: '#B8A35A', glow: 'rgba(250,204,21,0.55)', strong: 'rgba(250,204,21,0.8)', soft: 'rgba(250,204,21,0.5)', pulse: 'ap-breathing-pulse', sweep: 'orange' };

  return (
    <div className={`mb-4 ${sweeping ? 'tech-sweep-active' : ''}`}>
      <style>{PAIR_CSS}</style>
      <div className="grid grid-cols-2 gap-3">
        <Tile
          tone={cmTone}
          active={cmActive}
          lit={which === 'cm'}
          dim={which === 'ap'}
          pressing={pressing === 'cm'}
          clearFlash={clearFlash.cm}
          panelId="critical-mass-panel"
          onPress={() => toggle('cm', cmActive, loading, failed)}
          failed={failed}
          loading={loading}
          onRetry={onRetry}
          seamClass="cm-card-seam"
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
          clearFlash={clearFlash.ap}
          panelId="awaiting-pay-panel"
          onPress={() => toggle('ap', apActive, awaiting.isLoading, Boolean(awaiting.error))}
          failed={Boolean(awaiting.error) && !owed}
          loading={awaiting.isLoading}
          onRetry={() => awaiting.refetch()}
          seamClass="ap-card-seam"
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
