# Bug log — gastosai-mobile

Every bug whose fault is in this repository, in the order it was found. Linear holds the work;
this file is the record of what went wrong, so a pattern stays visible after the issues close.

**Log a bug where its cause is, not where it was seen.** A bug spotted in the web app whose fault
is in the API goes in the backend's log, with "Found via" saying where it showed up. A bug with
faults in two repositories gets a row in each.

**Add a row when a bug is found**, even one fixed on the spot. Newest at the bottom. When the fix
merges, set **Status** to the PR that fixed it. A bug fixed before it was ever filed gets the
fixing commit or PR in place of an issue.

This is the full list. [`lessons.md`](lessons.md) is the short one: the bugs whose lesson is worth
reading before changing that area.

| Column | Contents |
|---|---|
| Found | Date, `YYYY-MM-DD` |
| Found via | Where it showed up: a local run, a review, CI, a test suite |
| Symptom | What a user or a run actually saw |
| Cause | Where the fault is, if known |
| Issue | The Linear issue, linked |
| Status | `open`, `fixed in <PR or commit>`, or `won't fix: <why>` |

## Product

| Found | Found via | Symptom | Cause | Issue | Status |
|---|---|---|---|---|---|
| 2026-10-13 | Building TEN-437 | Over-budget lines on Budgets show a green dot on the percentage pill | `budgets.tsx` `toneColor` looks for `"OVER"`/`"EXCEEDED"`, while the server sends `"OVER_BUDGET"` | [TEN-447](https://linear.app/tengdev/issue/TEN-447) (3rd criterion) | open |
| 2026-10-13 | Review of [#59](https://github.com/TetengDev/gastosai-mobile/pull/59) | A celebration could be lost for good, or play twice | `Celebrate` marked the event seen before checking it was still mounted, and two mounts at once could both play it | [TEN-437](https://linear.app/tengdev/issue/TEN-437) | fixed in [#59](https://github.com/TetengDev/gastosai-mobile/pull/59) (`acad815`) |
| 2026-10-13 | Review of [#59](https://github.com/TetengDev/gastosai-mobile/pull/59) | A celebration one account has seen is skipped for the next account on the same device | Seen flags under `ga.celebrate.<event>` are not scoped to the user | [TEN-454](https://linear.app/tengdev/issue/TEN-454) | open |
| 2026-10-13 | Review of [#59](https://github.com/TetengDev/gastosai-mobile/pull/59) | At or below 100%, the meter's over tone looks the same as warning | Both tones use the same fill until the overflow segment appears | [TEN-455](https://linear.app/tengdev/issue/TEN-455) | open |

## Tests and tooling

| Found | Found via | Symptom | Cause | Issue | Status |
|---|---|---|---|---|---|
| 2026-10-13 | Maestro, on the simulator | `edit-delete` fails at `"177" is visible`, and each failed run leaves a ₱177 expense behind | The flow predates integer centavos, so the field now reads `177.00`; it does not clean up after a failure | [TEN-450](https://linear.app/tengdev/issue/TEN-450) | open |
| 2026-10-13 | Running the app locally | `expo start --ios` fails with "Can't determine id of Simulator app" | Expo CLI's simulator lookup on this machine | — | worked around: `CI=1 npx expo start`, then `xcrun simctl openurl booted exp://127.0.0.1:8081` |
