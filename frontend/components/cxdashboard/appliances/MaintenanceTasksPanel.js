import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { portalFetch } from '../../../utils/portalFetch';
import { useFeature } from '../../../context/FeatureFlagsContext';

const STATUS_LABEL = {
  due_now: { text: 'Due now', color: '#f97316' },
  due_soon: { text: 'Due soon', color: '#a78bfa' },
  ok: { text: 'On track', color: '#6b7280' },
  snoozed: { text: 'Snoozed', color: '#6b7280' },
  disabled: { text: 'Off', color: '#4b5563' },
};

export default function MaintenanceTasksPanel({ applianceId, applianceSerial }) {
  const enabled = useFeature('maintenance_reminders');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!enabled || !applianceId) return;
    setLoading(true);
    try {
      const data = await portalFetch(`/portal/appliances/${applianceId}/maintenance`);
      setTasks(data?.tasks || []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [applianceId, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  if (!enabled) return null;

  const act = async (taskId, action) => {
    setBusyId(taskId);
    try {
      await portalFetch(`/portal/appliances/${applianceId}/maintenance/${taskId}/${action}`, { method: 'POST' });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading maintenance…</p>;
  }

  if (!tasks.length) {
    return <p className="text-gray-500 text-sm">No maintenance tasks for this appliance type.</p>;
  }

  const scheduleBase = applianceSerial
    ? `/cxdashboard/appliances/${encodeURIComponent(applianceSerial)}/schedule`
    : null;

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const st = STATUS_LABEL[task.status] || STATUS_LABEL.ok;
        return (
          <div
            key={task.id}
            className="rounded-lg border border-white/10 bg-[#0D1525] p-3 space-y-2"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-white font-medium text-sm">{task.name}</p>
                <p className="text-xs text-gray-500">
                  Next due {task.next_due_at ? format(parseISO(task.next_due_at), 'MMM d, yyyy') : '—'}
                </p>
              </div>
              <span className="text-xs font-semibold" style={{ color: st.color }}>{st.text}</span>
            </div>
            {task.how_to_text && (
              <p className="text-sm text-gray-400">{task.how_to_text}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {task.parts_search_url && (
                <a
                  href={task.parts_search_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-400 hover:underline"
                >
                  Find parts
                </a>
              )}
              {task.kind === 'service' && scheduleBase && (
                <Link href={scheduleBase} className="text-xs text-orange-400 hover:underline">
                  Book service
                </Link>
              )}
              {!task.disabled && task.status !== 'disabled' && (
                <>
                  <button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => act(task.id, 'done')}
                    className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-400 border border-green-600/30"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => act(task.id, 'snooze')}
                    className="text-xs px-2 py-1 rounded border border-white/10 text-gray-300"
                  >
                    Snooze 1 mo
                  </button>
                  <button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => act(task.id, 'disable')}
                    className="text-xs px-2 py-1 rounded border border-white/10 text-gray-400"
                  >
                    Turn off
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
