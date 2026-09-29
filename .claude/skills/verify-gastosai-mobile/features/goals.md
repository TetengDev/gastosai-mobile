# Goals

A savings goal has a label, a target amount, and a running saved amount. The card shows
`₱<saved> of ₱<target> · <percent>%`, and the percentage is the backend's `progressPercent` — the
phone never calculates it. Goals are created, contributed to, and deleted from the Goals tab.

## Sub-features

- `create` — `goal-create` opens a sheet; an amount and a label save a new goal.
- `initial-state` — a new goal reads `₱0.00 of ₱10,000.00`.
- `contribute` — "Add savings" adds to the saved amount.
- `percent-from-server` — after contributing ₱4,000 of ₱10,000 the card reads
  `₱4,000.00 of ₱10,000.00 · 40%`; 40 cannot be produced by rounding some other pair, so a locally
  computed bar would disagree.
- `delete` — `goal-menu-0` → "Delete goal…" → a confirmation naming the goal → "Delete" removes it.
- `self-cleaning` — the flow creates and deletes its own goal, so it never matches a value seeded data
  could hold.

## How to get to it (user POV)

- The Goals tab → `goal-create` for a new goal.
- A goal card → "Add savings" to contribute.
- A goal card's `goal-menu-N` → "Delete goal…".
- Home's goals card (`card-goals`) links into the same tab; covered by
  [dashboard.md](./dashboard.md) as a reachability assertion only.

## Driving it with Maestro

Preconditions: doctor passes; app warmed with `launch.yaml`;
`E=~/.claude/gastosai-mobile-verify/$(date +%F)`.

- **Create, contribute, delete (`create` … `self-cleaning`)**:

  ```bash
  maestro test .maestro/goals.yaml --debug-output $E/goals-debug \
      --format HTML --output $E/goals.html
  ```

  Observable, in order: `tab-goals`, `goal-create`, the sheet's `Cancel` within 15s; `sheet-amount`
  takes `10000` and `sheet-amount-done` dismisses the keypad; `sheet-label` takes
  `Maestro Test Goal`; `sheet-save` produces a card reading `.*₱0.00 of ₱10,000.00.*`; "Add savings"
  with `4000` gives `.*₱4,000.00 of ₱10,000.00 · 40%.*` within 20s; `goal-menu-0` →
  `Delete goal…` → a dialog matching `.*delete .maestro test goal.*` → `Delete`, after which
  `Maestro Test Goal` is no longer visible.

- **Cross-check the percentage against the API**, when the claim is that nothing is computed on the
  phone:

  ```bash
  python3 ../gastosai-backend/.claude/skills/verify-gastosai-backend/api.py \
      req GET /api/v2/goals --expect 200 --max-body 800
  ```

  Observable: the goal's `progressPercent` as a decimal (`40.0`) beside `savedAmount: 400000` in
  centavos. The screen shows `40%` and `₱4,000.00`; that pair is the proof.

- **If a run dies after `sheet-save`**, one goal named `Maestro Test Goal` survives. Delete that one
  from the Goals tab, or over the API by its id. Do not clear the account's goals.

## Gotchas

- **Name destructive confirm buttons after what they delete.** The dialog's button is `Delete goal…`
  in the row menu and `Delete` in the dialog; every row carries its own `Delete`, so a bare match hits
  the row *behind* the dialog and silently re-opens it.
- **Never assert on a string that is also the control you just tapped.** This flow asserted
  `"New goal"` after tapping the button labelled "New goal" — it passed whether or not the sheet
  opened. Assert on something only the new screen renders.
- **The percentage is server-derived and the amounts are centavos on v2.** `40%` next to `400000` in
  the API response is correct, not a unit bug.
- **`eraseText` before `inputText` in `sheet-amount`** on the contribute step; the sheet reopens
  pre-filled and `inputText` appends.
- **`goal-menu-0` is positional.** A leftover goal from a crashed run shifts it, and the flow then
  deletes the wrong goal. Check the tab is clean before re-running.
- **A goal's `status` is derived from amount *and* target date**, so the same amounts can present
  differently as the date passes. Assert the percentage, which this flow does, rather than the status.
