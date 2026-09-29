# Quick add

The capture path the app exists for on a phone: tap the floating `+`, type what you spent in plain
language, let the backend parse it, confirm, and see the expense saved with the month total moved.
The description that comes back is model-rewritten, so the amount — not the text — is what a proof
can hold on to.

## Sub-features

- `fab-entry` — the floating `+` is in thumb reach on every tab, not a row below the fold on Home.
- `parse` — "lunch 177 at Jollibee" comes back as a `₱177.00` draft.
- `confidence` — the draft shows a confidence pill (`HIGH`, `MEDIUM` or `LOW`).
- `save` — "Save this" writes the expense and returns to Home.
- `total-moves` — Home's month total and a Recent row both show the new amount.
- `month-snap` — saving while browsing an earlier month snaps Home back to the current month, since
  the new expense is dated today.
- `edit-then-delete` — the saved row can be opened from Expenses, its amount changed, and deleted.

## How to get to it (user POV)

- The floating `+` → "Quick add", from any tab.
- The same `+` → "Scan receipt" reaches the vision path instead — a different feature, tagged
  `manual` (`receipt.yaml`), because the provider key lacks image scope.
- The chat assistant can also create expenses; not covered by this flow.

## Driving it with Maestro

Preconditions: doctor passes; app warmed with `launch.yaml`;
`E=~/.claude/gastosai-mobile-verify/$(date +%F)`.

- **Capture, parse, confirm, save (`fab-entry` … `month-snap`)**:

  ```bash
  maestro test .maestro/quick-add.yaml --debug-output $E/quick-add-debug
  ```

  Observable, in the flow's order: `fab-add` opens a sheet asking `What did you spend on?`;
  `quick-add-input` takes `lunch 177 at Jollibee`; `Read it` produces `₱177.00` within 30s; a
  `HIGH|MEDIUM|LOW` pill is visible; `Save this` returns to a screen showing
  `.*spent this month.*`; a Recent row matching `.*₱177.00.*` is found by scrolling **down**; and the
  current month's label is scrolled back **up** into view.

  `177` is chosen to be unlikely to collide with seeded data. That is the only reason the amount is
  assertable — do not change it to a round number.

- **Then edit and delete it (`edit-then-delete`)** — a separate flow that runs quick-add first, so it
  owns its own row:

  ```bash
  maestro test .maestro/edit-delete.yaml --debug-output $E/edit-delete-debug
  ```

  Observable: `expense-row-first` opens `Edit expense` showing `177`; `expense-amount` is erased and
  retyped as `226.53`; the `amount-done` accessory dismisses the keyboard; `Save changes` shows
  `.*₱226.53.*`; re-opening confirms `226.53`; `Delete expense` → `Delete expense?` → `Delete`
  leaves `.*₱226.53.*` not visible.

- **If a run dies between save and delete**, one `₱177.00` (or `₱226.53`) row survives. Remove exactly
  that row — from the Expenses tab, or over the API with the backend skill's helper:

  ```bash
  python3 ../gastosai-backend/.claude/skills/verify-gastosai-backend/api.py \
      req GET /api/v2/expenses --expect 200 --max-body 4000   # find its id
  ```

  Do not reset the account, and do not delete by amount in bulk — seeded rows collide.

## Gotchas

- **Never assert on the description.** The parser rewrites what was typed: "lunch 177 at Jollibee"
  comes back as something like "Jollibee". A flow asserting the typed text fails on correct behavior.
- **A Recent row is one accessibility label**, e.g. `Lunch at Jollibee, Meal Plan · Aug 11, ₱177.00`
  under `recent-row-0`. Maestro matches the whole label, so `₱177.00` alone matches nothing — wrap it
  in `.*`.
- **The same amount appears twice on Home** — the month total and the Recent row — and only one is
  pressable. Tapping the text silently does nothing and the flow dies a step later.
- **The `decimal-pad` keyboard has no return key and covers Save.** Dismiss it via `amount-done` /
  `sheet-amount-done`, or the tap lands on a digit and changes the amount being saved.
- **`eraseText` before `inputText`** on the amount field; `inputText` appends, so a re-run saves
  `177226.53`.
- **Saving snaps Home to the current month.** Without that the expense files correctly and shows
  nothing, which looks exactly like data loss — the flow asserts the month label for that reason.
- **This flow spends an AI call.** The AI bucket is 20/minute and the plan quota is per user; a loop
  of quick-add runs will start failing on quota, not on the UI.
