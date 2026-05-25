/**
 * OfflineBanner — shows when the user is offline
 * Sits at the top of the app, doesn't block content
 */

import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus();

  if (isOnline && !wasOffline) return null;

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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: '600',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" style={{ stroke: '#fff', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Back online — syncing data...
      </div>
    );
  }

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
      <svg viewBox="0 0 24 24" width="16" height="16" style={{ stroke: '#0f0f1a', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
      You&apos;re offline — showing cached data
    </div>
  );
}
