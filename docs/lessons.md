# Lessons — gastosai-mobile

Things that cost real time to discover, kept out of `CLAUDE.md` so they do not sit in every
session's context. **Read this before changing navigation, month handling, chat, or how an amount
is displayed** — each entry below is a bug that shipped, or nearly did.

Ordered newest first.

---

## A chat reply is not just its `message`

`POST /ai/chat` returns `type` and `result`. `message` is often only a **caption** — "Category
totals for 2026-07." — and the data is in `result`. Rendering `message` alone showed a label over
nothing.

`type` matters as much:

| `type` | Meaning |
|---|---|
| `action` | done; `result` holds the data |
| `preview` | **proposing a write, waiting for confirmation** |
| `disambiguate` | "which one did you mean" |

Rendering a `preview` as text means the write never happens — "add lunch 150" appeared to work and
did nothing. See `src/components/chat/`.

`result` is typed `{}` in the contract, so its shape can only be recognised by inspection. Unknown
shapes must degrade to something readable rather than render nothing — rendering nothing is what
caused the original bug.

## Chat and vision calls need their own timeout

`src/api/client.ts` defaults to 20s, which is right for CRUD and wrong for a model call plus a tool
execution. axios aborts with **no response**, which `errorMessage` then renders as *"Cannot reach
the server. Check your connection."* — sending the user to check their wifi when the server was
fine. `/ai/chat` and `/ai/vision` set 90s and treat `ECONNABORTED` distinctly.

## A pushed screen must never call `router.back()`

The screens under `href: null` are **tabs with hidden buttons, not stack routes**. React Navigation
renders no back control for them, and `router.back()` pops to the *initial* tab rather than where
you came from — saving an edit opened from Expenses dropped the user on Home.

`pushedScreens` in `app/(app)/_layout.tsx` declares each screen's parent; `useNavOrigin()`
(`src/context/NavOriginContext.tsx`) answers "which tab did this open from" for screens reachable
from several. A route param does **not** survive a push between tab siblings — that was the first
attempt and it silently did nothing.

## Every month must be reachable, and the month is shared

`MonthContext` holds the selected `YYYY-MM`; Home, Expenses and Budgets all read it. Before it,
every screen hard-coded `currentMonth()` and **six months of data had no route to the screen at
all** — the app opened on an empty month and looked broken.

`/budgets/summary` and `/budgets` take `month`; `/expenses` takes `from`/`to`. The API always
supported this; only the client ignored it.

**Recording an expense snaps the month back to today** (`resetToCurrent()`), because a new expense
is dated now — saving one while browsing June filed it correctly and showed nothing.

There are **three** ways in, and each one needs the reset: `app/(app)/quick-add.tsx`,
`app/(app)/add-expense.tsx`, and approving a chat proposal in `app/(app)/more/chat.tsx`. The chat
path was added later and missed it, which reproduced the original bug exactly. The confirm reply
comes back as `type: "action"` and carries no tool name, so the screen has to remember what the user
approved (`confirmingTool`) to know whether the write was an expense at all.

## Amounts render from `amountInBaseCurrency`, not `amount`

`amount` is in the expense's **own** currency. A ¥1,500 row displayed as "₱1,500.00" while its
server-computed day total correctly read ₱577.50 — two numbers for the same row on one screen.
`expenseAmounts()` in `src/lib/formatters.ts` picks the right field. Use it anywhere an expense
figure is shown.

## Writable screens still compute nothing

Budgets, goals and recurring all mutate. The temptation is to advance a progress bar locally so the
UI feels quick. Don't: `percentUsed`, `progressPercent`, `safeToSpend` and every due date are
server-computed. Mutate, invalidate, render what comes back.

`.maestro/goals.yaml` asserts a **server-returned percentage** precisely to catch anyone who
"optimises" this later.

## Navigation is tabs, and the add button is not one of them

Five destinations sit in the tab bar; capture is a floating action button above it. Mixing an
action into a tab bar is the most consistently warned-against tab-bar mistake.

**The tab bar is full** — three to five is the guidance and this is five. A new screen belongs
behind `more/`, not beside the existing tabs.

## Home is a check-in first, a dashboard second

The month total, safe-to-spend and the insight sentence stay above the fold so a two-second glance
still works; the report cards sit below. Adding a card means adding it *below*, not at the top.

## SDK 54, not the latest

Pinned to match the Expo Go build on the target device. The simulator installs a matching Expo Go
per SDK and is unaffected; a development build would remove the coupling entirely — see
`KNOWN-GAPS.md`.
