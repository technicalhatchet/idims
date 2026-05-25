/**
 * Shows offline state + pending mutation count + sync progress.
 */

import { useEffect, useState } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useOfflineSync } from '../../hooks/useOfflineSync';

export default function SyncBanner() {
  const [mounted, setMounted] = useState(false);
  const { isOnline, wasOffline } = useOnlineStatus();
  const { pendingCount, syncState, lastSyncError } = useOfflineSync();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!isOnline) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'rgba(245, 158, 11, 0.95)',
          backdropFilter: 'blur(8px)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: '600',
          color: '#0f0f1a',
          textAlign: 'center',
        }}
      >
        You&apos;re offline
        {pendingCount > 0
          ? ` — ${pendingCount} change${pendingCount === 1 ? '' : 's'} will sync when back online`
          : ' — showing cached data'}
      </div>
    );
  }

  if (syncState === 'syncing' && pendingCount > 0) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'rgba(59, 130, 246, 0.95)',
          backdropFilter: 'blur(8px)',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: '600',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        Syncing {pendingCount} pending change{pendingCount === 1 ? '' : 's'}…
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'rgba(245, 158, 11, 0.95)',
          backdropFilter: 'blur(8px)',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: '600',
          color: '#0f0f1a',
          textAlign: 'center',
        }}
      >
        {pendingCount} change{pendingCount === 1 ? '' : 's'} waiting to sync
        {lastSyncError ? ` (${lastSyncError})` : ''}
      </div>
    );
  }

  if (wasOffline) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'rgba(16, 185, 129, 0.95)',
          backdropFilter: 'blur(8px)',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: '600',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        Back online — all changes synced
      </div>
    );
  }

  return null;
}
