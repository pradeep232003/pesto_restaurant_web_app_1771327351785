import React, { useEffect } from "react";
import Routes from "./Routes";
import { AuthProvider } from "./contexts/AuthContext";
import { isNative, hideSplashWhenReady, setupPushNotifications, wireAndroidBackButton } from "./lib/native";
import api from "./lib/api";

function App() {
  // Bootstrap Capacitor-only behaviour. All these helpers are no-ops in the
  // browser so the web build is unaffected.
  useEffect(() => {
    if (!isNative()) return;
    hideSplashWhenReady();
    wireAndroidBackButton(() => {
      // At /jkhive root with no history → quit on second back tap.
      // Capacitor App plugin can be used here if we want hard-exit.
    });
    setupPushNotifications(async (token, platform) => {
      // Reuses the existing web-push API surface. Backend route will be
      // extended in Phase 4 to accept native APNs/FCM tokens.
      await api.fetch('/api/push/native-register', {
        method: 'POST',
        body: JSON.stringify({ token, platform }),
      });
    });
  }, []);

  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}

export default App;
