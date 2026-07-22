---
area: okf-profile
updated: 2026-07-22
migrated_to: docs/knowledge/areas/okf-profile/
---

# Bee OKF Profile (migrated — pointer stub)

The spec that DEFINES the bundle now lives inside it:
[`docs/knowledge/areas/okf-profile/`](../knowledge/areas/okf-profile/index.md)
(okf-switchover-f3 G6, okf-foundation D20/D37). Purpose, the entry-point verbs,
actors and open gaps are in `overview.md`; the nine closed concept types, the
frontmatter field rules and their id/path direction, the per-subject authority
rules, the legacy carry-over map and the four canonical worked examples with the
body contract and the rebuild bar in `concept-model-and-authoring.md`; the
two-level check, its exact OKF-error / profile-error / profile-warning codes, the
emitter-first codec and the checker's never-writes boundary in
`conformance-check.md`; the budget-aware `context` manifest, the measured
relevance ranking that cuts critical patterns without losing one, the
propose-never-write `promote` loop closer and the session preamble in
`context-and-promote.md`; the coverage report, the content-addressed pin, the
unparsed report, the fidelity floor, the drift telemetry and the pointer-stub
anchor map in `migration-and-coverage-gates.md`. This path stays alive as a
pointer stub — it is never deleted in this feature (D20) — and the anchor map
below sends every numbered anchor the old spec exposed to the concept that now
owns it, so existing citations keep resolving. Coverage is machine-checked by
`scripts/okf_migrate.mjs --check okf-profile` in the verify chain (D35), against
the pinned pre-migration blob `9267d3e` (`53d8111`, 24 anchors, 17 unparsed
blocks — okf-migration-f2 F8).

## Anchor map

Edge Cases bullets carry `E` ids and Pointers bullets carry `P` ids, assigned in
the source's document order at migration time. `B6b` is a REFINEMENT suffix — it
refines `B6`'s budget cut with the relevance ranking — not a disambiguation
suffix, and both ids are live. The seventeen block starts the extractor could not
classify carry no id and none was invented (D10): five in Behaviors & Operations
travel with `B6`, `B6b` and `B10`, the block each sits in; the nine `Business
Rules` bullets carry no `R` id at all in this source, so this area has **no `R`
anchors** and those nine rules were re-homed verbatim into the concept whose
subject each states; the last three are Templates prose that the fence-blind
extractor accounts to Pointers, and they travel with the Templates section into
`concept-model-and-authoring.md`.

| Anchor | Now owned by | Was |
|---|---|---|
| B1 | [docs/knowledge/areas/okf-profile/conformance-check.md](../knowledge/areas/okf-profile/conformance-check.md) | two-level check, OKF errors vs. profile findings |
| B2 | [docs/knowledge/areas/okf-profile/conformance-check.md](../knowledge/areas/okf-profile/conformance-check.md) | the exact finding codes the checker emits |
| B3 | [docs/knowledge/areas/okf-profile/conformance-check.md](../knowledge/areas/okf-profile/conformance-check.md) | emitter-first parsing, zero dependencies |
| B4 | [docs/knowledge/areas/okf-profile/conformance-check.md](../knowledge/areas/okf-profile/conformance-check.md) | the bundle is read-only from the checker's side |
| B5 | [docs/knowledge/areas/okf-profile/context-and-promote.md](../knowledge/areas/okf-profile/context-and-promote.md) | `promote` proposes; it never writes |
| B6 | [docs/knowledge/areas/okf-profile/context-and-promote.md](../knowledge/areas/okf-profile/context-and-promote.md) | `context` returns a manifest, never content |
| B6b | [docs/knowledge/areas/okf-profile/context-and-promote.md](../knowledge/areas/okf-profile/context-and-promote.md) | critical patterns ranked by relevance, cut, floored and conserved |
| B7 | [docs/knowledge/areas/okf-profile/context-and-promote.md](../knowledge/areas/okf-profile/context-and-promote.md) | the session preamble makes the bundle load-bearing |
| B8 | [docs/knowledge/areas/okf-profile/migration-and-coverage-gates.md](../knowledge/areas/okf-profile/migration-and-coverage-gates.md) | migration is gated by anchor coverage |
| B9 | [docs/knowledge/areas/okf-profile/migration-and-coverage-gates.md](../knowledge/areas/okf-profile/migration-and-coverage-gates.md) | a pin is content-addressed, and no unverified extraction may read as a pass |
| B10 | [docs/knowledge/areas/okf-profile/migration-and-coverage-gates.md](../knowledge/areas/okf-profile/migration-and-coverage-gates.md) | the extractor reports what it could not read |
| B11 | [docs/knowledge/areas/okf-profile/migration-and-coverage-gates.md](../knowledge/areas/okf-profile/migration-and-coverage-gates.md) | the fidelity floor measures whether content was migrated or summarised away |
| B12 | [docs/knowledge/areas/okf-profile/migration-and-coverage-gates.md](../knowledge/areas/okf-profile/migration-and-coverage-gates.md) | drift telemetry compares only comparable shapes |
| E1 | [docs/knowledge/areas/okf-profile/concept-model-and-authoring.md](../knowledge/areas/okf-profile/concept-model-and-authoring.md) | a concept is any non-reserved `.md` inside the bundle |
| E2 | [docs/knowledge/areas/okf-profile/conformance-check.md](../knowledge/areas/okf-profile/conformance-check.md) | a parsing but hand-edited frontmatter block is `not_canonical`, never a silent pass |
| E3 | [docs/knowledge/areas/okf-profile/migration-and-coverage-gates.md](../knowledge/areas/okf-profile/migration-and-coverage-gates.md) | a pointer stub is authored in the same cell as the citations into it |
| E4 | [docs/knowledge/areas/okf-profile/migration-and-coverage-gates.md](../knowledge/areas/okf-profile/migration-and-coverage-gates.md) | migrated legacy files are not deleted in this feature |
| P1 | [docs/knowledge/areas/okf-profile/conformance-check.md](../knowledge/areas/okf-profile/conformance-check.md) | checker + emitter-first codec + concept model |
| P2 | [docs/knowledge/areas/okf-profile/context-and-promote.md](../knowledge/areas/okf-profile/context-and-promote.md) | the proposal builder and its read-only cell-trace view |
| P3 | [docs/knowledge/areas/okf-profile/context-and-promote.md](../knowledge/areas/okf-profile/context-and-promote.md) | CLI wiring for the `knowledge` group |
| P4 | [docs/knowledge/areas/okf-profile/overview.md](../knowledge/areas/okf-profile/overview.md) | the bundle itself |
| P5 | [docs/knowledge/areas/okf-profile/migration-and-coverage-gates.md](../knowledge/areas/okf-profile/migration-and-coverage-gates.md) | F1's proof area, still in its legacy location |
| P6 | [docs/knowledge/areas/okf-profile/overview.md](../knowledge/areas/okf-profile/overview.md) | the locked decisions this profile implements exactly |
| P7 | [docs/knowledge/areas/okf-profile/overview.md](../knowledge/areas/okf-profile/overview.md) | the normative OKF v0.1 spec and the profile-as-open-proposal |
