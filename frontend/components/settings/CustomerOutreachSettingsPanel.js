import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../../utils/api-client';
import { upsertAppSetting } from '../../utils/upsertAppSetting';

export default function CustomerOutreachSettingsPanel() {
  const [testMode, setTestMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient('/api/settings');
        const raw = data?.settings?.customer_outreach_test_mode;
        const on =
          raw === true ||
          raw?.enabled === true ||
          (raw === undefined || raw === null);
        setTestMode(Boolean(on));
      } catch {
        setTestMode(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await upsertAppSetting({
        key: 'customer_outreach_test_mode',
        value: { enabled: testMode },
        description: 'Restrict automatic customer outreach to test clients',
      });
      toast.success('Customer outreach settings saved');
      window.dispatchEvent(new Event('customer-outreach-settings-changed'));
    } catch {
      toast.error('Failed to save customer outreach settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading outreach safety…</p>;
  }

  return (
    <div
      className="space-y-3"
      style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem' }}
    >
      <h3 className="text-white font-semibold">Customer outreach safety</h3>
      <p className="text-gray-500 text-xs m-0">
        When test mode is on, worker-driven customer contact only reaches clients with{' '}
        <strong className="text-gray-400">Test client</strong> checked on their profile.
      </p>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={testMode}
          onChange={(e) => setTestMode(e.target.checked)}
        />
        Customer outreach test mode (recommended until launch)
      </label>
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
        {saving ? 'Saving…' : 'Save outreach safety'}
      </button>
    </div>
  );
}
