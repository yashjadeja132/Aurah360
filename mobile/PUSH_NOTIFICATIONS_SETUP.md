# Push notifications — setup guide (not implemented yet)

## What exists today vs. what's missing

The app already has a **real, working, in-app notification inbox**:

- `src/screens/NotificationsScreen.js` fetches the list from `GET /notifications` via
  `patientApi.notifications()` and lets the patient mark items read (`POST
  /notifications/:id/read`).
- `src/context/NotificationsBadgeContext.js` polls `GET /notifications/unread-count` via
  `patientApi.unreadCount()` every 60 seconds (and on app-foreground / screen-focus) and
  exposes `unreadCount`, which `src/navigation/MainTabs.js` renders as a small red badge on
  the "More" tab (`tabBarBadge`, supported natively by `@react-navigation/bottom-tabs` v7).

**What is NOT implemented, and cannot be added in this pass:** OS-level push notifications —
a notification appearing on the Android/iOS lock screen or notification tray while the app is
backgrounded or fully closed. That requires:

1. A real Firebase project (Firebase Cloud Messaging is effectively the only practical option
   for Android; APNs directly is possible for iOS but FCM can wrap both). Creating a Firebase
   project needs a Google account and console access that this session does not have.
2. Native Android/iOS project changes and a full rebuild — adding
   `@react-native-firebase/app` + `@react-native-firebase/messaging` (or `notifee` as a
   lighter-weight alternative for local/scheduled notifications plus FCM data messages)
   requires `pod install` / Gradle sync and a fresh native build. That's out of scope here
   because a native rebuild for this app is already running elsewhere against the only
   available device, and this pass is restricted to pure-JS, hot-reloadable changes.

This document is the handoff: exactly what a developer with Firebase access needs to do next.

## Step-by-step for the next developer

### 1. Create the Firebase project

- Go to the [Firebase console](https://console.firebase.google.com/), create a new project (or
  reuse an existing org project), and add two apps to it:
  - **Android app** — package name must match `android/app/build.gradle`'s
    `applicationId` (check `mobile/android/app/build.gradle`).
  - **iOS app** — bundle ID must match the one configured in Xcode
    (`mobile/ios/*.xcodeproj`).

### 2. Add native config files

- Android: download `google-services.json` from the Firebase console and place it at
  `mobile/android/app/google-services.json`.
- iOS: download `GoogleService-Info.plist` and add it to the Xcode project (drag into
  `mobile/ios/<AppName>/`, make sure "Copy items if needed" is checked and it's added to the
  main app target).
- Android also needs the Google Services Gradle plugin registered in
  `mobile/android/build.gradle` (project-level) and `mobile/android/app/build.gradle`
  (module-level) — see the `@react-native-firebase/app` docs for the exact plugin lines, since
  these vary by Firebase SDK/Gradle plugin version.

### 3. Install the JS packages (will require a native rebuild)

```
npm install @react-native-firebase/app @react-native-firebase/messaging
```

(Alternative: `notifee` + a bare FCM/APNs client if you want more control over how local
notifications are displayed, e.g. custom sounds/actions — `notifee` still needs a way to
*receive* push, so it's usually paired with `@react-native-firebase/messaging` anyway rather
than replacing it.)

After adding either package you must rebuild the native apps — `cd android && ./gradlew clean`
then a fresh `npx react-native run-android`, and for iOS `cd ios && pod install` then rebuild
in Xcode. A JS-only Metro reload is not enough because these packages link native modules.

### 4. Request notification permission at runtime

Android 13+ (API 33+) and iOS both require explicit runtime permission. With
`@react-native-firebase/messaging`:

```js
import messaging from '@react-native-firebase/messaging';

async function requestNotificationPermission() {
  const authStatus = await messaging().requestPermission();
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}
```

Call this after login (once the patient is authenticated), not on cold start before they've
even signed in — asking for a permission the app can't yet act on is bad UX and hurts opt-in
rates.

### 5. Register the device token and send it to the backend

```js
const token = await messaging().getToken();
// POST this to the backend (see "Backend TODO" below).
await messaging().onTokenRefresh((newToken) => {
  // Re-POST whenever the token rotates.
});
```

### 6. Handle incoming messages

- **Foreground**: `messaging().onMessage(async (remoteMessage) => { ... })` — FCM does not
  auto-display a system notification while the app is foregrounded; you'd show your own UI
  (e.g. a toast) or rely on the in-app inbox that already exists.
- **Background/quit**: `messaging().setBackgroundMessageHandler(...)` (register this in
  `index.js`, outside any component). For a *notification* payload (as opposed to a silent
  *data* payload), FCM shows the OS notification automatically when the app is backgrounded or
  killed — no extra display code needed on Android; iOS needs the APNs entitlement configured
  correctly in Xcode (Push Notifications capability + Background Modes → Remote notifications).
- **Tap-to-open**: `messaging().onNotificationOpenedApp(...)` and
  `messaging().getInitialNotification()` to route the patient to the relevant screen (e.g.
  `NotificationsScreen` or a specific appointment) when they tap a push.

### 7. Backend TODO (not built — flagging, not building, per this task's scope)

The mobile app has nothing to POST a device token *to* yet. The backend needs:

- A new endpoint, e.g. `POST /api/v1/patient/devices` (or similar), accepting
  `{ token, platform }` from an authenticated patient session, upserting it against the
  patient's record (a patient may have multiple devices).
- A way to invalidate/remove a token on logout or when FCM reports it as invalid
  (`messaging/registration-token-not-registered` errors on send).
- Server-side integration with the Firebase Admin SDK (or a raw FCM HTTP v1 call) to actually
  send push messages when the backend wants to notify a patient (e.g. appointment reminders,
  new document uploaded) — right now the backend only writes to the `notifications` table that
  the in-app inbox reads from; sending a push is a separate, additional call.

None of the backend work above has been built in this pass — `backend/` was intentionally left
untouched, per this task's scope.

## Summary

| Piece | Status |
|---|---|
| In-app notification inbox (list + mark read) | Done, pre-existing |
| Unread-count badge on the "More" tab | Done, this pass — pure JS, no new deps |
| OS-level push (lock screen / tray notification) | **Not implemented** — needs Firebase project + native rebuild (this doc) |
| Backend device-token endpoint + FCM send integration | **Not implemented** — backend TODO, not built |
