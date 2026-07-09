# Product Backlog

| ID | Story | CoS | Status | Feature |
|----|-------|-----|--------|---------|
| P1 | A greenfield repo with no build gets an init lane on its first onboard | First onboard of a repo without a build offers the init lane instead of adopt-later | proposed | — |
| P2 | Backlog rows can be ranked automatically instead of hand-ordered | A priority-scoring pass orders the rows once manual ordering no longer scales | proposed | — |
| P3 | Backlog status renders as README badges | The README shows done / in-flight / proposed counts as badges | proposed | — |
| P4 | Gates 2–3 are reviewed on a single human-readable implement plan | `bee-briefing` renders `docs/history/<feature>/implement-plan.md` from the truth artifacts; the gate message links it as the review object (design: docs/11-implement-plan-adoption.md; decision 0008) | done | bee-briefing |
| P5 | Capture-mode engages in-flight, not only when a human remembers | `scribingDebt` (behavior_change cells capped after last scribing run) surfaces in chain-nudge + preamble + bee_status so mid-swarming settlements reach `docs/specs/` without a manual invoke (finding: anphabe-gogl dogfood; decision 0011) | done | 0.1.8 |
| P6 | Model tiers are config-driven and runtime-keyed | `.bee/config.json` `models` (claude/codex → extraction/generation/ceiling) + `modelForTier` resolver; swarming resolves tier→model, ceiling kept scarce (design: Anthropic advisor/orchestrator patterns; decision 0012) | done | 0.1.9 |
| P7 | Keep the strong model scarce, measurably | `tier` field on cells + `tierMix`/`ceilingScarcityWarning`; ceiling-share surfaced in bee_status + preamble, planning assigns tier, swarming resolves cell.tier (decision 0012) | done | 0.1.10 |
| P8 | Advisor pattern (cheap main loop, ceiling on demand) is first-class | `.bee/config.json` `advisor` (enabled + consult points) + `advisorModel` resolver; loud surfacing in preamble/bee_status; contract in routing-and-contracts, swarming rescue points to it (decision 0013) | done | 0.1.11 |
