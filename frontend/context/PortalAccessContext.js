import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { getPortalSessionToken, portalFetch } from '../utils/portalFetch';

const PortalAccessContext = createContext({
  loaded: false,
  portalAccess: null,
  isTenant: false,
  isOwner: true,
  estimateAutoApproveLimit: null,
  refresh: async () => {},
});

export function PortalAccessProvider({ children }) {
  const router = useRouter();
  const onPortal = router.pathname.startsWith('/cxdashboard');
  const [loaded, setLoaded] = useState(false);
  const [portalAccess, setPortalAccess] = useState(null);
  const [estimateAutoApproveLimit, setEstimateAutoApproveLimit] = useState(null);

  const load = async () => {
    if (!onPortal) {
      setLoaded(true);
      return;
    }
    try {
      const token = await getPortalSessionToken();
      if (!token) {
        setPortalAccess(null);
        setEstimateAutoApproveLimit(null);
        return;
      }
      const me = await portalFetch('me', token);
      setPortalAccess(me?.portal_access || null);
      setEstimateAutoApproveLimit(
        me?.estimate_auto_approve_limit != null ? me.estimate_auto_approve_limit : null,
      );
    } catch {
      setPortalAccess(null);
      setEstimateAutoApproveLimit(null);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    setLoaded(false);
    load();
  }, [router.pathname, onPortal]);

  const isTenant = Boolean(portalAccess?.is_tenant);
  const isOwner = !isTenant;

  const value = useMemo(
    () => ({
      loaded,
      portalAccess,
      isTenant,
      isOwner,
      estimateAutoApproveLimit,
      refresh: load,
    }),
    [loaded, portalAccess, isTenant, isOwner, estimateAutoApproveLimit],
  );

  return (
    <PortalAccessContext.Provider value={value}>
      {children}
    </PortalAccessContext.Provider>
  );
}

export function usePortalAccess() {
  return useContext(PortalAccessContext);
}
