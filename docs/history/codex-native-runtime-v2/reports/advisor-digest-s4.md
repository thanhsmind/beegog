OpenAI Codex v0.144.4
--------
workdir: /home/thanhsmind/projects/goglbe/beegog
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 019f748b-e1bc-7de0-a184-73b8d5e47a16
--------
user
# Advisor consult — codex-native-runtime-v2 slice 4 (final), pre-Gate-3

Read-only advisor. Terse numbered findings + verdict (PROCEED / PROCEED-WITH-CHANGES / RETURN-TO-PLANNING). No bee state mutations.

Context: slices 1-3 shipped (docs truth, atomic-write hardening, update_plan matcher superset, capability matrix on codex 0.144.4, profiles docs, manifest regen+pin, codex spawn_agent guard, D9 runtime-block renderer + provenance + committed per-runtime plugin trees + tagged skills). Release 1.5.1 landed externally; base green.

Slice 4 cells (read .bee/cells/cnr2-13.json, cnr2-14.json, cnr2-15.json for full text):
- cnr2-13: bee doctor --runtime codex|claude, fail-closed (never ready from file presence; codex trust rows structurally unknown with matrix citation; custom_agents unsupported; drift of .codex/hooks.json vs catalog render -> not_ready). Read-only command, fixture-driven tests.
- cnr2-14 (deps 13): scripts/test_conformance.mjs — automatable subset of the be-codex.md 12 scenarios as fixture-driven checks (write-before-gate3 denied, verify-red never caps, reservation conflict refusal, doctor fail-closed, matcher coverage, codex spawn guard allow/deny/fail-open) + manual checklist doc with named metrics for the 8 interactive scenarios. Wired into commands.verify.
- cnr2-15: AGENTS.md 20KiB budget guard test + conservative dedupe at template source (every removed sentence recorded with its surviving skill location; no rule deleted; rendered through onboarding).

Questions: (1) any doctor row you consider load-bearing that is missing? (2) any conformance scenario in the automatable list that CANNOT be honestly fixture-tested and should move to the manual checklist? (3) risks in the AGENTS.md dedupe given it is the Codex bootstrap surface?

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
hook: SessionStart
hook: SessionStart
hook: SessionStart Completed
hook: SessionStart Completed
hook: UserPromptSubmit
hook: UserPromptSubmit Completed
codex
I’m using `bee-hive` to establish the current workflow context, then `bee-validating` as a read-only feasibility review. I’ll inspect the three cell definitions, relevant specs/templates/tests, and return only numbered findings plus a verdict—no state changes.
exec
/bin/bash -lc 'node .bee/bin/bee.mjs status --json' in /home/thanhsmind/projects/goglbe/beegog
 exited 1 in 144ms:
node:fs:2413
    return binding.writeFileUtf8(
                   ^

Error: EROFS: read-only file system, open '/home/thanhsmind/projects/goglbe/beegog/.bee/cache/manifest-hash.json.2-0-922b13f6.tmp'
    at Object.writeFileSync (node:fs:2413:20)
    at writeJsonAtomic (file:///home/thanhsmind/projects/goglbe/beegog/.bee/bin/lib/fsutil.mjs:90:6)
    at checkManifestDrift (file:///home/thanhsmind/projects/goglbe/beegog/.bee/bin/bee.mjs:2663:3)
    at main (file:///home/thanhsmind/projects/goglbe/beegog/.bee/bin/bee.mjs:2773:17)
    at file:///home/thanhsmind/projects/goglbe/beegog/.bee/bin/bee.mjs:2878:22
    at ModuleJob.run (node:internal/modules/esm/module_job:430:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:661:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  errno: -30,
  code: 'EROFS',
  syscall: 'open',
  path: '/home/thanhsmind/projects/goglbe/beegog/.bee/cache/manifest-hash.json.2-0-922b13f6.tmp'
}

Node.js v24.14.1

codex
The status command is not purely read-only in this checkout: it tried to refresh `.bee/cache/manifest-hash.json` and the read-only filesystem rejected it. I’m preserving the requested no-mutation boundary and continuing from the checked-in state/artifacts; this does not affect the advisory review.
exec
/bin/bash -lc "sed -n '1,260p' skills/bee-hive/SKILL.md && sed -n '261,520p' skills/bee-hive/SKILL.md && sed -n '1,280p' skills/bee-validating/SKILL.md && sed -n '281,560p' skills/bee-validating/SKILL.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
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
   - `status: "changes_needed"` → summarize the plan to the user, ask for approval, and only then re-run with `--apply`. Never apply silently. Never replace an existing compact prompt or AGENTS.md content outside the BEE markers without explicit consent. Every `--apply` also syncs the bee skill set into the host repo's two managed roots (`<repo>/.claude/skills/bee-*` for Claude Code, `<repo>/.agents/skills/bee-*` for Codex) in the same run — one command keeps vendored helpers and installed skills at the same version. The trees are committed to the host repo, never gitignored. `--global-skills` additionally syncs the legacy global `~/.claude/skills/bee-*` root; without the flag the global root is never read, written, or deleted. The payload's `skills.targets` carries one entry per target root: `{kind: "repo-claude" | "repo-agents" | "global", target_root, mode, blocked, versions, items}`. When the repo being onboarded contains the running script's own skill tree (bee's own repo), the per-project targets sync through the ordinary `applySyncSkill` path (mode `sync`/`fresh`/`noop`) like every other managed target; only the exact source-equals-target root is a `noop`. Each managed root is rendered per runtime (Claude vs Codex) and stamped with a render provenance marker, so a rendered projection is never accepted back as an onboarding source. Global sync there is unchanged.
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
---
name: bee-validating
description: >-
  Prove the plan against repo reality with concrete evidence before any code is written. Use when planning has an approved work shape that needs feasibility validation before swarming, or when a plan smells like plausibility instead of proof.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: unavailable
      reason: Validation reads state and cells through the vendored .bee/bin helpers.
---

# Validating — Guard Bees

Validating is the hard gate between planning and execution. It rejects beautiful fantasy plans by demanding repo/system evidence, feasibility proof, and cells a stranger could pick up cold. Never skip validating — it scales down, it does not disappear.

**Lane scaling.** For `tiny` and `small`, this skill is **not separately invoked**: the reality check runs inline inside bee-planning before the merged shape+execution gate (see bee-planning §5), and no validating subagents are spawned. This skill's full protocol below applies from `standard` upward — `standard` runs the plan-checker and cell reviewer; `high-risk` scales the checker to a persona panel. A `spike` runs whatever single proof its question demands, nothing more.

Start with `node .bee/bin/bee.mjs status --json`. If onboarding is missing or stale, stop and invoke bee-hive.

## Required Inputs

- `docs/history/<feature>/CONTEXT.md`
- `docs/history/<feature>/plan.md` — approved at Gate 2 and enriched to `artifact_readiness: implementation-ready`
- the discovery and approach content: `docs/history/<feature>/discovery.md` and `approach.md` **if they exist**; otherwise the `## Discovery` and `## Approach` sections folded into `plan.md` (decision 0009 — separate files are written only for L2+ discovery or high-risk lanes)
- current-work cells: `node .bee/bin/bee.mjs cells list --feature <feature>`

If `plan.md` is absent, unapproved, or its `artifact_readiness` is not `implementation-ready`, stop and return to bee-planning. Never validate an unapproved shape. A missing `discovery.md`/`approach.md` is **not** a failure when `plan.md` carries the equivalent sections — read those instead; stop only if neither the files nor the sections exist and the plan genuinely lacks discovery/approach content.

## Operating Contract

1. **Orient** on state, mode/lane, the approved shape, and the current-work cells. The orient read (CONTEXT.md, plan.md, discovery/approach, cells) delegates as an extraction-tier I/O worker per the Delegation contract (D2/D3, `bee-hive/references/routing-and-contracts.md`) when the D2 rubric fires; judgment (mode fit, reality-gate scoring) stays on the session model.
2. **Reality gate:** MODE FIT / REPO FIT / ASSUMPTIONS / SMALLER PATH / PROOF SURFACE — each scored PASS|FAIL with file/command evidence. Fail on nonexistent code paths, unsupported commands, stale versions, missing credentials, hidden architecture work, or excess ceremony. A failed reality gate halts the pipeline and returns to bee-planning.
3. **Feasibility matrix:** every blocking assumption gets a row — assumption | risk | proof required | evidence | result. Accepted evidence only (below). Plausibility language is an automatic NOT READY. For multi-cell slices, the matrix includes a schedule row: `bee cells schedule` reports zero cycles and the expected wave shape — required evidence, not optional.
4. **Spikes** for unproven assumptions that can invalidate the current work.
5. **Plan-checker subagent** (adversarial) until structurally clean or escalated.
6. **Cold-pickup cell review**; fix every CRITICAL flag.
7. **Decide** using the decision vocabulary, then ask Gate 3.

Load `references/validation-reference.md` for report formats, repair routing, and the subagent prompts.

## Accepted Evidence

Existing implementation, file/API/type inspection, command output, build/typecheck/test result, official version/doc proof, runtime probe, or a `.bee/spikes/<feature>/` result. Evidence that is only "should work", "likely", "expected", or model knowledge → **NOT READY**.

## Spike Rules

- One spike answers exactly one yes/no question.
- Disposable code lives under `.bee/spikes/<feature>/`.
- **NO** → return to bee-planning with the failed assumption and the required plan change.
- **YES** → record the discovered constraints for planning and execution.
- Spike code never silently becomes production code.

**Verify scripts and any executable code NEVER go in `docs/history/`** (GitHub #17). `docs/history/` is the tech-agnostic knowledge layer — `.md` only (CONTEXT.md, plan.md, reports, walkthrough). A cell's `verify` is a runnable command; when it needs a multi-line harness, that script lives in **the project's own scripts** (committed with the product, so `verify` points at it) or, if disposable, in **`.bee/spikes/<feature>/`**. The write-guard denies a code-extension file (`.sh`, `.mjs`, `.py`, …) written under `docs/history/`.

## Plan Checker (adversarial)

Dispatch a subagent on the **`review` slot** (decision 0021 — `resolveTier(root, 'review', runtime)`, default opus on Claude, generation fallback; state the model explicitly; if the runtime cannot select per-agent models, cap its reads and output instead).
<!-- bee:only claude -->
On Claude Code, spawn `subagent_type: "bee-review"` when `.claude/agents/bee-review.md` exists (W3, AO5/AO10) — bee's own rendered agent for the review tier, never `general-purpose` (`bee-model-guard` denies that pairing).
<!-- bee:end -->
<!-- bee:only codex -->
Codex has no per-agent subagent type (AO11), so the tier stays enforced as a read budget + output cap only.
<!-- bee:end -->
The plan-checker is a **read-only gather**, never a cell — when the review slot is cli-shaped, resolve it with the purpose-scoped 4-arg form, `resolveTier(root, 'review', runtime, {for:'gather'})`, per the Delegation contract's cli gather branch (`bee-hive/references/routing-and-contracts.md`); a bare 3-arg resolve of a cli-shaped review slot now refuses (AO12/B1, plan 2A-ii). A model-shaped review slot is unaffected by purpose — dispatch it exactly as before — **in the background where the runtime supports it** (decision 0017): continue the spike/matrix/cell-review work while it runs; its findings block nothing until the Gate 3 presentation, which never happens with the checker still outstanding. It assumes the plan is flawed and verifies 5 dimensions: requirement/decision coverage, cell completeness, dependency correctness, key links, scope sanity. Every finding carries **BLOCKER** or **WARNING**. Maximum 3 structural-verification iterations; a BLOCKER still open after iteration 3 escalates to the user. Never attempt iteration 4.

**High-risk lane:** scale to a persona panel — coherence + feasibility lenses always, plus conditional lenses (security, product, scope-guardian) chosen by the diff of concerns. Dedupe findings, then synthesize into auto-fix vs present-for-decision buckets.

## Cell Review (cold pickup)

Dispatch the cell reviewer (`review` slot, decision 0021).
<!-- bee:only claude -->
This is the same `bee-review` subagent_type as the plan-checker above.
<!-- bee:end -->
Could a worker with no session history pick each cell up cold? **CRITICAL** flags — assumed context, vague acceptance, scope overload, unproven feasibility, broken verify — must be fixed before approval. **MINOR** flags may ship with a recorded note.

## Decision Vocabulary

```text
READY
READY WITH CONSTRAINTS
NOT READY - RUN SPIKE
NOT READY - RETURN TO PLANNING
```

READY is a feasibility verdict, not execution approval — Gate 3 still requires the user.

## Gate 3 — Execution Approval

**Advisor consult (AO2b/AO3/AO4) — runs before this gate opens, at every bypass level.** For a high-risk or hard-gate slice, the orchestrator consults the configured advisor **before** presenting Gate 3 to the human, and before self-approving it under any bypass level (`normal`/`full`/`total` lift the *human* checkpoint below — they never lift this mechanical precondition). Resolve the advisor from config (`resolveAdvisor(root, runtime)`):
- **cli-shaped** advisor → run the configured command verbatim, read-only, with an evidence bundle on stdin (plan summary, risk map, validation findings, open questions — never session history, never secrets) and capture the digest.
- **model-shaped** advisor → dispatch a `bee-review`-class read-only run with the same evidence bundle.
- **unconfigured** advisor (`resolveAdvisor` returns `null`) → record that fact and proceed. AO2(b) adds one trigger; it is not a hard dependency on an advisor being configured.

Then record the consult: `node .bee/bin/bee.mjs state advisor-ref record --advisor "<identity>" --digest-file <path>` (the verb stamps the staleness anchors itself — the caller supplies only the advisor identity and the digest file).

**Enforcement is a throw, not a warning.** For high-risk work, `node .bee/bin/bee.mjs state gate --name execution --approved true` refuses — throws, never just warns — when the selected record's `advisor_ref` is missing or stale (AO3/AO13). Nothing is written until a non-stale `advisor_ref` exists; this is CLI-enforced, not optional ceremony. An `advisor_ref` is stale if **any** of (AO13, verbatim):
1. its feature differs from `state.feature`;
2. the newest active decision id changed since the consult;
3. `sha256(plan.md)` changed since the consult;
4. the ref predates the most recent revocation of the execution gate.

Never a time-based TTL — AO13 already burned this feature on one invented number once.

**Advice never approves a gate and never overrides a locked decision.** The consult's digest is data for the human decision, not a decision itself (critical rule 13, existing law); an advisor result that conflicts with a locked `CONTEXT.md` decision is surfaced to the human, never silently followed or used to auto-approve.

Write the full machine report (reality gate, matrix, plan-checker findings, cell review, approval block) to `docs/history/<feature>/reports/validation-<slice>.md`. For `small`/`standard`/`high-risk`, invoke `bee-briefing` in refresh mode to patch the implement plan's Validation Plan section with the accepted evidence links (and to flip its `status` if a source changed), so the Gate 3 message links a current brief. Then present **only the human layer** in chat per the Gate Presentation Contract (template in the reference): what I'm about to do / why it's trustworthy / if it goes wrong / what you are deciding — in the user's language, jargon-free, implement plan + report linked — then ask verbatim: **"Feasibility validated. Approve execution?"** Optionally offer a cross-model second opinion first (agreement → mention it; disagreement → quote both positions; never auto-resolve). Approval covers the **current work only**; future slices return to planning and validating.

On approval, update state: `node .bee/bin/bee.mjs state gate --name execution --approved true` then `node .bee/bin/bee.mjs state set --owner validating --phase swarming --summary "<summary>" --next-action "Invoke bee-swarming for the validated work."` (`validated` is not a phase — it never was; the approved execution gate is what records that. See chain-integrity D6.)

**Gate bypass (opt-in, decisions 0010/dcf01d7b) — LEVEL-AWARE.** Read the active level first (`node .bee/bin/bee.mjs status --json` → `gate_bypass_level`), then apply the routing contract's level table (`routing-and-contracts.md §Gate bypass`):
- `off` → present Gate 3 to the human as above.
- `normal` → if the lane is `tiny`/`small`/`standard` with no hard-gate flag, do not ask (self-approve, below); a `high-risk` lane or any hard-gate flag (auth, authorization, data loss, audit/security, external provider, validation removal, migration/schema) STILL stops for the human under `normal`.
- `full` / `total` → the human deliberately **lifted the high-risk/hard-gate floor** by choosing the level; do NOT re-erect it — auto-approve Gate 3 at **every** lane, high-risk and hard-gate included.

When the level covers this gate: do not ask — take the recommendation, set `approved_gates.execution: true` yourself (`bee.mjs state gate --name execution --approved true`), still write the machine-layer report, log a one-line audit decision, post a short `⚡ auto-approved Gate 3 (bypass)` line, and hand off to bee-swarming. (`total` only stops for secret-file reads; those are not a gate. Gate 4 UAT/P1 is separate and follows §Gate 4.)

## Headless

With `mode:headless`: run every check, apply unambiguous cell repairs, and defer ambiguous ones to an `Outstanding Questions` section of the structured terminal report. Headless **stops at the Gate 3 question** — it emits the approval block and the READY/NOT READY verdict and exits. It never self-approves execution.

## Red Flags

- skipping the reality gate or feasibility matrix
- spawning the plan-checker or cell reviewer for a tiny/small lane (their reality check lives inline in planning)
- accepting plausibility language as evidence
- continuing after a NO spike because a workaround "probably works"
- running a 4th plan-checker iteration instead of escalating
- approving (or letting approval cover) future slices
- CRITICAL cell flags left unfixed at approval time
- a tiny fix wearing epic ceremony; a hard-gate change routed below high-risk
- self-approving Gate 3, in any mode
- presenting or auto-approving Gate 3 for high-risk/hard-gate work without first running the advisor consult and recording a non-stale `advisor_ref` (AO2b/AO3/AO13)
- treating an advisor digest as a decision instead of data, or letting it silently override a locked `CONTEXT.md` decision

Violating the letter of the rules is violating the spirit of the rules.

Validation complete and Gate 3 approved. Invoke bee-swarming skill.

## Reference Files

| File | When to Load |
|---|---|
| `references/validation-reference.md` | Report formats, repair routing, plan-checker and cell-reviewer prompts, approval block |

exec
/bin/bash -lc "wc -l skills/bee-hive/SKILL.md skills/bee-hive/references/routing-and-contracts.md skills/bee-validating/SKILL.md skills/bee-validating/references/validation-reference.md && sed -n '180,420p' skills/bee-hive/SKILL.md && sed -n '1,240p' skills/bee-hive/references/routing-and-contracts.md && sed -n '241,520p' skills/bee-hive/references/routing-and-contracts.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
  197 skills/bee-hive/SKILL.md
  308 skills/bee-hive/references/routing-and-contracts.md
  147 skills/bee-validating/SKILL.md
  154 skills/bee-validating/references/validation-reference.md
  806 total

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

<!-- bee:only codex -->
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
<!-- bee:end -->

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

exec
/bin/bash -lc "sed -n '1,110p' skills/bee-hive/SKILL.md && sed -n '111,197p' skills/bee-hive/SKILL.md && sed -n '1,147p' skills/bee-validating/SKILL.md && sed -n '1,154p' skills/bee-validating/references/validation-reference.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 108ms:
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
   - `status: "changes_needed"` → summarize the plan to the user, ask for approval, and only then re-run with `--apply`. Never apply silently. Never replace an existing compact prompt or AGENTS.md content outside the BEE markers without explicit consent. Every `--apply` also syncs the bee skill set into the host repo's two managed roots (`<repo>/.claude/skills/bee-*` for Claude Code, `<repo>/.agents/skills/bee-*` for Codex) in the same run — one command keeps vendored helpers and installed skills at the same version. The trees are committed to the host repo, never gitignored. `--global-skills` additionally syncs the legacy global `~/.claude/skills/bee-*` root; without the flag the global root is never read, written, or deleted. The payload's `skills.targets` carries one entry per target root: `{kind: "repo-claude" | "repo-agents" | "global", target_root, mode, blocked, versions, items}`. When the repo being onboarded contains the running script's own skill tree (bee's own repo), the per-project targets sync through the ordinary `applySyncSkill` path (mode `sync`/`fresh`/`noop`) like every other managed target; only the exact source-equals-target root is a `noop`. Each managed root is rendered per runtime (Claude vs Codex) and stamped with a render provenance marker, so a rendered projection is never accepted back as an onboarding source. Global sync there is unchanged.
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
---
name: bee-validating
description: >-
  Prove the plan against repo reality with concrete evidence before any code is written. Use when planning has an approved work shape that needs feasibility validation before swarming, or when a plan smells like plausibility instead of proof.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: unavailable
      reason: Validation reads state and cells through the vendored .bee/bin helpers.
---

# Validating — Guard Bees

Validating is the hard gate between planning and execution. It rejects beautiful fantasy plans by demanding repo/system evidence, feasibility proof, and cells a stranger could pick up cold. Never skip validating — it scales down, it does not disappear.

**Lane scaling.** For `tiny` and `small`, this skill is **not separately invoked**: the reality check runs inline inside bee-planning before the merged shape+execution gate (see bee-planning §5), and no validating subagents are spawned. This skill's full protocol below applies from `standard` upward — `standard` runs the plan-checker and cell reviewer; `high-risk` scales the checker to a persona panel. A `spike` runs whatever single proof its question demands, nothing more.

Start with `node .bee/bin/bee.mjs status --json`. If onboarding is missing or stale, stop and invoke bee-hive.

## Required Inputs

- `docs/history/<feature>/CONTEXT.md`
- `docs/history/<feature>/plan.md` — approved at Gate 2 and enriched to `artifact_readiness: implementation-ready`
- the discovery and approach content: `docs/history/<feature>/discovery.md` and `approach.md` **if they exist**; otherwise the `## Discovery` and `## Approach` sections folded into `plan.md` (decision 0009 — separate files are written only for L2+ discovery or high-risk lanes)
- current-work cells: `node .bee/bin/bee.mjs cells list --feature <feature>`

If `plan.md` is absent, unapproved, or its `artifact_readiness` is not `implementation-ready`, stop and return to bee-planning. Never validate an unapproved shape. A missing `discovery.md`/`approach.md` is **not** a failure when `plan.md` carries the equivalent sections — read those instead; stop only if neither the files nor the sections exist and the plan genuinely lacks discovery/approach content.

## Operating Contract

1. **Orient** on state, mode/lane, the approved shape, and the current-work cells. The orient read (CONTEXT.md, plan.md, discovery/approach, cells) delegates as an extraction-tier I/O worker per the Delegation contract (D2/D3, `bee-hive/references/routing-and-contracts.md`) when the D2 rubric fires; judgment (mode fit, reality-gate scoring) stays on the session model.
2. **Reality gate:** MODE FIT / REPO FIT / ASSUMPTIONS / SMALLER PATH / PROOF SURFACE — each scored PASS|FAIL with file/command evidence. Fail on nonexistent code paths, unsupported commands, stale versions, missing credentials, hidden architecture work, or excess ceremony. A failed reality gate halts the pipeline and returns to bee-planning.
3. **Feasibility matrix:** every blocking assumption gets a row — assumption | risk | proof required | evidence | result. Accepted evidence only (below). Plausibility language is an automatic NOT READY. For multi-cell slices, the matrix includes a schedule row: `bee cells schedule` reports zero cycles and the expected wave shape — required evidence, not optional.
4. **Spikes** for unproven assumptions that can invalidate the current work.
5. **Plan-checker subagent** (adversarial) until structurally clean or escalated.
6. **Cold-pickup cell review**; fix every CRITICAL flag.
7. **Decide** using the decision vocabulary, then ask Gate 3.

Load `references/validation-reference.md` for report formats, repair routing, and the subagent prompts.

## Accepted Evidence

Existing implementation, file/API/type inspection, command output, build/typecheck/test result, official version/doc proof, runtime probe, or a `.bee/spikes/<feature>/` result. Evidence that is only "should work", "likely", "expected", or model knowledge → **NOT READY**.

## Spike Rules

- One spike answers exactly one yes/no question.
- Disposable code lives under `.bee/spikes/<feature>/`.
- **NO** → return to bee-planning with the failed assumption and the required plan change.
- **YES** → record the discovered constraints for planning and execution.
- Spike code never silently becomes production code.

**Verify scripts and any executable code NEVER go in `docs/history/`** (GitHub #17). `docs/history/` is the tech-agnostic knowledge layer — `.md` only (CONTEXT.md, plan.md, reports, walkthrough). A cell's `verify` is a runnable command; when it needs a multi-line harness, that script lives in **the project's own scripts** (committed with the product, so `verify` points at it) or, if disposable, in **`.bee/spikes/<feature>/`**. The write-guard denies a code-extension file (`.sh`, `.mjs`, `.py`, …) written under `docs/history/`.

## Plan Checker (adversarial)

Dispatch a subagent on the **`review` slot** (decision 0021 — `resolveTier(root, 'review', runtime)`, default opus on Claude, generation fallback; state the model explicitly; if the runtime cannot select per-agent models, cap its reads and output instead).
<!-- bee:only claude -->
On Claude Code, spawn `subagent_type: "bee-review"` when `.claude/agents/bee-review.md` exists (W3, AO5/AO10) — bee's own rendered agent for the review tier, never `general-purpose` (`bee-model-guard` denies that pairing).
<!-- bee:end -->
<!-- bee:only codex -->
Codex has no per-agent subagent type (AO11), so the tier stays enforced as a read budget + output cap only.
<!-- bee:end -->
The plan-checker is a **read-only gather**, never a cell — when the review slot is cli-shaped, resolve it with the purpose-scoped 4-arg form, `resolveTier(root, 'review', runtime, {for:'gather'})`, per the Delegation contract's cli gather branch (`bee-hive/references/routing-and-contracts.md`); a bare 3-arg resolve of a cli-shaped review slot now refuses (AO12/B1, plan 2A-ii). A model-shaped review slot is unaffected by purpose — dispatch it exactly as before — **in the background where the runtime supports it** (decision 0017): continue the spike/matrix/cell-review work while it runs; its findings block nothing until the Gate 3 presentation, which never happens with the checker still outstanding. It assumes the plan is flawed and verifies 5 dimensions: requirement/decision coverage, cell completeness, dependency correctness, key links, scope sanity. Every finding carries **BLOCKER** or **WARNING**. Maximum 3 structural-verification iterations; a BLOCKER still open after iteration 3 escalates to the user. Never attempt iteration 4.

**High-risk lane:** scale to a persona panel — coherence + feasibility lenses always, plus conditional lenses (security, product, scope-guardian) chosen by the diff of concerns. Dedupe findings, then synthesize into auto-fix vs present-for-decision buckets.

## Cell Review (cold pickup)

Dispatch the cell reviewer (`review` slot, decision 0021).
<!-- bee:only claude -->
This is the same `bee-review` subagent_type as the plan-checker above.
<!-- bee:end -->
Could a worker with no session history pick each cell up cold? **CRITICAL** flags — assumed context, vague acceptance, scope overload, unproven feasibility, broken verify — must be fixed before approval. **MINOR** flags may ship with a recorded note.

## Decision Vocabulary

```text
READY
READY WITH CONSTRAINTS
NOT READY - RUN SPIKE
NOT READY - RETURN TO PLANNING
```

READY is a feasibility verdict, not execution approval — Gate 3 still requires the user.

## Gate 3 — Execution Approval

**Advisor consult (AO2b/AO3/AO4) — runs before this gate opens, at every bypass level.** For a high-risk or hard-gate slice, the orchestrator consults the configured advisor **before** presenting Gate 3 to the human, and before self-approving it under any bypass level (`normal`/`full`/`total` lift the *human* checkpoint below — they never lift this mechanical precondition). Resolve the advisor from config (`resolveAdvisor(root, runtime)`):
- **cli-shaped** advisor → run the configured command verbatim, read-only, with an evidence bundle on stdin (plan summary, risk map, validation findings, open questions — never session history, never secrets) and capture the digest.
- **model-shaped** advisor → dispatch a `bee-review`-class read-only run with the same evidence bundle.
- **unconfigured** advisor (`resolveAdvisor` returns `null`) → record that fact and proceed. AO2(b) adds one trigger; it is not a hard dependency on an advisor being configured.

Then record the consult: `node .bee/bin/bee.mjs state advisor-ref record --advisor "<identity>" --digest-file <path>` (the verb stamps the staleness anchors itself — the caller supplies only the advisor identity and the digest file).

**Enforcement is a throw, not a warning.** For high-risk work, `node .bee/bin/bee.mjs state gate --name execution --approved true` refuses — throws, never just warns — when the selected record's `advisor_ref` is missing or stale (AO3/AO13). Nothing is written until a non-stale `advisor_ref` exists; this is CLI-enforced, not optional ceremony. An `advisor_ref` is stale if **any** of (AO13, verbatim):
1. its feature differs from `state.feature`;
2. the newest active decision id changed since the consult;
3. `sha256(plan.md)` changed since the consult;
4. the ref predates the most recent revocation of the execution gate.

Never a time-based TTL — AO13 already burned this feature on one invented number once.

**Advice never approves a gate and never overrides a locked decision.** The consult's digest is data for the human decision, not a decision itself (critical rule 13, existing law); an advisor result that conflicts with a locked `CONTEXT.md` decision is surfaced to the human, never silently followed or used to auto-approve.

Write the full machine report (reality gate, matrix, plan-checker findings, cell review, approval block) to `docs/history/<feature>/reports/validation-<slice>.md`. For `small`/`standard`/`high-risk`, invoke `bee-briefing` in refresh mode to patch the implement plan's Validation Plan section with the accepted evidence links (and to flip its `status` if a source changed), so the Gate 3 message links a current brief. Then present **only the human layer** in chat per the Gate Presentation Contract (template in the reference): what I'm about to do / why it's trustworthy / if it goes wrong / what you are deciding — in the user's language, jargon-free, implement plan + report linked — then ask verbatim: **"Feasibility validated. Approve execution?"** Optionally offer a cross-model second opinion first (agreement → mention it; disagreement → quote both positions; never auto-resolve). Approval covers the **current work only**; future slices return to planning and validating.

On approval, update state: `node .bee/bin/bee.mjs state gate --name execution --approved true` then `node .bee/bin/bee.mjs state set --owner validating --phase swarming --summary "<summary>" --next-action "Invoke bee-swarming for the validated work."` (`validated` is not a phase — it never was; the approved execution gate is what records that. See chain-integrity D6.)

**Gate bypass (opt-in, decisions 0010/dcf01d7b) — LEVEL-AWARE.** Read the active level first (`node .bee/bin/bee.mjs status --json` → `gate_bypass_level`), then apply the routing contract's level table (`routing-and-contracts.md §Gate bypass`):
- `off` → present Gate 3 to the human as above.
- `normal` → if the lane is `tiny`/`small`/`standard` with no hard-gate flag, do not ask (self-approve, below); a `high-risk` lane or any hard-gate flag (auth, authorization, data loss, audit/security, external provider, validation removal, migration/schema) STILL stops for the human under `normal`.
- `full` / `total` → the human deliberately **lifted the high-risk/hard-gate floor** by choosing the level; do NOT re-erect it — auto-approve Gate 3 at **every** lane, high-risk and hard-gate included.

When the level covers this gate: do not ask — take the recommendation, set `approved_gates.execution: true` yourself (`bee.mjs state gate --name execution --approved true`), still write the machine-layer report, log a one-line audit decision, post a short `⚡ auto-approved Gate 3 (bypass)` line, and hand off to bee-swarming. (`total` only stops for secret-file reads; those are not a gate. Gate 4 UAT/P1 is separate and follows §Gate 4.)

## Headless

With `mode:headless`: run every check, apply unambiguous cell repairs, and defer ambiguous ones to an `Outstanding Questions` section of the structured terminal report. Headless **stops at the Gate 3 question** — it emits the approval block and the READY/NOT READY verdict and exits. It never self-approves execution.

## Red Flags

- skipping the reality gate or feasibility matrix
- spawning the plan-checker or cell reviewer for a tiny/small lane (their reality check lives inline in planning)
- accepting plausibility language as evidence
- continuing after a NO spike because a workaround "probably works"
- running a 4th plan-checker iteration instead of escalating
- approving (or letting approval cover) future slices
- CRITICAL cell flags left unfixed at approval time
- a tiny fix wearing epic ceremony; a hard-gate change routed below high-risk
- self-approving Gate 3, in any mode
- presenting or auto-approving Gate 3 for high-risk/hard-gate work without first running the advisor consult and recording a non-stale `advisor_ref` (AO2b/AO3/AO13)
- treating an advisor digest as a decision instead of data, or letting it silently override a locked `CONTEXT.md` decision

Violating the letter of the rules is violating the spirit of the rules.

Validation complete and Gate 3 approved. Invoke bee-swarming skill.

## Reference Files

| File | When to Load |
|---|---|
| `references/validation-reference.md` | Report formats, repair routing, plan-checker and cell-reviewer prompts, approval block |
# Validation Reference

Load after bee-validating is selected and the required inputs exist. Formats here are normative — reports must use them.

## Protocol

1. Orient: `node .bee/bin/bee.mjs status --json`, mode/lane, approved `plan.md`, current cells.
2. Reality gate report (below), evidence attached.
3. Feasibility matrix for every blocking assumption.
4. Spike/probe any unproven assumption that can invalidate the current work.
5. Plan-checker subagent, max 3 iterations.
6. Cell review (cold pickup); fix CRITICAL flags.
7. Decision, then the Gate 3 approval block.

## Reality Gate Report

```text
REALITY GATE REPORT
Mode: <tiny|spike|small|standard|high-risk>
Current work: <one sentence>
MODE FIT: PASS|FAIL       — lane matches the mechanical risk flags; least honest workflow
REPO FIT: PASS|FAIL       — named files/APIs/commands exist in this repo today
ASSUMPTIONS: PASS|FAIL    — every blocking assumption is listed in the matrix
SMALLER PATH: PASS|FAIL   — no smaller path delivers the locked decisions
PROOF SURFACE: PASS|FAIL  — every cell's verify command runs in this repo
Decision: proceed | revise planning | run spike first | collapse mode
Evidence: <file paths / command output / runtime evidence per line above>
```

Fail on: nonexistent code paths, unsupported commands, stale versions, missing credentials, unreachable services, hidden architecture work, or excess ceremony.

## Feasibility Matrix

Required whenever blocking assumptions remain; always for the high-risk lane.

```text
FEASIBILITY MATRIX
Assumption | Risk | Proof Required | Evidence | Result
```

Accepted evidence: existing implementation, file/API/type inspection, command output, build/typecheck/test result, official version/doc proof, runtime/API probe, or `.bee/spikes/<feature>/` proof. "Should work", "likely", "expected", or model knowledge → the row (and the matrix) is **NOT READY**.

## Spike / Probe Rules

- One spike = one yes/no question.
- Disposable proof lives under `.bee/spikes/<feature>/`.
- NO → return to bee-planning with the failed assumption and the plan change it forces.
- YES → record constraints for planning and execution.
- Spike code must never silently become production implementation.

## Repair Routing

| Finding | Route |
|---|---|
| False assumption / wrong mode or lane | back to bee-planning |
| Locked decision uncovered by any cell | `plan.md` + new/edited cells (cite the D-ID) |
| Cell dependency, file-scope, or test gap | edit the cell (`node .bee/bin/bee.mjs cells show --id <id>` first) |
| Broken or unrunnable verify command | fix the cell's `verify`; re-run PROOF SURFACE |
| Unreachable exit / integration hole | `plan.md` (key links) then cells |
| Scope reduction of a locked decision | prohibited — SPLIT the work instead, via planning |

## Plan-Checker Subagent Prompt

Dispatch at the **generation** tier; name the model explicitly (fallback: read budget + output cap). Verify, do not redesign.

```text
You are an adversarial plan checker. Assume the plan is flawed until proven otherwise.
Inputs: docs/history/<feature>/CONTEXT.md, approach.md, plan.md, and the current-work cells
(node .bee/bin/bee.mjs cells list --feature <feature>).
Verify exactly 5 dimensions:
1. Requirement/decision coverage — every locked D-ID lands in at least one cell.
2. Cell completeness — each cell has files, read_first, directive action, must_haves
   (per lane tier), and a runnable verify.
3. Dependency correctness — deps form a DAG; no cell depends on a future slice.
4. Key links — integration points named in plan.md are owned by a specific cell.
5. Scope sanity — no cell is doing hidden architecture work or exceeds its lane.
Report every finding as BLOCKER (structurally unsound) or WARNING (survivable, note it).
Do not propose redesigns. Do not soften findings. Quote file/cell evidence per finding.
```

Max 3 structural iterations (check → repair → re-check). An open BLOCKER after iteration 3 escalates to the user with both positions. Never run iteration 4.

### High-Risk Persona Panel

For the high-risk lane, replace the single checker with a small panel: **coherence** and **feasibility** personas always; add conditional lenses — **security**, **product**, **scope-guardian** — chosen by the diff of concerns (auth/data → security; user-visible behavior → product; growing surface → scope-guardian). Each persona gets the same inputs and the BLOCKER/WARNING vocabulary. Dedupe overlapping findings, then synthesize into two buckets: **auto-fix** (apply, record) and **present-for-decision** (user judgment required).

## Cell-Reviewer Subagent Prompt

Dispatch at the **generation** tier. Stress-test whether each cell can be picked up cold.

```text
You are a fresh-eyes cell reviewer with NO session history. For each current-work cell
(node .bee/bin/bee.mjs cells show --id <id>), answer: could a worker who has read only
CONTEXT.md, plan.md, and this cell implement and verify it without guessing?
Flag CRITICAL: assumed context, vague acceptance, scope overload, unproven feasibility,
broken verify command.
Flag MINOR: missing rationale, implicit file assumption, fuzzy boundary, known tradeoff
not recorded.
```

```text
CELL REVIEW REPORT
Work: <current slice / direct task>
Cells reviewed: <N>
CRITICAL FLAGS: <cell-id> problem / evidence / fix
MINOR FLAGS: <cell-id> problem / evidence / suggestion
CLEAN CELLS: <cell-id>, <cell-id>
REVISIONS MADE: <cell-id> change / why
SUMMARY: <2-3 sentences>
```

All CRITICAL flags must be fixed before Gate 3. MINOR flags ship with a recorded note.

## Approval Gate Block

Two layers (Gate Presentation Contract, bee-hive routing reference). The machine block goes into the **report file** `docs/history/<feature>/reports/validation-<slice>.md`, together with the reality gate report, feasibility matrix, plan-checker findings, and cell review above. It is never pasted into chat:

```text
VALIDATION COMPLETE - APPROVAL REQUIRED BEFORE EXECUTION
Mode: <mode>
Work: <current slice / direct task / spike>
Reality gate: PASS
Feasibility: READY | READY WITH CONSTRAINTS
Structure: PASS after <N> iterations
Spikes: <none | passed | constraints recorded>
Cell review: PASS (<N> cells, 0 CRITICAL open)
Unresolved concerns: <none | list>
```

The **chat message** is the human layer only — in the user's language, jargon-free:

```text
What I'm about to do: [the change in the user's terms, one sentence — what changes for them, not the mechanism].
Why it's trustworthy: [the single strongest piece of evidence, plain words — e.g. "a dry run rebuilt all 3 pages byte-for-byte identical"].
If it goes wrong: [what breaks for the user + how we'd notice — loud failure, rollback path].
You are deciding: whether I may start editing real files — this slice of work only.
Full validation report: docs/history/<feature>/reports/validation-<slice>.md
Feasibility validated. Approve execution?
```

Litmus: the user can restate what they are approving in their own words.

Approval is for the current work only. On yes: update `.bee/state.json` (`approved_gates.execution: true`) and hand off to bee-swarming. In headless mode, stop here — emit both layers in the terminal report and exit without approval.

## Red Flags

- skipping reality or feasibility gates because everything "looks right"
- plausibility accepted as proof under time pressure
- continuing after a NO spike
- iteration 4 of the plan checker
- cells not tied to the current work slice
- a small fix generating epic ceremony; a hard-gate change validated as small
- Gate 3 asked with CRITICAL cell flags still open
- the machine block pasted into chat, or a gate message the user cannot restate in their own words

exec
/bin/bash -lc "sed -n '100,179p' skills/bee-hive/SKILL.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
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

exec
/bin/bash -lc "sed -n '1,80p' skills/bee-validating/SKILL.md && sed -n '81,147p' skills/bee-validating/SKILL.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 106ms:
---
name: bee-validating
description: >-
  Prove the plan against repo reality with concrete evidence before any code is written. Use when planning has an approved work shape that needs feasibility validation before swarming, or when a plan smells like plausibility instead of proof.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: unavailable
      reason: Validation reads state and cells through the vendored .bee/bin helpers.
---

# Validating — Guard Bees

Validating is the hard gate between planning and execution. It rejects beautiful fantasy plans by demanding repo/system evidence, feasibility proof, and cells a stranger could pick up cold. Never skip validating — it scales down, it does not disappear.

**Lane scaling.** For `tiny` and `small`, this skill is **not separately invoked**: the reality check runs inline inside bee-planning before the merged shape+execution gate (see bee-planning §5), and no validating subagents are spawned. This skill's full protocol below applies from `standard` upward — `standard` runs the plan-checker and cell reviewer; `high-risk` scales the checker to a persona panel. A `spike` runs whatever single proof its question demands, nothing more.

Start with `node .bee/bin/bee.mjs status --json`. If onboarding is missing or stale, stop and invoke bee-hive.

## Required Inputs

- `docs/history/<feature>/CONTEXT.md`
- `docs/history/<feature>/plan.md` — approved at Gate 2 and enriched to `artifact_readiness: implementation-ready`
- the discovery and approach content: `docs/history/<feature>/discovery.md` and `approach.md` **if they exist**; otherwise the `## Discovery` and `## Approach` sections folded into `plan.md` (decision 0009 — separate files are written only for L2+ discovery or high-risk lanes)
- current-work cells: `node .bee/bin/bee.mjs cells list --feature <feature>`

If `plan.md` is absent, unapproved, or its `artifact_readiness` is not `implementation-ready`, stop and return to bee-planning. Never validate an unapproved shape. A missing `discovery.md`/`approach.md` is **not** a failure when `plan.md` carries the equivalent sections — read those instead; stop only if neither the files nor the sections exist and the plan genuinely lacks discovery/approach content.

## Operating Contract

1. **Orient** on state, mode/lane, the approved shape, and the current-work cells. The orient read (CONTEXT.md, plan.md, discovery/approach, cells) delegates as an extraction-tier I/O worker per the Delegation contract (D2/D3, `bee-hive/references/routing-and-contracts.md`) when the D2 rubric fires; judgment (mode fit, reality-gate scoring) stays on the session model.
2. **Reality gate:** MODE FIT / REPO FIT / ASSUMPTIONS / SMALLER PATH / PROOF SURFACE — each scored PASS|FAIL with file/command evidence. Fail on nonexistent code paths, unsupported commands, stale versions, missing credentials, hidden architecture work, or excess ceremony. A failed reality gate halts the pipeline and returns to bee-planning.
3. **Feasibility matrix:** every blocking assumption gets a row — assumption | risk | proof required | evidence | result. Accepted evidence only (below). Plausibility language is an automatic NOT READY. For multi-cell slices, the matrix includes a schedule row: `bee cells schedule` reports zero cycles and the expected wave shape — required evidence, not optional.
4. **Spikes** for unproven assumptions that can invalidate the current work.
5. **Plan-checker subagent** (adversarial) until structurally clean or escalated.
6. **Cold-pickup cell review**; fix every CRITICAL flag.
7. **Decide** using the decision vocabulary, then ask Gate 3.

Load `references/validation-reference.md` for report formats, repair routing, and the subagent prompts.

## Accepted Evidence

Existing implementation, file/API/type inspection, command output, build/typecheck/test result, official version/doc proof, runtime probe, or a `.bee/spikes/<feature>/` result. Evidence that is only "should work", "likely", "expected", or model knowledge → **NOT READY**.

## Spike Rules

- One spike answers exactly one yes/no question.
- Disposable code lives under `.bee/spikes/<feature>/`.
- **NO** → return to bee-planning with the failed assumption and the required plan change.
- **YES** → record the discovered constraints for planning and execution.
- Spike code never silently becomes production code.

**Verify scripts and any executable code NEVER go in `docs/history/`** (GitHub #17). `docs/history/` is the tech-agnostic knowledge layer — `.md` only (CONTEXT.md, plan.md, reports, walkthrough). A cell's `verify` is a runnable command; when it needs a multi-line harness, that script lives in **the project's own scripts** (committed with the product, so `verify` points at it) or, if disposable, in **`.bee/spikes/<feature>/`**. The write-guard denies a code-extension file (`.sh`, `.mjs`, `.py`, …) written under `docs/history/`.

## Plan Checker (adversarial)

Dispatch a subagent on the **`review` slot** (decision 0021 — `resolveTier(root, 'review', runtime)`, default opus on Claude, generation fallback; state the model explicitly; if the runtime cannot select per-agent models, cap its reads and output instead).
<!-- bee:only claude -->
On Claude Code, spawn `subagent_type: "bee-review"` when `.claude/agents/bee-review.md` exists (W3, AO5/AO10) — bee's own rendered agent for the review tier, never `general-purpose` (`bee-model-guard` denies that pairing).
<!-- bee:end -->
<!-- bee:only codex -->
Codex has no per-agent subagent type (AO11), so the tier stays enforced as a read budget + output cap only.
<!-- bee:end -->
The plan-checker is a **read-only gather**, never a cell — when the review slot is cli-shaped, resolve it with the purpose-scoped 4-arg form, `resolveTier(root, 'review', runtime, {for:'gather'})`, per the Delegation contract's cli gather branch (`bee-hive/references/routing-and-contracts.md`); a bare 3-arg resolve of a cli-shaped review slot now refuses (AO12/B1, plan 2A-ii). A model-shaped review slot is unaffected by purpose — dispatch it exactly as before — **in the background where the runtime supports it** (decision 0017): continue the spike/matrix/cell-review work while it runs; its findings block nothing until the Gate 3 presentation, which never happens with the checker still outstanding. It assumes the plan is flawed and verifies 5 dimensions: requirement/decision coverage, cell completeness, dependency correctness, key links, scope sanity. Every finding carries **BLOCKER** or **WARNING**. Maximum 3 structural-verification iterations; a BLOCKER still open after iteration 3 escalates to the user. Never attempt iteration 4.

**High-risk lane:** scale to a persona panel — coherence + feasibility lenses always, plus conditional lenses (security, product, scope-guardian) chosen by the diff of concerns. Dedupe findings, then synthesize into auto-fix vs present-for-decision buckets.

## Cell Review (cold pickup)

Dispatch the cell reviewer (`review` slot, decision 0021).
<!-- bee:only claude -->
This is the same `bee-review` subagent_type as the plan-checker above.
<!-- bee:end -->
Could a worker with no session history pick each cell up cold? **CRITICAL** flags — assumed context, vague acceptance, scope overload, unproven feasibility, broken verify — must be fixed before approval. **MINOR** flags may ship with a recorded note.

## Decision Vocabulary

```text
READY
READY WITH CONSTRAINTS
NOT READY - RUN SPIKE
NOT READY - RETURN TO PLANNING
```

READY is a feasibility verdict, not execution approval — Gate 3 still requires the user.

## Gate 3 — Execution Approval

**Advisor consult (AO2b/AO3/AO4) — runs before this gate opens, at every bypass level.** For a high-risk or hard-gate slice, the orchestrator consults the configured advisor **before** presenting Gate 3 to the human, and before self-approving it under any bypass level (`normal`/`full`/`total` lift the *human* checkpoint below — they never lift this mechanical precondition). Resolve the advisor from config (`resolveAdvisor(root, runtime)`):
- **cli-shaped** advisor → run the configured command verbatim, read-only, with an evidence bundle on stdin (plan summary, risk map, validation findings, open questions — never session history, never secrets) and capture the digest.
- **model-shaped** advisor → dispatch a `bee-review`-class read-only run with the same evidence bundle.
- **unconfigured** advisor (`resolveAdvisor` returns `null`) → record that fact and proceed. AO2(b) adds one trigger; it is not a hard dependency on an advisor being configured.

Then record the consult: `node .bee/bin/bee.mjs state advisor-ref record --advisor "<identity>" --digest-file <path>` (the verb stamps the staleness anchors itself — the caller supplies only the advisor identity and the digest file).

**Enforcement is a throw, not a warning.** For high-risk work, `node .bee/bin/bee.mjs state gate --name execution --approved true` refuses — throws, never just warns — when the selected record's `advisor_ref` is missing or stale (AO3/AO13). Nothing is written until a non-stale `advisor_ref` exists; this is CLI-enforced, not optional ceremony. An `advisor_ref` is stale if **any** of (AO13, verbatim):
1. its feature differs from `state.feature`;
2. the newest active decision id changed since the consult;
3. `sha256(plan.md)` changed since the consult;
4. the ref predates the most recent revocation of the execution gate.

Never a time-based TTL — AO13 already burned this feature on one invented number once.

**Advice never approves a gate and never overrides a locked decision.** The consult's digest is data for the human decision, not a decision itself (critical rule 13, existing law); an advisor result that conflicts with a locked `CONTEXT.md` decision is surfaced to the human, never silently followed or used to auto-approve.

Write the full machine report (reality gate, matrix, plan-checker findings, cell review, approval block) to `docs/history/<feature>/reports/validation-<slice>.md`. For `small`/`standard`/`high-risk`, invoke `bee-briefing` in refresh mode to patch the implement plan's Validation Plan section with the accepted evidence links (and to flip its `status` if a source changed), so the Gate 3 message links a current brief. Then present **only the human layer** in chat per the Gate Presentation Contract (template in the reference): what I'm about to do / why it's trustworthy / if it goes wrong / what you are deciding — in the user's language, jargon-free, implement plan + report linked — then ask verbatim: **"Feasibility validated. Approve execution?"** Optionally offer a cross-model second opinion first (agreement → mention it; disagreement → quote both positions; never auto-resolve). Approval covers the **current work only**; future slices return to planning and validating.

On approval, update state: `node .bee/bin/bee.mjs state gate --name execution --approved true` then `node .bee/bin/bee.mjs state set --owner validating --phase swarming --summary "<summary>" --next-action "Invoke bee-swarming for the validated work."` (`validated` is not a phase — it never was; the approved execution gate is what records that. See chain-integrity D6.)

**Gate bypass (opt-in, decisions 0010/dcf01d7b) — LEVEL-AWARE.** Read the active level first (`node .bee/bin/bee.mjs status --json` → `gate_bypass_level`), then apply the routing contract's level table (`routing-and-contracts.md §Gate bypass`):
- `off` → present Gate 3 to the human as above.
- `normal` → if the lane is `tiny`/`small`/`standard` with no hard-gate flag, do not ask (self-approve, below); a `high-risk` lane or any hard-gate flag (auth, authorization, data loss, audit/security, external provider, validation removal, migration/schema) STILL stops for the human under `normal`.
- `full` / `total` → the human deliberately **lifted the high-risk/hard-gate floor** by choosing the level; do NOT re-erect it — auto-approve Gate 3 at **every** lane, high-risk and hard-gate included.

When the level covers this gate: do not ask — take the recommendation, set `approved_gates.execution: true` yourself (`bee.mjs state gate --name execution --approved true`), still write the machine-layer report, log a one-line audit decision, post a short `⚡ auto-approved Gate 3 (bypass)` line, and hand off to bee-swarming. (`total` only stops for secret-file reads; those are not a gate. Gate 4 UAT/P1 is separate and follows §Gate 4.)

## Headless

With `mode:headless`: run every check, apply unambiguous cell repairs, and defer ambiguous ones to an `Outstanding Questions` section of the structured terminal report. Headless **stops at the Gate 3 question** — it emits the approval block and the READY/NOT READY verdict and exits. It never self-approves execution.

## Red Flags

- skipping the reality gate or feasibility matrix
- spawning the plan-checker or cell reviewer for a tiny/small lane (their reality check lives inline in planning)
- accepting plausibility language as evidence
- continuing after a NO spike because a workaround "probably works"
- running a 4th plan-checker iteration instead of escalating
- approving (or letting approval cover) future slices
- CRITICAL cell flags left unfixed at approval time
- a tiny fix wearing epic ceremony; a hard-gate change routed below high-risk
- self-approving Gate 3, in any mode
- presenting or auto-approving Gate 3 for high-risk/hard-gate work without first running the advisor consult and recording a non-stale `advisor_ref` (AO2b/AO3/AO13)
- treating an advisor digest as a decision instead of data, or letting it silently override a locked `CONTEXT.md` decision

Violating the letter of the rules is violating the spirit of the rules.

Validation complete and Gate 3 approved. Invoke bee-swarming skill.

## Reference Files

| File | When to Load |
|---|---|
| `references/validation-reference.md` | Report formats, repair routing, plan-checker and cell-reviewer prompts, approval block |

codex
The review crosses the repository’s multi-file evidence threshold, so I’m delegating three read-only evidence gathers: doctor coverage, conformance honesty, and bootstrap/dedupe risk. I’ll keep the verdict and tradeoff judgment here.
exec
/bin/bash -lc "node --version && test -f .bee/HANDOFF.json && sed -n '1,220p' .bee/HANDOFF.json || true
sed -n '1,240p' .bee/state.json
sed -n '1,220p' .bee/onboarding.json
sed -n '1,260p' docs/history/learnings/critical-patterns.md
rg -n \"doctor|conformance|AGENTS\\.md|20KiB|20 KiB|scenario|custom_agents|trust\" docs/history/codex-native-runtime-v2 docs/specs .bee/cells/cnr2-1[345].json --glob '"'!docs/history/codex-native-runtime-v2/reports/**'"'" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 108ms:
.bee/cells/cnr2-15.json:4:  "title": "AGENTS.md 20KiB budget guard + conservative dedupe at template source",
.bee/cells/cnr2-15.json:13:    "AGENTS.md",
.bee/cells/cnr2-15.json:20:    "AGENTS.md",
.bee/cells/cnr2-15.json:24:  "action": "Per D13 (dedupe-only, conservative): locate the template source that renders the AGENTS.md BEE block (AGENTS.block.md or equivalent — find it, do not guess) and dedupe ONLY passages whose content exists verbatim-or-stronger in a skill the reader is already routed to: for each removed sentence record WHERE it lives (skill file + line) in the cell report; replace multi-sentence duplicated passages with one pointer sentence. NO rule may be deleted or weakened — when in doubt, keep it. Regenerate AGENTS.md through the real render path (onboarding), never hand-edit the rendered file. Then scripts/test_agents_budget.mjs: asserts rendered AGENTS.md stays under 20480 bytes (hard fail above), warns at 18000, and asserts the BEE block markers are intact. Wire into commands.verify + mandatory-suite guard; regenerate release manifest for tracked files. Target: measurable shrink from the current ~17.9KB with zero semantic loss.",
.bee/cells/cnr2-15.json:29:      "AGENTS.md regenerated through the render path and under 20480 bytes, guard test green and wired"
.bee/cells/cnr2-15.json:38:      "template source edited; rendered AGENTS.md produced by onboarding render"
.bee/cells/cnr2-15.json:42:      "No hand-edit of rendered AGENTS.md",
.bee/cells/cnr2-14.json:14:    "scripts/test_conformance.mjs",
.bee/cells/cnr2-14.json:15:    "docs/history/codex-native-runtime-v2/conformance-checklist.md",
.bee/cells/cnr2-14.json:25:  "action": "Per D12: scripts/test_conformance.mjs — a black-box scenario harness over the 12 scenarios in docs/REFs/be-codex.md (P2 section), implementing the mechanically-checkable subset as isolated fixtures (never against the live repo state): (3) source write before Gate 3 -> write-guard denies (drive the hook binary with a fixture payload); (6) verify-red never caps -> cells cap refusal on a failed verify record (fixture store); (5) reservation conflict -> reserve refusal names holder; (12) doctor fail-closed -> drifted fixture -> not_ready (reuse cnr2-13 fixtures); matcher coverage -> update_plan present in every rendered state-sync matcher (catalog + host renderers); codex spawn guard -> bare spawn_agent fixture denied, anchored allowed, unobserved shape fail-open (reuse test_model_guard fixture helpers, do not duplicate). Each scenario prints scenario id + PASS/FAIL; suite exits nonzero on any FAIL. The interactive scenarios (1 tiny-no-ceremony, 2 standard-gates, 4 one-cell-per-worker, 7 package-install checkpoint, 8 timeout-no-duplicate-dispatch, 9 compaction handoff, 10 no-auto-review, 11 review fan-out) go to docs/history/codex-native-runtime-v2/conformance-checklist.md as a manual protocol: per scenario the setup, the observable pass condition, and the metric it feeds (route_accuracy, unauthorized_write_count, gate_correctness, delivery_tool_calls, time_to_first_edit, cell_completion_rate, verify_evidence_rate, duplicate_dispatch_count, unrequested_review_count, handoff_resume_success) — named, not faked; no fabricated results. Wire test_conformance.mjs into commands.verify and the mandatory-suite guard; regenerate the release manifest for tracked files.",
.bee/cells/cnr2-14.json:28:      "every automatable scenario runs against fixtures, prints its id, and the suite fails on any FAIL",
.bee/cells/cnr2-14.json:29:      "no scenario result is fabricated — manual scenarios live only in the checklist with named metrics",
.bee/cells/cnr2-14.json:34:        "path": "docs/history/codex-native-runtime-v2/conformance-checklist.md",
.bee/cells/cnr2-14.json:35:        "substantive": "manual protocol for the 8 interactive scenarios + metric definitions"
.bee/cells/cnr2-14.json:43:      "No fabricated scenario results",
.bee/cells/cnr2-14.json:47:  "verify": "bash -c 'env -u BEE_AGENT_NAME node scripts/test_conformance.mjs && env -u BEE_AGENT_NAME node scripts/test_verify_manifest.mjs && test -s docs/history/codex-native-runtime-v2/conformance-checklist.md && echo CONFORM-OK'",
.bee/cells/cnr2-13.json:4:  "title": "bee doctor --runtime codex|claude: fail-closed runtime health report",
.bee/cells/cnr2-13.json:22:  "action": "Per D11: add a doctor command group to bee.mjs (template source first — locate the canonical bee.mjs the vendored .bee/bin/bee.mjs mirrors; keep them in lockstep the sanctioned way). bee doctor --runtime codex --json reports, each row with value + evidence source + one of ok/warn/unknown/unsupported: codex_version (codex --version, absent binary = warn not crash); hooks_file_present (.codex/hooks.json exists AND byte-matches the catalog repo-target render — reuse the drift logic); hooks_discovered and hooks_trusted: UNKNOWN structurally with the reason string (codex doctor/plugin surfaces expose no trust rows on 0.144.4, per capability matrix F1) — never guessed; hooks_observed_this_session (rows in .bee/logs/tools.jsonl and hooks.jsonl newer than session start when determinable, else recent rows with timestamps quoted); permission_mode (.codex/config.toml approval_policy value or absent); duplicate_hook_sources (plugin projection tree AND repo .codex/hooks.json both present -> warn naming both); skills_discovered (.agents/skills/bee-* count + render provenance sidecar present); custom_agents: UNSUPPORTED per matrix A1/A2 (spawn_agent built-ins only) with the matrix citation. --runtime claude counterpart: settings/plugin hook wiring present (claude-hooks.json resolvable via .claude-plugin or repo .claude/settings.json), model-guard entry present in the active manifest, .claude/skills/bee-* count + provenance, .claude/agents/bee-*.md rendered agents present, session log evidence. FAIL-CLOSED aggregate: overall_status is ready ONLY when every row is ok or an explicitly accepted unknown/unsupported (list which); any hooks-file drift or missing wiring -> not_ready with a FIX line per failing row. Human-readable non-json output mirrors the same rows. Tests in test_bee_cli.mjs: fixture-driven — ok path, drifted hooks file -> not_ready, absent codex binary -> warn row + not crash, unknown rows always present for trust on codex, json shape stable. No network calls; no mutation anywhere (doctor is read-only).",
.bee/cells/cnr2-13.json:25:      "doctor --runtime codex --json emits every named row with evidence and never reports ready from file presence alone",
.bee/cells/cnr2-13.json:26:      "trust/discovery rows are structurally unknown with the matrix citation, custom_agents unsupported",
.bee/cells/cnr2-13.json:28:      "doctor is read-only — zero writes anywhere",
.bee/cells/cnr2-13.json:34:        "substantive": "doctor fixture rows: ok, drift->not_ready, absent-binary warn, stable json shape"
.bee/cells/cnr2-13.json:38:      "doctor reuses the catalog render for drift and the capability matrix for structural verdicts"
.bee/cells/cnr2-13.json:44:      "No trust guessing"
.bee/cells/cnr2-13.json:47:  "verify": "bash -c 'env -u BEE_AGENT_NAME node skills/bee-hive/templates/tests/test_bee_cli.mjs && node .bee/bin/bee.mjs doctor --runtime codex --json | grep -q overall_status && node .bee/bin/bee.mjs doctor --runtime claude --json | grep -q overall_status && echo DOCTOR-OK'",
docs/specs/workflow-state.md:18:rules that keep that record trustworthy — above all, that **a new feature can
docs/specs/workflow-state.md:816:  `skills/bee-hive/templates/tests/race_claims_child.mjs` (3 scenarios using
docs/specs/workflow-state.md:860:  `docs/history/review-on-demand/reports/uat-scenarios.md`.
docs/specs/hook-runtime.md:55:| reviewed definition | The exact command definition the owner has inspected and trusted. A new or changed non-managed definition does not run until it is reviewed again. |
docs/specs/hook-runtime.md:118:definition is listed for review and skipped until the human owner trusts that
docs/specs/hook-runtime.md:415:  pending review; automation never rewrites or bypasses the owner's trust
docs/specs/hook-runtime.md:440:  the package-delivered projection in a real trusted session remains
docs/specs/hook-runtime.md:451:  resolving the checkpoint's own root/handler from an untrusted working
docs/specs/hook-runtime.md:507:  `AGENTS.md`; repo-root `.spikes/` removed per bee-footprint D2 — the
docs/history/codex-native-runtime-v2/approach.md:5:Capability-gated, slice-ordered parity build (CONTEXT.md D1–D13): land the always-safe truth/guard fixes first (S1), observe the installed Codex CLI's real capabilities second (S2), and only then build the distribution, orchestration, adapter, doctor, and conformance layers on what was actually observed. Root `skills/` stays the single human-edited source; per-runtime rendering happens inside the existing onboarding sync, not in a parallel dist tree.
docs/history/codex-native-runtime-v2/approach.md:10:- **Trusting the review doc's Codex capability claims without observation:** rejected — the doc's own strongest insight is `hooks_file_present ≠ hooks_trusted_and_observed`; building custom agents on unverified docs would repeat the exact "file exists so it works" failure it diagnoses (D2).
docs/history/codex-native-runtime-v2/approach.md:28:| Conformance (D12) | MEDIUM | automatable subset as scripts; manual scenarios documented, not faked |
docs/history/codex-native-runtime-v2/approach.md:29:| AGENTS.md dedupe (D13) | MEDIUM | byte budget check; every removed sentence provably present in a skill |
docs/history/codex-native-runtime-v2/approach.md:37:1. Does `codex` CLI on this machine expose agents/hook-trust surfaces inspectable read-only (S2 feasibility itself)?
docs/specs/feedback-digest.md:35:2. **A digest is the only thing that crosses a repository boundary**, and the reader trusts none of
docs/specs/feedback-digest.md:75:surface was therefore **removed instead of filtered**, because a filter that cannot be trusted is
docs/specs/feedback-digest.md:181:**Why the reader distrusts the writer.** The producing repository scans its own records when it
docs/specs/feedback-digest.md:270:  **Never trust a boundary artifact you did not produce.**
docs/specs/worktree-parallelism.md:17:## The trust model (the load-bearing rule)
docs/specs/worktree-parallelism.md:19:A worktree gets its own store ONLY when it is **granted**, and a grant is trusted only when
docs/specs/worktree-parallelism.md:36:nothing. This is the exact "onboarding-marker-as-trust" pattern P40 rejected, kept rejected.
docs/specs/doctrine-layer.md:302:  `<!-- BEE:END -->` markers in each host's root `AGENTS.md`.
docs/history/codex-native-runtime-v2/plan.md:26:| S6 | `bee doctor --runtime codex` (and `claude`) | D11 | S2 (knows what "observed" means) |
docs/history/codex-native-runtime-v2/plan.md:27:| S7 | Conformance suite (automatable subset) + AGENTS.md dedupe budget | D12 D13 | S1–S6 |
docs/history/codex-native-runtime-v2/plan.md:29:**Slice 1 (S1+S2): COMPLETE** — cnr2-1/2/4/5 capped, goal-checked, judge-intact; spec synced (hook-runtime). Matrix verdicts (decision logged): DEFER D6 (plugin hooks removed/false on 0.144.4) and D8 (custom agents not discovered; P25 stays deferred); PROCEED D7, D10, S6 doctor; observed bonus — `update_plan` reaches PostToolUse and `spawn_agent` fires PreToolUse with `tool_input.agent_type`.
docs/history/codex-native-runtime-v2/plan.md:49:1. **cnr2-13 (D11 doctor):** `bee doctor --runtime codex|claude` — fail-closed status report; never "ready" from file presence; codex trust/custom-agent rows honestly `unknown`/`unsupported` per the capability matrix (doctor --json exposes no trust surface on 0.144.4).
docs/history/codex-native-runtime-v2/plan.md:50:2. **cnr2-14 (D12 conformance, deps cnr2-13):** scripted automatable subset of the 12 black-box scenarios + manual checklist with named metrics; wired into the verify chain.
docs/history/codex-native-runtime-v2/plan.md:51:3. **cnr2-15 (D13 AGENTS.md dedupe):** 20 KiB budget guard test + conservative dedupe at the template source (every removed sentence provably present in a skill).
docs/history/codex-native-runtime-v2/plan.md:55:1. **cnr2-1 (S1/D3) docs truth cleanup:** remove the three stale "Codex has no (lifecycle) hooks" claims; INSTALL.md gains the Codex verify procedure (project trust → `/hooks` review state → observed check via `.bee/logs/hooks.jsonl`; three-state model `hooks_file_present / hooks_discovered / hooks_trusted_and_observed`).
docs/history/codex-native-runtime-v2/CONTEXT.md:10:2. No hook-trust verification exists for Codex (no `/hooks` step; file presence is treated as capability).
docs/history/codex-native-runtime-v2/CONTEXT.md:21:- **D2 — Capability-gated build.** Every claimed new Codex capability (`.codex/agents/*.toml` discovery, `developer_instructions`, plugin `hooks` key, PreToolUse `Agent`-shaped matcher, `update_plan` tool name, SubagentStart-equivalent) must be **observed on the installed Codex CLI** by a read-only spike before any slice builds on it. A capability not observed ⇒ that slice degrades to the current mechanism and logs an explicit asymmetry decision (AO11 pattern). File-presence is never capability (`hooks_file_present ≠ hooks_discovered ≠ hooks_trusted_and_observed`).
docs/history/codex-native-runtime-v2/CONTEXT.md:22:- **D3 — Truth cleanup lands first.** Remove/replace every active-doc "Codex has no (lifecycle) hooks" claim (INSTALL.md, README.md, docs/06-runtime-integration.md; config-reference/decision docs keep historical wording with a dated correction note only where they are active guidance). INSTALL.md gains a Codex verify procedure: project trust, `/hooks` review state, three-state model, observed-hook check via `.bee/logs/hooks.jsonl`.
docs/history/codex-native-runtime-v2/CONTEXT.md:25:- **D6 — Plugin bundles hooks (capability-gated).** If D2 confirms the plugin `hooks` key works, `.codex-plugin/plugin.json` declares it and onboarding/doctor enforce plugin-hooks XOR repo-hooks (never both silently). Otherwise repo-local `.codex/hooks.json` stays authoritative and the manifest gap is logged as asymmetry.
docs/history/codex-native-runtime-v2/CONTEXT.md:30:- **D11 — `bee doctor --runtime codex`.** New bee.mjs command group reporting: Codex version, project trust, hooks file present / discovered / observed-this-session (from `.bee/logs/hooks.jsonl`), pending hook review, skills discovered, custom agents discovered, active permission mode, duplicate plugin+repo hooks. Fail-closed: never "ready" from file presence alone. A `--runtime claude` counterpart reports the Claude-side equivalents (cheap once the frame exists).
docs/history/codex-native-runtime-v2/CONTEXT.md:31:- **D12 — Conformance suite, automatable subset first.** Scenario harness for the review doc's 12 black-box scenarios; land the mechanically-checkable subset (write-before-Gate-3 blocked, verify-red never caps, reservation conflict blocks, doctor fail-closed, matcher coverage) as scripted tests; the interactive-judgment scenarios are documented as a manual checklist with measured metrics named, not faked.
docs/history/codex-native-runtime-v2/CONTEXT.md:32:- **D13 — AGENTS.md stays under a hard 20 KiB budget, kernel-first.** Trim toward kernel + pointers where content is duplicated in skills (current 17.9 KiB, Codex cap 32 KiB shared with host-repo AGENTS.md files). Conservative: no rule is deleted, only deduplicated; every removed sentence must exist verbatim-or-stronger in a skill or runtime contract. Full 60-line kernel rewrite is OUT of scope (own future feature).
docs/history/codex-native-runtime-v2/CONTEXT.md:46:- Full AGENTS.md 60-line kernel rewrite (D13 is dedupe-only).
docs/history/codex-native-runtime-v2/CONTEXT.md:53:A Codex session in a bee host repo gets: truthful docs, observed-or-declared-asymmetric hooks, native agent roles (if capability confirmed) with developer-priority worker invariants, runtime-clean skill prose with zero cross-runtime instruction bleed on the loaded path, a doctor that fail-closes, and scripted conformance checks green on both runtimes.
docs/specs/reading-map.md:9:  without trusting them, and how the collected view is ranked and fed to the gated
docs/specs/onboarding.md:291:full bee guard set for the project (trust must still be granted once, in that
docs/history/codex-native-runtime-v2/implement-plan.md:25:**Out:** S3–S7 (gated on the matrix); logical read-modify-write serialization of state.json (named limitation, pre-existing on Claude); AGENTS.md kernel rewrite; doctrine changes.
docs/history/codex-native-runtime-v2/implement-plan.md:29:- **Docs path (cnr2-1):** prose-only; three-state trust vocabulary; conditional /hooks step (semantics pending spike); success evidence cited from `.bee/logs/tools.jsonl` (bee-tools-logger), `hooks.jsonl` correctly described as crash/narrow-lifecycle log.
docs/history/codex-native-runtime-v2/implement-plan.md:32:- **Evidence path (cnr2-4):** 10 rows (agents discovery+actual spawn, plugin hooks key/default pickup/precedence+provenance, update_plan reach, hook ABI envelope, spawn PreToolUse, SubagentStart-equivalent, /hooks + doctor-input sources), probed via `codex exec --ephemeral --ignore-user-config --json`, trust-bypassed vs normal-trust compared; unknown-with-reason is valid; matrix gates S3/S4/S6 explicitly.

exec
/bin/bash -lc "git status --short
wc -c AGENTS.md skills/bee-hive/templates/AGENTS.block.md 2>/dev/null || true
rg --files | rg '("'^|/)(AGENTS'"\\.block\\.md|test_agents_budget\\.mjs|test_conformance\\.mjs|be-codex\\.md|capability-matrix|codex-native-runtime-v2/.+matrix)("'$|'"\\.)'" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 109ms:
docs/REFs/be-codex.md
skills/bee-hive/templates/AGENTS.block.md
docs/history/codex-native-runtime-v2/reports/capability-matrix.md

codex
Early evidence points to three pressure points I’m checking against the source: version-scoped doctor claims, whether the reservation test exercises the actual write boundary, and whether the 20 KiB limit applies to bee’s managed block rather than arbitrary host prose. The evidence gathers are still running.
collab: Wait
exec
/bin/bash -lc "rg -n \"12 scenarios|Scenario|scenario|P2|doctor|reservation|verify-red|Gate 3|compaction|timeout\" docs/REFs/be-codex.md | head -120
sed -n '430,620p' docs/REFs/be-codex.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 110ms:
3:**Đúng: Bee hiện chưa chạy trên Codex tương đương Claude Code.** Nhưng nguyên nhân chính không phải Codex “kém hiểu prompt” hơn. Core của Bee—`bee.mjs`, gates, cells, reservations, verify evidence, handoff—khá tốt và có thể dùng chung. Khoảng cách nằm ở **lớp tích hợp runtime**: Bee vẫn là kiến trúc Claude-first, sau đó thêm các nhánh tương thích Codex vào cùng bộ skill.
459:Release reservations before returning.
470:* `PreToolUse Bash|Edit|Write`: gate, reservation, privacy.
476:* `Stop`: reservation/cell hygiene.
499:### 2. Tạo `bee doctor --runtime codex`
573:## P2 — Đo parity thật, không đánh giá bằng cảm giác
579:3. Write trước Gate 3: bị chặn.
581:5. File reservation conflict: `[BLOCKED]`.
584:8. Subagent timeout: không duplicate dispatch.
588:12. Hook chưa trust: doctor fail-closed.
633:* Sau khi thêm native agents, hook trust doctor và runtime adapters: hoàn toàn có thể đạt **8–9/10 trên Codex**, nhưng không bằng cách tiếp tục bổ sung prose vào bộ skill chung.

Bee có thể cung cấp các profile riêng:

```text
bee-safe       -> on-request
bee-autopilot  -> never
```

nhưng không nên đánh đồng chúng với `gate_bypass`.

## `.codex/agents/bee-worker.toml`

Nội dung cốt lõi nên giống:

```toml
name = "bee_worker"
description = "Execute exactly one assigned Bee cell."
sandbox_mode = "workspace-write"

developer_instructions = """
You execute exactly one parent-assigned Bee cell.

Never select another cell.
Read AGENTS.md, CONTEXT.md, plan.md, and the assigned cell.
Reserve every declared file before writing.
Do not install packages or redesign architecture.
Run the exact verify command.
Record its real output.
Cap only after verification passes.
Release reservations before returning.
Return exactly one status: DONE, BLOCKED, HANDOFF, or NOOP.
"""
```

Chi tiết command tiếp tục nằm trong `bee-executing`.

## Codex hooks nên đảm nhiệm

* `SessionStart`: inject state và bắt buộc route qua Bee ở developer context.
* `UserPromptSubmit`: reminder ngắn, có dedupe.
* `PreToolUse Bash|Edit|Write`: gate, reservation, privacy.
* `PreToolUse Agent`: chỉ cho phép sanctioned Bee role khi đang swarm.
* `PostToolUse update_plan`: state sync.
* `SubagentStart`: inject assigned cell contract vào subagent.
* `SubagentStop`: collect/nudge.
* `PreCompact/PostCompact`: handoff and reload.
* `Stop`: reservation/cell hygiene.

Codex `SessionStart` và `SubagentStart` có thể inject thêm developer context, rất phù hợp để đưa các luật không thể quên vào đúng priority level. ([OpenAI Developers][2])

---

# Thứ tự triển khai

## P0 — Làm ngay

### 1. Xóa toàn bộ sự thật lỗi thời

Sửa đồng bộ:

* `INSTALL.md`
* `docs/06-runtime-integration.md`
* `README.md`
* `bee-swarming`
* `swarming-reference`
* Codex capability matrix

Không còn câu “Codex has no lifecycle hooks” hoặc “Codex has no role equivalent”.

### 2. Tạo `bee doctor --runtime codex`

Doctor phải báo:

```text
Codex version
project .codex trusted?
hooks file present?
hooks observed this session?
hooks pending review?
skills discovered?
custom agents discovered?
active permission mode?
duplicate plugin/project hooks?
```

Không được báo “Codex ready” chỉ vì file tồn tại.

### 3. Sửa hook matcher

Ít nhất:

```text
TaskCreate|TaskUpdate|TodoWrite
→ update_plan
```

và thêm guard cho:

```text
Agent
```

### 4. Bỏ `approval_policy = "never"` khỏi default package

Chuyển nó thành một optional autopilot profile.

### 5. Bundle Codex hooks đúng plugin

Thêm vào manifest:

```json
"hooks": "./hooks/hooks.json"
```

hoặc đặt đúng default path. Installer phải tránh cài thêm repo hook nếu plugin hook đã active.

---

## P1 — Codex-native orchestration

### 6. Tạo bốn custom agents

* explorer
* validator
* worker
* reviewer

### 7. Tách adapter cho năm skill nhạy runtime

Không còn các đoạn Claude/Codex xen kẽ trong cùng một execution path.

### 8. Chuyển worker invariants vào `developer_instructions`

Skill là hướng dẫn chi tiết; agent profile là luật cứng.

### 9. Viết lại advisor transport

Trong `bee-executing`, model-shaped advisor hiện hướng worker dùng “your own Agent tool”, fallback bằng `claude -p`.

Codex adapter phải dùng Codex custom agent/follow-up transport, không fallback sang Claude trừ khi người dùng cấu hình external Claude advisor rõ ràng.

---

## P2 — Đo parity thật, không đánh giá bằng cảm giác

Tạo black-box conformance suite chạy cùng fixture trên Claude và Codex:

1. Tiny typo: không ceremony thừa.
2. Standard feature: đúng Gates 1–3.
3. Write trước Gate 3: bị chặn.
4. Worker chỉ nhận một cell.
5. File reservation conflict: `[BLOCKED]`.
6. Verify red: không cap.
7. Package install: checkpoint.
8. Subagent timeout: không duplicate dispatch.
9. Compaction: handoff đúng.
10. Feature finish: không auto-review.
11. Review được gọi: fan-out đúng.
12. Hook chưa trust: doctor fail-closed.

Các chỉ số cần đo:

```text
route_accuracy
unauthorized_write_count
gate_correctness
delivery_tool_calls
time_to_first_edit
cell_completion_rate
verify_evidence_rate
duplicate_dispatch_count
unrequested_review_count
handoff_resume_success
```

Mục tiêu không phải Claude và Codex có transcript giống nhau. Mục tiêu là:

```text
100% invariant parity
gần tương đương delivery cost
runtime-native orchestration
```

---

# Quyết định cuối cùng

| Câu hỏi                                                        | Khuyến nghị                                 |
| -------------------------------------------------------------- | ------------------------------------------- |
| Có nên giữ chung Bee Core?                                     | **Có**                                      |
| Có nên copy toàn bộ skill thành hai bộ?                        | **Không**                                   |

exec
/bin/bash -lc 'rg -n "''^#|0'"\\.144\\.4|F1|A1|A2|trust|doctor|hook|custom agent|spawn_agent|UNKNOWN|UNSUPPORTED\" docs/history/codex-native-runtime-v2/reports/capability-matrix.md | head -180
sed -n '1,220p' docs/history/codex-native-runtime-v2/reports/capability-matrix.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 105ms:
1:# Codex capability matrix — summary (cnr2-4 / S2 / D2)
3:**Probed CLI:** `codex-cli 0.144.4` · **Date:** 2026-07-18 · **Mode:** READ-ONLY spike, no repo/user
10:## Trust dimension (the one that governs everything)
12:Same wired `.codex/hooks.json`, same prompt, two runs:
13:- **normal-trust** (`codex exec --ephemeral --json`, hooks never `/hooks`-trusted) → **no hook fired** (skipped).
14:- **trust-bypassed** (`… --dangerously-bypass-hook-trust`) → **hooks fired**, envelopes captured.
16:So `hooks_file_present ≠ hooks_discovered ≠ hooks_trusted_and_observed` is mechanical on 0.144.4.
17:Automation needs `--dangerously-bypass-hook-trust` for hooks to run without interactive trust.
19:## Rows
21:| Row | Capability | Verdict | Evidence / reason (0.144.4) |
23:| **A1** | `.codex/agents/*.toml` discovery (developer_instructions/model/sandbox_mode) | **not-observed** | TOMLs never surface in `debug prompt-input`; malformed agent TOML raised no parse error; only built-in agent_types spawnable. |
24:| **A2** | Named custom agent selectable + spawned (+ effective dev_instructions/model/sandbox, follow-up transport, start/stop identity) | **not-observed** (custom); built-ins observed | `spawn_agent agent_type="bee_worker"` → `unknown agent_type 'bee_worker'` (both config modes). Only `default`/`explorer`/`worker` accepted; they carry no bee developer_instructions. Identity: `use_agent_identity` = under-development/false. Follow-up: re-probe on a build with `multi_agent_v2`/`use_agent_identity` stable, or find the registration mechanism. |
25:| **B1** | Plugin manifest `hooks` key support | **not-observed** | `codex features list` → `plugin_hooks = removed/false`; no plugin bundles hooks. Follow-up: install a plugin with a `hooks` key on a capable build; confirm via a fired hook. |
26:| **B2** | Default `hooks/hooks.json` pickup vs explicit manifest key | **unknown** | `bee@bee` not installed as a Codex plugin + `plugin_hooks` removed → neither plugin path exercisable. Repo-source `.codex/hooks.json` pickup IS observed. Follow-up: install `bee@bee` bundling `hooks/hooks.json`, observe which path loads. |
27:| **B3** | Repo vs plugin precedence / duplicate-firing / XOR / per-hook source provenance | **unknown** | No plugin hooks installed → two sources not comparable. bee self-tags `--source=repo`; no Codex-native provenance field observed. Follow-up: install plugin + repo hooks together, observe duplicate firing. |
29:| **C2** | Hook ABI (envelope, tool-name matching, cwd, source, ordering, stdout/exit) | **observed** | Verbatim JSON-on-stdin envelope: `session_id/turn_id/cwd/hook_event_name/model/permission_mode/tool_name/tool_input/tool_response/tool_use_id`. Tool names normalized (`Bash`, `update_plan`, `spawn_agent`); `cwd` = session dir; emits `{}`, exit 0. Exit-1 + JSON-on-Stop semantics per 0.144.1 diagnosis. |
30:| **D1** | PreToolUse for agent spawns (`Agent`/`spawn_agent` matcher viability) | **observed** | Spawning built-in `worker` fired PreToolUse `tool_name:"spawn_agent"`, `tool_input.agent_type:"worker"`, matched `spawn_agent\|Agent`. Guard must match **`spawn_agent`**, not `Agent`; can gate on `agent_type`. |
32:| **F1** | `/hooks` trust surface + machine-readable sources (present/discovered/trusted/observed/permission-mode/agent+skill discovery/duplicate sources) | **observed** (with hard limit) | Trust gate observed live; `permission_mode` in every envelope; `debug prompt-input` surfaces skills. BUT `doctor --json` (18 checks) has NO hook/trust/agent/skill rows; trust state lives only in the interactive `/hooks` TUI → not machine-readable. |
34:Built-in multi-agent tools observed present (`spawn_agent`, `followup_task`, `send_message`,
38:## Gating consequences
40:### S3 — Distribution (D6 plugin hooks + XOR; D7 approval_policy)
41:- **D6: DEGRADE / DEFER** — B1 not-observed (`plugin_hooks` removed). Repo-local `.codex/hooks.json`
42:  stays authoritative; XOR rule moot; log the plugin-hooks manifest gap as an asymmetry (AO11).
47:### S4 — Native orchestration (D8 custom agents + developer_instructions; D10 advisor transport)
48:- **D8: DEGRADE / DEFER** — A1/A2 not-observed. `.codex/agents/*.toml` not discovered; only built-in
50:  skill prose + AGENTS.md; log the asymmetry. Use the observed PreToolUse **`spawn_agent`** guard (D1) to
53:  worker transport is feasible without a `claude -p` fallback; not gated on custom agents. This repo's
56:### S6 — `bee doctor --runtime codex` (D11)
57:- **PROCEED, fail-closed by construction** — F1: `codex doctor --json` gives no hook/trust/agent surface,
58:  so bee derives its own rows: present = `.codex/hooks.json` on disk; discovered = matcher entry present;
59:  observed-this-session = `.bee/logs/hooks.jsonl`; **trusted = not machine-observable → report
60:  "unverifiable, run /hooks", never "ready"**; permission-mode = from a hook envelope; custom-agents =
61:  fail-closed (A1 not-observed); duplicate sources = compare repo hooks vs installed plugin hooks. The
62:  present/discovered/observed three-state model is fully supported; "trusted" and "custom agents" are
# Codex capability matrix — summary (cnr2-4 / S2 / D2)

**Probed CLI:** `codex-cli 0.144.4` · **Date:** 2026-07-18 · **Mode:** READ-ONLY spike, no repo/user
config mutated. Full evidence + verbatim envelopes: `.bee/spikes/codex-native-runtime-v2/capability-matrix.md`
(raw probe outputs under `.bee/spikes/codex-native-runtime-v2/evidence/`).

D2 rule applied: file-presence is never capability; docs-page claims cap at `unknown`; every `observed`
verdict has verbatim command/log evidence; each `unknown`/`not-observed` states its live-probe follow-up.

## Trust dimension (the one that governs everything)

Same wired `.codex/hooks.json`, same prompt, two runs:
- **normal-trust** (`codex exec --ephemeral --json`, hooks never `/hooks`-trusted) → **no hook fired** (skipped).
- **trust-bypassed** (`… --dangerously-bypass-hook-trust`) → **hooks fired**, envelopes captured.

So `hooks_file_present ≠ hooks_discovered ≠ hooks_trusted_and_observed` is mechanical on 0.144.4.
Automation needs `--dangerously-bypass-hook-trust` for hooks to run without interactive trust.

## Rows

| Row | Capability | Verdict | Evidence / reason (0.144.4) |
|---|---|---|---|
| **A1** | `.codex/agents/*.toml` discovery (developer_instructions/model/sandbox_mode) | **not-observed** | TOMLs never surface in `debug prompt-input`; malformed agent TOML raised no parse error; only built-in agent_types spawnable. |
| **A2** | Named custom agent selectable + spawned (+ effective dev_instructions/model/sandbox, follow-up transport, start/stop identity) | **not-observed** (custom); built-ins observed | `spawn_agent agent_type="bee_worker"` → `unknown agent_type 'bee_worker'` (both config modes). Only `default`/`explorer`/`worker` accepted; they carry no bee developer_instructions. Identity: `use_agent_identity` = under-development/false. Follow-up: re-probe on a build with `multi_agent_v2`/`use_agent_identity` stable, or find the registration mechanism. |
| **B1** | Plugin manifest `hooks` key support | **not-observed** | `codex features list` → `plugin_hooks = removed/false`; no plugin bundles hooks. Follow-up: install a plugin with a `hooks` key on a capable build; confirm via a fired hook. |
| **B2** | Default `hooks/hooks.json` pickup vs explicit manifest key | **unknown** | `bee@bee` not installed as a Codex plugin + `plugin_hooks` removed → neither plugin path exercisable. Repo-source `.codex/hooks.json` pickup IS observed. Follow-up: install `bee@bee` bundling `hooks/hooks.json`, observe which path loads. |
| **B3** | Repo vs plugin precedence / duplicate-firing / XOR / per-hook source provenance | **unknown** | No plugin hooks installed → two sources not comparable. bee self-tags `--source=repo`; no Codex-native provenance field observed. Follow-up: install plugin + repo hooks together, observe duplicate firing. |
| **C1** | `update_plan` reaching PostToolUse | **observed** | `post_updateplan.jsonl`: PostToolUse envelope `tool_name:"update_plan"` matched matcher `update_plan`. Current repo matcher `TaskCreate\|TaskUpdate\|TodoWrite` would miss it → confirms D4 gap + fix. |
| **C2** | Hook ABI (envelope, tool-name matching, cwd, source, ordering, stdout/exit) | **observed** | Verbatim JSON-on-stdin envelope: `session_id/turn_id/cwd/hook_event_name/model/permission_mode/tool_name/tool_input/tool_response/tool_use_id`. Tool names normalized (`Bash`, `update_plan`, `spawn_agent`); `cwd` = session dir; emits `{}`, exit 0. Exit-1 + JSON-on-Stop semantics per 0.144.1 diagnosis. |
| **D1** | PreToolUse for agent spawns (`Agent`/`spawn_agent` matcher viability) | **observed** | Spawning built-in `worker` fired PreToolUse `tool_name:"spawn_agent"`, `tool_input.agent_type:"worker"`, matched `spawn_agent\|Agent`. Guard must match **`spawn_agent`**, not `Agent`; can gate on `agent_type`. |
| **E1** | SubagentStart-equivalent event | **unknown** | Spawn run had no SubagentStart/Stop matcher wired; parent JSONL exposed only `thread.started`/`turn.*`/`item.*`; no subagent-start flag in `features list`. Follow-up: wire SubagentStart+SubagentStop, spawn a child, observe firing + envelope. |
| **F1** | `/hooks` trust surface + machine-readable sources (present/discovered/trusted/observed/permission-mode/agent+skill discovery/duplicate sources) | **observed** (with hard limit) | Trust gate observed live; `permission_mode` in every envelope; `debug prompt-input` surfaces skills. BUT `doctor --json` (18 checks) has NO hook/trust/agent/skill rows; trust state lives only in the interactive `/hooks` TUI → not machine-readable. |

Built-in multi-agent tools observed present (`spawn_agent`, `followup_task`, `send_message`,
`wait_agent`, `interrupt_agent`, `list_agents`); `multi_agent = stable/true`, but
`multi_agent_v2`/`use_agent_identity`/`enable_fanout` are under-development/false.

## Gating consequences

### S3 — Distribution (D6 plugin hooks + XOR; D7 approval_policy)
- **D6: DEGRADE / DEFER** — B1 not-observed (`plugin_hooks` removed). Repo-local `.codex/hooks.json`
  stays authoritative; XOR rule moot; log the plugin-hooks manifest gap as an asymmetry (AO11).
- **D7: PROCEED** — capability-independent. Drop `approval_policy = "never"` from the distributed
  default; ship `bee-safe`→on-request / `bee-autopilot`→never profiles; keep Codex approval policy and
  bee `gate_bypass` documented as distinct. Local working copy may keep `never`.

### S4 — Native orchestration (D8 custom agents + developer_instructions; D10 advisor transport)
- **D8: DEGRADE / DEFER** — A1/A2 not-observed. `.codex/agents/*.toml` not discovered; only built-in
  `default`/`explorer`/`worker` spawnable, without bee developer_instructions. Worker invariants stay in
  skill prose + AGENTS.md; log the asymmetry. Use the observed PreToolUse **`spawn_agent`** guard (D1) to
  gate `agent_type` at spawn time instead of defining custom roles.
- **D10: PROCEED (adapter-level)** — native collaboration tools are present, so a Codex-native advisor/
  worker transport is feasible without a `claude -p` fallback; not gated on custom agents. This repo's
  advisor is already cli-shaped (`codex exec`).

### S6 — `bee doctor --runtime codex` (D11)
- **PROCEED, fail-closed by construction** — F1: `codex doctor --json` gives no hook/trust/agent surface,
  so bee derives its own rows: present = `.codex/hooks.json` on disk; discovered = matcher entry present;
  observed-this-session = `.bee/logs/hooks.jsonl`; **trusted = not machine-observable → report
  "unverifiable, run /hooks", never "ready"**; permission-mode = from a hook envelope; custom-agents =
  fail-closed (A1 not-observed); duplicate sources = compare repo hooks vs installed plugin hooks. The
  present/discovered/observed three-state model is fully supported; "trusted" and "custom agents" are
  structurally unknown and must fail-closed.

codex
All three read-only reviews are still running. I’ve confirmed a concrete doctor contradiction in the current artifacts: the 0.144.4 matrix says custom agents were “not observed” and trust is not machine-readable, while the cell risks treating `unsupported`/`unknown` as readiness-acceptable without a version/effective-observation condition. I’m waiting for the scoped source digests before fixing the verdict.
collab: Wait
codex
The conformance review found one genuine boundary mismatch: the reservation primitive is fixture-testable, but the scenario’s required worker output `[BLOCKED]` is agent behavior and remains manual/hybrid. It also found that the named “reusable” fixture helpers are private today, so the file scope must either add a shared helper module or explicitly allow narrow duplication.
collab: Wait
codex
The doctor review found a hard blocker: the shared dispatcher writes `.bee/cache/manifest-hash.json` before command dispatch, so `bee doctor` cannot meet its “zero writes” contract as planned—the same path already failed under this read-only session. The cell also names a nonexistent canonical path and omits the command registry it must change.
collab: Wait
exec
/bin/bash -lc 'test -e skills/bee-hive/templates/bin/bee.mjs; echo "template_bin_bee_exists=$?"
test -e skills/bee-hive/templates/bee.mjs; echo "template_bee_exists=$?"
test -e skills/bee-hive/templates/lib/command-registry.mjs; echo "command_registry_exists=$?"
LC_ALL=C sed -n '"'/<"'!-- BEE:START -->/,/<!-- BEE:END -->/p'"' AGENTS.md | wc -c
rg -c '"'^<!-- BEE:START -->$|''^<!-- BEE:END -->$'"' AGENTS.md skills/bee-hive/templates/AGENTS.block.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 104ms:
AGENTS.md:2

codex
The AGENTS.md review is the only remaining gather. I’ve independently confirmed the managed BEE block is 17,832 bytes today, its canonical template is `skills/bee-hive/templates/AGENTS.block.md`, and the budget test must preserve exactly one ordered marker pair while measuring UTF-8 bytes.
collab: Wait
exec
/bin/bash -lc "nl -ba .bee/cells/cnr2-15.json | sed -n '1,220p'" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 105ms:
     1	{
     2	  "id": "cnr2-15",
     3	  "feature": "codex-native-runtime-v2",
     4	  "title": "AGENTS.md 20KiB budget guard + conservative dedupe at template source",
     5	  "lane": "high-risk",
     6	  "status": "open",
     7	  "deps": [
     8	    "cnr2-14"
     9	  ],
    10	  "decisions": [
    11	    "D13"
    12	  ],
    13	  "files": [
    14	    "skills/bee-hive/templates/AGENTS.block.md",
    15	    "AGENTS.md",
    16	    "scripts/test_agents_budget.mjs",
    17	    ".bee/config.json",
    18	    "scripts/test_verify_manifest.mjs",
    19	    "docs/history/codex-harness-hardening/release-manifest.json"
    20	  ],
    21	  "read_first": [
    22	    "AGENTS.md",
    23	    "skills/bee-hive/templates/AGENTS.block.md",
    24	    "docs/history/codex-native-runtime-v2/CONTEXT.md"
    25	  ],
    26	  "action": "Per D13 (dedupe-only, conservative): the template source is skills/bee-hive/templates/AGENTS.block.md (17796 bytes; rendered AGENTS.md 17914 — panel-verified). Dedupe ONLY passages whose content exists verbatim-or-stronger in a skill the reader is already routed to: for each removed sentence record WHERE it lives (skill file + line) in the cell report; replace multi-sentence duplicated passages with one pointer sentence. NO rule may be deleted or weakened — when in doubt, keep it. Regenerate AGENTS.md through the real render path (onboarding), never hand-edit the rendered file; AGENTS.block.md also has projection copies pinned by release_manifest --check — regenerate projections via self-onboard sync and regenerate the release manifest (name both steps in the report). Then scripts/test_agents_budget.mjs: rendered AGENTS.md under 20480 bytes hard, warn at 18000, BEE block markers intact. Wire into commands.verify + mandatory-suite guard (serialized AFTER cnr2-14 — shared files: .bee/config.json, test_verify_manifest.mjs, release manifest). Target: measurable shrink from 17914 bytes with zero semantic loss.",
    27	  "must_haves": {
    28	    "truths": [
    29	      "every removed sentence is recorded with its surviving skill location in the report",
    30	      "no rule deleted or weakened — pointers replace duplication only",
    31	      "AGENTS.md regenerated through the render path and under 20480 bytes, guard test green and wired"
    32	    ],
    33	    "artifacts": [
    34	      {
    35	        "path": "scripts/test_agents_budget.mjs",
    36	        "substantive": "byte budget + marker-integrity assertions"
    37	      }
    38	    ],
    39	    "key_links": [
    40	      "template source edited; rendered AGENTS.md produced by onboarding render"
    41	    ],
    42	    "prohibitions": [
    43	      "No rule deletion or weakening",
    44	      "No hand-edit of rendered AGENTS.md",
    45	      "No dedupe of content that exists nowhere else"
    46	    ]
    47	  },
    48	  "verify": "bash -c 'env -u BEE_AGENT_NAME node scripts/test_agents_budget.mjs && env -u BEE_AGENT_NAME node scripts/test_verify_manifest.mjs && echo BUDGET-OK'",
    49	  "trace": {
    50	    "worker": null,
    51	    "outcome": null,
    52	    "files_changed": [],
    53	    "deviations": [],
    54	    "friction": null,
    55	    "capped_at": null,
    56	    "behavior_change": true,
    57	    "verification_evidence": null,
    58	    "verify_output": null,
    59	    "verify_passed": null
    60	  }
    61	}

codex
The remaining reviewer is still running after a narrowed prompt. I’ve completed the local risk cut: preserve the startup kernel in AGENTS.md, enforce the budget on bee’s managed UTF-8 block, and treat “semantic equivalence” as audited evidence—not something the byte-count test can prove.
collab: Wait
exec
/bin/bash -lc "rg -n '"'^#|''^##|''^###|''^[0-9]+'"\\. \\*\\*|"'^-[[:space:]]'"\\*\\*' skills/bee-hive/templates/AGENTS.block.md | sed -n '1,220p'
rg -n 'bee-hive first|status --json|onboarding|HANDOFF|Privacy|Gate block|Never execute|Never hand-edit|agent runs|Fan out|Multi-session|Native Codex|scribe|settled|hook is a safety net' skills/bee-hive/templates/AGENTS.block.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 104ms:
8:2. If `.bee/onboarding.json` is missing or outdated, stop and run `bee-hive` onboarding before continuing.
9:3. Run `node .bee/bin/bee.mjs status --json` as the first step of every session and after every compaction.
10:4. If `.bee/HANDOFF.json` exists, check its kind (`node .bee/bin/bee.mjs state handoff show --json` — a missing/unknown kind reads as `pause`, fail-safe): a **pause** handoff — surface the saved state to the user and wait for explicit confirmation, **never auto-resume**, exactly as before. A **planned-next** handoff (previous cell capped with green verify, next cell already claimed via `bee cells claim-next`) is written only through `bee state handoff write --kind planned-next` and is adopted automatically ONLY at this fresh-session boundary (a `/clear` or a freshly started session) via `bee state handoff adopt` — the adopted unit, its verify command, and its lane replace the wait block with a start-now instruction. A resumed or memory-compacted session never adopts: same wait-and-surface rule as pause.
12:6. **Baseline gate:** if `.bee/config.json` records `commands.verify`, run it once per session before claiming any cell. A red baseline is surfaced to the user and becomes its own fix-first tiny cell — never build on red. If no commands are recorded, capture the host project's `setup/start/test/verify` into `.bee/config.json` `commands` at the first natural moment (exploring or onboarding).
28:  (on demand) bee-scribing — capture a settled rule/behavior/value; document/harvest any area (UI, API, job, integration)
36:1. Never execute before validating: no source edits until Gate 3 (`approved_gates.execution: true` in `.bee/state.json`).
41:6. At roughly 65% context usage, write `.bee/HANDOFF.json` and pause cleanly.
44:9. Lanes scale ceremony, never memory: a capped `behavior_change` cell obliges a `bee-scribing` spec sync in every lane — tiny included — and any settled discussion outcome (rule agreed, behavior confirmed by test, value tuned; backend or frontend alike) is logged as a decision and merged into `docs/specs/` the moment it settles, never left in the chat. **Detecting settlement is the agent's job, every turn, unprompted** — the user never has to say "ghi lại"/"document this". Notice the settlement, announce it in one line ("chốt X — ghi vào spec"), and run the bee-scribing capture in the same turn. Spec and decision writes are docs-layer: allowed in every phase, no gate, no permission needed.
45:10. **The agent runs the machinery, not the user.** Every bee command — `bee_status`, `bee_cells`, `bee_reservations`, `bee_decisions`, onboarding, verify commands — is run by the agent itself, immediately, the moment the workflow calls for it. Never print a bee command for the user to execute, never end a turn on "run this and tell me the output". The only human actions in bee are gate approvals, decision answers, and privacy approvals; everything mechanical is the agent's job. (Users *may* run helpers manually to inspect state — that is their option, never a step the agent delegates.)
47:12. **The hook is a safety net, not the authority.** The law is this file: route through `bee-hive` before touching source, every time. Hooks exist to catch the times you *forget* that law — they are not a gatekeeper whose silence grants permission. Never reason "I'll try the edit; if the hook blocks me, then I'll route through bee" — that inverts the contract: it makes the guard's coverage your protocol, so every gap in the guard becomes a gap in the workflow. (Exactly how it failed: a closed feature left the phase terminal and its gates still approved, no branch of the guard fired, and post-feature source edits walked through untouched — decision c2c46488.) An unblocked write is not an approved write. A guard with a hole is still a law without one.
48:13. **Fan out the gathering; keep the deciding.** Bee runs one orchestration pattern (the Delegation contract): the session model is the orchestrator, and mechanical gather/render/mine steps dispatch **down-tier as I/O workers** that return digests. **The rubric:** a mechanical step delegates when it needs reading **>3 files** OR content you only need as a **digest, not verbatim** — file hunts, codebase scans, "find every caller", multi-file inventories, doc/report rendering. You may override either way at dispatch; the rubric is prose, not a hook. **Decide-altitude never delegates:** gates, the mode gate, Socratic questions, synthesis of findings, accept/reject of a worker's result, state writes, and conversation with the human all stay on the session model. **A worker returns** the paths it read, the facts with `file:line` anchors, and verbatim quotes only where asked — and you never re-read what a digest already answered. **Transport is mandatory on every dispatch:** carry the tier explicitly — a `model` param, or an anchored `[bee-tier: generation|extraction|review|ceiling]` marker as the **first** thing in the prompt or description (a marker buried mid-text never counts). Gathers default to the generation tier. A bare dispatch silently inherits the ceiling model, so `bee-model-guard` denies it (decision 0023) — knowing this before you dispatch is what keeps that hook silent. **This holds in every phase and every lane, tiny and small included, and in plain conversation turns where no bee skill routed at all** — "no skill is running" is exactly when the rule is most often forgotten. The scarce resource is the orchestrator's context window, not tokens: a search run inline dumps file contents into the context you still need, while the same search in a worker costs you only its digest. (Lane scaling's "0 subagents" for tiny/small means zero *ceremony* subagents — reviewers, checkers, panels — never zero I/O workers, and, since AO14, never zero *execution* workers either: tiny/small cell implementation itself now rides one dispatched execution worker, never in-session.) Full contract, tiers, and transport: `bee-hive` → `references/routing-and-contracts.md`. When the generation tier is cli-shaped, the gather runs through the configured external command per the Delegation contract's cli gather branch — not an Agent dispatch.
49:14. **Multi-session etiquette: coordinate through lanes, claims, and holds — never around them.** Several sessions may work the same checkout at once. Ownership is settled by the same-checkout coordination primitives (per-feature lanes, cross-session claims, file holds), never by convention or care. When a write is denied because the path is held by another live session, the refusal names the holder and its expiry — do not retry the write and do not edit around the guard; pick other open work (`bee cells claim-next` skips held paths automatically) and let the hold lapse on its own. This is the same "an unblocked write is not an approved write" discipline as rule 12, applied across sessions instead of across phases.
50:15. **Native Codex empty waits require a progress interval.** For every bee-owned native Codex subagent flow, a `wait_agent` timeout/no-completion result is only an empty wait; silence is not failure. Never call `wait_agent` twice consecutively after an empty wait — authority, urgency, and no-chatter instructions create no exception. Before any later bounded wait, continue material task-local work when any remains; otherwise take exactly one `list_agents` snapshot. Then send one concise commentary update naming both the live agent state and the next action; only then may a later bounded wait run. No-op work, repeated state reads, hidden reasoning, generic commentary, or commentary alone do not qualify. A timeout preserves every running agent, claim, and reservation and never licenses interrupt, duplicate dispatch, claim release, or reservation release. Keep the generic ban on file/scratchpad polling for harness-managed subagents: native Codex uses bounded waiting, while external process and artifact polling remain outside this native-agent rule.
56:  onboarding.json     <- onboarding state + managed file versions
59:  HANDOFF.json        <- pause/resume artifact (exists only while paused)
78:On Claude Code these are enforced mechanically by hooks; on Codex you must honor them yourself. **The hook is a safety net, not the gatekeeper — see critical rule 12: an edit the hook did not block is not an edit bee approved.**
80:- **Privacy:** before reading secret-shaped files (`.env*`, `*.pem`, `*.key`, `id_rsa*`, `*.p12`, `credentials*`, `secrets.*`), ask the user for explicit approval. If a `@@BEE_PRIVACY@@ … @@END@@` marker appears in tool output, route it through a user question — never work around the block.
83:- **Gate block:** if a write is refused because Gate 3 is unapproved, do NOT retry the write; surface the gate question to the user.
89:Jumping from exploring to swarming · code before CONTEXT.md exists · skipping validating · ignoring locked decisions · workers self-selecting cells · capping without verification · commits without cell ids · continuing past open P1s · reservation leaks · stale `state.json` after a phase transition · resuming without surfacing `HANDOFF.json` · "should work" accepted as evidence · a tiny fix wearing epic ceremony · a hard-gate change (auth, data loss, security, external provider) routed below high-risk · session history pasted into a worker dispatch · bee bookkeeping (cells, claims, status, phases) narrated into chat instead of the work itself · a multi-file hunt or codebase scan run inline on the session model when it crossed the fan-out rubric (critical rule 13) — especially in a conversation turn where no skill was routing.
96:2. Leave `.bee/state.json` (phase, summary, next_action) and `.bee/HANDOFF.json` consistent with the true pause/resume state.

codex
The AGENTS.md reviewer remains live; no duplicate dispatch or interruption. I’ve narrowed the remaining question to whether any proposed pointer would remove a rule needed before `bee-hive` itself is loaded, then I’ll issue the final planning verdict.
collab: Wait
codex
1. `cnr2-13` is not read-only yet: the dispatcher writes `manifest-hash.json` before routing—confirmed by `EROFS` here. Fix that path and correct the nonexistent template path plus omitted command registry scope.

2. Doctor needs explicit `project_trust`, `pending_hook_review`, `capability_baseline_match`, and `hook_handlers_resolvable` rows. Split installed vs discovered skills, configured vs observed permission mode, and configured vs active hook sources. “Recent logs” cannot prove `observed_this_session`. Trust/discovery unknowns must block readiness. `custom_agents=unsupported` is valid only as `unsupported_on_0.144.4`; other versions remain unknown.

3. Conformance scenario 5 is hybrid: reservation refusal and holder attribution are fixture-testable, but the worker’s required `[BLOCKED]` response is agent behavior and belongs in the manual checklist. The other proposed automated scenarios are honest if driven through public entrypoints with negative-state assertions.

4. `cnr2-14` cannot currently “reuse fixture helpers”—they are private, top-level test code. Add a shared helper module or explicitly permit narrow duplication. Also widen scope for release-manifest inventory and label matcher/spawn checks as adapter regressions, not numbered parity scenarios.

5. AGENTS.md dedupe must preserve the always-loaded kernel: startup/compaction, gate/write authority, guardrails, delegation transport/AO14, native-wait discipline, handoff/multi-session behavior, on-demand review, and finish hygiene. Their presence in stage skills does not make them safe to pointer away.

6. `cnr2-15` scope and verification are incomplete: include the four tracked template projections and `.bee/onboarding.json`; verify onboarding/plugin render drift plus doctrine census. Measure UTF-8 bytes for both the managed block and this repo’s root, fail at `>=20480`, and assert exactly one ordered marker pair with byte-identical rendering.

**Verdict: RETURN-TO-PLANNING**
hook: Stop
hook: Stop
hook: Stop Completed
hook: Stop Completed
tokens used
114,342
1. `cnr2-13` is not read-only yet: the dispatcher writes `manifest-hash.json` before routing—confirmed by `EROFS` here. Fix that path and correct the nonexistent template path plus omitted command registry scope.

2. Doctor needs explicit `project_trust`, `pending_hook_review`, `capability_baseline_match`, and `hook_handlers_resolvable` rows. Split installed vs discovered skills, configured vs observed permission mode, and configured vs active hook sources. “Recent logs” cannot prove `observed_this_session`. Trust/discovery unknowns must block readiness. `custom_agents=unsupported` is valid only as `unsupported_on_0.144.4`; other versions remain unknown.

3. Conformance scenario 5 is hybrid: reservation refusal and holder attribution are fixture-testable, but the worker’s required `[BLOCKED]` response is agent behavior and belongs in the manual checklist. The other proposed automated scenarios are honest if driven through public entrypoints with negative-state assertions.

4. `cnr2-14` cannot currently “reuse fixture helpers”—they are private, top-level test code. Add a shared helper module or explicitly permit narrow duplication. Also widen scope for release-manifest inventory and label matcher/spawn checks as adapter regressions, not numbered parity scenarios.

5. AGENTS.md dedupe must preserve the always-loaded kernel: startup/compaction, gate/write authority, guardrails, delegation transport/AO14, native-wait discipline, handoff/multi-session behavior, on-demand review, and finish hygiene. Their presence in stage skills does not make them safe to pointer away.

6. `cnr2-15` scope and verification are incomplete: include the four tracked template projections and `.bee/onboarding.json`; verify onboarding/plugin render drift plus doctrine census. Measure UTF-8 bytes for both the managed block and this repo’s root, fail at `>=20480`, and assert exactly one ordered marker pair with byte-identical rendering.

**Verdict: RETURN-TO-PLANNING**
