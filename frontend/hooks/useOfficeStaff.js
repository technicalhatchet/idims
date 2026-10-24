import { useUser } from '@auth0/nextjs-auth0/client';
import { getUserRole } from '../utils/auth0-helpers';

export function useOfficeStaff() {
  const { user, isLoading } = useUser();
  if (isLoading || !user) return false;
  const role = getUserRole(user);
  return role === 'admin' || role === 'manager';
}
