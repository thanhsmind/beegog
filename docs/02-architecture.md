# 02 — Architecture

## Repository layout (the plugin itself)

```
bee/
  README.md
  docs/                          ← these design docs
  .claude-plugin/plugin.json     ← Claude Code plugin manifest
  .codex-plugin/plugin.json      ← Codex plugin manifest
  hooks/
    hooks.json                   ← Claude Code hook wiring (6 events)
    bee-session-init.mjs         ← SessionStart: status + gates + handoff + patterns + decisions
    bee-prompt-context.mjs       ← UserPromptSubmit: phase/gate reminder (injection-deduped)
    bee-write-guard.mjs          ← PreToolUse: gate guard + reservation guard + privacy/scout
    bee-state-sync.mjs           ← PostToolUse/SubagentStop/Stop: state snapshot persistence
    bee-chain-nudge.mjs          ← SubagentStop: advance the chain after workers/reviewers
    bee-session-close.mjs        ← Stop: warn on mid-phase exit without HANDOFF
  AGENTS.template.md             ← Codex bootstrap block (installed into repo AGENTS.md, BEE:START/END markers)
  skills/
    hive/                        ← bootstrap + routing meta-skill
      SKILL.md
      references/routing-and-contracts.md
      references/go-mode.md
      scripts/onboard_bee.mjs    ← installer: AGENTS.md block, .bee/, vendored helpers
      scripts/test_onboard_bee.mjs
      templates/bee_status.mjs   ← vendored into target repo as .bee/bin/
      templates/bee_cells.mjs
      templates/bee_reservations.mjs
      templates/bee_decisions.mjs
    exploring/     SKILL.md + references/{gray-area-probes.md, context-template.md}
    planning/      SKILL.md + references/{planning-reference.md, edge-dimensions.md}
    validating/    SKILL.md + references/validation-reference.md
    swarming/      SKILL.md + references/swarming-reference.md
    executing/     SKILL.md + references/worker-details.md
    reviewing/     SKILL.md + references/reviewing-reference.md
    compounding/   SKILL.md + references/compounding-reference.md
    grooming/      SKILL.md + references/grooming-reference.md
    bee-writing-skills/  SKILL.md + references/{pressure-test-template.md, creation-log-template.md}
```

Ten skills, hard cap. Every SKILL.md stays lean (< ~200 lines); depth lives in one `references/` file per skill, never nested deeper than one level (khuym/superpowers rule).

## Target-repo layout (what onboarding installs)

```
<repo>/
  AGENTS.md                      ← contains the BEE:START..BEE:END block (Codex + any AGENTS.md-reading tool)
  .bee/
    onboarding.json              ← onboarding status + managed file versions
    state.json                   ← single runtime state file (phase, gates, active feature, workers)
    HANDOFF.json                 ← pause/resume artifact (exists only while paused)
    reservations.json            ← local file reservations for same-session swarms
    decisions.jsonl              ← event-sourced decisions (decide/supersede/redact)
    backlog.jsonl                ← friction + grooming items (predicted → actual)
    tools.json                   ← capability registry (present/absent, fallback notes)
    config.json                  ← per-repo config incl. hooks.<name> toggles
    logs/hooks.jsonl             ← fail-open hook crash/audit log
    cells/                       ← one JSON file per cell: <feature>-<n>.json
    bin/                         ← vendored helpers (bee_status, bee_cells, bee_reservations, bee_decisions)
    bin/lib/                     ← shared modules (state, cells, reservations, guards, inject) used by BOTH helpers and hooks
  docs/
    history/
      <feature>/
        CONTEXT.md               ← locked decisions (source of truth)
        discovery.md             ← research findings
        approach.md              ← chosen path, risks, proof needs
        plan.md | epic-map.md    ← unified plan artifact, enriched in place (see below)
        reports/                 ← worker results, reviewer reports, spike reports (file-based comms)
      learnings/
        critical-patterns.md     ← mandatory pre-planning/pre-execution context
        YYYYMMDD-<slug>.md       ← dated learnings
    specs/
      <area>.md                  ← current-behavior spec per long-lived area (state layer)
      reading-map.md             ← one line per location: what lives where
    decisions/NNNN-<slug>.md     ← long-form decision records (linked from decisions.jsonl)
  .spikes/<feature>/             ← disposable feasibility proofs
```

**Policy vs operations** (repository-harness): markdown under `docs/` (including `docs/history/`) is human-readable policy and narrative; JSON/JSONL under `.bee/` is the queryable operational record. Helpers keep them consistent; agents never hand-edit JSONL except through helpers.

**Unified plan artifact** (compound-engineering): `docs/history/<feature>/plan.md` is one document across planning's two passes, with frontmatter:

```yaml
artifact_contract: bee-plan/v1
artifact_readiness: requirements-only | implementation-ready
mode: tiny | small | standard | high-risk | spike
```

The shape pass writes it as `requirements-only` and stops at Gate 2; the post-approval prep pass enriches the *same file* to `implementation-ready` and creates the current-slice cells. Downstream skills (validating, swarming, reviewing, compounding) all receive one canonical plan path — no doc-discovery ambiguity, and the readiness field is machine-checkable (`bee_status.mjs` reports it).

## The state layer: area specs + reading map (decision 0001)

Everything else under `docs/` is **history-shaped** (append-only, dated, feature-sliced) and answers *"how did we get here"*. `docs/specs/` is **state-shaped** and answers *"where are we now"* — the opposite write discipline, on purpose:

| | Log artifacts (`decisions.jsonl`, `docs/history/`, learnings) | State artifacts (`docs/specs/`) |
|---|---|---|
| Answers | How we got here | Where we are |
| Write discipline | Append-only, supersede, never edit | **Overwritten/merged** to match reality |
| Organized by | Feature / date | **Area** (a form, a module — outlives features) |

- **`docs/specs/<area>.md`** — the current behavior, requirements, and settled edge cases of one long-lived area, written in the present tense. It cites active D-IDs for rationale but never narrates history ("was", "changed from" are banned — history lives in git and `docs/history/`). Template in `bee-compounding`'s reference.
- **`docs/specs/reading-map.md`** — one line per location: `path — what lives here`, optionally pointing at the area's spec. This is the navigation knowledge that otherwise gets re-derived every session.

The loop that keeps the layer honest:

1. **Write:** `bee-compounding` syncs specs at feature close. Capped cells with `behavior_change: true` (plus their `verification_evidence`) are the ready-made delta list — sync means merging those deltas into the touched areas' specs and refreshing reading-map lines, not rewriting docs.
2. **Read:** `bee-hive`'s scout contract reads the touched area's spec *before* the area's code, in every lane; the session preamble mentions the state layer when `docs/specs/` exists. Fresh-session reading order: **spec (what is) → decisions (why) → history (only for archaeology)**.
3. **Guard:** `bee-grooming`'s entropy score carries a `stale specs` term — an area with `behavior_change` cells capped after its spec's `updated` date is measured debt, not a hope.

Area naming is kebab-case, chosen at first spec write, stable thereafter; the compounding orchestrator maps cells to areas by the files they touched.

## Skill invocation modes

Every bee skill supports two invocation modes (compound-engineering):

- **Interactive (default):** ask at decision points, using the standard question format.
- **Headless (`mode:headless`):** never block on a question. Apply only unambiguous actions, classify ambiguous cases as deferred, and end with a structured report containing an `Outstanding Questions` section. Terminal output is JSON or structured markdown so an orchestrator (go mode, a pipeline, another skill) can consume it deterministically.

Hard limit: headless mode defers *within-stage* ambiguity only. The four human gates are never self-approved in any mode.

## The cell (task unit)

One JSON file per cell in `.bee/cells/`, one schema across planning → execution → trace:

```json
{
  "id": "auth-3",
  "feature": "auth",
  "title": "Wire session middleware into API router",
  "lane": "standard",
  "status": "open | claimed | capped | blocked | dropped",
  "deps": ["auth-1", "auth-2"],
  "decisions": ["D2", "D4"],
  "files": ["src/api/router.ts", "src/auth/middleware.ts"],
  "read_first": ["src/api/router.ts"],
  "action": "Directive prose. Cites decisions (per D2). No code blocks.",
  "must_haves": {
    "truths": ["Unauthenticated /api/* requests return 401"],
    "artifacts": [{"path": "src/auth/middleware.ts", "substantive": "exports authGuard, no TODO stubs"}],
    "key_links": ["router.ts imports and mounts authGuard"],
    "prohibitions": ["No change to public response envelope"]
  },
  "verify": "npm test -- auth",
  "trace": {
    "worker": null, "outcome": null, "files_changed": [],
    "deviations": [], "friction": null, "capped_at": null,
    "behavior_change": false, "verification_evidence": null
  }
}
```

Rules:

- **Capping requires verification.** `bee_cells.mjs cap <id>` refuses unless a verify result is recorded. One commit per cell, cell id in the commit message.
- **Lane scales strictness.** `tiny` cells may omit `must_haves` and record a one-line trace; `high-risk` cells require full `must_haves`, spike evidence links, and a detailed trace (fields checked mechanically, harness-style tiers).
- **Ready = all deps capped.** `bee_cells.mjs ready` lists claimable cells; only the orchestrator assigns them (workers never self-select).
- Optional adapter: when the beads CLI (`br`) is present and the user opts in, cells mirror into beads for graph tooling. Nothing in the chain depends on it.

## Vendored helpers (no external dependencies)

Four small Node scripts (Node 18+, zero npm deps), installed to `.bee/bin/` by onboarding, mirroring khuym's `.codex/*.mjs` pattern:

| Helper | Operations |
|---|---|
| `bee_status.mjs` | Read-only scout: onboarding health, state, handoff, gates, active cells, entropy quick-read, recommended next reads. `--json` |
| `bee_cells.mjs` | `list / ready / show / add / claim / cap / block / drop`; enforces cap-requires-verify and lane field tiers |
| `bee_reservations.mjs` | `reserve / release / list / sweep` with agent, cell id, path glob, TTL; conflict → caller must return `[BLOCKED]` |
| `bee_decisions.mjs` | `log / supersede / redact / search --recent / active`; write-time secret & injection rejection, datamark on read |

Everything a skill tells an agent to run is one of these, `git`, or the project's own build/test commands.

## Dual-runtime support (Claude Code + Codex)

The workflow contract is runtime-neutral; only two seams differ:

### Seam 1 — Bootstrap (how bee-hive gets loaded)

| Runtime | Mechanism |
|---|---|
| Claude Code | `hooks/bee-session-init.mjs` (SessionStart on startup/resume/clear/compact) injects the routing preamble plus live state: status, gates, HANDOFF surfacing, critical-patterns digest, recent decisions (superpowers pattern + claudekit session-init) |
| Codex | The `AGENTS.template.md` block installed into the repo's `AGENTS.md` carries the same instructions (khuym pattern); `bee_status.mjs --json` is the first commanded step. Re-read after any compaction. |

Both vectors point at the same skill (`bee-hive`); the preamble content is generated from one shared module (`bin/lib/inject.mjs`) for the hook, the AGENTS.md block, and `bee_status` output, so the runtimes can never drift.

### Seam 2 — Subagent spawn (how swarming launches workers)

- **Claude Code:** Agent tool, one worker per cell, `run_in_background` for parallel waves; worker results returned as tool results *and* written to `docs/history/<feature>/reports/` (file-based record survives either way).
- **Codex:** Codex subagents (khuym's same-session path) with the parent thread collecting `[DONE]/[BLOCKED]/[HANDOFF]/[NOOP]` messages, plus the same report files.

The spawn *contract* is identical on both: assigned cell id, CONTEXT.md path, global constraints, reservation identity, status-token protocol. `references/swarming-reference.md` holds both mechanics side by side; the SKILL.md body is runtime-agnostic.

### Everything else is shared

Skills, artifacts, cells, gates, helpers, templates: one copy. Both plugin manifests point at the same `skills/` directory (khuym proves this works for Codex via `.codex-plugin/plugin.json` with `"skills": "./skills/"`).

## Hooks: the automation skeleton (Claude Code) + helper enforcement (Codex)

bee ships a coherent **6-hook automation skeleton** for Claude Code — session-init, prompt-context (deduped), write-guard (gate + reservation + privacy in one), state-sync, chain-nudge, session-close — learned from claudekit's tightly-wired hook system but capped and disciplined: every hook is config-gated in `.bee/config.json`, fail-open with crash logging, silent on non-onboarded repos, and a thin wrapper over the same `.bee/bin/lib/` modules the CLI helpers use.

The dual-runtime rule: **enforcement lives in the shared helpers first** (cap-requires-verify, reservation conflicts, gate-locked claiming work identically under Codex); hooks are Claude Code's second, mechanical belt. Full design, the Codex parity matrix, and the hook response protocol: [06-runtime-integration.md](06-runtime-integration.md).

Any proposed seventh hook must name which of the six it replaces — claudekit's 16-hook sprawl remains the documented anti-goal.

## State model

`.bee/state.json` is the single runtime state file:

```json
{
  "schema_version": "1.0",
  "phase": "idle | exploring | planning | validating | swarming | reviewing | compounding | grooming",
  "feature": "<slug> | null",
  "mode": "tiny | small | standard | high-risk | spike | null",
  "approved_gates": { "context": false, "shape": false, "execution": false, "review": false },
  "workers": [],
  "summary": "one plain-language sentence",
  "next_action": "Invoke bee-<skill>."
}
```

- Every skill updates `phase`, `summary`, `next_action` on completion — the handoff is machine-checkable.
- At ~65% context usage, the active skill writes `.bee/HANDOFF.json` (phase, feature, cells in flight, done/remaining, next action) and pauses. Resume never auto-continues: `bee-hive` surfaces the handoff and waits for the user.
- Gate approvals are recorded here; `bee_status.mjs` refuses to report "ready to swarm" unless `execution: true`.

## Security posture (carried from upstreams)

- Decision/learning writes reject secrets and instruction-like content at write time; reads are datamarked so resurfaced text cannot act as instructions (gstack).
- Artifact/transcript content mined by compounding or grooming is treated as untrusted data, never as runtime instructions (khuym dream policy).
- Package installs during execution always checkpoint to the human (gsd slopsquat rule).
