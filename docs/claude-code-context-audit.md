# Claude Code context audit — gastosai-mobile

**Phase 2 applied to this repo; the account-level questions in §9 are still open.** `CLAUDE.md` has
been rewritten per §5–6 and `docs/lessons.md` created. Everything §6 marks *Unchanged* or *Untouched*
stayed that way — the numbers in §1–2 are the pre-change measurements and are kept as the baseline
§10 compares against.

Claude Code `2.1.220`. Measured on branch `release/0.8.0` while the v0.8 chat work was uncommitted;
that work was left untouched by this audit and ships alongside it.

---

## 1. Current configuration

The project's own configuration is **small and clean**. There is no sprawl to cut:

| Source | Lines | Loads |
|---|---:|---|
| `./CLAUDE.md` | 227 (11.7 KB) | **startup** |
| `.claude/settings.json` | 5 | startup (one plugin toggle) |
| `.claude/agents/pre-pr.md` | 70 | on demand |
| `ai/skills/shared/pre-pr-checklist.md` | 184 | on demand |

**Absent, and worth stating because it means there is nothing to fix there:** no `AGENTS.md`, no
`CLAUDE.local.md`, no `.claude/CLAUDE.md`, no user-level `~/.claude/CLAUDE.md`, no parent-directory
CLAUDE.md chain, no project `.mcp.json`, no `settings.local.json`, no user-defined hooks, no
user-level agents/skills/commands, and exactly **one** project agent.

## 2. Startup context, measured

From `/context` — these are Claude Code's own numbers, not estimates:

| Source | Tokens | Controllable by this repo? |
|---|---:|---|
| Messages (this conversation) | **757.9k (75.8%)** | Behaviour, not config |
| MCP tool schemas (deferred) | 46.2k (4.6%) | Yes — account/plugin level |
| System tools (+deferred) | 26.9k | No |
| System prompt | 3.7k | No |
| Skills (32 exposed) | 3.4k | Partly |
| **`./CLAUDE.md`** | **≈2.9k (estimate)** | Yes |

**Everything this repo's config controls is roughly 3k tokens.** Cleaning CLAUDE.md perfectly saves
about **0.3%** of the window.

## 3. The five largest consumers — honestly ordered

1. **Read results: ~3.4m tokens cumulative (343%)**, per `/context`. Dominated by **~30 simulator
   screenshots** I took this session. An image costs far more than the text assertion that would
   have proved the same thing. **This is the single biggest lever and it is mine, not the config's.**
2. **Bash results: 157.5k (16%)**, per `/context` — full Maestro suite runs, `mvnw test` output,
   repeated full-suite reruns after one-line changes.
3. **MCP tool schemas: 46.2k.** 66 tools: Gmail, Google Calendar, Google Drive, Slack,
   claude-mem. **This project used exactly zero of them** across the whole session.
4. **`claude-mem` plugin.** 36 skills on disk, ~18 surfaced; hooks on **six** events including
   `PostToolUse` and `UserPromptSubmit`; a SessionStart digest (~50 observations); and a
   supplementary block appended to individual `Read` results. Per-call tax across a long session.
5. **`./CLAUDE.md` growth.** 227 lines, and lines 14–55 are a *changelog* — one "lesson" paragraph
   added per release from v0.4 to v0.8. It grows every time we ship.

## 4. Duplicated, conflicting, stale

- **`CLAUDE.md` §6 layout tree is stale** — the comment says "4 tabs" while the app has five, and
  the tree omits `demo/`. It was updated by hand each release and drifted.
- **The v0.4–v0.8 lesson paragraphs duplicate** what the code comments already say, at length. They
  are release notes living in always-on context.
- **`pre-pr-checklist.md` §6 and `CLAUDE.md`'s "Before opening a PR"** state the runtime-execution
  rule twice.
- No *conflicting* rules found.

## 5. Proposed target

**Root `CLAUDE.md` → ~110 lines.** Keep only what is true every session: the six invariants, stack,
timezone trap, token storage, contract loop, commands, working agreement. Replace the growing
lesson list with one line pointing at a new `docs/lessons.md`.

Classification of what is there today:

| Content | Verdict |
|---|---|
| §1 Invariants, §2 Stack, §3 Timezone, §4 Token storage, §5 Contract loop, §9 Commands | KEEP_ALWAYS_ON |
| v0.4–v0.8 lesson paragraphs (lines 14–55) | MOVE_TO_DOCUMENTATION → `docs/lessons.md` |
| §6 Layout tree | MOVE_TO_DOCUMENTATION (drifts every release; regenerable) |
| "Before opening a PR" prose | REMOVE_DUPLICATE (checklist owns it) |
| §7 Definition of done | REMOVE_DUPLICATE (checklist §1–5 owns it) |

No path-scoped rule files: this is a single-stack repo of ~40 source files, and splitting 110 lines
across five rule files would add indirection without saving context.

## 6. Exact changes

| File | Action |
|---|---|
| `CLAUDE.md` | Rewrite to ~110 lines; fix the stale "4 tabs"; link `docs/lessons.md` |
| `docs/lessons.md` | **New** — the v0.4–v0.8 lessons verbatim, on demand |
| `docs/claude-code-context-audit.md` | **New** — this report |
| `.claude/settings.json` | Unchanged |
| `.claude/agents/pre-pr.md`, `ai/skills/shared/pre-pr-checklist.md` | Unchanged — already on demand |
| Application source, `.maestro/`, `scripts/` | **Untouched** |

## 7. Expected reduction — stated plainly

- **Startup context: ~2.9k → ~1.5k tokens.** Real, and small.
- **MCP: up to ~46k** if the unused connectors are disabled — the largest config win by an order of
  magnitude, and it is an account-level decision, not a repo one.
- **Behavioural: the actual win.** Screenshots and unfiltered command output cost more than the
  entire configuration. No file edit fixes that.

I will not claim a percentage for the behavioural change; it is not measurable in advance.

## 8. Risks

- Moving lessons out of always-on context means a future session **will not** see them unless it
  reads `docs/lessons.md`. Several were expensive to learn (month-scoping, `router.back()`,
  `amountInBaseCurrency`). Mitigated by an explicit pointer, but this is a genuine trade.
- Disabling MCP connectors affects **every project**, not just this one.
- Disabling `claude-mem` loses cross-session recall. Its cost is real, but so is its value; I have
  not measured the latter.

## 9. Needs your decision

1. **Unused MCP connectors** (Gmail, Calendar, Drive, Slack) — ~46k tokens, unused here, but
   account-wide. Disable, or leave?
2. **`claude-mem` plugin** — six hook events, ~18 skills, per-read injections. Keep, trim to fewer
   hook events, or disable for this project?
3. ~~**Lessons**: move to `docs/`, or keep in always-on context and accept ~1.5k?~~ **Decided:
   moved to `docs/lessons.md`**, with a pointer at the top of `CLAUDE.md`. The trade in §8 stands.

## 10. Verification

- Re-run `/context` after a **fresh session** and compare the "Skills", "MCP tools" and message
  figures against the table in §2.
- `wc -l CLAUDE.md` before/after; confirm no `@import` was used to fake the reduction.
- Confirm `.claude/settings.json` and any edited JSON still parse.
- Confirm no secrets in the new docs (`TELEGRAM_*`, `PACKAGE_TOKEN`, `OPENAI_*`, admin password).
- Spot-check that the pre-PR agent and checklist still resolve.

---

## Operating rules I should have been following

These cost more than every file above combined, so I am stating them as commitments rather than
filing them somewhere:

- **Screenshot only when the answer is visual.** Prefer a Maestro assertion or `maestro hierarchy`.
  Never screenshot to confirm something a passing flow already proved.
- **Every Bash call ends in `head`/`tail`/`grep`.** I did this inconsistently and paid for it.
- **`Read` with `offset`/`limit`.** Do not re-read a file already in context.
- **Run the affected flow, not the suite**, until the final pre-PR pass.
- **One demo recording per release**, not per attempt.
