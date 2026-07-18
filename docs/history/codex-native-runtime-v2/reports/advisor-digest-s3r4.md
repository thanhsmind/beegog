OpenAI Codex v0.144.4
--------
workdir: /home/thanhsmind/projects/goglbe/beegog
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 019f7432-c4e5-7cf0-ba0f-e8d06c66995a
--------
user
# Advisor final residual check — codex-native-runtime-v2 slice 3 rev4

You returned 2 residuals on rev3: (1) provenance contradiction (own-runtime resync permitted in cnr2-9 text); (2) render ownership ambiguity (cnr2-10 still commanded re-rendering). Both are fixed in the cells on disk — re-read .bee/cells/cnr2-9.json, cnr2-10.json, cnr2-11.json, cnr2-12.json and confirm:

1. cnr2-9 now refuses a rendered projection as onboarding source for ANY target, own runtime included, with a no-exception prohibition and an own-runtime-refusal test fixture.
2. cnr2-10 renders only to scratch for its own evidence, never writes managed roots/plugin trees/test_lib.mjs; the census flip moved to cnr2-11 (it can only turn green after the final render); cnr2-11 is the sole final-render owner of all four rendered-tree roots and owns test_lib.mjs.

Terse: any remaining blocker? Numbered residuals + verdict (PROCEED / PROCEED-WITH-CHANGES / RETURN-TO-PLANNING) only.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
hook: SessionStart
hook: SessionStart
hook: SessionStart Completed
hook: SessionStart Completed
hook: UserPromptSubmit
hook: UserPromptSubmit Completed
codex
I’m using the repository’s bee workflow to perform this final plan check. I’ll inspect the four requested cell artifacts and report only blockers plus the verdict.
exec
/bin/bash -lc "node .bee/bin/bee.mjs status --json && wc -l .agents/skills/bee-hive/SKILL.md && sed -n '1,260p' .agents/skills/bee-hive/SKILL.md" in /home/thanhsmind/projects/goglbe/beegog
 exited 1 in 136ms:
node:fs:2413
    return binding.writeFileUtf8(
                   ^

Error: EROFS: read-only file system, open '/home/thanhsmind/projects/goglbe/beegog/.bee/cache/manifest-hash.json.3-0-dac4fa10.tmp'
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
  path: '/home/thanhsmind/projects/goglbe/beegog/.bee/cache/manifest-hash.json.3-0-dac4fa10.tmp'
}

Node.js v24.14.1

codex
The required status helper is blocked by the read-only workspace because it attempts to refresh an internal cache. The supplied session state is current, so I’m continuing with a read-only artifact review.
exec
/bin/bash -lc "wc -l .agents/skills/bee-hive/SKILL.md && sed -n '1,320p' .agents/skills/bee-hive/SKILL.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
197 .agents/skills/bee-hive/SKILL.md
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

codex
The workflow routes this as feasibility validation of the revised work shape. Because the check spans four artifacts, its delegation contract requires a bounded evidence-gathering worker; I’ll retain the blocker judgment and verdict here.
exec
/bin/bash -lc "wc -l .agents/skills/bee-validating/SKILL.md .agents/skills/bee-hive/references/routing-and-contracts.md docs/history/learnings/critical-patterns.md && sed -n '1,280p' .agents/skills/bee-validating/SKILL.md && sed -n '1,420p' .agents/skills/bee-hive/references/routing-and-contracts.md && sed -n '1,260p' docs/history/learnings/critical-patterns.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
  136 .agents/skills/bee-validating/SKILL.md
  306 .agents/skills/bee-hive/references/routing-and-contracts.md
  536 docs/history/learnings/critical-patterns.md
  978 total
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

Dispatch a subagent on the **`review` slot** (decision 0021 — `resolveTier(root, 'review', runtime)`, default opus on Claude, generation fallback; state the model explicitly; if the runtime cannot select per-agent models, cap its reads and output instead). On Claude Code, spawn `subagent_type: "bee-review"` when `.claude/agents/bee-review.md` exists (W3, AO5/AO10) — bee's own rendered agent for the review tier, never `general-purpose` (`bee-model-guard` denies that pairing); Codex has no per-agent subagent type (AO11), so the tier stays enforced as a read budget + output cap only. The plan-checker is a **read-only gather**, never a cell — when the review slot is cli-shaped, resolve it with the purpose-scoped 4-arg form, `resolveTier(root, 'review', runtime, {for:'gather'})`, per the Delegation contract's cli gather branch (`bee-hive/references/routing-and-contracts.md`); a bare 3-arg resolve of a cli-shaped review slot now refuses (AO12/B1, plan 2A-ii). A model-shaped review slot is unaffected by purpose — dispatch it exactly as before — **in the background where the runtime supports it** (decision 0017): continue the spike/matrix/cell-review work while it runs; its findings block nothing until the Gate 3 presentation, which never happens with the checker still outstanding. It assumes the plan is flawed and verifies 5 dimensions: requirement/decision coverage, cell completeness, dependency correctness, key links, scope sanity. Every finding carries **BLOCKER** or **WARNING**. Maximum 3 structural-verification iterations; a BLOCKER still open after iteration 3 escalates to the user. Never attempt iteration 4.

**High-risk lane:** scale to a persona panel — coherence + feasibility lenses always, plus conditional lenses (security, product, scope-guardian) chosen by the diff of concerns. Dedupe findings, then synthesize into auto-fix vs present-for-decision buckets.

## Cell Review (cold pickup)

Dispatch the cell reviewer (`review` slot, decision 0021; same `bee-review` subagent_type as the plan-checker above): could a worker with no session history pick each cell up cold? **CRITICAL** flags — assumed context, vague acceptance, scope overload, unproven feasibility, broken verify — must be fixed before approval. **MINOR** flags may ship with a recorded note.

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
**Tags:** [security, boundaries, testing]
"Never render/emit X" written in a plan or SKILL.md is a request, not an enforcement. The stripped
cluster key was banned in prose at two altitudes and still reached the consuming agent via
`rank --json` spreading `...cluster`. When a value's absence from an output is a security
property, assert that absence with a test at EVERY surface the value crosses (lib return, CLI
output, prompt render) — the same root cause recurs one layer down from wherever you fixed it.

## [20260710] Scope an incident-born check to the defect class, never the first location
**Category:** failure
**Feature:** evolving-loop slice B
**Tags:** [testing, control-bytes, tooling]
The C0 control-byte sweep guarded `templates/**/*.mjs` because that is where the NUL first bit;
the actual cause — raw control bytes decoded from JSON-escaped tool parameters — can hit any
written file, and struck a committed markdown report two commits later (git shows it as binary,
grep goes silent). When mechanizing a check after an incident, ask "what code path produced this
state?" and sweep everything that path can write; fix the instance AND widen the check in the
same cell.

## [20260711] A removal is verified by its invariants, not the names it deletes
**Category:** failure

exec
/bin/bash -lc "sed -n '1,170p' .agents/skills/bee-hive/references/routing-and-contracts.md && sed -n '171,340p' .agents/skills/bee-hive/references/routing-and-contracts.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
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

exec
/bin/bash -lc "sed -n '1,190p' docs/history/learnings/critical-patterns.md && sed -n '191,380p' docs/history/learnings/critical-patterns.md && sed -n '381,570p' docs/history/learnings/critical-patterns.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
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
**Tags:** [security, boundaries, testing]
"Never render/emit X" written in a plan or SKILL.md is a request, not an enforcement. The stripped
cluster key was banned in prose at two altitudes and still reached the consuming agent via
`rank --json` spreading `...cluster`. When a value's absence from an output is a security
property, assert that absence with a test at EVERY surface the value crosses (lib return, CLI
output, prompt render) — the same root cause recurs one layer down from wherever you fixed it.

## [20260710] Scope an incident-born check to the defect class, never the first location
**Category:** failure
**Feature:** evolving-loop slice B
**Tags:** [testing, control-bytes, tooling]
The C0 control-byte sweep guarded `templates/**/*.mjs` because that is where the NUL first bit;
the actual cause — raw control bytes decoded from JSON-escaped tool parameters — can hit any
written file, and struck a committed markdown report two commits later (git shows it as binary,
grep goes silent). When mechanizing a check after an incident, ask "what code path produced this
state?" and sweep everything that path can write; fix the instance AND widen the check in the
same cell.

## [20260711] A removal is verified by its invariants, not the names it deletes
**Category:** failure
**Feature:** learnings-pair-relocation
**Tags:** [removal-census, derived-constants, verification]

Removing a named entity and grepping the name is not enough — two P1s slipped a small-lane
census that way. When censusing a removal: grep from the **repo root** (exclude only declared
archaeology), include **bare-token variants** of the removed names, and re-derive **every
numeric constant computed from the removed thing's size** (caps, counts, "N reviewers",
table totals) — put the recomputed number in the positive verify grep. A capacity constant
that encodes the old roster size will silently refill the freed slots.

**Full entry:** docs/history/learnings/20260711-learnings-pair-relocation.md

## [20260711] Pre-code gates filter spec defects; only diff review catches implementation defects
**Category:** process
**Feature:** skill-sync
**Tags:** [review, stage-capability, destructive-code]

Three adversarial panel iterations, an advisor consult, and a 232-check red-first suite all
passed — then five isolated reviewers reading the ACTUAL DIFF found 9 real P1s (three of
them data-loss paths: stale-snapshot deletes, decoy version parsing, case-alias
sync-then-delete). Panels review artifacts → they catch specification defects; tests written
from the same spec share the code's blind spots → green proves conformance, not safety. For
destructive/mirror/guard logic, never skip or shrink the post-implementation isolated
review, and never count pre-code ceremony or test volume as implementation assurance.

**Full entry:** docs/history/learnings/20260711-skill-sync.md

## [20260711] A control token in free text is injectable by construction; a fail-open contract needs malformed-input rows

**Category:** security
**Feature:** model-tier-guard
**Tags:** [prompt-injection, control-channel, fail-open, test-matrix]

Two design-time rules review had to catch that planning should have owned:
1. **A free-text marker used as an authorization/control signal must be anchored to a
   reserved structural position** (first non-whitespace token of the field), never
   substring/window-searched — quoted or retrieved content containing the marker text
   otherwise satisfies the contract with no decision made. Add "marker embedded
   mid-content → rejected" as a mandatory adversarial test row at plan time.
2. **A stated fail-open/fail-safe contract is not implemented until malformed top-level
   input is a test-row class**: `null`, wrong-type payloads, throwing dependencies.
   Happy-path development never exercises fail-open; the contract crashed (exit 1) on
   `null` stdin despite being explicit in the plan.

**Full entry:** docs/history/learnings/20260711-model-tier-guard.md

## [20260711] A reviewer's cited line is a sample of a class — sweep the diff before re-review

**Category:** process
**Feature:** grill-deltas
**Tags:** [review, fix-pass, defect-class]

The external reviewer failed the same one-file diff twice for one defect class (step-4 prose
writing into a file step 5 creates): round 1 cited one line, the fix repaired only that line,
round 2 found the sibling four lines away — present in the round-1 diff all along. When a
review finding names a *class* (temporal contradiction, missing null-check, banned idiom),
the fix pass greps the ENTIRE diff for the class signature and fixes every instance before
re-submitting. One cited line is a sample, not the population; each missed sibling costs a
full review round. Corollary for step-flow prose: an artifact created at step M is never
written by step N<M — use the pin-now/write-later idiom (D-ID pattern).

**Full entry:** docs/history/learnings/20260711-grill-deltas.md

## [20260711] Never poll scratchpad files to wait for your own background subagents

**Category:** failure
**Feature:** session-observation (anphabe-gogl review run)
**Tags:** [swarming, review, background-agents, tokens, polling]

A review orchestrator spawned its 6 reviewers via a self-written `run-wave.sh` (prompt files
+ headless CLI processes writing `out_*.md`) instead of the Agent tool — shell processes are
invisible to the harness, so it then had to poll the files with an `ls` + `wc -c` loop
repeating six ~110-char absolute paths per iteration (~300–400 tokens each, all 0 bytes).
The Agent tool already provides everything the script rebuilt: parallel dispatch, isolated
context, and completion re-invoking the orchestrator with the final message as the report
(swarming-reference collection contract). Dispatch subagents only through the Agent tool;
never poll for agents you dispatched; polling is only for external state the harness cannot
see (CI, deploys), and even then emit ONE compact line (a count), never per-file paths.

**Full entry:** docs/history/learnings/20260711-subagent-poll-waste.md

## [20260711] A decision attributed to the user needs a traceable in-session quote

**Category:** process
**Feature:** cli-mutations
**Tags:** [decision-log, attribution, integrity]

A worker, lacking a nickname convention, invented one and logged it as a decision whose
rationale read "the user wants…" — the user had never said it. The decision log is ground
truth for future planning; an agent-invented convention laundered into it as instruction
poisons every later "per decision X" citation. When logging any decision that cites the
user, carry the traceable quote or explicit confirmation from THIS session; an inferred or
unblocking choice is logged as inferred, and workers do not log user-sourced decisions at
all — they return the proposal to the orchestrator.

**Full entry:** docs/history/learnings/20260711-cli-mutations.md

## [20260712] Enumerated-move trap in migration cells
**Category:** failure
**Feature:** bee-footprint
**Tags:** [planning, filesystem, validation]
Exhaustive/destructive ops over a mutable directory (move-all, delete-all, "must end empty")
glob the children at execution time — never enumerate a fixed name list. Validation's own
artifacts (spikes, probes) may occupy that namespace by the time the cell runs; the cell
reviewer caught a deterministic verify failure this would have shipped.

## [20260712] Cross-cell contracts and census carriers are plan-authoring work, not validation work
**Category:** process
**Feature:** review-on-demand
**Tags:** [planning, cells, verify-authoring, census]
Recurred twice in one feature, in different shapes: a cell read a ledger field its upstream cell
never wrote; a whole-token verify ban collided with a line the same cell declared protected. And a
removal census scoped as "sweep the strays" missed the one file carrying the exact retired phrase.
At plan-authoring time, mechanically: (1) grep every value a cell READS against the sibling cell
that WRITES it, verbatim; (2) grep every whole-token negative-grep ban against every line the plan
promises to leave untouched; (3) for a census cell, run the real repo-root grep and write file:line
carriers into the cell — and if the tested artifact is self-referential (repo AGENTS.md, anything a
suite only fixtures), the verify greps the LIVE file. Independent reviewers converging is the
backstop, not the mechanism.
**Full entry:** docs/history/learnings/20260712-review-on-demand.md

## [20260712] Dry-run negative-grep verifies against their own fixtures
**Category:** failure
**Feature:** bee-footprint
**Tags:** [verify-authoring, tests]
A `! grep <banned>` verify predicate must be run against the tests/fixtures the work itself
will add before it is locked in: a RED-first test proving "<banned> is denied" necessarily
contains the banned string, making the stored verify unsatisfiable on re-run.

## [20260712] Empty child-process output can be a sandbox denial, not a regression
**Category:** failure
**Feature:** harness-integration-adopt
**Tags:** [codex, sandbox, child-process, verification]

A baseline run reported 40 CLI failures whose only visible symptoms were empty output and secondary
JSON parse errors. The actual child-process result carried `spawnSync ... EPERM`; the unchanged
verify passed `215/0` outside the sandbox and onboarding had zero failures. When a CLI-heavy suite
fails this way, inspect the spawn error first and rerun unchanged with the required execution
permission before creating a fix cell or weakening assertions.

**Full entry:** docs/history/learnings/20260712-harness-integration-adopt.md

## [20260712] Fixture vendored-module lists break on transitive imports
**Category:** failure
**Feature:** dispatcher-unify
**Tags:** [tests, fixtures, imports]
test_bee_write_guard_hook vendors an explicit lib-module list into its fixture repo.
Adding an import to any vendored module (command-registry.mjs → reviews.mjs → cells.mjs)
throws only inside the fixture, and the hook FAILS OPEN — denial tests invert silently.
When a vendored module gains an import, chase the transitive closure into the fixture list.

## [20260713] A shared-suite red is not yours while a sibling cell is in flight
**Category:** failure
**Feature:** advisor
**Tags:** [swarming, verify, parallel-waves]
When a cell's verify runs the full shared suite, a red observed while another
cell is claimed-but-uncapped may be the sibling's mid-flight state, not your
defect. Check `.bee/cells/*.json` for in-flight siblings before diagnosing;
re-run after they cap. Never "fix" files outside your cell's scope to green it.

## [20260713] Promote an order to the always-loaded layer and its transport must ride along
**Category:** failure
**Feature:** tier-transport-doctrine
**Tags:** [doctrine, layering, hooks, dispatch]
Critical rule 13 (fan out the gathering) was promoted into AGENTS.block.md so it holds in
plain conversation turns — but HOW to dispatch (a `model` param or an anchored `[bee-tier:]`
marker, decision 0023) stayed in `bee-hive/references/routing-and-contracts.md`, which loads
only on skill invoke. So the rule fired exactly where its mechanics were absent: every host
session's first dispatch was born bare and `bee-model-guard` denied it, teaching the transport
at deny time, one wasted dispatch per session. When a standing rule commands an action that a
guard rejects in its bare form, the standing sheet carries the order AND the minimum needed to
obey it first try; only the rationale and elaboration may be referenced.

## [20260713] A guard that tests one state is a law with a hole
**Category:** failure
**Feature:** terminal-phase-gate
**Tags:** [guards, gates, doctrine]
The write guard denied source edits at `phase === 'idle'` only. `compounding-complete`
is the OTHER terminal state (state.mjs already treats both as idle-equivalents for
startFeature), and a closed feature leaves its gates recorded as approved — so no
branch fired and post-feature edits walked straight through. Two lessons, one cheap and
one expensive. Cheap: when a state model names N equivalent states, every consumer must
test the SET, never one member. Expensive: an agent that reasons "I'll try the edit; if
the hook blocks me I'll route through bee" has promoted the guard's coverage into the
protocol — the law is AGENTS.md, the hook only catches what you forget, and its silence
is never permission.

## [20260714] A fail-open host swallows fail-closed throws into an allow
**Category:** failure
**Feature:** fresh-session-handoff
**Tags:** [hooks, fail-closed, guards, security]

The write-guard hook exits 0 (allow) on ANY crash by contract. A guard branch that
must fail closed therefore may NEVER throw — it must RETURN a typed deny verdict,
or the host converts the denial into a silent grant. The strict-reader precedent
(`readStateStrict` throws) is the wrong template inside a fail-open host. Prove
fail-closed paths through the real host process, not only in-process.

**Full entry:** docs/history/learnings/20260714-fresh-session-handoff.md

## [20260714] Non-ASCII in a .ps1 without BOM is a parse-time bomb on Windows PowerShell 5.1
**Category:** failure
**Feature:** installer-hardening
**Tags:** [windows, powershell, encoding, cross-platform]

install.ps1 shipped unrunnable: six em-dashes in a UTF-8-no-BOM file. PS 5.1 decodes
no-BOM files as cp1252, so `—` (E2 80 94) ends in 0x94 = `"` (smart right-double-quote),
which PowerShell honors as a STRING TERMINATOR — one comment dash cascaded into ~10 parse
errors and the whole script never ran (reported as "codex doesn't understand bee": skills
were simply never installed on Windows). Keep .ps1 files pure ASCII and guard it with a
byte-level test (any platform, no pwsh needed); a WSL host can prove real parses via
`powershell.exe` interop + `Parser::ParseFile`.

## [20260714] Agent-runtime discovery paths are version-moving targets — probe the binary, not memory
**Category:** process
**Feature:** installer-hardening
**Tags:** [codex, claude-code, skills, discovery]

Codex's repo-level skill path is `.agents/skills` (cwd → repo root; `~/.codex/skills` is
legacy-global), Claude Code's is `.claude/skills` — neither reads the other's dir, so a
per-project install must materialize BOTH trees. Verified empirically with
`codex debug prompt-input` (renders the exact skill roots table the model sees) rather
than from docs memory; that command is the ground truth for "does the agent see skill X".

## [20260714] Async assertions under a non-awaiting runner pass vacuously
**Category:** failure
**Feature:** fresh-session-handoff
**Tags:** [testing, concurrency, silent-green]

`check(fn)` never awaits: an async test body reports PASS immediately and its
assertion failures become unhandled rejections. Concurrency tests belong in a
self-contained child orchestrator (fork racers, assert internally, exit 0/1)
invoked by ONE blocking spawnSync row — and their falsifiability is proven once by
deliberately breaking an invariant and watching the suite go red.

**Full entry:** docs/history/learnings/20260714-fresh-session-handoff.md

## [20260715] A freeze fixture's wrapper verify must assert a printed sentinel, not a filename or bare exit
**Category:** failure
**Feature:** codex-harness-hardening
**Tags:** [freeze-first, sentinel-verify, false-pass, wrapper]

A "red-now" freeze (a regression/lint that documents a defect before it is fixed) is only
trustworthy if its wrapper verify can tell "red for the right reason" from a crash. Two traps,
both make the wrapper false-PASS on a crash that never exercised the defect: (1) grepping for a
**bare filename** the fixture merely *reads* — a stack trace mentions that path too; (2) checking a
**bare non-zero exit** — node's uncaught-throw exit is `1`, indistinguishable from a lint's
"violations found" `1`. Rule: the fixture prints a **specific sentinel on the controlled defect
path only** (`FREEZE-RED: <specific>`, `CENSUS-VIOLATION <file>:<line>`) and exits a **distinct
code** (a sentinel like `3`, not `1`); the wrapper asserts sentinel-string AND that code. Keep
red-now freezes OUT of the mandatory verify command until the fix flips them green, so the baseline
stays green meanwhile. **Full entry:** docs/history/learnings/20260715-codex-harness-hardening-slice0.md

## [20260715] Shipping a lib file means shipping the manifest: regen release-manifest inside the feature
**Category:** process
**Feature:** parallel-scheduler
**Tags:** [release-manifest, verify-chain, lib-files]
Any cell that adds/renames/changes a file under `templates/lib/` or `.bee/bin/lib/` makes
`release_manifest.mjs --check` (part of `commands.verify`) red until `--write` regenerates the
stored manifest — so the regen is part of the FEATURE, owned by its last cell or its close step,
never discovered at the close verify. Same rule generalized: before capping a slice, ask which
standing repo-wide guards (manifest, mirror, census) hash the files you touched, and run their
regen/check inside the slice. (Filed friction to mechanize the hint.)

## [20260716] A cell dependency in the wrong field name is silently ignored — verify the wave, not the write
**Category:** failure
**Feature:** perf-log
**Tags:** [cells, deps, scheduler, silent-accept]
`cells add` accepted `"depends_on": [...]` without error (unknown keys are preserved), but the
scheduler and the claim gate read `cell.deps` — so a 1→2→3 chain collapsed into ONE wave with
`cycles: []`, looking healthy while enforcing no ordering. The field is `deps`. **Rule:** after
any `cells add` that declares dependencies, run `bee cells schedule --feature <f> --json` and
confirm the wave shape matches the intended order — a clean `cycles: []` is not proof the deps
were honored, only that nothing cycled. Generalizes: an optional-field writer that silently
keeps unknown keys turns every field-name typo into a silent no-op; confirm the *effect*
(the computed schedule), never the write.

exec
/bin/bash -lc "wc -l .agents/skills/bee-validating/references/validation-reference.md && sed -n '1,360p' .agents/skills/bee-validating/references/validation-reference.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
154 .agents/skills/bee-validating/references/validation-reference.md
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

collab: Wait
codex
The evidence worker is still reading the four revisions. I’m waiting for its anchored digest, then I’ll issue the blocker-only verdict without widening scope.
collab: Wait
codex
1. None.

VERDICT: PROCEED
hook: Stop
hook: Stop
hook: Stop Completed
hook: Stop Completed
tokens used
57,711
1. None.

VERDICT: PROCEED
