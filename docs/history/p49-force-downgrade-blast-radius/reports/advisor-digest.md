OpenAI Codex v0.144.4
--------
workdir: /home/thanhsmind/projects/goglbe/beegog
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 019f7339-bf04-7300-8658-77481bce5535
--------
user
# Advisor consult — orchestrator pre-Gate-3 ask (lane: small, voluntary)

Feature: p49-force-downgrade-blast-radius (bee repo, onboarding CLI `skills/bee-hive/scripts/onboard_bee.mjs`)

## Plan summary

PBI P49 (v1.1.0 review P2): when onboarding refuses `--apply` on a forceable `blocked_downgrade`, the refusal payload the operator reads before deciding to pass `--force-downgrade` does not enumerate the `.bee/bin/**` runtime files (`copy_lib`/`copy_helper` plan items) the forced apply would overwrite. Dry-run mode already includes the full `plan`; the refused-apply object (`applyPlan()` onboard_bee.mjs:2388-2397, emitted main():2839-2856) carries only `{blocked, versions, skills.targets, beeVersion}` — and for the runtime-lib guard (`hostLibDowngradeBlock` :933-965) per-target skill items stay `[]`, so the operator sees nothing about the lib/helper blast radius.

Fix shape: add a `host_items` array — repoRoot-relative `{action: "copy_lib"|"copy_helper", path}` filtered from the already-computed `plan` — to the refused-apply blocked response when the block is forceable, mirroring the existing D2 forced-apply-transparency precedent for skill items (`computeSkillSyncTarget()` :883-894). No change to guard logic, block conditions, or what a forced apply executes. One cell, small lane: edit onboard_bee.mjs + add a three-step test in test_onboard_bee.mjs following the "10v. forced-apply transparency" pattern (:3260-3328): dry-run enumerates → refused apply enumerates → forced apply touches exactly the previewed set. Projected skill-tree copies (.claude/skills, .agents/skills) re-sync via self-onboard --apply, never hand-edited.

## Risk map

- applyPlan refusal payload shape: LOW — additive field; existing tests assert present fields, never absence of others (tolerant-net pattern).
- Test fixture drift: LOW — reuse 10v's own fixture scenario; known trap: hand-kept fixture lists rot (recurred 3x in this repo), so the test derives expectations from the computed plan, not a hand list.
- Semantics risk: `--force-downgrade` applies the WHOLE plan (skills + lib/helpers). The new field must reflect the plan actually pending at refusal time, not a recomputation that could drift.

## Validation findings

- Anchors verified by read-only code scan: plan items built at :2106 (copy_helper) / :2121 (copy_lib), repoRoot-relative, no scope field; refusal object built :2388-2397 with no plan key; force path :2367-2399 falls through to the write loop applying every pre-built plan item.
- Baseline full verify: green (exit 0) this session, pre-change.
- Existing coverage: flatSkillItems helper (test:1618-1620) asserts only skills.targets[].items; no test today asserts lib/helper enumeration in the refusal payload.

## Questions for the adviser

1. Any defect class or edge in this shape (e.g. forceable-vs-non-forceable gating of `host_items`, empty-drift case, unknown-version case) that the three-step test would miss?
2. Is `host_items` the right placement (sibling of `skills` in the refusal payload) versus attaching under `blocked`? Any compatibility concern for consumers parsing the refusal object?
3. Anything about the D2 precedent we would violate by NOT tagging these items with `scope`/`target` fields (skill items carry them; lib/helper items historically do not)?

Answer with: verdict (PROCEED / PROCEED-WITH-CHANGES / STOP), then numbered findings.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
hook: SessionStart
hook: SessionStart
hook: SessionStart Completed
hook: SessionStart Completed
hook: UserPromptSubmit
hook: UserPromptSubmit Completed
codex
I’m routing this through the repository’s bee session rules first, then I’ll check the refusal contract and the existing transparency test before giving the verdict.
hook: PreToolUse
hook: PreToolUse Completed
exec
/bin/bash -lc "sed -n '1,240p' /home/thanhsmind/projects/goglbe/beegog/.agents/skills/bee-hive/SKILL.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 218ms:
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
| `tiny` | short `plan.md` direct note | 2-minute reality check inline, 0 ceremony subagents (I/O-offload workers exempt — Delegation contract) | one dispatched execution worker (AO14 — param-carrying dispatch, model param or pinned type, never a bare marker; standard worker prompt template, no reviewers/panels/waves) | orchestrator-authored done-report (worker's verbatim diff + orchestrator's own fresh verify re-run) — unchanged, this is verification, not independent review | 1 — the merged shape+execution gate |
| `small` | short `plan.md` | inline reality gate + matrix, 0 ceremony subagents (I/O-offload workers exempt — Delegation contract); spike only if a blocking assumption demands it | one dispatched execution worker (AO14 — same contract as `tiny`'s Execute column) | orchestrator-authored done-report, self-checks only, no auto reviewer (the correctness reviewer moves inside an on-demand review session) | 2 — merged shape+execution gate, self-checks close-out |
| `standard` | full `plan.md` | plan-checker + cell reviewer | swarm workers | on user request only: session panel scaled to scope risk (4 core reviewers) | 3 — Gates 1-3 |
| `high-risk` | `plan.md` + brief | persona panel | swarm workers | on user request only: session panel scaled to scope risk (full wave + conditionals) | 3 — Gates 1-3 |

**Gate 4 is additive, not counted above:** it is asked once, whenever a review session actually runs for that scope — never automatically at the end of a lane's default chain.

**Docs lane:** the change is knowledge upkeep, same class as capture — announce one line ("docs lane: writing X"), write it, run a format check when one exists (JSON parses, markdown lints), log a decision/capture stub when the content encodes a settled outcome. No cells, no gates, no reviewers. If the target path is outside the write-guard allowlist (`.bee/, docs/, plans/, AGENTS.md`) the hook will block the idle write — fall back to the tiny fast path instead of fighting the guard.

**Tiny fast path:** Gates 2 and 3 are presented as **one merged question** — "Work shape + execution: I'm about to do X via Y, verified by Z. Approve?" — approval records both `shape` and `execution`. The 2-minute reality check runs inline before that question (validating folds into planning; it does not disappear). Implementation itself runs through the one dispatched execution worker named in the Execute column above (AO14) — never in-session. After the worker returns: no separate merge gate — the orchestrator authors the done-report itself (the worker's verbatim diff plus the orchestrator's own independent verify re-run, never the worker's word) and that done-report (diff + fresh verify output + capture line) closes it. A real problem found during the orchestrator's own review stops and asks, always.

## The Four Gates

Never skipped, never batched, never self-approved — including go mode and headless mode. The **one** exception is the opt-in gate-bypass switch (`bee-bypass-gate` skill → `.bee/config.json` `gate_bypass`), which is a **level**: `normal` (legacy `true`) auto-approves Gates 1-3 for `tiny`/`small`/`standard` work only — high-risk/hard-gate work, secrets, and Gate 4 UAT still stop; `full` also auto-approves high-risk/hard-gate Gates 1-3 (only secret reads and a review P1 still stop); `total` auto-approves everything and stops for nothing at all. When the human sets `full`/`total` they have deliberately lifted the high-risk floor — honor it, do not re-erect a stop they removed (full rule: the Gate Presentation Contract in `references/routing-and-contracts.md`). Headless is not bypass — headless still stops at every gate.

- **Gate 1:** "Decisions locked. Approve CONTEXT.md before planning?"
- **Gate 2:** "Work shape is ready. Approve before current-work preparation?"
- **Gate 3:** "Feasibility validated. Approve execution?"
- **Gate 4:** P1 > 0 → "P1 findings block merge. Fix before proceeding?" ; P1 = 0 → "Review complete. Approve merge?"

**Gate 4 lives only inside a user-invoked review session (SPEC R8, decision 565e68d0).** It is asked when the user has explicitly called for independent review over a scope, never automatically after any lane's execution completes and never after an unreviewed feature close. Gate bypass never *creates* a review session at any level. Under `normal`/`full`, even inside a running session Gate 4's UAT items and any P1 always stop for the human; only `total` auto-proceeds on them (the human chose zero stops).

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
12. **Never hand-edit `.bee/*.json(l)`.** Every state mutation goes through its CLI (`bee.mjs state set|gate|worker|scribing-run`, `bee.mjs backlog add`, `bee.mjs cells`, `bee.mjs reservations`, `bee.mjs decisions`). Generic `state set` additionally requires `--owner <selected record's pre-mutation phase>`; the owner is checked, rolls forward with a successful phase transition, and is never persisted. Dedicated `state gate` does not accept ownership. A mutation with no CLI verb is filed as friction via `bee.mjs backlog add`, then (only then) edited by hand.
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

With `mode:headless`: never ask blocking questions. Perform onboarding checks and routing only when unambiguous; defer every ambiguity (stale onboarding needing `--apply`, HANDOFF present, unclear route) into an `Outstanding Questions` section of a structured terminal report. The four gates are NEVER self-approved in headless mode — the only mechanism that self-approves gates is the explicit opt-in gate-bypass switch, and how far it reaches is its level (`normal` = normal-lane only; `full` = also high-risk/hard-gate; `total` = everything incl. UAT/secrets). Headless and bypass are independent: headless without bypass still stops at every gate.

## Red Flags

- a docs-only change routed through the full pipeline · jumping from exploring to swarming · code before CONTEXT.md exists · skipping validating · ignoring locked decisions · workers self-selecting cells · capping without verification · commits without cell ids · continuing past open P1s · reservation leaks · stale state.json after a phase transition · resuming without surfacing HANDOFF.json · plausibility language ("should work") accepted as evidence · a tiny fix wearing epic ceremony · a hard-gate change routed below high-risk · session history pasted into a worker dispatch · a gate presented as a mechanical table with no plain-language layer · a gate question the user cannot restate in their own words · a bee command handed to the user to run instead of run by the agent · bee bookkeeping (cells, claims, status, phases) narrated into chat instead of the work itself

Violating the letter of the rules is violating the spirit of the rules.

Session oriented and route chosen. Invoke bee-<selected-skill> skill.

hook: PreToolUse
hook: PreToolUse Completed
exec
/bin/bash -lc 'node --version && node /home/thanhsmind/projects/goglbe/beegog/.agents/skills/bee-hive/scripts/onboard_bee.mjs --repo-root /home/thanhsmind/projects/goglbe/beegog --json && node .bee/bin/bee.mjs status --json && node .bee/bin/bee.mjs decisions active --recent 3' in /home/thanhsmind/projects/goglbe/beegog
 exited 1 in 352ms:
v24.14.1
{
  "repo_root": "/home/thanhsmind/projects/goglbe/beegog",
  "status": "changes_needed",
  "source": "project_projection",
  "bee_version": "1.5.0",
  "plan": [
    {
      "action": "write_onboarding",
      "path": ".bee/onboarding.json"
    }
  ],
  "skills": {
    "source_root": "/home/thanhsmind/projects/goglbe/beegog/.agents/skills",
    "targets": [
      {
        "kind": "repo-claude",
        "target_root": "/home/thanhsmind/projects/goglbe/beegog/.claude/skills",
        "mode": "sync",
        "versions": {
          "source": "1.5.0",
          "host_helpers": "1.5.0",
          "installed_skills": "1.5.0"
        },
        "blocked": null,
        "items": []
      },
      {
        "kind": "repo-agents",
        "target_root": "/home/thanhsmind/projects/goglbe/beegog/.agents/skills",
        "mode": "noop",
        "versions": {
          "source": "1.5.0",
          "host_helpers": "1.5.0",
          "installed_skills": "1.5.0"
        },
        "blocked": null,
        "items": []
      }
    ]
  },
  "notices": []
}
node:fs:2413
    return binding.writeFileUtf8(
                   ^

Error: EROFS: read-only file system, open '/home/thanhsmind/projects/goglbe/beegog/.bee/cache/manifest-hash.json.tmp'
    at Object.writeFileSync (node:fs:2413:20)
    at writeJsonAtomic (file:///home/thanhsmind/projects/goglbe/beegog/.bee/bin/lib/fsutil.mjs:73:6)
    at checkManifestDrift (file:///home/thanhsmind/projects/goglbe/beegog/.bee/bin/bee.mjs:2663:3)
    at main (file:///home/thanhsmind/projects/goglbe/beegog/.bee/bin/bee.mjs:2773:17)
    at file:///home/thanhsmind/projects/goglbe/beegog/.bee/bin/bee.mjs:2878:22
    at ModuleJob.run (node:internal/modules/esm/module_job:430:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:661:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  errno: -30,
  code: 'EROFS',
  syscall: 'open',
  path: '/home/thanhsmind/projects/goglbe/beegog/.bee/cache/manifest-hash.json.tmp'
}

Node.js v24.14.1

codex
The checkout is structurally on bee 1.5.0; its onboarding check only wants to refresh the onboarding metadata file, while this environment is read-only. I’ll keep this consult strictly read-only and use the already-green baseline reported for this session.
hook: PreToolUse
hook: PreToolUse Completed
exec
/bin/bash -lc "wc -l .agents/skills/bee-hive/references/routing-and-contracts.md .agents/skills/bee-planning/SKILL.md docs/history/learnings/critical-patterns.md docs/specs/reading-map.md && sed -n '1,260p' .agents/skills/bee-hive/references/routing-and-contracts.md && sed -n '261,520p' .agents/skills/bee-hive/references/routing-and-contracts.md && sed -n '521,780p' .agents/skills/bee-hive/references/routing-and-contracts.md && sed -n '1,260p' .agents/skills/bee-planning/SKILL.md && sed -n '1,240p' docs/history/learnings/critical-patterns.md && sed -n '1,240p' docs/specs/reading-map.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 241ms:
  306 .agents/skills/bee-hive/references/routing-and-contracts.md
  122 .agents/skills/bee-planning/SKILL.md
  536 docs/history/learnings/critical-patterns.md
   78 docs/specs/reading-map.md
 1042 total
# Routing And Contracts Reference

Open this when the compact bootstrap in `SKILL.md` is not enough.

## Skill Catalog

| # | Skill | One-line description | Load when... |
|---|-------|----------------------|--------------|
| 1 | `bee-hive` | Routing, go mode, gates, red flags. | Starting any session |
| 2 | `bee-exploring` | Identify gray areas, lock decisions into `CONTEXT.md`. | Feature request is vague or new |
| 3 | `bee-planning` | Research, mode gate, approach, unified plan, current-slice cells. | Decisions are locked, or scope is already clear |
| 4 | `bee-validating` | Reality gate, feasibility matrix, spikes, plan-checker, cell review. | Work shape is approved |
| 5 | `bee-swarming` | Launch and tend bounded workers with reservations. | Gate 3 approved |
| 6 | `bee-executing` | Bounded worker loop for one cell. | Spawned by swarming |
| 7 | `bee-reviewing` | Parallel review gate with P1/P2/P3 findings, user-invoked over a scope the user chooses. | User explicitly requests review (decision 565e68d0) — never automatic after a final slice or feature close |
| 8 | `bee-scribing` | BA-grade tech-agnostic area specs: sync, capture, harvest. | Review approved; documenting any area (UI/API/job); a settled outcome must be kept |
| 9 | `bee-compounding` | Capture durable learnings and decisions. | Scribing done or work abandoned |
| 10 | `bee-grooming` | Entropy audit, debt hunt, approved kills. | Cleanup/audit requested; hive idle |
| 11 | `bee-writing-skills` | TDD-for-skills, pressure testing. | Authoring or editing a bee skill's `SKILL.md` content |
| 12 | `bee-evolving` | Run bee's gated self-improvement loop over its own collected feedback digest (cluster → rank → Gate A → Iron Law hand-off → suites green → Gate B → push). Bee repo only, human-invoked, never auto-runs, never pushes on its own. | Human asks bee to evolve/improve itself from its own dogfood friction, in the bee repository |
| 13 | `bee-briefing` | Render the one human-readable implement plan per feature, and the post-Gate-4 walkthrough (consolidator, not planner). | Planning shaped `small`+ work; a feature's implement plan needs (re)generating; a `standard`/`high-risk` feature passed Gate 4 |
| 14 | `bee-bypass-gate` | Toggle opt-in gate-bypass autopilot (`on`/`off`/`status`): auto-approve Gates 1-3 for normal-lane work; high-risk/hard-gate, secrets, UAT always stop. | User wants to run without approving every gate, or to check/turn off bypass |

## First-Skill Routing

| Request type | First skill | Notes |
|---|---|---|
| Vague/new feature | `bee-exploring` | Always start here if gray areas exist |
| Research a topic/library/approach (no feature underway) | `bee-xia` | Standalone brief; suggests exploring or planning as next step |
| (Re)generate or read a feature's implement plan or walkthrough | `bee-briefing` | Consolidates the truth artifacts into `docs/history/<feature>/implement-plan.md`, any phase; writes `walkthrough.md` post-Gate-4 for `standard`/`high-risk`; renders nothing for `tiny`/`spike` |
| Research inside a scoped feature | `bee-planning` | Discovery L2/L3 invokes `bee-xia` in-chain |
| "Just fix this" / small change | `bee-planning` | Route in tiny or small mode |
| Review code | `bee-reviewing` | Load directly — only on an explicit review request (decision 565e68d0); never automatic after execution completes |
| Document a screen/API/job/area; keep a settled outcome (rule agreed, behavior confirmed, value tuned); spec a legacy area | `bee-scribing` | Load directly, any phase — capture never waits for feature close |
| Clean up / tech debt / audit | `bee-grooming` | Load directly |
| Capture learnings | `bee-compounding` | Load directly |
| Author or edit a bee skill (`SKILL.md` content) | `bee-writing-skills` | Load directly |
| Evolve bee from its own dogfood feedback (rank friction, ship a self-improvement) | `bee-evolving` | Load directly; bee repo only (D3), never auto-runs, never pushes without Gate B (D5) |
| `/go` / full pipeline | Go mode | See `go-mode.md` |
| Turn gate-bypass on/off, or check it | `bee-bypass-gate` | Load directly, any phase; toggles `.bee/config.json` `gate_bypass` |
| Resume session | Resume logic | Check `HANDOFF.json` first — kind-aware: pause waits, planned-next adopts only at a fresh-session boundary |

**Surface-scope-earlier check** (runs before routing to exploring): the request contains concrete acceptance criteria AND references to existing patterns → offer "Found clear requirements. Jump straight to planning, or explore alternatives first?" On approval, planning receives a one-paragraph scoping synthesis whose decisions still carry D-IDs.

## State Bootstrap

On every session start:

1. Confirm onboarding is current via `.bee/onboarding.json` (see SKILL.md onboarding protocol).
2. Run `node .bee/bin/bee.mjs status --json`.
3. If `.bee/HANDOFF.json` exists, check its kind: a pause handoff (or any kindless record) is presented and waited on — do not auto-resume. A planned-next handoff is adopted only at this fresh-session boundary (see Resume Logic below).
4. Read `docs/history/learnings/critical-patterns.md` when present.
5. Surface recent active decisions: `node .bee/bin/bee.mjs decisions active --recent 3`.
6. Check active reservations when workers may be in flight: `node .bee/bin/bee.mjs reservations list --active-only`.

Default `.bee/state.json` shape:

```json
{
  "schema_version": "1.0",
  "phase": "idle",
  "feature": null,
  "mode": null,
  "approved_gates": { "context": false, "shape": false, "execution": false, "review": false },
  "workers": [],
  "summary": "",
  "next_action": "Invoke bee-hive."
}
```

## Resume Logic

If `.bee/HANDOFF.json` exists, read its `kind` (`bee state handoff show --json`; a missing/unknown kind normalizes to `pause`, fail-safe) and branch:

**Pause** (or any kindless record) — unchanged, the original rule:

1. Read `HANDOFF.json` and `.bee/state.json`.
2. Extract phase, feature, mode, cells in flight, done/remaining, and next action.
3. Present the pause point to the user in plain language.
4. Continue only after explicit confirmation. If the user's first message is an unrelated request, still surface the handoff first, then ask which to pursue.

Do not auto-resume. Ever.

**Planned-next** — the previous cell was capped with a green verify and the next cell was already claimed for this handoff. Adoption fires ONLY at a fresh-session boundary (a cleared or newly started session — never a resumed or memory-compacted one, which follows the pause path above):

1. `bee state handoff adopt` transfers the carried claim to this session and clears the handoff record.
2. On success, present the adopted cell, its verify command, and its lane as a start-now instruction — no wait, no confirmation prompt (fresh-session-handoff D1).
3. On a failed adoption (claim lost the race, handoff already cleared), fall back to the pause presentation above — never fabricate a start-now instruction.

## Scout Contract (just-enough reading)

Retrieval triggers, not reading lists. Token budgets by lane:

| Lane | Harness-context budget | Always read | Trigger-based reads |
|---|---|---|---|
| tiny / small | ≈ 2K tokens | bee_status, critical-patterns digest, touched area's `docs/specs/<area>.md` when present | touched-file neighborhood only |
| standard | ≈ 5K tokens | + recent active decisions, CONTEXT.md | touching schema → schema decisions first; touching auth → auth decisions |
| high-risk | ≈ 10K tokens | + full decision search on tags, plan history | + high-risk template, prior spikes in `.bee/spikes/`, related learnings files |

Reading order per area (state layer, decision 0001): **spec → decisions → history**. `docs/specs/reading-map.md` answers "where does X live" before any broad grep.

Do not read `node_modules/`, `dist/`, `build/`, `.git/` internals, `vendor/`, `coverage/` — the scout guard blocks them anyway.

## Chaining Contract

| Skill | Reads | Writes |
|-------|-------|--------|
| hive | onboarding, state, HANDOFF, critical-patterns, decisions | state routing updates only |
| exploring | user conversation, critical-patterns, quick scout | `docs/history/<feature>/CONTEXT.md`, state update |
| planning | CONTEXT.md, critical-patterns, active decisions, bee_status | `approach.md`, `plan.md` (requirements-only → implementation-ready), current-slice cells via `bee.mjs cells add` |
| briefing | CONTEXT.md, approach.md, plan.md, cells, validating reports, state gates (render/refresh); capped cell traces, review findings, UAT (walkthrough) | `docs/history/<feature>/implement-plan.md` (projection; `small`+); `docs/history/<feature>/walkthrough.md` (post-Gate-4; `standard`/`high-risk`) |
| validating | CONTEXT.md, discovery, approach, approved shape, cells | reality-gate report, feasibility matrix, spike results in `.bee/spikes/`, repaired cells |
| swarming | validated cells, state, reservations | worker registry in state, HANDOFF at ~65%, wave results |
| executing | assigned cell, CONTEXT.md, reservations | implementation commits (one per cell, cell id in message), verify record, cap, report in `docs/history/<feature>/reports/` |
| reviewing | user-selected immutable scope (a `bee_reviews` session — never triggered by phase or cell completion) | session findings (P1/P2/P3) and the Gate 4 decision recorded on that session, backlog items, `residual-findings.md` fallback |
| scribing | `behavior_change` cells + verification evidence, CONTEXT.md, active decisions, UAT/worker reports, code + user interview (harvest) | `docs/specs/<area>.md` (BA-grade merge), `docs/specs/reading-map.md`, capture-mode decision log entries, state record |
| compounding | feature history, traces, findings, commits, scribing state record | `docs/history/learnings/YYYYMMDD-<slug>.md`, critical-patterns promotions, decision log, backlog friction, state-layer guard verdict |
| grooming | entropy inputs, backlog, traces, diffs | kill proposals, tiny/small cells, outcome records |

**Recommended-next after execution (SPEC §11.5, decision 565e68d0):** once a feature's execution work is done, the chain hands off to `bee-scribing` then `bee-compounding` directly — `bee_status`'s `recommended_next` and the session preamble report the review-candidate count instead of proposing `bee-reviewing`. The feature closes truthfully `unreviewed`; independent review remains available on request at any later point, over any scope the user names.

Every skill ends with an explicit handoff: `[Outcome]. Invoke bee-<next-skill> skill.`

## Direction of Truth — Projection Rule (D12)

The repo artifacts are the single source of truth for what work exists and its state: **cells** (`.bee/cells/`) for in-flight execution and the **PBI rows** in `docs/backlog.md` for product intent. A session's todo list — `TaskCreate`, `TodoWrite`, and any equivalent scratch checklist — is an **ephemeral projection** of those durable records, never the reverse.

The mapping is one-way: cells and PBI rows generate the session todo list, and no edit to that list ever writes back to a cell or a backlog row. When the two disagree, the repo artifact wins and the session list is regenerated from it. A todo item with no cell or PBI behind it is a projection bug, not a new unit of work — file the cell or the backlog row first, then let the list re-derive. This keeps the durable layer authoritative and the chat/session state disposable.

## Communication Contract

Plain language first:

- practical first, abstract second; scenario-first, not jargon-first
- explain what happens in real life before naming technical properties
- translate decision IDs, invariants, and architecture terms on first use
- prefer "here is what the code does today" over "here is the category of bug"

For plans, findings, blockers, and handoffs, answer in this order:

1. Plain-language summary
2. Current behavior or state
3. Why it matters
4. Concrete scenario
5. Next step

Avoid "violates D5" or "non-monotonic" without immediate explanation.

### Silent Bookkeeping — work language only (decision 1689af1b)

Bee is bookkeeping, not the deliverable. Every mechanical workflow act — claiming or capping cells, status and `state.json` changes, reservations, phase transitions, decision logging, capture stubs — is done silently: run it, never narrate it. Chat speaks the user's work language only: "fixing the login redirect", "done — tests pass", never "capped cell auth-3" or "phase is now swarming".

Bee vocabulary may enter chat in exactly two cases:

1. the user asks about bee itself (state, cells, workflow) — answer plainly, in their language;
2. a gate genuinely needs their decision — and the Gate Presentation Contract already requires that question in work terms, not bee terms.

Litmus: strip every bee term out of a chat message; if nothing the user needs is lost, those terms should not have been there.

## Gate Presentation Contract

A gate message has two layers, and **only the human layer goes into chat**:

1. **Human layer (the chat message)** — written in the language the user is conversing in, jargon-free, answering four questions in order:
   - **What I'm about to do** — one sentence in the user's terms: what changes *for them*, not the mechanism.
   - **Why it's trustworthy** — the single strongest piece of evidence in plain words ("a dry run rebuilt all 3 pages byte-for-byte identical"), never a checklist.
   - **If it goes wrong** — what breaks for the user and how it would be noticed (loud failure, rollback path).
   - **What you are deciding** — the exact commitment being approved and its boundary ("current slice only").

   Then the fixed gate question verbatim, with the standard options, and a link to the full report.

2. **Machine layer (the linked report)** — the full mechanical material (reality-gate tables, feasibility matrices, plan-checker findings, cell lists) is written to `docs/history/<feature>/reports/` and **linked** from the gate message. It is never pasted into the gate message. It exists for the agent, the audit trail, and grooming — not for the human's eyes at decision time.

Litmus test: **the user must be able to restate what they are approving in their own words.** A gate the user cannot restate is a dead gate — worse than no gate, because it manufactures false confidence. A technical term (BLOCKER count, spike id) may appear in the human layer only with an immediate plain-language gloss.

This contract applies to all four gates, in every mode, including go mode.

### AskUserQuestion — honor the tool's schema (a valid call, every time)

Gates, decisions, and confirm-before-doing prompts are presented with the `AskUserQuestion` tool. If the call violates the tool's schema the harness rejects the **whole** call with **"Invalid tool parameters"** — a recurring, silent waste (the model then retries a valid one). Build the call inside these limits:

- **`header` ≤ 12 characters** — it is a short chip label, NOT the question. Vietnamese/English descriptive headers ("Xử lý external", "Cách hiển thị") overflow instantly — use "Approach", "Scope", "External". **This is the #1 cause of the error.**
- **2–4 options per question** — never 1, never 5+. An "Other" free-text choice is added automatically, so fold overflow there or into a follow-up question.
- **1–4 questions per call** — batch independent questions (up to 4), serialize dependent ones.
- Every option needs both a **`label`** and a **`description`**; put the recommended option first with "(Recommended)" in its label.

A question that "needs" a long header or >4 options is a signal to reshape it — split it, or push detail into the option descriptions — never to exceed the schema.

### Gate bypass mode (opt-in autopilot, decisions 0010 / dcf01d7b)

Off by default. Turned on with the `bee-bypass-gate` skill, which sets `.bee/config.json` `gate_bypass` (persistent per-repo). When on at any level, the agent does **not** stop at a bypassed gate — it takes the RECOMMENDATION option itself and continues. This is the one deliberate exception to "gates are never self-approved"; **headless mode is not** — headless still stops at every gate.

**`gate_bypass` is a level.** `bypassLevel()` (lib/state.mjs) normalizes the config value; the level decides how far bypass reaches. The whole point of the levels above `normal` is that the human said, in advance and explicitly, "when you have a recommended option I will always approve it — do not stop me; the result is what I care about." Honor that literally: at the chosen level, the recommended option IS the approval.

| Level | Config value | Auto-approves | Still stops for the human |
|---|---|---|---|
| `off` | `false` / absent | nothing — every gate stops | every gate (default) |
| `normal` | `true` / `"on"` / `"normal"` | Gates 1-3 for `tiny`/`small`/`standard` non-hard-gate work | high-risk/hard-gate Gates 1-3 · secret reads · Gate 4 UAT/P1 |
| `full` | `"full"` | **all** Gates 1-3 at every lane, high-risk/hard-gate included | secret-file reads · a review P1 finding |
| `total` | `"total"` | **everything** — all Gates 1-3 any lane, secret-file reads, Gate 4 UAT, review P1 findings | **nothing — zero stops** |

Legacy `true` maps to `normal`, so existing repos are unchanged. At **Gate 1, 2, or 3** when the level bypasses that gate:

1. **Safety floor is level-scoped, not absolute.** Under `normal` the floor is exactly as before: a `high-risk` lane or any hard-gate flag (auth · authorization · data loss · audit/security · external provider · validation removal · database migration/schema change) is **NOT** bypassed — present it to the human normally. Under `full` and `total` the high-risk/hard-gate floor is **lifted** — the human lifted it by choosing the level — so those gates auto-approve too.
2. Do not ask. Instead: select the option the RECOMMENDATION favors; set `approved_gates.<gate>` in `.bee/state.json` (same write the human's "yes" would trigger); still write the machine-layer report to `docs/history/<feature>/reports/`; log a one-line audit entry — `node .bee/bin/bee.mjs decisions log --decision "auto-approved Gate N (bypass): <choice>" --rationale "<the recommendation's why>"` — so the approval is never silent; then post a **short chat line** (not a question) — `⚡ auto-approved Gate N (bypass): <what/why in one plain sentence>` — and continue. The human sees what happened and can still interrupt.

**Bypass suppresses approvals, never genuine information-gathering (decision a93994d3).** The point of the levels is to stop the agent asking merely to be *approved* — not to gag a real question. So distinguish two kinds of "question": an **approval** (the agent already has a confident best answer; the human would only rubber-stamp it) is suppressed under `full`/`total` — the agent takes its own answer and continues. An **information** question (the answer turns on a preference or knowledge only the human holds, and the agent cannot resolve it from evidence with a confident default) is still asked, even under `total`. This is where `bee-exploring`'s Socratic step still stops when it must (§4 materiality test + the information-vs-approval refinement): the human asked to keep being consulted for real information, only never for a rubber stamp. Litmus: *"do I already have a confident best answer?"* — yes → proceed; no, and only the human can supply it → ask.

**Gate 4 and secret reads follow the level.** Under `normal` and `full`, Gate 4 is never fully bypassed and bypass never creates a review session (SPEC R8, decision 565e68d0): a review only exists once the user invoked `bee-reviewing`, its UAT items are always presented, and any P1 always stops. Under `total`, a review the user started runs to completion without stopping — UAT items and P1 findings auto-proceed on the recommended resolution. **Secret-file reads** stop for the human under `off`/`normal`/`full`; only `total` auto-proceeds on them (the human accepted that credential contents may enter context/logs unprompted). Bypass still never *creates* a review session on its own at any level.

The mechanical guards do not change: `claimCell` and the write-guard still require `approved_gates.execution: true` — bypass simply means the agent records that approval itself for eligible work instead of waiting for the human. Bypass state is surfaced every session (the preamble and `bee_status` both print a loud level-specific `GATE BYPASS` banner — `NORMAL` / `FULL AUTOPILOT` / `TOTAL AUTOPILOT — ZERO STOPS`) so the active level is never silently in effect.

**The bypass is now mechanized at runtime, not prose-only (GitHub #18, hook-runtime B15/R14).** The rule above is still the assistant's to follow, but it is no longer the *only* thing honoring it: the session-stop checkpoint (`hooks/bee-session-close.mjs` `maybeBypassBlock`) emits a turn-control block that forces continuation when the assistant tries to stop mid-planning/validating at a gate the active level covers and is still pending. It is loop-guarded (blocks once per `sessionId:phase:gate:level`, then degrades to advisory) and excludes exploring/Gate 1 (genuine information questions still stop even under `total`). This closes the "invariant left in prose WILL be bypassed" gap (crit-pattern 20260714): the doctrine test mechanized the prose, this mechanizes the runtime.

### Delegation contract (fan-out: decide-altitude vs gather-altitude)

The one orchestration pattern bee runs: the session model (the owner's best model) stays the orchestrator in every phase, and mechanical gather/render/mine steps dispatch down-tier as I/O workers that return digests (D1 — replaces the advisor pattern in full, decisions 0013/0015 reversed).

- **Decide-altitude stays on the session model**: gates, Socratic questions, the mode gate, synthesis of findings, accept/reject of worker results, state writes, human conversation.
- **D2 rubric** — a mechanical step delegates down-tier when it needs reading >3 files OR content the main model only needs as a digest, not verbatim; the orchestrator may override either way at dispatch, same spirit as tier-judging (decision 0016). Prose-ruled — no new hook enforces the threshold.
- **D3 lane rule** — the rubric applies in every lane and every phase, tiny/small included. Lane scaling v2's (d02a6bc6) "0 subagents" for tiny/small means zero *ceremony* subagents (reviewers/checkers/panels); I/O workers are exempt. A 1-file tiny fix never crosses the rubric, so it stays inline naturally.
- **Digest contract** — an I/O worker returns paths read, the facts extracted (with file:line anchors), and verbatim quotes only where asked; the orchestrator never re-reads what a digest already answers.
- **Transport unchanged** — anchored `[bee-tier: <tier>]` marker or `model` param (decision 0023), model name in the Agent description, background dispatch where the runtime supports it (decision 0017), P22 dispatch log as the audit trail. I/O workers do **not** register in `bee.mjs state worker add` — the registry stays swarm-cell-scoped (reservations/status are execution concerns); the dispatch log is the audit surface for gathers.
- **Execution worker (AO14, second named class)** — the Delegation contract's other dispatch shape, distinguished from the I/O-offload worker by **authority and state effects**, not by task size. Unlike an I/O worker, an execution worker **does** register in the swarm registry (`bee.mjs state worker add`) and **does** take reservations under its own nickname; it implements exactly one assigned cell (claim → read `read_first` → implement within `files` → verify → cap → release) and returns exactly one status token (`[DONE]`/`[BLOCKED]`/`[HANDOFF]`/`[NOOP]`) — it is authority-bearing, never a digest-only gather. Every `bee-swarming` worker dispatch belongs to this class: full waves in `standard`/`high-risk`, and, since AO14, the single dispatched worker that now carries out `tiny`/`small` cell implementation too (`bee-swarming/SKILL.md`'s Single execution worker section) — never zero of them, even for the lightest lane. An independent reviewer or checker (plan-checker, cell reviewer, panel member) is **neither** class: it is a review-class dispatch — read-only, no registry entry, no reservations, no cell of its own — and is never called an "execution worker."
- **cli gather branch (plan 2A-ii, decision 34398e69)** — when `resolveTier(root, 'generation', runtime, {for:'gather'}).type === 'cli'`, a gather dispatch runs the configured command **verbatim** via the shell — nothing appended, ever (W7); the prompt goes in on **stdin**; every path handed to the worker is **absolute** (W9); the run is **read-only** by contract. **Stdout IS the digest**, framed by a delimiter contract: the worker prompt instructs the CLI to emit its digest between `<<<BEE_DIGEST` and `BEE_DIGEST>>>` lines, and the orchestrator extracts only what sits between them — missing delimiters or an empty digest is a **failed run**, surfaced loudly, never accepted as a silent green (fail-open-masking pattern, critical-patterns 20260716-class). No `result.json`, no cell, no reservation, no `bee.mjs state worker add` registration for a gather, same as any other I/O worker. **Known measurement gap, named not solved here:** a Bash-launched gather emits zero `dispatch.jsonl` rows (W-d) — closing that gap is Slice 3's job, not this branch's.

### Native Codex subagent tending

For every bee-owned native Codex subagent flow, including ordinary delegated
gathers, a completed `wait_agent` call with no completion is an **empty wait**:
it is a timeout signal only, never failure. Never follow an empty wait directly
with another `wait_agent`; authority, urgency, and no-chatter instructions create
no exception. Before any later bounded wait, continue material task-local work
when any remains; otherwise take exactly one `list_agents` snapshot. Then send
one concise commentary update naming both the live agent state and the next
action; only then may a later bounded wait run. No-op work, repeated state reads,
hidden reasoning, generic commentary, or commentary alone do not qualify.
Timeout never licenses interrupt, duplicate dispatch, claim release, or
reservation release; every running agent, claim, and reservation stays owned.
This refines, rather than replaces, the ban on file/scratchpad polling for
harness-managed subagents. External process and artifact polling keeps its own
contract and is outside this native-agent rule.

## Question Format

Used at all gates and Socratic steps:

```text
CONTEXT: <one or two sentences of relevant state, plain language>
QUESTION: <one outcome-framed question>
RECOMMENDATION: <the option the evidence favors, and why in one line>
  (a) <option> — <expected outcome>
  (b) <option> — <expected outcome>
  (c) <option> — <expected outcome>
```

One question per message. Never bundle. Never answer your own question.

## File Quick Reference

```text
.bee/
  onboarding.json  state.json  config.json  HANDOFF.json
  reservations.json  decisions.jsonl  backlog.jsonl
  cells/<id>.json  logs/hooks.jsonl  .inject-cache.json
  bin/  bin/lib/

docs/history/<feature>/
  CONTEXT.md  plan.md  reports/                       ← always
  discovery.md  approach.md  implement-plan.md        ← conditional (decision 0009): separate
                                                        files only for L2+ discovery / high-risk;
                                                        else folded into plan.md sections
  walkthrough.md                                      ← standard/high-risk, post-Gate-4

docs/history/learnings/
  critical-patterns.md  YYYYMMDD-<slug>.md

docs/specs/
  <area>.md  reading-map.md

.bee/spikes/<feature>/
```

## Helper CLI Quick Reference

`node .bee/bin/bee.mjs <group> <verb>` is the sole canonical and sole shipped
form for all 9 groups (`status`, `cells`, `reservations`, `decisions`, `state`,
`backlog`, `capture`, `reviews`, `feedback`) — one dispatcher, one registry.
The original `bee_*.mjs` shims (one per group — `status`, `cells`,
`reservations`, `decisions`, `state`, `backlog`, `capture`, `reviews`,
`feedback`) are retired (decision bbc6bcea, D1) and no longer ship in
templates or host `.bee/bin` — `LEGACY_HELPER_RE` in the write-guard stays
only as a transition guard for hosts mid-upgrade (D3).

```text
node .bee/bin/bee.mjs status [--json]
node .bee/bin/bee.mjs cells list [--feature F] [--status S] | ready [--feature F] | show --id ID
node .bee/bin/bee.mjs cells add --stdin   # one cell object or a whole-slice JSON array (all-or-nothing); --file cell.json also accepted
node .bee/bin/bee.mjs reservations list [--active-only] | sweep
node .bee/bin/bee.mjs decisions active [--recent N] | search --text T
node .bee/bin/bee.mjs state set --owner <selected pre-mutation phase> | gate | worker add/update/remove/clear/prune | scribing-run | start-feature
node .bee/bin/bee.mjs backlog add | counts | rank | badges
node .bee/bin/bee.mjs capture add | list | flush | count
node .bee/bin/bee.mjs reviews create | list | show | record | candidate add | candidates | status
node .bee/bin/bee.mjs feedback digest | count | collect | rank
```
---
name: bee-planning
description: >-
  Research the work, pick the smallest honest mode, and shape an executable plan. Use when exploring has locked CONTEXT.md, or a clear-scope task needs a mode decision and work shape before validation.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies: []
---

# planning

If `.bee/onboarding.json` is missing or stale, stop and invoke `bee-hive`.

Planning is the waggle dance: it turns locked `CONTEXT.md` decisions into the smallest believable path to execution — mode, approach, one unified `plan.md`, and (only after approval) current-slice cells.

Load `references/planning-reference.md` for artifact templates and cell quality rules; `references/edge-dimensions.md` for the test matrix. Discovery at L2/L3 runs through `bee-xia`.

## Hard Gates

- `CONTEXT.md` is the source of truth. Locked decisions are cited (`per D2`), never reinterpreted, never scope-reduced.
- **Stop at Gate 2.** No cell creation, no prep artifacts before the shape is approved.
- Cells for the **current slice only**. Future-slice cells are prohibited.
- Handoff only to `bee-validating`.

## 1. Bootstrap

Read, in order:

1. `docs/history/<feature>/CONTEXT.md` (or the hive scoping synthesis for surface-scope-earlier work).
2. `docs/history/learnings/critical-patterns.md` — mandatory.
3. Recent decisions: `node .bee/bin/bee.mjs decisions active --recent 3` and a tag-matched search for this feature's area (`node .bee/bin/bee.mjs decisions search --text <tag>`).
4. Tag-matched precedent in `docs/history/learnings/` (grep for the feature's domain keywords). Inject hits as "we've solved X before: <file>" — precedent beats research.
5. Session scout: `node .bee/bin/bee.mjs status --json`.

## 2. Discovery (research levels)

Pick the lowest level that removes real uncertainty:

- **L0 — skip:** pattern already exists in repo or learnings; cite it.
- **L1 — quick verify:** confirm one API/version/behavior with a command or doc check.
- **L2 — standard:** compare 2–3 candidate approaches; note trade-offs.
- **L3 — deep dive:** unfamiliar territory, external systems, or hard-gate flags.

At L2+, invoke `bee-xia` in-chain: local truth → local reuse → upstream patterns → version-aware docs, evidence labels on every claim, and the anti-reinvention ladder (reuse → built-in → adapt upstream → build) for the recommendation; its findings merge into the approach (see §4), never a standalone research file. §1 Bootstrap (CONTEXT, critical-patterns, decisions, learnings grep, status) delegates as an extraction-tier I/O worker per the Delegation contract (D2/D3, `bee-hive/references/routing-and-contracts.md`); other ad-hoc research dispatches during discovery (including bee-xia) default to the generation slot model; ceiling requires the [bee-tier: ceiling] marker plus a one-line justification. Frame candidates through **three layers of knowledge**: tried-and-true (what the repo/ecosystem already trusts), new-and-popular (current mainstream, verify version claims), first-principles (what the problem actually requires). Recommend from evidence, not novelty.

**Artifact fan-out (decision 0009).** Only **L2/L3** discovery earns a separate `docs/history/<feature>/discovery.md` (a real multi-candidate comparison worth reading alone). At **L0/L1**, record the finding in `plan.md`'s `## Discovery` note and cite it — do not spawn a discovery file that just restates the current state `plan.md` already carries. The full fan-out table (which artifacts become separate files, when) is in `references/planning-reference.md`.

## 3. Mode Gate (mechanical)

Count risk flags — do not vibe it:

> auth · authorization · data model · audit/security · external systems · public contracts · cross-platform · existing covered behavior · weak proof around the area · multi-domain

- **Every touched file is knowledge, not runtime** (docs/, specs, README, sample/example configs, plans) → `docs` lane: exit planning — announce one line, write it, format-check, capture per bee-hive. No plan.md, no cells, no gates.
- **0–1 flags** → `tiny` (≤2 files, one direct task) or `small` (≤3 files, no gray areas)
- **2–3 flags** or story-sized behavior → `standard`
- **4+ flags or any hard-gate flag** (auth, authorization, data loss, audit/security, external provider, validation removal) → `high-risk`
- One yes/no proof decides whether the plan is real → `spike` (regardless of flags)

Record the count and the flags in `plan.md`. Above `small`, state why smaller modes are insufficient. Use the least workflow that honestly protects the work.

**Greenfield init lane (P1, docs/09 item 6):** when the repo has no build and the init-lane offer was accepted at onboarding, the first slice is **one init cell** — `must_haves`: setup succeeds from scratch, one passing test exists, standard commands recorded in `.bee/config.json`, clean first commit — before any feature cell. Infrastructure first; the init cell's verify command is the recorded `test` command itself.

## 4. Synthesis — approach (section by default, file when earned)

Produce the approach: chosen path and rejected alternatives, risk map (component / LOW–MEDIUM–HIGH / proof needed), likely files and order, relevant learnings, and open questions for validating. MEDIUM/HIGH unknowns need a validating proof or a spike before execution cells exist.

Write it as an `## Approach` section **inside `plan.md`** by default. Graduate it to a standalone `docs/history/<feature>/approach.md` only for **high-risk** lanes or **L2+** discovery, where the rejected alternatives and risk map are substantial enough to read on their own (decision 0009 / fan-out table in the reference). Do not spawn `approach.md` for a small or standard fix whose approach is a paragraph — that just restates `plan.md`.

## 5. Shape — plan.md (STOP at Gate 2)

Write **one** `docs/history/<feature>/plan.md` with frontmatter:

```yaml
artifact_contract: bee-plan/v1
artifact_readiness: requirements-only
mode: tiny | small | standard | high-risk | spike
```

Body scaled to mode: direct note, spike question, small plan, phase plan, or epic map (templates in `references/planning-reference.md`). Sketch the test matrix against the 12 edge dimensions at a depth matching the lane.

Render `docs/history/<feature>/implement-plan.md` via `bee-briefing` only where the fan-out table calls for it (decision 0009): **high-risk** always; **standard** on-demand (default: `plan.md` + the Gate 2 chat layer are the review record — render the brief only when the user asks or the slice spans multiple domains); **small** optional mini-brief on request; **tiny**/**spike** none. When a brief is rendered, the Gate 2 message links it as the review document; when not, the Gate 2 message links `plan.md` directly. **Gate-bypass check FIRST (routing-and-contracts.md §Gate bypass, decisions 0010/dcf01d7b).** Read the active level (`node .bee/bin/bee.mjs status --json` → `gate_bypass_level`). If it bypasses Gate 2 for this lane — `normal` covers `tiny`/`small`/`standard` non-hard-gate; `full`/`total` cover **every** lane incl. high-risk/hard-gate — then **DO NOT ask.** Take the shaped plan as approved (the recommended path), set `approved_gates.shape` yourself (`bee.mjs state gate --name shape --approved true`), log a one-line audit decision, post `⚡ auto-approved Gate 2 (bypass) — preparing cells`, and continue straight to §6 Prep. Only present the question below when the level does NOT cover this gate. Present **Gate 2** (only if not bypassed) per the Gate Presentation Contract (bee-hive routing reference): plain-language layer in chat — what I plan to build / why this size / cost if the shape is wrong / what you are deciding — in the user's language, the review document linked not pasted; then verbatim: "Work shape is ready. Approve before current-work preparation?" — then **stop**. No pseudo-cells in markdown, no prep, no cells.

**Tiny/small merged gate (fast path).** For `tiny` and `small`, run the validating reality check inline first — MODE FIT / REPO FIT / ASSUMPTIONS / SMALLER PATH / PROOF SURFACE, each with one line of file/command evidence, 2 minutes not a report — then present **one merged question** in place of Gates 2 and 3: "Work shape + execution: I'm about to do [X] via [Y], verified by [Z]. Approve?" Approval records **both** `approved_gates.shape` and `approved_gates.execution`. **Under any active bypass level** (tiny/small are always covered — even `normal`), do NOT ask the merged question: run the reality check, and if it PASSES, set both `approved_gates.shape` and `approved_gates.execution` yourself, log one audit decision, post `⚡ auto-approved shape+execution (bypass)`, and continue to bee-swarming. Only a reality-check FAIL is surfaced to the human regardless of bypass. A reality-check FAIL is presented before asking, never buried. `bee-validating` is not separately invoked for these lanes; its subagents (plan-checker, cell reviewer) do not run — the plan is one direct task a stranger could pick up from `plan.md` alone, and the cold-pickup criteria are self-checked when writing the cell.

## 6. Prep (after Gate 2 approval only)

1. Enrich the **same** `plan.md` in place to `artifact_readiness: implementation-ready`: current slice selected, files bounded, verification commands named.
2. Create cells for the current slice only — the whole slice in **one** call, a JSON array piped straight to stdin (never one scratchpad file + one `add` per cell):
   ```bash
   node .bee/bin/bee.mjs cells add --stdin <<'EOF'
   [ { ...cell 1... }, { ...cell 2... } ]
   EOF
   ```
   The batch is all-or-nothing: every cell is validated before any is written. A single object (no array) still works for a one-cell slice; `--file` remains for pre-existing files.
   Every cell is an executable prompt: `files`, `read_first`, directive `action` citing D-IDs, `must_haves` (truths / artifacts / key_links / prohibitions), a runnable `verify` command, and `behavior_change: true` whenever the cell changes observable behavior. You may leave the model `tier` unset — the orchestrator judges each cell's difficulty and assigns the tier when it dispatches (decision 0016); set `tier` only as a hint when a cell is obviously mechanical (`extraction`) or obviously a hard integration/architecture call (`ceiling`), and even then swarming may override it. Cell quality rules and a schema example live in `references/planning-reference.md`.
3. If an implement plan was rendered at §5 (high-risk, or a standard/small feature where one was produced on request), invoke `bee-briefing` in refresh mode so its Affected Files and Implementation Steps re-project from the created cells. If no brief exists, skip — there is nothing to refresh.
4. Update state and hand off by lane: `tiny`/`small` (merged gate already approved) → `node .bee/bin/bee.mjs state set --owner planning --phase swarming --next-action "Invoke bee-swarming (single execution worker)."`; every other lane → `node .bee/bin/bee.mjs state set --owner planning --phase validating --next-action "Invoke bee-validating."` **The phase must be a real member of the enum** (`idle, exploring, planning, validating, swarming, reviewing, scribing, compounding, grooming, compounding-complete`) — invented names like `planning-complete` are refused by `state set`, and an agent that hits that refusal starts improvising the state machine, which is exactly how the chain broke (chain-integrity D6). Completion is carried by the approved gate, never by a phase name. `--owner` always names the selected record's pre-mutation phase; it is not persisted.

## Scope-Reduction Prohibition

If the shape cannot fit the budget or context, **never** quietly shrink a locked decision or drop a must-have. Answer `SPLIT RECOMMENDED`: propose slice boundaries, each slice honoring every locked decision it touches, and let the user choose. Cheaper alternatives found in research are *noted* alongside the honored decision — swapping them in requires the user superseding the D-ID.

## Headless

With `mode:headless`: run bootstrap, discovery, mode gate, and synthesis without questions. Write `plan.md` as `requirements-only` and stop — Gate 2 is never self-approved. Ambiguities (mode borderline, conflicting decisions, missing CONTEXT.md sections) go to an `Outstanding Questions` section of the structured terminal report.

## Red Flags

- skipping critical-patterns, active decisions, or `CONTEXT.md`
- skipping the mode gate, or choosing a mode without counting flags
- defaulting to phases without proving the work needs them
- cells or prep artifacts before Gate 2 approval
- future-slice cells · pseudo-cells in markdown
- vague exit states, missing deps, or a `verify` that cannot run
- silently swapping a locked decision for a "better" research finding
- shrinking scope instead of answering SPLIT RECOMMENDED

Violating the letter of the rules is violating the spirit of the rules.

Plan shaped and current-slice cells prepared. `tiny`/`small`: invoke bee-swarming skill (single execution worker — the merged gate already covers execution approval). All other lanes: invoke bee-validating skill.
# Critical Patterns

Mandatory pre-planning / pre-execution context for this repository.
bee-compounding appends hard-won patterns here; keep it short and current.

## [20260716] A tolerant regression net, frozen green BEFORE the edit, is what makes a load-bearing function safe to change
**Category:** process
**Feature:** worktree-feature-parallelism
**Tags:** [test-first, regression-net, resolver, blast-radius, additive-change]

`resolveRoots` (two copies: throwing lib + non-throwing hook adapter) is the highest-blast-radius
function in the repo — every write-guard call resolves through it, and a logic bug that DENIES can
lock the session out of its own fix. It was changed safely by writing a P40 byte-for-byte
regression test FIRST, running it GREEN against the unmodified code, THEN making the edit purely
additive (compute `mainRoot`, consult the grant registry, add `{id,mainRoot,worktreeRoot}` fields;
the no-grant path returns exactly today's `storeRoot`). The net stayed 6/6 green after — that is
the proof of no regression, not an assertion. **Two rules:** (1) freeze a load-bearing function's
current behavior in a regression net and see it green before you touch it; (2) make the net
**tolerant of NEW fields** (pin the fields that exist, never assert the absence of others) so an
additive change stays compatible — a strict deep-equal net would have failed on the harmless new
fields and taught you nothing about real regressions.

## [20260716] Realize a structural model via git config, not a file migration, when the boundaries already exist
**Category:** pattern
**Feature:** worktree-feature-parallelism
**Tags:** [tiering, gitignore, gitattributes, no-migration]

The "three-tier `.bee/` store" (log / cache / runtime) sounded like a directory restructure, but
beegog's flat store already had the boundaries: logs tracked, cache/runtime gitignored. The tiers
were realized as a LOGICAL classification — `.gitattributes merge=union` on the tracked log jsonl
(so worktree branches union-merge provenance) plus gitignore entries for the runtime/cache dirs —
moving zero files. Before migrating a layout to match a model, check whether the model is already
expressible as config over the existing layout. Corollary (list-rot, AGAIN): the onboarding
gitignore block has a hand-kept twin in `test_onboard_bee` (an independent sha256 reconstruction);
adding one pattern to the source silently reddened the test until the twin was updated — the same
"hardcoded fixture list rots" failure from 20260714/20260715, third recurrence. Derive the twin
from the source, or expect to update both every time.

## [20260715] The bill is turns × prefix: keep the prefix immutable, warm, and lean
**Category:** pattern
**Feature:** session-economics
**Tags:** [prompt-caching, prefix-stability, delegation, cost]

Prompt caching is prefix matching: every tool call re-sends the whole conversation and only a
byte-identical prefix bills at ~1/10 price — so a session's true cost is **turns ×
context-per-turn**. A marathon session hit ~99% cached (opus 1.4M new / 120M cached; all
subagents $0.53) by: (1) **never breaking the prefix** — append-only history, no compaction
(compaction rewrites the prefix and re-bills everything; a big context window matters because it
*postpones* it); (2) **staying inside the cache TTL** — continuous rhythm, no long idle gaps
mid-flow; (3) **rule 13 fan-out** — every multi-file gather in a subagent, only digests enter
the orchestrator's prefix, keeping it small AND stable; (4) **fewer, fatter turns** — batch
commands, never re-read, never poll: each avoided call is a full prefix re-bill avoided.
**Rule:** treat the prefix as an invariant and approaching-compaction as a cost cliff — split or
hand off *before* it. Full entry: docs/history/learnings/20260715-cache-economics.md

## [20260715] A guard scoped inside a skippable loop is absent on the path that skips it
**Category:** failure
**Feature:** codex-harness-hardening
**Tags:** [safety-guards, guard-placement, self-onboard, fail-open]

A correct three-version downgrade preflight existed and had protected ordinary hosts for
months — but it lived *inside* the per-skill-target loop. On the self-onboard path every
target `self_skip`s with `continue` before the check runs, so the guard was skipped with
the targets, while the sibling `copy_lib`/`copy_helper` loops downgraded `.bee/bin`
unconditionally. The guard read run-global data (`hostVersion`) but had target-scoped
*placement*.

**Rule:** when a safety check depends only on run-global data, place it at run-global
scope, never inside a per-item loop that can be skipped wholesale. Before trusting an
existing guard, ask "on which code path is this guard's PLACEMENT skipped?" — not just
"does it read the right values?". And when you add an ungated mutation path (a copy/write
loop) beside a gated one, it inherits NONE of the old path's guards: audit every mutation
vector against the guard, not the guard against one vector. Fix generalizes as: hoist the
run-global check to fire unconditionally, fill the aggregate only when it's empty (no
double-block), then reuse the existing whole-apply abort. Full entry:
docs/history/learnings/20260715-codex-harness-hardening-1b.md

## [20260714] A state name that ASSERTS history, with nothing checking it, becomes the shortcut
**Category:** failure
**Feature:** chain-integrity
**Tags:** [state-machine, prose-ruled-invariants, fail-open]

`phase=compounding-complete` asserts that scribing AND compounding both ran. Nothing
checked. `state set --phase` validated the *name* against an enum and wrote it — no
`from → to` legality check existed anywhere in the repo. So the agent hand-set the
terminal phase after each cell to mean "round done", got correctly blocked by the
intake gate on the next message, re-opened with `--phase swarming`, and repeated:
**seven fake closes in one session.** Six `behavior_change` cells' settled behavior
never reached `docs/specs/` while `last_scribing_run` stayed `null` — and that state
was **fully valid**, because scribing debt was deliberately non-blocking ("Pure read
— never a blocker, only a signal", in the source, on purpose).

**Rule:** when a state's name asserts that a step happened, something must check that
it happened. Guard the **door**, not the name: make the state reachable only by
actually performing the step (here: `compounding` is now producible ONLY by recording
a real scribing run — that recording is its sole producer, so the phase is reachable
iff the work was truly done). An assertion you can type is not a fact.

**Corollary — the invariant you leave in prose WILL be bypassed.** Not might. The
agent that broke this chain had read the sentence telling it not to. If the only
thing between the agent and the violation is a line in a SKILL.md, mechanize it or
accept the violation. Fail-close needs a *loud, logged* door (a silent escape hatch
just reproduces the failure; no hatch at all gets a hole punched in it).

**Corollary — a documented command that always fails actively teaches bad behavior.**
Three shipped skills instructed `--phase exploring-complete` / `planning-complete` /
`validated` — none in the enum, so `state set` threw every time an agent followed its
own skill verbatim. An agent whose documented command fails improvises one that
passes; improvising the state machine was the whole failure. When you guard a
command, grep every doc that invokes it, and machine-check the docs so it can't
silently return.

**Corollary — validate a state-machine change against the CALLERS, not the diagram.**
The first fix here ("compounding only from scribing") would have made `compounding`
*unreachable*: nothing in the repo ever sets `phase=scribing` (zero hits) — scribing
goes straight to `state scribing-run`, which produces `compounding` directly. The
rule was written against the documented machine; the documented machine was not the
real one.

## [20260714] Hardcoded fixture file-lists rot silently — and fail-open makes rot look like PASS
**Category:** failure
**Feature:** shim-retire
**Tags:** [test-fixtures, fail-open, hooks]

Two independent test fixtures each hand-enumerated "which lib files to vendor into the
sandbox"; both had rotted (missing `claims.mjs`), the hook crashed at import inside the
fixture, and the hook's fail-open turned the crash into universal green. When a fixture
must mirror a runtime file set, derive it with `readdirSync` of the real directory —
never a hand-kept list. And a fail-open guard's test suite needs at least one
sentinel-deny case, so universal fail-open can never read as all-pass.

**Recurred 2026-07-15 (p2-1):** `test_onboard_bee.mjs`'s fixture launcher hand-wrote
exactly `commands_detect.mjs` + `state.mjs` into `templates/lib`. The moment onboard
gained one new import (`fsutil` for the shared `hashFile`), every fresh-install test
crashed with `exit 1 status undefined` (the spawned launcher couldn't resolve the
missing dep). **Adding an import to any module a fixture copies is a hand-list
tripwire** — fixed by vendoring the whole real `templates/lib` via `readdirSync`.

**Full entry:** docs/history/learnings/20260714-shim-retire.md

## [20260708] Windows Git Bash /tmp is invisible to node
**Category:** failure
**Feature:** harness09
**Tags:** [windows, paths, environment]

Shell redirection into `/tmp` works under Git Bash, but handing that `/tmp/...` string to
a node API fails — node cannot resolve MSYS paths. Pipe the file through stdin
(`cat file | node -e ...`) or use a Windows-style absolute path (the session scratchpad).

**Full entry:** docs/history/learnings/20260708-harness09.md

## [20260708] Verify strings are authored, not just read — two traps
**Category:** failure
**Feature:** harness10
**Tags:** [verify-strings, shell, validation, prose-cells]

A cell's `verify` command must be executed once before it reaches a worker, not reviewed as prose.
Two traps, both survived static review this feature:
1. **Metacharacter regex:** `grep -q '['` is an invalid regex and aborts the `&&` chain. Dry-run any
   verify containing regex/glob metachars (`[ * ? |`) in the target shell, or use `grep -F` for literals.
2. **Grep-for-prose gaming:** a verify that greps for an invented multi-word token rewards embedding that
   token verbatim into prose. Grep a **stable heading** the section needs anyway, never an invented phrase.

**Full entry:** docs/history/learnings/20260708-harness10.md

## [20260710] A boundary that lists field names will leak the field you forgot
**Category:** failure
**Feature:** evolving-loop
**Tags:** [security, allowlist, trust-boundary]

The same defect survived three rounds: a validator covered `title`, then `title`+`layer`+`source`,
and each time the next unremembered field was the next hole (`first_seen` rode in on
`Date.parse("Jan 1 2020 (payload)")` — lenient date parsers treat parenthesised text as a comment).
A list of field NAMES cannot make forgetting a field fail. Map each field to its validator and
**derive the field list from the map**, so an unspecced field is a red test, not a vulnerability.
Then write the table-driven test that feeds a payload into *every* field.

**Full entry:** docs/history/evolving-loop/reports/review-slice-a.md

## [20260710] A frozen assertion can encode the defect it guards — the worker must stop, not rewrite
**Category:** process
**Feature:** evolving-loop
**Tags:** [testing, frozen-assertions, review]

Twice, a "frozen" assertion asserted the exact vulnerability under repair — one written by the very
cell tasked with building that boundary, one pinning the defective syntax itself. 93 then 104 green
assertions proved conformance to a wrong spec, not safety. Both were found only because a worker hit
them while fixing a bug and returned `[BLOCKED]` quoting the assertion instead of "correcting" it.
**Keep that escape hatch.** A worker never unfreezes an assertion; the planner does, narrowly, with a
logged decision (`c45d0fb3`, `b8fe5c81`). Corollary: a drift guard that greps a module's own source
pins syntax, not behavior — and pinned syntax can be the bug.

## [20260710] Evidence is checkpointed to disk per step, never held in context until the end
**Category:** failure
**Feature:** evolving-loop
**Tags:** [iron-law, workers, context]

An Iron Law worker edited `SKILL.md` and died before writing its RED pressure-test report; the edit
was reverted, because an unrecorded RED phase is not a RED phase and reconstructing it from the
worker's summary would be fabricating evidence. Its successor checkpointed each scenario to disk as
it finished, was interrupted mid-run, and lost nothing. Write each scenario, each proof, each
observation as it lands. Note also that `grep '## RED'` passes on a `touch`, and one commit holding
RED+GREEN proves no ordering — commit RED separately.

## [20260710] Never release another agent's reservations on a stall signal
**Category:** failure
**Feature:** evolving-loop
**Tags:** [swarming, reservations, orchestrator]

A "stalled/killed" notification was trusted; the orchestrator released a live worker's reservations,
reset its claimed cell, and dispatched a duplicate. Nothing corrupted — the first worker finished and
the second returned `[NOOP]` — but the reservation guard was defeated by the orchestrator, not by a
race. Before declaring a worker dead, check for progress on disk over an interval. The lock did its
job; the person with the key opened the door.

## [20260710] A NUL byte in a source file makes grep silently match nothing
**Category:** failure
**Feature:** evolving-loop
**Tags:** [tooling, grep, verification]

`sortKey` joins fields with a NUL separator — a legitimate technique. Side effect: `grep`/`rg` treat
the whole file as **binary and print nothing, not even a zero count**. In a repo whose drift guards
are grep-over-source, this reads as "the symbol is gone". It briefly convinced an orchestrator that a
landed fix had vanished. If a grep over a source file returns empty rather than `0`, check for
control bytes before believing it.

## [20260710] A plan that names a source must name the reader that can open it
**Category:** process
**Feature:** evolving-loop
**Tags:** [planning, cells, scope]

A cell mandated markdown frontmatter as a collection source, restricted content reads to the JSON-only
wrappers, and forbade bare filesystem reads in the module — with a two-file scope. No reader existed
for the source it required. The worker had to widen a shared helper outside its declared scope to do
the honest thing rather than game the security check. When a plan names a source, it names the reader
that can open it, or it grants the scope to build one.

## [20260710] A non-exposure invariant needs a test on every output surface it crosses
**Category:** security
**Feature:** evolving-loop slice B
# Reading Map

Where things live. Read the touched area's spec before its code.

## Area specs

- [`feedback-digest.md`](./feedback-digest.md) — how a repository turns its own workflow records into a
  safe portable snapshot, how the maintainers' repository reads other repositories' snapshots
  without trusting them, and how the collected view is ranked and fed to the gated
  self-improvement process.
- [`onboarding.md`](./onboarding.md) — what onboarding installs and keeps current in a host
  project, including plugin-first/repo-copy exclusivity, installed-package proof, and
  proof-gated cleanup; unresolved live-install surfaces remain Open Gaps (`coverage: partial`).
- [`hook-runtime.md`](./hook-runtime.md) — the lifecycle guardrails around the assistant: one
  catalog of record rendered into per-runtime projections, hostile-input immunity, advisory
  encoding, per-target batch-write guarding, three declared runtime differences, paired Codex
  child lifecycle audit, exclusive source ownership, and named coverage gaps (`coverage: partial`).
- [`doctrine-layer.md`](./doctrine-layer.md) — the standing instructions an assistant always
  carries: what belongs on the always-loaded sheet versus a stage's procedure reference (a rule
  needed when no stage is running is silently absent from every such turn if buried in a
  reference), how doctrine reaches every project by copy, the delegation threshold
  (gather delegates, deciding never does), and the anchor tests that keep a rule from
  drifting back out of the layer (`coverage: partial`).
- [`advisor-protocol.md`](./advisor-protocol.md) — second opinions for workers and the
  orchestrator: who may consult the configured adviser, the mandatory pre-approval consult
  for high-risk work with event-based staleness, the read-only rule, and what advice may
  never do (approve, override, write).
- [`workflow-state.md`](./workflow-state.md) — the durable workflow record: closed phase
  vocabulary, four gates, the guarded feature-start that can never inherit approvals or
  bury unfinished work, and the review records — user-invoked review sessions with frozen
  scope (`.bee/reviews/`), the append-only candidates ledger, and derived review statuses
  (verified/unreviewed/in review/reviewed/review stale); also the unified nine-group
  command entry point and the worker adviser consult (a stuck worker asks a configured
  stronger model, on failure only, budgeted); plus the session-coordination
  primitives — atomic single-winner claims with TTL + heartbeat, typed refusal
  codes, gate-protected adoption/reclaim, plus pre-phase ownership for generic routing
  changes and review isolation from active execution state; plus opt-in isolated
  worktree dispatch with one validated main coordination store, canonical contained
  reservation checks, and transactional merge/revert/preservation rules
  (`coverage: partial`).

## Not yet specced

- The workflow's skills themselves (`skills/bee-*`, including the new `bee-evolving`) have no area
  specs by convention. Their contracts live in `docs/07-contracts.md` and in each skill's own
  `SKILL.md` + `CREATION-LOG.md`; `skills/bee-writing-skills/scripts/render_openai_metadata.mjs`
  projects each canonical frontmatter identity into `agents/openai.yaml` for Codex, and its
  `--check` mode guards drift. The self-improvement *process* behavior is specced in
  `feedback-digest.md` (B5).
- `docs/specs/system-overview.md` does not exist. Offered, not yet written.

## Elsewhere

- `scripts/lib/run-module-worker.mjs` — shared isolated test-entrypoint runner
  for onboarding, hook, command, metadata, and concurrency verification.
- Communication doctrine (plain language, Gate Presentation Contract, Silent Bookkeeping —
  bee mechanics never narrated into chat, work language only; decision 1689af1b) lives in
  `skills/bee-hive/references/routing-and-contracts.md` § Communication Contract, mirrored as
  hive law 11 (`skills/bee-hive/SKILL.md`) and host critical rule 11 (`templates/AGENTS.block.md`).
  The *placement* rule behind every such mirror — always-applies doctrine belongs in
  `AGENTS.block.md`, a stage's own procedure detail may stay in `references/` — is specced in
  `doctrine-layer.md` (R1/B2); read it before authoring or relocating any rule.
- `docs/history/learnings/critical-patterns.md` — mandatory pre-work rules for agents.
- `docs/history/<feature>/` — how a feature was decided, planned, validated, reviewed, and shipped.
- `docs/decisions/` — numbered design decisions. `.bee/decisions.jsonl` — the live decision log.
- `docs/backlog.md` — the product backlog. `.bee/backlog.jsonl` — friction and findings.
- `.bee/state.json` and `.bee/backlog.jsonl` are **CLI-owned**: every mutation goes through `bee.mjs state` (generic routing changes require the selected record's pre-change phase as owner; gates use their dedicated verb; worker/scribing-run remain dedicated; `worker prune` cleans `.bee/workers` transients — prefix keep-set, fail-closed destructive verbs) or `bee.mjs backlog add`; direct edits are denied by the write-guard, and a standing suite keeps templates byte-identical to `.bee/bin/`.
- `docs/history/research/` — standalone bee-xia research briefs (topic-slug files; each leads with its Bottom Line).
- `hooks/` — the catalog and handlers for the installed plugin projection and generated repository fallback. It declares the Claude-only pre-spawn model-tier guard and paired Codex-only child-start/child-stop audit; onboarding activates exactly one source. Vendored handlers live under `.bee/bin/hooks/`.
- `skills/bee-hive/scripts/plugin_distribution.mjs` and `test_plugin_distribution.mjs` — shared strict distribution planner/prover and transaction suite. `scripts/install.sh`, `scripts/install.ps1`, and release-inventory tests are the two platform entrypoints and package proof.
- `docs/specs/performance-log.md` — the global cross-project performance log: sections
  summarizing a piece of work's per-model token cost (new/cached/total), parallelism, and
  active running time, plus a cross-project HTML matrix (`~/.config/beehive/performance.html`)
  that auto-refreshes at session close. Driven by the `bee perf start|stop|section|log|render|report`
  command group + `maybePerfRefresh` in `hooks/bee-session-close.mjs`. Core, cross-project scan,
  and HTML renderer live in `templates/lib/perf.mjs`.
- `skills/bee-hive/templates/bee.mjs` + `templates/lib/command-registry.mjs` — the sole shipped CLI (`bee.mjs <group> <verb>` over all 10 command groups, the 10th being `perf`; originated as an additive dispatcher in harness-integration-adopt, decision 30606de4, `docs/decisions/0024`, then made the sole canonical *and* sole shipped surface by shim-retire, D1, decision bbc6bcea — the 9 legacy per-group shims are deleted); `command-registry.mjs` is the single source of truth for the command surface. Contract in `docs/07-contracts.md`; spec-before-code still applies — read the touched area's spec before this code.
- `skills/bee-hive/templates/lib/schedule.mjs` — the computed work schedule (`computeSchedule`/`detectCycles`: dep layering + declared-path overlap packing into waves; consumed by `bee cells schedule`, cycle refusal in `cells.mjs` add/update, and the swarming/validating prose). Spec: `docs/specs/workflow-state.md` B17/B18, R26/R27.

hook: PreToolUse
hook: PreToolUse Completed
exec
/bin/bash -lc "sed -n '1,180p' .agents/skills/bee-planning/SKILL.md && sed -n '181,360p' .agents/skills/bee-hive/references/routing-and-contracts.md && sed -n '1,220p' docs/specs/advisor-protocol.md && sed -n '1,260p' docs/specs/onboarding.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 224ms:
---
name: bee-planning
description: >-
  Research the work, pick the smallest honest mode, and shape an executable plan. Use when exploring has locked CONTEXT.md, or a clear-scope task needs a mode decision and work shape before validation.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies: []
---

# planning

If `.bee/onboarding.json` is missing or stale, stop and invoke `bee-hive`.

Planning is the waggle dance: it turns locked `CONTEXT.md` decisions into the smallest believable path to execution — mode, approach, one unified `plan.md`, and (only after approval) current-slice cells.

Load `references/planning-reference.md` for artifact templates and cell quality rules; `references/edge-dimensions.md` for the test matrix. Discovery at L2/L3 runs through `bee-xia`.

## Hard Gates

- `CONTEXT.md` is the source of truth. Locked decisions are cited (`per D2`), never reinterpreted, never scope-reduced.
- **Stop at Gate 2.** No cell creation, no prep artifacts before the shape is approved.
- Cells for the **current slice only**. Future-slice cells are prohibited.
- Handoff only to `bee-validating`.

## 1. Bootstrap

Read, in order:

1. `docs/history/<feature>/CONTEXT.md` (or the hive scoping synthesis for surface-scope-earlier work).
2. `docs/history/learnings/critical-patterns.md` — mandatory.
3. Recent decisions: `node .bee/bin/bee.mjs decisions active --recent 3` and a tag-matched search for this feature's area (`node .bee/bin/bee.mjs decisions search --text <tag>`).
4. Tag-matched precedent in `docs/history/learnings/` (grep for the feature's domain keywords). Inject hits as "we've solved X before: <file>" — precedent beats research.
5. Session scout: `node .bee/bin/bee.mjs status --json`.

## 2. Discovery (research levels)

Pick the lowest level that removes real uncertainty:

- **L0 — skip:** pattern already exists in repo or learnings; cite it.
- **L1 — quick verify:** confirm one API/version/behavior with a command or doc check.
- **L2 — standard:** compare 2–3 candidate approaches; note trade-offs.
- **L3 — deep dive:** unfamiliar territory, external systems, or hard-gate flags.

At L2+, invoke `bee-xia` in-chain: local truth → local reuse → upstream patterns → version-aware docs, evidence labels on every claim, and the anti-reinvention ladder (reuse → built-in → adapt upstream → build) for the recommendation; its findings merge into the approach (see §4), never a standalone research file. §1 Bootstrap (CONTEXT, critical-patterns, decisions, learnings grep, status) delegates as an extraction-tier I/O worker per the Delegation contract (D2/D3, `bee-hive/references/routing-and-contracts.md`); other ad-hoc research dispatches during discovery (including bee-xia) default to the generation slot model; ceiling requires the [bee-tier: ceiling] marker plus a one-line justification. Frame candidates through **three layers of knowledge**: tried-and-true (what the repo/ecosystem already trusts), new-and-popular (current mainstream, verify version claims), first-principles (what the problem actually requires). Recommend from evidence, not novelty.

**Artifact fan-out (decision 0009).** Only **L2/L3** discovery earns a separate `docs/history/<feature>/discovery.md` (a real multi-candidate comparison worth reading alone). At **L0/L1**, record the finding in `plan.md`'s `## Discovery` note and cite it — do not spawn a discovery file that just restates the current state `plan.md` already carries. The full fan-out table (which artifacts become separate files, when) is in `references/planning-reference.md`.

## 3. Mode Gate (mechanical)

Count risk flags — do not vibe it:

> auth · authorization · data model · audit/security · external systems · public contracts · cross-platform · existing covered behavior · weak proof around the area · multi-domain

- **Every touched file is knowledge, not runtime** (docs/, specs, README, sample/example configs, plans) → `docs` lane: exit planning — announce one line, write it, format-check, capture per bee-hive. No plan.md, no cells, no gates.
- **0–1 flags** → `tiny` (≤2 files, one direct task) or `small` (≤3 files, no gray areas)
- **2–3 flags** or story-sized behavior → `standard`
- **4+ flags or any hard-gate flag** (auth, authorization, data loss, audit/security, external provider, validation removal) → `high-risk`
- One yes/no proof decides whether the plan is real → `spike` (regardless of flags)

Record the count and the flags in `plan.md`. Above `small`, state why smaller modes are insufficient. Use the least workflow that honestly protects the work.

**Greenfield init lane (P1, docs/09 item 6):** when the repo has no build and the init-lane offer was accepted at onboarding, the first slice is **one init cell** — `must_haves`: setup succeeds from scratch, one passing test exists, standard commands recorded in `.bee/config.json`, clean first commit — before any feature cell. Infrastructure first; the init cell's verify command is the recorded `test` command itself.

## 4. Synthesis — approach (section by default, file when earned)

Produce the approach: chosen path and rejected alternatives, risk map (component / LOW–MEDIUM–HIGH / proof needed), likely files and order, relevant learnings, and open questions for validating. MEDIUM/HIGH unknowns need a validating proof or a spike before execution cells exist.

Write it as an `## Approach` section **inside `plan.md`** by default. Graduate it to a standalone `docs/history/<feature>/approach.md` only for **high-risk** lanes or **L2+** discovery, where the rejected alternatives and risk map are substantial enough to read on their own (decision 0009 / fan-out table in the reference). Do not spawn `approach.md` for a small or standard fix whose approach is a paragraph — that just restates `plan.md`.

## 5. Shape — plan.md (STOP at Gate 2)

Write **one** `docs/history/<feature>/plan.md` with frontmatter:

```yaml
artifact_contract: bee-plan/v1
artifact_readiness: requirements-only
mode: tiny | small | standard | high-risk | spike
```

Body scaled to mode: direct note, spike question, small plan, phase plan, or epic map (templates in `references/planning-reference.md`). Sketch the test matrix against the 12 edge dimensions at a depth matching the lane.

Render `docs/history/<feature>/implement-plan.md` via `bee-briefing` only where the fan-out table calls for it (decision 0009): **high-risk** always; **standard** on-demand (default: `plan.md` + the Gate 2 chat layer are the review record — render the brief only when the user asks or the slice spans multiple domains); **small** optional mini-brief on request; **tiny**/**spike** none. When a brief is rendered, the Gate 2 message links it as the review document; when not, the Gate 2 message links `plan.md` directly. **Gate-bypass check FIRST (routing-and-contracts.md §Gate bypass, decisions 0010/dcf01d7b).** Read the active level (`node .bee/bin/bee.mjs status --json` → `gate_bypass_level`). If it bypasses Gate 2 for this lane — `normal` covers `tiny`/`small`/`standard` non-hard-gate; `full`/`total` cover **every** lane incl. high-risk/hard-gate — then **DO NOT ask.** Take the shaped plan as approved (the recommended path), set `approved_gates.shape` yourself (`bee.mjs state gate --name shape --approved true`), log a one-line audit decision, post `⚡ auto-approved Gate 2 (bypass) — preparing cells`, and continue straight to §6 Prep. Only present the question below when the level does NOT cover this gate. Present **Gate 2** (only if not bypassed) per the Gate Presentation Contract (bee-hive routing reference): plain-language layer in chat — what I plan to build / why this size / cost if the shape is wrong / what you are deciding — in the user's language, the review document linked not pasted; then verbatim: "Work shape is ready. Approve before current-work preparation?" — then **stop**. No pseudo-cells in markdown, no prep, no cells.

**Tiny/small merged gate (fast path).** For `tiny` and `small`, run the validating reality check inline first — MODE FIT / REPO FIT / ASSUMPTIONS / SMALLER PATH / PROOF SURFACE, each with one line of file/command evidence, 2 minutes not a report — then present **one merged question** in place of Gates 2 and 3: "Work shape + execution: I'm about to do [X] via [Y], verified by [Z]. Approve?" Approval records **both** `approved_gates.shape` and `approved_gates.execution`. **Under any active bypass level** (tiny/small are always covered — even `normal`), do NOT ask the merged question: run the reality check, and if it PASSES, set both `approved_gates.shape` and `approved_gates.execution` yourself, log one audit decision, post `⚡ auto-approved shape+execution (bypass)`, and continue to bee-swarming. Only a reality-check FAIL is surfaced to the human regardless of bypass. A reality-check FAIL is presented before asking, never buried. `bee-validating` is not separately invoked for these lanes; its subagents (plan-checker, cell reviewer) do not run — the plan is one direct task a stranger could pick up from `plan.md` alone, and the cold-pickup criteria are self-checked when writing the cell.

## 6. Prep (after Gate 2 approval only)

1. Enrich the **same** `plan.md` in place to `artifact_readiness: implementation-ready`: current slice selected, files bounded, verification commands named.
2. Create cells for the current slice only — the whole slice in **one** call, a JSON array piped straight to stdin (never one scratchpad file + one `add` per cell):
   ```bash
   node .bee/bin/bee.mjs cells add --stdin <<'EOF'
   [ { ...cell 1... }, { ...cell 2... } ]
   EOF
   ```
   The batch is all-or-nothing: every cell is validated before any is written. A single object (no array) still works for a one-cell slice; `--file` remains for pre-existing files.
   Every cell is an executable prompt: `files`, `read_first`, directive `action` citing D-IDs, `must_haves` (truths / artifacts / key_links / prohibitions), a runnable `verify` command, and `behavior_change: true` whenever the cell changes observable behavior. You may leave the model `tier` unset — the orchestrator judges each cell's difficulty and assigns the tier when it dispatches (decision 0016); set `tier` only as a hint when a cell is obviously mechanical (`extraction`) or obviously a hard integration/architecture call (`ceiling`), and even then swarming may override it. Cell quality rules and a schema example live in `references/planning-reference.md`.
3. If an implement plan was rendered at §5 (high-risk, or a standard/small feature where one was produced on request), invoke `bee-briefing` in refresh mode so its Affected Files and Implementation Steps re-project from the created cells. If no brief exists, skip — there is nothing to refresh.
4. Update state and hand off by lane: `tiny`/`small` (merged gate already approved) → `node .bee/bin/bee.mjs state set --owner planning --phase swarming --next-action "Invoke bee-swarming (single execution worker)."`; every other lane → `node .bee/bin/bee.mjs state set --owner planning --phase validating --next-action "Invoke bee-validating."` **The phase must be a real member of the enum** (`idle, exploring, planning, validating, swarming, reviewing, scribing, compounding, grooming, compounding-complete`) — invented names like `planning-complete` are refused by `state set`, and an agent that hits that refusal starts improvising the state machine, which is exactly how the chain broke (chain-integrity D6). Completion is carried by the approved gate, never by a phase name. `--owner` always names the selected record's pre-mutation phase; it is not persisted.

## Scope-Reduction Prohibition

If the shape cannot fit the budget or context, **never** quietly shrink a locked decision or drop a must-have. Answer `SPLIT RECOMMENDED`: propose slice boundaries, each slice honoring every locked decision it touches, and let the user choose. Cheaper alternatives found in research are *noted* alongside the honored decision — swapping them in requires the user superseding the D-ID.

## Headless

With `mode:headless`: run bootstrap, discovery, mode gate, and synthesis without questions. Write `plan.md` as `requirements-only` and stop — Gate 2 is never self-approved. Ambiguities (mode borderline, conflicting decisions, missing CONTEXT.md sections) go to an `Outstanding Questions` section of the structured terminal report.

## Red Flags

- skipping critical-patterns, active decisions, or `CONTEXT.md`
- skipping the mode gate, or choosing a mode without counting flags
- defaulting to phases without proving the work needs them
- cells or prep artifacts before Gate 2 approval
- future-slice cells · pseudo-cells in markdown
- vague exit states, missing deps, or a `verify` that cannot run
- silently swapping a locked decision for a "better" research finding
- shrinking scope instead of answering SPLIT RECOMMENDED

Violating the letter of the rules is violating the spirit of the rules.

Plan shaped and current-slice cells prepared. `tiny`/`small`: invoke bee-swarming skill (single execution worker — the merged gate already covers execution approval). All other lanes: invoke bee-validating skill.

- **`header` ≤ 12 characters** — it is a short chip label, NOT the question. Vietnamese/English descriptive headers ("Xử lý external", "Cách hiển thị") overflow instantly — use "Approach", "Scope", "External". **This is the #1 cause of the error.**
- **2–4 options per question** — never 1, never 5+. An "Other" free-text choice is added automatically, so fold overflow there or into a follow-up question.
- **1–4 questions per call** — batch independent questions (up to 4), serialize dependent ones.
- Every option needs both a **`label`** and a **`description`**; put the recommended option first with "(Recommended)" in its label.

A question that "needs" a long header or >4 options is a signal to reshape it — split it, or push detail into the option descriptions — never to exceed the schema.

### Gate bypass mode (opt-in autopilot, decisions 0010 / dcf01d7b)

Off by default. Turned on with the `bee-bypass-gate` skill, which sets `.bee/config.json` `gate_bypass` (persistent per-repo). When on at any level, the agent does **not** stop at a bypassed gate — it takes the RECOMMENDATION option itself and continues. This is the one deliberate exception to "gates are never self-approved"; **headless mode is not** — headless still stops at every gate.

**`gate_bypass` is a level.** `bypassLevel()` (lib/state.mjs) normalizes the config value; the level decides how far bypass reaches. The whole point of the levels above `normal` is that the human said, in advance and explicitly, "when you have a recommended option I will always approve it — do not stop me; the result is what I care about." Honor that literally: at the chosen level, the recommended option IS the approval.

| Level | Config value | Auto-approves | Still stops for the human |
|---|---|---|---|
| `off` | `false` / absent | nothing — every gate stops | every gate (default) |
| `normal` | `true` / `"on"` / `"normal"` | Gates 1-3 for `tiny`/`small`/`standard` non-hard-gate work | high-risk/hard-gate Gates 1-3 · secret reads · Gate 4 UAT/P1 |
| `full` | `"full"` | **all** Gates 1-3 at every lane, high-risk/hard-gate included | secret-file reads · a review P1 finding |
| `total` | `"total"` | **everything** — all Gates 1-3 any lane, secret-file reads, Gate 4 UAT, review P1 findings | **nothing — zero stops** |

Legacy `true` maps to `normal`, so existing repos are unchanged. At **Gate 1, 2, or 3** when the level bypasses that gate:

1. **Safety floor is level-scoped, not absolute.** Under `normal` the floor is exactly as before: a `high-risk` lane or any hard-gate flag (auth · authorization · data loss · audit/security · external provider · validation removal · database migration/schema change) is **NOT** bypassed — present it to the human normally. Under `full` and `total` the high-risk/hard-gate floor is **lifted** — the human lifted it by choosing the level — so those gates auto-approve too.
2. Do not ask. Instead: select the option the RECOMMENDATION favors; set `approved_gates.<gate>` in `.bee/state.json` (same write the human's "yes" would trigger); still write the machine-layer report to `docs/history/<feature>/reports/`; log a one-line audit entry — `node .bee/bin/bee.mjs decisions log --decision "auto-approved Gate N (bypass): <choice>" --rationale "<the recommendation's why>"` — so the approval is never silent; then post a **short chat line** (not a question) — `⚡ auto-approved Gate N (bypass): <what/why in one plain sentence>` — and continue. The human sees what happened and can still interrupt.

**Bypass suppresses approvals, never genuine information-gathering (decision a93994d3).** The point of the levels is to stop the agent asking merely to be *approved* — not to gag a real question. So distinguish two kinds of "question": an **approval** (the agent already has a confident best answer; the human would only rubber-stamp it) is suppressed under `full`/`total` — the agent takes its own answer and continues. An **information** question (the answer turns on a preference or knowledge only the human holds, and the agent cannot resolve it from evidence with a confident default) is still asked, even under `total`. This is where `bee-exploring`'s Socratic step still stops when it must (§4 materiality test + the information-vs-approval refinement): the human asked to keep being consulted for real information, only never for a rubber stamp. Litmus: *"do I already have a confident best answer?"* — yes → proceed; no, and only the human can supply it → ask.

**Gate 4 and secret reads follow the level.** Under `normal` and `full`, Gate 4 is never fully bypassed and bypass never creates a review session (SPEC R8, decision 565e68d0): a review only exists once the user invoked `bee-reviewing`, its UAT items are always presented, and any P1 always stops. Under `total`, a review the user started runs to completion without stopping — UAT items and P1 findings auto-proceed on the recommended resolution. **Secret-file reads** stop for the human under `off`/`normal`/`full`; only `total` auto-proceeds on them (the human accepted that credential contents may enter context/logs unprompted). Bypass still never *creates* a review session on its own at any level.

The mechanical guards do not change: `claimCell` and the write-guard still require `approved_gates.execution: true` — bypass simply means the agent records that approval itself for eligible work instead of waiting for the human. Bypass state is surfaced every session (the preamble and `bee_status` both print a loud level-specific `GATE BYPASS` banner — `NORMAL` / `FULL AUTOPILOT` / `TOTAL AUTOPILOT — ZERO STOPS`) so the active level is never silently in effect.

**The bypass is now mechanized at runtime, not prose-only (GitHub #18, hook-runtime B15/R14).** The rule above is still the assistant's to follow, but it is no longer the *only* thing honoring it: the session-stop checkpoint (`hooks/bee-session-close.mjs` `maybeBypassBlock`) emits a turn-control block that forces continuation when the assistant tries to stop mid-planning/validating at a gate the active level covers and is still pending. It is loop-guarded (blocks once per `sessionId:phase:gate:level`, then degrades to advisory) and excludes exploring/Gate 1 (genuine information questions still stop even under `total`). This closes the "invariant left in prose WILL be bypassed" gap (crit-pattern 20260714): the doctrine test mechanized the prose, this mechanizes the runtime.

### Delegation contract (fan-out: decide-altitude vs gather-altitude)

The one orchestration pattern bee runs: the session model (the owner's best model) stays the orchestrator in every phase, and mechanical gather/render/mine steps dispatch down-tier as I/O workers that return digests (D1 — replaces the advisor pattern in full, decisions 0013/0015 reversed).

- **Decide-altitude stays on the session model**: gates, Socratic questions, the mode gate, synthesis of findings, accept/reject of worker results, state writes, human conversation.
- **D2 rubric** — a mechanical step delegates down-tier when it needs reading >3 files OR content the main model only needs as a digest, not verbatim; the orchestrator may override either way at dispatch, same spirit as tier-judging (decision 0016). Prose-ruled — no new hook enforces the threshold.
- **D3 lane rule** — the rubric applies in every lane and every phase, tiny/small included. Lane scaling v2's (d02a6bc6) "0 subagents" for tiny/small means zero *ceremony* subagents (reviewers/checkers/panels); I/O workers are exempt. A 1-file tiny fix never crosses the rubric, so it stays inline naturally.
- **Digest contract** — an I/O worker returns paths read, the facts extracted (with file:line anchors), and verbatim quotes only where asked; the orchestrator never re-reads what a digest already answers.
- **Transport unchanged** — anchored `[bee-tier: <tier>]` marker or `model` param (decision 0023), model name in the Agent description, background dispatch where the runtime supports it (decision 0017), P22 dispatch log as the audit trail. I/O workers do **not** register in `bee.mjs state worker add` — the registry stays swarm-cell-scoped (reservations/status are execution concerns); the dispatch log is the audit surface for gathers.
- **Execution worker (AO14, second named class)** — the Delegation contract's other dispatch shape, distinguished from the I/O-offload worker by **authority and state effects**, not by task size. Unlike an I/O worker, an execution worker **does** register in the swarm registry (`bee.mjs state worker add`) and **does** take reservations under its own nickname; it implements exactly one assigned cell (claim → read `read_first` → implement within `files` → verify → cap → release) and returns exactly one status token (`[DONE]`/`[BLOCKED]`/`[HANDOFF]`/`[NOOP]`) — it is authority-bearing, never a digest-only gather. Every `bee-swarming` worker dispatch belongs to this class: full waves in `standard`/`high-risk`, and, since AO14, the single dispatched worker that now carries out `tiny`/`small` cell implementation too (`bee-swarming/SKILL.md`'s Single execution worker section) — never zero of them, even for the lightest lane. An independent reviewer or checker (plan-checker, cell reviewer, panel member) is **neither** class: it is a review-class dispatch — read-only, no registry entry, no reservations, no cell of its own — and is never called an "execution worker."
- **cli gather branch (plan 2A-ii, decision 34398e69)** — when `resolveTier(root, 'generation', runtime, {for:'gather'}).type === 'cli'`, a gather dispatch runs the configured command **verbatim** via the shell — nothing appended, ever (W7); the prompt goes in on **stdin**; every path handed to the worker is **absolute** (W9); the run is **read-only** by contract. **Stdout IS the digest**, framed by a delimiter contract: the worker prompt instructs the CLI to emit its digest between `<<<BEE_DIGEST` and `BEE_DIGEST>>>` lines, and the orchestrator extracts only what sits between them — missing delimiters or an empty digest is a **failed run**, surfaced loudly, never accepted as a silent green (fail-open-masking pattern, critical-patterns 20260716-class). No `result.json`, no cell, no reservation, no `bee.mjs state worker add` registration for a gather, same as any other I/O worker. **Known measurement gap, named not solved here:** a Bash-launched gather emits zero `dispatch.jsonl` rows (W-d) — closing that gap is Slice 3's job, not this branch's.

### Native Codex subagent tending

For every bee-owned native Codex subagent flow, including ordinary delegated
gathers, a completed `wait_agent` call with no completion is an **empty wait**:
it is a timeout signal only, never failure. Never follow an empty wait directly
with another `wait_agent`; authority, urgency, and no-chatter instructions create
no exception. Before any later bounded wait, continue material task-local work
when any remains; otherwise take exactly one `list_agents` snapshot. Then send
one concise commentary update naming both the live agent state and the next
action; only then may a later bounded wait run. No-op work, repeated state reads,
hidden reasoning, generic commentary, or commentary alone do not qualify.
Timeout never licenses interrupt, duplicate dispatch, claim release, or
reservation release; every running agent, claim, and reservation stays owned.
This refines, rather than replaces, the ban on file/scratchpad polling for
harness-managed subagents. External process and artifact polling keeps its own
contract and is outside this native-agent rule.

## Question Format

Used at all gates and Socratic steps:

```text
CONTEXT: <one or two sentences of relevant state, plain language>
QUESTION: <one outcome-framed question>
RECOMMENDATION: <the option the evidence favors, and why in one line>
  (a) <option> — <expected outcome>
  (b) <option> — <expected outcome>
  (c) <option> — <expected outcome>
```

One question per message. Never bundle. Never answer your own question.

## File Quick Reference

```text
.bee/
  onboarding.json  state.json  config.json  HANDOFF.json
  reservations.json  decisions.jsonl  backlog.jsonl
  cells/<id>.json  logs/hooks.jsonl  .inject-cache.json
  bin/  bin/lib/

docs/history/<feature>/
  CONTEXT.md  plan.md  reports/                       ← always
  discovery.md  approach.md  implement-plan.md        ← conditional (decision 0009): separate
                                                        files only for L2+ discovery / high-risk;
                                                        else folded into plan.md sections
  walkthrough.md                                      ← standard/high-risk, post-Gate-4

docs/history/learnings/
  critical-patterns.md  YYYYMMDD-<slug>.md

docs/specs/
  <area>.md  reading-map.md

.bee/spikes/<feature>/
```

## Helper CLI Quick Reference

`node .bee/bin/bee.mjs <group> <verb>` is the sole canonical and sole shipped
form for all 9 groups (`status`, `cells`, `reservations`, `decisions`, `state`,
`backlog`, `capture`, `reviews`, `feedback`) — one dispatcher, one registry.
The original `bee_*.mjs` shims (one per group — `status`, `cells`,
`reservations`, `decisions`, `state`, `backlog`, `capture`, `reviews`,
`feedback`) are retired (decision bbc6bcea, D1) and no longer ship in
templates or host `.bee/bin` — `LEGACY_HELPER_RE` in the write-guard stays
only as a transition guard for hosts mid-upgrade (D3).

```text
node .bee/bin/bee.mjs status [--json]
node .bee/bin/bee.mjs cells list [--feature F] [--status S] | ready [--feature F] | show --id ID
node .bee/bin/bee.mjs cells add --stdin   # one cell object or a whole-slice JSON array (all-or-nothing); --file cell.json also accepted
node .bee/bin/bee.mjs reservations list [--active-only] | sweep
node .bee/bin/bee.mjs decisions active [--recent N] | search --text T
node .bee/bin/bee.mjs state set --owner <selected pre-mutation phase> | gate | worker add/update/remove/clear/prune | scribing-run | start-feature
node .bee/bin/bee.mjs backlog add | counts | rank | badges
node .bee/bin/bee.mjs capture add | list | flush | count
node .bee/bin/bee.mjs reviews create | list | show | record | candidate add | candidates | status
node .bee/bin/bee.mjs feedback digest | count | collect | rank
```
---
area: advisor-protocol
updated: 2026-07-17
sources: [advisor cells adv-1..adv-3 (worker consult loop, 2026-07-13); advisor-and-orchestration Slices 2A-i..2A-iv, 2B, 3A, 3B, 4, 5 (cells ao-2ai-1..ao-5-1, traces in .bee/cells/, reports docs/history/advisor-and-orchestration/reports/, 2026-07-17); dogfood run .bee/spikes/advisor-and-orchestration/2aiv-cli-gather-dogfood.md; first live orchestrator consult digest .bee/spikes/advisor-and-orchestration/slice5-advisor-digest.txt]
decisions: [advisor D1-D3; 72f3d6dd (AO5 — config is the authority, no strength test, same-model no-op only); AO8 (advice-class slots read-only); AO2(b)/AO3/AO13 (one orchestrator trigger; Gate 3 precondition; event-based staleness, never a TTL); AO4 (call paths split by trigger class); f1ca79b9 (AO15 — attribution fields); 0019 + 2A-iv GO (external gather proven through config); AO14 (execution-worker class); 126412b9 (precondition keys on the selected record's mode)]
coverage: full
---

# Advisor Protocol (second opinions for workers and the orchestrator)

## Purpose

A bee-managed project may configure an **adviser** — a stronger or independent
model, possibly a different vendor's, reachable as a model or as an external
read-only command. The protocol answers three questions: *who* may ask for
advice (a stuck worker; the orchestrator before opening execution on high-risk
work), *when* the ask is mandatory versus available, and *what advice may never
do* (approve a gate, override a locked decision, or write anything). It exists
so that expensive mistakes meet a second opinion **before** they ship, without
adding a single human checkpoint.

## Entry Points & Triggers

- **Worker trigger (available, budgeted):** a worker that has just hit its
  first serious failed verification attempt may consult the adviser named in
  its dispatch — at most twice per claim, then it must return blocked.
- **Orchestrator trigger (mandatory, mechanical):** before the execution gate
  opens for work in the high-risk mode, the orchestrator must hold a live
  (non-stale) consult record. The approval verb itself refuses otherwise.
  This is machinery, not a human stop: every autopilot level still runs it.
- No other trigger exists. Conflict-between-decisions and scope-creep triggers
  were considered and explicitly deferred/dropped (they lack a mechanical
  detector today).

## Data Dictionary

| Element | Meaning |
|---|---|
| adviser | The advice-class helper the workspace configured: a model name, or an external read-only command. Whatever is configured IS the adviser — no family test, no strength ranking, no self-judged skip. |
| the one honest no-op | The only legitimate skip: the adviser resolves to literally the same model the asking worker runs on. An external-command adviser is never the same model, so it is always offered. |
| evidence bundle | What travels to the adviser: the exact check that failed and its output plus a diagnosis (worker ask), or the plan summary, risk map, and validation findings (orchestrator ask). Never session history, never secrets. |
| consult record | The durable stamp of an orchestrator consult: when, who was consulted, the head of the advice, and three machine-stamped anchors (active feature, newest active decision, plan fingerprint). Anchors are stamped by the recording verb, never supplied by the caller. |
| consult staleness | Event-based, never a time limit: the record stops satisfying the precondition when the feature changed, a newer decision became active, the plan changed, or the execution gate was revoked after the consult. |
| consult budget | Two consults per worker claim. A re-claim after a context-rescue grants a fresh budget; exhaustion returns the worker blocked, never a third ask. |
| advice-class slot | The adviser and reviewer configuration slots. Both are read-only by rule: configuration checking refuses a command carrying a known write-granting or auto-approve token on these slots. |

## Behaviors & Operations

**B1 — The dispatcher offers the adviser; the worker never self-assesses.**
At dispatch the orchestrator resolves the configured adviser and applies the
one honest no-op; otherwise the dispatch names the adviser and exactly how to
reach it (its proven transport). Workers on the session's strongest tier are
offered advisers too — configuration outranks any strength intuition.

**B2 — A stuck worker consults inside its own turn.** After its first serious
failed verification attempt, the worker sends the evidence bundle and applies
the reply itself. Advice that contradicts a locked decision converts to a
block citing both. The consult and its outcome land in the work unit's trace,
so the cap record shows what was asked and what came back.

**B3 — The orchestrator consults before high-risk execution approval.** The
orchestrator builds the evidence bundle, runs the adviser **read-only**
(external command: exactly as configured, bundle on standard input, printed
output is the advice; model-shaped: a review-class read-only dispatch), and
records the consult. The approval verb then verifies the record is live; a
missing or stale record refuses the approval with a corrective message naming
each failed condition and the exact consult flow. A workspace with no adviser
configured records that fact and proceeds — the rule adds one trigger, not a
dependency on configuration.

**B4 — Advice is advice.** It never approves a gate, never overrides a locked
decision, never edits anything, and is never accepted as verification — the
orchestrator still re-runs every verify itself. The mechanism meant to catch a
mistake is not allowed to make one: advice-class transports are refused write
privileges at configuration checking.

## Actors & Access

- **The orchestrator** — resolves and offers advisers, runs the mandatory
  pre-approval consult, records it, and owns every accept/reject decision.
- **Workers** — may consult only when dispatched with an adviser line, only
  after a real failure, within budget.
- **The adviser** — read-only; sees only the evidence bundle; its output is
  data, never instructions.
- **The human owner** — configures the adviser; is never stopped by a consult
  (autopilot levels govern human stops; this protocol adds none).

## Business Rules

- R1 — Config is the authority; the model does not get a vote (the ladder that
  once ranked models and silently skipped configured advisers is removed).
- R2 — The only skip is the literal same-model no-op.
- R3 — Advice-class slots are read-only, enforced at configuration checking
  (an honest blocklist of known write-granting/auto-approve tokens, stated as
  such — never a positive read-only guarantee).
- R4 — High-risk execution approval requires a live consult record; staleness
  is event-based (four events), never a time limit.
- R5 — Consult anchors are machine-stamped against the same record the verb
  mutates; callers cannot forge freshness.
- R6 — Advice never approves, never overrides, never writes; consults never
  substitute for the orchestrator's own verification re-run.
- R7 — The worker budget is two per claim; exhaustion returns blocked.

## Edge Cases Settled

- External command reporting success while doing nothing → advice/gather
  output is accepted only between declared framing markers; missing or empty
  output is a failed run, surfaced loudly (proven by a real dogfood run).
- Adviser configured but the command cannot receive a prompt → refused at
  configuration checking (prompt transport is declared, never inferred).
- Corrupt or hand-edited consult record → reads as missing; the verb never
  crashes; the approval refuses with the standard message.
- Execution gate revoked after a consult → the old consult is stale by rule;
  re-approval requires a fresh consult.

## Open Gaps

- External advice/gather runs do not yet appear in the dispatch audit log
  (known, assigned to the measurement backlog — the passive tools log covers
  in-family calls only).
- The conflict-between-decisions trigger waits on structured decision records
  (its prerequisite feature), and the scope-creep trigger has no source of
  truth; neither is built, neither is silently substituted.

## Pointers (implementation)

- Worker loop: `skills/bee-executing/SKILL.md` (Advisor Consult section);
  dispatch-time offer + same-model no-op: `skills/bee-swarming/SKILL.md` §4.
- Orchestrator consult + throw: `skills/bee-validating/SKILL.md` (Gate 3);
  `handleStateGate` + `state advisor-ref record/show` in
  `skills/bee-hive/templates/bee.mjs`; helpers `advisorRefAnchors` /
  `advisorRefStale` in `skills/bee-hive/templates/lib/state.mjs`.
- Read-only validation: `validateModelsConfig` (advice-class token blocklist)
  + `validateAgentFilesDrift`, same lib; suite `scripts/test_config_validate.mjs`.
- Resolution: `resolveAdvisor` (state.mjs); external gather contract:
  `skills/bee-hive/references/routing-and-contracts.md` (cli gather branch)
  and `docs/specs/doctrine-layer.md` B8/R12.
- Gate precondition spec detail: `docs/specs/workflow-state.md` B9/B9a.
---
area: onboarding
updated: 2026-07-16
coverage: partial
sources:
  - installer-version-parity-1-3-1 locked rules (fail-closed release tuple, full projection parity, greenfield/brownfield end-to-end success contract; D1/D3 verified in-engine with plugin-first coverage, D7 managed-set cleanup fencing, D2/D8 Linux Bash E2E shipped — cells -4/-2/-3, 2026-07-16; field fix cell -5: plugin CLI mutation verbs take NO --json (only `plugin list` does — real codex/claude contract), rollback reconciles the probed current state against the pre-run snapshot and reports failure only when restoring a previously-present plugin genuinely fails (a transition that died before installing anything rolls back as a no-op success), and the E2E fake CLIs reject --json on mutations so the wrong-flag contract can never test green again; field fix cell -6: legacy global skill copies (the pre-1.0 `~/.claude/skills` layout) are refreshed IN PLACE on every onboard — refresh-only over managed bee-* dirs that already exist there (never create, never delete, non-managed dirs untouched, resolved-newer global never downgraded, self/overlap sources skipped), reported as `refresh_legacy_global_skill` plan items that never drive `up_to_date`/blocked-first aggregation — closing the two-version skill inconsistency where a repo at the current release coexisted with a stale global copy both loaded by the runtime)
  - codex-sandbox-baseline cells codex-sandbox-baseline-1/codex-sandbox-baseline-2 (real onboarding entrypoint through the shared isolated test runner; full onboarding suite green, 2026-07-16)
  - codex-hook-state-parity cells 2, 3, 5 (paired Codex lifecycle audit, exclusive plugin-first/repo-copy distribution, and fresh-host handler delivery; capped traces and reports, 2026-07-16)
  - codex-harness-hardening-1d cells 1d-1/1d-2 (SRC-01..06 source-identity classifier R17 + status source field; 8 classifier/status tests, 2026-07-15)
  - codex-harness-hardening-1c cell codex-harness-hardening-1c-1 (honest status drift R16 via the onboarding managed-hash ledger; 5 drift tests, 2026-07-15)
  - codex-harness-hardening cell codex-harness-hardening-1b-1 (runtime-lib downgrade guard R15; split-brain regression 3->0, 2026-07-15)
  - installer-hardening ih-1..ih-6 (cells, 2026-07-13; flushed capture stub 92c9bcf6)
  - shim-retire D2 retirement pass (cells shim-retire-2, shim-retire-6 self-onboard proof, 2026-07-14)
  - cell onboard-statusline-1 (verification_evidence, 2026-07-11)
  - docs/history/onboard-statusline/reports/review-correctness.md
  - codex-runtime-parity D1 (distribution contract, 2026-07-11)
  - codex-runtime-parity D2 (lifecycle enforcement contract, 2026-07-11)
  - codex-runtime-parity D3 (nested-executor safety boundary, 2026-07-11)
  - codex-runtime-parity D4 (dispatch-contract scope, 2026-07-11)
  - bee-footprint D1 (managed ignore section, cells footprint-1/footprint-4, 2026-07-12)
  - fanout-delegation D1 (stale advisor key tolerance, 2026-07-12)
  - sticky-repo-hooks (cell sticky-hooks-1, 2026-07-13; found auditing 8 host projects after the v0.1.30 rollout)
decisions:
  - 55ff17ef (release-version parity is fail-closed across every distributed projection)
  - 09b776b5 (both installers prove complete greenfield/brownfield postconditions before success)
  - fc76ce41 (release 1.3.1 excludes unfinished wait-loop/worktree-isolation work)
  - 17bfc14a (Codex-safe onboarding tests preserve the real CLI entrypoint and observable process contract through an isolated Worker)
  - a83a3613 (shared isolated runner for nested Node entrypoints; real Git/Bash/Codex integration remains external)
  - cf511ff3 (plugin/package and repo-copy sources are mutually exclusive; cleanup is integrity- and ownership-proof-gated in both directions)
  - ce4eee19 (SRC-01..06 shipped as a pure shared classifier, wrap-not-replace, consumed by status + onboarding — codex-harness-hardening 1d)
  - 21be04f7 (status gains a report-only source field; unknown/legacy never implicit source — codex-harness-hardening 1d)
  - 485e949a (honest status drift reference = the onboarding managed-hash ledger; no new shipped artifact — codex-harness-hardening 1c)
  - 579bbad7 (status drift is report-only, stays a boolean + optional detail; fail-open on absent/legacy ledger — codex-harness-hardening 1c)
  - fe6593c0 (runtime-lib downgrade refusal targets the vendored copy path; zero-mutation, self-install included — codex-harness-hardening 1b)
  - 3318374a (installer hardening: per-project skills default, global opt-in, default instructions import)
  - bbc6bcea (shim-retire: unified command surface; retired helper scripts removed from hosts)
  - 102efe08 (opt-in statusline vendor shape)
  - c6ee6b6e (Gate 4 onboard-statusline: anchored detection, sweep opt-in)
  - 4cc1c355 (Codex plugin-first distribution)
  - b7af1bf9 (full compatible Codex lifecycle-hook parity)
  - codex-hook-state-parity D1-D3, D8-D14
  - 73ed41d6 (workspace-scoped Codex executors; blanket bypass forbidden)
  - d7d5f459 (current Codex dispatch contract first; custom profiles deferred)
  - 26203bd3 (managed ignore-list section; machine-local vs team-durable split)
  - de967733 (advisor mode removed; stale config key warned-and-ignored)
  - 9927fafb (a switch that narrows what an upgrade compares must equally narrow what it claims; repo-hook opt-in is sticky)
---

# Onboarding

## Purpose

Onboarding installs and keeps current everything bee manages inside a host project:
the agent-instructions block, the runtime state files, the vendored helper commands,
and — for projects that opted in — the workspace status-display scripts. Re-running it
is always safe: it reports what would change before changing anything, and an
up-to-date project reports "nothing to do".

> **Coverage note:** this spec describes status-display vendoring, the managed
> ignore section, distribution-mode selection, exclusive hook-source
> arbitration, fenced cleanup, and installed-package proof. Remaining surfaces
> are listed under Open Gaps.

## Entry Points & Triggers

- A check run: the agent asks onboarding what would change (report-only, no writes).
- An apply run: the agent authorizes onboarding to perform the reported changes.
- Both runs are executed by the agent, never handed to the human.
- Plugin-capable installs default to a plugin-first check/apply transaction;
  `repo-copy` is an explicit fallback mode.
- A dry run plans the complete distribution transaction and mutates nothing.

## Data Dictionary

| Element | Meaning |
|---|---|
| status-display pair | Two scripts that render the assistant's per-session status line: the display command and its usage/cost aggregator. Canonical copies live with bee's source; each opted-in project holds a vendored copy. |
| opt-in signal | The project's assistant-settings file declares a status-display command that points at the **project's own** copy of the display script — either anchored by the project-directory variable or written as a bare project-relative path. A reference to a user-level (home-directory) copy is NOT an opt-in. |
| managed status-display record | A fingerprint per pair file, stored in the project's onboarding record **only when the project opts in**, so later runs can tell current from drifted. Projects that never opted in carry no such record. |
| managed ignore section | A clearly-marked, start/end-delimited block that onboarding owns inside the project's version-control ignore list. Every byte outside the delimiters belongs to the project and is never touched. |
| machine-local runtime record | Content the managed ignore section silences: workflow state, reservations, worker scratch, logs, capture queue, feedback snapshot, injection cache, the pause/handoff record, and disposable experiment files. |
| team-durable knowledge | Content that always stays version-tracked, never silenced by the managed ignore section: vendored tooling, configuration, the decision log, the friction log, and work-cell records. |
| ignore-section fingerprint | A hash of the managed ignore section's expected content, stored in the project's onboarding record so a later run can detect drift in that section specifically. |
| distribution mode | The exclusive source selected for one install: `plugin-first` or explicit `repo-copy`. The two are never active together. |
| release inventory | The complete, duplicate-free file set and package metadata that an enabled installed package must match before cleanup is authorized. |
| ownership ledger | The installer's exact record of user-runtime roots and directories it created; name similarity alone never grants deletion authority. |
| recognized bee hook entry | A hook entry whose event, matcher, and handler match the generated bee catalog. Foreign and user entries are never recognized by name alone. |
| whole-run snapshot | The inputs revalidated immediately before mutation: paths, aliases, symlinks, package status, inventory, ledger, and hook shapes. Any mismatch aborts the entire run with zero writes. |

## Behaviors & Operations

**Detect (every run).** Onboarding reads the project's assistant-settings file and
derives the opt-in signal. What blocks it: nothing — an absent, unreadable,
unparseable, or unexpectedly-shaped settings file simply means "not opted in";
detection never fails a run. What the agent observes: opted-in projects with a
missing or altered pair file see one planned copy action per affected file;
non-opted projects see zero status-display actions, always.

**Vendor (apply run, opted-in projects only).** Each planned pair file is written
from the canonical copy, whole-file, atomically. Side effects: none beyond the two
files — the settings file is never created, modified, or backed up by this
behavior. Afterwards the project's status display renders with the canonical
behavior, and an immediate re-check reports up to date.

**Heal drift.** A locally edited pair file is treated as drift, not preference: the
next apply overwrites it with the canonical copy (same contract as every vendored
helper — the canonical source is bee's tree). A project that wants local
status-display behavior keeps its settings pointing at a user-level copy instead.

**Stay out (non-opted projects).** Projects without the opt-in signal never receive
the pair files, never gain a managed status-display record, and their up-to-date
status is entirely unaffected by this mechanism's existence. Such a project still
shows a status line if the human's user-level settings name a user-level copy — but
that copy is outside onboarding's reach and may be arbitrarily stale. Keeping it
current is a manual copy from the canonical pair, and nothing in bee detects or
reports its drift.

### What the status display renders

One line of session facts, then an optional second line of per-model token and cost
totals. Every segment is omitted when its fact is unavailable, and an unavailable
fact never fails the line (a missing subscription-usage report, a project outside
version control, a model without an effort setting — each simply drops its segment).

| Segment | Fact |
|---|---|
| location | The session's working directory, and its version-control branch when there is one |
| model | The model's display name, plus its reasoning-effort level when that level is not the default |
| context | Percentage of the context window **remaining** — never the percentage used |
| session usage | Percentage of the rolling short-window subscription limit consumed, when the runtime reports one |
| weekly usage | Percentage of the rolling weekly subscription limit consumed, when the runtime reports one |
| cost | Per-model new/cached token totals and their billed cost, aggregated over the session and every subagent transcript |

**Context colour is a workflow signal, not a gauge.** The colour of the context
segment answers one question — "does the human need to think about a handoff?" —
so its thresholds track bee's handoff mark (pause at roughly 65% of the window
consumed, i.e. ~35% remaining), not an even split of the scale:

| Context remaining | Colour | Meaning |
|---|---|---|
| above ~35% | calm (green) | routine work; nothing to do |
| ~20-35% | caution (yellow) | the handoff mark is here; start wrapping up |
| below ~20% | alarm (red) | write the handoff and pause |

The rule this encodes: an alarm colour that is on for most of a working session is
not an alarm. Any future retune keeps the caution band anchored on the handoff mark
for exactly that reason. The subscription-usage segments follow the same principle —
quiet by default, emphasized only once consumption is high enough to matter.

**Manage the ignore section (every apply run).** Trigger: an apply run against
any host project, opted in or not — the managed ignore section is unconditional.
What blocks it: nothing; the three cases below are exhaustive and one always
applies. What changes: exactly one of —
- no ignore list exists yet → the list is created holding only the managed
  section;
- an ignore list exists without the section → the section is appended,
  inserting a guaranteed separating line break first even when the existing
  file's last line has none, so the section never fuses onto the file's last
  line;
- the section is already present but its content has drifted from the
  tracked fingerprint → only the bytes between the section's own markers are
  rewritten; every byte of the project's own content outside those markers is
  preserved exactly, unchanged.

A line that merely resembles the section's marker text inside a longer user
comment is never mistaken for the real marker, so it never triggers case two
or three by accident. Comparing the section's current content against the
fingerprint tolerates Windows-style line endings, so a line-ending-only
difference is never reported as drift and never causes a rewrite on every run.
Side effects: none beyond the ignore list file itself. What the agent
observes: the check run reports which of the three cases applies (or "current"
when the fingerprint matches) before anything is written; the apply run then
performs exactly that action and the ignore-section fingerprint in the
project's onboarding record is refreshed. What the human observes: an
up-to-date project's ignore list carries the section unchanged; a project with
drifted or missing section sees the report name the exact action before
approving it.

**Warn on already-tracked silenced paths (every run).** Trigger: any run,
check or apply, where one or more of the paths the managed ignore section is
meant to silence are already tracked in the host project's version-control
index — ignore-list entries are inert for paths already tracked, so the
managed section alone cannot silence them. What blocks it: nothing; this is
report-only. What changes: nothing to the host's version-control index —
onboarding never runs the untracking operation itself, in this or any other
behavior. Side effects: none. What the agent and human observe: the report
carries one warning naming the count of already-tracked paths and the exact
one-time command the operator must run to untrack them; the warning
disappears once no silenced path remains tracked.

**Select and prove exactly one distribution source.** Plugin-first is the
default on a capable runtime. It proves an enabled installed package and its
complete release inventory, preflights the whole transaction, then removes only
direct plain `bee-*` skill directories and catalog-recognized bee hook entries
from project fallback roots. Repo-copy first proves the package inactive, then
generates the managed project projections; Codex-only receives the same hook
catalog as a combined-runtime install. Bash and PowerShell installers use the
same planner and proof rules. A symlink, alias, unknown target, invalid ledger,
package mismatch, or hook-shape mismatch aborts before any write. Release proof
uses a staged cachebuster without changing the canonical package/version tuple;
live user-home installation and fresh-thread loading remain outstanding UAT.
Every generated repository hook command must resolve to a handler included in
the same fresh-host onboarding payload; projection topology without referenced
file delivery is a failed install, even when catalog parity itself is green.

**An opt-in is remembered, and what it opted into stays current (every run).**
Trigger: any run against a project that has previously opted into carrying its
own local copies of the lifecycle guardrails. What changes: those local copies
are refreshed to the current ones on **every** run thereafter — whether or not
the request repeats the opt-in switch. Why: the switch names a *choice the
project made*, not a consent owed again at each upgrade. What each actor
observes: an owner who opted in once sees their guardrails track the workflow's
own version, silently and permanently; a project that never opted in is still
never handed local guardrails by a plain run — the remembered choice is the only
thing that carries, never a default. What used to happen instead, and is the
reason this behavior is stated explicitly: a plain upgrade refreshed the standing
instruction sheet, the helpers, and the recorded version, left the guardrails at
whatever version they were first installed at, and **reported the project up to
date** — so a project could run current doctrine against its original guards
indefinitely, with no signal anywhere that it was doing so.

**Install skills into the project itself (every install/apply).** Trigger: an
install or apply against a host project. What changes: the workflow's skill set
is synced into the host project's own skill-discovery locations — one per
supported assistant runtime — and those copies are version-tracked in the host,
so every teammate receives working skills with a plain checkout. A machine-global
skill install happens only on an explicit opt-in switch, never by default; and
when the target is the workflow's own source tree, the per-project copy is
skipped (the source is already authoritative there). What each actor observes: a
fresh clone of an onboarded host has working skills with zero machine-level
setup; an operator who wants one shared machine-wide set asks for it explicitly.

**Provide the assistant-instructions import by default.** Trigger: onboarding a
host whose assistant reads a project instructions file that can import the
standing instruction sheet. What changes: the import artifact is created (or its
managed import line added) by default; declining it is an explicit opt-out
switch, not an omission. Existing content outside the managed line is never
replaced without consent. What the human observes: a freshly onboarded project
"just works" in a new session without manually wiring instructions.

**Retire superseded helper scripts (every run).** Trigger: any run against a
host that still carries one of the nine retired per-command helper scripts in
its vendored tools directory — hosts onboarded before the command surface was
unified into the single dispatcher. What blocks it: nothing. What changes: the
check run plans one removal per leftover retired script; the apply run deletes
exactly those files. Removal is scoped to the exact retired filenames inside the
managed tools directory — no other file is ever deleted by this pass. Side
effects: none. What each actor observes: after one apply, the host's tools
directory carries only the unified dispatcher with its libraries and guardrails;
a second run plans zero removals; a freshly onboarded host never receives the
retired scripts at all. The installer's own post-install verification and its
printed quickstart also speak only the unified dispatcher's status command.

**Fetch the workflow source without a full working tree (bootstrap installs).**
Trigger: an install invoked with no local source, so the installer must fetch the
workflow from its published repository at some reference. What changes: the fetch
checks out only the trees the installer actually reads — the skill set and the
plugin manifest — never the whole tree. Why it matters: the workspace filesystem
of one supported platform rejects several characters that the source platform
allows in filenames (colon, asterisk, question mark, quote, angle brackets,

codex
The planning skill’s delegation rule applies here because the answer depends on several repository artifacts. I’m offloading only the mechanical anchor check; I’ll keep the compatibility and API-shape judgment here.
collab: Wait
codex
The anchor check is still scanning the refusal paths and first-party JSON consumers. My provisional view is that the payload placement is sound; the decisive issue is whether the test also pins the non-forceable/unknown branch, which the happy-path three-step sequence does not exercise.
hook: PreToolUse
hook: PreToolUse Completed
exec
/bin/bash -lc "sed -n '1,260p' docs/specs/advisor-protocol.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 162ms:
---
area: advisor-protocol
updated: 2026-07-17
sources: [advisor cells adv-1..adv-3 (worker consult loop, 2026-07-13); advisor-and-orchestration Slices 2A-i..2A-iv, 2B, 3A, 3B, 4, 5 (cells ao-2ai-1..ao-5-1, traces in .bee/cells/, reports docs/history/advisor-and-orchestration/reports/, 2026-07-17); dogfood run .bee/spikes/advisor-and-orchestration/2aiv-cli-gather-dogfood.md; first live orchestrator consult digest .bee/spikes/advisor-and-orchestration/slice5-advisor-digest.txt]
decisions: [advisor D1-D3; 72f3d6dd (AO5 — config is the authority, no strength test, same-model no-op only); AO8 (advice-class slots read-only); AO2(b)/AO3/AO13 (one orchestrator trigger; Gate 3 precondition; event-based staleness, never a TTL); AO4 (call paths split by trigger class); f1ca79b9 (AO15 — attribution fields); 0019 + 2A-iv GO (external gather proven through config); AO14 (execution-worker class); 126412b9 (precondition keys on the selected record's mode)]
coverage: full
---

# Advisor Protocol (second opinions for workers and the orchestrator)

## Purpose

A bee-managed project may configure an **adviser** — a stronger or independent
model, possibly a different vendor's, reachable as a model or as an external
read-only command. The protocol answers three questions: *who* may ask for
advice (a stuck worker; the orchestrator before opening execution on high-risk
work), *when* the ask is mandatory versus available, and *what advice may never
do* (approve a gate, override a locked decision, or write anything). It exists
so that expensive mistakes meet a second opinion **before** they ship, without
adding a single human checkpoint.

## Entry Points & Triggers

- **Worker trigger (available, budgeted):** a worker that has just hit its
  first serious failed verification attempt may consult the adviser named in
  its dispatch — at most twice per claim, then it must return blocked.
- **Orchestrator trigger (mandatory, mechanical):** before the execution gate
  opens for work in the high-risk mode, the orchestrator must hold a live
  (non-stale) consult record. The approval verb itself refuses otherwise.
  This is machinery, not a human stop: every autopilot level still runs it.
- No other trigger exists. Conflict-between-decisions and scope-creep triggers
  were considered and explicitly deferred/dropped (they lack a mechanical
  detector today).

## Data Dictionary

| Element | Meaning |
|---|---|
| adviser | The advice-class helper the workspace configured: a model name, or an external read-only command. Whatever is configured IS the adviser — no family test, no strength ranking, no self-judged skip. |
| the one honest no-op | The only legitimate skip: the adviser resolves to literally the same model the asking worker runs on. An external-command adviser is never the same model, so it is always offered. |
| evidence bundle | What travels to the adviser: the exact check that failed and its output plus a diagnosis (worker ask), or the plan summary, risk map, and validation findings (orchestrator ask). Never session history, never secrets. |
| consult record | The durable stamp of an orchestrator consult: when, who was consulted, the head of the advice, and three machine-stamped anchors (active feature, newest active decision, plan fingerprint). Anchors are stamped by the recording verb, never supplied by the caller. |
| consult staleness | Event-based, never a time limit: the record stops satisfying the precondition when the feature changed, a newer decision became active, the plan changed, or the execution gate was revoked after the consult. |
| consult budget | Two consults per worker claim. A re-claim after a context-rescue grants a fresh budget; exhaustion returns the worker blocked, never a third ask. |
| advice-class slot | The adviser and reviewer configuration slots. Both are read-only by rule: configuration checking refuses a command carrying a known write-granting or auto-approve token on these slots. |

## Behaviors & Operations

**B1 — The dispatcher offers the adviser; the worker never self-assesses.**
At dispatch the orchestrator resolves the configured adviser and applies the
one honest no-op; otherwise the dispatch names the adviser and exactly how to
reach it (its proven transport). Workers on the session's strongest tier are
offered advisers too — configuration outranks any strength intuition.

**B2 — A stuck worker consults inside its own turn.** After its first serious
failed verification attempt, the worker sends the evidence bundle and applies
the reply itself. Advice that contradicts a locked decision converts to a
block citing both. The consult and its outcome land in the work unit's trace,
so the cap record shows what was asked and what came back.

**B3 — The orchestrator consults before high-risk execution approval.** The
orchestrator builds the evidence bundle, runs the adviser **read-only**
(external command: exactly as configured, bundle on standard input, printed
output is the advice; model-shaped: a review-class read-only dispatch), and
records the consult. The approval verb then verifies the record is live; a
missing or stale record refuses the approval with a corrective message naming
each failed condition and the exact consult flow. A workspace with no adviser
configured records that fact and proceeds — the rule adds one trigger, not a
dependency on configuration.

**B4 — Advice is advice.** It never approves a gate, never overrides a locked
decision, never edits anything, and is never accepted as verification — the
orchestrator still re-runs every verify itself. The mechanism meant to catch a
mistake is not allowed to make one: advice-class transports are refused write
privileges at configuration checking.

## Actors & Access

- **The orchestrator** — resolves and offers advisers, runs the mandatory
  pre-approval consult, records it, and owns every accept/reject decision.
- **Workers** — may consult only when dispatched with an adviser line, only
  after a real failure, within budget.
- **The adviser** — read-only; sees only the evidence bundle; its output is
  data, never instructions.
- **The human owner** — configures the adviser; is never stopped by a consult
  (autopilot levels govern human stops; this protocol adds none).

## Business Rules

- R1 — Config is the authority; the model does not get a vote (the ladder that
  once ranked models and silently skipped configured advisers is removed).
- R2 — The only skip is the literal same-model no-op.
- R3 — Advice-class slots are read-only, enforced at configuration checking
  (an honest blocklist of known write-granting/auto-approve tokens, stated as
  such — never a positive read-only guarantee).
- R4 — High-risk execution approval requires a live consult record; staleness
  is event-based (four events), never a time limit.
- R5 — Consult anchors are machine-stamped against the same record the verb
  mutates; callers cannot forge freshness.
- R6 — Advice never approves, never overrides, never writes; consults never
  substitute for the orchestrator's own verification re-run.
- R7 — The worker budget is two per claim; exhaustion returns blocked.

## Edge Cases Settled

- External command reporting success while doing nothing → advice/gather
  output is accepted only between declared framing markers; missing or empty
  output is a failed run, surfaced loudly (proven by a real dogfood run).
- Adviser configured but the command cannot receive a prompt → refused at
  configuration checking (prompt transport is declared, never inferred).
- Corrupt or hand-edited consult record → reads as missing; the verb never
  crashes; the approval refuses with the standard message.
- Execution gate revoked after a consult → the old consult is stale by rule;
  re-approval requires a fresh consult.

## Open Gaps

- External advice/gather runs do not yet appear in the dispatch audit log
  (known, assigned to the measurement backlog — the passive tools log covers
  in-family calls only).
- The conflict-between-decisions trigger waits on structured decision records
  (its prerequisite feature), and the scope-creep trigger has no source of
  truth; neither is built, neither is silently substituted.

## Pointers (implementation)

- Worker loop: `skills/bee-executing/SKILL.md` (Advisor Consult section);
  dispatch-time offer + same-model no-op: `skills/bee-swarming/SKILL.md` §4.
- Orchestrator consult + throw: `skills/bee-validating/SKILL.md` (Gate 3);
  `handleStateGate` + `state advisor-ref record/show` in
  `skills/bee-hive/templates/bee.mjs`; helpers `advisorRefAnchors` /
  `advisorRefStale` in `skills/bee-hive/templates/lib/state.mjs`.
- Read-only validation: `validateModelsConfig` (advice-class token blocklist)
  + `validateAgentFilesDrift`, same lib; suite `scripts/test_config_validate.mjs`.
- Resolution: `resolveAdvisor` (state.mjs); external gather contract:
  `skills/bee-hive/references/routing-and-contracts.md` (cli gather branch)
  and `docs/specs/doctrine-layer.md` B8/R12.
- Gate precondition spec detail: `docs/specs/workflow-state.md` B9/B9a.

collab: Wait
hook: PreToolUse
hook: PreToolUse Completed
exec
/bin/bash -lc "sed -n '860,985p' skills/bee-hive/scripts/onboard_bee.mjs && sed -n '2075,2140p' skills/bee-hive/scripts/onboard_bee.mjs && sed -n '2345,2410p' skills/bee-hive/scripts/onboard_bee.mjs && sed -n '2815,2870p' skills/bee-hive/scripts/onboard_bee.mjs && sed -n '1590,1635p' skills/bee-hive/scripts/test_onboard_bee.mjs && sed -n '3240,3345p' skills/bee-hive/scripts/test_onboard_bee.mjs" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 141ms:
    older.push(`host_helpers ${hostVersion.value}`);
  }
  if (
    installedVersion.state === "resolved" &&
    compareVersions(sourceVersion.value, installedVersion.value) < 0
  ) {
    older.push(`installed_skills ${installedVersion.value}`);
  }
  if (older.length > 0) {
    // --force-downgrade may override ONLY when all three versions resolved
    // numeric (D3): absent/unknown trees are resolution states, not versions.
    const allNumeric = [sourceVersion, hostVersion, installedVersion].every(
      (v) => v.state === "resolved",
    );
    target.blocked = {
      status: "blocked_downgrade",
      reason: `source ${sourceVersion.value} is older than ${older.join(" and ")}${
        allNumeric ? " - refusing (--force-downgrade overrides after review)" : " - refusing (not forceable: not all versions resolved numeric)"
      }`,
      forceable: allNumeric,
    };
  }

  if (target.mode === "sync" || target.mode === "fresh") {
    if (!target.blocked || target.blocked.forceable) {
      // D2 forced-apply transparency, per target: a forceable blocked target
      // still carries its computed items BEFORE any --force-downgrade.
      // `target` on every item names the root it belongs to; `path` stays
      // target_root-relative (scope semantics unchanged).
      target.items = computeSkillItems(sourceRoot, targetRoot).map((item) => ({
        ...item,
        target: kind,
      }));
    }
  }
  return target;
}

// Blocked-first aggregation across targets (D5): ANY blocked target blocks the
// whole stage; the aggregate is forceable only when EVERY blocked target is
// forceable (a refused apply stays all-or-nothing, zero mutations anywhere).
// status/versions surface the first blocked target in stable target order;
// reason names every blocked target.
function aggregateSkillBlocked(targets) {
  const blockedTargets = targets.filter((t) => t.blocked);
  if (blockedTargets.length === 0) {
    return null;
  }
  const reasons = blockedTargets.map((t) =>
    blockedTargets.length > 1 || targets.length > 1
      ? `[${t.kind}] ${t.blocked.reason}`
      : t.blocked.reason,
  );
  return {
    status: blockedTargets[0].blocked.status,
    reason: reasons.join("; "),
    forceable: blockedTargets.every((t) => t.blocked.forceable),
    versions: blockedTargets[0].versions,
  };
}

// Target-independent runtime-lib downgrade guard (VER-02..06). computePlan
// step 3 vendors the running script's lib (copy_lib -> .bee/bin/lib) and
// helpers (copy_helper -> .bee/bin, bee.mjs itself included) into the host by
// byte-diff. This guard stays target-independent: runtime safety must not
// depend on which projection targets exist or how an individual target's
// resolution path evolves. It returns a blocked-first downgrade block that the
// whole-apply abort honors with zero mutation (fe6593c0; SPEC VER-02..06).
// runs per non-self_skip target; when every target self_skips it never fires.
// This guard is target-independent (it compares the running lib source against
// the installed .bee/bin/lib) so it fires under self_skip too, returning a
// blocked-first downgrade block that the whole-apply abort honors with zero
// mutation (fe6593c0; SPEC VER-02..06).
function hostLibDowngradeBlock(sourceVersion, hostVersion) {
  // VER-04: a fully absent runtime lib is a fresh install, never a block.
  if (hostVersion.state === "absent") return null;
  const versions = {
    source: versionLabel(sourceVersion),
    host_helpers: versionLabel(hostVersion),
    installed_skills: versionLabel(hostVersion),
  };
  // VER-03: the runtime lib exists but its version cannot be read (or the
  // running source's own version is unreadable) - refuse, never forceable: an
  // unresolved runtime must never be overwritten by an older/unknown source.
  if (sourceVersion.state !== "resolved" || hostVersion.state !== "resolved") {
    return {
      status: "blocked_downgrade",
      reason: `runtime lib .bee/bin/lib version unresolvable (source ${versionLabel(
        sourceVersion,
      )}, runtime ${versionLabel(hostVersion)}) - refusing (never forceable)`,
      forceable: false,
      versions,
    };
  }
  // VER-02/05: both resolved - block only a true downgrade; forceable because
  // both identities are trusted numeric (--force-downgrade overrides after review).
  if (compareVersions(sourceVersion.value, hostVersion.value) < 0) {
    return {
      status: "blocked_downgrade",
      reason: `source ${sourceVersion.value} is older than the installed runtime lib .bee/bin/lib ${hostVersion.value} - refusing (--force-downgrade overrides after review)`,
      forceable: true,
      versions,
    };
  }
  return null;
}

// Legacy-global version-parity refresh (installer-version-parity-1-3-1).
// Field report: a repo on the current bee release still loads a pre-1.0
// ~/.claude/skills/bee-* global install alongside its per-project copy, so the
// user sees two conflicting bee versions. Since per-project sync became the
// default the legacy global root is only touched under --global-skills, so its
// stale copies never update. WITHOUT the flag this best-effort pass refreshes,
// IN PLACE, every MANAGED skill (the exact source name set the sync manages)
// whose directory ALREADY EXISTS under the legacy global root to current source
// content. It NEVER creates a global copy that is absent, NEVER deletes anything
// (no remove pass), and never touches non-managed dirs (bee-custom, foreign -
// they surface only as computeSkillItems remove_skill items, which are dropped).
// It is strictly additive: it never participates in blocked-first aggregation,
// so an unrefreshable global never refuses the primary repo sync; and it is
// skipped entirely when the running source IS the legacy global root (a global
// install / legacy_global source, or a self-onboard from there) so it can never
// self-copy. Under --global-skills it does not run at all - the global root is a
// fully managed target there, semantics unchanged. Fully read-only.
function computeLegacyGlobalRefresh({ sourceRoot, realSource, realRepo, sourceVersion }) {
  const globalRoot = skillsTargetRoot();
  // header alongside create_agents_block (ordered after it), block-only
  // AGENTS.md files flip up_to_date -> changes_needed (intended upgrade),
  // and any existing prose suppresses the item entirely.
  if (!hasProseOutsideBlock(agentsText)) {
    plan.push({ action: "propose_agents_header", path: "AGENTS.md" });
  }

  // 2. runtime files (create-if-missing only; never overwrite state/decisions/cells)
  const runtimeFiles = [
    [".bee/state.json", () => `${JSON.stringify(DEFAULT_STATE, null, 2)}\n`],
    [".bee/config.json", () => `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`],
    [".bee/reservations.json", () => `${JSON.stringify({ reservations: [] }, null, 2)}\n`],
    [".bee/decisions.jsonl", () => ""],
    [".bee/backlog.jsonl", () => ""],
  ];
  for (const [rel] of runtimeFiles) {
    if (!fs.existsSync(path.join(repoRoot, rel))) {
      plan.push({ action: "create_runtime_file", path: rel });
    }
  }
  for (const relDir of [".bee/cells", ".bee/logs"]) {
    if (!fs.existsSync(path.join(repoRoot, relDir))) {
      plan.push({ action: "create_dir", path: relDir });
    }
  }

  // 3. vendored helpers + lib (copy when missing or drifted)
  for (const name of listTemplateHelpers()) {
    const source = fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf8");
    const target = path.join(repoRoot, ".bee", "bin", name);
    if (readTextIfExists(target) !== source) {
      plan.push({ action: "copy_helper", path: `.bee/bin/${name}` });
    }
  }
  // 3a. retired helper shims (D2): a host with a leftover bee_*.mjs shim in
  // its own .bee/bin/ gets a removal item on the next apply. Idempotent - once
  // the file is gone (this run, or already), no item is produced.
  for (const name of RETIRED_HELPERS) {
    if (fs.existsSync(path.join(repoRoot, ".bee", "bin", name))) {
      plan.push({ action: "remove_helper", path: `.bee/bin/${name}` });
    }
  }
  for (const name of listTemplateLibModules()) {
    const source = fs.readFileSync(path.join(TEMPLATES_LIB_DIR, name), "utf8");
    const target = path.join(repoRoot, ".bee", "bin", "lib", name);
    if (readTextIfExists(target) !== source) {
      plan.push({ action: "copy_lib", path: `.bee/bin/lib/${name}` });
    }
  }

  // 3b. statusline pair (opt-in sync): only for repos whose settings.json
  // already points statusLine at .claude/statusline-command.sh. Byte-compare
  // like the vendored helpers; never creates the opt-in on other repos.
  if (statuslineOptIn(repoRoot)) {
    for (const name of listTemplateStatusline()) {
      const source = fs.readFileSync(path.join(TEMPLATES_STATUSLINE_DIR, name), "utf8");
      const target = path.join(repoRoot, ".claude", name);
      if (readTextIfExists(target) !== source) {
        plan.push({ action: "copy_statusline", path: `.claude/${name}` });
      }
    }
  }

  // 4. learnings stub
  if (!fs.existsSync(path.join(repoRoot, "docs", "history", "learnings", "critical-patterns.md"))) {
    plan.push({ action: "create_stub", path: "docs/history/learnings/critical-patterns.md" });
// ---------- apply ----------

function applyPlan(
  repoRoot,
  { repoHooks = false, claudeMd = true, globalSkills = false, syncSkills = true, forceDowngrade = false } = {},
) {
  const { plan, beeVersion, renderedBlock, renderedGitignoreBlock, desiredManaged, skillSync } =
    computePlan(repoRoot, {
      repoHooks,
      claudeMd,
      globalSkills,
      syncSkills,
    });

  // D3 preflight: refusal aborts the ENTIRE apply BEFORE any write - the item
  // loop below and the unconditional onboarding.json rewrite after it are
  // unreachable on refusal, so a refused apply mutates nothing anywhere (repo,
  // in-repo skill roots, or global). Blocked-first across targets: ANY blocked
  // target refuses the whole apply. --force-downgrade overrides only when
  // EVERY blocked target is a version refusal with all three versions resolved
  // numeric; unknown and blocked_no_source are resolution failures and are
  // never forceable.
  let forcedDowngrade = false;
  if (skillSync.blocked) {
    if (forceDowngrade && skillSync.blocked.forceable) {
      forcedDowngrade = true;
      // computePlan withholds ALL targets' items from the flat plan while the
      // stage is blocked - restore every target's computed items for the
      // forced apply (unblocked targets included).
      for (const target of skillSync.targets) {
        plan.push(...target.items);
      }
      if (skillSync.legacyRefresh) {
        plan.push(...skillSync.legacyRefresh.items);
      }
    } else {
      // Review P1-6 / D2: computeSkillSyncTarget() already computed each
      // target's items whenever its refusal is forceable (empty [] otherwise)
      // - a human deciding whether to pass --force-downgrade must see exactly
      // what it will overwrite/delete PER TARGET before authorizing it, not
      // only after the fact in a forced apply's own report. Surfaced here so
      // the refused-apply response (the response most users actually see
      // first) carries it.
      return {
        blocked: {
          status: skillSync.blocked.status,
          reason: skillSync.blocked.reason,
          forceable: skillSync.blocked.forceable,
        },
        versions: skillSync.blocked.versions,
        skills: { source_root: skillSync.source_root, targets: skillSync.targets },
        beeVersion,
      };
    }
  }
  const skillTargetRootByKind = new Map(
    skillSync.targets.map((t) => [t.kind, t.target_root]),
  );
  // The legacy-global refresh target is not one of skillSync.targets (it never
  // participates in aggregation); register its root so refresh items resolve
  // the same way sync_skill items do.
  if (skillSync.legacyRefresh) {
    skillTargetRootByKind.set("legacy-global", skillSync.legacyRefresh.target_root);
  }

  const applied = [];
          // computed whenever its refusal is forceable (empty [] otherwise) -
          // a blocked dry-run must still show exactly which skills a
          // --force-downgrade would overwrite/delete per target, not just the
          // general-item plan.
          targets: skillSync.targets,
        },
        notices: [
          ...commandsNotices(repoRoot, { firstOnboard }),
          ...staleAdvisorNotices(repoRoot),
          ...trackedPathsNotices(repoRoot),
        ],
      };
      if (skillSync.blocked) {
        // Reporting is not failing: plan mode exits 0 with the blocked status.
        // Top-level reason/versions are blocked-first aggregates (first
        // blocked target's versions; every blocked target named in reason).
        payload.reason = skillSync.blocked.reason;
        payload.versions = skillSync.blocked.versions;
      }
      emit(payload, args.json);
      return 0;
    }

    const result = applyPlan(repoRoot, options);
    if (result.blocked) {
      // Refused apply: zero mutations happened; exit nonzero (D3).
      emit(
        {
          repo_root: repoRoot,
          status: result.blocked.status,
          bee_version: result.beeVersion,
          reason: result.blocked.reason,
          versions: result.versions,
          // Review P1-6 / D2: same forced-apply-transparency payload as plan
          // mode - this refused response is what most users see BEFORE
          // deciding whether to pass --force-downgrade, so it must carry every
          // target's computed items too.
          skills: result.skills,
        },
        args.json,
      );
      return 1;
    }
    const recheck = computePlan(repoRoot, options);
    // Review P1-7: computePlan() withholds skill items from `plan` while its
    // skillSync stage is blocked (see step 7 above), so `recheck.plan.length`
    // alone can go to zero - and falsely report up_to_date - while the skill
    // stage itself is still genuinely blocked (reachable after a forced
    // downgrade that left one skill mid-refusal, e.g. a residual per-skill
    // symlink/alias block that keeps its version marker un-synced). Blocked-
    // first precedence, aggregated across ALL targets (D5): recheck can NEVER
    // read "up_to_date" while ANY target is still blocked.
    const recheckBlocked = recheck.skillSync.blocked;
    const payload = {
      repo_root: repoRoot,
      status: "applied",
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
}

// --- per-target helpers (installer-hardening) --------------------------------
const REPO_TARGET_ROOTS = [".claude/skills", ".agents/skills"];

function readRepoTarget(repo, relRoot, rel) {
  const abs = path.join(repo, ...relRoot.split("/"), ...rel.split("/"));
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
}

// Seed the two managed in-repo targets with a version-marked bee-hive so a
// per-target downgrade refusal resolves all three versions numeric (forceable)
// - without this, a fresh in-repo target reads installed_skills "absent" and a
// host_helpers-driven downgrade refusal is never forceable for that target.
function seedRepoSkillTargets(repo, version) {
  for (const relRoot of REPO_TARGET_ROOTS) {
    writeSkillFiles(path.join(repo, ...relRoot.split("/")), "bee-hive", {
      "SKILL.md": "# installed hive\n",
      "templates/lib/state.mjs": fakeStateSource(version),
    });
  }
}

function skillTarget(payload, kind) {
  return (payload?.skills?.targets || []).find((t) => t.kind === kind) || null;
}

function flatSkillItems(payload) {
  return (payload?.skills?.targets || []).flatMap((t) => t.items || []);
}

// Stable full-tree digest (lstat semantics: symlinks recorded by target, never
// followed) for byte-identical / zero-mutation assertions.
function hashTree(dir) {
  if (!fs.existsSync(dir)) {
    return "ABSENT";
  }
  const lines = [];
  const walk = (d, prefix) => {
    const entries = fs.readdirSync(d, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const abs = path.join(d, e.name);
      if (e.isSymbolicLink()) {
        JSON.stringify(apply.payload?.skills || null));
      check(fs.existsSync(path.join(installedRoot, "bee-Alpha")),
        "the physical skill directory survives (never sync-then-delete)");
      check(readInstalled(home, "bee-Alpha/SKILL.md") === "# alpha installed, other case\n",
        "aliased skill content byte-identical (never written through the alias)",
        String(readInstalled(home, "bee-Alpha/SKILL.md")));
      check(apply.payload?.recheck === "changes_needed",
        "recheck stays changes_needed while a skill is alias-blocked (parity unresolved)",
        JSON.stringify(apply.payload?.recheck_plan || []));
    } finally {
      try {
        fs.rmSync(srcBase, { recursive: true, force: true });
        fs.rmSync(aliasBase, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }
}

// --- 10v. forced-apply transparency: blocked-forceable dry-run and refused ---
// apply both enumerate the skills a --force-downgrade would overwrite/delete
// (review P1-6, D2). Before the fix neither the plain dry-run (`--json`, no
// --apply) nor the refused `--apply` response carried the computed items -
// a human deciding whether to pass --force-downgrade could not see which
// skills get overwritten (sync_skill) or DELETED (remove_skill) until AFTER
// authorizing it and reading the forced apply's own report.
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-forcedvis-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      version: "0.1.18",
      skills: { "bee-alpha": { "SKILL.md": "# alpha v2 from older source\n" } },
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(path.join(repo, ".bee", "bin", "lib"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".bee", "bin", "lib", "state.mjs"),
      fakeStateSource("0.1.19"), "utf8");
    seedRepoSkillTargets(repo, "0.1.19"); // numeric per-target installs keep the refusal forceable
    makeInstalledSkills(home, {
      version: "0.1.19",
      skills: {
        "bee-alpha": { "SKILL.md": "# alpha v1 - about to be overwritten\n" },
        "bee-doomed": { "SKILL.md": "# about to be deleted\n" },
      },
    });
    const plan = await runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
    check(plan.status === 0 && plan.payload?.status === "blocked_downgrade",
      "forced-vis: plan mode reports blocked_downgrade (forceable)",
      `exit ${plan.status} status ${plan.payload?.status}`);
    const planItems = flatSkillItems(plan.payload);
    check(planItems.some((i) => i.action === "sync_skill" && i.skill === "bee-alpha" && i.target === "global"),
      "forced-vis: blocked dry-run still enumerates the sync_skill a force would overwrite (P1-6)",
      JSON.stringify(planItems));
    check(planItems.some((i) => i.action === "remove_skill" && i.skill === "bee-doomed" && i.target === "global"),
      "forced-vis: blocked dry-run still enumerates the remove_skill a force would DELETE (P1-6)",
      JSON.stringify(planItems));
    const refused = await runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(refused.status === 1 && refused.payload?.status === "blocked_downgrade",
      "forced-vis: refused apply (no --force-downgrade) still reports blocked_downgrade");
    const refusedItems = flatSkillItems(refused.payload);
    check(refusedItems.some((i) => i.action === "sync_skill" && i.skill === "bee-alpha" && i.target === "global") &&
      refusedItems.some((i) => i.action === "remove_skill" && i.skill === "bee-doomed" && i.target === "global"),
      "forced-vis: the refused --apply response ALSO enumerates the items per target, not only the plain dry-run (P1-6)",
      JSON.stringify(refusedItems));
    const forced = await runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--global-skills", "--force-downgrade", "--json"], home);
    check(forced.status === 0 && forced.payload?.status === "applied" &&
      forced.payload?.forced_downgrade === true,
      "forced-vis: forcing actually applies", `exit ${forced.status} status ${forced.payload?.status}`);
    const previewedSkills = [...new Set(refusedItems.map((i) => i.skill))].sort();
    const appliedSkills = [...new Set((forced.payload?.applied || [])
      .filter((i) => i.action === "sync_skill" || i.action === "remove_skill")
      .map((i) => i.skill))].sort();
    check(JSON.stringify(previewedSkills.filter((s) =>
      forced.payload.applied.some((i) => i.skill === s))) === JSON.stringify(appliedSkills) ||
      appliedSkills.every((s) => previewedSkills.includes(s)),
      "forced-vis: the forced apply touches exactly the reviewed set previewed before authorization",
      JSON.stringify({ previewedSkills, appliedSkills }));
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10w. recheck honesty: a blocked skill stage can never report up_to_date -
// (review P1-7, D5) The post-apply recheck previously used `plan.length`
// only, which is empty whenever computePlan() withholds skill items because
// its skillSync stage is blocked - a false parity claim. Reachable after a
// forced downgrade that leaves ONE skill mid-refusal (a nested symlink
// elsewhere in bee-hive, off the templates/lib/state.mjs path so the version
// marker itself still resolves): the whole-stage version compare sees the
// installed bee-hive skill's marker still un-synced (older source, newer
// installed) and is genuinely blocked again at recheck time, while the
// general (non-skill) plan items are all freshly up to date and contribute
// zero items - so plan.length alone reads as up_to_date. Blocked-first
// precedence must override that.
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-recheckhonesty-"));
  const home = makeFakeHome();
  try {

hook: PreToolUse
hook: PreToolUse Completed
exec
/bin/bash -lc "sed -n '2410,2595p' skills/bee-hive/scripts/onboard_bee.mjs && rg -n \"forceable: false|never forceable|blocked_no_source|blocked_downgrade\" skills/bee-hive/scripts/test_onboard_bee.mjs | head -80" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 154ms:
  const applied = [];
  const skippedSkills = [];

  // Compose the header BEFORE any mergeAgentsContent call (decision D4): it
  // rides the existing-content input of the same merge - one write mechanism,
  // no new merge helper parameter.
  const proposeHeader = plan.some((item) => item.action === "propose_agents_header");
  const headerText = proposeHeader ? composeAgentsHeader(repoRoot) : "";
  let headerApplied = false;

  for (const item of plan) {
    const target = path.join(repoRoot, ...item.path.split("/"));
    switch (item.action) {
      case "create_agents_block":
      case "append_agents_block":
      case "update_agents_block": {
        const merged = mergeAgentsContent(headerText + readTextIfExists(target), renderedBlock);
        writeFileAtomic(target, merged.text);
        headerApplied = proposeHeader;
        break;
      }
      case "propose_agents_header": {
        if (headerApplied) {
          break; // header already rode the block write above
        }
        // Block-only file (already onboarded, block current): prepend the
        // header through the same merge path - the in-place block replace
        // keeps everything outside the markers untouched.
        const merged = mergeAgentsContent(headerText + readTextIfExists(target), renderedBlock);
        writeFileAtomic(target, merged.text);
        headerApplied = true;
        break;
      }
      case "create_gitignore_block":
      case "append_gitignore_block":
      case "update_gitignore_block": {
        const merged = mergeGitignoreContent(readTextIfExists(target), renderedGitignoreBlock);
        writeFileAtomic(target, merged.text);
        break;
      }
      case "create_runtime_file": {
        if (!fs.existsSync(target)) {
          const rel = item.path;
          let content = "";
          if (rel.endsWith("state.json")) {
            content = `${JSON.stringify(DEFAULT_STATE, null, 2)}\n`;
          } else if (rel.endsWith("config.json")) {
            content = `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`;
          } else if (rel.endsWith("reservations.json")) {
            content = `${JSON.stringify({ reservations: [] }, null, 2)}\n`;
          }
          writeFileAtomic(target, content);
        }
        break;
      }
      case "create_dir": {
        fs.mkdirSync(target, { recursive: true });
        break;
      }
      case "copy_helper": {
        const name = path.basename(item.path);
        writeFileAtomic(target, fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf8"));
        break;
      }
      case "remove_helper": {
        // Never a generic rm: only ever the exact retired-shim basename, and
        // only ever under .bee/bin/ (item.path is always .bee/bin/<name>,
        // constructed by this script - never host/user-supplied).
        const name = path.basename(item.path);
        if (RETIRED_HELPERS.includes(name) && path.dirname(item.path) === ".bee/bin") {
          fs.rmSync(target, { force: true });
        }
        break;
      }
      case "copy_lib": {
        const name = path.basename(item.path);
        writeFileAtomic(target, fs.readFileSync(path.join(TEMPLATES_LIB_DIR, name), "utf8"));
        break;
      }
      case "copy_repo_hook": {
        const name = path.basename(item.path);
        writeFileAtomic(target, fs.readFileSync(path.join(PLUGIN_HOOKS_DIR, name), "utf8"));
        break;
      }
      case "copy_statusline": {
        const name = path.basename(item.path);
        writeFileAtomic(target, fs.readFileSync(path.join(TEMPLATES_STATUSLINE_DIR, name), "utf8"));
        break;
      }
      case "create_stub": {
        writeFileAtomic(target, CRITICAL_PATTERNS_STUB);
        break;
      }
      case "create_specs_stub": {
        // create-only: scribing owns these files; an existing one is never
        // rewritten even when its content drifted from the stub.
        if (!fs.existsSync(target)) {
          writeFileAtomic(
            target,
            item.path.endsWith("reading-map.md") ? READING_MAP_STUB : SYSTEM_OVERVIEW_STUB,
          );
        }
        break;
      }
      case "create_claude_md": {
        writeFileAtomic(target, CLAUDE_MD_TEMPLATE);
        break;
      }
      case "append_claude_md_import": {
        const existing = readTextIfExists(target) || "";
        const separator = existing.endsWith("\n") ? "\n" : "\n\n";
        writeFileAtomic(target, `${existing}${separator}${CLAUDE_MD_IMPORT_SECTION}`);
        break;
      }
      case "merge_repo_hook_settings": {
        const merged = mergeRepoSettings(target);
        if (fs.existsSync(target)) {
          fs.copyFileSync(target, `${target}.bak`);
        }
        writeFileAtomic(target, merged.text);
        break;
      }
      case "merge_codex_hooks": {
        const merged = mergeCodexHooks(target);
        if (fs.existsSync(target)) {
          fs.copyFileSync(target, `${target}.bak`);
        }
        writeFileAtomic(target, merged.text);
        break;
      }
      case "ensure_codex_statusline": {
        // Machine-level target: NEVER the repoRoot-joined `target` above.
        const configPath = codexUserConfigPath();
        if (!codexStatuslineMissing()) {
          break; // plan-to-apply race: someone added it meanwhile — stay out
        }
        const text = readTextIfExists(configPath);
        fs.copyFileSync(configPath, `${configPath}.bak`);
        const tuiHeader = /^\[tui\][ \t]*\r?$/m;
        let next;
        if (tuiHeader.test(text)) {
          next = text.replace(tuiHeader, (header) => `${header}\n${CODEX_STATUS_LINE_BLOCK.trimEnd()}`);
        } else {
          const sep = !text || text.endsWith("\n") ? "" : "\n";
          next = `${text}${sep}\n[tui]\n${CODEX_STATUS_LINE_BLOCK}`;
        }
        writeFileAtomic(configPath, next);
        break;
      }
      case "sync_agent_file": {
        const model = resolveAgentTierModel(repoRoot, AGENT_TIER_BY_NAME[item.agent]);
        if (model) {
          writeFileAtomic(target, renderAgentTemplate(item.agent, model));
        }
        break;
      }
      case "remove_agent_file": {
        fs.rmSync(target, { force: true });
        break;
      }
      case "write_onboarding": {
        // handled after the loop so managed versions reflect the final state
        break;
      }
      case "sync_skill": {
        const result = applySyncSkill(
          skillSync.source_root,
          skillTargetRootByKind.get(item.target),
          item.skill,
        );
        if (result.blocked) {
          skippedSkills.push({ skill: item.skill, target: item.target, reason: result.blocked });
          continue; // skipped loudly, not applied
        }
        break;
      }
      case "refresh_legacy_global_skill": {
        // Version-parity in-place refresh of a managed skill that ALREADY
        // EXISTS under the legacy global root. Honor "already exists" at apply
        // time too (plan-to-apply race): never create a copy that vanished, and
        // never replace a non-plain entry.
        const root = skillTargetRootByKind.get(item.target);
        const st = lstatIfExists(path.join(root, item.skill));
        if (!st || st.isSymbolicLink() || !st.isDirectory()) {
          skippedSkills.push({
            skill: item.skill,
1604:// host_helpers-driven downgrade refusal is never forceable for that target.
1777:      apply.status === 1 && apply.payload?.status === "blocked_no_source",
1794:      `source tuple: ${scenario.label} is never forceable`,
2046:  // never forceable — exactly as the project-projection modes do.
2063:    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
2076:      "plugin-source: a source-tuple failure is never forceable");
2148:    check(plan.status === 0 && plan.payload?.status === "blocked_downgrade",
2149:      "downgrade: plan mode reports blocked_downgrade with exit 0",
2153:    check(apply.payload?.status === "blocked_downgrade",
2154:      "downgrade: apply reports blocked_downgrade", JSON.stringify(apply.payload));
2177:// --- 10d. existing-but-unreadable tree = unknown = refuse, never forceable ---
2189:    check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
2197:    check(forced.status === 1 && forced.payload?.status === "blocked_downgrade",
2230:    check(refused.status === 1 && refused.payload?.status === "blocked_downgrade",
2336:    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
2367:    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
2436:    check(plan.status === 0 && plan.payload?.status === "blocked_no_source",
2437:      "identity failure: plan reports blocked_no_source with exit 0",
2445:    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
2455:    check(forced.status === 1 && forced.payload?.status === "blocked_no_source",
2456:      "blocked_no_source is NEVER forceable");
2484:    check(plan.status === 0 && plan.payload?.status === "blocked_downgrade",
2485:      "source<helpers only: plan mode reports blocked_downgrade (F3)",
2488:    check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
2513:// --- 10k. host_helpers existing-but-unreadable -> unknown -> refuse, never forceable ---
2526:    check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
2534:    check(forced.status === 1 && forced.payload?.status === "blocked_downgrade",
2551:// --- 10l. source EXISTING-but-unreadable -> unknown -> refuse, never forceable (F3) ---
2569:    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
2577:    check(forced.status === 1 && forced.payload?.status === "blocked_no_source",
2780:// marker must resolve installed_skills to "unknown" (refuse, never forceable) -
2802:    check(plan.status === 0 && plan.payload?.status === "blocked_downgrade",
2809:    check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
2814:    check(forced.status === 1 && forced.payload?.status === "blocked_downgrade",
2848:// always refuses, never forceable.
2874:        check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
2891:    // (b) multiple line-anchored declarations -> unknown, never forceable
2902:        check(forced.status === 1 && forced.payload?.status === "blocked_downgrade" &&
2931:        check(apply.status === 1 && apply.payload?.status === "blocked_downgrade" &&
2960:        check(apply.status === 1 && apply.payload?.status === "blocked_downgrade" &&
3097:// blocked_no_source at preflight, never forceable, zero mutations.
3114:    check(plan.status === 0 && plan.payload?.status === "blocked_no_source",
3115:      "repo inside the skills root: plan reports blocked_no_source (review P1-4)",
3118:    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
3128:    check(forced.status === 1 && forced.payload?.status === "blocked_no_source",
3158:    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
3288:    check(plan.status === 0 && plan.payload?.status === "blocked_downgrade",
3289:      "forced-vis: plan mode reports blocked_downgrade (forceable)",
3299:    check(refused.status === 1 && refused.payload?.status === "blocked_downgrade",
3300:      "forced-vis: refused apply (no --force-downgrade) still reports blocked_downgrade");
3364:    check(refused.status === 1 && refused.payload?.status === "blocked_downgrade",
3365:      "recheck-honesty: unforced apply refuses as blocked_downgrade (setup sanity)",

hook: PreToolUse
hook: PreToolUse Completed
exec
/bin/bash -lc "sed -n '2595,2695p' skills/bee-hive/scripts/onboard_bee.mjs && sed -n '2125,2210p' skills/bee-hive/scripts/test_onboard_bee.mjs && sed -n '2465,2545p' skills/bee-hive/scripts/test_onboard_bee.mjs" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 137ms:
            skill: item.skill,
            target: item.target,
            reason: "legacy global skill is absent or not a plain directory - skipped, never created",
          });
          continue;
        }
        const result = applySyncSkill(skillSync.source_root, root, item.skill);
        if (result.blocked) {
          skippedSkills.push({ skill: item.skill, target: item.target, reason: result.blocked });
          continue; // skipped loudly, not applied
        }
        break;
      }
      case "remove_skill": {
        const result = applyRemoveSkill(skillTargetRootByKind.get(item.target), item.skill);
        if (result.blocked) {
          skippedSkills.push({ skill: item.skill, target: item.target, reason: result.blocked });
          continue; // skipped loudly, not applied
        }
        break;
      }
      case "blocked_symlink":
      case "blocked_alias": {
        // Loud per-skill report (F6 / review P1-5): never written through,
        // unlinked, deleted, or sync-then-deleted.
        skippedSkills.push({ skill: item.skill, target: item.target, reason: item.reason });
        continue;
      }
      default:
        break;
    }
    applied.push(item);
  }

  // Always (re)write onboarding.json on apply so managed versions are current.
  const onboardingPath = path.join(repoRoot, ".bee", "onboarding.json");
  const previous = readJsonIfExists(onboardingPath) || {};
  const managed = { ...desiredManaged };
  if (!repoHooks && previous.managed && previous.managed.repo_hooks) {
    // preserve the record of a prior --repo-hooks install
    managed.repo_hooks = previous.managed.repo_hooks;
  }
  const onboardingPayload = {
    schema_version: ONBOARDING_SCHEMA_VERSION,
    bee_version: beeVersion,
    managed,
    agents_sync: computeAgentsSyncRecord(repoRoot, beeVersion),
    created_at: previous.created_at || utcNow(),
    updated_at: utcNow(),
  };
  writeFileAtomic(onboardingPath, `${JSON.stringify(onboardingPayload, null, 2)}\n`);

  return {
    applied,
    onboarding: onboardingPayload,
    beeVersion,
    forcedDowngrade,
    // F9: a forced apply must still report which versions it overrode -
    // blocked-first, the first blocked target's triple (pre-force state).
    forcedVersions: skillSync.blocked ? skillSync.blocked.versions : null,
    skills: {
      source_root: skillSync.source_root,
      targets: skillSync.targets,
      skipped: skippedSkills,
    },
  };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = {
    repoRoot: null,
    apply: false,
    json: false,
    repoHooks: false,
    // D1: CLAUDE.md is a default onboarding artifact; --no-claude-md opts out.
    // --claude-md is still accepted, now a no-op alias of the default.
    claudeMd: true,
    // D3 (installer-hardening): the legacy global ~/.claude/skills target is
    // opt-in; without the flag it is never read as a sync target, written, or
    // deleted.
    globalSkills: false,
    pluginSource: false,
    forceDowngrade: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repo-root") {
      args.repoRoot = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--repo-root=")) {
      args.repoRoot = arg.slice("--repo-root=".length);
    } else if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--repo-hooks") {
      args.repoHooks = true;
    } else if (arg === "--claude-md") {
      args.claudeMd = true;
    check(apply.payload?.recheck === "up_to_date", "fence: recheck up_to_date");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10c. zero-mutation downgrade refusal (D3) -------------------------------
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-refuse-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), { version: "0.1.18" });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    makeInstalledSkills(home, { version: "0.1.19" });
    const homeBefore = hashTree(home);
    const repoBefore = hashTree(repo);
    const plan = await runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
    check(plan.status === 0 && plan.payload?.status === "blocked_downgrade",
      "downgrade: plan mode reports blocked_downgrade with exit 0",
      `exit ${plan.status} status ${plan.payload?.status}`);
    const apply = await runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(apply.status === 1, "downgrade: apply exits 1", `exit ${apply.status}`);
    check(apply.payload?.status === "blocked_downgrade",
      "downgrade: apply reports blocked_downgrade", JSON.stringify(apply.payload));
    const v = apply.payload?.versions || {};
    check(v.source === "0.1.18" && v.host_helpers === "absent" && v.installed_skills === "0.1.19",
      "refusal reports all three versions (source/host_helpers/installed_skills)",
      JSON.stringify(v));
    check(typeof apply.payload?.reason === "string" && apply.payload.reason.length > 0,
      "refusal carries a one-line reason");
    check(hashTree(home) === homeBefore,
      "refused apply leaves the target tree byte-identical (zero mutations)");
    check(hashTree(repo) === repoBefore,
      "refused apply leaves the repo byte-identical (post-loop onboarding.json write unreachable)");
    check(!fs.existsSync(path.join(repo, ".bee")),
      "refused apply creates no .bee dir at all");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10d. existing-but-unreadable tree = unknown = refuse, never forceable ---
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-unknown-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), { version: "0.1.19" });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    makeInstalledSkills(home, { stateText: "// corrupt: no version constant here\n" });
    const homeBefore = hashTree(home);
    const repoBefore = hashTree(repo);
    const apply = await runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
      "existing-but-unreadable installed tree refuses (unknown, D3)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(apply.payload?.versions?.installed_skills === "unknown",
      "unreadable installed version reported as unknown",
      JSON.stringify(apply.payload?.versions || {}));
    const forced = await runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--global-skills", "--force-downgrade", "--json"], home);
    check(forced.status === 1 && forced.payload?.status === "blocked_downgrade",
      "unknown is NEVER forceable: --force-downgrade still refuses",
      `exit ${forced.status} status ${forced.payload?.status}`);
    check(forced.payload?.forced_downgrade === undefined,
      "refused force reports no forced_downgrade");
    check(hashTree(home) === homeBefore && hashTree(repo) === repoBefore,
      "unforceable refusal keeps repo and target byte-identical");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
    }
  }
}

// --- 10j. source<helpers only refusal, driven solely by host_helpers (F3) ---
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-hostonly-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), { version: "0.1.18" });
    const repo = path.join(base, "repo");
    fs.mkdirSync(path.join(repo, ".bee", "bin", "lib"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".bee", "bin", "lib", "state.mjs"),
      fakeStateSource("0.1.19"), "utf8"); // host_helpers newer than source
    seedRepoSkillTargets(repo, "0.1.17"); // numeric per-target installs keep the refusal forceable
    makeInstalledSkills(home, { version: "0.1.17" }); // installed OLDER: never triggers
    const homeBefore = hashTree(home);
    const repoBefore = hashTree(repo);
    const plan = await runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
    check(plan.status === 0 && plan.payload?.status === "blocked_downgrade",
      "source<helpers only: plan mode reports blocked_downgrade (F3)",
      `exit ${plan.status} status ${plan.payload?.status}`);
    const apply = await runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
      "source<helpers only: apply refuses driven solely by host_helpers (independent branch)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    const v = apply.payload?.versions || {};
    check(v.source === "0.1.18" && v.host_helpers === "0.1.19" && v.installed_skills === "0.1.17",
      "source<helpers only: an OLDER installed_skills never masks the host_helpers refusal",
      JSON.stringify(v));
    check(hashTree(home) === homeBefore && hashTree(repo) === repoBefore,
      "source<helpers only: refusal mutates nothing anywhere");
    const forced = await runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--global-skills", "--force-downgrade", "--json"], home);
    check(forced.status === 0 && forced.payload?.status === "applied" &&
      forced.payload?.forced_downgrade === true,
      "source<helpers only: --force-downgrade proceeds once all three versions resolved numeric",
      `exit ${forced.status} status ${forced.payload?.status}`);
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10k. host_helpers existing-but-unreadable -> unknown -> refuse, never forceable ---
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-hostunknown-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), { version: "0.1.19" });
    const repo = path.join(base, "repo");
    fs.mkdirSync(path.join(repo, ".bee", "bin", "lib"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".bee", "bin", "lib", "state.mjs"),
      "// corrupt: no version constant here\n", "utf8");
    const homeBefore = hashTree(home);
    const repoBefore = hashTree(repo);
    const apply = await runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
      "existing-but-unreadable vendored state.mjs refuses (host_helpers unknown, D3)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(apply.payload?.versions?.host_helpers === "unknown",
      "unreadable host_helpers version reported as unknown",
      JSON.stringify(apply.payload?.versions || {}));
    const forced = await runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--force-downgrade", "--json"], home);
    check(forced.status === 1 && forced.payload?.status === "blocked_downgrade",
      "host_helpers unknown is NEVER forceable: --force-downgrade still refuses",
      `exit ${forced.status} status ${forced.payload?.status}`);
    check(forced.payload?.forced_downgrade === undefined,
      "refused force reports no forced_downgrade");
    check(hashTree(home) === homeBefore && hashTree(repo) === repoBefore,
      "unforceable host_helpers-unknown refusal keeps repo and target byte-identical");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {

hook: PreToolUse
hook: PreToolUse Completed
exec
/bin/bash -lc "rg -n \"hostLibDowngradeBlock|aggregateSkillBlocked|skillSync\\.blocked\" skills/bee-hive/scripts/onboard_bee.mjs | head -50 && sed -n '2260,2348p' skills/bee-hive/scripts/onboard_bee.mjs" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 138ms:
903:function aggregateSkillBlocked(targets) {
933:function hostLibDowngradeBlock(sourceVersion, hostVersion) {
1129:  result.blocked = aggregateSkillBlocked(result.targets);
1138:    const libBlocked = hostLibDowngradeBlock(sourceVersion, hostVersion);
2251:  if (!skillSync.blocked) {
2368:  if (skillSync.blocked) {
2369:    if (forceDowngrade && skillSync.blocked.forceable) {
2390:          status: skillSync.blocked.status,
2391:          reason: skillSync.blocked.reason,
2392:          forceable: skillSync.blocked.forceable,
2394:        versions: skillSync.blocked.versions,
2654:    forcedVersions: skillSync.blocked ? skillSync.blocked.versions : null,
2800:        status: skillSync.blocked
2801:          ? skillSync.blocked.status
2827:      if (skillSync.blocked) {
2831:        payload.reason = skillSync.blocked.reason;
2832:        payload.versions = skillSync.blocked.versions;
2867:    const recheckBlocked = recheck.skillSync.blocked;
  }

  return { plan, beeVersion, renderedBlock, renderedGitignoreBlock, desiredManaged, skillSync };
}

// Legacy-global version-parity refresh items are a best-effort side pass over
// ~/.claude/skills (installer-version-parity-1-3-1): they are listed in the plan
// for transparency and applied on --apply, but they NEVER drive the
// up_to_date/changes_needed status. A fully-onboarded repo must not read
// "changes_needed" forever merely because the user's legacy global install is
// stale, and requirement (5): a refreshed global never flips drift or breaks
// recheck. Status counts only the repo/target work; refresh_legacy_global_skill
// is excluded here (and only here - apply still applies these items).
function coreChangesNeeded(plan) {
  return plan.some((item) => item.action !== "refresh_legacy_global_skill");
}

function buildManagedVersions(renderedBlock, renderedGitignoreBlock, repoHooks, statusline = false) {
  const helpers = {};
  for (const name of listTemplateHelpers()) {
    helpers[name] = hashFile(path.join(TEMPLATES_DIR, name));
  }
  const lib = {};
  for (const name of listTemplateLibModules()) {
    lib[name] = hashFile(path.join(TEMPLATES_LIB_DIR, name));
  }
  const managed = {
    agents_block: sha256(renderedBlock),
    gitignore_block: sha256(renderedGitignoreBlock),
    helpers,
    lib,
  };
  if (repoHooks) {
    const hooks = {};
    for (const name of listPluginHooks()) {
      hooks[name] = sha256(fs.readFileSync(path.join(PLUGIN_HOOKS_DIR, name), "utf8"));
    }
    // Pseudo-entry: the desired Codex projection rides the same managed map,
    // so a render change here surfaces as onboarding drift like any hook edit.
    hooks[".codex/hooks.json"] = sha256(JSON.stringify(renderCodexHookEntries()));
    managed.repo_hooks = hooks;
  }
  if (statusline) {
    const pair = {};
    for (const name of listTemplateStatusline()) {
      pair[name] = sha256(fs.readFileSync(path.join(TEMPLATES_STATUSLINE_DIR, name), "utf8"));
    }
    managed.statusline = pair;
  }
  return managed;
}

// Has this repo already opted into repo-local hook wiring? The opt-in is sticky:
// the record of a prior --repo-hooks install is what keeps later upgrades honest,
// so the owner never has to re-supply the flag to stay current.
function hasRepoHooksRecorded(repoRoot) {
  try {
    const raw = fs.readFileSync(path.join(repoRoot, ".bee", "onboarding.json"), "utf8");
    const recorded = JSON.parse(raw)?.managed?.repo_hooks;
    return !!recorded && typeof recorded === "object" && Object.keys(recorded).length > 0;
  } catch {
    return false; // no marker, unreadable, or malformed — treat as never opted in
  }
}

// Compare only the parts we manage in this run: without --repo-hooks, ignore
// any repo_hooks entry recorded by a previous --repo-hooks run; without the
// statusline opt-in, ignore any statusline entry the same way.
function subsetManaged(managed, repoHooks, statusline = false) {
  const src = managed && typeof managed === "object" ? managed : {};
  const out = {
    agents_block: src.agents_block || null,
    gitignore_block: src.gitignore_block || null,
    helpers: src.helpers || {},
    lib: src.lib || {},
  };
  if (repoHooks) {
    out.repo_hooks = src.repo_hooks || {};
  }
  if (statusline) {
    out.statusline = src.statusline || {};
  }
  return out;
}

// ---------- apply ----------

function applyPlan(
  repoRoot,

hook: PreToolUse
hook: PreToolUse Completed
exec
/bin/bash -lc "sed -n '1085,1160p' skills/bee-hive/scripts/onboard_bee.mjs && sed -n '2225,2265p' skills/bee-hive/scripts/onboard_bee.mjs" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 135ms:
  // target-independent: a failure blocks every target before resolution.
  let identityOk = false;
  try {
    identityOk =
      fs.realpathSync(HIVE_DIR) === fs.realpathSync(path.join(sourceRoot, "bee-hive"));
  } catch {
    identityOk = false;
  }
  if (!identityOk) {
    return blockAll(
      "no authoritative skill source: the running script's tree failed the bee-hive realpath identity check",
    );
  }

  const realSource = fs.realpathSync(sourceRoot);
  let realRepo;
  try {
    realRepo = fs.realpathSync(repoRoot);
  } catch {
    realRepo = path.resolve(repoRoot);
  }

  // Shared version resolutions (D3): source and host helpers are per-run, the
  // installed tree is per target (resolved inside computeSkillSyncTarget).
  const sourceVersion = readVersionStrict(
    path.join(HIVE_DIR, "templates", "lib", "state.mjs"),
    true, // the running script's tree exists by definition
  );
  const hostStateFile = path.join(repoRoot, ".bee", "bin", "lib", "state.mjs");
  const hostVersion = readVersionStrict(hostStateFile, fs.existsSync(hostStateFile));

  for (const { kind, target_root } of targetSpecs) {
    result.targets.push(
      computeSkillSyncTarget({
        realRepo,
        sourceRoot,
        realSource,
        sourceVersion,
        hostVersion,
        kind,
        targetRoot: target_root,
      }),
    );
  }
  result.blocked = aggregateSkillBlocked(result.targets);
  // Fill the self-onboard gap (VER-02..06): when every target self_skipped,
  // aggregation finds no block, yet copy_lib/copy_helper (computePlan step 3)
  // would still downgrade .bee/bin. A target-independent runtime-lib downgrade
  // blocks the WHOLE apply here so the existing applyPlan abort refuses with
  // zero mutation. Blocked-first: only ever FILLS a genuine gap, never
  // overrides a block already found by the per-target host_helpers check - so
  // ordinary hosts are unchanged and no forceable-combination ambiguity arises.
  if (!result.blocked) {
    const libBlocked = hostLibDowngradeBlock(sourceVersion, hostVersion);
    if (libBlocked) result.blocked = libBlocked;
  }
  // Legacy-global version-parity refresh (installer-version-parity-1-3-1): only
  // WITHOUT --global-skills (with the flag the global root is already a fully
  // managed target). Strictly additive and never part of blocked-first
  // aggregation - see computeLegacyGlobalRefresh.
  result.legacyRefresh = globalSkills
    ? null
    : computeLegacyGlobalRefresh({ sourceRoot, realSource, realRepo, sourceVersion });
  return result;
}

// Unpredictable temp names inside the managed namespace (F6): a predictable
// <file>.tmp under ~/.claude/skills would be a symlink-swap target.
function writeFileAtomicRandom(filePath, buffer) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, filePath);
}

// Mirror one bee-* skill dir into the target (D4/D5). Re-verifies the symlink
  // and not gated by any opt-in - every repo with a configured tier gets its
  // agent files, exactly like the AGENTS.md block above.
  plan.push(...computeAgentFilePlan(repoRoot));

  // 6. onboarding.json drift (managed versions)
  const statusline = statuslineOptIn(repoRoot);
  const desiredManaged = buildManagedVersions(renderedBlock, renderedGitignoreBlock, repoHooks, statusline);
  const onboarding = readJsonIfExists(path.join(repoRoot, ".bee", "onboarding.json"));
  const onboardingCurrent =
    onboarding &&
    onboarding.schema_version === ONBOARDING_SCHEMA_VERSION &&
    onboarding.bee_version === beeVersion &&
    JSON.stringify(subsetManaged(onboarding.managed, repoHooks, statusline)) ===
      JSON.stringify(subsetManaged(desiredManaged, repoHooks, statusline));
  if (!onboardingCurrent) {
    plan.push({ action: "write_onboarding", path: ".bee/onboarding.json" });
  }

  // 7. skill sync (D1-D5, per target): drift between the running tree and
  // each target root's bee-* set appears as plan items, every item tagged
  // with its target kind. Read-only. A blocked stage (any target) withholds
  // ALL skill items from the flat plan; per-target items stay visible in
  // skills.targets for forced-apply transparency (D2).
  const skillSync = syncSkills
    ? computeSkillSync(repoRoot, { globalSkills })
    : { blocked: null, source_root: HIVE_DIR, targets: [] };
  if (!skillSync.blocked) {
    for (const target of skillSync.targets) {
      plan.push(...target.items);
    }
    // Legacy-global version-parity refresh items (installer-version-parity):
    // additive, never blocked; only present without --global-skills.
    if (skillSync.legacyRefresh) {
      plan.push(...skillSync.legacyRefresh.items);
    }
  }

  return { plan, beeVersion, renderedBlock, renderedGitignoreBlock, desiredManaged, skillSync };
}

// Legacy-global version-parity refresh items are a best-effort side pass over

collab: Wait
codex
PROCEED-WITH-CHANGES

1. Add `host_items` only when the aggregate refusal is `forceable: true`. Derive it directly from the existing `plan`:

   ```js
   plan.filter(({ action }) =>
     action === "copy_lib" || action === "copy_helper"
   )
   ```

   Preserve order. For a forceable skill-only downgrade with no runtime drift, return `host_items: []`; omit the field for unknown-version, mixed-unforceable, and `blocked_no_source` refusals.

2. Strengthen the three-step assertion. Existing test 10v’s “exact set” check is actually permissive: it discards action/path/target and allows the applied set to be a subset of the preview ([test_onboard_bee.mjs](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:3311)). Compare exact normalized `{action, path}` arrays across:

   - dry-run `plan`
   - refused-apply `host_items`
   - forced-apply `applied`

3. Reusing 10v unchanged covers `copy_lib`, but not `copy_helper`: its fake source populates `templates/lib` without top-level template helpers. Seed helpers through filesystem discovery—not a maintained filename list—and assert the fixture contains both action classes. Otherwise half of P49’s acceptance criterion remains untested.

4. Add at least one negative assertion to an existing unknown-version test: `host_items` must be absent and forcing must still refuse. An additional forceable-empty case asserting `host_items: []` would fully pin the field contract.

5. Top-level sibling placement beside `skills` is correct. The public refusal payload has top-level `status/reason/versions`; its internal `blocked` object is not emitted. Pending effects belong beside `skills`, not inside the refusal cause. Ensure the field is threaded through both `applyPlan()` and `main()`; the CLI-level test will catch either omission.

6. Compatibility risk is low. First-party consumers inspect individual fields rather than enforcing a closed object shape, so this is a conventional additive JSON change. External strict-schema consumers are the only residual possibility.

7. Do not add `scope` or `target`. `copy_lib` and `copy_helper` paths are always repository-root-relative, while those fields exist on skill items precisely because their paths resolve against varying target roots. Omitting them preserves the established contract.

8. Non-blocking adjacent issue: forced apply can also restore legacy-global refresh items that the refused response does not currently enumerate. Don’t fold those into `host_items` because they are not repository-relative; track them separately as another forced-apply-transparency gap.
hook: Stop
hook: Stop
hook: Stop Completed
hook: Stop Completed
tokens used
83,030
PROCEED-WITH-CHANGES

1. Add `host_items` only when the aggregate refusal is `forceable: true`. Derive it directly from the existing `plan`:

   ```js
   plan.filter(({ action }) =>
     action === "copy_lib" || action === "copy_helper"
   )
   ```

   Preserve order. For a forceable skill-only downgrade with no runtime drift, return `host_items: []`; omit the field for unknown-version, mixed-unforceable, and `blocked_no_source` refusals.

2. Strengthen the three-step assertion. Existing test 10v’s “exact set” check is actually permissive: it discards action/path/target and allows the applied set to be a subset of the preview ([test_onboard_bee.mjs](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:3311)). Compare exact normalized `{action, path}` arrays across:

   - dry-run `plan`
   - refused-apply `host_items`
   - forced-apply `applied`

3. Reusing 10v unchanged covers `copy_lib`, but not `copy_helper`: its fake source populates `templates/lib` without top-level template helpers. Seed helpers through filesystem discovery—not a maintained filename list—and assert the fixture contains both action classes. Otherwise half of P49’s acceptance criterion remains untested.

4. Add at least one negative assertion to an existing unknown-version test: `host_items` must be absent and forcing must still refuse. An additional forceable-empty case asserting `host_items: []` would fully pin the field contract.

5. Top-level sibling placement beside `skills` is correct. The public refusal payload has top-level `status/reason/versions`; its internal `blocked` object is not emitted. Pending effects belong beside `skills`, not inside the refusal cause. Ensure the field is threaded through both `applyPlan()` and `main()`; the CLI-level test will catch either omission.

6. Compatibility risk is low. First-party consumers inspect individual fields rather than enforcing a closed object shape, so this is a conventional additive JSON change. External strict-schema consumers are the only residual possibility.

7. Do not add `scope` or `target`. `copy_lib` and `copy_helper` paths are always repository-root-relative, while those fields exist on skill items precisely because their paths resolve against varying target roots. Omitting them preserves the established contract.

8. Non-blocking adjacent issue: forced apply can also restore legacy-global refresh items that the refused response does not currently enumerate. Don’t fold those into `host_items` because they are not repository-relative; track them separately as another forced-apply-transparency gap.
