# Review report — evolving loop, slice B (+ evolving-8)

Date: 2026-07-10 · Scope: `ced28dd..eec2f2c` (evolving-8, 9, 10, 11) · Lane: high-risk.
Reviewers: code-quality, architecture, security, test-coverage, api-contract (all opus, `review`
slot, isolated context) + learnings-researcher (haiku, 24 precedents). Synthesis: orchestrator
(session model = ceiling), after all reviewers returned.

## Verdict: 2 P1 (both by corroboration promotion), 5 P2, 6 P3

Suite at review time: 124 passed, 0 failed + onboarding PASS (fresh run). Evidence gate: all four
`behavior_change` cells carry structured `verification_evidence` — PASS. Frozen judge: intact for
all four cells. Artifact verification: every plan promise EXISTS + SUBSTANTIVE + WIRED (rank CLI
live on the real corpus; skill 162 lines; routing row + 0022 + version 0.1.19 consistent across
all documented sites, confirmed by api-contract).

## P1 — block merge

**P1-a. `rank --json` emits the datamark-stripped cluster `key` to the consuming agent.**
Corroborated independently by architecture (F1) and security (F1), both P2 → promoted.
`rankClusters` spreads `...cluster` (feedback.mjs:964) so `key` — the unwrapped form of every
foreign title — reaches stdout (`bee_feedback.mjs:133`), which is exactly what the Gate A agent
consumes. The only defense is SKILL.md prose ("render title, never key"). D2b's own maxim is
neutralize in code, not prose. Fix: project `key` out of the CLI result (representative stored
still-wrapped `title` + rank terms + sources), keep `key` lib-internal, add a test asserting `key`
is absent from `rank --json`. `autofix_class: gated_auto`.

**P1-b. `normalizeTitle` hand-duplicates `datamark`'s cleaning; no coupling test locks them.**
Corroborated independently by architecture (F2) and test-coverage (F1), both P2 → promoted.
feedback.mjs:863-865 copies decisions.mjs:145-149 byte-for-byte; the invariant tests are
example-based. Any future hardening of `datamark` silently reopens the trap (foreign and local
twins stop unifying; corroboration deflates) with the suite green. Fix: export the shared
cleaning (`datamarkClean`) from decisions.mjs, call it from both, plus a coupling test that drives
datamark-relevant payloads through both paths. `autofix_class: manual (small)`.

## P2 — fix in the P1 fix cell where cheap, else backlog

| # | Finding | Source | Route |
|---|---|---|---|
| P2-1 | `localeCompare` entry ordering is locale/ICU-dependent — "byte-identical" holds only per-environment (real corpus measured identical across separators, divergence latent) | code-quality F1 + api-contract F2 (conservative P2; partly pre-existing slice A surface, touches 20+ merge assertions) | **backlog** |
| P2-2 | `normalizeTitle` lacks `normalize('NFC')` — NFC/NFD Vietnamese twins never cluster | code-quality F2 | fix cell (one line + test) |
| P2-3 | `clusterEntries` pain-default branch (0/missing → 1) untested | test-coverage F2 | fix cell (fixtures) |
| P2-4 | `first_seen` absent/invalid tie-break fallback untested | test-coverage F3 | fix cell (fixture) |
| P2-5 | stale `bee_feedback.mjs` header still describes `collect` as local-only pre-merge state | api-contract F1 | fix cell (comment rewrite) |

## P3

| # | Finding | Source | Route |
|---|---|---|---|
| P3-1 | vendored `.bee/bin` has no byte-parity test vs templates (and the C0 sweep does not scan it) | architecture F3 + test-coverage F6 → conservative P2-adjacent; one parity assertion closes both | fix cell |
| P3-2 | strip-order hole: `<system>«x»</system>` breaks the W4 invariant (clean must precede the fixed-point strip) | code-quality F3 | fix cell (reorder + test) |
| P3-3 | committed `reports/evolving-9.md` contains a raw NUL byte → git-binary, grep-invisible | security F2 | fix cell (replace byte) |
| P3-4 | empty-repo end-to-end `rank --json` → `[]` not exercised | test-coverage F4 | fix cell (extend CLI test) |
| P3-5 | wrapper-only / guillemet-quoted titles («») may false-collapse to '' | test-coverage F5 | backlog |
| P3-6 | committed absolute `dogfood_repos` path is machine-specific | security F3 | accepted — explicit Gate 2 rider, operator-owned; noted at Gate 4 |

## Cleared

Security cleared: realpath containment (slice B adds no fs read), push wording (per-diff,
non-pre-grantable, schedulers disclaimed), pressure reports carry no payloads, no secrets in docs
(only intentional test fixtures). Architecture cleared: ranking purity, thin CLI, skill trust
boundary at mergeDigests, contracts promise nothing the code does not enforce. Api-contract
cleared: CLI behavior matches docs, sortKey separator change correctly did NOT bump schema 1.0
(measured: identical ordering on the real corpus, divergent index -1), routing mirrors consistent,
version consistent. Test-coverage confirmed all six promised matrix rows carry value-level
assertions with no tautologies.

## Learnings precedent (researcher, 24 hits)

Most load-bearing: "a boundary that lists field names leaks the field you forgot" (P1-b is this
pattern at the transform level); "validate the producer against its own output round-trip";
"a green suite can be proof of the wrong spec". Full list in the task record.

## UAT items (Gate 4)

1. CALL — `node .bee/bin/bee_feedback.mjs rank --json` returns ranked clusters over the real
   two-repo corpus.
2. SEE — the routing row: "Evolve bee from its own dogfood feedback" → `bee-evolving`
   (`skills/bee-hive/SKILL.md:72`).
3. RUN — `node skills/bee-hive/templates/tests/test_lib.mjs` → 124 passed, 0 failed.
