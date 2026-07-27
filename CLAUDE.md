# CLAUDE.md — gastosai-mobile

Expo (SDK 54) + React Native + TypeScript. A capture surface over the gastosai backend,
consuming the **same published contract** as web. Read `CONTRACT.md` first, then
`KNOWN-GAPS.md`.

**Status: v0.4.** The contract loop, auth, the full capture loop (add / edit / delete) and
AI quick-add exist, plus read-only budgets and goals. Navigation is a bottom tab bar with a
floating add button; the web design system is mirrored in `src/theme/`. Scope is deliberately the
thing a phone is better at than a laptop — recording spend at the moment it happens. Admin,
pricing and legal surfaces stay web-only.

**Navigation is tabs, and the add button is not one of them.** Four destinations sit in the tab
bar; capture is a floating action button above it. Mixing an action into a tab bar is the most
consistently warned-against tab-bar mistake, and adding a fifth destination there starts the
crowding this structure exists to avoid — put new screens behind a tab, not beside them.

**SDK 54, not the latest.** Pinned to match the Expo Go build on the target device. The simulator
installs a matching Expo Go per SDK and is unaffected; a development build would remove the
coupling entirely (`KNOWN-GAPS.md`).

---

## 1. Invariants

1. **API types come from the pinned contract** (`@tetengdev/gastosai-api-contract`) generated
   into `src/api/generated/` — never hand-edited. `src/api/types.ts` only aliases those
   generated shapes; it declares none of its own.
2. **No business logic on-device.** Render and send; never compute totals, budgets or
   categorisation. Filtering an already-fetched list is fine — anything that changes a number
   is the backend's.
3. **Money is never floating point.** The API serves decimal amounts at full precision. Format
   only at the display edge, via `src/lib/formatters.ts`.
4. **Times render in `Asia/Manila`, always pinned explicitly.** A phone's timezone is arbitrary
   — see §3.
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
- `@tetengdev/gastosai-api-contract` — exact pinned version from GitHub Packages via
  `.npmrc` with `${PACKAGE_TOKEN}`.

---

## 3. Timezone — the mobile-specific trap

The backend serves timestamps with `+08:00` and rolls days and months up in `Asia/Manila`.
`toLocaleString` without an explicit `timeZone` resolves in the **device's** zone:

| Device zone | `2026-06-26T01:00:00+08:00` renders as |
|---|---|
| `Asia/Manila` | **Jun 26** |
| `America/New_York` | **Jun 25** |

On web this is latent because users are in PH. On a phone it is real the first time someone
travels — the expense lands in the wrong day and the wrong monthly total, silently.

Every helper in `src/lib/formatters.ts` pins `APP_TIME_ZONE`. `nowForApi()` exists for the same
reason on the way out: it emits Manila wall-clock, because sending the device's raw ISO string
would record the wrong local time. `jest.globalSetup.js` forces `TZ=America/New_York` for the
whole test run so these guards are exercised rather than passing by accident on a PHT machine.

---

## 4. Token storage

`src/lib/tokenStore.ts` wraps `expo-secure-store` (iOS Keychain / Android Keystore). The web
app keeps its JWT in `localStorage`; the naive port is `AsyncStorage`, which is **plaintext in
the app sandbox** and readable on a rooted or jailbroken device and in backups.

This is the single most important thing not to copy verbatim from
`gastosai-web/src/context/AuthContext.tsx`.

Reading it is **async**, unlike web's synchronous `localStorage` — hence `ready` in
`AuthContext`. Redirecting before that resolves flashes the login screen at a signed-in user on
every cold start.

---

## 5. The contract loop

- `npm run gen:api` reads `node_modules/@tetengdev/gastosai-api-contract/openapi.json` and
  writes `src/api/generated/schema.d.ts`. Generated — never hand-edited.
- `src/api/client.ts` is the only hand-written transport: base URL, auth header, error
  surfacing. It declares no request/response types.
- CI regenerates and fails if `src/api/generated/` is stale, using `git status --porcelain`
  (a never-committed generated dir is untracked, which `git diff` ignores).
- Upgrading the contract is deliberate: bump the pin, `gen:api`, fix the type errors, migrate.
  The app-store cadence means this pin may lag web's — that is expected and fine.

---

## 6. Layout

```
app/                       expo-router routes
├── _layout.tsx            QueryClient + AuthProvider + Stack
├── index.tsx              session gate -> (app) | login
├── login.tsx              email/password (sign in + sign up)
└── (app)/                 authenticated group, guarded in _layout
    ├── _layout.tsx        <Tabs> + auth guard + floating add button
    │                        4 tabs; everything else is href: null and pushed over them
    ├── index.tsx          Home tab — month total, safe-to-spend, 4 recent
    ├── expenses.tsx       Expenses tab — list + filter + pull-to-refresh
    ├── budgets.tsx        Budgets tab — server-computed summary
    ├── goals.tsx          Goals tab — server-computed progress
    ├── expense/[id].tsx   pushed — edit + delete
    ├── add-expense.tsx    pushed — manual entry
    ├── quick-add.tsx      pushed — AI parse -> confirm -> save
    └── settings.tsx       pushed from Home's header — account, API base URL, sign out
src/
├── api/{client,auth,expenses,budgets,goals,types}.ts   types.ts only aliases generated shapes
├── api/generated/                        never hand-edited
├── context/AuthContext.tsx
├── lib/{formatters,tokenStore}.ts
└── components/{ui,ExpenseForm}.tsx
```

---

## Before opening a PR

Run the gate in `ai/skills/shared/pre-pr-checklist.md`, or the `pre-pr` agent
(`.claude/agents/pre-pr.md`) which executes it and reports a table.

The item that is not automatable and is skipped most often: **runtime execution.** A green test
suite is not evidence that the code was run. State in the PR body what you executed and what you
observed.

---

## 7. Definition of done

1. `npm run typecheck`, `npm run test:run` pass.
2. Generated client matches the pinned contract (CI regen clean).
3. No hand-written API types outside `generated/`.
4. No float money, no unpinned date rendering, no on-device business logic, no shipped secret,
   JWT in SecureStore.

---

## 8. Working agreement

**Do without asking:** build screens, components, query hooks, tests; regenerate against a new
pinned contract version.

**Ask first:** bumping the pinned contract across a breaking change, adding a native dependency,
raising the minimum supported app version, moving backend computation on-device.

**Never do:** hand-edit `generated/`, compute business values on-device, float math on money,
store the JWT insecurely, ship any non-public key, render a date without pinning the timezone,
or drop support for an API version installed apps still call.

---

## 9. Commands

```bash
npm install            # needs PACKAGE_TOKEN for the contract package
npm run gen:api        # openapi-typescript from the pinned contract
npm start              # Expo dev server
npm run typecheck
npm run test:run
```

`EXPO_PUBLIC_API_URL` points at the backend. `localhost` does not resolve from a device or
Android emulator — `src/api/client.ts` falls back to the Expo host's LAN IP so `npm start`
works on a real phone without editing env files.
