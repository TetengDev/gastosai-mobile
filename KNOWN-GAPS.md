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

---

## 5. Receipt scanning is unverified end-to-end locally

`POST /ai/vision` is wired, the multipart upload reaches the backend and `VisionService` runs. The
provider call then fails:

```
401 missing_scope — "Missing scopes: model.request"
```

The configured `OPENAI_API_KEY` is a **restricted service-account key without the `model.request`
scope**. Reproduced with plain `curl` against `api.openai.com`, outside the app, so this is an
OpenAI key-permission setting rather than anything in this repo.

Everything up to the provider is verified: picker, upload, endpoint, and the graceful failure path
the app shows when the provider is unavailable. `.maestro/receipt.yaml` will pass once the key can
call a model. Camera capture itself is not automatable — the simulator has no camera — so that
stays a manual check; the library path shares every line of code after the picker returns.

## 6. Chat is a single live thread

`more/chat.tsx` keeps one conversation in screen state. Web additionally offers a drawer of past
conversations, which is a laptop affordance — and `GET /chat/conversations` publishes no response
shape in the contract, so there is nothing typed to render a history from. Revisit if the backend
types that response.

## 7. Budget rules (50/30/20) are read-only on mobile

`GET /budget-rules/summary` is rendered; editing bucket splits is not. That is a deliberate,
infrequent, wide decision that belongs on a larger screen. Category `bucket` is likewise shown but
not editable.
