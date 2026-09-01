import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useSolomonAuth } from '../hooks/useSolomonAuth';
import { getUserSettings, updateUserSettings } from '../services/api/settingsApi';
import {
  SOLOMON_INTERFACE,
  SOLOMON_INTERFACE_ATTR,
  isValidSolomonInterfaceStyle,
  readStoredSolomonInterfaceStyle,
  resolveSolomonInterfaceStyle,
  writeStoredSolomonInterfaceStyle,
} from '../components/solomon/solomonThemeTokens';

const SolomonThemeContext = createContext({
  interfaceStyle: SOLOMON_INTERFACE.SIGNATURE,
  isProfessional: false,
  canUseProfessionalInterface: false,
  isSolomonRoute: false,
  setInterfaceStyle: () => {},
  isReady: false,
});

export function SolomonThemeProvider({ children }) {
  const router = useRouter();
  const { user } = useUser();
  const { isAdmin, rolesResolved } = useSolomonAuth();
  const isSolomonRoute = router.pathname.startsWith('/solomon');

  const canUseProfessionalInterface = Boolean(isAdmin);

  const [interfaceStyle, setInterfaceStyleState] = useState(SOLOMON_INTERFACE.SIGNATURE);
  const [isReady, setIsReady] = useState(false);
  const serverSyncDoneRef = useRef(false);

  useEffect(() => {
    serverSyncDoneRef.current = false;
  }, [user?.sub]);

  useEffect(() => {
    if (!isSolomonRoute) {
      setIsReady(true);
      return undefined;
    }

    if (!user) {
      const stored = readStoredSolomonInterfaceStyle();
      const resolved = resolveSolomonInterfaceStyle(stored, {
        canUseProfessional: false,
      });
      if (resolved !== stored) {
        writeStoredSolomonInterfaceStyle(resolved);
      }
      setInterfaceStyleState(resolved);
      setIsReady(true);
      return undefined;
    }

    if (!rolesResolved) {
      return undefined;
    }

    const stored = readStoredSolomonInterfaceStyle();
    const resolved = resolveSolomonInterfaceStyle(stored, {
      canUseProfessional: canUseProfessionalInterface,
    });

    if (resolved !== stored) {
      writeStoredSolomonInterfaceStyle(resolved);
    }

    setInterfaceStyleState(resolved);
    setIsReady(true);
    return undefined;
  }, [isSolomonRoute, canUseProfessionalInterface, rolesResolved, user]);

  useEffect(() => {
    if (!isSolomonRoute || !rolesResolved || !user) {
      serverSyncDoneRef.current = false;
      return undefined;
    }

    if (serverSyncDoneRef.current) {
      return undefined;
    }

    let cancelled = false;

    getUserSettings()
      .then((response) => {
        if (cancelled) return;
        serverSyncDoneRef.current = true;

        const dbStyle = response?.ui_preferences?.solomonInterfaceStyle;
        if (!dbStyle || !isValidSolomonInterfaceStyle(dbStyle)) {
          return;
        }

        const resolved = resolveSolomonInterfaceStyle(dbStyle, {
          canUseProfessional: canUseProfessionalInterface,
        });

        setInterfaceStyleState(resolved);
        writeStoredSolomonInterfaceStyle(resolved);
      })
      .catch(() => {
        if (!cancelled) {
          serverSyncDoneRef.current = true;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isSolomonRoute, rolesResolved, user, canUseProfessionalInterface]);

  useEffect(() => {
    if (!rolesResolved || !isSolomonRoute) return undefined;

    if (interfaceStyle === SOLOMON_INTERFACE.PROFESSIONAL && !canUseProfessionalInterface) {
      setInterfaceStyleState(SOLOMON_INTERFACE.SIGNATURE);
      writeStoredSolomonInterfaceStyle(SOLOMON_INTERFACE.SIGNATURE);
    }
    return undefined;
  }, [rolesResolved, canUseProfessionalInterface, interfaceStyle, isSolomonRoute]);

  useEffect(() => {
    if (typeof document === 'undefined' || !isSolomonRoute) return undefined;

    document.documentElement.setAttribute(SOLOMON_INTERFACE_ATTR, interfaceStyle);

    return () => {
      document.documentElement.removeAttribute(SOLOMON_INTERFACE_ATTR);
    };
  }, [interfaceStyle, isSolomonRoute]);

  const setInterfaceStyle = useCallback(
    (nextStyle) => {
      const resolved = resolveSolomonInterfaceStyle(nextStyle, {
        canUseProfessional: canUseProfessionalInterface,
      });
      setInterfaceStyleState(resolved);
      writeStoredSolomonInterfaceStyle(resolved);

      if (user) {
        updateUserSettings({
          ui_preferences: { solomonInterfaceStyle: resolved },
        }).catch(() => {
          // localStorage already has the value
        });
      }
    },
    [canUseProfessionalInterface, user],
  );

  const value = useMemo(
    () => ({
      interfaceStyle,
      isProfessional: interfaceStyle === SOLOMON_INTERFACE.PROFESSIONAL,
      canUseProfessionalInterface,
      isSolomonRoute,
      setInterfaceStyle,
      isReady,
    }),
    [
      interfaceStyle,
      canUseProfessionalInterface,
      isSolomonRoute,
      setInterfaceStyle,
      isReady,
    ],
  );

  return (
    <SolomonThemeContext.Provider value={value}>
      {children}
    </SolomonThemeContext.Provider>
  );
}

export function useSolomonThemeContext() {
  return useContext(SolomonThemeContext);
}

export { SolomonThemeContext };
