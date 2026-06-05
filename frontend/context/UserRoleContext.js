import { createContext, useContext, useMemo } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { getUserRole } from '../utils/auth0-helpers';

const ROLE_HIERARCHY = {
  client: ['client'],
  technician: ['technician', 'client'],
  manager: ['manager', 'technician', 'client'],
  admin: ['admin', 'manager', 'technician', 'client'],
};

function buildRoleValue(user, isLoading, error) {
  const role = user ? getUserRole(user) : null;
  return {
    user,
    isLoading,
    error,
    role,
    isAdmin: role === 'admin',
    isManager: role === 'manager' || role === 'admin',
    isTechnician: role === 'technician' || role === 'manager' || role === 'admin',
    isClient: role === 'client' || role === 'technician' || role === 'manager' || role === 'admin',
    hasRole: (requiredRole) =>
      Boolean(role && ROLE_HIERARCHY[role]?.includes(requiredRole)),
  };
}

const UserRoleContext = createContext(null);

export function UserRoleProvider({ children }) {
  const { user, isLoading, error } = useUser();
  const value = useMemo(
    () => buildRoleValue(user, isLoading, error),
    [user, isLoading, error],
  );
  return (
    <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>
  );
}

/** Role resolved once per auth user at app root — avoid calling getUserRole in every child render. */
export function useUserRole() {
  const ctx = useContext(UserRoleContext);
  const { user, isLoading, error } = useUser();
  const fallback = useMemo(
    () => buildRoleValue(user, isLoading, error),
    [user, isLoading, error],
  );
  return ctx ?? fallback;
}
