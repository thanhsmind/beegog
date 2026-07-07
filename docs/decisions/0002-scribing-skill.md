# 0002 — bee-scribing: The BA Skill, and Lifting the Ten-Skill Cap

- **Status:** active
- **Date:** 2026-07-07
- **Source:** owner request (vibe-coding knowledge-loss pain), builds on decision 0001
- **Confidence:** 0.8 (design-level; validated against the owner's stated requirement, not yet by dogfood)

## Decision

Two coupled changes:

1. **The ten-skill hard cap is lifted.** It is replaced by a decision gate: any new skill requires a decision record in `docs/decisions/` naming the gap no existing skill covers and why extending an existing skill would be worse. The 6-hook cap is unchanged.
2. **bee gains an eleventh skill, `bee-scribing`** (scribe bees) — a dedicated BA role that owns the state layer (`docs/specs/`) at **BA grade**: technology-agnostic functional specs, one per long-lived area, complete enough that a human reads and understands the area without the code, and an agent given only the spec can rebuild the same observable behavior on a different stack. An area is **domain-general** — a screen/form, an API, a background job, an integration, a pipeline, a business process (owner clarification: the form example was illustrative; anything a vibe discuss → build → test → adjust loop settles gets recorded, whatever the domain). It runs in the chain between `bee-reviewing` and `bee-compounding`, and on demand for backfill and mid-discussion capture.

## Rationale

Decision 0001 created the state layer and made `bee-compounding` sync it. Dogfood-period review against the owner's actual requirement exposed three gaps that a sync step inside compounding cannot close:

1. **Depth.** The 0001 spec template (Current Behavior / Requirements / Edge Cases / Pointers) captures developer-shaped deltas. The owner's requirement is BA-shaped: what each field means (every enum value's business meaning), field order on the form, which link opens which screen, what happens on Save (validations, state changes, side effects, notifications), and **who sees what by role**. The template also mixes code pointers into the body, so the spec is bound to the current technology — the exact dependency the owner wants documented away. The stated goal is a rebuild-on-another-stack artifact; that is a different artifact grade with its own sections and its own prohibition (no technology names outside one clearly-marked implementation section).
2. **Sources.** 0001's merge rule is "deltas from `behavior_change` cells only". That records only behavior that shipped as code through the chain. Business rules agreed **in discussion** — the knowledge the owner watches evaporate when a session closes — never become cells; and areas built before bee (or outside it, vibe-coding sessions included) never get a spec at all. The source set must widen to gate-locked CONTEXT.md decisions and the active decision log (human-approved intent, citable by D-ID), and a backfill mode must exist. The never-invent rule survives: a claim with neither verification evidence nor an approved decision behind it enters the spec only as an open gap or a question, never as fact.
3. **Ownership.** Spec sync was one step (of eight) inside compounding, executed at feature close by an agent whose main job is learnings. Nobody owns the spec layer proactively: nothing writes specs mid-session when a rule is agreed, nothing backfills legacy areas, and if compounding is skipped the layer silently rots. The owner's requirement is a dedicated, proactively responsible role — in bee terms, a skill with its own chain position, its own on-demand triggers, and its own hard gates.

Why lifting the cap is the right cost: the cap's purpose (vision doc: "Not 40 skills") is to prevent domain-skill sprawl — frontend/deploy/DB skills that belong in other plugins. `bee-scribing` is not a domain skill; it is a missing **workflow stage** (the record-keeping role every real BA process has). Keeping the cap and stuffing BA-grade behavior into compounding was the alternative, and it is exactly what produced gaps 1–3. The decision gate keeps the cap's spirit — additions must prove a structural gap — without the arbitrary number.

## Alternatives considered

- **Keep the cap; enrich compounding's sync step.** Rejected: fixes depth only. Mid-session capture and backfill have no home (compounding runs at feature close by contract), and the proactive-ownership gap remains.
- **A subagent under compounding/reviewing instead of a skill.** Rejected once the cap was lifted: subagents cannot be routed to on demand ("document this screen"), have no state-machine phase, and inherit the parent skill's triggers — proactivity was the requirement.
- **Swap out an existing skill to stay at ten.** Rejected: every current skill is a load-bearing chain stage; trading one for scribing would reopen a different gap.
- **Docs-from-code generation.** Rejected in 0001 already; unchanged — code cannot yield field *meanings*, business rules, or role visibility intent.

## Scope

- `docs/00-vision.md`, `02-architecture.md`, `05-roadmap.md`, `01-distillation.md`, `README.md`: cap wording → decision gate; skill count 11.
- New skill `skills/bee-scribing/` (SKILL.md + `references/scribing-reference.md` + CREATION-LOG.md). Owns the BA-grade area-spec template and `reading-map.md` (templates move out of compounding's reference).
- Chain (`03-workflow.md`): `bee-reviewing` [Gate 4] → **`bee-scribing`** → `bee-compounding`. New `scribing` value in the `phase` enum (no code change needed: guards do not enumerate phases, and `docs/` is an allowed write prefix in every phase).
- `bee-reviewing`: handoff → "Invoke bee-scribing."
- `bee-compounding`: drops the sync step; gains a **guard** — verify scribing ran for the feature; if not, invoke it (never inline the sync).
- `bee-grooming`: `stale specs` entropy term already counts missing specs (0001); hunt checklist now routes stale/missing specs to scribing sync/harvest cells.
- `bee-hive`: routing rows for "document this screen/area", capture requests, and backfill.

## Consequences

- The chain gains one stage per meaningful feature. Bounded: sync mode consumes pre-listed deltas; scribing NOOPs when no `behavior_change` cell capped.
- Harvest mode can produce partial specs (`coverage: partial` + Open Gaps). Priced in: a spec that states its gaps is safer than an invented-complete one, and grooming counts open gaps as measured debt.
- The decision gate replaces a number with a judgment call. Accepted: the gate forces the judgment to be written down and reviewable, which the number never did.
