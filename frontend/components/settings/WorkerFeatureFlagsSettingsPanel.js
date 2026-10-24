import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../../utils/api-client';
import { upsertAppSetting } from '../../utils/upsertAppSetting';

const WORKER_FLAGS = [
  { id: 'deploy_reminders', label: 'Deploy reminders (staff push)' },
  { id: 'morning_summaries', label: 'Morning schedule summaries (staff push)' },
  { id: 'appointment_reminders', label: 'Appointment reminder emails (~24h)' },
  { id: 'portal_narrowing_batch', label: 'Portal ETA narrowing batch' },
  { id: 'portal_scheduling_deadlines', label: 'Scheduling deadline auto-denials' },
  { id: 'delayed_review_requests', label: 'Delayed review requests after payment' },
];

export default function WorkerFeatureFlagsSettingsPanel() {
  const [flags, setFlags] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient('/api/settings');
        const raw = data?.settings?.worker_feature_flags || {};
        const next = {};
        for (const { id } of WORKER_FLAGS) {
          next[id] = Boolean(raw?.[id]?.enabled);
        }
        setFlags(next);
      } catch {
        const next = {};
        for (const { id } of WORKER_FLAGS) {
          next[id] = false;
        }
        setFlags(next);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const value = {};
      for (const { id } of WORKER_FLAGS) {
        value[id] = { enabled: Boolean(flags[id]) };
      }
      await upsertAppSetting({
        key: 'worker_feature_flags',
        value,
        description: 'Celery worker job toggles (default off)',
      });
      toast.success('Worker flags saved');
    } catch {
      toast.error('Failed to save worker flags');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading worker flags…</p>;
  }

  return (
    <div
      className="space-y-3"
      style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem' }}
    >
      <h3 className="text-white font-semibold">Background worker jobs</h3>
      <p className="text-gray-500 text-xs m-0">
        All default off on Railway until you enable them here. Beat still runs; each task exits
        quietly when its flag is off.
      </p>
      <ul className="space-y-2 m-0 p-0 list-none">
        {WORKER_FLAGS.map(({ id, label }) => (
          <li key={id}>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={Boolean(flags[id])}
                onChange={(e) =>
                  setFlags((prev) => ({ ...prev, [id]: e.target.checked }))
                }
              />
              <span className="font-mono text-xs text-cyan-300/80">{id}</span>
              <span className="text-gray-400">— {label}</span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50"
        style={{
          background: 'rgba(34, 211, 238, 0.15)',
          color: '#22D3EE',
          border: '1px solid rgba(34, 211, 238, 0.3)',
        }}
      >
        {saving ? 'Saving…' : 'Save worker flags'}
      </button>
    </div>
  );
}
