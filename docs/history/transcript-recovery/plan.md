---
artifact_contract: bee-plan/v1
mode: standard
approved_gate2: 2026-07-20 (bypass total)
---

# transcript-recovery — Plan

CONTEXT: `docs/history/transcript-recovery/CONTEXT.md` (D1–D6 locked, Gate 1 approved).

## Mode-Gate Record

- **Risk flags: 1** — light data-model touch (capture stub gains an optional `source` field, additive, existing flush machinery unchanged). No auth/authorization, no external systems (local file reads only), no public-contract break (CLI additions are additive), no existing-test behavior change (all additions), no proof weakening, single domain (bee CLI/lib).
- **Product files: ~7** — `templates/lib/recovery.mjs` (new), `templates/lib/capture.mjs`, `templates/lib/command-registry.mjs`, `templates/bee.mjs`, `templates/tests/test_recovery.mjs` (new), `templates/tests/test_bee_cli.mjs` (additions), `scripts/test_verify_manifest.mjs`, `skills/bee-hive/SKILL.md` (Session Scout paragraph). `.bee/bin/**` mirrors and `docs/**` not counted (D6).
- **Lane: standard** — story-sized behavior (detect → surface → mine → reconcile), >3 product files. Smaller modes insufficient: `small` caps at 3 product files and this spans lib + CLI + status + tests + verify chain + skill prose.

## Discovery

L1 (verified, no discovery.md per decision 0009). All claims from three worker digests, spot-checked by the fresh-eyes reviewer:

- Transcript location/parse machinery exists: `perf.mjs:31-74` (`encodeProjectDir`, `claudeProjectsRoot`, `resolveTranscript`), `readJsonl` (fsutil), `rollupTranscript` (perf.mjs:388-414). Reuse, don't rebuild.
- Crash primitives exist: session records `.bee/sessions/<id>.json {id, started_at, last_heartbeat, lane?}` (claims.mjs:3, `createSession` :111-131), `heartbeatStale` 900s (claims.mjs:180-184), session id via `--session-id` flag else `CLAUDE_CODE_SESSION_ID` (claims.mjs:66-71, null legal).
- Transcript clean-end trio verified in real tails: `system/stop_hook_summary` → `system/turn_duration` → `last-prompt`; abrupt stop simply lacks it. Filename UUID = session id; no sidecar index exists.
- No crash HANDOFF writer exists (state.mjs:911-1050 CLI-only) — the gap is real.
- Mirroring law: `test_lib_mirror.mjs:16-19` guards `templates/lib/` ↔ `.bee/bin/lib/` byte-identity (and hooks); `bee.mjs` is NOT mirror-guarded — template `skills/bee-hive/templates/bee.mjs` is the edit source, vendored to `.bee/bin/` by onboarding apply (onboard_bee.mjs:1263-1275).
- Status composition: `buildStatus` (bee.mjs:357-492); `buildReviewBlock` (bee.mjs:216-248) is the demonstrated fail-open pattern (try/catch → empty shape + `degraded: true`); new `recovery` block mirrors it (~line 421/470).
- Verify chain: `.bee/config.json` `commands.verify` string; `test_verify_manifest.mjs:17-31` hardcodes `MANDATORY_SUITES`, substring check only.
- Capture stub fields today: `kind,id,at,outcome,dids,area,files,lane` (capture.mjs:53-76) — no source field; additive `source` needed for `mined-unconfirmed` (D6).

## Approach

**Chosen path:** a new lib module `recovery.mjs` owns detection + window math + the miner worker-prompt template; two additive CLI verbs (`recovery scan`, `recovery window`) expose it; `bee status --json` gains a fail-open `recovery` block so the session-start scout sees crash candidates for free (D2); the actual LLM mining is a down-tier worker the orchestrator dispatches with the code-generated prompt (D4), whose digest lands as a recovery report under `docs/history/` plus capture stubs tagged `source: "mined"` (D6) that flow through the normal scribing flush.

**Rejected alternatives:**
- *Crash-time HANDOFF writer (hook on exit):* cannot run on SIGKILL/power loss — the exact case the feature exists for. Rejected.
- *Loading the transcript into the next session's context:* recreates the context-cost problem; violates D4. Rejected.
- *A sessions-index sidecar:* no index exists in the harness; filename UUID = session id suffices; building one adds state bee must keep consistent. Rejected.
- *Extending `perf scan` instead of a new module:* perf is cost-accounting with its own cache; recovery is workflow-state reconciliation. Shared helpers are imported, not duplicated; module stays separate. `recovery.mjs` follows perf's import discipline — imported only by `bee.mjs`, never by `command-registry.mjs`.

**Risk map:**

| Component | Risk | Proof needed |
|---|---|---|
| Tail-read of large jsonl (last ~256KB window, partial first line) | MEDIUM | unit test on fixture with multi-MB pad + malformed first sliced line |
| Clean-end trio detection across harness versions | MEDIUM | fixture from a REAL transcript tail (copied, redacted); tolerate trailing `queue-operation` entries after the trio |
| Detection false-positive on the LIVE current session | MEDIUM | exclude current session id (resolveSessionId) AND fresh-heartbeat records; unit test |
| Sessionless mode (null session id, no records) | LOW | no records → zero candidates, fail silent; unit test |
| Codex / no transcript store | LOW | `claudeProjectsRoot` dir missing → silent no-op block (D2); unit test |
| Status block regression | LOW | fail-open pattern copied from `buildReviewBlock`; `test_bee_cli` addition |
| Verify-chain wiring | LOW | `test_verify_manifest` + full chain green |

**Order:** lib module → CLI/status → capture tag → verify-chain + scout prose.

## Test Matrix (edge sketch)

- **Empty/missing:** no `.bee/sessions/` dir; empty transcript file; transcript missing for a stale session (candidate reported `transcript: null`, not crash).
- **Malformed:** non-JSON lines in tail slice (skip, don't throw); truncated first line of a byte-window slice (drop it).
- **Boundary:** heartbeat exactly at 900s (reuse `heartbeatStale`, no new constant); window start when NO durable settlement exists at all (fall back to session `started_at`); event cap exceeded (truncate oldest, mark `window_truncated: true`).
- **Identity:** current session never a candidate; a stale session whose transcript tail HAS the clean-end trio → not a crash (clean stop, candidate excluded per D1).
- **Laneless:** crashed session with no bound lane → global settlement window (D3 fallback), report path `docs/history/recovery/` (D6).
- **Hostile content:** secret-shaped strings in tail → prompt template instructs redaction + data-never-instructions (D5) — asserted as prompt-template content in unit test, not LLM behavior.

## Slice 1 (current, whole feature) — 4 cells

1. `transcript-recovery-1` — `recovery.mjs` lib module + unit tests (detection, tail read, trio, window, prompt template).
2. `transcript-recovery-2` — CLI verbs `recovery scan|window`, registry schemas, status `recovery` block (fail-open), CLI test additions. Deps: 1.
3. `transcript-recovery-3` — capture stub optional `source` field + `capture add --source` flag + list rendering marks mined stubs. Deps: 2 (shared files: bee.mjs, registry).
4. `transcript-recovery-4` — verify-chain wiring (`MANDATORY_SUITES` + `commands.verify` via `bee config set`), bee-hive SKILL.md Session Scout paragraph (offer discipline, mirrors capture-queue offer), plugin-tree regen, full chain green. Deps: 2, 3.

No future-slice cells. Scribing at close syncs `docs/specs/workflow-state.md` with the recovery behavior + Terms.
