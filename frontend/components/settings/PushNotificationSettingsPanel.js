import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../../utils/api-client';
import {
  DEFAULT_PUSH_NOTIFICATIONS,
  MORNING_BRIEFING_HOURS,
  MORNING_BRIEFING_MINUTES,
  normalizePushNotifications,
  PUSH_NOTIFICATION_LABELS,
} from '../../utils/pushNotificationSettings';

const sectionStyle = { background: '#111827', border: '1px solid rgba(255,255,255,0.07)' };
const inputClass = 'px-2 py-1.5 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none';

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start justify-between gap-4 py-2 cursor-pointer">
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 mt-1 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500"
      />
    </label>
  );
}

function RecipientToggles({ recipients, onChange }) {
  return (
    <div className="flex flex-wrap gap-4 mt-2">
      {[
        ['admin', 'Admin'],
        ['manager', 'Manager'],
        ['technician', 'Technician'],
      ].map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={!!recipients?.[key]}
            onChange={(e) => onChange({ ...recipients, [key]: e.target.checked })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500"
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function RuleCard({ ruleKey, rule, onPatch }) {
  const meta = PUSH_NOTIFICATION_LABELS[ruleKey];
  const isMorning = ruleKey === 'morning_briefing';

  return (
    <div className="rounded-xl p-5" style={sectionStyle}>
      <Toggle
        checked={!!rule.enabled}
        onChange={(v) => onPatch(ruleKey, 'enabled', v)}
        label={meta.title}
        hint={meta.description}
      />

      {rule.enabled && (
        <div className="mt-3 pt-3 border-t border-gray-700/80 space-y-3">
          {isMorning && (
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Send at (shop time)</label>
                <select
                  value={rule.hour ?? 7}
                  onChange={(e) => onPatch(ruleKey, 'hour', Number(e.target.value))}
                  className={inputClass}
                >
                  {MORNING_BRIEFING_HOURS.map((h) => (
                    <option key={h} value={h}>{h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">:minutes</label>
                <select
                  value={rule.minute ?? 0}
                  onChange={(e) => onPatch(ruleKey, 'minute', Number(e.target.value))}
                  className={inputClass}
                >
                  {MORNING_BRIEFING_MINUTES.map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-1">Who receives this</p>
            <RecipientToggles
              recipients={rule.recipients}
              onChange={(recipients) => onPatch(ruleKey, 'recipients', recipients)}
            />
          </div>

          {isMorning && (
            <Toggle
              checked={rule.technicians_see_own_jobs_only !== false}
              onChange={(v) => onPatch(ruleKey, 'technicians_see_own_jobs_only', v)}
              label="Technicians see only their jobs"
              hint="Admins/managers always see the full shop schedule count."
            />
          )}

          {!isMorning && ruleKey === 'portal_self_schedule' && (
            <Toggle
              checked={!!rule.include_assigned_technician}
              onChange={(v) => onPatch(ruleKey, 'include_assigned_technician', v)}
              label="Always include assigned technician"
              hint="Even if Technician is unchecked above."
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function PushNotificationSettingsPanel() {
  const [settings, setSettings] = useState(DEFAULT_PUSH_NOTIFICATIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiClient('/api/settings/push-notifications/config');
        setSettings(normalizePushNotifications(data));
      } catch (err) {
        console.warn('Push notification settings load failed, using defaults', err);
        setSettings(DEFAULT_PUSH_NOTIFICATIONS);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const onPatch = (ruleKey, field, value) => {
    setSettings((prev) => ({
      ...prev,
      [ruleKey]: {
        ...prev[ruleKey],
        [field]: value,
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiClient('/api/settings/push_notifications', {
        method: 'PATCH',
        body: JSON.stringify({ value: settings }),
      });
      toast.success('Push notification settings saved');
    } catch (err) {
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        try {
          await apiClient('/api/settings/', {
            method: 'POST',
            body: JSON.stringify({
              key: 'push_notifications',
              value: settings,
              description: 'Staff web push notification rules',
            }),
          });
          toast.success('Push notification settings saved');
        } catch (createErr) {
          console.error(createErr);
          toast.error('Failed to save push settings');
        }
      } else {
        console.error(err);
        toast.error('Failed to save push settings');
      }
    } finally {
      setSaving(false);
    }
  };

  const testBriefing = async () => {
    try {
      await apiClient('/api/push/test-morning-briefing', { method: 'POST' });
      toast.success('Test morning briefing sent');
    } catch (err) {
      toast.error(err.message || 'Test push failed');
    }
  };

  if (loading) {
    return <div className="text-gray-500 text-sm py-8">Loading notification settings...</div>;
  }

  const ruleKeys = Object.keys(PUSH_NOTIFICATION_LABELS);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-xl p-5" style={sectionStyle}>
        <h3 className="text-white font-semibold mb-1">Staff push notifications</h3>
        <p className="text-sm text-gray-500">
          Control which alerts fire and who receives them. Users must allow browser notifications
          on a staff device (dashboard or techboard) once.
        </p>
      </div>

      {ruleKeys.map((key) => (
        <RuleCard key={key} ruleKey={key} rule={settings[key]} onPatch={onPatch} />
      ))}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-cyan-500 text-gray-900 font-semibold text-sm disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save notification settings'}
        </button>
        <button
          type="button"
          onClick={testBriefing}
          className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:border-cyan-500/50"
        >
          Send test morning briefing
        </button>
      </div>
    </div>
  );
}
