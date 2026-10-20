import { useEffect, useState } from 'react';
import Head from 'next/head';
import { FaPhone, FaEnvelope } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import SupportCTA from '../../components/cxdashboard/SupportCTA';
import { getPortalSessionToken, portalFetch } from '../../utils/portalFetch';
import {
  isPortalAdminPreview,
  isPortalPreviewActive,
  isPortalPreviewUnlocked,
} from '../../utils/portalPreview';
import { MARKETING_PHONE_DISPLAY } from '../../constants/marketingSiteContent';
import { portalSignOut } from '../../components/cxdashboard/portalAuth';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#0D1525] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50';

const SMS_CONSENT_LABEL =
  'Text me appointment updates and account links from Atomic Repair. Msg & data rates may apply. Reply STOP to opt out.';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [householdMembers, setHouseholdMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [activeLoginCount, setActiveLoginCount] = useState(0);
  const [inviteForm, setInviteForm] = useState({ display_name: '', email: '' });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveConfirmLast, setLeaveConfirmLast] = useState(false);
  const previewMode = isPortalAdminPreview();
  const previewLocked = isPortalPreviewActive() && !isPortalPreviewUnlocked();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    mobile: '',
    email: '',
    company_name: '',
    sms_consent: false,
  });

  useEffect(() => {
    async function load() {
      try {
        const token = await getPortalSessionToken();
        const me = await portalFetch('me', token);
        try {
          const members = await portalFetch('account/members', token);
          setHouseholdMembers(Array.isArray(members?.members) ? members.members : []);
        } catch {
          setHouseholdMembers([]);
        }
        try {
          const access = await portalFetch('account/invites', token);
          setPendingInvites(Array.isArray(access?.pending_invites) ? access.pending_invites : []);
          setActiveLoginCount(Number(access?.active_login_count) || 0);
        } catch {
          setPendingInvites([]);
          setActiveLoginCount(0);
        }
        setForm({
          first_name: me.first_name || '',
          last_name: me.last_name || '',
          phone: me.phone || '',
          mobile: me.mobile || '',
          email: me.email || '',
          company_name: me.company_name || '',
          sms_consent: Boolean(me.sms_consent),
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

  async function refreshAccess(token) {
    const members = await portalFetch('account/members', token);
    setHouseholdMembers(Array.isArray(members?.members) ? members.members : []);
    const access = await portalFetch('account/invites', token);
    setPendingInvites(Array.isArray(access?.pending_invites) ? access.pending_invites : []);
    setActiveLoginCount(Number(access?.active_login_count) || 0);
  }

  async function handleInviteSubmit(e) {
    e.preventDefault();
    if (previewLocked) return;
    setInviteBusy(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const token = await getPortalSessionToken();
      await portalFetch('account/invites', token, {
        method: 'POST',
        body: JSON.stringify({
          display_name: inviteForm.display_name.trim(),
          email: inviteForm.email.trim(),
        }),
      });
      setInviteForm({ display_name: '', email: '' });
      setInviteSuccess('Invite sent. They can create their login from the email link.');
      await refreshAccess(token);
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviteBusy(false);
    }
  }

  async function resendInvite(claimId) {
    if (previewLocked) return;
    setInviteError(null);
    try {
      const token = await getPortalSessionToken();
      await portalFetch(`account/invites/${claimId}/resend`, token, { method: 'POST' });
      setInviteSuccess('Invite email sent again.');
      await refreshAccess(token);
    } catch (err) {
      setInviteError(err.message);
    }
  }

  async function cancelInvite(claimId) {
    if (previewLocked) return;
    setInviteError(null);
    try {
      const token = await getPortalSessionToken();
      await portalFetch(`account/invites/${claimId}/cancel`, token, { method: 'POST' });
      await refreshAccess(token);
    } catch (err) {
      setInviteError(err.message);
    }
  }

  async function handleLeaveAccount() {
    if (previewMode) return;
    setLeaveBusy(true);
    setLeaveError(null);
    try {
      const token = await getPortalSessionToken();
      await portalFetch('account/leave', token, {
        method: 'POST',
        body: JSON.stringify({ confirm_last_member: leaveConfirmLast }),
      });
      portalSignOut();
    } catch (err) {
      setLeaveError(err.message);
      setLeaveBusy(false);
    }
  }

  function formatExpires(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (previewMode) return;
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
          sms_consent: form.sms_consent,
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
        sms_consent: Boolean(updated.sms_consent),
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
            <div className="rounded-lg border border-white/10 bg-[#0a101c] p-3 space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/45 mb-2 m-0">
                  People with access to this account
                </p>
                {householdMembers.length > 0 ? (
                  <ul className="text-sm text-white/80 list-disc pl-5 m-0 space-y-1">
                    {householdMembers.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-white/50 m-0">Only you have access right now.</p>
                )}
              </div>

              {pendingInvites.length > 0 ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-white/45 mb-2 m-0">
                    Pending invites
                  </p>
                  <ul className="m-0 p-0 list-none space-y-2">
                    {pendingInvites.map((inv) => (
                      <li
                        key={inv.id}
                        className="text-sm text-white/75 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-white/5 rounded-md px-2 py-2"
                      >
                        <span>
                          <span className="text-white/90">{inv.display_name || 'Invite'}</span>
                          {inv.invited_email ? (
                            <span className="text-white/45"> · {inv.invited_email}</span>
                          ) : null}
                          {inv.expires_at ? (
                            <span className="block text-xs text-white/35 mt-0.5">
                              Expires {formatExpires(inv.expires_at)}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={previewLocked}
                            onClick={() => resendInvite(inv.id)}
                            className="text-xs px-2 py-1 rounded border border-white/15 text-cyan-400 hover:bg-white/5 disabled:opacity-50"
                          >
                            Resend
                          </button>
                          <button
                            type="button"
                            disabled={previewLocked}
                            onClick={() => cancelInvite(inv.id)}
                            className="text-xs px-2 py-1 rounded border border-white/15 text-white/60 hover:bg-white/5 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <form onSubmit={handleInviteSubmit} className="space-y-2 border-t border-white/5 pt-3">
                <p className="text-[11px] uppercase tracking-wide text-white/45 m-0">Invite someone</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    className={inputClass}
                    placeholder="Their name"
                    value={inviteForm.display_name}
                    onChange={(e) => setInviteForm((p) => ({ ...p, display_name: e.target.value }))}
                    required
                    disabled={previewLocked}
                  />
                  <input
                    type="email"
                    className={inputClass}
                    placeholder="Their email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                    required
                    disabled={previewLocked}
                    autoComplete="email"
                  />
                </div>
                {inviteError ? <p className="text-red-400 text-xs m-0">{inviteError}</p> : null}
                {inviteSuccess ? <p className="text-emerald-400 text-xs m-0">{inviteSuccess}</p> : null}
                <button
                  type="submit"
                  disabled={inviteBusy || previewLocked}
                  className="text-sm px-3 py-2 rounded-lg border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50"
                >
                  {previewLocked ? 'Unlock preview to send invites' : (inviteBusy ? 'Sending…' : 'Send invite')}
                </button>
              </form>
            </div>
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
              <label htmlFor="portal-mobile" className="block text-[11px] uppercase tracking-wide text-white/45 mb-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <FaPhone className="w-3 h-3" /> Cell (texts)
                </span>
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
              <label htmlFor="portal-phone" className="block text-[11px] uppercase tracking-wide text-white/45 mb-1.5">
                Other phone
              </label>
              <input
                id="portal-phone"
                type="tel"
                className={inputClass}
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                autoComplete="tel-national"
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
                Email is tied to your login. Call {MARKETING_PHONE_DISPLAY} if you need it changed.
              </p>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.sms_consent}
                onChange={(e) => setField('sms_consent', e.target.checked)}
                disabled={previewMode}
                className="mt-0.5 w-4 h-4 rounded border-white/20 bg-[#0D1525] text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-xs text-white/55 leading-relaxed">{SMS_CONSENT_LABEL}</span>
            </label>

            {error && <p className="text-red-400 text-sm m-0">{error}</p>}
            {saved && <p className="text-emerald-400 text-sm m-0">Saved. We’ll use this on your next visit.</p>}

            <button
              type="submit"
              disabled={saving || previewMode}
              title={previewMode ? 'Disabled in admin preview' : undefined}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-cyan-500 text-[#0a0f1a] font-bold text-sm hover:bg-cyan-400 disabled:opacity-60 transition-colors"
            >
              {previewMode ? 'Save disabled in preview' : (saving ? 'Saving…' : 'Save changes')}
            </button>
          </form>
        )}

        {!loading && !isPortalPreviewActive() ? (
          <div className="rounded-xl border border-white/[0.07] bg-[#0D1525] p-4 sm:p-5 space-y-3 max-w-xl">
            <div>
              <h2 className="text-white text-base font-semibold m-0">Leave this account</h2>
              <p className="text-white/45 text-sm mt-1 mb-0">
                Remove your portal login from this household. You will not be able to see invoices or
                appointments here unless you are invited again. To remove someone else, contact Atomic Repair.
              </p>
            </div>
            {activeLoginCount <= 1 && showLeaveConfirm ? (
              <p className="text-amber-400/90 text-sm m-0 border border-amber-500/30 rounded-lg p-3 bg-amber-500/5">
                You are the only person with portal access. Leaving removes online access for this
                account until our team sends a new invite.
              </p>
            ) : null}
            {leaveError ? <p className="text-red-400 text-sm m-0">{leaveError}</p> : null}
            {!showLeaveConfirm ? (
              <button
                type="button"
                disabled={previewMode}
                onClick={() => {
                  setShowLeaveConfirm(true);
                  setLeaveConfirmLast(activeLoginCount <= 1);
                }}
                className="text-sm px-3 py-2 rounded-lg border border-white/15 text-white/70 hover:bg-white/5 disabled:opacity-50"
              >
                Leave this account
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={leaveBusy || previewMode}
                  onClick={handleLeaveAccount}
                  className="text-sm px-3 py-2 rounded-lg bg-red-500/90 text-white font-medium hover:bg-red-500 disabled:opacity-50"
                >
                  {leaveBusy ? 'Leaving…' : 'Confirm leave'}
                </button>
                <button
                  type="button"
                  disabled={leaveBusy}
                  onClick={() => {
                    setShowLeaveConfirm(false);
                    setLeaveError(null);
                  }}
                  className="text-sm px-3 py-2 rounded-lg border border-white/15 text-white/60"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : null}

        <SupportCTA />
      </div>
    </>
  );
}

SettingsPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="Account Settings">{page}</DashboardLayout>;
};
