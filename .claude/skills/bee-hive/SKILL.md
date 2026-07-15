---
name: bee-hive
description: >-
  Bootstrap and route the bee workflow: gates, state, and the next skill. Use when starting or resuming any bee session, choosing the next bee skill, running go mode, checking onboarding state, or enforcing workflow gates.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: unavailable
      reason: Onboarding and the vendored .bee/bin helpers run in Node.js 18+.
---

# hive

Bootstrap meta-skill. Load this first in bee repos. It verifies onboarding, reads runtime state, routes to the next skill, and protects the four human approval gates.

For the full routing table, state bootstrap, resume logic, chaining contracts, and communication standards, open `references/routing-and-contracts.md`. For the full pipeline, open `references/go-mode.md`.

## Onboarding

1. Run `node --version`. Missing or below 18 → stop; bee requires Node.js 18+.
2. From this skill directory, run:
   ```bash
   node scripts/onboard_bee.mjs --repo-root <repo-root> --json
   ```
3. Inspect the result:
   - `status: "up_to_date"` → continue.
   - `status: "changes_needed"` → summarize the plan to the user, ask for approval, and only then re-run with `--apply`. Never apply silently. Never replace an existing compact prompt or AGENTS.md content outside the BEE markers without explicit consent. Every `--apply` also syncs the bee skill set into the host repo's two managed roots (`<repo>/.claude/skills/bee-*` for Claude Code, `<repo>/.agents/skills/bee-*` for Codex) in the same run — one command keeps vendored helpers and installed skills at the same version. The trees are committed to the host repo, never gitignored. `--global-skills` additionally syncs the legacy global `~/.claude/skills/bee-*` root; without the flag the global root is never read, written, or deleted. The payload's `skills.targets` carries one entry per target root: `{kind: "repo-claude" | "repo-agents" | "global", target_root, mode, blocked, versions, items}`. When the repo being onboarded contains the running script's own skill tree (bee's own repo), the per-project targets are skipped as a distinct noop (`mode: "self_skip"`) — global sync there is unchanged.
   - `status: "blocked_downgrade"` → the source tree is older than the repo's vendored helpers or a target's installed skills (or a version could not be read — reported as `unknown`, refused the same way). The three-version preflight runs per target; ANY blocked target blocks the whole run (blocked-first), zero mutations happen anywhere, and the top-level `reason`/`versions` surface the blocked target(s). Surface the reported `versions` to the user; only pass `--force-downgrade` on explicit user instruction, and only when every blocked target resolved all three versions numeric — an `unknown` version is never forceable.
   - `status: "blocked_no_source"` → no authoritative skill source resolved for this run (identity check failed, or source/target/repo roots overlap). Fail-closed, zero mutations, never forceable with `--force-downgrade` — surface it to the user and resolve the source location before retrying. `versions` is still reported on every blocked return (identity/overlap included), with `unknown` for each of the three (resolution was never attempted) — never `null`.
   - **Forced-apply transparency (D2):** whenever a blocked result is forceable, both the plain `--json` dry-run and a refused `--apply` (no `--force-downgrade` yet) carry every target's computed `items` inside `skills.targets` — the full per-target list of `sync_skill`/`remove_skill`/`blocked_*` items a `--force-downgrade` would apply. Show this list to the user BEFORE they authorize the force — it is exactly which skills get overwritten or DELETED, per target; a forced apply then executes precisely that reviewed set.
   - Every skill-stage item (`sync_skill`, `remove_skill`, `blocked_symlink`, `blocked_alias`) carries `target` (the target kind above) and `scope: "installed" | "source"`: `installed` means `path` is relative to that target's `target_root`, `source` means `path` is relative to the running script's own skill tree. Legacy plan items (AGENTS.md, `.bee/` runtime files, vendored helpers, etc.) carry no `scope` or `target` at all — they are always repo-relative. Never resolve a skill-stage `path` against `repo_root`.
   - A `blocked_symlink` item inside `plan` means one skill directory is a symlink and was skipped (not synced, not deleted) — surface it to the user; it does not block the rest of the apply.
   - **Recheck honesty (D5):** after `--apply`, the response's `recheck` field applies blocked-first precedence aggregated across ALL targets — if the skill-sync stage is still blocked post-apply on ANY target (e.g. a residual per-skill symlink/alias block left one skill's version marker un-synced after a forced downgrade), `recheck` reports that blocked status and can never read `"up_to_date"`, even when the rest of the plan is empty. `recheck_skills` carries `{blocked, reason, versions, targets}` whenever this fires.
   - `--repo-hooks` only when the user asks for repo-local hook wiring.
   - `--claude-md` only when plugin hooks are unavailable and the user wants the CLAUDE.md `@AGENTS.md` import fallback.

If onboarding is not complete, do not continue into the rest of the bee workflow.

**Greenfield init lane (P1, docs/09 item 6):** when the onboarding result carries the init-lane notice (first onboard, no detectable build), offer it before any feature work: the first planning slice is **one init cell** whose `must_haves` are exactly the initialization checklist — setup succeeds from scratch, one passing test exists, standard commands recorded in `.bee/config.json`, clean first commit. The user may decline; a declined offer is recorded as a deferred idea, never silently dropped.

## Session Scout

After onboarding succeeds, run the read-only scout on every session start and after compaction:

```bash
node .bee/bin/bee.mjs status --json
```

Orient on: onboarding health, phase, mode, feature, gate states, cell counts, active reservations, staleness warnings, and `recommended_next`.

**Baseline gate (docs/09 item 1):** if `.bee/config.json` records `commands.verify`, run it once per session before any cell is claimed. A red baseline is surfaced to the user and becomes its own fix-first tiny cell — never build on red. Commands come free in the session preamble; when none are recorded, `bee_status` warns and the capture belongs to exploring or onboarding, never to guesswork.

**HANDOFF:** if `.bee/HANDOFF.json` exists, check its kind (`bee state handoff show --json`; a missing/unknown kind reads as `pause`, fail-safe). A **pause** handoff — present its phase, feature, cells in flight, and next action to the user and **wait for confirmation. Never auto-resume.** A **planned-next** handoff (previous cell capped with green verify, next cell already claimed) is adopted automatically, but ONLY at this fresh-session boundary (`/clear` or a freshly started session) via `bee state handoff adopt` — present the adopted unit, its verify command, and its lane as a start-now instruction instead of a wait prompt. A resumed or memory-compacted session (not a fresh boundary) never adopts: same wait-and-confirm rule as pause.

**Capture queue (decision 0017):** when `bee_status` reports pending capture stubs, offer the flush before new work — "N settlement(s) from a previous session await their spec merge — flush now (a few minutes) or after the current task?" One line, user chooses; the queue is never silently ignored and never silently dropped.

**Review candidates (decision 565e68d0):** `bee_status --json` carries a `review` block — candidate counts by derived status (`unreviewed`/`in_review`/`reviewed`/`stale`) and any open review sessions. Independent review is user-invoked only (SPEC R1/R7): never self-dispatch a reviewer wave because candidates exist. When `high_risk_unreviewed > 0`, surface it plainly — a hard-gate change (auth, data loss, security, external provider) is sitting unreviewed — state the merge/release consequence and offer to start a review; do not label anything reviewed or approved until the user calls it.

Then read `docs/history/learnings/critical-patterns.md` and surface recent active decisions (`node .bee/bin/bee.mjs decisions active --recent 3`).

**State layer:** when `docs/specs/` exists, note it in the orientation summary. Before working in any area, the reading order is **spec → decisions → history**: read `docs/specs/<area>.md` (what the area does now) before its code, decisions for the why, `docs/history/` only for archaeology. `docs/specs/reading-map.md` answers "where does X live" before any broad grep. When `docs/specs/` lacks `system-overview.md` or `reading-map.md`, offer a `bee-scribing` bootstrap pass to skeleton the missing file(s) — user-approved, never silent, never auto-run (D2 of harness10).

**Delegation:** onboarding/version scans and any multi-file skill-inventory diff dispatch down-tier as I/O workers per the Delegation contract (`references/routing-and-contracts.md`) when the D2 rubric fires; routing, mode gate, and gate decisions always stay on the session model.

## Routing

| Request | Route |
|---|---|
| Vague or new feature | `bee-exploring` |
| Research task, clear scope | `bee-planning` |
| Small clear fix | `bee-planning` (tiny/small mode) |
| Docs/spec/README/sample-only change | docs lane — announce, write, format-check, capture; no pipeline |
| Review request (explicit — "review this", "review today's work", "review feature A and B", "review diff X..Y") | `bee-reviewing` |
| Merge/ship/release request while unreviewed or stale candidates exist | Report the candidate count + risk level, then ask ONE question: "Create a review session for this scope?" (SPEC 7.4/A9). Only an explicit yes dispatches `bee-reviewing` — never spawn a reviewer silently |
| Document a screen/API/job/area; "ghi lại rule này"; a just-settled rule/behavior/value to keep; spec an existing feature | `bee-scribing` |
| (Re)generate or read a feature's implement plan | `bee-briefing` |
| Clean up / debt / audit | `bee-grooming` |
| Capture learnings | `bee-compounding` |
| Author or edit a bee skill (SKILL.md content) | `bee-writing-skills` |
| Evolve bee from its own dogfood feedback (rank friction, ship a self-improvement) | `bee-evolving` |
| `/go` or full pipeline | go mode (`references/go-mode.md`) |
| Resume | surface HANDOFF, wait |

**Surface scope earlier:** if the request already contains concrete acceptance criteria *and* references to existing patterns, offer: "Found clear requirements. Jump straight to planning, or explore alternatives first?" On approval, route to planning with a one-paragraph scoping synthesis in place of CONTEXT.md gray-area work — the decisions still get D-IDs.

When in doubt, invoke `bee-exploring` first.

## Modes and Lanes (the mode gate)

Classification is **mechanical**. Count these risk flags:

> auth · authorization · data model · audit/security · external systems · public contracts · cross-platform · existing covered behavior · weak proof around the area · multi-domain

| Mode | Trigger |
|---|---|
| `docs` | every touched file is knowledge, not runtime: `docs/`, specs, README, sample/example configs, plans — nothing executes it |
| `tiny` | 0–1 flags, ≤2 files, no API/data change, one direct task |
| `spike` | one yes/no proof decides whether the plan is real |
| `small` | 0–1 flags, ≤three files, no gray areas |
| `standard` | 2–3 flags, or story-sized behavior |
| `high-risk` | 4+ flags **or any hard-gate flag** (auth, authorization, data loss, audit/security, external provider, validation removal) |

Use the least workflow that honestly protects the work. A tiny fix wearing epic ceremony is a red flag; a hard-gate change routed as `small` is a worse one.

**Ceremony scales with the lane (lanes scale ceremony, never memory):**

Review is on demand (SPEC R1/R3/R8, decision 565e68d0): no lane auto-dispatches a reviewer wave or asks Gate 4 after execution. Every lane below closes through scribing/compounding as `unreviewed`; a review session — and its Gate 4 — happens only when the user asks, over whatever scope they choose.

| Lane | Plan | Validate | Execute | Review | Human stops |
|---|---|---|---|---|---|
| `docs` | none — announce one line | format check (parse/lint if applicable) | direct, in-session | none | 0 |
| `tiny` | short `plan.md` direct note | 2-minute reality check inline, 0 ceremony subagents (I/O-offload workers exempt — Delegation contract) | direct, in-session (solo) | self-review + done-report (diff + fresh verify output) — unchanged, this is verification, not independent review | 1 — the merged shape+execution gate |
| `small` | short `plan.md` | inline reality gate + matrix, 0 ceremony subagents (I/O-offload workers exempt — Delegation contract); spike only if a blocking assumption demands it | direct, in-session (solo) | self-checks only, no auto reviewer (the correctness reviewer moves inside an on-demand review session) | 2 — merged shape+execution gate, self-checks close-out |
| `standard` | full `plan.md` | plan-checker + cell reviewer | swarm workers | on user request only: session panel scaled to scope risk (4 core reviewers) | 3 — Gates 1-3 |
| `high-risk` | `plan.md` + brief | persona panel | swarm workers | on user request only: session panel scaled to scope risk (full wave + conditionals) | 3 — Gates 1-3 |

**Gate 4 is additive, not counted above:** it is asked once, whenever a review session actually runs for that scope — never automatically at the end of a lane's default chain.

**Docs lane:** the change is knowledge upkeep, same class as capture — announce one line ("docs lane: writing X"), write it, run a format check when one exists (JSON parses, markdown lints), log a decision/capture stub when the content encodes a settled outcome. No cells, no gates, no reviewers. If the target path is outside the write-guard allowlist (`.bee/, docs/, plans/, AGENTS.md`) the hook will block the idle write — fall back to the tiny fast path instead of fighting the guard.

**Tiny fast path:** Gates 2 and 3 are presented as **one merged question** — "Work shape + execution: I'm about to do X via Y, verified by Z. Approve?" — approval records both `shape` and `execution`. The 2-minute reality check runs inline before that question (validating folds into planning; it does not disappear). After the work: no separate merge gate — the done-report (diff + fresh verify output + capture line) closes it. A real problem found during self-review stops and asks, always.

## The Four Gates

Never skipped, never batched, never self-approved — including go mode and headless mode. The **one** exception is the opt-in gate-bypass switch (`bee-bypass-gate` skill → `.bee/config.json` `gate_bypass: true`), which auto-approves Gates 1-3 for `tiny`/`small`/`standard` work only; high-risk/hard-gate work, secrets, and Gate 4 UAT always stop (full rule: the Gate Presentation Contract in `references/routing-and-contracts.md`). Headless is not bypass — headless still stops at every gate.

- **Gate 1:** "Decisions locked. Approve CONTEXT.md before planning?"
- **Gate 2:** "Work shape is ready. Approve before current-work preparation?"
- **Gate 3:** "Feasibility validated. Approve execution?"
- **Gate 4:** P1 > 0 → "P1 findings block merge. Fix before proceeding?" ; P1 = 0 → "Review complete. Approve merge?"

**Gate 4 lives only inside a user-invoked review session (SPEC R8, decision 565e68d0).** It is asked when the user has explicitly called for independent review over a scope, never automatically after any lane's execution completes and never after an unreviewed feature close. Gate bypass never creates or auto-approves a review session — bypass covers Gates 1-3 only, and even inside a running session Gate 4's UAT items and any P1 always stop for the human.

Lane exceptions (Modes and Lanes table): `docs` lane has no gates; `tiny` and `small` merge Gates 2+3 into one shape+execution question. Gates 1-3 are otherwise unchanged and asked one at a time; Gate 4 is never part of a lane's default chain for any lane, `tiny` through `high-risk` — it exists only inside an on-demand review session.

**Presentation:** every gate is presented per the Gate Presentation Contract (`references/routing-and-contracts.md`): the chat message is the plain-language layer only — what I'm about to do / why it's trustworthy / if it goes wrong / what you are deciding, in the user's language — then the fixed question. The full mechanical report goes to `docs/history/<feature>/reports/` and is linked, never pasted. Litmus: the user can restate what they are approving in their own words.

Optional at Gates 2–4: a cross-model second opinion. Agreement → mention it. Disagreement → quote both positions to the user. Never auto-resolve.

## Priority Rules (hive law)

1. P1 review findings always block.
2. Context budget always applies; at ~65%, write `.bee/HANDOFF.json` and pause.
3. `CONTEXT.md` is the source of truth; locked decisions are cited, never reinterpreted.
4. Gate 3 is the critical execution approval; no source-editing execution before it.
5. A failed reality gate or a NO spike halts the pipeline and returns to planning.
6. Never skip validating — in tiny mode it collapses to a 2-minute reality check, it does not disappear.
7. `docs/history/learnings/critical-patterns.md` and recent active decisions are mandatory context before planning or executing.
8. Evidence before claims: any "done/passing/fixed" statement requires fresh command output in the same message.
9. Lanes scale ceremony, never memory: a capped `behavior_change` cell obliges a `bee-scribing` sync in every lane — tiny included — and a settled discussion outcome (rule, behavior, tuned value; backend or frontend alike) is captured the moment it settles. **Settlement detection is the agent's duty, unprompted:** the routing row "user asks to document" is the fallback, not the norm — the norm is the agent noticing "this just settled", announcing it in one line, and capturing in the same turn without being asked. What same-turn capture costs is lane-scaled (decision 0017): high-risk = full spec sync inline; every other lane = decision log + a one-line capture stub (`bee.mjs capture add`), with the full merge at a flush point (wrap-up, PreCompact warning, or next session's offer). Capture writes only `docs/` + `.bee/` — no gate applies.
10. **The agent runs the machinery, not the user.** Every bee command (`bee_status`, `bee_cells`, `bee_reservations`, `bee_decisions`, onboarding, cell verify commands) is run by the agent itself the moment the workflow calls for it — never printed for the user to execute, never "run this and tell me the output". The only human actions in bee are gate approvals, decision answers, and privacy approvals.
11. **Silent bookkeeping — work language only (decision 1689af1b).** Bee mechanics — cells, claims, caps, status/state writes, reservations, phase names — are never narrated into chat. The user hears the work itself in their own terms ("fixing X", "done — tests pass"). Bee vocabulary appears only when the user asks about bee directly or a gate needs their decision, and gate questions are already phrased in work language per the presentation contract. Full rule: Silent Bookkeeping in `references/routing-and-contracts.md`.
12. **Never hand-edit `.bee/*.json(l)`.** Every state mutation goes through its CLI (`bee.mjs state set|gate|worker|scribing-run`, `bee.mjs backlog add`, `bee.mjs cells`, `bee.mjs reservations`, `bee.mjs decisions`). A mutation with no CLI verb is filed as friction via `bee.mjs backlog add`, then (only then) edited by hand.
13. **The hook is a safety net, not the authority (decision c2c46488).** The law is AGENTS.md — route through bee-hive before touching source, every time. Hooks catch the times you forget; their silence is never permission. Never reason "I'll try the edit, and route through bee only if the hook blocks me": that inverts the contract, promotes the guard's coverage into the protocol, and turns every gap in the guard into a gap in the workflow. An unblocked write is not an approved write.

## Runtime Files

- `.bee/onboarding.json` — onboarding status and managed versions
- `.bee/state.json` — phase, mode, feature, approved gates, workers
- `.bee/config.json` — hook toggles, lanes, capabilities
- `.bee/HANDOFF.json` — pause/resume data
- `.bee/reservations.json` — file reservations
- `.bee/decisions.jsonl` / `.bee/backlog.jsonl` — decision log / friction items
- `.bee/capture-queue.jsonl` — settlement stubs awaiting their flush (decision 0017)
- `.bee/cells/<id>.json` — one cell per file
- `.bee/bin/` — vendored helpers (`bee_status`, `bee_cells`, `bee_reservations`, `bee_decisions`, `bee_capture`) + `lib/`
- `docs/history/<feature>/CONTEXT.md` — locked decisions, source of truth
- `docs/history/learnings/critical-patterns.md` — mandatory pre-work reading
- `docs/specs/<area>.md` + `docs/specs/reading-map.md` — state layer, owned by `bee-scribing`: BA-grade tech-agnostic spec per area, and what lives where (read spec before code)

## Hook Response Protocol

Hooks block or inject; the agent responds by contract.

**Hooks are a safety net, not the authority (hive law 13).** They catch what you forget; their silence is not permission. Read the block reasons below as *reminders of the law*, never as the law itself — the law is: route through bee-hive before source is touched.

- `@@BEE_PRIVACY@@ … @@END@@` marker on a read → route through AskUserQuestion with the file and question from the marker. Never work around the block.
- Intake block (`bee intake gate`, a terminal phase — `idle` or `compounding-complete`) → do **not** retry the write; this session has no active bee work (nothing started, or the last feature already closed). Run bee-hive routing now: classify the mode, create the cell(s), pass the gates, then execute. Tiny fixes stay tiny.
- Gate-guard block on a write → do **not** retry the write; surface the Gate 3 question to the user ("Feasibility validated. Approve execution?").
- Reservation block → the worker returns `[BLOCKED]` with the conflict; the orchestrator fixes reservations or cell scope.
- `bee decision review` nudge at session end → ask the user whether a durable decision/learning emerged; log it via `bee.mjs decisions log` if yes.

## Headless

With `mode:headless`: never ask blocking questions. Perform onboarding checks and routing only when unambiguous; defer every ambiguity (stale onboarding needing `--apply`, HANDOFF present, unclear route) into an `Outstanding Questions` section of a structured terminal report. The four gates are NEVER self-approved in headless mode — the only mode that self-approves gates is the explicit opt-in gate-bypass switch (and only for normal-lane work, never high-risk/hard-gate/UAT/secrets). Headless and bypass are independent: headless without bypass still stops at every gate.

## Red Flags

- a docs-only change routed through the full pipeline · jumping from exploring to swarming · code before CONTEXT.md exists · skipping validating · ignoring locked decisions · workers self-selecting cells · capping without verification · commits without cell ids · continuing past open P1s · reservation leaks · stale state.json after a phase transition · resuming without surfacing HANDOFF.json · plausibility language ("should work") accepted as evidence · a tiny fix wearing epic ceremony · a hard-gate change routed below high-risk · session history pasted into a worker dispatch · a gate presented as a mechanical table with no plain-language layer · a gate question the user cannot restate in their own words · a bee command handed to the user to run instead of run by the agent · bee bookkeeping (cells, claims, status, phases) narrated into chat instead of the work itself

Violating the letter of the rules is violating the spirit of the rules.

Session oriented and route chosen. Invoke bee-<selected-skill> skill.
