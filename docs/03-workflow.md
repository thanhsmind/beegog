# 03 — Workflow Contract

The bee chain, stage by stage: what each skill reads, writes, and must never do. This is the normative spec that the SKILL.md files implement.

## The chain and the four gates

```
bee-hive
  -> bee-exploring                          [GATE 1] approve CONTEXT.md
  -> bee-planning (shape)                   [GATE 2] approve work shape
  -> bee-planning (current-work prep)
  -> bee-validating                         [GATE 3] approve execution
  -> bee-swarming (+ bee-executing × N)
  -> more approved work remains? -> back to planning for the next slice
  -> bee-reviewing                          [GATE 4] P1s block; else approve merge
  -> bee-compounding
  (on demand, any time the hive is idle) bee-grooming
```

Gate wording (fixed, from khuym):

- **Gate 1:** "Decisions locked. Approve CONTEXT.md before planning?"
- **Gate 2:** "Work shape is ready. Approve before current-work preparation?"
- **Gate 3:** "Feasibility validated. Approve execution?"
- **Gate 4:** P1 > 0 → "P1 findings block merge. Fix before proceeding?" ; P1 = 0 → "Review complete. Approve merge?"

Optional at Gates 2–4: a **cross-model second opinion** (gstack). If the other runtime's model is available, ask it to challenge the artifact. Agreement → mention it. Disagreement → quote both positions to the user. Never auto-resolve.

## Priority rules (hive law)

1. P1 review findings always block.
2. Context budget always applies; at ~65%, write `.bee/HANDOFF.json` and pause.
3. `CONTEXT.md` is the source of truth; locked decisions are cited, never reinterpreted.
4. Gate 3 is the critical execution approval; no source-editing execution before it.
5. A failed reality gate or a NO spike halts the pipeline and returns to planning.
6. Never skip validating — including in tiny mode (it collapses to a 2-minute reality check, it does not disappear).
7. `docs/history/learnings/critical-patterns.md` and recent active decisions (`bee_decisions.mjs active --recent 3`) are mandatory context before planning or executing.
8. Evidence before claims: any "done/passing/fixed" statement requires fresh command output in the same message.

## Modes and lanes (the mode gate)

Every planning pass starts by classifying the work. Classification is **mechanical**, using repository-harness risk flags:

> Flags: auth · authorization · data model · audit/security · external systems · public contracts · cross-platform · existing covered behavior · weak proof around the area · multi-domain

| Mode | Trigger | Workflow |
|---|---|---|
| `tiny` | 0–1 flags, ≤2 files, no API/data change, one direct task | one cell → single worker → lightweight review → compound only if a lesson emerged |
| `spike` | one yes/no proof decides whether the plan is real | spike cell in `.spikes/` → answer → return to planning |
| `small` | 0–1 flags, ≤3 files, no gray areas | light plan (one shape note) → validating reality gate → single worker → light review |
| `standard` | 2–3 flags, or story-sized behavior | full chain; phase plan or epic map, whichever explains the work honestly |
| `high-risk` | 4+ flags **or any hard-gate flag** (auth, authorization, data loss, audit/security, external provider, validation removal) | epic map → current-story pack → mandatory feasibility spikes → slower Gate 3 → detailed traces |

Rule of use: **the least workflow that honestly protects the work**. A tiny fix that spawns epic ceremony is a red flag; a hard-gate change routed as `small` is a worse one.

## Stage contracts

### bee-hive (bootstrap & routing)

- **On every session start / after compaction:** verify onboarding (`.bee/onboarding.json`), run `node .bee/bin/bee_status.mjs --json`, surface `HANDOFF.json` if present and **wait**, read `critical-patterns.md`, surface recent active decisions.
- **Routing:** vague/new feature → exploring; clear-scope research → planning; small fix → planning in tiny/small mode; review request → reviewing; "clean up / debt / audit" → grooming; capture learnings → compounding; improve bee → bee-writing-skills; `/go` → go mode (full chain with the four gates).
- **Surface scope earlier** (compound-engineering): if the request already contains concrete acceptance criteria *and* references to existing patterns, offer to skip exploring — "Found clear requirements. Jump straight to planning, or explore alternatives first?" — and on approval route to planning with a one-paragraph scoping synthesis in place of CONTEXT.md gray-area work (the decisions still get D-IDs).
- **Scout contract (just-enough reading):** phase × lane matrix with token budgets — tiny ≈ 2K tokens of harness context, standard ≈ 5K, high-risk ≈ 10K. Retrieval triggers, not reading lists: "touching schema → read schema decisions first", "touching auth → read auth decisions + high-risk template".
- **Never:** auto-resume a handoff, skip a gate, or let a stage start with stale onboarding.

### bee-exploring (scout bees)

- **Reads:** user conversation, critical-patterns, a *quick scout only* (`rg` keyword pass + 2–3 files, cited in questions).
- **Does:** classify scope and domain types (SEE/CALL/RUN/READ/ORGANIZE); generate 2–4 gray areas that would otherwise make planning guess; Socratic locking — **one question per message**, preferably single-choice, outcome-framed ("what breaks for users if…"); assign stable IDs D1, D2…; scope creep → mark deferred and return.
- **Writes:** `docs/history/<feature>/CONTEXT.md` — boundary, domain types, locked decisions, deferred ideas, scout paths. Concrete language; no placeholders. One fresh-eyes reviewer pass (max two loops).
- **Never:** research implementation, propose architecture, create cells, write code, bundle questions, answer its own question.
- **Handoff:** Gate 1 → "Invoke bee-planning."

### bee-planning (the waggle dance)

- **Reads:** CONTEXT.md, critical-patterns, active decisions, bee_status scout.
- **Does:**
  1. **Discovery** at the right research level (gsd): L0 skip / L1 quick verify / L2 standard (2–3 options) / L3 deep dive — using the three-layers framing (tried-and-true, new-and-popular, first-principles).
  2. **Mode gate** (mechanical flags, above).
  3. **Synthesis:** `approach.md` — chosen path, risks, proof needs, files, questions for validating.
  4. **Shape:** write `plan.md` (`artifact_readiness: requirements-only`) — direct note / spike question / small plan / phase plan / epic map. **Stop at Gate 2.**
  5. **Prep (after approval):** enrich the *same* `plan.md` to `artifact_readiness: implementation-ready` and create cells for the *current* slice only. Cells are executable prompts: files, read-first, directive action citing D-IDs, `must_haves`, verify command. Every cell that changes observable behavior is marked `behavior_change: true`. Future-slice cells are prohibited.
- **Quality rules:** no scope reduction of locked decisions (SPLIT instead); no pseudo-cells in markdown; every cell has a testable exit; test matrix informed by the 12 edge dimensions (claudekit) at a depth matching the lane.
- **Handoff:** "Invoke bee-validating."

### bee-validating (guard bees)

- **Reads:** CONTEXT.md, discovery, approach, approved shape, current-work cells.
- **Does:**
  1. **Reality gate:** MODE FIT / REPO FIT / ASSUMPTIONS / SMALLER PATH / PROOF SURFACE, each PASS|FAIL with file/command evidence. Fails on nonexistent code paths, unsupported commands, stale versions, missing credentials, hidden architecture work, or excess ceremony.
  2. **Feasibility matrix:** every blocking assumption → proof required → evidence → result. Accepted evidence: existing code, inspection, command output, build/test result, official version proof, runtime probe, or `.spikes/` result. "Should work", "likely", model knowledge → NOT READY.
  3. **Spikes:** one spike = one yes/no question; disposable code in `.spikes/<feature>/`; NO → back to planning with the failed assumption; YES → record constraints. Spike code never silently becomes production code.
  4. **Plan-checker subagent** (adversarial, gsd): assume the plan is flawed; verify 5 dimensions — requirement/decision coverage, cell completeness, dependency correctness, key links, scope sanity. Every finding carries BLOCKER or WARNING. Max 3 structural iterations, then escalate. In the high-risk lane, scale to a small persona panel (compound-engineering): coherence + feasibility always, plus conditional lenses (security, product, scope-guardian) chosen by the diff of concerns — findings deduped and synthesized into auto-fix vs present-for-decision buckets.
  5. **Cell review:** can each cell be picked up cold? CRITICAL flags (assumed context, vague acceptance, scope overload, unproven feasibility, broken verify) must be fixed.
- **Decision vocabulary:** READY / READY WITH CONSTRAINTS / NOT READY – RUN SPIKE / NOT READY – RETURN TO PLANNING.
- **Handoff:** Gate 3 → "Invoke bee-swarming." Approval covers the current work only.

### bee-swarming (orchestrator)

- **Preconditions:** Gate 3 approved; cells open and validated; reservations swept.
- **Does:** wave analysis over the cell dependency graph (parallel within a wave, sequential across waves); assign exactly one cell per worker; spawn with the isolation contract — cell id, CONTEXT.md path, global constraints, reservation identity, status-token protocol, **nothing else, never session history**; pick the worker model by declared tier (compound-engineering): `extraction` = cheapest capable (retrieval, mechanical edits), `generation` = mid (implementation, test writing), `ceiling` = the orchestrator's own model (integration, architecture, final review) — state the model explicitly, and where the runtime can't select per-agent models, fall back to read budgets and output caps; record workers in `state.json`; tend results; rescue or re-dispatch `[BLOCKED]` with more context or a stronger tier; write HANDOFF at ~65% context.
- **Never:** implement cells itself; let workers self-select; resolve file conflicts by "being careful" (fix reservations or cell scope instead); send routine mid-flight pings (silence is not failure).
- **Handoff:** phase clean → next planning slice, or final slice done → "Invoke bee-reviewing."

### bee-executing (worker bee)

Loop: **Initialize → Accept assigned cell → Reserve → Implement → Verify → Cap → Release → Return.**

- Initialize: read AGENTS.md, bee_status, CONTEXT.md, the cell (`bee_cells.mjs show <id>`).
- Reserve every file/glob before writing; conflict → `[BLOCKED]`.
- Implement: read before editing; match existing patterns and locked decisions; no stubs, TODO-placeholders, or dead code. **Deviation rules (gsd):** auto-fix bugs / missing critical functionality / blocking issues; STOP and report for architectural changes; package installs always checkpoint.
- Verify: run the cell's verify command exactly; diff-aware test mapping where the project suite is big (claudekit); two serious failures → `[BLOCKED]` with command, failure summary, diagnosis.
- Cap: `bee_cells.mjs cap <id>` (refuses without a recorded verify pass); one commit per cell with the cell id; record the lane-tier trace (outcome, files, deviations, friction if a trigger fired); if the cell is marked `behavior_change: true`, the trace must include structured `verification_evidence` — tests inspected, tests added/changed, red-failure or characterization evidence, verification run, any deliberate exception (compound-engineering); release reservations.
- Return exactly one of `[DONE] [BLOCKED] [HANDOFF] [NOOP]` plus a report file in `docs/history/<feature>/reports/`.
- **Never:** edit outside reserved scope, handle multiple cells, wait silently, cap without verification.

### bee-reviewing (inspector bees)

- **Does:**
  1. Dispatch specialist reviewers with isolated context (diff + CONTEXT.md + plan.md only): `code-quality`, `architecture`, `security`, `test-coverage` in parallel; `learnings-researcher` searches `docs/history/learnings/` for precedent related to the touched modules (compound-engineering); `learnings-synthesizer` runs after all of them.
  2. Findings → severity P1 (security/data-loss/breaking/blocker — blocks merge), P2 (real perf/architecture/reliability/test gap), P3 (cleanup/docs/future debt). Uncertain → P2. **Synthesis rules** (compound-engineering): reviewers score independently; corroboration across independent reviewers promotes a finding one level; each finding carries an `autofix_class` — `gated_auto` (concrete fix, apply after judgment), `manual` (needs design input), `advisory` (report-only) — as routing *signal, not an apply gate*; on disagreement take the more conservative route. Each finding: plain-language summary, what the code does today, why it matters, concrete failure scenario, file/line evidence, smallest credible fix.
  3. **Verification-evidence gate:** for any capped cell with `behavior_change: true`, check the recorded `verification_evidence`; missing or vague evidence is itself a P1 finding — the work goes back, it does not pass forward.
  4. **Artifact verification** for everything CONTEXT.md/plan.md promised: EXISTS → SUBSTANTIVE (no stub/TODO/fake path) → WIRED (imported and used on the integration path). All three = OK; EXISTS+SUBSTANTIVE = P2; missing or EXISTS-only = P1.
  5. **Human UAT** walk-through for SEE/CALL/RUN decisions; failure → P1 fix cell and re-run; skip requires a recorded reason.
  6. Finish: project build/test/lint gates; P2/P3 → backlog/grooming cells with traceability (never blocking the current epic); if filing a residual finding anywhere fails, write it to `docs/history/<feature>/reports/residual-findings.md` so nothing evaporates; close out state.
- **Handoff:** Gate 4 → "Invoke bee-compounding."

### bee-compounding (honey)

- **Reads:** feature history, cells and traces, review findings, commit history. Missing artifacts → session summary + git diff; never fabricate.
- **Does:** three parallel analysis subagents — pattern extractor, decision analyst, failure analyst; orchestrator synthesizes (subagents never write durable files); write one dated `docs/history/learnings/YYYYMMDD-<slug>.md` (what happened / root cause / imperative future rule); promote only genuinely critical, cross-feature lessons to `critical-patterns.md`; log durable decisions to `bee_decisions.mjs log` (with rationale + alternatives); file unresolved friction into `.bee/backlog.jsonl` with predicted impact.
- **Never:** skip compounding for meaningful work; promote everything as critical; write "test more carefully"-grade advice.

### bee-grooming (undertaker bees) — on demand

- **Audit:** compute the entropy score (orphaned cells ×10, unverified cells ×5, stale decisions ×5, backlog-without-outcome ×2, stale work ×3, broken tools ×8; cap 100) and report the trend.
- **Hunt:** cluster friction from traces and backlog; scan for dead code, unused exports, stale docs vs code, TODO/stub debris, unverified verify-commands, superseded-but-cited decisions; slop-pattern pass on recent diffs (gstack).
- **Propose:** each kill candidate becomes a backlog item with pain, predicted impact, and risk lane — presented for approval (grooming never deletes on its own initiative).
- **Execute:** approved kills run as tiny/small cells through the normal worker loop (reservation, verify, cap).
- **Close the loop:** record actual outcome against the prediction; feed durable lessons to compounding.

### bee-writing-skills (comb building)

Carried from khuym/superpowers nearly verbatim — see [04-skills-spec.md](04-skills-spec.md#skill-writing-discipline). The Iron Law: **no skill (or skill edit) without a failing pressure test first.**

## Red flags (chain-wide)

- jumping from exploring to swarming · code before CONTEXT.md exists · skipping validating · ignoring locked decisions · workers self-selecting cells · capping without verification · commits without cell ids · continuing past open P1s · reservation leaks · stale state.json after a phase transition · resuming without surfacing HANDOFF.json · plausibility language ("should work") accepted as evidence · a tiny fix wearing epic ceremony · a hard-gate change routed below high-risk · session history pasted into a worker dispatch
