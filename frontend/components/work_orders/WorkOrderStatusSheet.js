import { useMemo } from 'react';
import MobileActionSheet from '../ui/MobileActionSheet';
import { laserTileStyle } from '../navigation/LaserBarParts';
import { groupWorkOrderStatusOptions, workOrderStatusLabel } from '../../utils/workOrderStatusOptions';

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const GROUP_TONE = {
  cyan: { heading: '#5FB7C9', rule: 'rgba(34, 211, 238, 0.2)', dot: '#22D3EE' },
  orange: { heading: '#FF9F4A', rule: 'rgba(255, 138, 31, 0.3)', dot: '#FF8A1F' },
};

function chipStyle({ isNow, picked, danger }) {
  if (isNow) {
    return { border: '1px dashed rgba(165, 243, 252, 0.4)', background: 'transparent', color: '#6B8296' };
  }
  if (picked) {
    return danger
      ? { border: '1px solid #FCA5A5', background: 'rgba(239, 68, 68, 0.2)', color: '#FEE2E2', boxShadow: '0 0 14px rgba(239, 68, 68, 0.4)' }
      : { border: '1px solid #A5F3FC', background: 'rgba(34, 211, 238, 0.18)', color: '#ECFEFF', boxShadow: '0 0 14px rgba(34, 211, 238, 0.4)' };
  }
  return danger
    ? { border: '1px solid rgba(248, 113, 113, 0.35)', background: 'rgba(127, 29, 29, 0.14)', color: '#FECACA' }
    : { border: '1px solid rgba(34, 211, 238, 0.2)', background: 'rgba(13, 22, 38, 0.72)', color: '#D5E6EE' };
}

/**
 * Mobile "Update status" sheet: every status a user may set, grouped, as laser chips.
 * The current status is shown but can't be picked; tap a chip again to clear it.
 */
export default function WorkOrderStatusSheet({
  open,
  onClose,
  orderNumber,
  currentStatus,
  currentLabel,
  options,
  value,
  onChange,
  notes,
  onNotesChange,
  onSubmit,
  busy = false,
}) {
  const groups = useMemo(() => groupWorkOrderStatusOptions(options || []), [options]);
  const labelOf = useMemo(() => Object.fromEntries((options || []).map((o) => [o.value, o.label])), [options]);
  const picked = value || '';
  const danger = picked === 'canceled';
  const ready = Boolean(picked) && !busy;

  return (
    <MobileActionSheet
      open={open}
      onClose={onClose}
      title="Update status"
      kicker={orderNumber ? `WO #${orderNumber} // STATUS` : 'WORK ORDER // STATUS'}
      zIndex={20070}
      fill
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2" style={{ minHeight: 30 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: '#5B7083' }}>NOW</span>
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ border: '1px dashed rgba(165, 243, 252, 0.55)', color: '#A5F3FC' }}>
            {currentLabel || labelOf[currentStatus] || workOrderStatusLabel(currentStatus) || '—'}
          </span>
          {picked ? (
            <>
              <span aria-hidden="true" style={{ fontFamily: MONO, fontSize: 12, color: '#22D3EE' }}>→</span>
              <span
                className="max-w-[150px] truncate rounded-full px-2.5 py-1 text-xs font-bold"
                style={danger
                  ? { background: 'rgba(239, 68, 68, 0.18)', border: '1px solid #F87171', color: '#FEE2E2' }
                  : { background: 'rgba(34, 211, 238, 0.16)', border: '1px solid #22D3EE', color: '#ECFEFF' }}
              >
                {labelOf[picked]}
              </span>
            </>
          ) : null}
        </div>

        <div className="lsheet-stagger mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
          {groups.map((g) => {
            const tone = GROUP_TONE[g.tone] || GROUP_TONE.cyan;
            return (
              <section key={g.key} aria-label={g.label}>
                <div className="flex items-center gap-2" style={{ margin: '9px 0 5px' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: tone.heading }}>{g.label}</span>
                  <span className="h-px flex-1" style={{ background: tone.rule }} />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {g.items.map((o) => {
                    const isNow = o.value === currentStatus;
                    const isPicked = o.value === picked;
                    const isDanger = o.value === 'canceled';
                    const dot = isDanger ? '#F87171' : tone.dot;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        disabled={isNow || busy}
                        aria-pressed={isPicked}
                        onClick={() => onChange(isPicked ? '' : o.value)}
                        className="lsheet-row flex min-h-[44px] items-center gap-2 rounded-[10px] py-1.5 pl-3 pr-2.5 text-left text-[13px] font-semibold leading-4 touch-manipulation"
                        style={{ ...chipStyle({ isNow, picked: isPicked, danger: isDanger }), cursor: isNow ? 'default' : 'pointer' }}
                      >
                        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} />
                        <span className="min-w-0 flex-1">{o.label}</span>
                        {isNow ? (
                          <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', color: '#5FB7C9' }}>NOW</span>
                        ) : null}
                        {isPicked ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <label className="mt-2 block">
          <span className="sr-only">Note (optional)</span>
          <input
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Add a note (optional)"
            className="h-11 w-full rounded-[10px] px-3 text-[16px] font-medium outline-none"
            style={{ background: 'rgba(2, 6, 12, 0.7)', border: '1px solid rgba(34, 211, 238, 0.3)', color: '#ECFEFF' }}
          />
        </label>
        <button
          type="button"
          disabled={!ready}
          onClick={onSubmit}
          className="mt-2.5 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold uppercase tracking-[0.06em] touch-manipulation"
          style={{ transition: 'all .25s', ...laserTileStyle(!picked ? 'off' : danger ? 'red' : 'cyan') }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {busy ? 'Updating…' : picked ? 'Set status' : 'Pick a status'}
        </button>
      </div>
    </MobileActionSheet>
  );
}
