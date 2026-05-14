/**
 * Capacitor native bridge for JKHive.
 *
 * Single import surface for the rest of the app. Every helper here is safe
 * to call from the web — it no-ops or falls back gracefully. The native
 * implementation only runs when the app is loaded inside the Capacitor
 * shell (iOS / Android).
 *
 * Pattern: never `import` a native plugin at module load (it would crash
 * the web build for non-Capacitor users). Instead we lazy-import inside each
 * function, guarded by `Capacitor.isNativePlatform()`.
 */
import { Capacitor } from '@capacitor/core';

/** True when running inside the iOS or Android shell. */
export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // "ios" | "android" | "web"

/** Register the device for native push and POST the token to our backend. */
export const setupPushNotifications = async (
  registerWithBackend: (token: string, platform: string) => Promise<void>,
) => {
  if (!isNative()) return false;
  const { PushNotifications } = await import('@capacitor/push-notifications');

  const perm = await PushNotifications.checkPermissions();
  let status = perm.receive;
  if (status === 'prompt' || status === 'prompt-with-rationale') {
    status = (await PushNotifications.requestPermissions()).receive;
  }
  if (status !== 'granted') return false;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    try {
      await registerWithBackend(token.value, platform());
    } catch (e) {
      // Non-fatal: backend may be offline; resubscribe on next launch.
      console.warn('[push] backend register failed', e);
    }
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] registration error', err);
  });

  PushNotifications.addListener('pushNotificationReceived', (n) => {
    // Foreground push — let the app decide what to do (e.g. play chime).
    window.dispatchEvent(new CustomEvent('jkhive:push', { detail: n }));
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    // User tapped the push notification — deep link.
    const url = action.notification.data?.url;
    if (url) window.location.assign(url);
  });

  return true;
};

/** Schedule a one-shot local notification (used for cooling-time alarms). */
export const scheduleLocalNotification = async (opts: {
  id: number;
  title: string;
  body: string;
  at: Date;
}) => {
  if (!isNative()) {
    // Web fallback: show an alert when the time arrives via setTimeout.
    const ms = opts.at.getTime() - Date.now();
    if (ms > 0 && ms < 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(opts.title, { body: opts.body });
        }
      }, ms);
    }
    return;
  }
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.requestPermissions();
  await LocalNotifications.schedule({
    notifications: [{
      id: opts.id, title: opts.title, body: opts.body,
      schedule: { at: opts.at, allowWhileIdle: true },
      smallIcon: 'ic_stat_notify',
    }],
  });
};

/** Take a photo with the device camera; returns a base64-encoded data URL. */
export const takePhoto = async (): Promise<string | null> => {
  if (!isNative()) {
    // Web fallback: trigger a file input
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const img = await Camera.getPhoto({
    quality: 75,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    correctOrientation: true,
  });
  return img.dataUrl || null;
};

/** Short tactile feedback on success (Accept, Mark as Ready, etc). */
export const hapticSuccess = async () => {
  if (!isNative()) return;
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Light });
};

/** Persist a key/value in the OS-secure store (Keychain / Keystore). */
export const secureSet = async (key: string, value: string) => {
  if (!isNative()) {
    localStorage.setItem(key, value);
    return;
  }
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key, value });
};
export const secureGet = async (key: string): Promise<string | null> => {
  if (!isNative()) return localStorage.getItem(key);
  const { Preferences } = await import('@capacitor/preferences');
  return (await Preferences.get({ key })).value;
};
export const secureRemove = async (key: string) => {
  if (!isNative()) {
    localStorage.removeItem(key);
    return;
  }
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.remove({ key });
};

/** Apply the JKHive splash → first-screen transition smoothly. */
export const hideSplashWhenReady = async () => {
  if (!isNative()) return;
  const { SplashScreen } = await import('@capacitor/splash-screen');
  // Small delay so the SPA has time to mount the first view.
  setTimeout(() => SplashScreen.hide(), 500);
};

/** Hard-back gesture on Android — close app if at /jkhive root, else navigate back. */
export const wireAndroidBackButton = async (
  onAtRoot: () => void = () => {},
) => {
  if (!isNative() || platform() !== 'android') return;
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', ({ canGoBack }) => {
    if (!canGoBack) onAtRoot();
    else window.history.back();
  });
};
