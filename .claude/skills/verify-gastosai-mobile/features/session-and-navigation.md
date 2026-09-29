# Session and navigation

Opening the project in Expo Go lands on a signed-in Home screen, or on the sign-in form when the
stored token has lapsed — and from there every destination in the app is one tap away: the five tabs
plus Settings behind the More hub. This is the feature every other recipe depends on, because every
flow starts by running it.

## Sub-features

- `launch` — Expo Go opens the project and the tab bar appears (`id: tab-home`), the app's only
  month-independent readiness signal.
- `resume-failed-load` — when Expo Go is stuck on "There was a problem running the requested app",
  "Go Home" returns to the launcher and the project loads from there.
- `sign-in-conditional` — the sign-in form is filled only when it is showing; an existing Keychain
  session is left untouched.
- `save-password-sheet` — iOS's "Save Password?" sheet is dismissed so it cannot swallow the next tap.
- `tabs` — Expenses, Budgets, Goals, Home and More each render their own screen after one tap.
- `settings-reachable` — Settings is one tap inside More, showing "signed in as …".
- `no-scrolling` — no navigation tap needs a scroll first. That is the assertion: before v0.4 every
  one did, which is what "unreachable navigation" looked like.

## How to get to it (user POV)

- Cold open from the simulator's home screen → Expo Go → the project under "Recently opened".
- Returning after the token expired → the sign-in form → Home.
- The tab bar, present on every authenticated screen.
- More → Settings, for account and sign-out.

## Driving it with Maestro

Preconditions: doctor passes; `E=~/.claude/gastosai-mobile-verify/$(date +%F)`; `mkdir -p $E`.

- **Get into the app (`launch`, `resume-failed-load`, `sign-in-conditional`, `save-password-sheet`)**
  — this is also the warm-up every session needs:

  ```bash
  maestro test .maestro/launch.yaml --debug-output $E/launch-debug
  ```

  Observable: `1/1 Flow Passed`. In `maestro.log` the sign-in block reads
  `Run flow when "Sign in to track your spending." is visible... SKIPPED` when a session already
  existed — that skip is the conditional working, not a gap. Verified on 2026-09-24.

  It also publishes, for every caller: `output.thisMonth` / `prevMonth` / `nextMonth`,
  `output.thisKey` / `prevKey`, and `output.token`.

- **Reach every destination (`tabs`, `settings-reachable`, `no-scrolling`)**:

  ```bash
  maestro test .maestro/navigation.yaml --debug-output $E/navigation-debug \
      --format HTML --output $E/navigation.html
  ```

  Observable: `1/1 Flow Passed in 25s` (verified 2026-09-24), with these assertions in order —
  Expenses shows `Search this month`, Budgets `.*safe to spend.*`, Goals `id: goals-screen`, Home
  `.*spent this month.*`, More `.*recurring.*bills and subscriptions.*` (via `extendedWaitUntil`,
  because a tab mounts lazily on first visit), and Settings `.*signed in as.*`.

  There is not one `scrollUntilVisible` in the flow. If a change adds one, the navigation regressed.

- **Drive another account** — the tier accounts are seeded too:

  ```bash
  maestro test .maestro/navigation.yaml \
      --env GASTOSAI_EMAIL=free@gastosai.dev --env GASTOSAI_PASSWORD=free123
  ```

  Observable: the same pass. Useful when the claim is about plan gating rather than layout.

## Gotchas

- **The first flow after a Metro restart is not a failing flow.** A cold bundle produced
  `Maestro driver timed out during snapshot call … main thread busy for 30.0s` after 6m20s on
  2026-09-24; the same flow passed in 25s once `launch.yaml` had warmed the app.
- **An Expo Go crash presents as `Assertion is false: id: tab-home is visible`.** Grep `maestro.log`
  for `Crash detection: crashFile=` before touching the flow — that line was present for the
  2026-09-24 failure, and the fix was to relaunch, not to edit anything.
- **Readiness is `id: tab-home`, not any text.** It used to be "spent this month", which is Home's
  sub-label *in the current month only* — so the probe silently depended on which tab and month the
  previous run left behind.
- **Expo Go's entry label is matched loosely (`.*gastosai.*`)** because the manifest's display name
  changed once and its cached entry can still show the old slug.
- **Tabs are targeted by test id.** React Navigation's labels are not reliably exposed as text nodes,
  and "Home" also collides with Expo Go's own launcher tab.
- **`launchApp` uses `clearState: false` deliberately.** Clearing state drops the Keychain session and
  costs a slow re-login in every later flow.
