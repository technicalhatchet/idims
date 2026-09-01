import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/router';
import { useSolomonAuth } from '../hooks/useSolomonAuth';
import {
  SOLOMON_INTERFACE,
  SOLOMON_INTERFACE_ATTR,
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
  const { isAdmin, rolesResolved } = useSolomonAuth();
  const isSolomonRoute = router.pathname.startsWith('/solomon');

  const canUseProfessionalInterface = Boolean(isAdmin);

  const [interfaceStyle, setInterfaceStyleState] = useState(SOLOMON_INTERFACE.SIGNATURE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isSolomonRoute) {
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
  }, [isSolomonRoute, canUseProfessionalInterface, rolesResolved]);

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
    },
    [canUseProfessionalInterface],
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
