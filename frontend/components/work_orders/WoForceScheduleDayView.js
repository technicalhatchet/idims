import { useMemo } from 'react';
import { format } from 'date-fns';
import { getShopDayChartBounds } from '../../hooks/useShopHours';
import {
  parseScheduleInstant,
  isCalendarBlockScheduleItem,
  getAppointmentStatusValue,
} from '../../utils/appointment-scheduling';
import { forceOrange } from './forceScheduleTheme';

const HOUR_ROW_PX = 36;
const MIN_CHART_HEIGHT_PX = 380;

function hourFromDate(date) {
  return date.getHours() + date.getMinutes() / 60;
}

function minutesFromDayStart(date, dayStartHour, totalMinutes) {
  if (!date) return 0;
  const raw = (date.getHours() - dayStartHour) * 60 + date.getMinutes();
  return Math.max(0, Math.min(totalMinutes, raw));
}

function getItemStartEnd(item) {
  const start = parseScheduleInstant(item.scheduled_start);
  const end = parseScheduleInstant(item.scheduled_end);
  if (!start || !end) return null;
  return { start, end };
}

function describeItem(item) {
  if (isCalendarBlockScheduleItem(item)) {
    return item.title || item.block_type || 'Block';
  }
  const wo = item.work_order_id ? `WO ${String(item.work_order_id).slice(0, 8)}` : 'Visit';
  const status = getAppointmentStatusValue(item);
  return status ? `${wo} (${status})` : wo;
}

function barStyle(start, end, dayStartHour, totalMinutes) {
  const startMin = minutesFromDayStart(start, dayStartHour, totalMinutes);
  const endMin = minutesFromDayStart(end, dayStartHour, totalMinutes);
  const height = Math.max(3, endMin - startMin);
  const top = (startMin / totalMinutes) * 100;
  const heightPct = (height / totalMinutes) * 100;
  return { top: `${top}%`, height: `${heightPct}%`, heightPct };
}

function overlapsShopWindow(start, end, dayStartHour, dayEndHour) {
  const startH = hourFromDate(start);
  const endH = hourFromDate(end);
  return endH > dayStartHour && startH < dayEndHour;
}

export default function WoForceScheduleDayView({
  scheduleItems = [],
  proposedStart,
  proposedEnd,
  workOrderId,
  dateLabel,
  shopHours = null,
  scheduleDate = null,
  isLoading = false,
}) {
  const proposed = useMemo(() => {
    if (!proposedStart || !proposedEnd) return null;
    const start = parseScheduleInstant(proposedStart);
    const end = parseScheduleInstant(proposedEnd);
    if (!start || !end) return null;
    return { start, end };
  }, [proposedStart, proposedEnd]);

  const chartDate = scheduleDate || proposedStart?.split('T')[0] || null;

  const { dayStartHour, dayEndHour, totalMinutes, chartHeightPx, hourLabels } = useMemo(() => {
    const bounds = getShopDayChartBounds(shopHours, chartDate || new Date());
    const span = bounds.dayEndHour - bounds.dayStartHour;
    const total = span * 60;
    const labels = [];
    for (let h = bounds.dayStartHour; h <= bounds.dayEndHour; h += 1) {
      labels.push(h);
    }
    return {
      dayStartHour: bounds.dayStartHour,
      dayEndHour: bounds.dayEndHour,
      totalMinutes: total,
      chartHeightPx: Math.max(MIN_CHART_HEIGHT_PX, span * HOUR_ROW_PX),
      hourLabels: labels,
    };
  }, [shopHours, chartDate]);

  const proposedOnChart =
    proposed && overlapsShopWindow(proposed.start, proposed.end, dayStartHour, dayEndHour);

  const shopHoursLabel = `${format(new Date(2000, 0, 1, dayStartHour % 24, 0), 'ha').toLowerCase()} – ${format(
    new Date(2000, 0, 1, dayEndHour % 24, 0),
    'ha'
  ).toLowerCase()}`;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Technician day view
          {dateLabel ? ` · ${dateLabel}` : ''}
          <span className="text-gray-500 dark:text-gray-400"> · Shop hours {shopHoursLabel}</span>
        </p>
        {isLoading && (
          <span className="text-[10px] text-gray-500 dark:text-gray-400">Loading…</span>
        )}
      </div>

      {proposed && (
        <div
          className={`mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-3 py-2 text-xs ${forceOrange.borderDashed} ${forceOrange.bg} ${forceOrange.text} ${forceOrange.textDark}`}
        >
          <span className="font-semibold">Proposed slot</span>
          <span>
            {format(proposed.start, 'h:mm a')} – {format(proposed.end, 'h:mm a')}
          </span>
          {proposedOnChart ? (
            <span className="opacity-80">(shown on timeline below)</span>
          ) : (
            <span className="opacity-80">(outside shop hours for this day)</span>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <div
          className="flex flex-col justify-between text-[11px] text-gray-500 dark:text-gray-400 w-9 shrink-0"
          style={{ height: chartHeightPx }}
        >
          {hourLabels.map((h) => (
            <span key={h} className="leading-none">
              {format(new Date(2000, 0, 1, h % 24, 0), 'ha').toLowerCase()}
            </span>
          ))}
        </div>

        <div
          className="relative flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          style={{ height: chartHeightPx, minHeight: MIN_CHART_HEIGHT_PX }}
        >
          {hourLabels.slice(0, -1).map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-700/80"
              style={{
                top: `${((h - dayStartHour) / (dayEndHour - dayStartHour)) * 100}%`,
              }}
            />
          ))}

          {scheduleItems.map((item) => {
            const range = getItemStartEnd(item);
            if (!range) return null;
            if (!overlapsShopWindow(range.start, range.end, dayStartHour, dayEndHour)) {
              return null;
            }
            const isBlock = isCalendarBlockScheduleItem(item);
            const isThisWo =
              workOrderId &&
              item.work_order_id &&
              String(item.work_order_id) === String(workOrderId);
            const { top, height, heightPct } = barStyle(
              range.start,
              range.end,
              dayStartHour,
              totalMinutes
            );
            const showInBarLabel = heightPct >= 5;
            return (
              <div
                key={item.id || `${item.scheduled_start}-${describeItem(item)}`}
                className={`absolute left-1.5 right-1.5 rounded px-1.5 py-1 text-[11px] leading-tight overflow-hidden border ${
                  isBlock
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-800 dark:text-purple-200'
                    : isThisWo
                      ? `bg-[#0089B9]/40 border-2 border-[#0089B9] text-white`
                      : `bg-[#0089B9]/25 border border-[#0089B9]/55 text-white`
                }`}
                style={{ top, height }}
                title={`${describeItem(item)} · ${format(range.start, 'h:mm a')} – ${format(range.end, 'h:mm a')}`}
              >
                {showInBarLabel && (
                  <div
                    className={`px-1.5 py-1 text-[11px] flex items-center gap-1.5 min-w-0 leading-tight ${
                      isBlock ? 'text-purple-800 dark:text-purple-200' : 'text-white'
                    }`}
                  >
                    <span className="truncate min-w-0">{describeItem(item)}</span>
                    <span className="shrink-0 opacity-95">
                      {format(range.start, 'h:mm a')} – {format(range.end, 'h:mm a')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {proposedOnChart && (() => {
            const { top, height, heightPct } = barStyle(
              proposed.start,
              proposed.end,
              dayStartHour,
              totalMinutes
            );
            const showInBarLabel = heightPct >= 5;
            return (
              <div
                className={`absolute left-1 right-1 rounded border-2 border-dashed z-10 pointer-events-none ${forceOrange.borderStrong} ${forceOrange.bgStrong}`}
                style={{ top, height, minHeight: showInBarLabel ? undefined : '6px' }}
                title={`Proposed · ${format(proposed.start, 'h:mm a')} – ${format(proposed.end, 'h:mm a')}`}
              >
                {showInBarLabel && (
                  <div className="px-1.5 py-1 text-[11px] flex items-center gap-1.5 min-w-0 text-white font-bold leading-tight">
                    <span className="shrink-0">Proposed</span>
                    <span className="truncate opacity-95">
                      {format(proposed.start, 'h:mm a')} – {format(proposed.end, 'h:mm a')}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          Legend :
          <span
            className="inline-flex h-5 min-w-[4.5rem] items-center justify-center rounded border border-purple-500/40 bg-purple-500/20 px-1.5 text-[9px] leading-none text-purple-800 dark:text-purple-200"
          >
            Block
          </span>
          
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-flex h-5 min-w-[4.5rem] items-center justify-center rounded border-2 border-dashed px-1.5 text-[9px] font-bold leading-none text-white ${forceOrange.borderStrong} ${forceOrange.bgStrong}`}
          >
            Proposed
          </span>
          
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-flex h-5 min-w-[4.5rem] items-center justify-center rounded border border-[#0089B9]/55 bg-[#0089B9]/25 px-1.5 text-[9px] leading-none text-white"
          >
            Appointments
          </span>
          
        </span>
      </div>
    </div>
  );
}
