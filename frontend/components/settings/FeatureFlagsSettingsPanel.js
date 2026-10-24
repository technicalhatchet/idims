import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../../utils/api-client';
import { upsertAppSetting } from '../../utils/upsertAppSetting';
import { ALL_FEATURE_FLAG_IDS } from '../../context/FeatureFlagsContext';
import { useFeatureFlags } from '../../context/FeatureFlagsContext';

function defaultFlagsFromConfig(config) {
  const flags = config?.flags || {};
  const out = {};
  for (const id of ALL_FEATURE_FLAG_IDS) {
    const row = flags[id] || {};
    out[id] = {
      enabled: row.enabled !== false,
      admin_only: Boolean(row.admin_only),
      description: row.description || '',
    };
  }
  return out;
}

export default function FeatureFlagsSettingsPanel() {
  const { refresh: refreshClientFeatures } = useFeatureFlags();
  const [flags, setFlags] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient('/api/features/config');
        setFlags(defaultFlagsFromConfig(data));
      } catch {
        const fallback = {};
        for (const id of ALL_FEATURE_FLAG_IDS) {
          fallback[id] = { enabled: true, admin_only: false, description: '' };
        }
        setFlags(fallback);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const value = {};
      for (const id of ALL_FEATURE_FLAG_IDS) {
        const row = flags[id] || {};
        value[id] = {
          enabled: Boolean(row.enabled),
          admin_only: Boolean(row.admin_only),
        };
      }
      await upsertAppSetting({
        key: 'feature_flags',
        value,
        description: 'Wave 1 portal feature toggles',
      });
      await refreshClientFeatures();
      toast.success('Feature flags saved');
    } catch {
      toast.error('Failed to save feature flags');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading feature flags…</p>;
  }

  return (
    <div
      className="mt-8 space-y-4"
      style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem' }}
    >
      <h3 className="text-white font-semibold">Portal features</h3>
      <p className="text-gray-500 text-xs m-0">
        Turn Wave 1 customer-facing capabilities on or off. Admins-only hides a flag from customers
        while staff can still use it when signed in.
      </p>
      <ul className="space-y-4 m-0 p-0 list-none">
        {ALL_FEATURE_FLAG_IDS.map((id) => {
          const row = flags[id] || { enabled: true, admin_only: false, description: '' };
          return (
            <li
              key={id}
              className="rounded-lg border border-gray-700/80 bg-gray-900/40 p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-mono text-cyan-300/90">{id}</span>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={Boolean(row.enabled)}
                    onChange={(e) =>
                      setFlags((prev) => ({
                        ...prev,
                        [id]: { ...row, enabled: e.target.checked },
                      }))
                    }
                  />
                  Enabled
                </label>
              </div>
              {row.description ? (
                <p className="text-xs text-gray-500 m-0">{row.description}</p>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={Boolean(row.admin_only)}
                  disabled={!row.enabled}
                  onChange={(e) =>
                    setFlags((prev) => ({
                      ...prev,
                      [id]: { ...row, admin_only: e.target.checked },
                    }))
                  }
                />
                Admins only (hide from customers)
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save feature flags'}
      </button>
    </div>
  );
}
