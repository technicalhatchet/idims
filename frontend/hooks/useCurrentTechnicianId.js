import { useMemo } from 'react';
import { useUserRole } from '../utils/auth0-helpers';
import { useTechnicians } from './useTechnicians';
import { resolveCurrentTechnicianId } from '../utils/workOrderPermissions';

/** Resolve the logged-in user's technician profile id (null for non-technicians). */
export default function useCurrentTechnicianId() {
  const { user, role } = useUserRole();
  const { data } = useTechnicians({}, { enabled: role === 'technician' });

  return useMemo(() => {
    if (!user || role !== 'technician') return null;
    const items = data?.items;
    if (!items?.length) return null;
    return resolveCurrentTechnicianId(user, items);
  }, [user, role, data]);
}
