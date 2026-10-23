import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../../utils/api-client';
import { upsertAppSetting } from '../../utils/upsertAppSetting';
import { useFeature } from '../../context/FeatureFlagsContext';

const DEFAULTS = {
  enabled: false,
  google_review_url: '',
  delay_hours: 2,
};

export default function PortalReviewsSettingsPanel() {
  const reviewRequestsFeatureOn = useFeature('review_requests');
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient('/api/settings/portal-reviews/config');
        setSettings({ ...DEFAULTS, ...data });
      } catch {
        setSettings(DEFAULTS);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await upsertAppSetting({
        key: 'portal_reviews',
        value: settings,
        description: 'Portal Google review requests',
      });
      toast.success('Review request settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500 text-sm">Loading review settings…</p>;

  return (
    <div className="mt-8 space-y-4" style={ { borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem' } }>
      <h3 className="text-white font-semibold">Google review requests</h3>
      {!reviewRequestsFeatureOn ? (
        <p className="text-amber-200/80 text-sm m-0">Review requests are turned off.</p>
      ) : null}
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={!!settings.enabled}
          onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
        />
        Send review requests after invoices are paid
      </label>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Google review URL</label>
        <input
          className="w-full px-2 py-1.5 text-sm rounded border border-gray-600 bg-gray-800 text-white"
          value={settings.google_review_url}
          onChange={(e) => setSettings((s) => ({ ...s, google_review_url: e.target.value }))}
          placeholder="https://g.page/..."
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Delay (hours)</label>
        <input
          type="number"
          min={0}
          className="w-24 px-2 py-1.5 text-sm rounded border border-gray-600 bg-gray-800 text-white"
          value={settings.delay_hours}
          onChange={(e) => setSettings((s) => ({ ...s, delay_hours: Number(e.target.value) }))}
        />
        <p className="text-xs text-gray-600 mt-1">Used once background jobs are enabled. Requests send immediately after payment today.</p>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save review settings'}
      </button>
    </div>
  );
}
