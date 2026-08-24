/**
 * "Add to Home Screen" prompt banner for /jkhive.
 *
 * Two paths:
 *  • Chrome / Edge / Samsung Internet fire `beforeinstallprompt` — we
 *    intercept, hold onto the event, and show a bespoke prompt with a
 *    real install button (`prompt.prompt()` → `userChoice`).
 *  • iOS Safari never fires that event but supports install via the
 *    native share sheet → "Add to Home Screen". We detect iOS Safari
 *    and show instructions instead.
 *
 * The banner auto-hides for 30 days on dismiss and permanently once
 * the app is already running as a standalone PWA. State kept in
 * localStorage so it survives reloads without any backend calls.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Download, X, Share2 } from 'lucide-react';

const DISMISS_KEY = 'jkhive_a2hs_dismissed_until';
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const isStandalone = () =>
  (typeof window !== 'undefined') && (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari legacy flag
    window.navigator?.standalone === true
  );

const isIosSafari = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPhone|iPad|iPod/.test(ua);
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit;
};

const isDismissed = () => {
  try {
    const until = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    return until > Date.now();
  } catch { return false; }
};

const dismissFor30Days = () => {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS)); } catch { /* noop */ }
};

const A2hsPrompt = () => {
  const [deferred, setDeferred] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (isDismissed()) return;

    const handler = (e) => {
      // Chrome/Edge — grab the event so we can trigger it later.
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Detect installed → hide immediately (fires when browser installs).
    const onInstalled = () => setVisible(false);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari path — no beforeinstallprompt fires, so trigger the
    // hint banner after a short delay so we're not competing with the
    // page loading. Skip if already dismissed.
    let iosTimer;
    if (isIosSafari()) {
      iosTimer = setTimeout(() => { setShowIosHint(true); setVisible(true); }, 1500);
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch { /* ignore */ }
    setDeferred(null);
    setVisible(false);
  }, [deferred]);

  const dismiss = () => {
    dismissFor30Days();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      data-testid="jkhive-a2hs-banner"
      role="dialog"
      aria-label="Add JKHive to your home screen"
      style={{
        position: 'fixed', left: 12, right: 12, bottom: 84,
        maxWidth: 480, margin: '0 auto', zIndex: 9998,
        background: '#1D1D1F', color: '#FFFFFF',
        borderRadius: 16, padding: '12px 14px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 10, background: '#FFFFFF',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        {showIosHint ? <Share2 size={18} color="#0A84C9" /> : <Download size={18} color="#0A84C9" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>
          Install JKHive on your Home Screen
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#C7C7CC', lineHeight: 1.3 }}>
          {showIosHint
            ? <>Tap <strong style={{ color: '#FFFFFF' }}>Share</strong> → <strong style={{ color: '#FFFFFF' }}>Add to Home Screen</strong>.</>
            : 'One-tap access from your home screen — works offline too.'}
        </p>
      </div>
      {!showIosHint && (
        <button
          data-testid="jkhive-a2hs-install"
          onClick={install}
          style={{
            background: '#34C759', color: '#FFFFFF', border: 0,
            padding: '8px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >Install</button>
      )}
      <button
        data-testid="jkhive-a2hs-dismiss"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent', color: '#C7C7CC', border: 0,
          width: 28, height: 28, borderRadius: 999, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      ><X size={16} /></button>
    </div>
  );
};

export default A2hsPrompt;
