# CLAUDE.md — gastosai-mobile

Expo (SDK 54) + React Native + TypeScript. A capture surface over the gastosai backend, consuming
the **same published contract** as web.

The invariants below are always in force. Everything else is conditional — see §10 for which
document to open for which task, and do not preload the rest. The one worth knowing about
up front: **`docs/lessons.md`**, where every entry is a bug that shipped or nearly did — read it
before touching navigation, date/month handling, chat, receipt capture, auth startup, token
storage, or how an amount is formatted.

Scope is deliberately what a phone is better at than a laptop: recording spend at the moment it
happens, including photographing the receipt. Pricing, billing and admin stay web-only.

---

## 1. Invariants

1. **API types come from the pinned contract** (`@tetengdev/gastosai-api-contract`) generated into
   `src/api/generated/` — never hand-edited. `src/api/types.ts` only aliases those generated
   shapes; it declares none of its own.
2. **No business logic on-device.** Render and send; never compute totals, budgets or
   categorisation. Filtering or sorting an already-fetched list is fine — anything that changes a
   number is the backend's.
3. **Money is never floating point.** The API serves decimal amounts at full precision. Format only
   at the display edge, via `src/lib/formatters.ts`.
4. **Times render in `Asia/Manila`, always pinned explicitly** — see §3.
5. **Mobile is the contract's pacing constraint.** Installed apps run old versions for months;
   never rely on a backend change that removing a `/api/v1` endpoint would break.
6. **No secrets in the bundle.** A shipped binary is fully inspectable. The only credential
   on-device is the user's own JWT, in the Keychain/Keystore (§4).

---

## 2. Stack

- Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript 5.9 (strict).
- `expo-router` for navigation (file-based, `app/`).
- TanStack Query over the generated client for server state.
- `expo-secure-store` for the JWT. **Never `AsyncStorage`.**
- `@tetengdev/gastosai-api-contract` — exact pinned version from GitHub Packages via `.npmrc`
  with `${PACKAGE_TOKEN}`.

---

## 3. Timezone — the mobile-specific trap

The backend serves timestamps with `+08:00` and rolls days and months up in `Asia/Manila`.
`toLocaleString` without an explicit `timeZone` resolves in the **device's** zone:

| Device zone | `2026-06-26T01:00:00+08:00` renders as |
|---|---|
| `Asia/Manila` | **Jun 26** |
| `America/New_York` | **Jun 25** |

On web this is latent because users are in PH. On a phone it is real the first time someone travels
— the expense lands in the wrong day and the wrong monthly total, silently.

Every helper in `src/lib/formatters.ts` pins `APP_TIME_ZONE`. `nowForApi()` exists for the same
reason on the way out: it emits Manila wall-clock, because sending the device's raw ISO string
would record the wrong local time. `jest.globalSetup.js` forces `TZ=America/New_York` for the whole
test run so these guards are exercised rather than passing by accident on a PHT machine.

---

## 4. Token storage

`src/lib/tokenStore.ts` wraps `expo-secure-store` (iOS Keychain / Android Keystore). The web app
keeps its JWT in `localStorage`; the naive port is `AsyncStorage`, which is **plaintext in the app
sandbox** and readable on a rooted or jailbroken device and in backups.

This is the single most important thing not to copy verbatim from
`gastosai-web/src/context/AuthContext.tsx`.

Reading it is **async**, unlike web's synchronous `localStorage` — hence `ready` in `AuthContext`.
Redirecting before that resolves flashes the login screen at a signed-in user on every cold start.

---

## 5. The contract loop

- `npm run gen:api` reads `node_modules/@tetengdev/gastosai-api-contract/openapi.json` and writes
  `src/api/generated/schema.d.ts`. Generated — never hand-edited.
- `src/api/client.ts` is the only hand-written transport: base URL, auth header, error surfacing.
  It declares no request/response types.
- CI regenerates and fails if `src/api/generated/` is stale, using `git status --porcelain` (a
  never-committed generated dir is untracked, which `git diff` ignores).
- Upgrading the contract is deliberate: bump the pin, `gen:api`, fix the type errors, migrate. The
  app-store cadence means this pin may lag web's — expected and fine.

---

## 6. Layout

`app/` is expo-router file-based routing: `login.tsx`, then an authenticated `(app)/` group whose
`_layout.tsx` holds the tab bar, the auth guard and the floating add button. Five tabs — Home,
Expenses, Budgets, Goals, More — and everything else is `href: null`, pushed over them.

`src/` is `api/` (transport + generated types), `context/`, `lib/`, `components/`, `theme/`.

Run `tree app src -L 2` for the current shape rather than trusting a copy here — the previous
hand-maintained tree drifted out of date within one release.

---

## 7. Before opening a PR

**When preparing a PR** — not while implementing — run the `pre-pr` agent
(`.claude/agents/pre-pr.md`), which executes the full checklist and reports a table.

Two items are skipped most often, so they are worth naming: **runtime execution** (a green suite is
not evidence the code was run) and **the demo recording** —
`./scripts/record-demo.sh <flow> "caption" <LINEAR-ISSUE>` records a short flow and attaches it to
the Linear issue, and attaches nothing if anything is red. Use targeted tests while implementing;
the full suite belongs here, once.

Then `/ship`, which gates, opens the PR, and puts it through an independent review pass before a
human sees it.

---

## 8. Working agreement

**Do without asking:** build screens, components, query hooks, tests; regenerate against a new
pinned contract version.

**Ask first:** bumping the pinned contract across a breaking change, adding a native dependency,
raising the minimum supported app version, moving backend computation on-device.

**Never do:** hand-edit `generated/`, compute business values on-device, float math on money, store
the JWT insecurely, ship any non-public key, render a date without pinning the timezone, or drop
support for an API version installed apps still call.

### Working with tracked issues

Shared workflow — Linear lifecycle, `Owns` restrictions, evidence, PR linking, `/ship`, dispatch,
subagent policy, search discipline — lives in
[`../docs/agent-workflow.md`](../docs/agent-workflow.md).

**Read it when** you start tracked implementation, move an issue's state, prepare or open a PR,
attach evidence, run `/ship`, or coordinate across repositories. **Not** for debugging, planning,
reading code, or a local edit.

Two rules from it worth repeating: **only write the files your issue's `Owns` block lists**, and
**never merge** — a human does that.

---

## 9. Commands

```bash
npm install            # needs PACKAGE_TOKEN for the contract package
npm run gen:api        # openapi-typescript from the pinned contract
npm start              # Expo dev server
npm run typecheck
npm run test:run
```

`EXPO_PUBLIC_API_URL` points at the backend. `localhost` does not resolve from a device or Android
emulator — `src/api/client.ts` falls back to the Expo host's LAN IP so `npm start` works on a real
phone without editing env files.

---

## 10. Reference documents — read when the task calls for them

**Do not preload linked reference documents for unrelated tasks.**

| Read | When |
|---|---|
| `docs/lessons.md` | navigation, date/month handling, chat, receipt capture, auth startup, token storage, amount formatting |
| `CONTRACT.md` | API/client/type compatibility, or a contract version bump |
| `KNOWN-GAPS.md` | the issue names a documented limitation, or you are touching one |
| `.claude/agents/pre-pr.md` | preparing a PR, or running the gate by hand |
| `../docs/ship-loop.md` | running `/ship`, or changing the review process |
| `../docs/agent-workflow.md` | tracked work, issue state, PRs, evidence, cross-repo |

Never search or read the `gastosai/` archive beside this repo during ordinary work.
