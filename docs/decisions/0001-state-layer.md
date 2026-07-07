# 0001 — The State Layer: Area Specs + Reading Map

- **Status:** active — amended by [0002](0002-scribing-skill.md) (spec template upgraded to BA grade; write ownership moved from bee-compounding to bee-scribing; sources widened)
- **Date:** 2026-07-07
- **Source:** owner + agent review session (bee usefulness evaluation, anphabe-gog dogfood period)
- **Confidence:** 0.8 (design-level; validated only against the owner's observed pain, not yet by dogfood)

## Decision

bee gains a **state layer**: `docs/specs/<area>.md` (one current-behavior spec per long-lived area of the repo) plus `docs/specs/reading-map.md` (one line per location: what lives where). The state layer is written and merged by `bee-compounding` at feature close, guarded by a `stale specs` term in `bee-grooming`'s entropy score, and surfaced by `bee-hive`'s scout contract (read the touched area's spec before touching it).

## Rationale

Every knowledge artifact bee had before this decision is **history-shaped**: `docs/history/<feature>/`, dated learnings, append-only `decisions.jsonl`, cell traces. They answer *"how did we get here"*. None answers *"what does this area do right now — every behavior, every requirement"*.

The owner's real workflow is iterative ("vừa làm vừa chỉnh"): a form or module passes through many revision rounds. After five features touch the same form, its current truth is scattered across five feature histories plus assorted active decisions. A fresh session must reassemble it — expensive, and easy to reassemble incompletely. The owner's stated requirement: *the final version must always be fully understood by the agent, every behavior and requirement, even in a new session.*

The two knowledge shapes have opposite physics and both are needed:

| | Log (bee already had) | State (this decision adds) |
|---|---|---|
| Answers | How we got here | Where we are |
| Write discipline | Append-only, never edited | **Overwritten** to match reality |
| Organized by | Feature (one pass of work) | **Area** (outlives features) |

The mechanism is cheap because bee already produces the raw material: capped cells with `behavior_change: true` plus their `verification_evidence` are exactly the list of behavior deltas a feature shipped. Spec sync is "merge these deltas into the touched areas' specs", not "rewrite documentation".

The reading map resolves the second observed pain of the same shape: an agent's largest recurring per-session cost is re-discovering where things live. Learnings capture mistakes and patterns, not navigation; CLAUDE.md/AGENTS.md are static. The reading map is navigation knowledge with an update loop.

## Alternatives considered

- **Repo-profile cache (roadmap Phase 4) as the answer.** Rejected as a substitute: the profile is derived from code at a commit and question-agnostic; it cannot carry *requirements* or *settled edge cases*, which live in human decisions, not in code shape. The cache remains a separate, complementary Phase 4 item.
- **Docs-from-code (gstack idea, already kept-deferred).** Covers only what code owns; requirements and behavioral intent need a human-approved artifact. Also deferred, unchanged.
- **Enriching CONTEXT.md in place forever.** Rejected: CONTEXT.md is per-feature and gate-locked; overloading it as a living area spec breaks its "locked at Gate 1" contract and keeps knowledge feature-sliced instead of area-sliced.
- **Do nothing; let agents reassemble from history.** Rejected by the observed evidence: this is the exact failure mode demonstrated in dogfood (re-exploring after `/clear`).

## Scope

- New target-repo artifacts: `docs/specs/<area>.md`, `docs/specs/reading-map.md` (layout in `02-architecture.md`).
- `bee-compounding`: new "Sync the State Layer" step; templates in its reference.
- `bee-grooming`: `stale specs ×5` entropy term + hunt checklist entry.
- `bee-hive`: scout contract reads the touched area's spec first; preamble mentions the state layer when present.
- Ships with Phase 3 (memory phase) — same phase as compounding/grooming, since they are its write and guard mechanisms.

## Consequences

- Compounding gains one step of ceremony per meaningful feature; bounded, because deltas come pre-listed from `behavior_change` cells.
- A spec can rot. That risk is priced into the entropy score rather than wished away: behavior changed but spec untouched = measured debt.
- Specs are display-and-read artifacts for both humans and agents; they cite active D-IDs for rationale but never duplicate the decision log.
