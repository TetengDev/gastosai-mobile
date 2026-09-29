# Expenses

The Expenses tab shows one month at a time, sectioned by day, with each day's total in the section
header and a search box scoped to that month. Foreign-currency rows show both the original amount and
the peso equivalent. Rows open an edit screen from which they can be changed or deleted.

## Sub-features

- `month-scoped` — the list shows the selected month only; `month-prev` walks back, and the app
  refuses to step past the current month.
- `day-sections` — each day is a section whose header carries the day's total, which comes from
  `/expenses/report/daily` and is never summed on the phone.
- `fx-row` — a foreign-currency expense shows its original amount (`1,500.00 JPY`) and **not** the raw
  figure as pesos.
- `search` — `expense-search` filters within the month; `search-clear` restores the full list.
- `edit` — `expense-row-first` opens `Edit expense`; the amount can be changed and saved.
- `delete` — the same screen deletes the row behind a `Delete expense?` confirmation.

## How to get to it (user POV)

- The Expenses tab from anywhere in the app.
- The month stepper at the top of the list (`month-prev`, `month-next`).
- The search field inside the list.
- Any row → the edit screen → Save changes or Delete expense.
- Home's Recent card also reaches a row, but the recipes enter from the Expenses tab: Recent sits
  below seven dashboard cards since v0.7, so entering from Home costs a scroll and races the layout.

## Driving it with Maestro

Preconditions: doctor passes; app warmed with `launch.yaml`;
`E=~/.claude/gastosai-mobile-verify/$(date +%F)`.

- **List, day sections, FX and search (`month-scoped` … `search`)**:

  ```bash
  maestro test .maestro/expenses.yaml --debug-output $E/expenses-debug
  ```

  Observable: the flow asks the API for the seeded JPY fixture, computes how many months back it
  sits, taps `month-prev` that many times, then asserts the month label, the day-section label, the
  day total, `.*1,500.00 jpy.*` visible and the raw figure **not** visible. Then `Commute` in
  `expense-search` shows `.*commute fare.*` and hides `.*jpy meal plan import.*`; `search-clear`
  brings it back. Read-only: creates nothing.

  Nothing in this recipe names a month or a date. The fixture's date rolls forward with the seed, and
  the flow's first version asserted `"jun 26, 2026"` and expired.

- **Edit and delete a row (`edit`, `delete`)** — against a row the run created, never a seeded one:

  ```bash
  maestro test .maestro/edit-delete.yaml --debug-output $E/edit-delete-debug
  ```

  Observable: as in [quick-add.md](./quick-add.md) — `177` becomes `226.53`, then the row is deleted
  and `.*₱226.53.*` is gone.

- **Prove the day total is the server's**, when that is the claim, by reading the same endpoint the
  header reads:

  ```bash
  python3 ../gastosai-backend/.claude/skills/verify-gastosai-backend/api.py \
      req GET "/expenses/report/daily?month=$(date +%Y-%m)" --expect 200 --max-body 800
  ```

  Observable: a per-day total matching the section header on screen. The flow already asserts this;
  the call is how you show a reviewer *where* the number came from.

## Gotchas

- **Never target a row by an amount the flow then deletes.** Amounts collide with seeded data —
  matching loosely on a round `₱175.00` destroyed a seeded expense during bring-up. Rows are
  addressed positionally (`expense-row-first`, `recent-row-0`).
- **A day-header total and its only row can show the same amount**, and the header is not pressable.
  Tapping the text does nothing and the flow dies later.
- **The app will not step past the current month**, so `month-next` on today is a no-op. To reach an
  empty month, walk *back* past the earliest month with data (`month.yaml` computes that distance).
- **`/expenses/report/category` ignores `month`.** If a recipe needs a category total for one month,
  sum the expenses instead — `chat.yaml` does, cross-checked against
  `/ai/insights/top-category`.
- **`eraseText` before typing in the search field**; a re-run leaves it populated and `inputText`
  appends, so the second run searches for `CommuteCommute`.
- **Maestro matches whole text nodes.** A label inside a longer accessibility string needs `.*` on
  both sides, and `textTransform: "uppercase"` changes only how text is drawn, not what is queryable.
