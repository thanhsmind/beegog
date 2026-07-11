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
   - `status: "changes_needed"` → summarize the plan to the user, ask for approval, and only then re-run with `--apply`. Never apply silently. Never replace an existing compact prompt or AGENTS.md content outside the BEE markers without explicit consent. Every `--apply` also syncs the global bee skill set (`~/.claude/skills/bee-*`) in the same run — one command keeps vendored helpers and installed skills at the same version.
   - `status: "blocked_downgrade"` → the source tree is older than the repo's vendored helpers or the installed skills (or a version could not be read — reported as `unknown`, refused the same way). Zero mutations happen anywhere. Surface the reported `versions` to the user; only pass `--force-downgrade` on explicit user instruction, and only when all three versions resolved numeric — an `unknown` version is never forceable.
   - `status: "blocked_no_source"` → no authoritative skill source resolved for this run (or source/target roots overlap). Fail-closed, zero mutations, never forceable with `--force-downgrade` — surface it to the user and resolve the source location before retrying.
   - A `blocked_symlink` item inside `plan` means one skill directory is a symlink and was skipped (not synced, not deleted) — surface it to the user; it does not block the rest of the apply.
   - `--repo-hooks` only when the user asks for repo-local hook wiring.
   - `--claude-md` only when plugin hooks are unavailable and the user wants the CLAUDE.md `@AGENTS.md` import fallback.

If onboarding is not complete, do not continue into the rest of the bee workflow.

**Greenfield init lane (P1, docs/09 item 6):** when the onboarding result carries the init-lane notice (first onboard, no detectable build), offer it before any feature work: the first planning slice is **one init cell** whose `must_haves` are exactly the initialization checklist — setup succeeds from scratch, one passing test exists, standard commands recorded in `.bee/config.json`, clean first commit. The user may decline; a declined offer is recorded as a deferred idea, never silently dropped.

## Session Scout

After onboarding succeeds, run the read-only scout on every session start and after compaction:

```bash
node .bee/bin/bee_status.mjs --json
```

Orient on: onboarding health, phase, mode, feature, gate states, cell counts, active reservations, staleness warnings, and `recommended_next`.

**Baseline gate (docs/09 item 1):** if `.bee/config.json` records `commands.verify`, run it once per session before any cell is claimed. A red baseline is surfaced to the user and becomes its own fix-first tiny cell — never build on red. Commands come free in the session preamble; when none are recorded, `bee_status` warns and the capture belongs to exploring or onboarding, never to guesswork.

**HANDOFF:** if `.bee/HANDOFF.json` exists, present its phase, feature, cells in flight, and next action to the user and **wait for confirmation. Never auto-resume.**

**Capture queue (decision 0017):** when `bee_status` reports pending capture stubs, offer the flush before new work — "N settlement(s) from a previous session await their spec merge — flush now (a few minutes) or after the current task?" One line, user chooses; the queue is never silently ignored and never silently dropped.

Then read `docs/history/learnings/critical-patterns.md` and surface recent active decisions (`node .bee/bin/bee_decisions.mjs active --recent 3`).

**State layer:** when `docs/specs/` exists, note it in the orientation summary. Before working in any area, the reading order is **spec → decisions → history**: read `docs/specs/<area>.md` (what the area does now) before its code, decisions for the why, `docs/history/` only for archaeology. `docs/specs/reading-map.md` answers "where does X live" before any broad grep. When `docs/specs/` lacks `system-overview.md` or `reading-map.md`, offer a `bee-scribing` bootstrap pass to skeleton the missing file(s) — user-approved, never silent, never auto-run (D2 of harness10).

## Routing

| Request | Route |
|---|---|
| Vague or new feature | `bee-exploring` |
| Research task, clear scope | `bee-planning` |
| Small clear fix | `bee-planning` (tiny/small mode) |
| Docs/spec/README/sample-only change | docs lane — announce, write, format-check, capture; no pipeline |
| Review request | `bee-reviewing` |
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
| `small` | 0–1 flags, ≤3 files, no gray areas |
| `standard` | 2–3 flags, or story-sized behavior |
| `high-risk` | 4+ flags **or any hard-gate flag** (auth, authorization, data loss, audit/security, external provider, validation removal) |

Use the least workflow that honestly protects the work. A tiny fix wearing epic ceremony is a red flag; a hard-gate change routed as `small` is a worse one.

**Ceremony scales with the lane (lanes scale ceremony, never memory):**

| Lane | Plan | Validate | Execute | Review | Human stops |
|---|---|---|---|---|---|
| `docs` | none — announce one line | format check (parse/lint if applicable) | direct, in-session | none | 0 |
| `tiny` | short `plan.md` direct note | 2-minute reality check inline, 0 subagents | direct, in-session (solo) | self-review + done-report (diff + fresh verify output) | 1 — the merged shape+execution gate |
| `small` | short `plan.md` | inline reality gate + matrix, 0 subagents; spike only if a blocking assumption demands it | direct, in-session (solo) | 1 correctness reviewer + self-checks | 2 — merged shape+execution gate, Gate 4 |
| `standard` | full `plan.md` | plan-checker + cell reviewer | swarm workers | 4 core reviewers | 4 gates |
| `high-risk` | `plan.md` + brief | persona panel | swarm workers | full wave + conditionals | 4 gates |

**Docs lane:** the change is knowledge upkeep, same class as capture — announce one line ("docs lane: writing X"), write it, run a format check when one exists (JSON parses, markdown lints), log a decision/capture stub when the content encodes a settled outcome. No cells, no gates, no reviewers. If the target path is outside the write-guard allowlist (`.bee/, docs/, .spikes/, plans/, AGENTS.md`) the hook will block the idle write — fall back to the tiny fast path instead of fighting the guard.

**Tiny fast path:** Gates 2 and 3 are presented as **one merged question** — "Work shape + execution: I'm about to do X via Y, verified by Z. Approve?" — approval records both `shape` and `execution`. The 2-minute reality check runs inline before that question (validating folds into planning; it does not disappear). After the work: no separate merge gate — the done-report (diff + fresh verify output + capture line) closes it. A real problem found during self-review stops and asks, always.

## The Four Gates

Never skipped, never batched, never self-approved — including go mode and headless mode. The **one** exception is the opt-in gate-bypass switch (`bee-bypass-gate` skill → `.bee/config.json` `gate_bypass: true`), which auto-approves Gates 1-3 for `tiny`/`small`/`standard` work only; high-risk/hard-gate work, secrets, and Gate 4 UAT always stop (full rule: the Gate Presentation Contract in `references/routing-and-contracts.md`). Headless is not bypass — headless still stops at every gate.

- **Gate 1:** "Decisions locked. Approve CONTEXT.md before planning?"
- **Gate 2:** "Work shape is ready. Approve before current-work preparation?"
- **Gate 3:** "Feasibility validated. Approve execution?"
- **Gate 4:** P1 > 0 → "P1 findings block merge. Fix before proceeding?" ; P1 = 0 → "Review complete. Approve merge?"

Lane exceptions (Modes and Lanes table): `docs` lane has no gates; `tiny` and `small` merge Gates 2+3 into one shape+execution question, and `tiny` closes with a done-report instead of Gate 4. Every other lane asks all four, one at a time.

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
9. Lanes scale ceremony, never memory: a capped `behavior_change` cell obliges a `bee-scribing` sync in every lane — tiny included — and a settled discussion outcome (rule, behavior, tuned value; backend or frontend alike) is captured the moment it settles. **Settlement detection is the agent's duty, unprompted:** the routing row "user asks to document" is the fallback, not the norm — the norm is the agent noticing "this just settled", announcing it in one line, and capturing in the same turn without being asked. What same-turn capture costs is lane-scaled (decision 0017): high-risk = full spec sync inline; every other lane = decision log + a one-line capture stub (`bee_capture.mjs add`), with the full merge at a flush point (wrap-up, PreCompact warning, or next session's offer). Capture writes only `docs/` + `.bee/` — no gate applies.
10. **The agent runs the machinery, not the user.** Every bee command (`bee_status`, `bee_cells`, `bee_reservations`, `bee_decisions`, onboarding, cell verify commands) is run by the agent itself the moment the workflow calls for it — never printed for the user to execute, never "run this and tell me the output". The only human actions in bee are gate approvals, decision answers, and privacy approvals.

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

Hooks block or inject; the agent responds by contract:

- `@@BEE_PRIVACY@@ … @@END@@` marker on a read → route through AskUserQuestion with the file and question from the marker. Never work around the block.
- Intake block (`bee intake gate`, phase idle) → do **not** retry the write; this session has no active bee work yet. Run bee-hive routing now: classify the mode, create the cell(s), pass the gates, then execute. Tiny fixes stay tiny.
- Gate-guard block on a write → do **not** retry the write; surface the Gate 3 question to the user ("Feasibility validated. Approve execution?").
- Reservation block → the worker returns `[BLOCKED]` with the conflict; the orchestrator fixes reservations or cell scope.
- `bee decision review` nudge at session end → ask the user whether a durable decision/learning emerged; log it via `bee_decisions.mjs log` if yes.

## Headless

With `mode:headless`: never ask blocking questions. Perform onboarding checks and routing only when unambiguous; defer every ambiguity (stale onboarding needing `--apply`, HANDOFF present, unclear route) into an `Outstanding Questions` section of a structured terminal report. The four gates are NEVER self-approved in headless mode — the only mode that self-approves gates is the explicit opt-in gate-bypass switch (and only for normal-lane work, never high-risk/hard-gate/UAT/secrets). Headless and bypass are independent: headless without bypass still stops at every gate.

## Red Flags

- a docs-only change routed through the full pipeline · jumping from exploring to swarming · code before CONTEXT.md exists · skipping validating · ignoring locked decisions · workers self-selecting cells · capping without verification · commits without cell ids · continuing past open P1s · reservation leaks · stale state.json after a phase transition · resuming without surfacing HANDOFF.json · plausibility language ("should work") accepted as evidence · a tiny fix wearing epic ceremony · a hard-gate change routed below high-risk · session history pasted into a worker dispatch · a gate presented as a mechanical table with no plain-language layer · a gate question the user cannot restate in their own words · a bee command handed to the user to run instead of run by the agent

Violating the letter of the rules is violating the spirit of the rules.

Session oriented and route chosen. Invoke bee-<selected-skill> skill.
