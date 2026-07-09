# 0009 — Artifact fan-out scaling + cap-time before-state (anti-bloat recalibration)

- **Status:** active — owner-approved 2026-07-09 (in-session: "làm cả 2 suggest trên cho tôi")
- **Date:** 2026-07-09
- **Source:** owner dogfood observation on the `anphabe-gogl` feature `task-detail-read-mode-meta` — a small/standard frontend change (note read/edit toggle + client-side meta tags) produced 17 history files (~1,129 lines) plus three verbose cell JSONs. The owner's read: "flow report tìm chứng cứ lại khá kồng kềnh với bộ doc siêu nhiều… hơi quá mức." Confirmed on inspection.
- **Confidence:** 0.7 (the two mechanisms are targeted at named, reproduced failure modes; the fan-out calibration is prose-ruled and not yet re-dogfooded on a fresh feature)

## The two failures observed

1. **Planning-artifact fan-out restated the same "current state" 4–5 times.** For one standard feature the chain wrote `discovery.md`, `approach.md`, `plan.md`, *and* `implement-plan.md` — each re-describing "item notes have a read-view, task notes are a plain textarea, inbox.html has a generic title, build.sh generates the pages." `implement-plan.md` is by design a *projection* of the others, so it duplicates structurally. The fan-out was gated per-feature (the whole chain runs) rather than scaled to task size; the lane system scaled per-*cell* strictness but not the per-*feature* document set.

2. **Evidence was stored in triplicate, and a missing "before" spawned a whole extra cell.** Each cell's verification evidence lived in `cell.trace.verification_evidence`, in a parallel `reports/<cell>-evidence.json`, and in a `reports/execution-*-evidence.md` (the last two also required as cell `must_haves.artifacts`). Worse: `task-detail-read-mode-meta-2` capped with an empty `red_failure_evidence` (assertion-capping — the exact pattern 0004 targets, but 0004 only enforced *some* output, not the before-state). Review caught it as P1, which spawned `task-detail-read-mode-meta-review-p1-1` — an entire cell whose only output was documentation ("Do not change runtime source behavior") plus `review-raw-findings.md` → `review-synthesis.md` → `review-p1-fix-evidence.md` and edits to three evidence files. ~5 files to backfill one `git show` line that was one command away at cap time.

## Decision

### A. Planning artifacts scale — separate files are earned, not default

`plan.md` is the one planning artifact always written. Discovery and approach content default to **sections inside `plan.md`** and graduate to standalone files only when real complexity earns it:

| Artifact | Separate file when | Otherwise |
|---|---|---|
| `plan.md` | always | — |
| `discovery.md` | discovery ran at **L2/L3** | `## Discovery` note in `plan.md` |
| `approach.md` | **high-risk** lane or **L2+** discovery | `## Approach` section in `plan.md` |
| `implement-plan.md` (bee-briefing) | **high-risk** (mandatory) | **standard**: on-demand (plan.md + Gate 2 chat suffice); **small**: optional mini-brief on request; **tiny**/**spike**: none |

This **recalibrates 0008's lane table** (which rendered a brief for `small`/`standard`/`high-risk` by default) — the brief mechanism and its rules are unchanged; only *when the chain invokes it* changes. On the observed feature this collapses the planning set from four files to `CONTEXT.md` + `plan.md`.

### B. Evidence has one home; the "before" is captured at cap time

- The cell **trace** (`verification_evidence` + `verify_output`) is the single source of verification evidence. Per-cell reports link and summarize it; they never re-embed the JSON. Planning must not add a `reports/execution-*-evidence.md` or `<cell>-evidence.json` to `must_haves.artifacts` — `artifacts` are the product the cell builds, not a record that it ran.
- `bee_cells.mjs cap` now **refuses a `behavior_change` cell** unless its evidence carries a non-empty `red_failure_evidence` (the prior behavior characterization) *or* a `deliberate_exceptions` entry stating there is no prior behavior (a brand-new surface). Assertion-capping is blocked at the source; the reviewing verification gate becomes a backstop, and the evidence-backfill P1 loop cannot recur. Freeform (non-JSON) evidence is still accepted as before — the check only applies when the evidence parses to an object.

## Rationale

- **Lanes already scale ceremony; the doc set should too.** bee's principle is "lanes scale ceremony, never memory." Fix A extends that from per-cell strictness to per-feature artifacts without touching what is *remembered* (CONTEXT decisions, the plan, cell traces, the walkthrough all survive).
- **Cheapest place to capture the before-state is at cap.** The old state is one `git show` away while the worker holds the diff in context; recovering it after review costs a whole cell. Enforcing it mechanically at cap is strictly cheaper than catching it in review — and it is the same "proof, not assertion" spirit as 0004, extended to the *change* (not just the run).
- **Single-source evidence removes drift, not information.** Three copies of the same JSON is three chances to disagree; the trace is authoritative and machine-read already (`bee_cells.mjs`, scribing, reviewing all read it).

## Alternatives considered

- **Leave 0008's lane table; just tell agents to be terser.** Rejected: the fan-out was structural, not a verbosity habit — the files exist because the chain creates them. Prose pleading loses to the template.
- **Drop `implement-plan.md` entirely for non-high-risk.** Rejected: 0008's consolidated human doc is genuinely useful when a slice spans domains; on-demand preserves it without auto-bloat.
- **Keep evidence enforcement in reviewing only.** Rejected: that is exactly the loop that produced the extra cell. Enforce at cap; review backstops.
- **Do nothing.** Rejected: the owner named the pain and it is reproducible.

## Scope

- Helper: `skills/bee-hive/templates/lib/cells.mjs` `capCell` (before-state enforcement) + header comment in `templates/bee_cells.mjs`, synced to `.bee/bin/`. Unit-tested across five cases (empty red → refused; with before → capped; greenfield exception → capped; freeform → capped; missing evidence → refused).
- Skills: `bee-planning/SKILL.md` (§2/§4/§5/§6), `bee-planning/references/planning-reference.md` (fan-out table, plan.md Discovery/Approach sections, cell rule 8), `bee-briefing/SKILL.md` (lane forms + modes + red flag), `bee-validating/SKILL.md` (conditional required inputs), `bee-reviewing/SKILL.md` (§3 backstop), `bee-executing/references/worker-details.md` (single-source evidence + cap-time before-state).
- Docs/maps: `docs/02-architecture.md` (cap rule), `skills/bee-hive/references/routing-and-contracts.md` + `templates/AGENTS.block.md` + repo `AGENTS.md` (file maps), `skills/bee-hive/references/go-mode.md` (chain diagram).
- Not done here: retro-cleanup of the `anphabe-gogl` feature's existing over-produced doc set (separate, per the owner's option (b)); a `bee_status` warning when a `reports/*-evidence.*` duplicate of a trace exists (possible follow-up, not required).

## Consequences

- A standard single-slice feature now produces `CONTEXT.md` + `plan.md` + cells + `walkthrough.md`, not the six-plus-file set. High-risk keeps the full fan-out — the ceremony follows the risk.
- One new cap-time refusal class. It fires only on `behavior_change` cells with JSON evidence lacking a before-state — the honest fix is to record the `git show`, which the worker has at hand. Greenfield surfaces pass via `deliberate_exceptions`.
- 0008's lane table is superseded on *when to render*; its skill design is intact. 0004's cap-proof rule is extended, not replaced.
- Prose-ruled parts (fan-out calibration) inherit the usual weaker-runtime debt: pressure-testing on Codex / cheap worker tiers is recorded debt, consistent with the v0.1 skills.
