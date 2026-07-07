# 0003 — Rebuild Completeness: Settlement Ritual, Git-Drift Guard, Visuals, System Overview

- **Status:** active — amends [0001](0001-state-layer.md) (staleness guard widened; reading order gains an overview) and [0002](0002-scribing-skill.md) (capture trigger hardened; scribing's owned surface grows)
- **Date:** 2026-07-07
- **Source:** owner Q&A session — "is the BA layer enough to rebuild the whole system on another framework, given a vibe-coding workflow?"
- **Confidence:** 0.75 (design-level; the gaps are observed reasoning about the vibe loop, not yet dogfood evidence)

## Decision

Four coupled additions that close the distance between "rebuild one area from its spec" (the 0002 bar, already designed) and "rebuild the whole system, when the final version emerges from a discuss → build → test → adjust loop":

1. **Settlement ritual.** `bee-scribing` capture mode gains an explicit, mandatory trigger: when the user marks an outcome settled — "chốt", "final", "ok ship it", any equivalent — the active skill logs the decision and merges the spec **in the same turn**. Deferral to feature close is a violation, not a style choice. Mechanically, `bee-session-close` gains a **capture nudge**: if the newest active decision is more recent than every `docs/specs/*.md` update, warn (deduped, never blocks) that something settled was never captured.
2. **Git-drift staleness.** `bee-grooming`'s `stale specs` term stops depending on cells alone: an area also counts as stale when files under its Pointers / reading-map locations changed in git after the spec's `updated` date, even if no `behavior_change` cell exists. This is the vibe-loop hole — direct edits that never became cells were invisible to the 0001 guard. The audit additionally reports a **coverage read-out** (informational, unscored): specs present vs behavior-bearing reading-map locations.
3. **Visual layer.** UI areas gain `docs/specs/visuals/<area>/` — one settled snapshot per screen, referenced from a `Visuals` section in the spec, refreshed at sync when the screen visibly changed. The vibe loop's final artifact is often *seen*, not stated; a spec alone rebuilds the behavior but loses the settled look. A missing snapshot for a UI area is an Open Gap, never silent.
4. **System overview spec.** `docs/specs/system-overview.md` — the cross-area glue no per-area spec owns: the area map (what areas exist, what each is for, where its spec lives), shared business entities and their meanings, the global actor/role model (stated once; area specs reference it), and cross-area flows (any flow spanning two or more areas). Owned by `bee-scribing`; synced whenever a feature adds/removes an area or changes shared entities, roles, or a cross-area flow. Fresh-session reading order becomes **overview → touched area's spec → decisions → history**.

Validation is part of the decision: Phase 3's exit criteria gain a **rebuild test** — one small area rebuilt on a different stack from its spec alone (Pointers removed), observable behavior compared. The rebuild bar stops being a slogan the day it is exercised once.

## Rationale

The state layer (0001) and BA grade (0002) were designed against the rebuild bar *per area*. The owner's actual question is system-level, and the workflow is vibe-shaped. Reasoning through that combination exposed four gaps, each mapping to one addition:

1. **Capture is on-demand, and vibe sessions don't demand.** 0002 already widened sources to discussion-settled rules, but the trigger is "when a loop settles an outcome" — judged by the agent, mid-flow, with no mechanical backstop. In a vibe session nobody says "document this"; the session closes and the knowledge evaporates — the exact 0002 pain, still reachable. The ritual moves the trigger to the user's own settlement words, and the nudge makes silent loss visible at the last moment it is recoverable.
2. **The 0001 staleness guard only sees the chain.** Its unit of evidence is the capped `behavior_change` cell. Vibe edits routinely skip cells; behavior drifts, the spec stays green, and grooming reports health that isn't there. Git is the one record that sees every edit — so the guard must read git, not only cells.
3. **Specs are deliberately non-visual; vibe finals are visual.** Field order and behavior survive in the template; "the version of the screen we all agreed looked right" does not. One snapshot per settled screen is the cheapest artifact that preserves it — worth having even though it can rot (rot is priced in: refresh-at-sync plus Open Gap on absence).
4. **Per-area specs compose a system only if something states the composition.** Shared entities, the global role model, and cross-area flows fall between area files. Rebuilding N areas from N specs without the glue yields N correct pieces and a wrong system.

## Alternatives considered

- **Do nothing; trust the 0002 capture mode and per-area bar.** Rejected: every gap above is reachable from the owner's stated workflow today, and three of the four fail silently.
- **A new skill (e.g. bee-architecting) for the overview.** Rejected under the 0002 decision gate: no uncovered workflow stage — the overview is state-layer content, same write discipline, same owner (scribing), same sync moment.
- **Screenshots inside `docs/history/<feature>/`.** Rejected: history is feature-sliced and append-only; the settled look is state-shaped (current, per-area, overwritten) and must live where the spec lives.
- **Scoring coverage in the entropy formula.** Rejected for now: coverage of legacy areas is a backfill program, not week-to-week debt; scoring it would swamp the signal. Reported informationally; revisit after dogfood.
- **A PreToolUse block (not a nudge) on session close without capture.** Rejected: "settled but uncaptured" is a heuristic (decision newer than every spec), and heuristics never block — hooks stay fail-open, warn-only (06-runtime rule).

## Scope

- `bee-scribing` SKILL.md + reference: settlement-signal trigger in capture mode; `system-overview.md` template and sync triggers; `Visuals` section, snapshot convention, rebuild-checklist item.
- `bee-grooming` reference: git-drift clause in the `stale specs` counting rule; coverage read-out in the audit; hunt-checklist routing for drift hits.
- `hooks/bee-session-close.mjs`: capture nudge (deduped via inject lib, fail-open, warn-only).
- `02-architecture.md`: layout (`system-overview.md`, `visuals/`), state-layer section, hook line. `03-workflow.md`: principle 9 wording. `06-runtime-integration.md`: hook table row. `05-roadmap.md`: Phase 3 exit gains the rebuild test.
- No new skill, no new hook, no new helper — all four changes ride existing owners.

## Consequences

- Scribing's owned surface grows (overview + visuals). Bounded: the overview syncs only on area-map/shared-entity/flow changes, and visuals only when a screen visibly changed.
- The capture nudge will occasionally fire on decisions that legitimately touch no spec (process decisions). Accepted: it is deduped per decision and warn-only; noise is one line, loss is permanent.
- Git-drift staleness can flag refactors that changed files without changing behavior. Accepted: a false-positive sync cell NOOPs cheaply ("no behavioral delta — spec confirmed current" is itself useful evidence); the miss it prevents is the expensive direction.
- Snapshots depend on someone being able to produce them (user or tooling). Priced in: absence is an Open Gap with a stated reason, and `coverage` stays honest.
