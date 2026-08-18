import { useEffect, useState } from 'react';
import Head from 'next/head';
import { FaPhone, FaEnvelope } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import SupportCTA from '../../components/cxdashboard/SupportCTA';
import { getPortalSessionToken, portalFetch } from '../../utils/portalFetch';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#0D1525] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    mobile: '',
    email: '',
    company_name: '',
  });

  useEffect(() => {
    async function load() {
      try {
        const token = await getPortalSessionToken();
        const me = await portalFetch('me', token);
        setForm({
          first_name: me.first_name || '',
          last_name: me.last_name || '',
          phone: me.phone || '',
          mobile: me.mobile || '',
          email: me.email || '',
          company_name: me.company_name || '',
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function setField(key, value) {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const token = await getPortalSessionToken();
      const updated = await portalFetch('me', token, {
        method: 'PUT',
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          mobile: form.mobile,
        }),
      });
      setForm((prev) => ({
        ...prev,
        first_name: updated.first_name || '',
        last_name: updated.last_name || '',
        phone: updated.phone || '',
        mobile: updated.mobile || '',
        email: updated.email || prev.email,
        company_name: updated.company_name || prev.company_name,
      }));
      const name = `${updated.first_name || ''} ${updated.last_name || ''}`.trim();
      if (name) sessionStorage.setItem('portal_client_name', name);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head><title>Account Settings | Atomic Repair</title></Head>
      <div className="space-y-5 md:space-y-6 max-w-xl">
        <div>
          <h1 className="text-white text-2xl font-bold m-0">Account Settings</h1>
          <p className="text-white/45 text-sm mt-1 mb-0">
            Update the name and phone numbers we use for your service visits.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-white/45">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading your profile...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-xl border border-white/[0.07] bg-[#0D1525] p-4 sm:p-5 space-y-4">
            {form.company_name ? (
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-white/45 mb-1.5">Company</label>
                <p className="text-white text-sm m-0">{form.company_name}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="portal-first-name" className="block text-[11px] uppercase tracking-wide text-white/45 mb-1.5">
                  First name
                </label>
                <input
                  id="portal-first-name"
                  className={inputClass}
                  value={form.first_name}
                  onChange={(e) => setField('first_name', e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label htmlFor="portal-last-name" className="block text-[11px] uppercase tracking-wide text-white/45 mb-1.5">
                  Last name
                </label>
                <input
                  id="portal-last-name"
                  className={inputClass}
                  value={form.last_name}
                  onChange={(e) => setField('last_name', e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="portal-phone" className="block text-[11px] uppercase tracking-wide text-white/45 mb-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <FaPhone className="w-3 h-3" /> Phone
                </span>
              </label>
              <input
                id="portal-phone"
                type="tel"
                className={inputClass}
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                autoComplete="tel"
              />
            </div>

            <div>
              <label htmlFor="portal-mobile" className="block text-[11px] uppercase tracking-wide text-white/45 mb-1.5">
                Mobile
              </label>
              <input
                id="portal-mobile"
                type="tel"
                className={inputClass}
                value={form.mobile}
                onChange={(e) => setField('mobile', e.target.value)}
                autoComplete="tel"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wide text-white/45 mb-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <FaEnvelope className="w-3 h-3" /> Email (login)
                </span>
              </label>
              <input className={`${inputClass} opacity-70`} value={form.email} disabled readOnly />
              <p className="text-white/35 text-xs mt-1.5 mb-0">
                Email is tied to your login. Call (419) 794-1689 if you need it changed.
              </p>
            </div>

            {error && <p className="text-red-400 text-sm m-0">{error}</p>}
            {saved && <p className="text-emerald-400 text-sm m-0">Saved. We’ll use this on your next visit.</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-cyan-500 text-[#0a0f1a] font-bold text-sm hover:bg-cyan-400 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        )}

        <SupportCTA />
      </div>
    </>
  );
}

SettingsPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="Account Settings">{page}</DashboardLayout>;
};
