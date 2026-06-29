import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { format, parseISO } from 'date-fns';
import { FaCalendarAlt, FaTools, FaFileInvoiceDollar, FaShieldAlt, FaTimes, FaEye } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import StatCard from '../../components/cxdashboard/StatCard';
import AppointmentCard from '../../components/cxdashboard/AppointmentCard';
import RepairStatus from '../../components/cxdashboard/RepairStatus';
import RecentRepairs from '../../components/cxdashboard/RecentRepairs';
import InvoiceList from '../../components/cxdashboard/InvoiceList';
import SupportCTA from '../../components/cxdashboard/SupportCTA';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
const CLIENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidClientId(id) {
  return typeof id === 'string' && CLIENT_ID_RE.test(id);
}

async function portalFetch(endpoint, accessToken, impersonateClientId = null) {
  if (impersonateClientId && !isValidClientId(impersonateClientId)) {
    throw new Error('Invalid client preview selection. Please pick a client again.');
  }
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = impersonateClientId
    ? `${BACKEND}/api/portal/${endpoint}${sep}admin_client_id=${impersonateClientId}`
    : `${BACKEND}/api/portal/${endpoint}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail || res.statusText;
    throw new Error(detail || `Portal API error: ${res.status}`);
  }
  return res.json();
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
    service: [wo.equipment_make, wo.equipment_subtype].filter(Boolean).join(' ') || wo.equipment_type || 'Service',
    address: prop.address || '',
    city: prop.unit_number ? `Unit ${prop.unit_number}` : '',
    image: wo.equipment_subtype || wo.equipment_type || 'appliance',
  };
}

function formatRepairForCard(wo) {
  if (!wo) return null;
  const statusMap = { in_progress: 'In Progress', scheduled: 'Scheduled', en_route: 'En Route', pending: 'Pending', completed: 'Completed', completed_pending_payment: 'Pending Payment', waiting_on_parts: 'Waiting on Parts', parts_on_order: 'Parts on Order', on_hold: 'On Hold', canceled: 'Canceled', closed: 'Closed' };
  const stepMap = { pending: 0, scheduled: 0, en_route: 1, in_progress: 1, completed_pending_payment: 2, completed: 3 };
  return {
    id: wo.id,
    status: statusMap[wo.status] || wo.status,
    service: [wo.equipment_make, wo.equipment_subtype].filter(Boolean).join(' ') || wo.equipment_type || 'Repair',
    date: wo.created_at ? format(parseISO(wo.created_at), 'MMM d, yyyy') : '',
    orderNumber: wo.order_number,
    technician: 'Rhett Nysko',
    phone: '(419) 515-3394',
    icon: wo.equipment_subtype || wo.equipment_type || 'appliance',
    currentStep: stepMap[wo.status] ?? 1,
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

// Amber banner shown when admin is impersonating a client
function ImpersonationBanner({ clientName, onExit }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(245,158,11,0.95)',
      backdropFilter: 'blur(8px)',
      padding: '8px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: '13px', fontWeight: '600', color: '#0f0f1a',
      marginBottom: '1.5rem', borderRadius: '8px',
    }}>
      <div className="flex items-center gap-2">
        <FaEye />
        <span>Admin Preview — Viewing as: <strong>{clientName}</strong></span>
      </div>
      <button onClick={onExit} style={{ background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#0f0f1a', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}>
        <FaTimes size={11} /> Exit Preview
      </button>
    </div>
  );
}

export default function ClientDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);

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
        const roles = session.user?.['https://idimsapi/app_metadata']?.roles || [];
        const adminUser = roles.includes('admin');
        const staffUser = roles.some((r) => ['admin', 'manager', 'technician'].includes(r));
        setIsAdmin(adminUser);

        // If coming from registration, link the account using stored invite token
        const storedInviteToken = sessionStorage.getItem('portal_invite_token');
        if (storedInviteToken) {
          sessionStorage.removeItem('portal_invite_token');
          try {
            const linkRes = await fetch(`${BACKEND}/api/portal/link-account`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ invite_token: storedInviteToken, email: session.user?.email }),
            });
            if (!linkRes.ok) {
              const err = await linkRes.json().catch(() => ({}));
              console.error('[Portal] Link account failed:', err.detail || linkRes.status);
            } else {
              // Re-login so the session picks up the newly assigned client role
              window.location.href = '/api/auth/login?returnTo=/cxdashboard';
              return;
            }
          } catch (e) {
            console.error('[Portal] Link account error:', e);
          }
        } else if (!staffUser && session.user?.email) {
          // Heal missing auth0_user_id for returning clients (idempotent if already linked)
          try {
            await fetch(`${BACKEND}/api/portal/link-account`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: session.user.email }),
            });
          } catch (e) {
            console.warn('[Portal] Auto link-account skipped:', e);
          }
        }

        if (adminUser) {
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
            setError(e.message || 'Failed to load clients');
          } finally {
            setClientsLoading(false);
          }
          setLoading(false);
        } else {
          // Regular client — load their own data
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
      const [prof, appts, wos, invs] = await Promise.all([
        portalFetch('me', token, clientId),
        portalFetch('appointments?upcoming_only=true', token, clientId),
        portalFetch('work-orders', token, clientId),
        portalFetch('invoices', token, clientId),
      ]);
      setProfile(prof);
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
    sessionStorage.setItem('portal_impersonate_client_id', client.id);
    sessionStorage.setItem('portal_impersonate_client_name', `${client.first_name} ${client.last_name}${client.company_name ? ` (${client.company_name})` : ''}`);
    loadPortalData(accessToken, client.id);
  };

  const handleExitPreview = () => {
    setSelectedClient(null);
    sessionStorage.removeItem('portal_impersonate_client_id');
    sessionStorage.removeItem('portal_impersonate_client_name');
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
        {error && (
          <div className="max-w-lg mx-auto mt-8 mb-4 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
            <p className="font-medium mb-1">Could not load client list</p>
            <p className="text-red-200/80">{error}</p>
          </div>
        )}
        <ClientPicker clients={clients} onSelect={handleSelectClient} loading={clientsLoading} />
      </>
    );
  }

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
      subtitle: profile.stats?.active_repairs > 0 ? 'In Progress' : 'All clear',
      icon: FaTools,
      href: '/cxdashboard/repairs',
      highlight: profile.stats?.active_repairs > 0,
    },
    {
      title: 'Total Invoices',
      value: String(invoices.length),
      subtitle: (() => {
        const paid = invoices.filter(i => i.payment_status === 'paid').length;
        const unpaid = invoices.filter(i => i.payment_status !== 'paid').length;
        return unpaid > 0 ? `${paid} Paid • ${unpaid} Outstanding` : `${paid} Paid`;
      })(),
      icon: FaFileInvoiceDollar,
      href: '/cxdashboard/invoices',
    },
    {
      title: 'Warranty Coverage',
      value: String(profile.stats?.warranty_active ?? 0),
      subtitle: profile.stats?.warranty_active > 0 ? 'Active' : 'None active',
      icon: FaShieldAlt,
      href: '/cxdashboard/warranty',
    },
  ] : [];

  const nextAppointment = appointments[0];
  const appointmentCardData = formatAppointmentForCard(nextAppointment);
  const activeRepair = workOrders.find(w => !['completed', 'cancelled', 'closed'].includes(w.status));
  const repairCardData = formatRepairForCard(activeRepair);
  const recentRepairs = workOrders.slice(0, 5).map(wo => ({
    id: wo.order_number,
    service: [wo.equipment_make, wo.equipment_subtype].filter(Boolean).join(' ') || wo.equipment_type || 'Service',
    date: wo.created_at ? format(parseISO(wo.created_at), 'MMM d, yyyy') : '',
    status: wo.status === 'completed' ? 'Completed' : wo.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    price: wo.invoice_total ? `$${Number(wo.invoice_total).toFixed(2)}` : '—',
    icon: wo.equipment_subtype || wo.equipment_type || 'appliance',
  }));
  const invoiceListData = invoices.slice(0, 5).map(inv => ({
    id: inv.id,
    number: inv.order_number,
    date: inv.created_at ? format(parseISO(inv.created_at), 'MMM d, yyyy') : '',
    status: inv.payment_status === 'paid' ? 'Paid' : 'Due',
    amount: inv.total ? `${Number(inv.total).toFixed(2)}` : 'N/A',
    dueDate: inv.payment_status !== 'paid' ? 'Outstanding' : null,
  }));

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
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={() => loadPortalData(accessToken, selectedClient?.id)} className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-500">
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

  return (
    <>
      <Head>
        <title>{isAdmin ? `Portal Preview: ${selectedClient?.first_name} ${selectedClient?.last_name}` : 'Client Portal'} | Atomic Repair</title>
      </Head>
      <div className="space-y-8">
        {isAdmin && selectedClient && (
          <ImpersonationBanner
            clientName={`${selectedClient.first_name} ${selectedClient.last_name}${selectedClient.company_name ? ` (${selectedClient.company_name})` : ''}`}
            onExit={handleExitPreview}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <StatCard key={stat.title} {...stat} index={index} />
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {appointmentCardData
              ? <AppointmentCard appointment={appointmentCardData} />
              : <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center text-gray-400">No upcoming appointments</div>
            }
            <RecentRepairs repairs={recentRepairs} />
          </div>
          <div className="space-y-6">
            {repairCardData
              ? <RepairStatus repair={repairCardData} />
              : <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center text-gray-400">No active repairs</div>
            }
            <InvoiceList invoices={invoiceListData} />
          </div>
        </div>

        <SupportCTA />
      </div>
    </>
  );
}

ClientDashboard.getLayout = function getLayout(page) {
  return <DashboardLayout title="Dashboard">{page}</DashboardLayout>;
};