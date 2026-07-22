---
okf_version: 0.1
---
<!--
GENERATED FILE — do not hand-edit.
Rendered by `bee knowledge index` from concept frontmatter inside docs/knowledge/ (okf-foundation D21).
Regenerate: `bee knowledge index`. Check freshness: `bee knowledge index --check`.
Deterministic: byte-identical for the same bundle contents — path-sorted entries, LF endings,
never a generation timestamp or any other wall-clock value.
-->

# Knowledge Bundle

## Sections

- [areas/](areas/index.md) — 11 concept(s)
- [patterns/](patterns/index.md) — 49 concept(s)
- [work/](work/index.md) — 3 concept(s)

## Critical patterns

- [Verify strings are authored, not just read — two traps](patterns/20260708-verify-strings-are-authored-not-just-read.md) — A cell’s verify command must be dry-run once before it reaches a worker, not reviewed as prose
- [Windows Git Bash /tmp is invisible to node](patterns/20260708-windows-git-bash-tmp-is-invisible-to-node.md) — Windows Git Bash /tmp is invisible to node
- [A boundary that lists field names will leak the field you forgot](patterns/20260710-a-boundary-that-lists-field-names-will-leak.md) — A boundary that lists field names will leak the field you forgot
- [A frozen assertion can encode the defect it guards — the worker must stop, not rewrite](patterns/20260710-a-frozen-assertion-can-encode-the-defect-it.md) — The worker must stop, not rewrite
- [A non-exposure invariant needs a test on every output surface it crosses](patterns/20260710-a-non-exposure-invariant-needs-a-test-on.md) — A non-exposure invariant needs a test on every output surface it crosses
- [A NUL byte in a source file makes grep silently match nothing](patterns/20260710-a-nul-byte-in-a-source-file-makes.md) — A NUL byte in a source file makes grep silently match nothing
- [A plan that names a source must name the reader that can open it](patterns/20260710-a-plan-that-names-a-source-must-name.md) — A plan that names a source must name the reader that can open it
- [Evidence is checkpointed to disk per step, never held in context until the end](patterns/20260710-evidence-is-checkpointed-to-disk-per-step-never.md) — Evidence is checkpointed to disk per step, never held in context until the end
- [Never release another agent's reservations on a stall signal](patterns/20260710-never-release-another-agents-reservations-on-a-stall.md) — Never release another agent's reservations on a stall signal
- [Scope an incident-born check to the defect class, never the first location](patterns/20260710-scope-an-incident-born-check-to-the-defect.md) — Scope an incident-born check to the defect class, never the first location
- [A control token in free text is injectable by construction; a fail-open contract needs malformed-input rows](patterns/20260711-a-control-token-in-free-text-is-injectable.md) — A control token in free text is injectable by construction; a fail-open contract needs malformed-input rows
- [A decision attributed to the user needs a traceable in-session quote](patterns/20260711-a-decision-attributed-to-the-user-needs-a.md) — A decision attributed to the user needs a traceable in-session quote
- [A removal is verified by its invariants, not the names it deletes](patterns/20260711-a-removal-is-verified-by-its-invariants-not.md) — A removal is verified by its invariants, not the names it deletes
- [A reviewer's cited line is a sample of a class — sweep the diff before re-review](patterns/20260711-a-reviewers-cited-line-is-a-sample-of.md) — Sweep the diff before re-review
- [Never poll scratchpad files to wait for your own background subagents](patterns/20260711-never-poll-scratchpad-files-to-wait-for-your.md) — Never poll scratchpad files to wait for your own background subagents
- [Pre-code gates filter spec defects; only diff review catches implementation defects](patterns/20260711-pre-code-gates-filter-spec-defects-only-diff.md) — Pre-code gates filter spec defects; only diff review catches implementation defects
- [Cross-cell contracts and census carriers are plan-authoring work, not validation work](patterns/20260712-cross-cell-contracts-and-census-carriers-are-plan.md) — Cross-cell contracts and census carriers are plan-authoring work, not validation work
- [Dry-run negative-grep verifies against their own fixtures](patterns/20260712-dry-run-negative-grep-verifies-against-their-own.md) — Dry-run negative-grep verifies against their own fixtures
- [Empty child-process output can be a sandbox denial, not a regression](patterns/20260712-empty-child-process-output-can-be-a-sandbox.md) — Empty child-process output can be a sandbox denial, not a regression
- [Enumerated-move trap in migration cells](patterns/20260712-enumerated-move-trap-in-migration-cells.md) — Enumerated-move trap in migration cells
- [Fixture vendored-module lists break on transitive imports](patterns/20260712-fixture-vendored-module-lists-break-on-transitive-imports.md) — Fixture vendored-module lists break on transitive imports
- [A guard that tests one state is a law with a hole](patterns/20260713-a-guard-that-tests-one-state-is-a.md) — A guard that tests one state is a law with a hole
- [A shared-suite red is not yours while a sibling cell is in flight](patterns/20260713-a-shared-suite-red-is-not-yours-while.md) — A shared-suite red is not yours while a sibling cell is in flight
- [Promote an order to the always-loaded layer and its transport must ride along](patterns/20260713-promote-an-order-to-the-always-loaded-layer.md) — Promote an order to the always-loaded layer and its transport must ride along
- [A fail-open host swallows fail-closed throws into an allow](patterns/20260714-a-fail-open-host-swallows-fail-closed-throws.md) — A fail-open host swallows fail-closed throws into an allow
- [A state name that ASSERTS history, with nothing checking it, becomes the shortcut](patterns/20260714-a-state-name-that-asserts-history-with-nothing.md) — A state name that ASSERTS history, with nothing checking it, becomes the shortcut
- [Agent-runtime discovery paths are version-moving targets — probe the binary, not memory](patterns/20260714-agent-runtime-discovery-paths-are-version-moving-targets.md) — Probe the binary, not memory
- [Async assertions under a non-awaiting runner pass vacuously](patterns/20260714-async-assertions-under-a-non-awaiting-runner-pass.md) — Async assertions under a non-awaiting runner pass vacuously
- [Hardcoded fixture file-lists rot silently — and fail-open makes rot look like PASS](patterns/20260714-hardcoded-fixture-file-lists-rot-silently.md) — Two independent hand-kept fixture lists rotted silently, and the hook’s fail-open turned the resulting crash into a universal PASS
- [Non-ASCII in a .ps1 without BOM is a parse-time bomb on Windows PowerShell 5.1](patterns/20260714-non-ascii-in-a-ps1-without-bom-is.md) — Non-ASCII in a .ps1 without BOM is a parse-time bomb on Windows PowerShell 5.1
- [A freeze fixture's wrapper verify must assert a printed sentinel, not a filename or bare exit](patterns/20260715-a-freeze-fixtures-wrapper-verify-must-assert-a.md) — A freeze fixture's wrapper verify must assert a printed sentinel, not a filename or bare exit
- [A guard scoped inside a skippable loop is absent on the path that skips it](patterns/20260715-a-guard-scoped-inside-a-skippable-loop-is.md) — A guard scoped inside a skippable loop is absent on the path that skips it
- [Shipping a lib file means shipping the manifest: regen release-manifest inside the feature](patterns/20260715-shipping-a-lib-file-means-shipping-the-manifest.md) — Shipping a lib file means shipping the manifest: regen release-manifest inside the feature
- [The bill is turns × prefix: keep the prefix immutable, warm, and lean](patterns/20260715-the-bill-is-turns-prefix-keep-the-prefix.md) — The bill is turns × prefix: keep the prefix immutable, warm, and lean
- [A cell dependency in the wrong field name is silently ignored — verify the wave, not the write](patterns/20260716-a-cell-dependency-in-the-wrong-field-name.md) — Verify the wave, not the write
- [A tolerant regression net, frozen green BEFORE the edit, is what makes a load-bearing function safe to change](patterns/20260716-a-tolerant-regression-net-frozen-green-before-the.md) — A tolerant regression net, frozen green BEFORE the edit, is what makes a load-bearing function safe to change
- [Realize a structural model via git config, not a file migration, when the boundaries already exist](patterns/20260716-realize-a-structural-model-via-git-config-not.md) — Realize a structural model via git config, not a file migration, when the boundaries already exist
- [A shared checkout with a second live session: check the out-of-scope tree before a blocking verify, and diff before diagnosing "flaky"](patterns/20260719-a-shared-checkout-with-a-second-live-session.md) — A shared checkout with a second live session: check the out-of-scope tree before a blocking verify, and diff before diagnosing "flaky"
- [With concurrent sessions possible, the claim precedes the spawn — and session ids are self-derived, never handed down](patterns/20260719-with-concurrent-sessions-possible-the-claim-precedes-the.md) — The orchestrator claims a cell atomically before spawning its worker; session ids are read from the worker’s own runtime, never handed down
- [A cell that changes a shared mutator surface re-runs the sibling suites of that surface — its own new suite is not enough](patterns/20260720-a-cell-that-changes-a-shared-mutator-surface.md) — A cell touching a shared guard/dispatch surface must re-run every sibling suite that exercises it, not just its own new suite
- [A feature is not a release: re-inspect the whole working tree at close, and never let the version tuple move without explicit release intent](patterns/20260720-a-feature-is-not-a-release-re-inspect.md) — A feature is not a release: re-inspect the whole working tree at close, and never let the version tuple move without explicit release intent
- [A structural review never satisfies the adversarial obligation for an abuse-stopping rule](patterns/20260720-a-structural-review-never-satisfies-the-adversarial-obligation.md) — A structural review never satisfies the adversarial obligation for an abuse-stopping rule
- [Measure the contention topology before adding coordination machinery](patterns/20260720-measure-the-contention-topology-before-adding-coordination-machinery.md) — Measure the contention topology before adding coordination machinery
- [Local green is worthless if suites inherit harness env — hermeticity must be structural, and the release gate is the exact-tag CI](patterns/20260721-local-green-is-worthless-if-suites-inherit-harness.md) — Hermeticity must be structural, and the release gate is the exact-tag CI
- [Locks guarding long synchronous child spawns cannot be heartbeat-renewed — probe owner liveness instead](patterns/20260721-locks-guarding-long-synchronous-child-spawns-cannot-be.md) — A lock held across a blocking spawnSync cannot heartbeat-renew its mtime; stale takeover must probe owner liveness instead
- [Race tests assert structure, never scheduler luck — and a race harness that hides the child's stderr is itself a bug](patterns/20260721-race-tests-assert-structure-never-scheduler-luck.md) — And a race harness that hides the child's stderr is itself a bug
- [Shared-file axes must be sequenced at dispatch time; a worker's "watcher" dies with its turn](patterns/20260721-shared-file-axes-must-be-sequenced-at-dispatch.md) — Shared-file axes must be sequenced at dispatch time; a worker's "watcher" dies with its turn
- [A coverage gate derives its ground truth; it never compares two hand-authored lists](patterns/20260722-a-coverage-gate-derives-ground-truth-it-never-compares-two-hand-lists.md) — A gate that checks a hand-maintained inventory against hand-authored claims proves internal consistency, not coverage — and it drifts green.
- [A plan shaped by a document's literal structure gets fresh-eyed before scope locks](patterns/20260722-surface-structure-planning-is-reviewed-before-scope-locks.md) — When a plan's shape comes from file counts or heading lists rather than a content model, review that assumption at design time — not at validation, not at execution.
