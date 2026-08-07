# Aurah 360 — Patient Mobile App

React Native (bare CLI, **JavaScript**, Metro bundler) — the patient-facing companion to
Aurah 360 ClinicOS. Scaffolded with the real `@react-native-community/cli` template (React
Native 0.86), converted from the default TypeScript template to plain JavaScript per the
project's stack decision. `npm install` completed against the real npm registry and the app
compiles cleanly through the actual Metro bundler for both Android and iOS entry points.

## Stack

- React Native 0.86 + React 19, JavaScript only (no TypeScript)
- Metro (default RN bundler)
- `@react-navigation` (native-stack + bottom-tabs)
- `axios` + `@react-native-async-storage/async-storage` for the API client and token storage
- `i18next` / `react-i18next` — English / Gujarati / Hindi, matching the staff web app's keys

## Screens implemented (§13.1 screen inventory)

| Screen | Notes |
|---|---|
| OTP onboarding | `OtpRequestScreen` → `OtpVerifyScreen`, wired to the real `/patient/otp-request` and `/patient/otp-login` endpoints |
| Home | Next appointment, outstanding balance, quick actions |
| Appointments | List, cancel; approval/pending states surfaced |
| Treatments | Treatment plan list (package progress) |
| Bills | Invoices, paid/due badge — no payment gateway (MVP scope) |
| Documents | Only documents explicitly released to the patient (`patientVisibility`) |
| Notifications | Inbox with mark-as-read |
| Offers | Offer board, localized title/description |
| Profile | Language switcher, privacy/data-request entry point, logout |

## Running it for real

This app was generated with the RN CLI and installs real dependencies, but this sandbox has
no Android SDK / Xcode / emulator to actually launch it. On a machine with the standard RN
environment set up (see the [React Native environment setup guide](https://reactnative.dev/docs/set-up-your-environment)):

```bash
cd mobile
npm install
npm run android   # or: npm run ios (macOS only)
```

## Backend connection

`src/api/client.js` points at `http://10.0.2.2:5000/api/v1/patient` — the Android emulator's
alias for the host machine's `localhost:5000`. For a physical device, iOS simulator, or a
deployed API, change `API_BASE_URL` to the real host.

## Testing the OTP flow without a real SMS provider

The backend's `POST /patient/otp-request` returns a `devCode` field whenever
`NODE_ENV !== production` — the app auto-fills it on `OtpVerifyScreen` so the whole login flow
is testable end-to-end without a live SMS vendor. This field is never present in production.

## What's real and working vs. what's next

- **Real and working**: OTP auth flow (verified end-to-end against the live backend — see
  `backend/src/scripts/smoke-otp-login.js`), navigation, i18n, all list screens fetching real
  API data, token refresh interceptor. The whole app has been bundled successfully through the
  real Metro bundler for both Android and iOS entry points.
- **Not yet built**: appointment booking form (only cancel is wired), reschedule UI, dependents
  switching, biometric/app-lock, push notifications (FCM/APNs), offline caching, and the actual
  Android/iOS release signing config — those are next steps once a device/emulator toolchain is
  available to iterate against.
