import { useCallback, useEffect, useState } from 'react';
import { getPortalSessionToken, portalFetch } from '../../utils/portalFetch';
import {
  isPortalPreviewActive,
  isPortalPreviewUnlocked,
} from '../../utils/portalPreview';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#0a101c] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50';

function formatExpires(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function PropertyTenantAccessCard({ propertyId, propertyTenantFields }) {
  const previewLocked = isPortalPreviewActive() && !isPortalPreviewUnlocked();
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState(null);
  const [error, setError] = useState(null);
  const [inviteForm, setInviteForm] = useState({
    display_name: '',
    invited_email: '',
    invited_phone: '',
  });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState(null);

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getPortalSessionToken();
      const data = await portalFetch(`properties/${propertyId}/tenant-access`, token);
      setAccess(data);
      setInviteForm({
        display_name: data?.tenant_name || propertyTenantFields?.tenant_name || '',
        invited_email: data?.tenant_email || propertyTenantFields?.tenant_email || '',
        invited_phone: data?.tenant_phone || propertyTenantFields?.tenant_phone || '',
      });
    } catch (err) {
      setError(err.message);
      setAccess(null);
    } finally {
      setLoading(false);
    }
  }, [propertyId, propertyTenantFields?.tenant_email, propertyTenantFields?.tenant_name, propertyTenantFields?.tenant_phone]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendInvite(e) {
    e.preventDefault();
    if (previewLocked) return;
    setInviteBusy(true);
    setInviteMessage(null);
    setError(null);
    try {
      const token = await getPortalSessionToken();
      await portalFetch(`properties/${propertyId}/tenant-access/invite`, token, {
        method: 'POST',
        body: JSON.stringify({
          display_name: inviteForm.display_name.trim() || null,
          invited_email: inviteForm.invited_email.trim() || null,
          invited_phone: inviteForm.invited_phone.trim() || null,
        }),
      });
      setInviteMessage('Invite sent.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setInviteBusy(false);
    }
  }

  async function cancelInvite(claimId) {
    if (previewLocked) return;
    setError(null);
    try {
      const token = await getPortalSessionToken();
      await portalFetch(`account/invites/${claimId}/cancel`, token, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function revokeTenant(loginId) {
    if (previewLocked) return;
    if (!window.confirm('Revoke this tenant’s portal access for this property?')) return;
    setError(null);
    try {
      const token = await getPortalSessionToken();
      await portalFetch(`account/members/${loginId}/revoke`, token, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!propertyId) return null;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0D1525] p-4 space-y-4">
      <div>
        <h3 className="text-white text-base font-semibold m-0">Tenant access</h3>
        <p className="text-white/45 text-sm mt-1 mb-0">
          Invite a tenant to view repairs and schedule service for this address. They cannot see billing or invoices.
        </p>
      </div>

      {loading ? (
        <p className="text-white/45 text-sm m-0">Loading tenant access…</p>
      ) : (
        <>
          {error ? <p className="text-red-400 text-sm m-0">{error}</p> : null}

          {(access?.active_tenants?.length ?? 0) > 0 ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/45 mb-2 m-0">Active tenants</p>
              <ul className="m-0 p-0 list-none space-y-2">
                {access.active_tenants.map((t) => (
                  <li
                    key={t.id}
                    className="text-sm text-white/75 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-white/5 rounded-md px-2 py-2"
                  >
                    <span>
                      <span className="text-white/90">{t.display_name || 'Tenant'}</span>
                      {t.email ? <span className="text-white/45"> · {t.email}</span> : null}
                    </span>
                    <button
                      type="button"
                      disabled={previewLocked}
                      onClick={() => revokeTenant(t.id)}
                      className="text-xs px-2 py-1 rounded border border-white/15 text-white/60 hover:bg-white/5 disabled:opacity-50 shrink-0"
                    >
                      Revoke access
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(access?.pending_invites?.length ?? 0) > 0 ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/45 mb-2 m-0">Pending invites</p>
              <ul className="m-0 p-0 list-none space-y-2">
                {access.pending_invites.map((inv) => (
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
                    <button
                      type="button"
                      disabled={previewLocked}
                      onClick={() => cancelInvite(inv.id)}
                      className="text-xs px-2 py-1 rounded border border-white/15 text-white/60 hover:bg-white/5 disabled:opacity-50 shrink-0"
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <form onSubmit={sendInvite} className="space-y-2 border-t border-white/5 pt-3">
            <p className="text-[11px] uppercase tracking-wide text-white/45 m-0">Invite tenant</p>
            <input
              className={inputClass}
              placeholder="Tenant name"
              value={inviteForm.display_name}
              onChange={(e) => setInviteForm((p) => ({ ...p, display_name: e.target.value }))}
              disabled={previewLocked}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="email"
                className={inputClass}
                placeholder="Email (required)"
                value={inviteForm.invited_email}
                onChange={(e) => setInviteForm((p) => ({ ...p, invited_email: e.target.value }))}
                required
                disabled={previewLocked}
                autoComplete="email"
              />
              <input
                type="tel"
                className={inputClass}
                placeholder="Cell (optional)"
                value={inviteForm.invited_phone}
                onChange={(e) => setInviteForm((p) => ({ ...p, invited_phone: e.target.value }))}
                disabled={previewLocked}
                autoComplete="tel"
              />
            </div>
            {inviteMessage ? <p className="text-emerald-400 text-xs m-0">{inviteMessage}</p> : null}
            <button
              type="submit"
              disabled={inviteBusy || previewLocked}
              className="text-sm px-3 py-2 rounded-lg border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50"
            >
              {previewLocked ? 'Unlock preview to invite' : (inviteBusy ? 'Sending…' : 'Send tenant invite')}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
