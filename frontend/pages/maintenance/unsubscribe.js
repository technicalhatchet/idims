import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function MaintenanceUnsubscribePage() {
  const router = useRouter();
  const token = router.query.token;
  const [state, setState] = useState({ loading: true, valid: false, already: false, done: false, error: null });

  useEffect(() => {
    if (!token) return;
    const run = async () => {
      try {
        const res = await fetch(`/api/public/maintenance-email/unsubscribe?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || 'Invalid link');
        setState({ loading: false, valid: true, already: Boolean(data.already_opted_out), done: false, error: null });
      } catch (e) {
        setState({ loading: false, valid: false, already: false, done: false, error: e.message || 'Invalid link' });
      }
    };
    run();
  }, [token]);

  const confirm = async () => {
    try {
      const res = await fetch(
        `/api/public/maintenance-email/unsubscribe?token=${encodeURIComponent(token)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Could not unsubscribe');
      setState((s) => ({ ...s, done: true, already: true }));
    } catch (e) {
      setState((s) => ({ ...s, error: e.message || 'Could not unsubscribe' }));
    }
  };

  return (
    <>
      <Head>
        <title>Unsubscribe — Maintenance reminders</title>
      </Head>
      <main className="min-h-screen bg-[#0a0f1a] text-gray-200 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-white/10 bg-[#111827] p-6 space-y-4 text-center">
          <h1 className="text-lg font-semibold text-white">Maintenance email reminders</h1>
          {state.loading && <p className="text-sm text-gray-400">Checking your link…</p>}
          {state.error && <p className="text-sm text-red-400">{state.error}</p>}
          {!state.loading && state.valid && !state.done && !state.already && (
            <>
              <p className="text-sm text-gray-400">
                Stop receiving maintenance reminder emails from Atomic Repair. You can still manage tasks in the customer portal.
              </p>
              <button
                type="button"
                onClick={confirm}
                className="w-full py-2 rounded-lg bg-orange-600 text-white font-medium text-sm"
              >
                Confirm unsubscribe
              </button>
            </>
          )}
          {(state.done || state.already) && state.valid && (
            <p className="text-sm text-green-400">You are unsubscribed from maintenance reminder emails.</p>
          )}
        </div>
      </main>
    </>
  );
}
