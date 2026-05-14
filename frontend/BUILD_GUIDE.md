# JKHive Native App — Build Guide

This guide walks you through building **JKHive** as native iOS and Android
apps from your Mac, after the Capacitor scaffolding is committed to the repo.

The web app is unchanged — staff who'd rather use Safari/Chrome still can.
Native builds add reliable push, biometric login, native camera, and an
App Store / Play Store presence.

---

## App identity (locked)

| Field          | Value                       |
|----------------|-----------------------------|
| App ID         | `com.jpteckltd.jkhive`      |
| Display name   | JKHive                      |
| Distribution   | TestFlight (iOS) + Internal Testing (Android) — private |
| Stack          | React 18 + Vite + Capacitor 7 |
| Builds         | iOS 13+, Android 7.0 (API 24)+ |

---

## Phase 2 — First local build (~1 hour on your Mac)

You only need to do this once per machine. Estimated time **45-60 min**, most
of which is Xcode and Android Studio downloading components.

### One-time prerequisites

1. **Install Node 22+**
   ```bash
   # via nvm
   nvm install 22 && nvm use 22
   ```
2. **Install Xcode** from the Mac App Store (~15 GB, free). Open it once,
   accept the licence, let it finish installing components.
3. **Install Xcode command-line tools**
   ```bash
   xcode-select --install
   ```
4. **Install CocoaPods** (used by the iOS shell to fetch native deps)
   ```bash
   sudo gem install cocoapods
   ```
5. **Install Android Studio** from https://developer.android.com/studio
   (~1 GB). Open it, follow "Standard" setup wizard. It installs the
   Android SDK in `~/Library/Android/sdk`.
6. **Java 17** (Android Studio ships with one; verify with `java -version`).

### Clone & install

```bash
git clone <your repo url> jollys-kafe
cd jollys-kafe/frontend
yarn install
```

### Add the native projects (one-time)

```bash
# Creates /frontend/ios/ — open in Xcode later
yarn cap:add:ios

# Creates /frontend/android/ — open in Android Studio later
yarn cap:add:android
```

Commit these generated folders to your repo so future builds reuse them.

### Build the web bundle + sync to native

```bash
yarn cap:sync
```

This compiles your React app into `/frontend/build/` and copies it into
both `/ios/App/App/public/` and `/android/app/src/main/assets/public/`.
Run `cap:sync` whenever you change JS/JSX.

### Open in Xcode (iOS)

```bash
yarn cap:build:ios     # builds + opens Xcode
```

In Xcode:

1. Click the JKHive project in the left sidebar → **Signing & Capabilities**.
2. Tick **"Automatically manage signing"** and pick a Team (your Apple
   Developer account, when you've set it up). For first run without an
   account, pick **"Personal Team"** — runs on your own iPhone only, no
   distribution.
3. Plug in your iPhone via USB (or pick a simulator).
4. Hit the **▶ Run** button (top left, ⌘R). First build is ~2-3 min.

JKHive should boot, show the splash screen (burgundy with JKHive logo),
and land on the login page.

### Open in Android Studio

```bash
yarn cap:build:android
```

In Android Studio:

1. Wait for Gradle sync (first time can be 5-10 min).
2. Pick **app** from the device dropdown at the top → choose an emulator
   or your USB-connected phone (USB debugging must be on in Developer
   Options).
3. Hit the green **▶ Run** button.

### Smoke test on device

Sign in with `admin@jollys.com` / `Admin123!`. You should see:

- ✅ App icon on home screen ("JKHive")
- ✅ Splash screen
- ✅ JKHive routes only (no homepage / menu / customer pages)
- ✅ Status bar respects the theme

---

## Phase 3 — Apple Developer + Google Play (do these in parallel)

### Apple Developer Program ($99/yr · 1-2 days verification)

1. Go to https://developer.apple.com/programs/enroll
2. Sign in with your Apple ID. Choose **Organization** (not Individual)
   — this is what lets you ship to App Store under "JPTECK Ltd".
3. **D-U-N-S number** — required. Apple provides one free during signup
   (takes 24 hours). If you already have one for Companies House, even
   better.
4. Pay $99. Apple emails you when your account is active.

### Google Play Console ($25 one-time · instant)

1. Go to https://play.google.com/console/signup
2. Sign in with a Google account. Choose **Organization**.
3. Pay $25. Account active immediately.

### TestFlight setup (after Apple Developer is active)

1. Open https://appstoreconnect.apple.com → **My Apps** → **+** → **New App**.
2. Bundle ID = `com.jpteckltd.jkhive`. Platform = iOS. Name = JKHive.
3. Under your new app: **TestFlight** tab → **Internal Testing** group.
4. Invite testers by email (max 100, no review needed).

### Google Play Internal Testing setup

1. Open https://play.google.com/console → **Create app** → JKHive.
2. **Testing** → **Internal testing** → create release.
3. Add tester email addresses (max 100, instant).

---

## Phase 4 — Push notification credentials

Provide me with the following values (or commit them to a secrets manager)
and I'll wire the backend dispatcher:

### iOS (APNs)
1. https://developer.apple.com/account → **Keys** → **+** → **Apple Push
   Notifications service (APNs)**.
2. Download the `.p8` file (only downloadable once — keep it safe).
3. Note the **Key ID** (10 chars) and **Team ID** (10 chars, visible in
   Membership page).
4. Send me: the `.p8` file (or paste the contents), Key ID, Team ID.

### Android (FCM)
1. https://console.firebase.google.com → **Add project** → "JKHive".
2. **Add Android app** → bundle = `com.jpteckltd.jkhive` → download
   `google-services.json` → drop it in `/frontend/android/app/`.
3. **Project settings** → **Service accounts** → **Generate new private
   key** → download JSON → send me (or paste the contents).

---

## Phase 5 — Upload your first build to TestFlight

### iOS

1. In Xcode: top menu **Product** → **Archive** (your real device target,
   not a simulator).
2. Once done, the Organizer window opens. Click **Distribute App** →
   **App Store Connect** → **Upload**.
3. Xcode signs + uploads. Takes ~5 min.
4. Wait ~15-30 min for App Store Connect to process the binary.
5. In App Store Connect → TestFlight → your build appears → click it →
   tick "Encryption: no" → save.
6. Testers get an email; they install **TestFlight** from the App Store
   and tap your invite link.

### Android

1. In Android Studio: **Build** → **Generate Signed Bundle** → **Android
   App Bundle (.aab)**.
2. First time: create a new keystore. **Keep this `.jks` file forever** —
   if you lose it you cannot publish updates to the same app.
3. Upload the `.aab` to Play Console → Internal testing → Create new release.
4. Add release notes, save & publish to track.
5. Share the opt-in link with your testers.

---

## Updating the app

After a code change to JKHive:

```bash
yarn cap:sync
# For iOS: open Xcode → ⌘R to run locally, or Product→Archive to upload
# For Android: in Android Studio, ▶ Run, or Build → Generate Signed Bundle
```

Web app updates ship instantly via your normal deploy. Native updates need
a TestFlight / Internal Testing upload — usually ~30 min including processing.

---

## Common gotchas

- **"Pod install failed"** on iOS first build: run `cd ios/App && pod install --repo-update` once.
- **"License must be accepted"** for Android: `cd android && ./gradlew :app:dependencies` accepts.
- **App icons** are wired in `/frontend/ios/App/App/Assets.xcassets/AppIcon.appiconset/` and `/frontend/android/app/src/main/res/mipmap-*/`. We can regenerate them from your logo via `@capacitor/assets` — let me know when you've placed `/frontend/resources/icon.png` (1024×1024).
- **Splash screen colour**: change `backgroundColor` in `/frontend/capacitor.config.ts` and re-run `yarn cap:sync`.
- **Native plugins missing**: every time you add a new plugin (e.g. barcode scanner), run `yarn cap:sync` then re-open Xcode.

---

## What's already wired up in code

All of these work the moment you boot the native shell. No additional setup
needed beyond the build steps above.

- ✅ Capacitor 7 (`@capacitor/core`, `@capacitor/ios`, `@capacitor/android`)
- ✅ Splash screen (1.2s burgundy → fade to app)
- ✅ Status bar styling
- ✅ Push Notifications plugin (`@capacitor/push-notifications`)
- ✅ Local Notifications plugin (for cooling-time alarms)
- ✅ Camera plugin (for delivery / cooked-temp evidence photos)
- ✅ Haptics (success buzz on Accept / Mark Ready)
- ✅ Preferences (secure key/value store backed by Keychain / Keystore)
- ✅ Native back-button handling on Android
- ✅ Routes locked to /jkhive — customer-facing pages hidden in native
- ✅ Native push token registration (POST `/api/push/native-register`)

Helpers live in `/frontend/src/lib/native.ts`. Every helper is safe to call
in the browser (no-ops or web fallback) — the same code runs on web, iOS,
and Android.

---

## Quick reference

| Task                          | Command                                |
|-------------------------------|----------------------------------------|
| Add ios project (1st time)    | `yarn cap:add:ios`                     |
| Add android project (1st time)| `yarn cap:add:android`                 |
| Build web + sync both         | `yarn cap:sync`                        |
| Open in Xcode                 | `yarn cap:build:ios`                   |
| Open in Android Studio        | `yarn cap:build:android`               |
| Live-reload during dev        | `yarn start` + `cap run ios --livereload --external` |

Questions on any step? Ping me. Phase 1 work is committed — Phase 4 (push)
is blocked on the APNs key + FCM JSON from steps above.
