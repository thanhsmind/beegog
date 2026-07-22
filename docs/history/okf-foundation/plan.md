---
artifact_contract: bee-plan/v1
mode: high-risk
feature: okf-foundation
updated: 2026-07-22
approved_gate2: 2026-07-22 (auto-approved, gate_bypass=total)
sources: [docs/history/okf-foundation/CONTEXT.md (D2-D38, 2 fresh-eyes loops); docs/history/okf-foundation/reports/integration-review.md (slice order + metrics)]
decisions: [D17-D38 active set; D38 owner directive — loop closure over coverage]
---

# okf-foundation — Plan

## Mode gate (mechanical record)

Flags counted: **data model** (bee's document model is replaced), **public contracts** (new CLI
command group + managed-file set + plugin renders change), **multi-domain** (CLI lib, verify chain,
hooks, skill templates, docs), **changes behavior an existing suite asserts** (`ledger_parity.mjs`
and `release_manifest --check` both gate the new files until refreshed) = **4 flags → high-risk**.
Product files: ~14 across slices (lib module ×2 roots, registry ×2, dispatcher wiring, tests,
hook, migrator, templates). Smaller modes are insufficient: no single-file path exists — the
smallest honest unit is a slice, and slice 1 alone touches both managed lib roots plus the ledger.

## Discovery

**L1** (verified, no candidates worth a discovery.md): OKF v0.1 spec fetched from the normative
source and its MUST/SHOULD split recorded in CONTEXT.md §Canonical References. Repo precedent for
every mechanism exists and is cited: generated projection with `--check` (`decisions.mjs:895-902`),
chain suite (`ledger_parity.mjs`), store-module shape (`capture.mjs`/`reviews.mjs`). Precedent beats
research; nothing here is unfamiliar territory.

## Approach

**Chosen path:** build the format core first with the chain kept green at every slice boundary
(the ledger self-onboard rides the same cell that adds `knowledge.mjs` — resolving the open
question from CONTEXT.md: the chain must never be red between cells, so the refresh cannot be a
later cell); generators next; then data (one migrated area + this feature's own work item); the
consumer proven against that real data; then the two loop-closing slices D38 ordered ahead of wide
migration (startup bridge, promote v1).

**Rejected alternatives:** big-bang retrofit of `docs/` in place (killed by review loop 1 — 593
files, three frontmatter schemas, unfixable timestamp semantics); `workflow-state.md` as proof area
(killed by review loop 2 — 1464 lines, BA-template structure, ~700 lines homeless under a heading
split; its 9-concept map is locked in D30 for F2); report-only chain entry (precedent was miscited;
withdrawn in D22).

**Risk map:**

| Component | Risk | Proof |
|---|---|---|
| Frontmatter parser (D12, no deps) | LOW-MED | Parses only what the profile emits; emitter written first; loud failure outside subset. Validating: worst-case emitted value round-trips. |
| Ledger/manifest mid-feature (D34) | MED | okf-1's verify is the full chain — the cell cannot cap red. Validating: prove the self-onboard path refreshes `.bee/onboarding.json` hashes for a new lib file. |
| Coverage report v1 (D35) | MED | Anchor accounting only — set equality over numbered `B*/R*` ids. Validating: advisor-protocol's anchor inventory extracted mechanically. |
| `context` ranking (D27) | LOW | Manifest, not content; bytes/4 estimator declared. |
| Startup bridge (S6) | LOW | One prose step + one status field; no new runtime. |
| Promote v1 (S7) | HIGH | Semantic distillation — scoped to *proposing* concept diffs for human/agent review, never auto-writing truth. Gets its own validating pass when its slice becomes current. |

**File order (S1, revised after validation panel — one atomic cell, propagation explicit):**
templates are the source of truth (`onboard_bee.mjs:2837-2841` hashes from `TEMPLATES_LIB_DIR`).
(1) author `knowledge.mjs`, `command-registry.mjs`, `bee.mjs` in `skills/bee-hive/templates/` AND
`.bee/bin/`; `test_knowledge.mjs` in `templates/tests/` only (RED first) →
(2) `node skills/bee-hive/scripts/onboard_bee.mjs --repo-root . --apply` (syncs `.claude/`+`.agents/`
mirrors, refreshes the `.bee/onboarding.json` ledger — `listTemplateLibModules()` auto-records the
new module) → (3) `node scripts/render_plugin_skill_trees.mjs` (regenerates `.claude-plugin/` +
`.codex-plugin/` — `test_plugin_distribution.mjs:317-329` byte-pins these against canonical) →
(4) `node scripts/release_manifest.mjs --write` (snapshots the render trees last) →
(5) `node scripts/run_verify.mjs`. All generated/synced files ride the same cell commit — a
split cell would leave an intermediate commit red on the drift-pins (the v1.9.0 incident class),
so S1's core and its propagation are deliberately one atomic cell. Then okf-2: `docs/knowledge/`
skeleton → `docs/specs/okf-profile.md`. Gating suites for S1: `test_knowledge` (new),
`test_lib_mirror`, `ledger_parity`, `test_plugin_distribution`, `release_manifest --check`,
`test_bee_cli`/help-manifest conformance.

## Slices

| # | Slice | Exit state |
|---|---|---|
| S1 | Format core: profile area spec, `knowledge.mjs` (parser + concept model + `check`), registry/dispatcher wiring, template mirror, test suite, ledger+manifest refresh, `docs/knowledge/` skeleton | `bee knowledge check --json` exits 0 on the skeleton; **full chain green** |
| S2 | Chain wiring: `knowledge check` as a chain suite; `index --check` reserved for S3 | Chain green with the new suite in `EXTRA_SUITES` |
| S3 | Generators: `index` (byte-identical, `--check`) + `list` | Regenerating changes zero bytes; stale index detected |
| S4 | Data: migrate `advisor-protocol` (coverage report D35, stub + anchor map D37), `critical-patterns.md` → `patterns/`, templates, `work/okf-foundation/` work item | Coverage report 100%/0 dup; zero dangling anchors; chain green |
| S5 | Consumer: `context --work --budget` + dogfood acceptance | `context --work okf-foundation --budget 20000` returns a manifest a cold session can act on |
| S6 | Startup bridge (D38): bee-hive/AGENTS.md step — when the active feature has a work item, run `context` and read the manifest; session preamble surfaces it | A fresh session on this repo loads okf-foundation from the manifest, ≤6 files |
| S7 | Promote v1 (D38): `knowledge promote --work <id>` proposes concept diffs from cell traces + delivery — proposals, never silent truth-writes | A capped cell's trace yields a reviewable concept diff; applying it passes `check` |

Cells are created for the current slice only (D2); S2+ cells are cut when their slice becomes
current. Slice boundaries honor every locked decision they touch; if any slice cannot, the answer
is SPLIT RECOMMENDED, never scope shrink.

## Test matrix sketch (12 edge dimensions, high-risk depth at S1/S4/S7)

Boundary: empty bundle, empty frontmatter, frontmatter-only file · Malformed: unclosed `---`,
tabs-in-YAML, non-UTF8 → loud typed failure (D12) · Duplicates: `bee.id` collision, two
`authoritative_for` the same subject (D31) · Ordering: index byte-determinism across OS/dir order ·
State: stale index vs `--check`; ledger before/after self-onboard · Scale: 593-file legacy tree
must stay untouched (D23 — check never reads outside the bundle) · Idempotence: migrator re-run
changes zero bytes · Links: dangling `required_context`, cycle → dedupe not error (D27) · Unicode:
Vietnamese titles round-trip · Concurrency: none new (read-only verbs; store writes stay in their
CLIs, D2) · Permissions: n/a · Cross-platform: Windows CRLF + path separators in bundle-relative
links (CI runs both).

## Open questions for validating

1. Prove a new `.bee/bin/lib/*.mjs` can be ledger-refreshed without a full onboarding `--apply`
   (which path in `onboard_bee.mjs` records the hash, and is it reachable mid-feature?).
2. Extract advisor-protocol's anchor inventory (B*/R* count) mechanically — the D35 denominator.
3. Confirm `test_knowledge.mjs` under `templates/tests/` is discovered by `run_verify` without
   registration (`run_verify.mjs:40-43`) and runs on Windows CI.
