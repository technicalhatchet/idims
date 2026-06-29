/**
 * Web Push helpers for PWA (techboard + staff).
 * Requires VAPID keys on the API and next-pwa service worker in production builds.
 */

const PUSH_SUBSCRIBED_KEY = 'idims_push_subscribed';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function isWebPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Subscribe this browser to push (prompts once). Idempotent. */
export async function ensureWebPushSubscription(apiClient) {
  if (!isWebPushSupported()) return false;

  try {
    const { publicKey } = await apiClient('push/vapid-public-key');
    if (!publicKey) return false;

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;
    } else if (Notification.permission !== 'granted') {
      return false;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = sub.toJSON();
    await apiClient('push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    });
    localStorage.setItem(PUSH_SUBSCRIBED_KEY, '1');
    return true;
  } catch (err) {
    console.warn('Web push subscribe failed:', err);
    return false;
  }
}

/** One-shot GPS vs cached job coords — cheap hybrid deploy nudge. */
export function reportDeployProximity(apiClient, appointmentId) {
  if (!appointmentId || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await apiClient('push/proximity-check', {
            method: 'POST',
            body: JSON.stringify({
              appointment_id: appointmentId,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
          resolve(result);
        } catch {
          resolve(null);
        }
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

/** Client heartbeat when Celery beat is unavailable. */
export function processDeployReminders(apiClient) {
  return apiClient('push/process-reminders', { method: 'POST' }).catch(() => null);
}
