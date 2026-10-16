import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useUser } from '@auth0/nextjs-auth0/client';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ClientPwaHead from './ClientPwaHead';
import PortalWelcome from './PortalWelcome';
import PortalPreviewBanner from './PortalPreviewBanner';
import { getPortalSessionToken, portalFetch } from '../../utils/portalFetch';
import {
  getPortalImpersonateClientId,
  getPortalImpersonateClientName,
  isPortalPreviewActive,
  notifyPortalImpersonateChanged,
  clearPortalPreviewSession,
} from '../../utils/portalPreview';
import { resolvePortalDisplayUser } from '../../utils/portalDisplayUser';

const PORTAL_SHELL = '#0B0F1A';

export default function DashboardLayout({ children, title = 'Client Portal', user: userProp }) {
  const { user: auth0User } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [impersonateTick, setImpersonateTick] = useState(0);
  const [workOrdersForAlerts, setWorkOrdersForAlerts] = useState([]);
  const router = useRouter();

  const displayUser = useMemo(() => {
    if (userProp) return userProp;
    return resolvePortalDisplayUser({
      profileUser,
      auth0User,
      impersonateName: getPortalImpersonateClientName(),
    });
  }, [userProp, profileUser, auth0User, impersonateTick]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [router.pathname]);

  const exitPreview = useCallback(() => {
    clearPortalPreviewSession();
    router.push('/cxdashboard');
  }, [router]);

  useEffect(() => {
    const onImpersonateChange = () => setImpersonateTick((t) => t + 1);
    window.addEventListener('portal-impersonate-changed', onImpersonateChange);
    return () => window.removeEventListener('portal-impersonate-changed', onImpersonateChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPortalUser() {
      try {
        const impersonateId = getPortalImpersonateClientId();
        const token = await getPortalSessionToken();
        if (!token) return;

        if (impersonateId) {
          const previewName = getPortalImpersonateClientName() || 'Client';
          const cleanName = previewName.replace(/\s*\([^)]*\)\s*$/, '').trim() || previewName;
          const parts = cleanName.split(' ').filter(Boolean);
          let email = '';
          let firstName = parts[0] || 'Client';
          let lastName = parts.slice(1).join(' ');
          try {
            const profile = await portalFetch('me', token);
            email = profile.email || '';
            if (profile.first_name) {
              firstName = profile.first_name;
              lastName = profile.last_name || '';
            }
          } catch {
            // Preview may run before /me is available.
          }
          if (!cancelled) {
            const name = `${firstName} ${lastName}`.trim() || cleanName;
            setProfileUser({
              name,
              firstName,
              lastName,
              email,
              initials: `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || undefined,
            });
            sessionStorage.setItem('portal_client_name', name);
          }
          return;
        }

        const profile = await portalFetch('me', token);
        const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        if (cancelled) return;

        if (name) {
          setProfileUser({
            name,
            firstName: profile.first_name,
            lastName: profile.last_name,
            email: profile.email || '',
            initials: `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase() || undefined,
          });
          sessionStorage.setItem('portal_client_name', name);
        } else {
          setProfileUser(null);
        }
      } catch {
        if (!cancelled) setProfileUser(null);
      }
    }

    loadPortalUser();
    return () => {
      cancelled = true;
    };
  }, [router.pathname, impersonateTick]);

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
          user={displayUser}
        />
        <div className="min-h-screen flex flex-col lg:ml-64">
          <Topbar
            title={title}
            user={displayUser}
            workOrders={workOrdersForAlerts}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {isPortalPreviewActive() && (
              <PortalPreviewBanner onExit={exitPreview} />
            )}
            <PortalWelcome user={displayUser} />
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
