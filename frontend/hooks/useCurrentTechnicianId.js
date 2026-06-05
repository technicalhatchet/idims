import { useState, useEffect } from 'react';
import { useUserRole } from '../utils/auth0-helpers';
import { apiClient } from '../utils/api-client';
import { resolveCurrentTechnicianId } from '../utils/workOrderPermissions';

/** Resolve the logged-in user's technician profile id (null for non-technicians). */
export default function useCurrentTechnicianId() {
  const { user, role } = useUserRole();
  const [technicianId, setTechnicianId] = useState(null);

  useEffect(() => {
    if (!user || role !== 'technician') {
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
  }, [user, role]);

  return technicianId;
}
