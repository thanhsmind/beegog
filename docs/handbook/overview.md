# bee harness — system overview

> This handbook turns the bee harness into a navigable reference. Read the
> [index](index.md) to route to a **stage**, read [register.md](register.md) for
> the shared **state** each stage reads and writes, and read
> [using-as-planner.md](using-as-planner.md) to use the handbook the way a code
> agent should: locate every place a change must touch *before* editing.
>
> Format follows the [Harness Handbook](https://github.com/Ruhan-Wang/Harness_Handbook)
> convention — `overview → index → register → stages/<id>` — mapped onto bee's
> own architecture: the **chain is the set of stages**, and the `.bee/` runtime
> files are the **state registers**.

## What bee is

bee is a **workflow harness** for AI coding agents. It is not an application with
users and features of its own — it is the operating discipline a coding agent runs
*inside* when it works on a host project. Its job is to make an agent's work on a
codebase safe, resumable, and reviewable: turn a fuzzy request into locked
decisions, scale ceremony to real risk, gate the irreversible steps behind human
approval, and keep a durable memory of what settled so the next session starts
smarter.

bee ships as four things working together:

1. **Skills** (`skills/<name>/SKILL.md`) — the phases of the workflow. Each skill
   is a self-contained instruction set the agent loads when the workflow routes to
   it. `bee-hive` is the router; the rest are the chain stages.
2. **A single CLI** (`.bee/bin/bee.mjs`) — every state read and mutation goes
   through this one dispatcher across nine command groups. State is *never*
   hand-edited.
3. **Runtime state** (`.bee/*.json`, `.bee/*.jsonl`, `.bee/cells/`) — the
   [state registers](register.md): phase, gates, feature, cells, decisions,
   reservations, backlog, handoff.
4. **Hooks** (`.codex/hooks.json`, 8 lifecycle events) — a fail-open safety net
   that catches forgotten rules. The hook is a net, *not* the authority: an
   unblocked write is not an approved write.

## The core model

**One orchestrator, many I/O workers (the Delegation contract).** The session model
is the orchestrator — it decides. Mechanical gather/render/mine steps are dispatched
*down-tier* to worker subagents that read many files and return a compact digest, so
the orchestrator's scarce context window is spent on synthesis, gates, and human
conversation — never on raw file dumps. Deciding never delegates; gathering almost
always does.

**Lanes scale ceremony, never memory.** The same request can be a two-minute `tiny`
fix or a full `high-risk` feature. bee classifies the lane mechanically (risk-flag
count + product-file count) and runs the *least* workflow that honestly protects the
work. What never scales down is memory: a rule, behavior, or value that just settled
is captured the moment it settles, in every lane.

**Gates are the human checkpoints.** Four approval gates fence the irreversible
transitions. They are never self-approved — except when the opt-in `gate_bypass`
switch is deliberately set by the human (levels: `normal` / `full` / `total`).

**Knowledge over history.** The state layer an agent reads *first* is the knowledge
bundle (`docs/knowledge/`) when the repo has one, or `docs/specs/` otherwise.
`docs/history/` is archaeology, read last.

## Architecture at a glance

```
skills/                     the workflow, one SKILL.md per phase
  bee-hive/                 router + gate keeper + onboarding  → stages/hive.md
  bee-exploring/            fuzzy request → locked CONTEXT.md   → stages/exploring.md
  bee-planning/             mode + executable work shape        → stages/planning.md
  bee-validating/           prove the plan against reality      → stages/validating.md
  bee-swarming/             orchestrate bounded workers         → stages/swarming.md
  bee-executing/            implement + verify + cap one cell   → stages/executing.md
  bee-scribing/             sync durable knowledge              → stages/scribing.md
  bee-compounding/          capture learnings + decisions       → stages/compounding.md
  bee-reviewing/            on-demand independent review gate    → stages/reviewing.md
  (plus on-demand: bee-briefing, bee-grooming, bee-qualifying,
   bee-xia, bee-writing-skills, bee-evolving, bee-bypass-gate)

.bee/
  bin/bee.mjs               the single CLI (9 command groups)   → register.md
  state.json               phase · gates · feature · workers    → register.md
  config.json              commands · hook toggles · gate_bypass → register.md
  cells/<feature>-<n>.json  one unit of executable work          → register.md
  decisions.jsonl          append-only decision log             → register.md
  reservations.json        file holds for same-checkout swarms   → register.md
  backlog.jsonl            friction events + PBI records         → register.md
  HANDOFF.json             pause/resume artifact                → register.md
  onboarding.json          onboarding state + managed versions   → register.md

docs/
  knowledge/               the state layer (read FIRST)
  specs/                   read-only compatibility surface
  history/<feature>/       CONTEXT.md · plan.md · reports/ (archaeology)
  handbook/                ← you are here
```

## The chain (stages)

```
bee-hive  ─ route ─▶  exploring  ─[Gate 1]─▶  planning  ─[Gate 2]─▶  validating
                                                                          │
                                                                       [Gate 3]
                                                                          ▼
   compounding  ◀─  scribing  ◀─  executing  ◀─  swarming  ◀────────────┘

   on user request only:  reviewing  ─[Gate 4]─▶  merge
```

- **Gate 1** — "Decisions locked. Approve CONTEXT.md before planning?"
- **Gate 2** — "Work shape is ready. Approve before current-work preparation?"
- **Gate 3** — "Feasibility validated. Approve execution?" *(no source edits before this)*
- **Gate 4** — merge approval, and it lives **only** inside a review session the user
  explicitly asked for. It is never an automatic end-of-chain step.

Tiny and small lanes merge Gates 2+3 into one shape+execution question; the docs
lane has no gates at all. See each stage page for its lane behavior.

## How to read this handbook

1. Start at [index.md](index.md) — pick the stage your change concerns.
2. Read that `stages/<id>.md` — what the stage does, what it reads and writes, its
   gate, and its hard rules.
3. Cross-reference [register.md](register.md) for any `.bee/` file the stage touches.
4. Then read the **real source** (`skills/<name>/SKILL.md`, `.bee/bin/`), and only
   then emit an edit plan — see [using-as-planner.md](using-as-planner.md).
