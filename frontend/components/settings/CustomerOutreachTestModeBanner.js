import { useEffect, useState } from 'react';
import { apiClient } from '../../utils/api-client';

export default function CustomerOutreachTestModeBanner() {
  const [enabled, setEnabled] = useState(null);

  const load = async () => {
    try {
      const data = await apiClient('/api/settings');
      const raw = data?.settings?.customer_outreach_test_mode;
      const on =
        raw === true ||
        raw?.enabled === true ||
        (raw === undefined || raw === null);
      setEnabled(Boolean(on));
    } catch {
      setEnabled(true);
    }
  };

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener('customer-outreach-settings-changed', onChange);
    return () => window.removeEventListener('customer-outreach-settings-changed', onChange);
  }, []);

  if (enabled !== true) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      role="status"
    >
      <p className="font-semibold m-0">Customer outreach test mode is ON</p>
      <p className="text-amber-200/80 text-xs mt-1 m-0">
        Automatic emails, SMS, and portal notifications only go to clients marked{' '}
        <strong>Test client</strong>. Manual staff sends (invoice email, portal invite) are not
        blocked.
      </p>
    </div>
  );
}
