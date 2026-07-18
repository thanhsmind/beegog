---
artifact_contract: bee-implement-plan/v1
feature: codex-native-runtime-v2
lane: high-risk
status: Approved
---

# Implement Plan — codex-native-runtime-v2 (slice S1+S2, post-validation)

## Review Status

Gate 1 approved (auto, bypass=total, decision 3e7d87f0). Gate 2 approved (auto, bypass=total). Gate 3 approved (auto, bypass=total) after: reality gate PASS, plan-checker panel STRUCTURALLY CLEAN, cold-pickup review CRITICALs fixed, advisor consult PROCEED-WITH-CHANGES with all 7 findings folded into cells before dispatch. Machine record: `reports/validation-s1s2.md`, `reports/advisor-digest.md`.

## Goal / Success

Bee on Codex behaves like bee on Claude Code (CONTEXT.md D1). This slice: always-safe truth/guard fixes (D3, D4) + concurrency hardening + the capability evidence (D2) gating every later slice.

## Current State

Verified 2026-07-18: three active docs deny Codex hook support while `.codex/hooks.json` ships 7 events (working since codex-runtime-parity); state-sync matcher carries only Claude tool names in BOTH generator layers (`hooks/catalog.mjs` and the host-repo renderers in `onboard_bee.mjs:1712/:1810`); `writeJsonAtomic` uses a fixed tmp name (collision class under concurrency); no newer-Codex capability has been observed on the installed CLI (0.144.4). Validation DISPROVED the review doc's "split-brain"/"plugin doesn't bundle hooks" reading — manifests are intentional catalog projections (D5 correction).

## Scope

**In:** cnr2-1 (D3 docs truth, event-specific evidence), cnr2-5 (unique-tmp hardening + parallel regression test), cnr2-2 (D4 matcher superset in both generator layers + behavior contract row; deps: cnr2-5), cnr2-4 (D2 expanded 10-row capability spike).
**Out:** S3–S7 (gated on the matrix); logical read-modify-write serialization of state.json (named limitation, pre-existing on Claude); AGENTS.md kernel rewrite; doctrine changes.

## Technical Design

- **Docs path (cnr2-1):** prose-only; three-state trust vocabulary; conditional /hooks step (semantics pending spike); success evidence cited from `.bee/logs/tools.jsonl` (bee-tools-logger), `hooks.jsonl` correctly described as crash/narrow-lifecycle log.
- **Concurrency path (cnr2-5):** unique per-invocation tmp names in `writeJsonAtomic` (template + mirror), rename contract unchanged; parallel regression test (≥8 writers, corruption+crash assertions). Removes the collision class before the matcher widens event frequency; does NOT serialize logical races (honest limit, in-test header).
- **Matcher path (cnr2-2):** superset `update_plan|TaskCreate|TaskUpdate|TodoWrite` in catalog (3 rendered manifests) AND both host renderers (`renderCodexHookEntries`/`renderRepoHookEntries`, version hash `:2299` stays consistent); no tool_input parser added (state-sync needs none — advisor); behavior contract row with a real `update_plan` payload; exact matcher assertions both layers.
- **Evidence path (cnr2-4):** 10 rows (agents discovery+actual spawn, plugin hooks key/default pickup/precedence+provenance, update_plan reach, hook ABI envelope, spawn PreToolUse, SubagentStart-equivalent, /hooks + doctor-input sources), probed via `codex exec --ephemeral --ignore-user-config --json`, trust-bypassed vs normal-trust compared; unknown-with-reason is valid; matrix gates S3/S4/S6 explicitly.

## Implementation Steps

Wave 1: cnr2-4 (longest, gates future slices) ∥ cnr2-1 ∥ cnr2-5. Wave 2: cnr2-2 (after cnr2-5). Schedule verified: zero cycles.

## Validation Plan

Accepted evidence in `reports/validation-s1s2.md` (reality gate PASS ×5, feasibility matrix all PASS, baseline suite green 2026-07-18, contract tests 162 rows green pre-change). Per-cell verifies as recorded. Nothing further asserted until run.

## Risks & Mitigation

cnr2-5 MEDIUM (touches mirrored lib — mitigated by mirror test + template-first edit + parallel test); cnr2-2 MEDIUM (three rendered manifests + host renderers + version hash — mitigated by drift checks and exact assertions both layers); cnr2-4 MEDIUM (honesty — verbatim evidence rule, unknown allowed); cnr2-1 LOW.

## Security / Permissions

No auth/secret/data surface. Spike read-only with ephemeral sandboxed probes only; secret-shaped reads prohibited. No guard weakened; matchers only widen.

## Rollback Plan

One commit per cell → `git revert` per cell id. Rendered manifests regenerable from source at any time. cnr2-5 revert restores the old tmp-name behavior byte-identically (template + mirror in same commit). Spike artifacts are disposable/history-only.

## Open Questions

None blocking this slice. Carried to later slices: S4/S6 scope depends on capability-matrix verdicts; logical state-write serialization (named limitation) is future work if multi-session pressure grows.
