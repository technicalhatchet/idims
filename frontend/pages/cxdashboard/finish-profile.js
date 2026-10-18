import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import {
  fetchPortalSignupStatus,
  postPortalCompleteSignup,
  redirectToRefreshPortalToken,
  shouldRefreshPortalToken,
} from '../../utils/portalLink';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#0D1525] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50';

const SMS_CONSENT_LABEL =
  'Text me appointment updates and account links from Atomic Repair. Msg & data rates may apply. Reply STOP to opt out.';

export default function FinishProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    mobile: '',
    email: '',
    sms_consent: false,
  });

  useEffect(() => {
    async function load() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        if (!sessionRes.ok) {
          router.replace('/cxdashboard/login');
          return;
        }
        const session = await sessionRes.json();
        const token = session.accessToken;
        const status = await fetchPortalSignupStatus(token);
        if (status.status === 'ready' && status.has_client_role) {
          router.replace('/cxdashboard');
          return;
        }
        if (status.status === 'unlinked') {
          router.replace('/cxdashboard');
          return;
        }
        setForm((prev) => ({
          ...prev,
          first_name: status.first_name && status.first_name !== 'New' ? status.first_name : '',
          last_name: status.last_name && status.last_name !== 'Customer' ? status.last_name : '',
          mobile: status.mobile || '',
          email: status.email || '',
          sms_consent: Boolean(status.sms_consent),
        }));
      } catch (err) {
        setError(err.message || 'Could not load your account.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const sessionRes = await fetch('/api/auth/session');
      const session = await sessionRes.json();
      const token = session.accessToken;
      const result = await postPortalCompleteSignup(token, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        mobile: form.mobile.trim(),
        sms_consent: form.sms_consent,
      });
      if (!result.ok) {
        throw new Error(result.data?.detail || `Save failed (${result.status})`);
      }
      if (shouldRefreshPortalToken(result, false)) {
        redirectToRefreshPortalToken();
        return;
      }
      router.replace('/cxdashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head><title>Finish your profile | Atomic Repair</title></Head>
      <div className="max-w-xl mx-auto space-y-5 md:space-y-6">
        <div>
          <h1 className="text-white text-2xl font-bold m-0">Finish setting up your account</h1>
          <p className="text-white/45 text-sm mt-1 mb-0">
            Tell us how to reach you for service visits. You can add a service address next from your dashboard.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-white/45">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading...
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-white/[0.07] bg-[#0D1525] p-4 sm:p-5 space-y-4"
          >
            {form.email ? (
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-white/45 mb-1.5">Email</label>
                <p className="text-white text-sm m-0">{form.email}</p>
                <p className="text-white/35 text-xs mt-1 m-0">Sign-in email (managed by Auth0)</p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-white/45 mb-1.5">
                  First name
                </label>
                <input
                  className={inputClass}
                  value={form.first_name}
                  onChange={(e) => setField('first_name', e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-white/45 mb-1.5">
                  Last name
                </label>
                <input
                  className={inputClass}
                  value={form.last_name}
                  onChange={(e) => setField('last_name', e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wide text-white/45 mb-1.5">
                Mobile phone
              </label>
              <input
                className={inputClass}
                type="tel"
                value={form.mobile}
                onChange={(e) => setField('mobile', e.target.value)}
                required
                autoComplete="tel"
                placeholder="4195551212"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.sms_consent}
                onChange={(e) => setField('sms_consent', e.target.checked)}
              />
              <span className="text-white/70 text-sm">{SMS_CONSENT_LABEL}</span>
            </label>

            {error ? (
              <p className="text-red-400 text-sm m-0" role="alert">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#0A0F1E] font-semibold py-2.5 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Continue to portal'}
            </button>
          </form>
        )}
      </div>
    </>
  );
}

FinishProfilePage.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};
