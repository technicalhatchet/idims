import { useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { apiClient } from '../utils/api-client';
import { getUserRole } from '../utils/auth0-helpers';
import { resolveCurrentTechnicianId } from '../utils/workOrderPermissions';

/** Resolve the logged-in user's technician profile id (null for non-technicians). */
export default function useCurrentTechnicianId() {
  const { user } = useUser();
  const [technicianId, setTechnicianId] = useState(null);

  useEffect(() => {
    if (!user) {
      setTechnicianId(null);
      return undefined;
    }

    const role = getUserRole(user);
    if (role !== 'technician') {
      setTechnicianId(null);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await apiClient('api/technicians');
        const items = response?.items || [];
        if (!cancelled) {
          setTechnicianId(resolveCurrentTechnicianId(user, items));
        }
      } catch {
        if (!cancelled) setTechnicianId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return technicianId;
}
