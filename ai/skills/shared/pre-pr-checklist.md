# Pre-PR quality checklist — gastosai-mobile

Run this **before** pushing a branch or opening a pull request. Every item marked **Blocker**
must pass first.

Ported from the monorepo's `ai/skills/shared/pre-pr-checklist.md`. Adapted for the polyrepo and
for React Native: `CHANGELOG.md` was dropped in the split, commands are POSIX, and the contract
drift guard is new. **Section 6 (execution testing) is unchanged — it is the part that matters
most and the part most often skipped.**

---

## 1. Static analysis

```bash
npm run lint          # 0 errors
npm run typecheck     # tsc --noEmit
```

**Blocker:** any ESLint or type error.

---

## 2. Tests

```bash
npm run test:run
```

**Blocker:** any failing test.

`jest.globalSetup.js` forces `TZ=America/New_York` for the whole run. That is deliberate — the
`Asia/Manila` formatting guards pass by accident on a PHT machine otherwise. Never remove it to
make a test pass.

---

## 3. The pinned contract

This repo **consumes** `@tetengdev/gastosai-api-contract` at an exact version.

```bash
npm run gen:api
git status --porcelain src/api/generated    # must be empty
```

**Blocker:** a stale or uncommitted generated client. `--porcelain`, not `git diff` — an
untracked generated directory is invisible to `git diff`.

Never hand-edit `src/api/generated/`. `src/api/types.ts` may only alias generated shapes.

---

## 4. No secrets

```bash
git status --porcelain
git diff --staged
```

**Blocker:** any `.env`, key or token staged. A shipped binary is fully inspectable — the only
credential that may exist on device is the user's own JWT, in SecureStore, never `AsyncStorage`.

---

## 5. Version bump

**Blocker if application code changed.** Once per PR:

| Commit type | Bump |
|---|---|
| `fix:`, `perf:` | PATCH |
| `feat:` | MINOR |
| `!` or `BREAKING CHANGE:` | MAJOR |
| `docs:`, `chore:`, `ci:`, `refactor:`, `test:` | none |

Bump **both** `package.json` and `app.json` (`expo.version`) — they must not drift, and
`app.json` is what `X-App-Version` reports to the backend.

---

## 6. Mandatory execution testing — no exceptions

**Every change must actually be run before the PR opens.** A green test suite and a clean
type-check are not sufficient.

Minimum: **≥ 90% of touched paths exercised at runtime.**

| Change type | Minimum execution required |
|---|---|
| UI change | App launched in the simulator, affected screen rendered, flow exercised, **plus one edge case** |
| Theme / styling | Rendered in **both** light and dark (`xcrun simctl ui "iPhone 17 Pro" appearance light\|dark`) — this is what catches hardcoded colours |
| API call site | Triggered against a running backend; response confirmed rendering |
| Navigation | Route reached; back behaviour confirmed |
| Native dependency | Expo Go reloaded from scratch — a hot reload does not prove a native module linked |

**Blocker:** application code changed with no runtime evidence. State in the PR body what you ran
and what you observed.

### 6b. Send a demo recording

**When a feature is added or changed, record it and send it before the PR opens.**

```bash
./scripts/record-demo.sh <flow> "v0.x.y — what changed and what to look at"
```

The script records the simulator while a short flow in `.maestro/demo/` runs, then sends the video
to Telegram. Written evidence is a claim; a clip is something the reviewer can check without
setting up a simulator, which is the whole point.

- **Nothing is sent unless everything is green.** The script runs typecheck, lint and the unit
  tests before it records, and refuses to send if the demo flow itself fails — the recording is
  kept locally for debugging instead. A clip arriving in Telegram therefore *means* the change
  works, which is the only thing that makes the channel worth watching. A clip of a failure, even
  a clearly labelled one, teaches people to skim.
- **A demo flow is not a test.** It walks the new thing in 30–60 seconds. The assertions that
  actually guard the behaviour live in `.maestro/*.yaml`; a demo that doubles as a test tends to be
  too long to watch and too shallow to trust.
- The caption should say **what to look at**, not just what shipped.
- Telegram rejects bot uploads over 50 MB. A minute of simulator video is a few MB; the full suite
  is not — that is why demos are short and single-purpose.
- **The recording shows real account data and goes to a chat that keeps it.** Deliberate, never
  automatic: nothing sends without someone running the script.
- Link or mention the recording in the PR body, so the written evidence and the clip agree.

**Blocker:** a user-visible feature added or changed with no recording sent.

### Known limitation — be explicit about it

Programmatic tapping and typing requires Accessibility permission for the controlling terminal;
without it `osascript` fails with `-1719`. When that is unavailable, screens can still be driven
by deep link:

```bash
xcrun simctl openurl "iPhone 17 Pro" "exp://<LAN-IP>:8081/--/(app)/<route>"
xcrun simctl io "iPhone 17 Pro" screenshot out.png
```

…and data paths exercised directly against the API. That is acceptable evidence **only if the PR
states plainly which paths were tapped and which were rendered or exercised via API.** Do not
describe a rendered screen as a tested flow.

---

## 7. Contract pacing

Mobile is the **pacing constraint** for breaking API changes (`CONTRACT.md`): a `/api/v1`
endpoint cannot be retired until installed apps have drained. Before bumping the pinned contract
across a major version, confirm the old path stays live.

`X-App-Version` is sent on every request so that "have old installs drained?" is answerable.
Never remove it.

---

## 8. Branch and scope

```bash
git branch --show-current      # must not be main
git diff main...HEAD --stat
```

Lanes are enforced by CI (`Validate release branch`):

- `release/*` — application changes and version bumps
- `meta/*` — docs, CI, tooling. **Must not touch `src/` or `app/`, or change the version.**
- `dependabot/*` — dependency updates

---

## Summary

```
[ ] npm run lint             — 0 errors
[ ] npm run typecheck        — clean
[ ] npm run test:run         — green
[ ] src/api/generated        — regenerated, committed, clean
[ ] No secrets staged
[ ] Version bumped in package.json AND app.json (if app code changed)
[ ] EXECUTED in the simulator — flow + edge case; both appearances if styling changed
[ ] PR states which paths were tapped vs rendered
[ ] On a correct branch lane
```
