/**
 * Web Push registration helper for JKHive.
 *
 * Registers /cooling-sw.js, requests Notification permission, subscribes to
 * push using the server's VAPID public key, and POSTs the subscription to
 * /api/push/subscribe so the backend can fire the cooling alarms even when
 * the PWA is closed / phone is asleep.
 *
 * iOS Safari note: Web Push only works on iOS 16.4+ AND only when the site
 * has been "Add to Home Screen"-ed (i.e. running as a standalone PWA).
 * `pushSupported()` reflects this.
 */
import api from '../../../lib/api';

const urlB64ToUint8Array = (b64) => {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
};

export const pushSupported = () => {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  if (!('PushManager' in window)) return false;
  if (!('Notification' in window)) return false;
  // iOS Safari: requires standalone PWA install.
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  if (isIOS) {
    const standalone = (window.navigator.standalone === true) ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (!standalone) return false;
  }
  return true;
};

let _registration = null;

export const registerSW = async () => {
  if (!('serviceWorker' in navigator)) return null;
  if (_registration) return _registration;
  try {
    _registration = await navigator.serviceWorker.register('/cooling-sw.js', { scope: '/' });
    return _registration;
  } catch (e) {
    console.warn('SW register failed', e);
    return null;
  }
};

export const ensurePushSubscribed = async (locationId) => {
  if (!pushSupported() || !locationId) return { ok: false, reason: 'unsupported' };
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
  if (Notification.permission !== 'granted') {
    const r = await Notification.requestPermission();
    if (r !== 'granted') return { ok: false, reason: 'denied' };
  }
  const reg = await registerSW();
  if (!reg) return { ok: false, reason: 'no-sw' };
  // Wait for the SW to be active so pushManager can subscribe.
  if (!reg.active) await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { public_key } = await api.pushVapidKey();
    if (!public_key) return { ok: false, reason: 'no-vapid' };
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(public_key),
    });
  }
  await api.pushSubscribe({
    location_id: locationId,
    subscription: sub.toJSON(),
    user_agent: navigator.userAgent || '',
  });
  return { ok: true, endpoint: sub.endpoint };
};

/** Listen once for SW→client messages so notification taps navigate inside the SPA. */
export const installSwMessageBridge = (navigateFn) => {
  if (!('serviceWorker' in navigator)) return () => {};
  const handler = (e) => {
    if (e.data && e.data.type === 'jkhive-nav' && e.data.url) {
      try { navigateFn(e.data.url); } catch (_) { window.location.href = e.data.url; }
    }
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
};
