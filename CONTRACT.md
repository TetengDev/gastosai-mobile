# CONTRACT.md — the gastosai API contract (polyrepo)

Read this before touching any repo. It defines the one rule that keeps three
independent repositories from drifting apart: **the backend publishes the API
contract as a versioned package, and every client pins and generates from it.**

This is the polyrepo version of the contract. Unlike a monorepo — where the spec is
a shared file both sides can see — here the coordination is gone, so the contract
must be an explicit, versioned, published artifact. Keep this file's copy identical
in the backend and web repos.

---

## The repos

| Repo | Role |
|---|---|
| `gastosai-backend` | Spring Boot 4 / Java 25. **Owns and publishes** the contract. |
| `gastosai-web` | React 19 + Vite. **Pins and consumes** the contract. |
| `gastosai-mobile` | Expo / React Native. **Pins and consumes** the contract — `3.0.0`, `/api/v2`. |

Independent repos, independent CI, independent deploys. The only thing binding them
is the published contract below.

---

## The one rule

**The backend generates `openapi.json` (springdoc) and publishes it as the versioned
npm package `@tetengdev/gastosai-api-contract` on GitHub Packages. Clients depend on
an exact pinned version and generate their typed client from it. No client ever
hand-writes a request/response type, and no client generates from a live URL.**

Why published-and-pinned, not a shared folder: the repos no longer share a
filesystem. A pinned package version is what replaces that shared visibility. A
client upgrades the contract deliberately, regenerates, sees the type errors, and
migrates — drift becomes a visible, versioned event instead of a silent runtime break.

---

## The workflow

```
  gastosai-backend
    OpenApiContractTest → contract/openapi.json (npm package)
        │  publish on contract-v* tag
        ▼
  GitHub Packages: @tetengdev/gastosai-api-contract@X.Y.Z
        │  pinned dependency
        ├───────────────────────────┐
        ▼                           ▼
  gastosai-web                 gastosai-mobile
  openapi-typescript           openapi-typescript
  → src/api/generated/         → src/api/generated/
```

1. Backend defines endpoints; springdoc generates the spec, written by a test in the
   normal `./mvnw test` run. Backend CI fails if the committed spec is stale.
2. On a `contract-v*` tag, the backend publishes the contract package with a semver version.
3. Each client pins an **exact** version (no `^`, no `~`) and runs `openapi-typescript`
   against the installed package into `src/api/generated/` — never hand-edited.
4. Each client's CI regenerates and fails if the committed generated code is stale
   against the pinned version, then type-checks. That failure is the drift guard.

**The contract version is not the application version.** The app tags `v*` (currently `0.x`);
the contract tags `contract-v*` and starts at `1.0.0`. Most app releases do not change the API
surface — republishing an unchanged spec under a new number would make the pin meaningless.

---

## Versioning — contract version = API compatibility

- **Non-breaking** (new optional field, new endpoint) → **minor** bump. Clients pick
  it up when they choose to upgrade the pin.
- **Breaking** (removed/renamed field, changed type, tightened validation, removed
  endpoint, a request field becoming required) → **major** bump **and** a new URL version
  path `/api/v2`. The old version path stays live until every client has migrated.
- **"Changed type" on an output field means narrowed, not widened.** Widening an output
  type to admit a value the wire already produced (e.g. `string` → `["string","null"]`
  when the field could always come back null) is a **minor** bump — the server is
  promising less than before, not more, and no client that already handled the old
  type can be surprised by the new one. Narrowing an output type (e.g. dropping `null`
  from the union, or `number` → `integer`) is still **major**: it forbids a value the
  client may already be receiving. This applies to output/response types only — a
  request field's accepted type narrowing or widening follows the general rule above,
  since the server is the one that has to handle whatever the client sends.
- **Mobile is the pacing constraint.** Installed apps run old versions for months.
  Never remove a `/api/v1` endpoint until analytics show old app versions have
  drained. This is the single strongest reason breaking changes are additive-first.

---

## Cross-repo change ordering

A change that spans the contract is **not** one commit anymore — it's an ordered
sequence across repos. Do it in this order, every time:

1. Backend: implement the change following expand-contract (add new shape first).
2. Backend: publish a new contract version (minor for additive, major for breaking).
3. Clients: bump the pinned version, regenerate, fix type errors, migrate.
4. Backend: only after clients have migrated, publish the contract-removal (contract
   step) that drops the old shape — a later major version.

Never publish a breaking contract version before clients have a migration path.

---

## Cross-cutting data rules (identical in all repos)

- **Money is never floating point.** Currency explicit, default `PHP`. **On `/api/v2` an amount is
  an integer of centavos** — `15075` is ₱150.75. The older unversioned paths remain live and still
  serve decimal amounts at full precision, so which surface a client calls decides which
  representation it gets: the same amount differs by a factor of a hundred between them, and the
  two must never meet in one call path. Format to `₱1,234.56` only at the display edge.
- **Timestamps are ISO 8601 with `+08:00`.** Store UTC, serialize with offset.
  Day/month logic in `Asia/Manila`. A naive timestamp is a bug.
- **No AI provider key ever reaches a client.** AI runs backend-only.
- **Business logic lives only in the backend.** Clients render and send; they never
  compute totals, budgets, or categorization.

---

## Auth

Application auth is a **backend-issued JWT** (`jjwt`), sent as a bearer token; Supabase is
the managed Postgres host only, and there is no Supabase client SDK or anon key in any
client. If that ever changes, update this section in both repos.

## Auth for the contract package

Both publishing (backend) and installing (web, mobile, Vercel) use a GitHub
`PACKAGE_TOKEN` scoped to `@tetengdev` via `npm.pkg.github.com`, supplied as an env
var / CI secret. Never commit the token; never inline it in `.npmrc` — reference
`${PACKAGE_TOKEN}`.

---

## Where this repo stands (mobile-specific — not part of the shared copy)

Everything above is the shared contract text and is kept identical in the backend and web repos.
This section is local to `gastosai-mobile`.

**This client pins `@tetengdev/gastosai-api-contract@3.0.0` and calls `/api/v2`. Every amount it
sends or receives is an integer of centavos.** Its base URL carries the version path, so a request
built through `src/api/client.ts` is a v2 request by construction; no call site chooses.

Two helpers in `src/lib/formatters.ts` are the only sanctioned crossings between a centavo integer
and a human figure:

| Direction | Helper |
|---|---|
| centavos → display | `formatCentavos(15075)` → `₱150.75` |
| user input → centavos | `parseAmountToCentavos("150.75")` → `15075` |

Neither `cents / 100` nor `parseFloat(x) * 100` is a substitute: both reintroduce exactly the
binary rounding the integer representation exists to remove — `parseFloat("0.29") * 100` is
28.999999999999996 — and which literals are affected is not visible by eye. The decimal-era
`formatCurrency` and `expenseAmounts` were deleted in TEN-355 rather than left exported, because a
centavo integer passed to a decimal formatter renders a hundredth of the real figure with nothing
failing. `src/components/money.ts` holds the centavo-side choice between an expense's own currency
and its converted base figure.

Contract **3.x is the pin, not the ceiling.** Per the pacing rule above, installed apps keep
calling whatever surface they shipped with, so the unversioned decimal paths must stay live until
analytics show those installs have drained — this repo moving to v2 does not license removing them.
`X-App-Version` is sent on every request precisely so that question can be answered with data.
