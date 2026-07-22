---
artifact_contract: bee-implement-plan/v1
feature: okf-foundation
lane: high-risk
status: Approved (Gate 2, auto-approved via total bypass 2026-07-22; validation evidence pending before Gate 3)
updated: 2026-07-22
sources: [docs/history/okf-foundation/CONTEXT.md; docs/history/okf-foundation/plan.md; docs/history/okf-foundation/reports/integration-review.md; cells okf-1, okf-2]
decisions: [D2, D4, D10-D13, D15, D17-D38]
---

# okf-foundation — Implement Plan (brief)

## Goal / Success

Bee's knowledge stops being documents that sit there and becomes a validated, machine-selectable
store that improves as work happens (owner directive, D38). Success: a conformant OKF v0.1 bundle
at `docs/knowledge/` (D17) under the Bee Profile (D18/D19/D31/D32); `bee knowledge
check|index|list|context` shipped; one area migrated end-to-end with a machine-checked coverage
report (D29/D35); the consumer proven by dogfood — `context --work okf-foundation --budget 20000`
gives a cold session everything it needs in ≤6 files; then the loop closed by the startup bridge
and promote v1 (S6/S7, D38) before any wide migration.

## Current State

Knowledge is scattered over five kinds (specs, history, learnings, decisions records, REFs) in
three frontmatter conventions across 114 of 593 files; no CLI validates or selects any of it; the
largest spec is 1464 lines and post-compaction sessions re-scan history to orient. Verified
consumers of `docs/specs/`: `inject.mjs:70-95` (filename count — stub-safe), the session-close
mtime nudge (`hooks/bee-session-close.mjs:100-140` — needs D34 treatment), the close guard
(`bee.mjs:1897` — reads state, not specs), `reading-map.md:101-102` anchor citations (D37's job).

## Scope

**In (this feature, 7 slices):** S1 format core · S2 chain wiring · S3 `index`/`list` · S4
advisor-protocol migration + patterns + own work item · S5 `context` + dogfood · S6 startup bridge
· S7 promote v1 (proposals only). **Out (deferred, backlog P66–P69):** `workflow-state.md`
(9-concept map locked in D30 for F2), the other 10 areas, stub deletion, `stale`, full skill
rewiring, host-repo adoption.

## Proposed Approach

Format core with the chain green at every boundary (ledger self-onboard rides okf-1), generators,
then real data, then the consumer against that data, then loop closure — order fixed by the
integration review and D38. Rejected: in-place retrofit (review loop 1), workflow-state as proof
area (review loop 2), report-only chain entry (miscited precedent, withdrawn in D22).

## Technical Design

`knowledge.mjs` follows the `capture.mjs`/`reviews.mjs` shape: pure store logic, no CLI parsing;
`command-registry.mjs` carries the manifest entries; `bee.mjs` `HANDLERS` dispatches (both roots,
mirror-checked). Inside the module: a frontmatter **emitter** defines the YAML subset; the
**parser** accepts exactly that subset and throws typed errors outside it (D12). The concept model
is `{path, type, title, description, tags, timestamp, resource?, bee:{id, lifecycle, areas,
required_context, decisions, sources, lane?, polarity?, critical?, authoritative_for?,
review_status?, supersedes?, superseded_by?}}` (D19/D32). `check` walks only `docs/knowledge/`
(D23), classifies findings into the D4 two-level report, and emits the D13 JSON shape. Generated
indexes (S3) reuse the byte-identical projection discipline of `decisions.mjs:895-902`, HTML-comment
provenance, `--check` freshness. Security surface: none new — read-only verbs over repo files; no
network, no secrets paths (the privacy guard's secret-shaped globs never match `docs/knowledge/`);
store writes remain in their existing CLIs (D2).

## Affected Files (S1, from cells)

`okf-1`: `.bee/bin/lib/knowledge.mjs` + template mirror, `command-registry.mjs` ×2, `bee.mjs` ×2,
`templates/tests/test_knowledge.mjs`, ledger/manifest refresh. `okf-2`: `docs/knowledge/index.md`,
`docs/knowledge/log.md`, `docs/specs/okf-profile.md`, `docs/specs/reading-map.md`.

## Implementation Steps

okf-1 (ceiling tier, RED-first tests, full-chain verify) → okf-2 (depends on okf-1; skeleton +
profile spec; verify = `knowledge check` green + full chain). S2–S7 cells are cut when each slice
becomes current (D2 of planning).

## Validation Plan

Will check (nothing asserted yet): the three open questions from `plan.md` — (1) ledger refresh
for a new lib file reachable mid-feature without full onboarding `--apply`; (2) advisor-protocol's
mechanical anchor inventory as the D35 denominator; (3) `templates/tests/` discovery of
`test_knowledge.mjs` incl. Windows CI. Evidence lands in `docs/history/okf-foundation/reports/`
and this section is patched with links before Gate 3.

## Risks & Mitigation

Per `plan.md` risk map: parser LOW-MED (emitter-first, loud failure); ledger mid-feature MED
(rides okf-1, full-chain verify makes red impossible to cap); coverage v1 MED (anchor set-equality
only); promote v1 HIGH (proposals only, own validating pass when current). Cross-platform: CRLF +
path separators exercised in the test suite; CI runs Linux + Windows.

## Rollback Plan

One commit per cell with the cell id — revert in reverse dependency order: `git revert <okf-2>`
then `<okf-1>` restores a tree with no `knowledge` command group, no bundle skeleton, no registry
entries; then re-run the self-onboard so `.bee/onboarding.json`'s ledger drops the removed lib
hashes and `ledger_parity`/`release_manifest --check` return green (same mechanism as the roll
forward, opposite direction — validated in open question 1). No data migration to reverse in S1:
legacy trees are untouched (D23), and the S4 stub swap is its own cell with its own revert.
Rollback leaves `.bee/decisions.jsonl` history intact (append-only; superseding decisions is the
correction path, never history rewrites).

## Open Questions

The three validation items above; plus S6's exact prose placement (AGENTS.md step vs bee-hive
SKILL.md — decided at S6 planning, not now) and S7's proposal-review UX (owner will see concept
diffs; format decided when S7 becomes current).
