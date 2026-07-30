# Builds — getting the app onto a device

`eas.json` is the build config. This file is the reasoning behind it, because `eas.json` is strict
JSON and cannot hold comments.

Until now there was no build pipeline at all — CI ran typecheck, tests and the drift guard, and that
was the whole story. Everything below `preview` is reachable **without any store account**.

---

## The profiles

| Profile | Produces | Needs a paid account? |
|---|---|---|
| `development` | dev-client build: iOS simulator app, Android APK | No |
| `preview` | release build: iOS simulator app, Android APK | No |
| `production` | iOS archive, Android App Bundle | **Yes** — Apple $99/yr, Play $25 once |

`preview` deliberately targets the **iOS simulator** rather than a device. A device build needs a
provisioning profile, which needs an Apple Developer membership; a simulator build needs neither and
still exercises the real native binary. That distinction matters more than it sounds — see below.

Android has no such split: a `preview` APK installs on any real phone straight from the EAS build
link, with no account and no fee. **For testing on actual hardware today, Android is the only route.**

## Why this exists at all: some things Expo Go cannot show you

Expo Go is not the app. It is a host that loads your JavaScript, and two things belong to the host:

- **The app icon.** The home-screen icon is Expo Go's own. `assets/icon.png` is never used until
  something builds a real binary.
- **The splash screen.** `expo-splash-screen` is a *config plugin* — it writes native launch assets
  at prebuild time. In Expo Go there is nothing to write to.

So the mark and splash added in v0.9.0 are invisible in every Maestro flow and every demo recording.
The only way to see them is a build from this file. That is the gap this closes.

## Running one

```bash
npx eas-cli@latest login          # a free Expo account; not an Apple/Google one
npx eas-cli@latest init           # writes extra.eas.projectId into app.json, once
npx eas-cli@latest build --profile preview --platform android   # APK, install via QR
npx eas-cli@latest build --profile preview --platform ios       # simulator .app
```

The free EAS tier queues builds and allows a limited number per month. To avoid the queue entirely,
`--local` builds on this machine instead — which for iOS additionally needs CocoaPods
(`brew install cocoapods`), not currently installed here.

## Checking the native assets without building

`npx expo prebuild --platform ios --no-install` generates `ios/` from `app.json` and processes the
icon and splash on the way. The generated `Images.xcassets` is enough to confirm the config is right
before spending a build. `ios/` and `android/` are gitignored — they are outputs, and this repo stays
on the managed workflow where `app.json` is the source of truth.

## Before `production` is worth running

None of this is blocking today, but a store submission needs all of it:

- A privacy policy at a public URL.
- A data-safety / privacy-nutrition declaration covering the receipt-photo path — the app sends a
  photograph to a server and an AI provider reads it, which is exactly what those forms ask about.
- Screenshots at the sizes each store demands.
- A decision on receipt scanning: `KNOWN-GAPS.md` §5 records it failing on the provider side
  (`401 missing_scope`). Shipping a store listing that advertises it while it is broken is worse than
  shipping without it.
