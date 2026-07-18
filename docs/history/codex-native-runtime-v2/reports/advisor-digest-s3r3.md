OpenAI Codex v0.144.4
--------
workdir: /home/thanhsmind/projects/goglbe/beegog
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 019f742d-cfa9-7271-ba4e-f1f8cac26c63
--------
user
# Advisor re-consult — codex-native-runtime-v2, slice 3 rev3 (terse residual check)

You returned 5 residuals on rev2 (digest advisor-digest-s3r2.md). All are now resolved as LOCKED decisions + cell text (decision log + plan.md + cells cnr2-9/10/11/12 updated):

1. Plugin topology LOCKED, not delegated: committed rendered trees — `.claude-plugin/skills/ = render(canonical, claude)`, `.codex-plugin/skills/ = render(canonical, codex)` — manifests repointed, release inventory covers them, test_plugin_distribution pins tree == render(canonical) recomputed at test time. Package-time rendering explicitly rejected.
2. cnr2-10 → cnr2-11 serialized; cnr2-11 is the sole final-render owner with all four rendered-tree roots in its file scope; cnr2-10 renders only transiently for its own verify.
3. Provenance simplified: a rendered projection is refused as an onboarding source for ANY target (own runtime included); canonical or plugin source required. No target-filter semantics introduced.
4. Verify consistency: token-level bans retained ONLY on claude rendered copies (valid because who-must-act attribution + contrast-note relocation empties spawn_agent/wait_agent tokens there); codex copies use phrase-level rules (pinned `subagent_type: "bee-` types, `.claude/agents`, `claude -p`) and legitimately retain the bare subagent_type token in the AO11 note. Prohibition reworded to match.
5. plan.md current-slice section now lists all four cells with the serialized order and drops the stale follow-up line.

Question: any remaining blocker? Terse numbered residuals + verdict (PROCEED / PROCEED-WITH-CHANGES / RETURN-TO-PLANNING) only — do not re-derive the full analysis.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
hook: SessionStart
hook: SessionStart
hook: SessionStart Completed
hook: SessionStart Completed
hook: UserPromptSubmit
hook: UserPromptSubmit Completed
codex
I’m using `bee-hive` to load the active slice and its locked decisions, then I’ll run a narrow residual-only consistency check against the five claimed repairs.
exec
/bin/bash -lc "sed -n '1,260p' .agents/skills/bee-hive/SKILL.md && node .bee/bin/bee.mjs status --json" in /home/thanhsmind/projects/goglbe/beegog
 exited 1 in 132ms:
node:fs:2413
    return binding.writeFileUtf8(
                   ^

Error: EROFS: read-only file system, open '/home/thanhsmind/projects/goglbe/beegog/.bee/cache/manifest-hash.json.2-0-be8d15dc.tmp'
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
  path: '/home/thanhsmind/projects/goglbe/beegog/.bee/cache/manifest-hash.json.2-0-be8d15dc.tmp'
}

Node.js v24.14.1

codex
The repository status helper is blocked by the read-only workspace because it refreshes a cache file; the supplied session state is still current. I’m continuing read-only and applying the repository’s independent-review rules to the plan artifacts.
exec
/bin/bash -lc "sed -n '1,320p' .agents/skills/bee-reviewing/SKILL.md && sed -n '1,320p' .agents/skills/bee-hive/references/routing-and-contracts.md && sed -n '1,240p' docs/history/learnings/critical-patterns.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
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

exec
/bin/bash -lc 'wc -l .agents/skills/bee-reviewing/SKILL.md .agents/skills/bee-hive/references/routing-and-contracts.md docs/history/learnings/critical-patterns.md' in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
  208 .agents/skills/bee-reviewing/SKILL.md
  306 .agents/skills/bee-hive/references/routing-and-contracts.md
  536 docs/history/learnings/critical-patterns.md
 1050 total

exec
/bin/bash -lc "sed -n '1,208p' .agents/skills/bee-reviewing/SKILL.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
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
/bin/bash -lc "sed -n '1,180p' .agents/skills/bee-hive/references/routing-and-contracts.md && sed -n '181,360p' .agents/skills/bee-hive/references/routing-and-contracts.md" in /home/thanhsmind/projects/goglbe/beegog
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
/bin/bash -lc "sed -n '1,180p' docs/history/learnings/critical-patterns.md" in /home/thanhsmind/projects/goglbe/beegog
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

exec
/bin/bash -lc "sed -n '181,360p' docs/history/learnings/critical-patterns.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
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

exec
/bin/bash -lc "sed -n '361,536p' docs/history/learnings/critical-patterns.md" in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 0ms:
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

codex
The residual check spans the plan, four work units, the prior advisor digest, and the locked decision. I’m delegating that mechanical cross-file consistency scan so the final judgment stays focused and independent.
collab: Wait
codex
The delegated scan is still running. Meanwhile I’m checking that the review target is stable and that the revised artifacts have no basic structural or whitespace defects before I accept its digest.
exec
/bin/bash -lc 'git status --short && git diff --check && test ! -e .bee/HANDOFF.json; printf '"'%s\\n' \"handoff_absent="'$?"' in /home/thanhsmind/projects/goglbe/beegog
 succeeded in 110ms:
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
?? docs/history/codex-native-runtime-v2/reports/advisor-bundle-s3r3.md
?? docs/history/codex-native-runtime-v2/reports/advisor-bundle.md
?? docs/history/codex-native-runtime-v2/reports/advisor-digest-s2.md
?? docs/history/codex-native-runtime-v2/reports/advisor-digest-s3.md
?? docs/history/codex-native-runtime-v2/reports/advisor-digest-s3r2.md
?? docs/history/codex-native-runtime-v2/reports/advisor-digest-s3r3.md
?? docs/history/codex-native-runtime-v2/reports/advisor-digest.md
?? docs/history/codex-native-runtime-v2/reports/cnr2-1.md
?? docs/history/codex-native-runtime-v2/reports/cnr2-4.md
?? docs/history/codex-native-runtime-v2/reports/cnr2-5.md
?? docs/history/codex-native-runtime-v2/reports/cnr2-8.md
?? docs/history/codex-native-runtime-v2/reports/validation-s1s2.md
?? docs/history/codex-native-runtime-v2/reports/validation-slice2.md
handoff_absent=0

collab: Wait
codex
1. Provenance contradiction remains: `cnr2-9` permits own-runtime projection resync and `cnr2-11` mentions only cross-runtime refusal, violating the locked “refuse rendered projections for ANY target” rule. `.bee/cells/cnr2-9.json:27`, `.bee/cells/cnr2-9.json:33`, `.bee/cells/cnr2-11.json:27`

2. Render ownership remains ambiguous: `cnr2-10` commands re-rendering managed/plugin trees despite its transient-only clause and `cnr2-11` being sole final-render owner. `.bee/cells/cnr2-10.json:27`, `.bee/cells/cnr2-10.json:41`

**RETURN-TO-PLANNING**
hook: Stop
hook: Stop
hook: Stop Completed
hook: Stop Completed
tokens used
65,795
1. Provenance contradiction remains: `cnr2-9` permits own-runtime projection resync and `cnr2-11` mentions only cross-runtime refusal, violating the locked “refuse rendered projections for ANY target” rule. `.bee/cells/cnr2-9.json:27`, `.bee/cells/cnr2-9.json:33`, `.bee/cells/cnr2-11.json:27`

2. Render ownership remains ambiguous: `cnr2-10` commands re-rendering managed/plugin trees despite its transient-only clause and `cnr2-11` being sole final-render owner. `.bee/cells/cnr2-10.json:27`, `.bee/cells/cnr2-10.json:41`

**RETURN-TO-PLANNING**
