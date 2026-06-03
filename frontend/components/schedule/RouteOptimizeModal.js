import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import { previewRouteOptimization, applyRouteOptimization } from '../../services/api/routeOptimizationApi';

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'h:mm a');
  } catch {
    return String(iso);
  }
}

function formatDelta(minutes) {
  if (minutes === 0) return 'no change';
  const sign = minutes > 0 ? '+' : '';
  return `${sign}${minutes} min`;
}

export default function RouteOptimizeModal({
  isOpen,
  onClose,
  technicianId,
  technicianName,
  scheduleDate,
  onApplied,
}) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  const dateLabel = scheduleDate
    ? format(parseISO(`${scheduleDate}T12:00:00`), 'EEE, MMM d, yyyy')
    : '';

  const runPreview = async () => {
    if (!technicianId || !scheduleDate) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const result = await previewRouteOptimization({
        technicianId,
        scheduleDate,
      });
      setPreview(result);
    } catch (err) {
      setError(err?.message || 'Failed to build route preview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && technicianId && scheduleDate) {
      runPreview();
    }
    if (!isOpen) {
      setPreview(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, technicianId, scheduleDate]);

  const handleApply = async () => {
    if (!preview?.stops?.length) return;
    if (
      !window.confirm(
        `Apply ${preview.stops.length} time change(s) for ${technicianName || 'this technician'} on ${dateLabel}? This updates appointments in the database.`
      )
    ) {
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const changes = preview.stops.map((s) => ({
        appointment_id: s.appointment_id,
        new_start: s.new_start,
        new_end: s.new_end,
        route_sequence: s.route_sequence,
      }));
      const result = await applyRouteOptimization({
        technicianId,
        scheduleDate,
        changes,
      });
      if (result.skipped?.length) {
        setError(
          `Applied ${result.applied_count} stop(s). Skipped: ${result.skipped.join('; ')}`
        );
      }
      onApplied?.(result);
      if (!result.skipped?.length) {
        onClose();
        setPreview(null);
      }
    } catch (err) {
      setError(err?.message || 'Failed to apply route');
    } finally {
      setApplying(false);
    }
  };

  const travelSaved =
    preview?.total_travel_minutes_before != null &&
    preview?.total_travel_minutes_after != null
      ? preview.total_travel_minutes_before - preview.total_travel_minutes_after
      : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setPreview(null);
        setError(null);
        onClose();
      }}
      title="Optimize route"
      size="lg"
    >
      <div className="space-y-4 text-gray-800 dark:text-gray-100">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <strong>{technicianName || 'Technician'}</strong> · {dateLabel}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Proposed visit order and times are estimated from shop start, drive time (Google Routes),
          job duration, and calendar blocks. Review before applying.
        </p>

        {loading && (
          <div className="py-8 flex justify-center">
            <LoadingSpinner />
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {preview?.warnings?.length > 0 && (
          <ul className="text-sm text-amber-700 dark:text-amber-200 list-disc list-inside space-y-1">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        {preview && !loading && (
          <>
            {travelSaved != null && (
              <p className="text-sm">
                Est. driving: {preview.total_travel_minutes_before} min →{' '}
                {preview.total_travel_minutes_after} min
                {travelSaved > 0 && (
                  <span className="text-green-600 dark:text-green-400 ml-1">
                    (~{travelSaved} min less)
                  </span>
                )}
              </p>
            )}

            {preview.stop_count === 0 ? (
              <p className="text-sm text-gray-500">Nothing to optimize for this day.</p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">Stop</th>
                      <th className="px-3 py-2 text-left font-medium">Was</th>
                      <th className="px-3 py-2 text-left font-medium">Proposed</th>
                      <th className="px-3 py-2 text-left font-medium">Δ start</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {preview.stops.map((row) => (
                      <tr key={row.appointment_id} className="dark:bg-gray-800">
                        <td className="px-3 py-2">{row.route_sequence}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{row.label}</div>
                          {row.address && (
                            <div className="text-xs text-gray-500 truncate max-w-[200px]">
                              {row.address}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatTime(row.old_start)} – {formatTime(row.old_end)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-cyan-700 dark:text-cyan-300">
                          {formatTime(row.new_start)} – {formatTime(row.new_end)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatDelta(row.start_delta_minutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t dark:border-gray-700">
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              onClose();
            }}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={runPreview}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Refresh preview
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={applying || loading || !preview?.stops?.length}
            className="px-4 py-2 text-sm rounded-md text-black font-medium disabled:opacity-50"
            style={{ background: '#00D4FF' }}
          >
            {applying ? 'Applying…' : 'Apply changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
