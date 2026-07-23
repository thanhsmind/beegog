---
date: 2026-07-23
feature: herding-dispatch-lock-toggle
categories: [pattern, decision, failure]
severity: standard
tags: [bee-herding, cli-verbs, regen, swarming-dispatch, cell-scoping]
---

# Learning: bee herding enable/disable/status — patterns, decisions, and failures

**Category:** pattern
**Severity:** standard
**Tags:** [cli-design, owner-gesture]
**Applicable-when:** designing a new bee.mjs CLI verb group for a binary, safety-relevant, owner-only toggle.

## What Happened

Added `bee herding enable/disable/status`, mirroring `dispatch-interlock.mjs`'s exact marker-file logic rather than importing it, and made both `enable` and `disable` idempotent (the underlying `touch`/`rm` gesture is not: `rm` errors on an absent file). Verb shape (`enable`/`disable`/`status`, not a bare `toggle`) was copied from the existing `bee-bypass-gate` skill's `on`/`off`/`status` convention.

## Root Cause

`touch` and `rm` are not symmetric primitives — designing "byte-identical to today's manual gesture" required explicitly coding both directions to tolerate their own already-applied state, or the new verb pair would be less safe (error-prone) than the gesture it replaces. Reusing an existing owner-gesture verb convention (`bee-bypass-gate`) instead of inventing a new one avoided a fresh design decision with no real degrees of freedom.

## Recommendation

When wrapping a manual file-toggle gesture (`touch`/`rm`, or similar) in a CLI verb pair, make both directions idempotent even if the underlying primitives are not, and check the repo for an existing on/off/status verb convention before inventing a new one.

---

**Category:** decision
**Severity:** standard
**Tags:** [safety-posture, discoverability, containment]
**Applicable-when:** a fresh-eyes/independent review flags that a new convenience surface increases *discoverability* of an existing sensitive action, without changing who is authorized to take it.

## What Happened

Fresh-eyes review flagged that `bee herding enable` is more discoverable to an in-session agent than the pre-existing path-knowledge-only `touch`/`rm` gesture (it appears in `bee.mjs --help --json`, which AGENTS.md already tells every session to consult) — even though nothing stops an agent from `touch`-ing the file directly today either. The user was asked, and explicitly chose **no runtime guard** (no TTY/interactivity check, no manifest exclusion): convention-only safety, same enforcement level as today, logged as CONTEXT.md D5 with an explicit "do not silently revisit without asking again."

## Root Cause

The underlying containment for `bee-herding`'s dispatch loop (docs/knowledge/areas/bee-herding/overview.md R3/R8) was already convention-only, not code-enforced — `dispatch-interlock.mjs`'s own header comment says the marker is "an OWNER gesture, never created by any agent." A new CLI verb for the same gesture cannot make that weaker (the file was always agent-touchable), only more *visible* — and visibility-vs-simplicity is a genuine, non-obvious product-risk tradeoff the agent correctly escalated rather than resolving unilaterally.

## Recommendation

When a review finding is about *discoverability* of an already-possible action (not a new capability), do not resolve it as a routine safety fix — surface the specific increased-visibility mechanism (e.g., "it will appear in `--help --json`, which is already read every session") and let the user decide the tradeoff explicitly, then lock the decision with a "do not silently revisit" note.

---

**Category:** failure
**Severity:** standard
**Tags:** [cell-scoping, indirection]
**Applicable-when:** authoring a cell whose action references a symbol/registry/config without having grepped its actual definition site.

## What Happened

The cell's `files` list (`bee.mjs`, new `lib/herding.mjs`, new test file) omitted `lib/command-registry.mjs`, because the action text assumed `COMMAND_REGISTRY` was defined inline in `bee.mjs` (true for `HANDLERS`, false for `COMMAND_REGISTRY`). The worker correctly touched the real file; the frozen judge (`cells judge`) flagged it as an undeclared change after the fact, and the orchestrator had to verify the diff was purely additive before accepting it. Adding the new registry group also broke `test_bee_cli.mjs`'s pre-existing group-allowlist drift-guard — a known, fixed blast radius (the `worktree` group already set this precedent) that the cell also didn't declare.

## Root Cause

The cell was scoped by reading the action's target symbol names, not by grepping where those symbols are actually defined, before freezing `files`.

## Recommendation

Before locking a cell's `files` list, grep every symbol/registry/config named in the action text for its real definition site — do not assume "the entry-point file" holds it. When the action is "add a new registry group," also declare the group-allowlist test file the registry's own contract tests live in (established precedent: `test_bee_cli.mjs`'s group `Set`s).

---

**Category:** failure
**Severity:** standard
**Tags:** [swarming-dispatch, subagent-type, known-friction]
**Applicable-when:** dispatching a tiny/small-lane execution worker per `bee-swarming/references/swarming-reference.md`'s subagent-type table.

## What Happened

First dispatch of cell hdlt-1 used `subagent_type: "bee-gather"` per the swarming-reference.md table's generation-tier mapping. `bee-gather`'s actual rendered definition (`.claude/agents/bee-gather.md`) grants only Read/Grep/Glob — it cannot execute a cell (no Edit/Write/Bash). The worker correctly returned `[BLOCKED]` with no work attempted; re-dispatched as `subagent_type: "general-purpose"` with a pinned `model: "sonnet"` param (no `[bee-tier: ...]` marker needed, since a real model param already satisfies the model-guard's transport requirement and pairing the marker with `general-purpose` is denied — `bee-model-guard.mjs`'s "generic-type-denied" rule).

## Root Cause

This is a **known, already-filed** friction item (`.bee/backlog.jsonl`, 2026-07-20: "dispatch prepare --kind cell emits read-only bee-gather agent type for execution cells (GH #27 item 5 confirmed live 2026-07-20)", severity P2) — the swarming-reference.md routing table conflates the Delegation contract's I/O-offload gather workers (`bee-gather`/`bee-extract`/`bee-review`, always read-only) with the AO14 execution-worker class (needs write access), and its "spawn the tier-matched pinned type" instruction is correct for gathers but wrong for cell execution. This session's occurrence is the second confirmed live recurrence.

## Recommendation

Until the routing table is fixed (existing P2 friction), dispatch tiny/small execution workers as `subagent_type: "general-purpose"` with a real `model` param (not a bare `[bee-tier: ...]` marker, which the model-guard denies when paired with `general-purpose`) — never `bee-gather`/`bee-extract`/`bee-review`, which are read-only by design and cannot execute a cell.
