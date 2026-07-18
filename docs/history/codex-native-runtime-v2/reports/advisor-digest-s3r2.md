OpenAI Codex v0.144.4
--------
workdir: /home/thanhsmind/projects/goglbe/beegog
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 019f7425-ea1f-75b3-a64d-5f0a38a6a135
--------
user
# Advisor re-consult — codex-native-runtime-v2, slice 3 rev2 (post-reshape)

You are a read-only advisor. You previously returned RETURN-TO-PLANNING on this slice (your findings 1-7, digest advisor-digest-s3.md). The slice was reshaped to address every finding, plus a parallel panel's repo-reality findings. Verify the repairs are sufficient; return numbered residual findings + verdict (PROCEED / PROCEED-WITH-CHANGES / RETURN-TO-PLANNING). Read-only; no bee state mutations.

## Repairs mapped to your findings

1 (lossy source): cnr2-9 now adds render-schema/target provenance metadata to rendered targets and extends source-identity.mjs (templates/lib + mirror) to REFUSE a rendered projection as an onboarding source for the opposite runtime or for canonical sync — loud blocked_no_source-style, zero mutations. skills/ (canonical) remains the only cross-runtime source.
2 (plugin bleed): NEW cell cnr2-12 (deps cnr2-9, BEFORE any tagging): each plugin route ships its runtime's rendered tree generated through the renderer; release inventory covers rendered trees; test_plugin_distribution gains runtime-clean assertions. Tagging cells (cnr2-10/11) now dep on BOTH cnr2-9 and cnr2-12 — no window where plugins serve half-tagged source.
3 (three contracts): release hash = canonical bytes incl. markers (unchanged); per-target drift = render(canonical, target) at BOTH hash sites the panel located (computeSkillItems onboard_bee.mjs:693 and applySyncSkill fast-skip :1233-1236); downgrade preflight stays version-based, untouched.
4 (test scope): cnr2-10 now owns skills/bee-hive/templates/tests/test_lib.mjs (census ~:7879 flips: wait_agent prose required in codex projection, absent in claude projection); cnr2-9 wires test_skill_render.mjs AND scripts/test_state_write_concurrency.mjs into commands.verify and the test_verify_manifest mandatory-suite guard.
5 (grammar/atomicity): exact full-line markers; refusals for nesting, unclosed, stray end, unknown labels, frontmatter placement, markers inside code fences (forbidden, not parsed); WHOLE-TREE validation before any mutation (zero writes for the entire apply on any malformed file); zero-marker path preserves BOM/CRLF/final-newline/arbitrary bytes.
6 (equality proof): both tagging cells freeze pre-tag git blob hashes; proof = marker-strip reproduces the frozen baseline, with ONLY the permitted mechanical table/bullet re-layout (see 7) and the named D10 delta; diff recorded and justified hunk-by-hunk in the cell report. Token spot-greps replaced with phrase-level rules (pinned-type phrases, .claude/agents, claude -p) — panel showed bare-token bans are unsatisfiable (AO11 note mentions subagent_type) and the old greps were vacuous (spawn_agent lives in swarming-reference.md, now grepped directly).
7 (attribution): who-must-act rule adopted; AO11 budget mechanics codex-only; cross-runtime contrast notes move to docs/06-runtime-integration.md (non-loaded), not duplicated into both projections.

Panel additions also folded: the self_skip premise was wrong — real mechanism is applySyncSkill via self-onboard mode "sync" (stale doc line bee-hive/SKILL.md:31 fixed in cnr2-9); the 3-column runtime table (swarming-reference.md:116-128) and interwoven bullets get PERMITTED paired per-runtime restructuring under the semantic-preservation proof.

## Question

Any residual blocker in the reshaped slice? Answer tersely; a short numbered list + verdict is enough — no need to re-derive the full analysis.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
hook: SessionStart
hook: SessionStart
hook: SessionStart Completed
hook: SessionStart Completed
hook: UserPromptSubmit
hook: UserPromptSubmit Completed
codex
I’m using the repository’s bee-hive routing instructions to audit this slice without changing state. I’ll inspect the reshaped plan and cited code/test surfaces only, then return residual blockers and a verdict.
exec
/bin/bash -lc "node .bee/bin/bee.mjs status --json && sed -n '1,260p' .agents/skills/bee-hive/SKILL.md" in /home/thanhsmind/projects/goglbe/beegog
 exited 1 in 134ms:
node:fs:2413
    return binding.writeFileUtf8(
                   ^

Error: EROFS: read-only file system, open '/home/thanhsmind/projects/goglbe/beegog/.bee/cache/manifest-hash.json.3-0-34e1872d.tmp'
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
  path: '/home/thanhsmind/projects/goglbe/beegog/.bee/cache/manifest-hash.json.3-0-34e1872d.tmp'
}

Node.js v24.14.1

codex
The mandated status reader attempts to refresh a cache even in read-only mode, so the filesystem correctly blocked it before any state change. I’m continuing from the injected status snapshot and reading the routing instructions directly; the audit itself remains read-only.
exec
/bin/bash -lc "wc -l .agents/skills/bee-hive/SKILL.md && sed -n '1,400p' .agents/skills/bee-hive/SKILL.md" in /home/thanhsmind/projects/goglbe/beegog
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
This is an explicit independent review, so bee-hive routes it through the review discipline. I’m applying that discipline in advisory-only mode: immutable scope, evidence-backed findings, and no review-session or repository mutations.
exec
/bin/bash -lc "wc -l .agents/skills/bee-reviewing/SKILL.md && sed -n '1,500p' .agents/skills/bee-reviewing/SKILL.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
208 .agents/skills/bee-reviewing/SKILL.md
---
name: bee-reviewing
description: >-
  Run the multi-agent review gate — severity findings, artifact verification, and user acceptance — over an immutable scope the user explicitly asked to review. Use only when the user requests an independent review: "review this", "review today's work", "review feature A and B", "review the diff from X to Y", "review everything unreviewed before release". A finished cell, slice, or feature is never a trigger by itself, and neither is "merge"/"ship"/"release" alone.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: degraded
      reason: Reads bee records (cells, state, backlog, reviews) via the vendored .bee/bin helpers.
---

# Reviewing (inspector bees)

Reviewing is an independent inspection session over a completed, immutable scope — the same kind of scrutiny a second team gives a pull request or a release candidate. It is not an automatic stage every feature passes through; it runs only when the user asks for it (decision `565e68d0-327f-404e-b49e-d1c61ba81bfd`).

Reviewing is not verification. Verification (bee-executing's cap rules: a real verify command, recorded output, `verification_evidence` for behavior-change cells) is mandatory for every cell and proves a completed unit of work meets its locked requirement. It happens with or without a review session and it is NOT this skill. Review status is independent of implementation status: a change can be `completed`/verified and simultaneously `unreviewed`. Cell closure or feature closure is not proof the feature has been reviewed.

## Trigger — explicit user intent only

Dispatch this skill only when the user names one of these intents (R1):

- "review this / review this feature"
- "review all of today's work"
- "review feature A and B" (or any named list)
- "review the diff from X to Y"
- "review everything unreviewed before release"

None of the following are triggers, no matter how tempting the alignment feels:

- a cell, slice, feature, or working day finishing — verification completing is not a review request
- the words "merge", "ship", or "release" on their own (7.4/A9): when the user asks to merge/ship/release while unreviewed or stale work exists, report the count and risk level (`node .bee/bin/bee.mjs reviews status`), then ask exactly ONE question — does the user want a review session for that scope? Only an explicit yes starts a session; silence or a non-answer means no dispatch, and the work stays labeled `unreviewed` — never described as review-approved.
- gate bypass being on — bypass never creates or auto-approves a review session (R8)

## Scope Resolution

The user owns the review boundary (R4). A request resolves to exactly one of five scope types:

1. the current feature, or a named feature
2. a named list of features/cells
3. everything completed and unreviewed since the last review baseline
4. an explicit range with a stated start and end point
5. everything completed within a stated time window (resolved to an explicit list + immutable diff before dispatch)

If the request does not pin one of these, ask exactly ONE boundary question, then proceed — never ask a second question just to re-confirm permission once the scope is already clear.

**Resolving candidates:** `node .bee/bin/bee.mjs reviews candidates` lists completed-but-unreviewed work; `node .bee/bin/bee.mjs reviews status [--feature F]` reports each candidate's derived coverage label (`unreviewed` / `in review` / `reviewed` / `review stale`). For a batch scope (type 3 or 5), resolve the matching candidates through these verbs, then build ONE cumulative diff spanning all of them, with a mapping from each diff region back to its source feature/cell (7.3) — reviewers read the cumulative diff once so they can see interaction bugs between changes made together, which is the whole point of batching.

**In-progress work is excluded, never swept in:** any cell that is still `open`/`claimed` is excluded from scope with reason "in progress" and stated to the user (A6). Do not wait for it, do not cap it, do not assume it is done. If the runtime cannot hold a review session and an active feature simultaneously, preserve the active state before entering review and restore it exactly afterward (7.5) — reviewing must never overwrite active work or drop a handoff.

## Scope Freeze and Preview

Before any reviewer is dispatched, the scope is frozen (R5):

1. Build the scope JSON: `{ id, requested_by, scope_description, included, excluded, baseline, head }`. Each entry in `included`/`excluded` is `{ type: cell|feature|commit, id, reason? }` — the exact shape `normalizeScopeEntry` in `skills/bee-hive/templates/lib/reviews.mjs` accepts.
2. Create the session: `node .bee/bin/bee.mjs reviews create --file <scope.json>`. This runs the verification preflight over every included behavior-change cell and **fails closed** — non-zero exit, zero files written — when evidence is missing (A10). A failed preflight is a stop: surface the error to the user; never dispatch reviewers to compensate for missing verification. Commit-only scope entries (type 4/5 ranges with no mappable cell) carry nothing to preflight — state that explicitly in the preview below rather than implying the same evidence guarantee A10 gives cell entries.
3. Only after `create` succeeds, show the user the preview: covered features/cells, baseline/head, what was excluded and why, the expected reviewer count (core + conditional), the review model/tier or external executor that will run, and a warning if the scope is unusually large or has commit-only entries with no preflighted evidence.
4. Record the reviewer manifest once dispatch is decided: `node .bee/bin/bee.mjs reviews record --id <session-id> --kind manifest --file <manifest.json>` (every `record` call requires `--id`).

Reviewer dispatch is impossible before step 2 succeeds and the preview in step 3 has been shown — nothing in this flow spawns a reviewer against an unfrozen or unpreviewed scope.

## Lane Scaling — the SESSION's scope sets review depth, not the originating feature's lane

No lane auto-runs a reviewer at feature close (goal 1: zero reviewer tokens spent without a request). `tiny`'s done-report stays entirely inside `bee-swarming`'s single-execution-worker dispatch (the orchestrator authors it from the worker's diff plus its own verify re-run, AO14) — that is verification, not independent review, and it never substitutes for a session. Once a session is requested, its panel scales to the SCOPE's own risk, independent of any single feature's lane:

| Scope risk | Review | Gate 4 |
|---|---|---|
| small scope (single small change, low blast radius) | 1 correctness reviewer (review slot, isolated context: cumulative diff + CONTEXT.md/plan.md only) | asked normally |
| standard scope | 4 core reviewers (§1 table) | asked normally |
| scope with high-risk content (auth, authorization, audit/security, migration, data loss, external provider) | full wave + conditional reviewers, cap 6 | asked normally, UAT always |

A scope containing any high-risk content warrants the full wave regardless of how small the rest of the batch is. None of these depths are ever reduced by gate bypass or by the originating feature having been `tiny`.

Everything below runs the pre-existing full-review contract **unreduced** — same reviewer count, same models, same severity rules, same UAT obligations (goal 5) — it now simply executes over the session's frozen, immutable diff instead of an ad hoc "final slice" diff.

## Required Inputs

- the review session: `node .bee/bin/bee.mjs reviews show --id <session-id>` (scope, baseline/head, included/excluded)
- `docs/history/<feature>/CONTEXT.md` and `docs/history/<feature>/plan.md` for every feature in scope
- the session's cumulative diff (baseline..head, or the mapped multi-feature diff from Scope Resolution)
- capped cells and traces: `node .bee/bin/bee.mjs cells list --feature <feature>`
- current state: `node .bee/bin/bee.mjs status --json`

Missing CONTEXT.md or plan.md for any feature in scope → stop and return to the stage that owns it.

**Delegation:** the required-inputs gather, §3 evidence-gate mining, and the §4 artifact EXISTS/SUBSTANTIVE scan delegate as extraction/generation-tier I/O workers per the Delegation contract (D2/D3, `bee-hive/references/routing-and-contracts.md`); WIRED judgment and severity synthesis stay on the orchestrator.

## 1. Specialist Review

Dispatch reviewers with ISOLATED context: the session's cumulative diff + CONTEXT.md + plan.md ONLY. Never session history.

**Spawn contract:** spawn every reviewer as the runtime's default/general subagent type with the persona prompt from the reference pasted inline. NEVER use an agent type registered by another plugin, even when its name matches the role (`*-correctness-reviewer`, `*-security-reviewer`, …) — a same-named agent carries a different contract (finding format, severity scale, report paths), silently breaks bee's synthesis rules, and makes the run depend on which plugins happen to be installed on this machine.

| Reviewer | Focus | Slot | Order |
|---|---|---|---|
| `code-quality` | correctness, readability, type safety | review | parallel |
| `architecture` | boundaries, coupling, API design, maintainability | review | parallel |
| `security` | auth, secrets, injection, permissions, data exposure | review | parallel |
| `test-coverage` | missing edge cases, regression paths, weak assertions | review | parallel |

Precedent arrives pre-loaded: planning's bootstrap owns the `docs/history/learnings/` search, and its hits land in `plan.md`, which every reviewer receives — no review-time precedent agent exists. Synthesis (§2) is the orchestrator's own work after all reviewers return, never a dispatched reviewer.

**The `review` slot (P16, decision 0021):** reviewers resolve `resolveTier(root, 'review', runtime)` — a dedicated, per-repo-editable model for review work, default `opus` on Claude (independent reviewer > self-review: the model that reviews should not be the model that implemented). A `null` review slot falls back to `generation`; a `{kind:'cli'}` value dispatches an external adversarial reviewer (e.g. GPT via codex CLI) as a **read-only gather**, resolved with the purpose-scoped 4-arg form `resolveTier(root, 'review', runtime, {for:'gather'})` through the Delegation contract's cli gather branch (`bee-hive/references/routing-and-contracts.md`) — a bare 3-arg resolve of a cli-shaped review slot now refuses (AO12/B1, plan 2A-ii). Conditional reviewers (below) use the same slot.

**Conditional reviewers** join the same parallel wave when the diff mechanically matches their trigger: `performance` (queries in loops, caching), `api-contract` (routes, public shapes), `data-migration` (spawn gate: migration/schema files only), `reliability` (retries, queues, external calls). Scan the diff once before dispatch; spawn every matched trigger; cap the wave at 6 (4 core + 2 conditionals — the cap tracks the roster). Trigger table and focus lines in `references/reviewing-reference.md`.

Full prompts in `references/reviewing-reference.md`.

## 2. Severity and Synthesis

- **P1** — security breach, data loss, breaking change, production blocker. Blocks session approval.
- **P2** — real performance, architecture, reliability, or important test gap.
- **P3** — cleanup, docs, future debt.

The orchestrator performs synthesis itself, only after every reviewer has returned — the old synthesis agent ran on the orchestrator's own model anyway, so dispatching it added a hop, not a mind.

Rules: uncertain → P2. Reviewers score independently; corroboration across independent reviewers promotes a finding one level. On disagreement, take the more conservative route. Every finding carries an `autofix_class` — `gated_auto` (concrete fix, apply after judgment), `manual` (needs design input), `advisory` (report-only) — as a routing SIGNAL, never an apply gate.

Finding format, in this order: plain-language summary → what the code does today → why it matters → concrete failure scenario → file/line evidence → smallest credible fix. Schema in the reference. Record every finding to the session: `node .bee/bin/bee.mjs reviews record --id <session-id> --kind finding --file <finding.json>`.

## 3. Verification-Evidence Gate

For every capped cell in scope with `behavior_change: true`, inspect the recorded `verification_evidence` in the cell trace. Missing or vague evidence ("tests pass", "should be covered") is itself a P1 finding — the work goes back; it does not pass forward.

This is now a **backstop, not the primary catch** (decision 0009): the cap helper already refuses a `behavior_change` cell without a "before" characterization (`red_failure_evidence`, or a `deliberate_exceptions` note for a genuinely new surface), and `bee.mjs reviews create`'s own preflight (Scope Freeze and Preview, step 2) already fails closed on missing evidence before this session could even exist — so an assertion-capped cell should not reach review at all. If one does, treat it as a double bypass and a P1. Do **not** raise a P1 whose only remedy is "record the missing before-state in a new evidence cell" — that backfill loop is exactly what cap-time and create-time enforcement exist to prevent; a real evidence gap means the behavior was never actually proven, which the worker fixes by re-verifying, not by writing a document. Read evidence from the cell trace — the single source — never from a parallel `reports/*-evidence.*` file.

**Frozen-judge flags (P12, decision 0018):** any cell the orchestrator flagged with judge hits — undeclared test/CI/lockfile/verify-config changes (`node .bee/bin/bee.mjs cells judge --id <id>`) — is reviewed assuming the judge was *moved*, not passed: diff each flagged file; verify no assertion weakened, no test skipped or deleted, no verify command softened, no dependency silently repinned. A weakened judge is a P1 (it invalidates the wave's evidence), never a cleanup note.

## 4. Artifact Verification

For everything CONTEXT.md and plan.md promised across every feature in scope, verify three levels:

- **EXISTS** — the artifact is present
- **SUBSTANTIVE** — not a stub, placeholder, TODO-only, fake static path, or empty handler
- **WIRED** — imported and used on the integration path

All three = OK. EXISTS + SUBSTANTIVE only = P2. Missing or EXISTS-only = P1.

## 5. Human UAT

Walk the user through every SEE/CALL/RUN decision in CONTEXT.md, for every feature in scope (wording in the reference). Failure → P1 fix cell + rerun the item. A skip requires its reason in the UAT item itself; record that session-local outcome with `node .bee/bin/bee.mjs reviews record --id <session-id> --kind uat --file <uat-item.json>`. Independent review owns no active routing state and never calls generic `state set`. UAT failures are never logged as passes.

## 6. Delta Re-Review (fix protocol, R9/A12)

After a P1 fix is capped:

1. Re-review the fix delta AND sweep the whole scope diff for the finding's defect class — not just the line that changed (critical pattern 20260711: grill deltas).
2. Record the resolution to the session: `node .bee/bin/bee.mjs reviews record --id <session-id> --kind finding --file <finding-update.json>`.
3. Do not re-run the full panel for the whole batch unless the fix crosses a scope boundary, changes a public contract, or destabilizes an assumption the rest of the scope relied on. When it does, propose the expanded re-review to the user rather than silently choosing either the minimal or the maximal option.
4. A concrete, localized P1 fix that stays inside its own boundary only needs its own delta re-reviewed and its defect class swept (A12) — it does not force a full-panel re-run for content that never changed.

## 7. Finishing

1. Run the project build/test/lint gates; quote fresh command output — never claim "passing" without it.
2. P2/P3 findings → `node .bee/bin/bee.mjs backlog add --type review-finding --severity P2|P3 --layer <layer> --title "<finding>" --feature <feature>` (plus grooming cells where warranted) with non-blocking traceability to the feature(s) in scope. They never block the current session.
3. If filing a residual finding anywhere fails, write it to `docs/history/<feature>/reports/residual-findings.md` so nothing evaporates.
4. Close the session: `node .bee/bin/bee.mjs reviews record --id <session-id> --kind decision --file decision.json` (status `pending`, `blocked`, or `approved`). This closes the REVIEW, not any feature — every feature in scope already reached its own close through execution → scribing → compounding independently (§11.1), and session closeout leaves that feature state untouched (7.5). Do not run `bee.mjs state set --phase ...` as if a review were a workflow phase transition for the covered features.

## Gate 4 (wording is fixed) — lives only inside a session

Gate 4 exists ONLY inside a review session (R8) — there is no "Gate 4" after a feature merely finishes execution, and no empty/automatic Gate 4. Present per the Gate Presentation Contract (bee-hive routing reference): plain-language layer in chat — what was built / what review found in plain words / consequence of merging now / what you are deciding — in the user's language, with full findings linked from `docs/history/<feature>/reports/`, never pasted as a findings table. Then verbatim:

- P1 > 0 → "P1 findings block merge. Fix before proceeding?"
- P1 = 0 → "Review complete. Approve merge?"

Never continue past open P1s without explicit user acknowledgment. Silence is not acknowledgment. A session stays `blocked` (A11) until every P1's fix and delta re-review (§6) pass.

`tiny` lane exception (Lane Scaling table): with a clean self-review, Gate 4 is the done-report inside `bee-swarming` — no merge question there, and that done-report is never itself an independent-review session.

**Gate bypass never covers session creation or approval (R8, decision 0010 boundary).** `.bee/config.json` `gate_bypass: true` NEVER creates or auto-approves a review session — a session only ever exists because a user explicitly requested one (Trigger, above). Once a session already exists and reaches its human UAT/merge question, the pre-existing bypass carve-out still applies unchanged: the §5 UAT items are always presented to the human, any P1 finding always stops, and bypass may auto-approve the **merge** question only when P1 = 0 **and** every UAT item was confirmed pass by the human — then record the review gate, log a one-line audit decision, and post a short `⚡ auto-approved merge (bypass)` line instead of asking. Any P1, or any UAT fail/skip, stops Gate 4 for the human as normal. Secret reads during review always require human approval regardless of bypass.

**No re-dispatch for an unchanged, already-approved range (R6/A7):** before creating a new session, check `node .bee/bin/bee.mjs reviews status` — a candidate already reporting `reviewed (covered by <review-id>)` for an unchanged range is not re-reviewed; only genuinely new or `review stale` delta gets a new session, unless the user explicitly asks for a re-review.

## Headless

`mode:headless` = report-only, and still requires the explicit Trigger before it starts a session at all: run all reviewers, both verification gates, and artifact checks; emit every finding in a structured terminal report with UAT items and ambiguous severities deferred to an `Outstanding Questions` section. Gate 4 still requires the human — headless never self-approves merge, and headless never invents a review request the user didn't make.

## Red Flags

- a full reviewer wave spawned for a small/single-change scope (Lane Scaling: small scope = one correctness reviewer)
- a reviewer dispatched before `bee.mjs reviews create` succeeded and the scope preview was shown
- a session created, or Gate 4 auto-approved, by gate bypass (bypass never creates or approves sessions)
- a finished cell/slice/feature, or the words "merge"/"ship"/"release" alone, treated as a review trigger
- a tiny defect waved through because "it's just the fast path" — the fast path never ships a known defect
- continuing past a P1 without explicit user acknowledgment
- UAT failure marked pass, or a skip without a recorded reason
- artifact verification skipped because "the cells are capped"
- a `behavior_change` cell accepted with vague verification evidence
- synthesis started before every reviewer returned
- P2/P3 filed as blocking work on the current session
- a full panel re-run for a scope that did not cross a boundary (§6) — or, conversely, a boundary-crossing fix re-reviewed only at the delta
- a reviewer dispatched with session history in its context
- a reviewer spawned as another plugin's registered agent type instead of the default type + inline persona
- "should work" accepted as evidence
- re-dispatching a full panel for a range `status` already reports as `reviewed (covered by <id>)` and unchanged

Violating the letter of these rules is violating the spirit of these rules.

## Handoff

Session complete: record the decision (`record --id <id> --kind decision --file decision.json`) and close the session — this closes the REVIEW, not the feature. Every feature in scope already went through its own execution → scribing → compounding close independently (§11.1); a review session is never a precondition for that chain, and closing one does not re-trigger it. For `standard`/`high-risk` scope, invoke `bee-briefing` in walkthrough mode to write `docs/history/<feature>/walkthrough.md` per feature in scope, as an audit artifact of what the session found. If a P1 fix inside the session settled new behavior worth documenting, that triggers `bee-scribing` under its own standing self-triggering rule (AGENTS.md rule 9) — because a decision settled, not as an automatic hop from this skill.

| Reference | When to Load |
|---|---|
| `references/reviewing-reference.md` | specialist prompts, finding/session-record schema, UAT wording, session-record checklist, delta re-review protocol |

exec
/bin/bash -lc "wc -l .agents/skills/bee-hive/references/routing-and-contracts.md .agents/skills/bee-reviewing/references/reviewing-reference.md && sed -n '1,500p' .agents/skills/bee-hive/references/routing-and-contracts.md && sed -n '1,420p' .agents/skills/bee-reviewing/references/reviewing-reference.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
  306 .agents/skills/bee-hive/references/routing-and-contracts.md
  166 .agents/skills/bee-reviewing/references/reviewing-reference.md
  472 total
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
# Reviewing Reference

Load after `bee-reviewing` is selected. Companion to SKILL.md — flow lives there; prompts, schemas, and checklists live here. Every record on this page lands on a review session (`.bee/reviews/<id>.json`) via `node .bee/bin/bee.mjs reviews record --id <id> --kind ...` — a session exists only after an explicit user request created it (SKILL.md Trigger + Scope Freeze and Preview).

## Specialist Dispatch

Isolation contract: each reviewer receives the session's cumulative diff (baseline..head, or the mapped multi-feature diff), `docs/history/<feature>/CONTEXT.md`, and `docs/history/<feature>/plan.md` for every feature in scope — nothing else, never session history. All reviewers run in parallel; the orchestrator synthesizes only after every one has returned (SKILL.md §2 — synthesis is orchestrator work, never a dispatched reviewer). Precedent is already in `plan.md` (planning's bootstrap owns the learnings search).

Common prompt shape:

```text
You are the <X> reviewer. Review only your focus area. Lead with findings.
For each: severity, file/line evidence, failure scenario, smallest credible fix.
Do not rewrite code.
```

Per-reviewer focus lines (append to the shape):

| Reviewer | Focus line |
|---|---|
| `code-quality` | Correctness, readability, type safety, error handling. Cite file/line evidence for every claim. |
| `architecture` | Boundaries, coupling, API design, maintainability, drift from plan.md structure. |
| `security` | Auth, authorization, secrets in code or logs, injection, permissions, data exposure. |
| `test-coverage` | Missing edge cases, regression paths, weak or tautological assertions, untested behavior changes. |

Tiers: specialists = the review slot (SKILL.md §1). Where the runtime cannot select per-agent models, fall back to read budgets and output caps.

Orchestrator synthesis (after all reviewers return): deduplicate overlaps, mark cross-reviewer corroboration (promotes one severity level), attach known-pattern notes from the precedent in `plan.md`, classify each finding's autofix_class, and present counts by severity.

## Conditional Reviewers (selected by diff analysis)

Before dispatch, scan the diff ONCE and spawn any conditional reviewer whose trigger matches, in the same parallel wave as the always-on four. Same isolation contract, same prompt shape, same review slot — only the focus line differs. Personas stay thin lens contracts: no failure-mode catalogs (the model already knows the domain; the trigger and the lens are the value).

| Reviewer | Spawn when the diff touches | Focus line |
|---|---|---|
| `performance` | ORM/query calls inside loops, caching layers, pagination, hot-path data access | Query patterns, N+1 exposure, cache correctness, unbounded result sets. Flag only measurable risks with the triggering code cited. |
| `api-contract` | routes, serializers, public response shapes, exported type signatures, versioned endpoints | Client-visible breaking changes, envelope drift, missing versioning, silent field removals — checked against locked decisions (D-ids). |
| `data-migration` | **spawn gate:** only if the diff includes migration files or schema definitions (`**/migrations/**`, `db/migrate/*`, `schema.*`, `*.sql` DDL) | Destructive DDL, backfills on large tables, NOT NULL without default, irreversibility, deploy-order coupling. |
| `reliability` | retries, timeouts, queues, background jobs, webhooks, external service calls | Failure paths: what happens on timeout, partial failure, replay, and double delivery. Missing idempotency and dead-letter handling. |

Rules:

- Triggers are mechanical — grep the diff's file paths and hunks; do not spawn on vibes, and do not skip a matched trigger to save time.
- Cap the wave at 6 reviewers total (4 core + 2 conditionals). If more triggers match, fold the extra lens into the closest always-on reviewer's focus line and say so in the synthesis.
- A `security` overlap (auth/payments/data-mutation files with ≥50 changed lines) is also the signal for the optional cross-model second opinion at Gate 4 (see 06-runtime-integration.md) — surface the option to the user; never auto-run it.

## Finding Schema

Every distinct issue becomes one finding:

```markdown
### [P<N>] <problem title>   (autofix_class: gated_auto | manual | advisory)

## Plain-Language Summary
<1-3 sentences a non-specialist understands>

## What The Code Does Today
- <current behavior, with source>

## Why This Is A Problem
- <requirement, locked decision (D-id), or invariant broken>

## Concrete Failure Scenario
- <realistic steps and the incorrect outcome>

## Evidence
File: `path`
Line(s): <line>
Snippet: <small relevant snippet>
Why this proves the issue: <one sentence>

## Proposed Fix
Recommended: <smallest credible fix>
Tradeoff: <if any>

## Acceptance Criteria
- [ ] <specific testable condition>
```

Synthesis rules recap: uncertain → P2; independent corroboration promotes one level; disagreement → the more conservative route; `autofix_class` routes work (gated_auto = concrete fix applied after orchestrator judgment; manual = needs design input; advisory = report-only) but never bypasses judgment or the gate.

## Review Cells and Backlog Routing

| Severity | Route | Blocking? |
|---|---|---|
| P1 | fix cell on the current feature (lane tiny/small; verify command required), then re-review the fix | yes — Gate 4 |
| P2 | `.bee/backlog.jsonl` entry; grooming cell if the fix is already concrete | no |
| P3 | `.bee/backlog.jsonl` entry | no |

Backlog entry format (one JSON object per line):

```json
{"ts":"<ISO>","type":"review-finding","feature":"<feature>","severity":"P2","title":"<problem title>","autofix_class":"manual","evidence":"<file:line one-liner>","predicted_impact":"<what it costs if left>","source":"reviewing"}
```

P2/P3 entries carry the feature name for traceability but must NOT be wired as blockers of the current work. If any filing write fails, append the full finding to `docs/history/<feature>/reports/residual-findings.md` — nothing evaporates.

## Session Record Checklist (SPEC §8)

A review session (`.bee/reviews/<id>.json`) minimally carries these fields — `create` writes the first eight at freeze time (SKILL.md, Scope Freeze and Preview); the rest fill in as the session progresses via `record`:

| Field | Set by | Notes |
|---|---|---|
| `id` | `create` | stable, never reused |
| `requested_by` / `requested_at` | `create` | proves this is a user request, and when |
| `scope_description` | `create` | how the user described the boundary |
| `included` | `create` (frozen, R5) | feature/cell/commit entries actually in scope |
| `excluded` | `create` (frozen, R5) | related work left out, with reason (e.g. "in progress", A6) |
| `baseline` / `head` | `create` (frozen, R5) | the two immutable diff endpoints |
| `reviewer_manifest` | `record --kind manifest` | reviewers, model/tier/executor actually dispatched |
| `verification_preflight` | `create`, then `record --kind preflight` if re-checked | evidence check result before reviewer spend (A10) |
| `findings` | `record --kind finding` (append) | severity, evidence, status, fix/re-review reference |
| `uat` | `record --kind uat` (append) | item, pass/fail/skip, skip reason |
| `decision` | `record --kind decision` | `pending`/`blocked`/`approved` + Gate 4 record |

`record` refuses any payload touching `baseline`/`head`/`included`/`excluded` — those four are frozen at `create` and no sub-record kind legitimately needs to touch them (R5). Before creating a new session for a scope that might already be covered, run `node .bee/bin/bee.mjs reviews status` — an unchanged range already reported `reviewed (covered by <id>)` is not re-reviewed (R6/A7).

## Delta Re-Review Protocol (R9/A12)

After a P1 fix caps:

1. Re-review the fix delta itself.
2. Sweep the whole scope diff for the finding's defect class — the same category of bug, anywhere else in scope, not just the line that changed (critical pattern 20260711: grill deltas).
3. Record the outcome: `node .bee/bin/bee.mjs reviews record --id <session-id> --kind finding --file <finding-update.json>` (status moves to resolved, with the fix's evidence).
4. Decide whether the fix stayed inside its own boundary:
   - **stayed inside** (localized fix, no public-contract change, no destabilized assumption elsewhere in scope) → only the delta + defect-class sweep is required; the full panel does not re-run (A12).
   - **crossed a boundary** (touches another feature's contract, changes a public/API shape, or invalidates an assumption the rest of the scope relied on) → propose an expanded re-review to the user; do not silently pick either the minimal or the maximal option.
5. A session stays `blocked` (A11) until every open P1's delta re-review passes.

## Verification-Evidence Gate (behavior_change cells)

For each capped cell with `behavior_change: true`, the trace's `verification_evidence` must name: tests inspected, tests added/changed, red-failure or characterization evidence, the verification run, and any deliberate exception. Missing field, or prose like "covered by existing tests" with no test named → P1 finding; the cell's work goes back.

## Human UAT

For each SEE/CALL/RUN decision in CONTEXT.md:

```text
UAT Item <i>/<n> - Decision <D-id>:
"<deliverable>"
Can you confirm this works? [Pass / Fail / Skip]
```

- Fail → create a P1 fix cell, then rerun this UAT item after the fix caps.
- Skip → record the user's reason in `.bee/state.json` before moving on.
- Intermittent failure is a Fail, not a Skip.

## Finishing Checklist

- [ ] all P1 fix cells capped and their findings re-verified (delta re-review + defect-class sweep, R9/A12)
- [ ] project build/test/lint gates run, fresh output quoted
- [ ] P2/P3 → backlog entries (+ grooming cells where concrete), non-blocking
- [ ] residual-findings fallback written if any filing failed
- [ ] UAT results (and skip reasons) recorded on the session (`record --kind uat`) and in `.bee/state.json` where a skip reason is needed
- [ ] session closeout: `node .bee/bin/bee.mjs reviews record --id <session-id> --kind decision --file decision.json` (`pending`/`blocked`/`approved`) — this closes the SESSION, not a workflow phase; every covered feature already reached its own close via execution → scribing → compounding independently, and that feature state is left untouched (7.5). Do not set `next_action: "Invoke bee-compounding."` here — there is no automatic chain hop out of a review session.

## Red Flags

- P1 passed on user silence
- UAT failure logged as pass, or skip without reason
- artifact verification skipped
- synthesis started before every reviewer returned
- P2/P3 blocking the current session
- findings dropped because a write failed (use residual-findings.md)
- a session closeout that sets `next_action: "Invoke bee-compounding."` as if review were a chain stage a feature must pass through
- a new session created for a range `bee.mjs reviews status` already reports `reviewed (covered by <id>)` and unchanged

exec
/bin/bash -lc "sed -n '180,340p' .agents/skills/bee-hive/references/routing-and-contracts.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
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

codex
The evidence spans the plan, four work-unit definitions, prior advisor digest, and the affected onboarding/release/test code. Per the repository’s delegation contract, I’m offloading that mechanical file gather to one read-only I/O worker; I’ll keep the sufficiency judgment and verdict here.
collab: Wait
codex
The gather is still running. While it finishes, I’m checking the immutable workspace boundary and current planning state directly so the final verdict doesn’t accidentally rely on stale or uncommitted scope assumptions.
exec
/bin/bash -lc "git status --short && git branch --show-current && git rev-parse --short HEAD && sed -n '1,220p' .bee/state.json" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
 M .bee/backlog.jsonl
 M .bee/decisions.jsonl
 M docs/specs/hook-runtime.md
 M docs/specs/reading-map.md
?? .bee/cells/cnr2-1.json
?? .bee/cells/cnr2-10.json
?? .bee/cells/cnr2-11.json
?? .bee/cells/cnr2-12.json
?? .bee/cells/cnr2-3.json
?? .bee/cells/cnr2-4.json
?? .bee/cells/cnr2-7.json
?? .bee/cells/cnr2-9.json
?? docs/REFs/be-codex.md
?? docs/history/codex-native-runtime-v2/CONTEXT.md
?? docs/history/codex-native-runtime-v2/approach.md
?? docs/history/codex-native-runtime-v2/implement-plan.md
?? docs/history/codex-native-runtime-v2/plan.md
?? docs/history/codex-native-runtime-v2/reports/advisor-bundle-s2.md
?? docs/history/codex-native-runtime-v2/reports/advisor-bundle-s3.md
?? docs/history/codex-native-runtime-v2/reports/advisor-bundle-s3r2.md
?? docs/history/codex-native-runtime-v2/reports/advisor-bundle.md
?? docs/history/codex-native-runtime-v2/reports/advisor-digest-s2.md
?? docs/history/codex-native-runtime-v2/reports/advisor-digest-s3.md
?? docs/history/codex-native-runtime-v2/reports/advisor-digest-s3r2.md
?? docs/history/codex-native-runtime-v2/reports/advisor-digest.md
?? docs/history/codex-native-runtime-v2/reports/cnr2-1.md
?? docs/history/codex-native-runtime-v2/reports/cnr2-4.md
?? docs/history/codex-native-runtime-v2/reports/cnr2-5.md
?? docs/history/codex-native-runtime-v2/reports/cnr2-8.md
?? docs/history/codex-native-runtime-v2/reports/validation-s1s2.md
?? docs/history/codex-native-runtime-v2/reports/validation-slice2.md
main
02c323c
{
  "schema_version": "1.0",
  "phase": "planning",
  "feature": "codex-native-runtime-v2",
  "mode": "high-risk",
  "approved_gates": {
    "context": true,
    "shape": true,
    "execution": false,
    "review": false
  },
  "workers": [
    {
      "nickname": "kevin",
      "cell": "cnr2-1",
      "tier": "generation",
      "status": "done"
    },
    {
      "nickname": "stuart",
      "cell": "cnr2-5",
      "tier": "generation",
      "status": "done"
    },
    {
      "nickname": "bob",
      "cell": "cnr2-4",
      "tier": "ceiling",
      "status": "done"
    },
    {
      "nickname": "dave",
      "cell": "cnr2-2",
      "tier": "generation",
      "status": "done"
    },
    {
      "nickname": "mel",
      "cell": "cnr2-7",
      "tier": "generation",
      "status": "done"
    },
    {
      "nickname": "otto",
      "cell": "cnr2-6",
      "tier": "generation",
      "status": "done"
    },
    {
      "nickname": "norbert",
      "cell": "cnr2-8",
      "tier": "ceiling",
      "status": "done"
    }
  ],
  "summary": "Slice 2 complete (cnr2-6/7/8 capped + spec sync). Planning slice 3 = S5 adapter split via inline runtime blocks",
  "next_action": "Shape slice-3 cells, validate, re-approve Gate 3",
  "last_scribing_run": {
    "feature": "codex-native-runtime-v2",
    "date": "2026-07-18",
    "at": "2026-07-18T04:52:14.526Z",
    "areas_synced": [
      "hook-runtime"
    ],
    "next_action": "S3+S4 slice planning"
  },
  "last_compounding_run": {
    "feature": "dispatch-log",
    "at": "2026-07-11T07:40:00.000Z",
    "learnings": "docs/history/learnings/20260711-dispatch-log.md",
    "critical_promotions": 0,
    "decisions_logged": 1,
    "friction_filed": 2,
    "digest_refresh": "green (50 entries; 17 unknown_type drops pre-existing class)"
  },
  "cells": {
    "open": 5,
    "claimed": 0,
    "capped": 267,
    "blocked": 0
  },
  "last_activity": "2026-07-18T07:34:34.429Z",
  "advisor_ref": {
    "consulted_at": "2026-07-18T05:04:06.032Z",
    "feature": "codex-native-runtime-v2",
    "newest_decision_id": "5cf792cb-2bc4-4e05-bcaf-1b8b8496c35d",
    "plan_sha256": "aee84381c8966ee68529ed95739f7808e8647b8dbed1a64f0924213ddaffb1f7",
    "advisor": "codex/gpt-5.6-sol (cli, read-only, reasoning high)",
    "digest_head": "OpenAI Codex v0.144.4\n--------\nworkdir: /home/thanhsmind/projects/goglbe/beegog\nmodel: gpt-5.6-sol\nprovider: openai\napproval: never\nsandbox: read-only\nreasoning effort: high\nreasoning summaries: none\nsession id: 019f7393-dbd4-7750-acbe-840e3d62a4b7\n--------\nuser\n# Advisor evidence bundle — codex-native-runtime-v2, slice 2 (pre-Gate-3 consult)\n\nYou are a read-only advisor. Assess feasibility and risk. Do NOT approve anything; return numbered findings + verdict (PROCEED / PROCEED-WITH-CHANGES / RE"
  },
  "gate_revoked_at": {
    "execution": "2026-07-18T05:32:24.146Z"
  }
}

collab: Wait
codex
The read-only gather is still active and has not reported an error. I’ve finished the local scope checks; next I’m waiting for its anchored evidence digest, then I’ll synthesize the residual-risk verdict.
collab: Wait
codex
The gather remains live; I’ve narrowed it to the one potentially load-bearing sequencing issue: whether runtime-specific plugin projections are generated only after both tagging changes, without parallel ownership collisions. I’ll base the verdict on the actual cell dependencies and file scopes.
collab: Wait
codex
The evidence worker is still reading, not stalled or failed. The next action is unchanged: collect its concise anchored digest and issue the verdict; I’m not expanding the audit or touching repository state.
collab: Wait
codex
The audit has already surfaced three concrete residuals: unresolved plugin packaging topology, parallel full-tree render ownership, and a remaining vacuous bare-token check. I’m waiting only for the worker’s final cross-check that no other artifact resolves them before I lock the verdict.
collab: Wait
codex
The worker is still live, and the three issues remain unrefuted. Next I’m taking its final response; if it finds no hidden topology proof, the appropriate verdict is return to planning because cell 12 still delegates a slice-level architecture decision to implementation.
collab: Wait
codex
Residual blockers remain:

1. Plugin topology is still delegated to implementation (“committed trees or package-time rendering”) with no proven manifest/install layout. [cnr2-12.json](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/cnr2-12.json:27)

2. `cnr2-10` and `cnr2-11` can run in parallel but both regenerate the same full trees, whose paths are absent from their file scopes. Serialize them and assign one final-render owner.

3. “A projection may sync its own runtime” lacks target-filter semantics; onboarding currently evaluates both targets and one refusal blocks the whole apply.

4. `cnr2-10` says phrase-level checks, but its verify still bans bare `spawn_agent`/`wait_agent` tokens. [cnr2-10.json](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/cnr2-10.json:44)

5. The truth artifacts remain inconsistent: `plan.md` omits `cnr2-12` from the slice and still labels plugin pre-render as follow-up. [plan.md](/home/thanhsmind/projects/goglbe/beegog/docs/history/codex-native-runtime-v2/plan.md:38)

**Verdict: RETURN-TO-PLANNING**
hook: Stop
hook: Stop
hook: Stop Completed
hook: Stop Completed
tokens used
76,821
Residual blockers remain:

1. Plugin topology is still delegated to implementation (“committed trees or package-time rendering”) with no proven manifest/install layout. [cnr2-12.json](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/cnr2-12.json:27)

2. `cnr2-10` and `cnr2-11` can run in parallel but both regenerate the same full trees, whose paths are absent from their file scopes. Serialize them and assign one final-render owner.

3. “A projection may sync its own runtime” lacks target-filter semantics; onboarding currently evaluates both targets and one refusal blocks the whole apply.

4. `cnr2-10` says phrase-level checks, but its verify still bans bare `spawn_agent`/`wait_agent` tokens. [cnr2-10.json](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/cnr2-10.json:44)

5. The truth artifacts remain inconsistent: `plan.md` omits `cnr2-12` from the slice and still labels plugin pre-render as follow-up. [plan.md](/home/thanhsmind/projects/goglbe/beegog/docs/history/codex-native-runtime-v2/plan.md:38)

**Verdict: RETURN-TO-PLANNING**
