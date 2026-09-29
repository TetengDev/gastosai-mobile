# gastosai-mobile verification map

This directory is the maintained source for verifying the user-facing behavior of the gastosai
mobile app. Read this index before driving the app, then use the matching feature file as the recipe.

A proof that drives one convenient entry point is incomplete when the feature file lists others.

These files say **what to prove and from where**. The rules for *writing* a flow — selector
conventions, the iOS traps, caption rules for demo flows — live in
[`../../../../.maestro/README.md`](../../../../.maestro/README.md) and are not repeated here.

## Baseline preconditions

- API and Postgres up from the workspace: `python3 ../scripts/verify_local.py --up`.
- Metro up in this repo: `npm start` — plain, never `--tunnel`, or the app has no LAN address to
  reach the backend with.
- Exactly one iOS simulator booted, Expo Go installed on it, and this project opened in it once so
  it appears under "Recently opened".
- Re-check it read-only before driving:
  `python3 .claude/skills/verify-gastosai-mobile/doctor.py` — maestro, one booted simulator, Expo Go,
  Metro on loopback **and** LAN, the API on both, and a demo sign-in must all pass.
- Warm the app once with `maestro test .maestro/launch.yaml` before the first real flow. A cold
  bundle fails as a 30-second driver timeout, not as a slow app.
- The account is `demo@gastosai.dev` / `demo123`, overridable with `--env GASTOSAI_EMAIL=…`.
- Never drive a simulator this run did not confirm with the doctor check.
- One simulator, one session, one database. Do not start a second Maestro run while one is in flight.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Run flows with `maestro test .maestro/<flow>.yaml --debug-output <evidence-dir>/<flow>-debug`.
- Treat every command as literal. Keep quoted flags, ids and paths unchanged.
- Every flow begins with `runFlow: launch.yaml`; do not tap through sign-in by hand.
- Assert only on figures the client cannot invent, computed from `launch.yaml`'s outputs or fetched
  with `output.token`. Never write a month, a date or a total into a flow.
- Target rows and tabs by test id. Text is for assertions, ids are for taps.
- A flow cleans up what it creates. If a run dies mid-flow, delete the one row it left behind rather
  than resetting the account.
- Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the step sequence and the resulting state: `commands.json` for the actions,
  the assertion after them for the state.
- Read `commands.json` and `maestro.log` before opening any screenshot.
- Name the flow file and the entry point that produced each artifact, plus the app version and the
  build the API reported.
- Evidence lives in `~/.claude/gastosai-mobile-verify/<date>/`, outside the repo, and is attached
  with `python3 ../scripts/attach_evidence.py`. Note that Maestro purges its own debug logs older
  than 14 days inside whatever `--debug-output` directory it is given.
- Report an unreachable path with the attempted command and the unmet precondition — a `manual`-tagged
  flow, a simulator without a camera, a provider key without image scope. Do not report a skipped
  entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It
then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with Maestro` starts with `Preconditions:` and uses labeled bullets pairing each user
   action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

## Features

- [Session and navigation](./session-and-navigation.md) covers getting into the app, the conditional
  sign-in, and every tab plus Settings being one tap away.
- [Quick add](./quick-add.md) covers the AI capture path: free text, parse, confirm, saved, and the
  month total moving.
- [Expenses](./expenses.md) covers the month-scoped list, day sections with server-computed totals,
  editing and deleting a row.
- [Dashboard](./dashboard.md) covers Home's cards and the figures only the backend can produce.
- [Goals](./goals.md) covers creating a goal, contributing to it, the backend-computed percentage,
  and deleting it.

## Not yet mapped

Flows that exist but have no feature file, and surfaces with neither. A proof that touches them is
unguided; write the file rather than improvising twice.

- **Assistant chat** — `.maestro/chat.yaml` exists (143 lines, the longest flow), unmapped.
- **Month navigation** — `.maestro/month.yaml`, including the walk back to an empty month.
- **The More hub and Settings detail** — `.maestro/more.yaml`; only the one-tap reachability of
  Settings is covered here.
- **Offline behavior** — `.maestro/offline.yaml`, tagged `manual`: it needs the backend stopped.
- **Receipt scanning** — `.maestro/receipt.yaml`, tagged `manual`: `POST /ai/vision` answers
  `401 missing_scope` (`KNOWN-GAPS.md` §5). The camera path is a physical-device manual check; the
  simulator has no camera, so the flow automates the photo-library path.
- **Budgets and recurring bills** — reachable from the tab bar and the More hub, exercised only as
  navigation targets, with no flow of their own.
- **Registration, magic-link sign-in and plan/billing screens** — no flow.
- **The demo recordings** — `.maestro/demo/` and `./scripts/record-demo.sh` are a separate
  deliverable with their own caption rules; not a verification recipe.
