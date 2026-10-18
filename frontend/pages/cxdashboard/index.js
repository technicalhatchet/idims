import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { format, parseISO } from 'date-fns';
import {
  FaCalendarAlt,
  FaEye,
  FaFileInvoiceDollar,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaTools,
} from 'react-icons/fa';
import PropertyFormModal from '../../components/cxdashboard/PropertyFormModal';
import { isPortalPreviewActive, isPortalPreviewUnlocked } from '../../utils/portalPreview';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import StatCard from '../../components/cxdashboard/StatCard';
import PortalMobileStatGrid from '../../components/cxdashboard/PortalMobileStatGrid';
import AppointmentCard from '../../components/cxdashboard/AppointmentCard';
import RepairStatus from '../../components/cxdashboard/RepairStatus';
import PartsUpdateCallout from '../../components/cxdashboard/PartsUpdateCallout';
import RecentRepairs from '../../components/cxdashboard/RecentRepairs';
import InvoiceList from '../../components/cxdashboard/InvoiceList';
import SupportCTA from '../../components/cxdashboard/SupportCTA';
import {
  buildPortalInvoiceLookup,
  formatPortalWorkOrderAppliance,
  getPortalRepairProgressStep,
  getPortalInvoicePaymentSummary,
  getPortalInvoiceDisplayStatus,
  getPortalWorkOrderDisplayTotal,
  getPortalWorkOrderPartsSummary,
  getPortalWorkOrderStatusLabel,
  pickPortalDashboardActiveRepair,
} from '../../utils/portalWorkOrderDisplay';
import { formatPortalCurrency } from '../../utils/portalMoney';
import { countPortalActiveLaborWarranties } from '../../utils/portalWarranty';
import {
  postPortalLinkAccount,
  fetchPortalSignupStatus,
  linkResultNeedsFinishProfile,
  logPortalLinkDiagnostics,
  getSessionRoles,
  shouldRefreshPortalToken,
  hasPortalTokenRefreshBeenAttempted,
  clearPortalTokenRefreshAttempt,
  redirectToRefreshPortalToken,
} from '../../utils/portalLink';
import {
  clearPortalPreviewUnlock,
  clearPortalPreviewSession,
  notifyPortalImpersonateChanged,
} from '../../utils/portalPreview';
import { portalFetch as portalFetchShared } from '../../utils/portalFetch';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
const CLIENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidClientId(id) {
  return typeof id === 'string' && CLIENT_ID_RE.test(id);
}

async function portalFetch(endpoint, accessToken, impersonateClientId = null) {
  if (impersonateClientId && !isValidClientId(impersonateClientId)) {
    throw new Error('Invalid client preview selection. Please pick a client again.');
  }
  return portalFetchShared(endpoint, accessToken, {}, impersonateClientId);
}


function formatAppointmentForCard(appt) {
  if (!appt) return null;
  const start = appt.scheduled_start ? parseISO(appt.scheduled_start) : null;
  const end = appt.scheduled_end ? parseISO(appt.scheduled_end) : null;
  const wo = appt.work_order || {};
  const prop = appt.property || {};
  return {
    id: appt.id,
    status: appt.status === 'scheduled' ? 'Confirmed' : appt.status,
    date: start ? format(start, 'EEE, MMM d, yyyy') : 'TBD',
    time: start && end ? `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}` : start ? format(start, 'h:mm a') : 'TBD',
    service: formatPortalWorkOrderAppliance(wo) || 'Service',
    address: prop.address || '',
    city: prop.unit_number ? `Unit ${prop.unit_number}` : '',
    image: wo.equipment_subtype || wo.equipment_type || 'appliance',
  };
}

function formatRepairForCard(wo) {
  if (!wo) return null;
  const partsSummary = getPortalWorkOrderPartsSummary(wo);
  let partsNote = null;
  if (partsSummary.hasReceivedParts) {
    const name = partsSummary.received[0]?.name || 'A part';
    partsNote = `${name} has arrived — we'll schedule your return visit.`;
  } else if (partsSummary.hasOrderedParts) {
    const name = partsSummary.ordered[0]?.name || 'A part';
    partsNote = `${name} is on order. We'll notify you when it arrives.`;
  } else if (partsSummary.woOnHold) {
    partsNote = 'Your repair is waiting on parts.';
  }

  return {
    id: wo.id,
    status: getPortalWorkOrderStatusLabel(wo.status),
    service: formatPortalWorkOrderAppliance(wo) || 'Repair',
    date: wo.created_at ? format(parseISO(wo.created_at), 'MMM d, yyyy') : '',
    orderNumber: wo.order_number,
    technician: 'Rhett Nysko',
    phone: '(419) 740-0146',
    icon: wo.equipment_subtype || wo.equipment_type || 'appliance',
    currentStep: getPortalRepairProgressStep(wo.status),
    partsNote,
  };
}

// Admin client picker shown when admin has no client selected
function ClientPicker({ clients, onSelect, loading }) {
  const [search, setSearch] = useState('');
  const filtered = clients.filter(c =>
    `${c.first_name} ${c.last_name} ${c.company_name || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '480px' }}>
        <div className="flex items-center gap-3 mb-6">
          <div style={{ background: 'rgba(0,212,255,0.1)', borderRadius: '10px', padding: '8px' }}>
            <FaEye style={{ color: '#00D4FF', fontSize: '18px' }} />
          </div>
          <div>
            <h2 style={{ color: '#fff', fontWeight: '700', fontSize: '1.125rem', margin: 0 }}>Preview Client Portal</h2>
            <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: 0 }}>Select a client to view their dashboard</p>
          </div>
        </div>

        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.625rem 0.875rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.875rem', marginBottom: '0.75rem', boxSizing: 'border-box' }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading clients...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No clients found</div>
        ) : (
          <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filtered.map(client => (
              <button
                key={client.id}
                onClick={() => onSelect(client)}
                style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
              >
                <div style={{ color: '#fff', fontWeight: '600', fontSize: '0.875rem' }}>
                  {client.first_name} {client.last_name}
                </div>
                {client.company_name && (
                  <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{client.company_name}</div>
                )}
                {client.email && (
                  <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{client.email}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [properties, setProperties] = useState([]);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [savingProperty, setSavingProperty] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);
  const [clientsListError, setClientsListError] = useState(null);

  // Admin impersonation state
  const [isAdmin, setIsAdmin] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null); // { id, first_name, last_name, company_name }
  const [accessToken, setAccessToken] = useState(null);

  // On mount: get session and determine role
  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        if (!sessionRes.ok) { router.push('/cxdashboard/login'); return; }
        const session = await sessionRes.json();
        const token = session.accessToken;
        setAccessToken(token);

        // Check roles
        const roles = getSessionRoles(session);
        const adminUser = roles.includes('admin');
        const staffUser = roles.some((r) => ['admin', 'manager', 'technician'].includes(r));
        const hasClientRole = roles.includes('client');
        setIsAdmin(adminUser);

        if (hasClientRole) {
          clearPortalTokenRefreshAttempt();
        }

        const goFinishProfileIfNeeded = (linkResult) => {
          if (linkResultNeedsFinishProfile(linkResult)) {
            router.replace('/cxdashboard/finish-profile');
            return true;
          }
          return false;
        };

        const handleLinkRefresh = (linkResult) => {
          if (goFinishProfileIfNeeded(linkResult)) {
            return true;
          }
          if (shouldRefreshPortalToken(linkResult, hasClientRole)) {
            if (hasPortalTokenRefreshBeenAttempted()) {
              setError(
                'Your account is linked, but your session does not include portal access yet. '
                + 'Log out completely, then sign in again. If it still fails, contact support.',
              );
              return true;
            }
            redirectToRefreshPortalToken();
            return true;
          }
          return false;
        };

        // If coming from registration, link the account using stored invite token
        const storedInviteToken = sessionStorage.getItem('portal_invite_token');
        if (storedInviteToken && !adminUser) {
          sessionStorage.removeItem('portal_invite_token');
          try {
            const linkResult = await postPortalLinkAccount(token, {
              inviteToken: storedInviteToken,
            });
            logPortalLinkDiagnostics('link-account (invite)', linkResult);
            if (!linkResult.ok) {
              const msg = linkResult.data?.detail || `Link failed (${linkResult.status})`;
              console.error('[Portal] Link account failed:', msg);
              setError(msg);
            } else if (!linkResult.data?.role_assigned) {
              const warn = linkResult.data?.role_error || linkResult.data?.role_warning;
              console.warn('[Portal] Linked but role not assigned:', warn);
              setError(warn || 'Account linked but Auth0 client role was not assigned.');
            } else if (handleLinkRefresh(linkResult)) {
              return;
            }
          } catch (e) {
            console.error('[Portal] Link account error:', e);
            setError(e.message || 'Link account failed');
          }
        } else if (!staffUser) {
          try {
            const linkResult = await postPortalLinkAccount(token);
            logPortalLinkDiagnostics('link-account (auto)', linkResult);
            if (handleLinkRefresh(linkResult)) {
              return;
            }
            if (!linkResult.ok) {
              const msg = linkResult.data?.detail || `Link failed (${linkResult.status})`;
              console.warn('[Portal] Auto link-account failed:', msg);
              if (linkResult.status === 403 || linkResult.status === 409) {
                setError(msg);
              }
            } else if (!linkResult.data?.role_assigned) {
              console.warn('[Portal] Auto link role issue:', linkResult.data?.role_error);
            }
          } catch (e) {
            console.warn('[Portal] Auto link-account skipped:', e);
          }
        }

        if (adminUser) {
          setClientsListError(null);
          const savedClientId = sessionStorage.getItem('portal_impersonate_client_id');
          if (savedClientId && !isValidClientId(savedClientId)) {
            sessionStorage.removeItem('portal_impersonate_client_id');
            sessionStorage.removeItem('portal_impersonate_client_name');
          }

          // Load client list for picker
          setClientsLoading(true);
          try {
            const res = await fetch(`${BACKEND}/api/clients?page=1&limit=100`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.detail || `Failed to load clients (${res.status})`);
            }
            const data = await res.json();
            setClients(data.items || []);
            setClientsListError(null);

            const validSavedId = sessionStorage.getItem('portal_impersonate_client_id');
            if (validSavedId && isValidClientId(validSavedId)) {
              const savedClient = (data.items || []).find((c) => c.id === validSavedId);
              if (savedClient) {
                setSelectedClient(savedClient);
                await loadPortalData(token, savedClient.id);
                return;
              }
              sessionStorage.removeItem('portal_impersonate_client_id');
              sessionStorage.removeItem('portal_impersonate_client_name');
            }
          } catch (e) {
            console.error('Failed to load clients:', e);
            setClientsListError(e.message || 'Failed to load clients');
          } finally {
            setClientsLoading(false);
          }
          setLoading(false);
        } else {
          if (!hasClientRole) {
            try {
              const signupStatus = await fetchPortalSignupStatus(token);
              if (signupStatus.status === 'needs_profile') {
                router.replace('/cxdashboard/finish-profile');
                return;
              }
            } catch (e) {
              console.warn('[Portal] signup-status:', e);
            }
            setLoading(false);
            return;
          }
          await loadPortalData(token, null);
        }
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }
    init();
  }, []);

  // Load portal data for a specific client (or self)
  async function loadPortalData(token, clientId) {
    setLoading(true);
    setError(null);
    try {
      const [prof, appts, wos, invs, props] = await Promise.all([
        portalFetch('me', token, clientId),
        portalFetch('appointments?upcoming_only=true', token, clientId),
        portalFetch('work-orders', token, clientId),
        portalFetch('invoices', token, clientId),
        portalFetch('properties', token, clientId).catch(() => []),
      ]);
      setProfile(prof);
      setProperties(Array.isArray(props) ? props : []);
      if (prof?.first_name) {
        sessionStorage.setItem('portal_client_name', `${prof.first_name} ${prof.last_name}`);
      }
      setAppointments(Array.isArray(appts) ? appts : []);
      setWorkOrders(Array.isArray(wos) ? wos : []);
      setInvoices(Array.isArray(invs) ? invs : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    clearPortalPreviewUnlock();
    sessionStorage.setItem('portal_impersonate_client_id', client.id);
    sessionStorage.setItem('portal_impersonate_client_name', `${client.first_name} ${client.last_name}${client.company_name ? ` (${client.company_name})` : ''}`);
    notifyPortalImpersonateChanged();
    loadPortalData(accessToken, client.id);
  };

  const handleExitPreview = () => {
    setSelectedClient(null);
    clearPortalPreviewSession();
    setProfile(null);
    setAppointments([]);
    setWorkOrders([]);
    setInvoices([]);
  };

  // Admin with no client selected — show picker (or load error)
  if (isAdmin && !selectedClient) {
    return (
      <>
        <Head><title>Client Portal Preview | Atomic Repair</title></Head>
        {clientsListError && (
          <div className="max-w-lg mx-auto mt-8 mb-4 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
            <p className="font-medium mb-1">Could not load client list</p>
            <p className="text-red-200/80">{clientsListError}</p>
          </div>
        )}
        <ClientPicker clients={clients} onSelect={handleSelectClient} loading={clientsLoading} />
      </>
    );
  }

  const invoiceLookup = buildPortalInvoiceLookup(invoices);
  const paidInvoiceCount = invoices.filter((i) => getPortalInvoiceDisplayStatus(i) === 'paid').length;
  const outstandingInvoiceCount = invoices.length - paidInvoiceCount;
  const warrantyActiveCount = countPortalActiveLaborWarranties(workOrders);
  const activeRepair = pickPortalDashboardActiveRepair(workOrders);

  const stats = profile ? [
  {
    title: 'Upcoming Appointments',
      value: String(profile.stats?.upcoming_appointments ?? 0),
      subtitle: profile.stats?.next_appointment ? `Next: ${format(parseISO(profile.stats.next_appointment), 'MMM d, yyyy')}` : 'None scheduled',
    icon: FaCalendarAlt,
      href: '/cxdashboard/appointments',
  },
  {
    title: 'Active Repairs',
      value: String(profile.stats?.active_repairs ?? 0),
      subtitle: activeRepair
        ? getPortalWorkOrderStatusLabel(activeRepair.status)
        : (profile.stats?.active_repairs > 0 ? 'In progress' : 'All clear'),
    icon: FaTools,
    href: '/cxdashboard/repairs',
      highlight: profile.stats?.active_repairs > 0,
  },
  {
    title: 'Total Invoices',
      value: String(invoices.length),
      subtitle: outstandingInvoiceCount > 0
        ? `${paidInvoiceCount} Paid • ${outstandingInvoiceCount} Outstanding`
        : `${paidInvoiceCount} Paid`,
    icon: FaFileInvoiceDollar,
      href: '/cxdashboard/invoices',
  },
  {
    title: 'Warranty Coverage',
      value: String(warrantyActiveCount),
      subtitle: warrantyActiveCount > 0 ? 'Active' : 'None active',
    icon: FaShieldAlt,
      href: '/cxdashboard/warranty',
    },
  ] : [];

  const nextAppointment = appointments[0];
  const appointmentCardData = formatAppointmentForCard(nextAppointment);
  const repairCardData = formatRepairForCard(activeRepair);
  const recentRepairs = workOrders.slice(0, 5).map((wo) => {
    const total = getPortalWorkOrderDisplayTotal(wo, invoiceLookup);
    return {
      id: wo.id,
      orderNumber: wo.order_number,
      service: formatPortalWorkOrderAppliance(wo) || 'Service',
      date: wo.created_at ? format(parseISO(wo.created_at), 'MMM d, yyyy') : '',
      status: getPortalWorkOrderStatusLabel(wo.status),
      price: total != null ? formatPortalCurrency(total) : '—',
      icon: wo.equipment_subtype || wo.equipment_type || 'appliance',
    };
  });
  const invoiceListData = invoices.slice(0, 5).map((inv) => {
    const summary = getPortalInvoicePaymentSummary(inv);
    return {
      ...inv,
      number: inv.order_number,
      date: inv.created_at ? format(parseISO(inv.created_at), 'MMM d, yyyy') : '',
      status:
        inv.payment_status === 'prepaid'
          ? 'Prepaid'
          : inv.payment_status === 'paid'
            ? 'Paid'
            : 'Due',
      paymentSummary: summary,
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">
            {isAdmin ? `Loading ${selectedClient?.first_name}'s dashboard...` : 'Loading your dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-2">Unable to load dashboard</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <div className="flex gap-3 justify-center mt-4 flex-wrap">
            {!isAdmin && (
              <a
                href="/api/auth/login?returnTo=/cxdashboard"
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-500"
              >
                Sign in again
              </a>
            )}
            <button onClick={() => loadPortalData(accessToken, selectedClient?.id)} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600">
              Retry
            </button>
            {isAdmin && (
              <button onClick={handleExitPreview} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600">
                Pick Different Client
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const previewLocked = isPortalPreviewActive() && !isPortalPreviewUnlocked();

  const handleDashboardAddProperty = async (payload) => {
    setSavingProperty(true);
    try {
      await portalFetch('properties', accessToken, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, selectedClient?.id);
      setShowAddProperty(false);
      const props = await portalFetch('properties', accessToken, selectedClient?.id);
      setProperties(Array.isArray(props) ? props : []);
    } catch (err) {
      window.alert(err.message || 'Could not save property');
    } finally {
      setSavingProperty(false);
    }
  };

  return (
    <>
      <div className="space-y-4 md:space-y-8">
        <PartsUpdateCallout workOrders={workOrders} />

        {!loading && properties.length === 0 ? (
          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4 md:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                <FaMapMarkerAlt />
              </div>
              <div>
                <p className="text-white font-semibold m-0">Add your home address to get started</p>
                <p className="text-gray-400 text-sm mt-1 m-0">
                  Save a service address before adding appliances or booking online.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddProperty(true)}
              disabled={previewLocked}
              className="shrink-0 rounded-lg bg-[#00D4FF] text-[#0A0F1E] px-4 py-2.5 text-sm font-bold disabled:opacity-50"
            >
              Add property
            </button>
          </div>
        ) : null}

        {/* Mobile: compact 2×2 stats */}
        <div className="md:hidden">
          <PortalMobileStatGrid stats={stats} />
        </div>

        {/* Tablet/desktop: original stat cards */}
        <div className="hidden md:grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
          <StatCard key={stat.title} {...stat} index={index} />
        ))}
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-4 md:space-y-6 order-2 lg:order-1">
            {appointmentCardData
              ? <AppointmentCard appointment={appointmentCardData} />
              : <div className="p-4 md:p-6 rounded-2xl bg-white/5 border border-white/10 text-center text-gray-400 text-sm">No upcoming appointments</div>
            }
            <RecentRepairs repairs={recentRepairs} />
          </div>
          <div className="space-y-4 md:space-y-6 order-1 lg:order-2">
            {repairCardData
              ? <RepairStatus repair={repairCardData} />
              : <div className="p-4 md:p-6 rounded-2xl bg-white/5 border border-white/10 text-center text-gray-400 text-sm">No active repairs</div>
            }
            <InvoiceList
              invoices={invoiceListData}
              portalToken={accessToken}
              onInvoicesPaid={async () => {
                if (!accessToken) return;
                const invs = await portalFetch('invoices', accessToken, selectedClient?.id);
                setInvoices(Array.isArray(invs) ? invs : []);
              }}
            />
          </div>
        </div>

        <SupportCTA />
      </div>

      {showAddProperty ? (
        <PropertyFormModal
          title="Add property"
          submitting={savingProperty}
          readOnly={previewLocked}
          onClose={() => setShowAddProperty(false)}
          onSave={handleDashboardAddProperty}
        />
      ) : null}
    </>
  );
}

ClientDashboard.getLayout = function getLayout(page) {
  return <DashboardLayout title="Dashboard">{page}</DashboardLayout>;
};