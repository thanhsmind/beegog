# 0005 — bee-xia: Research Scout as a Standalone Skill

- **Status:** active — owner-approved 2026-07-07 (in-session settlement; same-day reference-only draft superseded before merge)
- **Date:** 2026-07-07
- **Source:** owner request — "claudekit/khuym have a skill (xia) that researches before building; learn it into bee. I want a separate bee-xia skill, so more purpose-specific skills can be added later the same way"; distilled from `khuym:xia`
- **Confidence:** 0.7 (xia is proven in khuym; the bee form is not yet dogfooded or pressure-tested)

## Decision

Add **`bee-xia`** as the 12th skill via the 0002 decision gate. The named workflow gap: **standalone research with no feature underway**. Routing previously sent "research task" to `bee-planning`, which presumes a feature (CONTEXT.md or scoping synthesis, Gate 2, cells); "research library X" with nothing to plan had no honest home.

Shape of the skill:

1. **Protocol** (from khuym xia, wholesale): stack ledger from real artifacts → local reuse search → upstream patterns → version-aware official docs; evidence labels `Local/Upstream/Docs/Inference` on every claim; anti-reinvention ladder (reuse → built-in → adapt upstream → build, skipped rungs justified).
2. **Dual output contract:** standalone runs write `docs/history/research/<topic-slug>.md` and suggest the next skill; in-chain runs (planning discovery L2/L3 invokes bee-xia) merge findings into `approach.md` — the unified-artifact rule holds, no second canonical doc per feature.
3. **bee-ifications:** Exa/DeepWiki become capabilities (`web-docs-search`, `upstream-pattern-research`) with documented fallbacks and honest degradation (unverifiable claims → `Inference` → proof obligations for validating); khuym's "no code before brief" gate dropped as redundant to Gate 3 + write-guard; D-ID guard added (findings never silently override locked decisions); mid-research "try it" code is a red flag routing to validating's spike.

This decision also sets the **extension precedent** the owner asked for: future purpose-specific skills follow exactly this path — name the uncovered workflow gap in a decision record, build via `bee-writing-skills`, log lineage and Iron Law status in CREATION-LOG.md. The skill count is not a cap; the gate is the cap.

## Rationale

- **The gap is a missing entry point, not a missing protocol.** The reference-only draft fixed L2/L3's thin body but left standalone research homeless — the owner's actual use case ("research a topic, maybe a feature comes later") starts *before* any feature exists.
- **One owner of the protocol, two call sites.** Planning L2/L3 delegates to bee-xia in-chain; the hive routes standalone research requests to it directly. No duplicated protocol text (the earlier planning-side reference file is removed).
- **Precedent for extensibility.** The owner wants bee to grow by purpose-specific skills. A standalone, separately-invocable skill exercises the 0002 gate end-to-end and leaves a template (decision → skill → creation log → routing row).

## Alternatives considered

- **Reference-only inside bee-planning** (the same-day first draft). Rejected by owner: not separately invocable; leaves standalone research routed to a skill that presumes a feature; doesn't establish the extension pattern.
- **Port xia verbatim.** Rejected: hard MCP dependencies against the zero-required-deps posture; separate brief artifact per feature conflicts with the unified plan artifact; its research-before-code gate duplicates Gate 3 enforcement.
- **Do nothing.** Rejected: L2/L3 was a dial without a protocol, and the evidence-label + ladder disciplines exist nowhere else in bee (checked against 01-distillation.md).

## Scope

- New: `skills/bee-xia/` (SKILL.md, references/xia-protocol.md, references/research-brief-template.md, CREATION-LOG.md).
- Edits: `bee-planning/SKILL.md` (§2 L2+ invokes bee-xia in-chain; load line), `bee-hive/references/routing-and-contracts.md` (routing table: standalone research → bee-xia; in-feature research → planning), README (hive table, chain, status), `00-vision.md` (skill count in non-goals).
- Removed: `skills/bee-planning/references/research-protocol.md` (superseded same-day, never merged).
- Not yet: `04-skills-spec.md` entry for bee-xia; RED/GREEN pressure test via `bee-writing-skills` — both owed before 1.0.

## Consequences

- Skill count 11 → 12; discovery at L2/L3 gets deliberately slower and heavier; L0/L1 and tiny/small lanes pay nothing.
- Iron Law debt: bee-xia inherits khuym xia's pressure-test lineage but bee-form scenarios (in-chain merge, capability fallbacks, D-ID guard) are untested — same debt class as the v0.1 skills.
- With no web capabilities configured, briefs lean `Local`/`Inference` and validating inherits more proof obligations — honest degradation, not silent quality loss.
- `docs/history/research/` is a new artifact location; grooming's stale-work sweep should learn it eventually (backlog note, not blocking).
