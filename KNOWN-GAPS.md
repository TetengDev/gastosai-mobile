# KNOWN-GAPS.md

Where `CLAUDE.md` / `CONTRACT.md` describe a target this v1 scaffold has not reached, and the
deliberate scope boundaries. Keep it honest — delete an entry when it closes.

---

## 1. Magic-link sign-in is not implemented

The backend exposes `/auth/magic-link` and `/auth/magic-link/verify`, and web uses them. Mobile
v1 is **email/password only**.

The emailed link points at `FRONTEND_BASE_URL`, which is the web origin. Opening it in the app
needs deep-link handling (`expo-linking`, the `gastosai` scheme is already registered in
`app.json`) *and* a backend that knows to emit a mobile-scheme link — or a universal link with
the associated-domains setup on both platforms.

That is a cross-repo change, so it was left out rather than half-built.

---

## 2. Scope: capture loop only

Present: auth, dashboard (month total + recent), expense list with filter, add expense,
settings.

Absent on purpose: budgets, goals, recurring expenses, alerts, AI chat, admin, pricing, legal.
Admin observability and chat audit make little sense on a phone; the rest are the obvious v2.

Editing and deleting expenses have API wrappers in `src/api/expenses.ts` but no screens yet.

---

## 3. Money is a decimal number in transit, not integer centavos

`CONTRACT.md` calls for integer centavos. The backend serves `BigDecimal` at full precision, so
amounts arrive as JSON numbers with a fractional part. Nothing here does float arithmetic on
money and all formatting goes through `formatters.ts`, but the representation is not the one the
contract describes.

This is a **breaking contract change owned by the backend** — major version plus `/api/v2`. This
repo migrates only after that ships. See `gastosai-backend/KNOWN-GAPS.md`.

---

## 4. No EAS build or store release pipeline

CI runs typecheck, tests and the drift guard. There is no `eas.json`, no build profile and no
store submission. Deliberate — a release pipeline before there is anything to release is
premature, and EAS credentials are a separate setup.
