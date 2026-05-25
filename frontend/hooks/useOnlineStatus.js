/**
 * useOnlineStatus — detects online/offline state
 * Returns { isOnline, wasOffline } 
 * wasOffline is true if the user came back online after being offline
 * (useful for triggering a sync)
 */

import { useState, useEffect, useRef } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const wasOfflineRef = useRef(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        setWasOffline(true);
        // Reset after a moment so consumers can react once
        setTimeout(() => setWasOffline(false), 5000);
      }
      wasOfflineRef.current = false;
    }

    function handleOffline() {
      setIsOnline(false);
      wasOfflineRef.current = true;
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
