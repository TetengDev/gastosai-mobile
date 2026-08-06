---
description: Gate, open the PR, and put it through an independent review loop until it is production ready.
---

# /ship — gastosai-mobile

Take the current branch from "I think this is done" to a PR a human can merge.

**Linear issue: $ARGUMENTS** (e.g. `TEN-158`). **Required.** Resolve it before anything else; if
no key was given, or it does not resolve to an issue in the *GastosAI* project, stop immediately:

> `/ship requires a tracked Linear issue. No PR will be opened.`

Do not infer it from the branch name, do not guess from the diff, and never open the PR intending
to link it afterwards. The `Owns` block, the acceptance criteria and the review's scope all come
from the issue — without it the reviewer is judging the change only against itself.

**Full rules: `../docs/ship-loop.md`.** Read it. What follows is only the part
specific to this repo.

## Per pass

1. **Gate** — run the `pre-pr` agent. Red gate: fix, restart the pass, do not review.
2. **Publish** — `gh pr create` (or push to the existing PR). Evidence comes from the demo
   recorder, which attaches to Linear itself:
   `./scripts/record-demo.sh <flow> "what to look at" <ISSUE>` — set `PR_NUMBER` in the
   environment to link the PR at the same time. Move the issue to `In Review`.
3. **Review** — run the `pr-reviewer` agent with the PR number and the issue key.
4. **Audit** — run the `pr-review-auditor` agent with the reviewer's findings and the PR number.
   **Low-risk changes skip this step**; medium and high always run it. Risk levels and the
   critical-domain list: `../docs/ship-loop.md`. When in doubt, take the higher level.
   **Low-risk changes skip this step**; medium and high always run it. Risk levels and the
   critical-domain list: `../docs/ship-loop.md`. When in doubt, take the higher level.
5. **Decide** — `APPROVE` stops the loop. Otherwise fix the upheld findings and start a new pass.

**Three passes**, and only for high-risk work or while valid blocking findings remain. A fourth is
never allowed — publish what was found and say it did not converge.

## What this repo's gates mean in practice

- **A user-visible change with no recording is a blocker.** The recorder refuses to attach
  anything unless typecheck, lint, the unit tests and the demo flow are all green, which is what
  makes a clip on the issue mean "this works".
- **Deployment is deferred.** Verify on a simulator or a device against a local backend over the
  LAN. Do not start an EAS build as part of shipping — that is milestone M5 and it is parked.
- **Version bumps are a pair.** `package.json` and `app.json` (`expo.version`) move together and
  must not drift. A `meta/*` branch touches neither, nor `src/` or `app/`.
- **Timezone.** Never render a date without pinning the zone, and never weaken the forced
  `TZ=America/New_York` in `jest.globalSetup.js` — it exists so these bugs fail in CI instead of
  in someone's month total.
- The JWT lives in SecureStore. Never AsyncStorage.

## Publish the record

Post the findings-and-resolutions history — every pass, including rejected findings and why — as
both a PR comment and a Linear comment. "Addressed review feedback" is not a record.

Then stop. **Do not merge.** A human does that.
