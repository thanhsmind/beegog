# OKF Integration Review — recommended execution shape

Date: 2026-07-22 · Input to planning (high-risk lane). Reviews the locked CONTEXT.md (20 active
decisions, 2 fresh-eyes loops) and recommends the highest-effectiveness integration path.

## Verdict

The locked design is sound. The remaining risk is not architectural — it is **breadth**: F1 ships
four CLI verbs, a migrator, a coverage checker, an index generator, guard propagation, and a
migration, in one feature. The effectiveness lever left is **ordering**: each slice must land
independently green, and the consumer must be proven against real data before the feature closes.

## Recommended slice order (serial, each independently green)

| Slice | Contents | Why this position |
|---|---|---|
| S1 | Profile area spec + `knowledge.mjs` (frontmatter parser, concept model) + `check` + `docs/knowledge/` skeleton (`index.md` hand-seeded, `log.md`) + tests | The format core. Everything else consumes it. Chain NOT yet wired — nothing can go red. |
| S2 | Ledger self-onboard + verify-chain wiring (`knowledge check` suite) + `release_manifest`/plugin-render propagation | The trap slice (D34): `knowledge.mjs` fails `ledger_parity` as an unrecorded managed file until self-onboard refreshes the ledger. Isolating it answers the open question "can ledger_parity pass mid-feature" in the cheapest place. |
| S3 | `index` (+ `--check`, joins chain) + `list` | Pure generators over S1's model. Byte-identical discipline per D21. |
| S4 | Migrate `advisor-protocol` (coverage report per D35, stub + anchor map per D37) + `critical-patterns.md` → `patterns/` + templates + `work/okf-foundation/` work item | The bundle gains real data. Coverage report asserted in chain from this slice on. |
| S5 | `context` consumer + end-to-end acceptance | Last because it needs S4's data to be verified honestly, not against fixtures. |

**Acceptance test that makes F1 honest (recommend making it S5's verify):**
`bee knowledge context --work okf-foundation --budget 20000` returns a manifest whose files a fresh
session can load and act on — the feature dogfoods its own consumer before closing. If that manifest
is not genuinely useful to a cold session, F1 failed at its purpose regardless of green suites.

## The three risks that remain, and their mitigations

1. **Infrastructure without usage.** F1's value materializes only when sessions read the bundle.
   Mitigation: the S5 acceptance test above, plus recommending F2 open with the cheapest consumer
   bridge — a one-line bee-hive startup step: *when a work item exists for the active feature, run
   `context` and read the manifest* — before any further migration. Usage first, scale second.
2. **Coverage-report scope creep.** D35 is the safety mechanism, but a maximal implementation
   (semantic diffing) could eat a slice by itself. Mitigation: v1 is anchor accounting only — every
   numbered `B*/R*/E*/P*` id in the source appears in exactly one concept's `bee.sources` — nothing
   smarter. The numbering already makes this a set-equality check.
3. **Parser gold-plating.** D12's parser only needs the subset the profile *emits* (bundle is
   authored fresh, D20). Mitigation: write the emitter first, parse exactly its output, fail loudly
   on everything else. The 114 legacy files are the migrator's input problem, not the parser's.

## Explicitly not recommended

- Migrating `workflow-state.md` in F1 under any circumstances (D29/D30 — its map is locked, its
  execution is F2's).
- Wiring `check --strict` as blocking in the chain now. Warnings stay warnings until F2 has
  migrated enough that strictness measures curation, not backlog.
- Skipping pointer stubs "because only one area moves" — the stub + anchor map (D37) is exactly
  the part that must be proven small before F2 repeats it at 7× scale.

## Success metrics (measure at F1 close, baseline now)

- Post-compaction reload: files a fresh session must read to resume okf-foundation — target ≤ 6
  via the manifest (today: unbounded, "scan docs/history + specs").
- `knowledge check` + `index --check` green in the chain; zero OKF errors, warnings enumerated.
- Coverage report for advisor-protocol: 100% of numbered anchors, zero duplicates.
- Anchor map: zero dangling citations into the migrated file (reading-map entries rewired).
