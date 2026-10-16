import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ClientPwaHead from './ClientPwaHead';
import PortalWelcome from './PortalWelcome';
import ImpersonationBanner from './ImpersonationBanner';
import { getPortalSessionToken, portalFetch } from '../../utils/portalFetch';
import {
  getPortalImpersonateClientId,
  getPortalImpersonateClientName,
  isPortalAdminPreview,
} from '../../utils/portalPreview';

const PORTAL_SHELL = '#0B0F1A';

export default function DashboardLayout({ children, title = 'Client Portal', user: userProp }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [portalUser, setPortalUser] = useState(null);
  const [workOrdersForAlerts, setWorkOrdersForAlerts] = useState([]);
  const router = useRouter();

  useEffect(() => {
    setSidebarOpen(false);
  }, [router.pathname]);

  const exitPreview = useCallback(() => {
    sessionStorage.removeItem('portal_impersonate_client_id');
    sessionStorage.removeItem('portal_impersonate_client_name');
    router.push('/cxdashboard');
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function loadPortalUser() {
      try {
        const impersonateId = getPortalImpersonateClientId();
        if (impersonateId) {
          const previewName = getPortalImpersonateClientName() || 'Client';
          const parts = previewName.split(' ');
          const token = await getPortalSessionToken();
          let email = '';
          if (token) {
            try {
              const profile = await portalFetch('me', token);
              email = profile.email || '';
            } catch {
              // preview without /me is non-fatal
            }
          }
          if (!cancelled) {
            setPortalUser({
              name: previewName.replace(/\s*\([^)]*\)\s*$/, '').trim() || previewName,
              firstName: parts[0] || 'Client',
              email,
            });
          }
          return;
        }

        const token = await getPortalSessionToken();
        if (!token) return;

        const profile = await portalFetch('me', token);
        const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        if (!name || cancelled) return;

        setPortalUser({
          name,
          firstName: profile.first_name,
          lastName: profile.last_name,
          email: profile.email || '',
          initials: `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase() || undefined,
        });
        sessionStorage.setItem('portal_client_name', name);
      } catch {
        // Topbar falls back to Auth0 profile
      }
    }

    loadPortalUser();
    return () => {
      cancelled = true;
    };
  }, [router.pathname]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkOrdersForAlerts() {
      try {
        const token = await getPortalSessionToken();
        if (!token) return;
        const data = await portalFetch('work-orders', token);
        if (!cancelled) {
          setWorkOrdersForAlerts(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setWorkOrdersForAlerts([]);
      }
    }

    loadWorkOrdersForAlerts();
    return () => {
      cancelled = true;
    };
  }, [router.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    const prevColorScheme = html.style.colorScheme;

    html.style.backgroundColor = PORTAL_SHELL;
    body.style.backgroundColor = PORTAL_SHELL;
    html.style.colorScheme = 'dark';

    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      html.style.colorScheme = prevColorScheme;
    };
  }, []);

  const pageTitle = `${title} | Atomic Repair`;

  return (
    <>
      <ClientPwaHead />
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content="Manage your appliance repairs, appointments, and invoices." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="min-h-screen bg-[#0B0F1A]">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          user={userProp || portalUser}
        />
        <div className="min-h-screen flex flex-col lg:ml-64">
          <Topbar
            title={title}
            user={userProp || portalUser}
            workOrders={workOrdersForAlerts}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {isPortalAdminPreview() && (
              <ImpersonationBanner onExit={exitPreview} />
            )}
            <PortalWelcome user={userProp || portalUser} />
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
