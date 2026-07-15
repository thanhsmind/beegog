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

### Gate bypass mode (opt-in autopilot, decision 0010)

Off by default. Turned on with the `bee-bypass-gate` skill, which sets `.bee/config.json` `gate_bypass: true` (persistent per-repo). When it is on, the agent does **not** stop at a bypassable gate — it takes the RECOMMENDATION option itself and continues. This is the one deliberate exception to "gates are never self-approved"; **headless mode is not** — headless still stops at every gate.

When `config.gate_bypass` is `true`, at **Gate 1, 2, or 3**:

1. **Safety floor — check first, and it is absolute.** If the feature's lane is `high-risk`, or the work carries any hard-gate flag (auth · authorization · data loss · audit/security · external provider · validation removal · database migration/schema change), the gate is **NOT** bypassed. Present it to the human normally, exactly as if bypass were off. Bypass covers only `tiny`/`small`/`standard` non-hard-gate work.
2. Otherwise, do not ask. Instead: select the option the RECOMMENDATION favors; set `approved_gates.<gate>` in `.bee/state.json` (same write the human's "yes" would trigger); still write the machine-layer report to `docs/history/<feature>/reports/`; log a one-line audit entry — `node .bee/bin/bee.mjs decisions log --decision "auto-approved Gate N (bypass): <choice>" --rationale "<the recommendation's why>"` — so the approval is never silent; then post a **short chat line** (not a question) — `⚡ auto-approved Gate N (bypass): <what/why in one plain sentence>` — and continue. The human sees what happened and can still interrupt.

**Gate 4 is never fully bypassed, and bypass never creates a review session (SPEC R8, decision 565e68d0).** Gate 4 only exists once the user has explicitly invoked `bee-reviewing` over a scope; bypass cannot start that session on its own. Inside a running session, UAT items (the SEE/CALL/RUN decisions) are always presented to the human, and any P1 finding always stops. The merge is auto-approved only when P1 = 0 **and** every UAT item was confirmed pass by the human; otherwise Gate 4 stops as normal.

**Privacy is never bypassed.** Reading secret-shaped files always requires explicit human approval, regardless of `gate_bypass`.

The mechanical guards do not change: `claimCell` and the write-guard still require `approved_gates.execution: true` — bypass simply means the agent records that approval itself for eligible work instead of waiting for the human. Bypass state is surfaced every session (the preamble and `bee_status` both print a loud `GATE BYPASS ON` line) so it is never silently in effect.

### Delegation contract (fan-out: decide-altitude vs gather-altitude)

The one orchestration pattern bee runs: the session model (the owner's best model) stays the orchestrator in every phase, and mechanical gather/render/mine steps dispatch down-tier as I/O workers that return digests (D1 — replaces the advisor pattern in full, decisions 0013/0015 reversed).

- **Decide-altitude stays on the session model**: gates, Socratic questions, the mode gate, synthesis of findings, accept/reject of worker results, state writes, human conversation.
- **D2 rubric** — a mechanical step delegates down-tier when it needs reading >3 files OR content the main model only needs as a digest, not verbatim; the orchestrator may override either way at dispatch, same spirit as tier-judging (decision 0016). Prose-ruled — no new hook enforces the threshold.
- **D3 lane rule** — the rubric applies in every lane and every phase, tiny/small included. Lane scaling v2's (d02a6bc6) "0 subagents" for tiny/small means zero *ceremony* subagents (reviewers/checkers/panels); I/O workers are exempt. A 1-file tiny fix never crosses the rubric, so it stays inline naturally.
- **Digest contract** — an I/O worker returns paths read, the facts extracted (with file:line anchors), and verbatim quotes only where asked; the orchestrator never re-reads what a digest already answers.
- **Transport unchanged** — anchored `[bee-tier: <tier>]` marker or `model` param (decision 0023), model name in the Agent description, background dispatch where the runtime supports it (decision 0017), P22 dispatch log as the audit trail. I/O workers do **not** register in `bee.mjs state worker add` — the registry stays swarm-cell-scoped (reservations/status are execution concerns); the dispatch log is the audit surface for gathers.

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
node .bee/bin/bee.mjs state set | gate | worker add/update/remove/clear/prune | scribing-run | start-feature
node .bee/bin/bee.mjs backlog add | counts | rank | badges
node .bee/bin/bee.mjs capture add | list | flush | count
node .bee/bin/bee.mjs reviews create | list | show | record | candidate add | candidates | status
node .bee/bin/bee.mjs feedback digest | count | collect | rank
```
