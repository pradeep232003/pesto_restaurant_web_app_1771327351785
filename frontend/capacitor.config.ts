import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jpteckltd.jkhive',
  appName: 'JKHive',
  webDir: 'build',
  // Reuses your existing /build output from `yarn build`.
  // The native shell loads the compiled SPA from this folder.

  // Background: production server. When you flip to a live env later, change
  // this in the JS (REACT_APP_BACKEND_URL) — Capacitor doesn't need it.
  backgroundColor: '#FFFFFF',

  ios: {
    // App Store category: Business
    contentInset: 'always', // respect notch / dynamic island
    backgroundColor: '#FFFFFF',
    scheme: 'JKHive',
  },
  android: {
    backgroundColor: '#FFFFFF',
    allowMixedContent: false,
    captureInput: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#8B1E3F',     // Jolly's brand burgundy
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FFFFFF',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#8B1E3F',
      sound: 'beep.wav',
    },
  },
};

export default config;
