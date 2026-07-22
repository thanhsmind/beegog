---
area: critical-patterns
updated: 2026-07-22
migrated_to: docs/knowledge/patterns/
---

# Critical Patterns (migrated — pointer stub)

Bee's hard-won patterns now live as individual `bee.pattern` concepts in the knowledge bundle:
[`docs/knowledge/patterns/`](../../knowledge/patterns/index.md) (okf-foundation D20/D34/D37). Each
concept carries `bee.critical: true`, so the bundle's own generated root index
(`docs/knowledge/index.md`, "## Critical patterns" section, D21) is now the live equivalent of the
list this file used to hand-maintain — regenerate it with `bee knowledge index` instead of
appending here.

`AGENTS.md` step 6 now branches (okf-integration-close-f4): **with a bundle** it sends the reader to
the generated index's "Critical patterns" section, not here; **with no bundle** it still reads this
path, unchanged. Either way this stub stays alive and is **never deleted** (D20), so every existing
citation of it keeps resolving. But in a repo that has a bundle, the curated content is the bundle:
read `docs/knowledge/patterns/` for the mandatory pre-planning context, and treat anything below as
a forwarding address rather than a lesson.

Coverage is machine-checked by `scripts/okf_migrate.mjs --check-patterns` in the verify chain
(D35): every numbered anchor below is claimed by exactly one concept, and the map agrees with each
concept's own `bee.sources` claim.

## Anchor map

One `PATn` anchor per `## [YYYYMMDD] ...` heading this file used to carry, assigned in the file's
own pre-migration document order (oldest anchor number is NOT the oldest date — entries were not
chronologically sorted in the original file; anchor order follows the heading order as it stood at
migration time).

| Anchor | Now owned by | Was |
|---|---|---|
| PAT1 | [docs/knowledge/patterns/20260721-race-tests-assert-structure-never-scheduler-luck.md](../../knowledge/patterns/20260721-race-tests-assert-structure-never-scheduler-luck.md) | Race tests assert structure, never scheduler luck — and a race harness that hides the child's stderr is itself a bug |
| PAT2 | [docs/knowledge/patterns/20260716-a-tolerant-regression-net-frozen-green-before-the.md](../../knowledge/patterns/20260716-a-tolerant-regression-net-frozen-green-before-the.md) | A tolerant regression net, frozen green BEFORE the edit, is what makes a load-bearing function safe to change |
| PAT3 | [docs/knowledge/patterns/20260716-realize-a-structural-model-via-git-config-not.md](../../knowledge/patterns/20260716-realize-a-structural-model-via-git-config-not.md) | Realize a structural model via git config, not a file migration, when the boundaries already exist |
| PAT4 | [docs/knowledge/patterns/20260715-the-bill-is-turns-prefix-keep-the-prefix.md](../../knowledge/patterns/20260715-the-bill-is-turns-prefix-keep-the-prefix.md) | The bill is turns × prefix: keep the prefix immutable, warm, and lean |
| PAT5 | [docs/knowledge/patterns/20260715-a-guard-scoped-inside-a-skippable-loop-is.md](../../knowledge/patterns/20260715-a-guard-scoped-inside-a-skippable-loop-is.md) | A guard scoped inside a skippable loop is absent on the path that skips it |
| PAT6 | [docs/knowledge/patterns/20260714-a-state-name-that-asserts-history-with-nothing.md](../../knowledge/patterns/20260714-a-state-name-that-asserts-history-with-nothing.md) | A state name that ASSERTS history, with nothing checking it, becomes the shortcut |
| PAT7 | [docs/knowledge/patterns/20260714-hardcoded-fixture-file-lists-rot-silently.md](../../knowledge/patterns/20260714-hardcoded-fixture-file-lists-rot-silently.md) | Hardcoded fixture file-lists rot silently — and fail-open makes rot look like PASS |
| PAT8 | [docs/knowledge/patterns/20260708-windows-git-bash-tmp-is-invisible-to-node.md](../../knowledge/patterns/20260708-windows-git-bash-tmp-is-invisible-to-node.md) | Windows Git Bash /tmp is invisible to node |
| PAT9 | [docs/knowledge/patterns/20260708-verify-strings-are-authored-not-just-read.md](../../knowledge/patterns/20260708-verify-strings-are-authored-not-just-read.md) | Verify strings are authored, not just read — two traps |
| PAT10 | [docs/knowledge/patterns/20260710-a-boundary-that-lists-field-names-will-leak.md](../../knowledge/patterns/20260710-a-boundary-that-lists-field-names-will-leak.md) | A boundary that lists field names will leak the field you forgot |
| PAT11 | [docs/knowledge/patterns/20260710-a-frozen-assertion-can-encode-the-defect-it.md](../../knowledge/patterns/20260710-a-frozen-assertion-can-encode-the-defect-it.md) | A frozen assertion can encode the defect it guards — the worker must stop, not rewrite |
| PAT12 | [docs/knowledge/patterns/20260710-evidence-is-checkpointed-to-disk-per-step-never.md](../../knowledge/patterns/20260710-evidence-is-checkpointed-to-disk-per-step-never.md) | Evidence is checkpointed to disk per step, never held in context until the end |
| PAT13 | [docs/knowledge/patterns/20260710-never-release-another-agents-reservations-on-a-stall.md](../../knowledge/patterns/20260710-never-release-another-agents-reservations-on-a-stall.md) | Never release another agent's reservations on a stall signal |
| PAT14 | [docs/knowledge/patterns/20260710-a-nul-byte-in-a-source-file-makes.md](../../knowledge/patterns/20260710-a-nul-byte-in-a-source-file-makes.md) | A NUL byte in a source file makes grep silently match nothing |
| PAT15 | [docs/knowledge/patterns/20260710-a-plan-that-names-a-source-must-name.md](../../knowledge/patterns/20260710-a-plan-that-names-a-source-must-name.md) | A plan that names a source must name the reader that can open it |
| PAT16 | [docs/knowledge/patterns/20260710-a-non-exposure-invariant-needs-a-test-on.md](../../knowledge/patterns/20260710-a-non-exposure-invariant-needs-a-test-on.md) | A non-exposure invariant needs a test on every output surface it crosses |
| PAT17 | [docs/knowledge/patterns/20260710-scope-an-incident-born-check-to-the-defect.md](../../knowledge/patterns/20260710-scope-an-incident-born-check-to-the-defect.md) | Scope an incident-born check to the defect class, never the first location |
| PAT18 | [docs/knowledge/patterns/20260711-a-removal-is-verified-by-its-invariants-not.md](../../knowledge/patterns/20260711-a-removal-is-verified-by-its-invariants-not.md) | A removal is verified by its invariants, not the names it deletes |
| PAT19 | [docs/knowledge/patterns/20260711-pre-code-gates-filter-spec-defects-only-diff.md](../../knowledge/patterns/20260711-pre-code-gates-filter-spec-defects-only-diff.md) | Pre-code gates filter spec defects; only diff review catches implementation defects |
| PAT20 | [docs/knowledge/patterns/20260711-a-control-token-in-free-text-is-injectable.md](../../knowledge/patterns/20260711-a-control-token-in-free-text-is-injectable.md) | A control token in free text is injectable by construction; a fail-open contract needs malformed-input rows |
| PAT21 | [docs/knowledge/patterns/20260711-a-reviewers-cited-line-is-a-sample-of.md](../../knowledge/patterns/20260711-a-reviewers-cited-line-is-a-sample-of.md) | A reviewer's cited line is a sample of a class — sweep the diff before re-review |
| PAT22 | [docs/knowledge/patterns/20260711-never-poll-scratchpad-files-to-wait-for-your.md](../../knowledge/patterns/20260711-never-poll-scratchpad-files-to-wait-for-your.md) | Never poll scratchpad files to wait for your own background subagents |
| PAT23 | [docs/knowledge/patterns/20260711-a-decision-attributed-to-the-user-needs-a.md](../../knowledge/patterns/20260711-a-decision-attributed-to-the-user-needs-a.md) | A decision attributed to the user needs a traceable in-session quote |
| PAT24 | [docs/knowledge/patterns/20260712-enumerated-move-trap-in-migration-cells.md](../../knowledge/patterns/20260712-enumerated-move-trap-in-migration-cells.md) | Enumerated-move trap in migration cells |
| PAT25 | [docs/knowledge/patterns/20260712-cross-cell-contracts-and-census-carriers-are-plan.md](../../knowledge/patterns/20260712-cross-cell-contracts-and-census-carriers-are-plan.md) | Cross-cell contracts and census carriers are plan-authoring work, not validation work |
| PAT26 | [docs/knowledge/patterns/20260712-dry-run-negative-grep-verifies-against-their-own.md](../../knowledge/patterns/20260712-dry-run-negative-grep-verifies-against-their-own.md) | Dry-run negative-grep verifies against their own fixtures |
| PAT27 | [docs/knowledge/patterns/20260712-empty-child-process-output-can-be-a-sandbox.md](../../knowledge/patterns/20260712-empty-child-process-output-can-be-a-sandbox.md) | Empty child-process output can be a sandbox denial, not a regression |
| PAT28 | [docs/knowledge/patterns/20260712-fixture-vendored-module-lists-break-on-transitive-imports.md](../../knowledge/patterns/20260712-fixture-vendored-module-lists-break-on-transitive-imports.md) | Fixture vendored-module lists break on transitive imports |
| PAT29 | [docs/knowledge/patterns/20260713-a-shared-suite-red-is-not-yours-while.md](../../knowledge/patterns/20260713-a-shared-suite-red-is-not-yours-while.md) | A shared-suite red is not yours while a sibling cell is in flight |
| PAT30 | [docs/knowledge/patterns/20260713-promote-an-order-to-the-always-loaded-layer.md](../../knowledge/patterns/20260713-promote-an-order-to-the-always-loaded-layer.md) | Promote an order to the always-loaded layer and its transport must ride along |
| PAT31 | [docs/knowledge/patterns/20260713-a-guard-that-tests-one-state-is-a.md](../../knowledge/patterns/20260713-a-guard-that-tests-one-state-is-a.md) | A guard that tests one state is a law with a hole |
| PAT32 | [docs/knowledge/patterns/20260714-a-fail-open-host-swallows-fail-closed-throws.md](../../knowledge/patterns/20260714-a-fail-open-host-swallows-fail-closed-throws.md) | A fail-open host swallows fail-closed throws into an allow |
| PAT33 | [docs/knowledge/patterns/20260714-non-ascii-in-a-ps1-without-bom-is.md](../../knowledge/patterns/20260714-non-ascii-in-a-ps1-without-bom-is.md) | Non-ASCII in a .ps1 without BOM is a parse-time bomb on Windows PowerShell 5.1 |
| PAT34 | [docs/knowledge/patterns/20260714-agent-runtime-discovery-paths-are-version-moving-targets.md](../../knowledge/patterns/20260714-agent-runtime-discovery-paths-are-version-moving-targets.md) | Agent-runtime discovery paths are version-moving targets — probe the binary, not memory |
| PAT35 | [docs/knowledge/patterns/20260714-async-assertions-under-a-non-awaiting-runner-pass.md](../../knowledge/patterns/20260714-async-assertions-under-a-non-awaiting-runner-pass.md) | Async assertions under a non-awaiting runner pass vacuously |
| PAT36 | [docs/knowledge/patterns/20260715-a-freeze-fixtures-wrapper-verify-must-assert-a.md](../../knowledge/patterns/20260715-a-freeze-fixtures-wrapper-verify-must-assert-a.md) | A freeze fixture's wrapper verify must assert a printed sentinel, not a filename or bare exit |
| PAT37 | [docs/knowledge/patterns/20260715-shipping-a-lib-file-means-shipping-the-manifest.md](../../knowledge/patterns/20260715-shipping-a-lib-file-means-shipping-the-manifest.md) | Shipping a lib file means shipping the manifest: regen release-manifest inside the feature |
| PAT38 | [docs/knowledge/patterns/20260719-with-concurrent-sessions-possible-the-claim-precedes-the.md](../../knowledge/patterns/20260719-with-concurrent-sessions-possible-the-claim-precedes-the.md) | With concurrent sessions possible, the claim precedes the spawn — and session ids are self-derived, never handed down |
| PAT39 | [docs/knowledge/patterns/20260720-a-cell-that-changes-a-shared-mutator-surface.md](../../knowledge/patterns/20260720-a-cell-that-changes-a-shared-mutator-surface.md) | A cell that changes a shared mutator surface re-runs the sibling suites of that surface — its own new suite is not enough |
| PAT40 | [docs/knowledge/patterns/20260720-a-structural-review-never-satisfies-the-adversarial-obligation.md](../../knowledge/patterns/20260720-a-structural-review-never-satisfies-the-adversarial-obligation.md) | A structural review never satisfies the adversarial obligation for an abuse-stopping rule |
| PAT41 | [docs/knowledge/patterns/20260716-a-cell-dependency-in-the-wrong-field-name.md](../../knowledge/patterns/20260716-a-cell-dependency-in-the-wrong-field-name.md) | A cell dependency in the wrong field name is silently ignored — verify the wave, not the write |
| PAT42 | [docs/knowledge/patterns/20260719-a-shared-checkout-with-a-second-live-session.md](../../knowledge/patterns/20260719-a-shared-checkout-with-a-second-live-session.md) | A shared checkout with a second live session: check the out-of-scope tree before a blocking verify, and diff before diagnosing "flaky" |
| PAT43 | [docs/knowledge/patterns/20260720-a-feature-is-not-a-release-re-inspect.md](../../knowledge/patterns/20260720-a-feature-is-not-a-release-re-inspect.md) | A feature is not a release: re-inspect the whole working tree at close, and never let the version tuple move without explicit release intent |
| PAT44 | [docs/knowledge/patterns/20260720-measure-the-contention-topology-before-adding-coordination-machinery.md](../../knowledge/patterns/20260720-measure-the-contention-topology-before-adding-coordination-machinery.md) | Measure the contention topology before adding coordination machinery |
| PAT45 | [docs/knowledge/patterns/20260721-shared-file-axes-must-be-sequenced-at-dispatch.md](../../knowledge/patterns/20260721-shared-file-axes-must-be-sequenced-at-dispatch.md) | Shared-file axes must be sequenced at dispatch time; a worker's "watcher" dies with its turn |
| PAT46 | [docs/knowledge/patterns/20260721-local-green-is-worthless-if-suites-inherit-harness.md](../../knowledge/patterns/20260721-local-green-is-worthless-if-suites-inherit-harness.md) | Local green is worthless if suites inherit harness env — hermeticity must be structural, and the release gate is the exact-tag CI |
| PAT47 | [docs/knowledge/patterns/20260721-locks-guarding-long-synchronous-child-spawns-cannot-be.md](../../knowledge/patterns/20260721-locks-guarding-long-synchronous-child-spawns-cannot-be.md) | Locks guarding long synchronous child spawns cannot be heartbeat-renewed — probe owner liveness instead |
