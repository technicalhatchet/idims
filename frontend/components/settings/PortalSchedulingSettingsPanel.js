import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../../utils/api-client';
import { useTechnicians } from '../../hooks/useTechnicians';
import {
  AUTO_ASSIGN_STRATEGIES,
  DEFAULT_PORTAL_SCHEDULING,
  normalizePortalScheduling,
  SCHEDULING_WINDOW_LABELS,
} from '../../utils/portalSchedulingSettings';
import { formatTechnicianLabel } from '../../utils/technicianDisplay';

const inputClass = 'px-2 py-1.5 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none w-full';
const sectionClass = 'rounded-xl p-5';
const sectionStyle = { background: '#111827', border: '1px solid rgba(255,255,255,0.07)' };

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

function NumberField({ label, value, onChange, min, max, step = 1, hint }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-600 mb-1">{hint}</p>}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputClass}
      />
    </div>
  );
}

export default function PortalSchedulingSettingsPanel() {
  const [settings, setSettings] = useState(DEFAULT_PORTAL_SCHEDULING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { data: techniciansData } = useTechnicians({ limit: 100, is_active: true });
  const technicians = techniciansData?.items || techniciansData || [];

  useEffect(() => {
    async function load() {
      try {
        const data = await apiClient('/api/settings/portal-scheduling/config');
        setSettings(normalizePortalScheduling(data));
      } catch (err) {
        console.warn('Portal scheduling config load failed, using defaults', err);
        setSettings(DEFAULT_PORTAL_SCHEDULING);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const patch = (path, value) => {
    setSettings((prev) => {
      const next = { ...prev };
      const keys = path.split('.');
      let cursor = next;
      for (let i = 0; i < keys.length - 1; i += 1) {
        cursor[keys[i]] = { ...cursor[keys[i]] };
        cursor = cursor[keys[i]];
      }
      cursor[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const patchWindow = (name, field, value) => {
    setSettings((prev) => ({
      ...prev,
      scheduling_windows: {
        ...prev.scheduling_windows,
        [name]: {
          ...prev.scheduling_windows[name],
          [field]: value,
        },
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiClient('/api/settings/portal_scheduling', {
        method: 'PATCH',
        body: JSON.stringify({ value: settings }),
      });
      toast.success('Portal scheduling settings saved');
    } catch (err) {
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        try {
          await apiClient('/api/settings/', {
            method: 'POST',
            body: JSON.stringify({
              key: 'portal_scheduling',
              value: settings,
              description: 'Client portal self-scheduling configuration',
            }),
          });
          toast.success('Portal scheduling settings saved');
        } catch (createErr) {
          console.error(createErr);
          toast.error('Failed to save portal settings');
        }
      } else {
        console.error(err);
        toast.error('Failed to save portal settings');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500 text-sm py-8">Loading portal settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Client Portal Scheduling</h2>
          <p className="text-xs text-gray-500 mt-1">
            Self-scheduling windows, priority pricing, auto-assign, and notifications.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
          style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22D3EE', border: '1px solid rgba(34, 211, 238, 0.3)' }}
        >
          {saving ? 'Saving...' : 'Save Portal Settings'}
        </button>
      </div>

      <section className={sectionClass} style={sectionStyle}>
        <h3 className="text-white font-semibold mb-3">General</h3>
        <Toggle
          label="Enable client self-scheduling"
          hint="Global toggle. Per-client blacklist still applies."
          checked={settings.self_scheduling_enabled}
          onChange={(v) => patch('self_scheduling_enabled', v)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/5">
          <NumberField
            label="Min days out"
            hint="1 = tomorrow earliest"
            value={settings.booking.min_days_out}
            min={0}
            max={30}
            onChange={(v) => patch('booking.min_days_out', v)}
          />
          <NumberField
            label="Max days out"
            value={settings.booking.max_days_out}
            min={1}
            max={90}
            onChange={(v) => patch('booking.max_days_out', v)}
          />
          <NumberField
            label="Same-day lead time (min before close)"
            value={settings.same_day_lead_minutes_before_close}
            min={15}
            max={240}
            onChange={(v) => patch('same_day_lead_minutes_before_close', v)}
          />
        </div>
        <div className="mt-4">
          <label className="block text-xs text-gray-400 mb-1">Narrowing batch time (ETA notices)</label>
          <input
            type="time"
            value={settings.narrowing_batch_time}
            onChange={(e) => patch('narrowing_batch_time', e.target.value)}
            className={inputClass}
            style={{ maxWidth: '10rem' }}
          />
        </div>
      </section>

      <section className={sectionClass} style={sectionStyle}>
        <h3 className="text-white font-semibold mb-1">Appointment windows</h3>
        <p className="text-xs text-gray-500 mb-4">
          Customer-facing morning / afternoon / evening windows for portal booking and ETA narrowing.
        </p>
        <div className="space-y-3">
          {Object.entries(SCHEDULING_WINDOW_LABELS).map(([key, label]) => {
            const window = settings.scheduling_windows[key] || {};
            return (
              <div
                key={key}
                className="rounded-lg p-3"
                style={{
                  background: window.enabled ? 'rgba(34, 211, 238, 0.05)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${window.enabled ? 'rgba(34, 211, 238, 0.15)' : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={!!window.enabled}
                    onChange={(e) => patchWindow(key, 'enabled', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500"
                  />
                  <span className="text-sm text-white font-medium">{label}</span>
                </label>
                {window.enabled && (
                  <div className="flex items-center gap-2 pl-6">
                    <input type="time" value={window.start || '08:00'} onChange={(e) => patchWindow(key, 'start', e.target.value)} className={inputClass} style={{ maxWidth: '8rem' }} />
                    <span className="text-gray-500 text-sm">to</span>
                    <input type="time" value={window.end || '12:00'} onChange={(e) => patchWindow(key, 'end', e.target.value)} className={inputClass} style={{ maxWidth: '8rem' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className={sectionClass} style={sectionStyle}>
        <h3 className="text-white font-semibold mb-3">Auto-assign technician</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Strategy</label>
            <select
              value={settings.auto_assign.strategy}
              onChange={(e) => patch('auto_assign.strategy', e.target.value)}
              className={inputClass}
            >
              {AUTO_ASSIGN_STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Fallback technician (solo shop)</label>
            <select
              value={settings.auto_assign.fallback_technician_id || ''}
              onChange={(e) => patch('auto_assign.fallback_technician_id', e.target.value || null)}
              className={inputClass}
            >
              <option value="">None</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {formatTechnicianLabel(t)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className={sectionClass} style={sectionStyle}>
        <Toggle
          label="Enable priority / emergency service tier"
          hint="After same-day cutoff until midnight — higher rates, approval required."
          checked={settings.priority_service.enabled}
          onChange={(v) => patch('priority_service.enabled', v)}
        />
        {settings.priority_service.enabled && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/5">
            <NumberField label="Priority diag ×" value={settings.priority_service.priority_diagnostic_multiplier} min={1} max={5} step={0.1} onChange={(v) => patch('priority_service.priority_diagnostic_multiplier', v)} />
            <NumberField label="Priority trip ×" value={settings.priority_service.priority_trip_multiplier} min={1} max={5} step={0.1} onChange={(v) => patch('priority_service.priority_trip_multiplier', v)} />
            <NumberField label="Priority flat fee $" value={settings.priority_service.priority_flat_fee} min={0} onChange={(v) => patch('priority_service.priority_flat_fee', v)} />
            <NumberField label="Emergency diag ×" value={settings.priority_service.emergency_diagnostic_multiplier} min={1} max={5} step={0.1} onChange={(v) => patch('priority_service.emergency_diagnostic_multiplier', v)} />
            <NumberField label="Emergency trip ×" value={settings.priority_service.emergency_trip_multiplier} min={1} max={5} step={0.1} onChange={(v) => patch('priority_service.emergency_trip_multiplier', v)} />
            <NumberField label="Emergency flat fee $" value={settings.priority_service.emergency_flat_fee} min={0} onChange={(v) => patch('priority_service.emergency_flat_fee', v)} />
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-gray-400 mb-1">Priority requests until</label>
              <input type="time" value={settings.priority_service.request_cutoff_time} onChange={(e) => patch('priority_service.request_cutoff_time', e.target.value)} className={inputClass} />
            </div>
          </div>
        )}
      </section>

      <section className={sectionClass} style={sectionStyle}>
        <h3 className="text-white font-semibold mb-3">Notifications</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <Toggle label="Narrowing SMS" checked={settings.comms.narrowing_sms} onChange={(v) => patch('comms.narrowing_sms', v)} />
          <Toggle label="Narrowing email" checked={settings.comms.narrowing_email} onChange={(v) => patch('comms.narrowing_email', v)} />
          <Toggle label="Same-day approval SMS" checked={settings.comms.same_day_approval_sms} onChange={(v) => patch('comms.same_day_approval_sms', v)} />
          <Toggle label="Same-day approval email" checked={settings.comms.same_day_approval_email} onChange={(v) => patch('comms.same_day_approval_email', v)} />
          <Toggle label="Denial SMS" checked={settings.comms.denial_sms} onChange={(v) => patch('comms.denial_sms', v)} />
          <Toggle label="Denial email" checked={settings.comms.denial_email} onChange={(v) => patch('comms.denial_email', v)} />
        </div>
      </section>

      <section className={sectionClass} style={sectionStyle}>
        <h3 className="text-white font-semibold mb-1">Payment (Square)</h3>
        <p className="text-xs text-gray-500 mb-4">Stub for future card-on-file at booking. Leave off until Square is wired.</p>
        <Toggle
          label="Require payment to self-schedule"
          checked={settings.payment.requires_payment}
          onChange={(v) => patch('payment.requires_payment', v)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Square application ID</label>
            <input value={settings.payment.square_application_id} onChange={(e) => patch('payment.square_application_id', e.target.value)} className={inputClass} placeholder="sandbox-sq0idb-..." />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Square location ID</label>
            <input value={settings.payment.square_location_id} onChange={(e) => patch('payment.square_location_id', e.target.value)} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-400 mb-1">Square access token (server only)</label>
            <input
              type="password"
              autoComplete="off"
              value={settings.payment.square_access_token || ''}
              onChange={(e) => patch('payment.square_access_token', e.target.value)}
              className={inputClass}
              placeholder="EAAA... (never shown to clients)"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Environment</label>
            <select value={settings.payment.square_environment} onChange={(e) => patch('payment.square_environment', e.target.value)} className={inputClass}>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
