# Dashboard

Home is a dashboard: a month total, a trend comparison against the previous month, the month's
biggest category, the single largest expense, a goals card and an all-time category breakdown. Every
figure on it comes from the backend, which is exactly what makes it verifiable — a card that computed
its own numbers would still render something, just not these numbers.

## Sub-features

- `month-stepper` — `month-prev` moves Home to the previous month and the label follows.
- `trend` — the percentage change comes from `/expenses/report/monthly-comparison`; `id: trend-change`
  renders it.
- `top-category` — "biggest category: …" comes from `/ai/insights/top-category`.
- `top-expense` — `id: card-top` shows the largest single expense from `/expenses/report/top`,
  formatted with a thousands separator.
- `goals-card` — `id: card-goals` is reachable by scrolling.
- `categories-card` — `id: card-categories` shows `by category · all time`.
- `computed-not-invented` — every assertion above is fetched from the API in the same run, with
  `output.token`, and compared to what is on screen.

## How to get to it (user POV)

- The Home tab, which is where sign-in lands.
- The month stepper at the top of Home.
- Scrolling down through the cards; since v0.7 there are seven before Recent.
- Each card is also a route into its own tab, covered by
  [session-and-navigation.md](./session-and-navigation.md).

## Driving it with Maestro

Preconditions: doctor passes; app warmed with `launch.yaml`;
`E=~/.claude/gastosai-mobile-verify/$(date +%F)`.

- **Drive the whole dashboard (`month-stepper` … `computed-not-invented`)**:

  ```bash
  maestro test .maestro/dashboard.yaml --debug-output $E/dashboard-debug \
      --format HTML --output $E/dashboard.html
  ```

  Observable, in order: `tab-home`, then `month-prev` and the previous month's label within 25s; the
  flow fetches `monthly-comparison`, `top-category` and `report/top` for `output.prevKey`, formats the
  amount itself, then asserts the percentage, `.*biggest category: <category>.*`,
  `id: trend-change`, `id: card-top` with that amount, `id: card-goals`, `id: card-categories` and
  `.*by category · all time.*`. Read-only: creates nothing.

  It runs against the **previous** month deliberately: a month still accumulating rows can change
  between the fetch and the assertion.

- **Show a reviewer where a figure came from**, when a number is disputed:

  ```bash
  B=../gastosai-backend/.claude/skills/verify-gastosai-backend/api.py
  python3 $B req GET "/expenses/report/monthly-comparison?month=<prevKey>" --expect 200
  python3 $B req GET "/ai/insights/top-category?month=<prevKey>" --expect 200
  ```

  Observable: the same `changePercent` and category the screen shows. Note these are the **v1**
  (unprefixed) paths the flow uses; the v2 equivalents return centavos, so a figure compared across
  surfaces needs the conversion — see the backend skill.

- **After a change to any card**, re-run this flow rather than screenshotting Home: the failure
  message names the figure that stopped matching, which a screenshot cannot.

## Gotchas

- **Never write a figure into this flow.** `38.71%`, `₱9,049.50` and `June 2026` were all in it once
  and all expired; four flows failed on 11 Aug 2026 asserting months an already-correct app had moved
  past.
- **`/ai/insights/top-category` spends an AI call** and is quota-gated. A dashboard run inside a tight
  loop can fail on quota rather than on the UI.
- **Assert on a screen you did not just leave.** The Recent card sits below seven cards since v0.7;
  a flow that needs a single expense enters from the Expenses tab instead of scrolling Home.
- **Scrolling moves the total card off the top**, so an assertion on the month label after a scroll
  needs a scroll back up — the flow does that explicitly.
- **Amounts render with a thousands separator** (`₱1,900.00`). The flow formats its expected value the
  same way; a comparison built from a bare `toFixed(2)` will not match.
- **The trend card needs two months of data.** Against a freshly seeded database whose previous month
  is empty, this flow has nothing to compare and fails for a data reason, not a code one.
