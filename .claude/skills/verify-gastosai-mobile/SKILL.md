---
name: verify-gastosai-mobile
description: Drive the real gastosai mobile app (Expo Go on a booted iOS simulator against the local API) with Maestro and capture proof that a change works. Use when asked to verify, demo, screenshot or prove mobile behavior end to end, before reporting a mobile change complete, when a PR needs runtime evidence rather than a green Jest suite, and when recording the demo video.
---

# Verify gastosai-mobile

The mobile app is React Native under Expo, run in **Expo Go** (`host.exp.Exponent`) on a booted iOS
simulator, served by Metro on `:8081`, talking to the Spring backend on the machine's **LAN**
address at `:8080`. This skill is how an agent taps that app the way a person does and comes back
with evidence.

It does not replace [`verification-discipline`](../verification-discipline/SKILL.md) — that one
governs *how you report*; this one governs *how you drive*. Read both before claiming a mobile
change works.

Two documents this skill sits on top of and does not duplicate: the flow-authoring rules in
[`../../../.maestro/README.md`](../../../.maestro/README.md) (selector conventions, iOS traps,
caption rules — read it before *editing* a flow) and the recipes in
[`features/`](features/README.md) (read `features/README.md` before driving anything).

## Launch

Four things have to be up, in this order. The first is the workspace's job; the rest are this
repo's.

```bash
python3 ../scripts/verify_local.py --up   # Postgres :5433 and the API :8080
npm start                                 # Metro on :8081 — plain, never --tunnel
```

Then, once per simulator, by hand: boot one iOS simulator, install Expo Go, and **open this project
in it once** so it appears under "Recently opened". Every flow taps that entry rather than a URL,
which is why nothing under `.maestro/` is machine-specific.

Ready means the doctor below passes **and** a `launch.yaml` run reaches the tab bar. The address the
app calls is not configured here: `src/api/client.ts` resolves it once at startup, taking the
loopback host out of `EXPO_PUBLIC_API_URL_LOCAL` and substituting the host Metro is served from —
the LAN IP. That is why Metro must be plain: `--tunnel` and USB debugging leave no LAN address to
substitute, and every flow then fails at its first assertion with "cannot reach the server".

Teardown:

```bash
python3 ../scripts/verify_local.py --down   # the API and the web dev server; Postgres stays up
```

Metro and the simulator are left running on purpose — a cold bundle is the single slowest thing in
this loop (see *Gotchas*). Stop Metro only when you started it for this run.

## Doctor

One read-only check, before driving anything and again whenever a flow fails in a way that does not
look like the app:

```bash
python3 .claude/skills/verify-gastosai-mobile/doctor.py
```

It taps nothing and installs nothing. Require every row:

1. `maestro` on `PATH` (2.7.0 here on 2026-09-24).
2. Exactly **one** booted iOS simulator — two makes Maestro's pick ambiguous.
3. Expo Go present on it (`host.exp.Exponent`), the `appId` every flow names.
4. Metro answering `:8081` on **both** loopback and the LAN address.
5. The API answering `:8080` on **both** — the app calls the LAN one, so a host firewall that
   allows only loopback passes a naive check and fails every flow.
6. The demo account signing in, so `launch.yaml` can re-authenticate when the stored JWT lapses.

It prints the simulator's udid. Keep it: ad-hoc Maestro commands need `--device <udid>`, because
Maestro counts its Web (chromium) platform as a second device and refuses with "Multiple devices
connected" without it. `maestro test` picks the simulator on its own; `maestro hierarchy` and
`maestro studio` do not.

**Never drive a simulator you did not confirm with this check.**

## Drive

The harness is Maestro, already wired to this app, with fourteen flows in `.maestro/`. Use them; do
not write a new driver.

```bash
maestro test .maestro/                      # the whole suite except flows tagged `manual`
maestro test .maestro/navigation.yaml       # one flow
maestro test .maestro/launch.yaml           # just get to a signed-in Home screen
maestro studio                              # interactive inspector (needs --device <udid>)
```

Useful flags, all verified on 2026-09-24:

| Flag | What it gives you |
|---|---|
| `--debug-output <dir>` | screenshots per step, `maestro.log`, `commands.json`, device logs — the text to read *before* any PNG |
| `--format HTML --output <file>` | a single shareable report |
| `--env GASTOSAI_EMAIL=… --env GASTOSAI_PASSWORD=…` | drive another account; defaults are the local demo account |
| `--device <udid>` | required for `hierarchy` and `studio`, not for `test` |

Every flow starts with `runFlow: launch.yaml`, which signs in only if the stored JWT has expired and
publishes values the rest of the flow uses: `output.thisMonth` / `prevMonth` / `nextMonth`,
`output.thisKey` / `prevKey` (API forms, computed in Asia/Manila) and `output.token`, a real bearer
token for the API calls flows make to compute their own expected figures.

Two flows are tagged `manual` and excluded from a directory run, each because the local loop cannot
meet its preconditions — naming the file still runs it:

- `offline.yaml` needs the backend **stopped**: `lsof -ti :8080 | xargs kill -9 && maestro test .maestro/offline.yaml`.
- `receipt.yaml` needs an API key whose scope permits image requests; today `POST /ai/vision`
  answers `401 missing_scope` (`KNOWN-GAPS.md` §5).

## Evidence

- **Per-run artifacts:** `--debug-output ~/.claude/gastosai-mobile-verify/<date>/<flow>-debug/`.
  Maestro writes `…/.maestro/tests/<timestamp>/<flow>/` with `commands.json` (every step and its
  status), `maestro.log`, `logs/device-simulator.log`, and one screenshot per step.
- **A shareable report:** `--format HTML --output ~/.claude/gastosai-mobile-verify/<date>/<flow>.html`.
- **The demo video:** `./scripts/record-demo.sh`, which films a `.maestro/demo/` flow and burns the
  `label: ">> …"` captions in from the run log's timings. Caption rules live in
  `.maestro/README.md`; do not hand-time captions.

Evidence lives **outside the repo**, under `~/.claude/gastosai-mobile-verify/<date>/`. Then attach
what a reviewer must see:

```bash
python3 ../scripts/attach_evidence.py TEN-129 ~/.claude/gastosai-mobile-verify/<date>/<file> \
    --caption "what the reviewer should look at" --pr <N> --repo gastosai-mobile
```

Proof standards for this app:

- **Drive the real user path.** A flow that reaches a screen by deep link, or that asserts an API
  response instead of what is rendered, proves something the user cannot see. Tap through the UI;
  the API calls in a flow exist only to compute what the screen *should* say.
- **Assert a figure the client cannot invent.** That is the whole design of these flows: `38.71%`
  from `/expenses/report/monthly-comparison`, a day total from `/expenses/report/daily`, a goal's
  `progressPercent` from the backend. A screen that computed its own numbers would still render
  something; it would not render these.
- **Capture the action and the resulting state.** `commands.json` gives you the step sequence with
  statuses — that is the action; the assertion after it is the state.
- **Read text before pixels.** `commands.json` and `maestro.log` are cheap; a simulator screenshot
  costs roughly (width x height) / 750 tokens and stays in context for every later turn. Open a PNG
  only when the log is genuinely inconclusive.
- **Never assert on an AI-generated description.** The parser rewrites what was typed, so
  `quick-add.yaml` asserts the amount, never the text.
- **Mocks only at a boundary production already isolates** — the AI provider. Never point the app at
  a fake API to make a mobile proof pass.

## Cleanup

- **Flows clean up after themselves.** `goals.yaml` deletes the goal it creates; `quick-add.yaml` and
  `edit-delete.yaml` remove their rows; `.maestro/demo/cleanup/` covers the demo flows. A run that
  dies mid-flow can leave a row behind — find it by the amount the flow used (177 for quick-add) on
  the Expenses tab, or over the API with the backend skill's `api.py`, and delete that one row.
- **Kill only what this run started.** Never `pkill -f node` or `-f expo`; Metro and the simulator
  are usually the user's own session. `verify_local.py --down` stops the API and the web dev server
  and nothing else.
- **Leave the simulator booted and Expo Go signed in.** The Keychain JWT is what lets `launch.yaml`
  skip the sign-in form; clearing it costs a slow re-login on every later flow. `launchApp` uses
  `clearState: false` for that reason — do not "fix" it.
- **Cleanup never touches evidence.** `~/.claude/gastosai-mobile-verify/<date>/` survives teardown.
  Maestro purges its own debug logs older than 14 days inside whatever `--debug-output` directory it
  is given, so do not point that at a directory holding proofs you intend to keep beyond two weeks.

## Isolation — read before running two of anything

There is **one** simulator, **one** Expo Go install, **one** database and **one** demo account.
Flows are not parallel-safe: two runs share the app's navigation state, the Keychain session, the
seeded rows and the backend's per-JVM rate-limit counters (public 10/min, writes 60/min).

So: **do not start a second Maestro run while one is in flight.** A second simulator is the real
answer (`--device <udid>` and a second Metro port), and that setup does not exist here; say so
rather than faking it.

## Gotchas

Ordered by how much time each one costs when it bites.

- **A cold bundle fails the run as a driver timeout, not as a slow app.** The first flow after a
  Metro restart produced
  `Maestro driver timed out during snapshot call with: Unable to perform work on main run loop, process main thread busy for 30.0s`
  after 6m20s on 2026-09-24. The fix is to warm the app first — `maestro test .maestro/launch.yaml`
  — and then run the real flow; the same flow passed in 25s that way.
- **Expo Go crashes, and Maestro tells you in the log rather than the summary.** Look for
  `Crash detection: crashFile=Expo Go-<timestamp>.ips` in `maestro.log`. After a crash the next flow
  fails at `launch.yaml`'s readiness assertion (`id: tab-home is visible`) on a simulator that looks
  fine; re-launch and re-run rather than debugging the flow.
- **Expo Go resumes a failed load.** Restarting Metro leaves it stuck on "There was a problem running
  the requested app", and `launchApp` alone does not clear it — `launch.yaml` taps "Go Home" first
  for exactly this.
- **`localhost` inside the simulator is the simulator.** Never hard-code an IP into a flow; the app
  resolves the address and every flow inherits it. A flow's own `http.get('http://localhost:8080/…')`
  runs on the *host*, where loopback is correct — that asymmetry is deliberate, not a bug to fix.
- **Nothing written down about months, dates or totals stays true.** Seeded data rolls forward, so
  flows compute their expectations from `launch.yaml`'s outputs and from the API. Four flows failed
  on 11 Aug 2026 asserting June and July against a correct app; do not reintroduce a literal.
- **The app refuses to step past the current month**, so `month-next` on today is a no-op and a
  future month is unreachable. `month.yaml` reaches an empty month by walking *back*.
- **`- back` is Android's hardware button and a no-op on iOS.** Navigate by tab id instead.
- **An amount can appear twice on one screen** and only one instance is pressable — target rows by
  test id (`expense-row-first`, `recent-row-0`, `goal-menu-N`), never by amount.
- **The `decimal-pad` keyboard covers Save** and has no return key; dismiss it via the form's
  `amount-done` accessory or the tap lands on a digit and silently changes the amount.
- **`eraseText` before `inputText`** in any field a re-run may have populated — `inputText` appends.
- **`maestro hierarchy` and `maestro studio` need `--device <udid>`**; without it they refuse with
  "Multiple devices connected", because the Web platform counts as a device.
