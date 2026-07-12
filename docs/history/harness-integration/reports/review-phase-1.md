# Review Report — harness-integration Phase 1

**Date:** 2026-07-11 | **Lane:** high-risk | **Reviewers:** code-quality, architecture, security, test-coverage, api-contract (5 of 6 cap — conditional `api-contract` triggered by the new versioned manifest; `performance`/`data-migration`/`reliability` did not match their spawn triggers)

Synthesis performed by the orchestrator after all 5 reviewers returned independently, isolated context (diff `dce2bc6..HEAD` + CONTEXT.md + plan.md only).

## Verification-Evidence Gate (§3) — PASS

All 3 `behavior_change:true` cells (2, 3, 4) carry substantive `verification_evidence` — cell 4's `deliberate_exceptions` note is concrete (manual scratch-repo verification described step-by-step), not vague. No P1 from this gate.

## Frozen-Judge Flags (§3) — clean

All 4 cells returned `hits: []` from `bee_cells.mjs judge` during swarming (orchestrator-verified at cap time for each). No judge-flagged cell requires the "judge was moved" re-review.

## Artifact Verification (§4) — OK (EXISTS + SUBSTANTIVE + WIRED) for all promised artifacts

`command-registry.mjs`, `validate-args.mjs`, `bee.mjs`, the extended `bee-write-guard.mjs`, both new test files, `AGENTS.block.md`, and the two docs updates all confirmed present, substantive, and wired (orchestrator manually ran `bee --help --json` and diffed `bee cells ready` against the legacy helper — see swarming goal-check evidence).

## Synthesized Findings

### [P1] Guard and dispatcher parse `--`-prefixed flag values differently — the security hook falsely denies valid `bee` CLI calls   (autofix_class: gated_auto)
**Corroborated independently by 2 reviewers** (code-quality P2, security P3 — conservative rating taken, then promoted one level for corroboration). code-quality empirically ran both parsers side by side: dispatcher accepts `--decision "--foo"` (`ok:true`); the write-guard hook denies the identical call (`ok:false`, field `decision`) because its `parseCliFlags` treats any next-token starting with `--` as a bare boolean instead of consuming it as the value, unlike the dispatcher's unconditional next-token consumption. Concrete failure: `bee decisions log --decision "--foo" --rationale bar` (or any real value starting with `--`) is blocked by the hook before it runs, even though it is a perfectly valid, dispatcher-accepted call.
**Fix:** align the hook's value/boolean decision with the dispatcher's (consume the next token as value for any non-boolean-schema flag, regardless of a leading `--`); add a regression test asserting hook and dispatcher agree on a representative `--`-prefixed value.

### [P1] Manifest `examples[]` don't compose with `invoke`, and are tested only against the legacy helper, never the dispatcher   (autofix_class: manual)
**Corroborated independently by 2 reviewers** (architecture P2, api-contract P2). Registry entries pair a dispatcher-form `invoke` (`"bee cells show"`) with a legacy-helper-form `example` (`"show --id demo-1 --json"`); concatenating them as an agent naturally would produces `bee cells show show --id demo-1 --json` → the dispatcher rejects the duplicated positional (`resolveCommand`, confirmed by both reviewers via code trace). The "every example is tested" claim (manifest-as-tested-contract) is validated only against `entry.helper` (the legacy script), never through `bee.mjs` — so the contract is proven on a surface the manifest doesn't actually describe.
**Fix:** rewrite `examples[]` in dispatcher-form (or add an explicit `entrypoint` field the agent must prepend), and change the test to execute every example through `bee.mjs`, not the legacy helper.

### [P1] `manifest_changed` drift wraps and reshapes the top-level JSON envelope of every data command   (autofix_class: manual)
Single-reviewer (api-contract), but self-evidently production-blocking per bee's own P1 definition (breaking change on the exact consumption path the feature exists to serve). When the registry content hash differs from the persisted baseline, `emit()` nests the real result under `{manifest_changed, manifest_changed_hint, result}` instead of the bare result — for any command whose steady-state output is a JSON array or bare object, the shape changes unpredictably based on hidden on-disk state (`.bee/manifest-hash.json`), self-healing after one call. An agent iterating `bee cells ready --json`'s array output would throw or silently see zero cells on the one call where drift fires.
**Fix:** keep the drift signal off the data path — surface it only via `--help --json` (the discovery call) or stderr; never alter `stdout`'s top-level shape for data commands.

## P2 Findings (non-blocking, filed to backlog)

1. **Manifest-hash write is unconditional on every invocation, including read-only commands, racing under concurrent swarm workers** (architecture) — `checkManifestDrift` always `writeJsonAtomic`s before comparing; parallel workers (wave 2 ran cell-2 + cell-3 concurrently) can race check-then-write, delivering the drift hint nondeterministically to at most one worker. *Related root cause to the P1 above (`emit`/drift mechanism); a combined fix is reasonable.*
2. **Flag boolean-ness hardcoded in 3 places, already diverging for `cells.verify --passed`** (architecture) — dispatcher's `FLAG_ALONE_BOOLEANS` hardcoded set disagrees with the hook's schema-derived boolean detection for the one flag (`--passed`) deliberately excluded from the dispatcher's set.
3. **Manifest `invoke` strings name a `bee` binary that onboarding never installs** (api-contract) — real invocation is `node .bee/bin/bee.mjs ...`; an agent following the manifest literally gets "command not found."
4. **`schema_version` is a static constant, decoupled from actual manifest content changes** (api-contract) — a removed/renamed command doesn't bump it; the real drift signal (content hash) is repo-local, never reaches an external consumer in-band.
5. **Byte-parity to the 4 helpers is asserted for only 4 of 21 registry commands** (test-coverage, corroborated in spirit by architecture + api-contract's status-specific findings) — the D5 load-bearing invariant is untested for 17 commands; `bee status` text mode (the largest duplicated renderer) is the most exposed and explicitly called out by 3 reviewers independently.
6. **Hook's CLI-shape check never tests the dispatcher form (`bee.mjs <group> <action>`) or `status` special-cases** (test-coverage) — only the legacy-helper-form is exercised in `test_bee_write_guard_hook.mjs`.
7. **Check (d) enlarges the write-guard's trusted, pre-Gate-3-writable code surface** (security) — imports 2 more modules (`validate-args.mjs`, `command-registry.mjs`) from `.bee/bin/lib/`, a directory writable before Gate 3; a pre-approval agent could in principle plant code the hook then executes. Root cause pre-exists this diff (state.mjs/guards.mjs already carry it) but the diff enlarges it.
8. **plan.md mislabels check (d) a "security boundary"; it is fail-open and basename-scoped only** (security) — docs-only fix, no code change; genuine enforcement remains checks (a)-(c), confirmed intact (verified: a crash/misparse in check (d) cannot clear a prior denial — this was explicitly re-verified by the security reviewer reading the actual `!denial` guard and isolated try/catch).

## P3 Findings (non-blocking, filed to backlog)

1. Unguarded `checkManifestDrift` fs write could surface a raw stack trace instead of a structured error on I/O failure (code-quality).
2. `--json=false` still forces JSON output; `parseFlags`'s returned `json` field is dead code (code-quality).
3. `command-registry.mjs`/`bee.mjs` headers still describe an abandoned `spawnSync`-delegation design and falsely claim "the dispatcher does not exist yet" (architecture) — stale doc comment.
4. Source comments embed cell IDs, decision numbers, and "validating iteration" labels, violating the project's stable-code-artifacts rule (architecture).
5. Manifest drift text-output branch and drift-on-error paths untested (test-coverage).
6. `cells.add --stdin` intake path never exercised by any test (test-coverage).
7. Deprecated-command redirect tested only as a pure function, never through the dispatcher end-to-end (test-coverage).

## Severity Summary

**P1: 3** (2 corroborated across independent reviewers, 1 single-reviewer self-evident) — **blocks merge**.
P2: 8. P3: 7. Total: 18 findings across 5 reviewers, 0 duplicates left unmerged.

## Decision

Per Gate 4 wording: **P1 > 0 → "P1 findings block merge. Fix before proceeding?"** All 3 P1s had concrete, bounded fixes (2 `gated_auto`/mechanical, 1 `manual` design choice on where the drift signal surfaces) — none required reopening the Phase 1 design itself.

## Fix Cells (all 3 P1s)

| Cell | Fixes | Commit |
|---|---|---|
| `harness-integration-5` | P1 write-guard/dispatcher flag-value parser divergence | `a40df03` |
| `harness-integration-6` | P1 manifest examples don't compose with invoke | `5547ef5` (+ `6fa45ba` vendored-file follow-up, see below) |
| `harness-integration-7` | P1 `manifest_changed` reshapes data-command stdout | `e1c7e02` |

## Re-review (correctness reviewer, `[bee-tier: review]`, isolated context: diff `60a8ada..HEAD` + CONTEXT.md + plan.md)

**1 BLOCKER found and fixed on the spot:** cell-6's fixed registry (dispatcher-form examples) was correctly re-vendored to the working tree's `.bee/bin/lib/command-registry.mjs` but never `git add`ed in the original commit — HEAD was internally inconsistent (`onboarding.json`'s recorded hash didn't match the committed file's actual content), meaning `bee --help --json` in this repo's own dogfood state still advertised the old, non-composing examples even though the product template was already fixed. Fixed by committing the vendored file (`6fa45ba`); verified `git show HEAD:.bee/bin/lib/command-registry.mjs | sha256sum` now matches `onboarding.json`'s recorded hash exactly, and a live `node .bee/bin/bee.mjs --help --json` call confirms `cells.show`'s example is now `bee cells show --id demo-1 --json` (no duplication).

**P1-1 and P1-3: CONFIRMED CORRECT** — no gaps found; source/vendored/committed all consistent, regression tests pass, live behavior manually re-verified.

**Final verdict after fix: ALL 3 P1s CONFIRMED RESOLVED.** Full regression: `test_lib.mjs` 124/0, `test_bee_cli.mjs` 67/0, `test_bee_write_guard_hook.mjs` 16/0, `test_onboard_bee.mjs` 0 failures (1 pre-existing unrelated skip).

**P1 count is now 0.** Per Gate 4 wording: **P1 = 0 → "Review complete. Approve merge?"** The 8 P2 + 7 P3 findings remain filed to `.bee/backlog.jsonl`, non-blocking. Proceeding to Human UAT before presenting Gate 4.
