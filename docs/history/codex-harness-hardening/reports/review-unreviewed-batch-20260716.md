# Independent Review — session `unreviewed-batch-20260716`

- **Requested by:** user ("chạy review độc lập" — everything unreviewed)
- **Scope (frozen):** `0847310..beb75c9` — 42 commits, 7 features: codex-harness-hardening (+1c/+p2/+1d, one high-risk candidate), codex-bypass-per-skill, parallel-scheduler, release-1-3-0. In-flight lanes excluded (worktree-isolation, codex-hook-state-parity, codex-sandbox-baseline, codex-agent-wait-loop, installer-version-parity-1-3-1); 12 stale candidates covered by `pre-release-0-1-44` excluded.
- **Panel:** 6 reviewers on the review slot (opus): code-quality, architecture, security, test-coverage + conditional api-contract, reliability (cap 6). Plus evidence-gate mining and artifact EXISTS/SUBSTANTIVE scan workers.
- **Preflight:** verification-evidence preflight passed at create. Evidence gate over all 21 capped cells in scope: clean — no VAGUE evidence, red-first characterizations or declared exceptions everywhere; the one dropped cell (codex-harness-hardening-3) was legitimately re-done as -5.
- **Artifact verification:** every promised artifact EXISTS + SUBSTANTIVE + WIRED (drift detector, source classifier, shared hasher, tuple check, Tarjan cycle detection, `cells schedule` verb, skill prose wiring). Deferred slices are absent by declaration, not silently dropped.

## Findings

### P1 (both corroborated by two independent reviewers → promoted from P2; both FIXED in-session)

1. **Store-global cycle refusal contradicted locked decision D2** (api-contract + architecture; architecture reproduced it empirically). `assertNoCycle` unioned the entire on-disk store, so one legacy cycle in feature A froze `cells add`/`update --deps` for every other feature. **Fix (cell `parallel-scheduler-5`):** refusal now scoped to cycles the write introduces or participates in; pre-existing cycles stay `cells schedule` diagnostics. New regression test (legacy on-disk cycle: unrelated add + unrelated deps patch succeed; a patch keeping a cycle member inside the cycle refused; a cycle-breaking patch allowed). `test_lib` 334/0; mirrors byte-identical.
2. **Operative Codex spawn doc taught the retired API; the ORCH-01 census was red and unwired** (architecture + test-coverage). `swarming-reference.md:120,123,125` used `spawn_agent(agent_type=…, fork_context=…)` and re-spawn prose, forbidden by SPEC ORCH-01; `census_stale_spawn_syntax.mjs` exited 1 with 4 violations and was absent from `commands.verify`. **Fix (cell `codex-harness-hardening-6`):** table rewritten to `spawn_agent({task_name, message, fork_turns:"none"})` / `followup_task({target, message})`; projections synced; census green and wired as verify suite #16.

### P2 (backlogged, non-blocking)

3. Cycle-refusal guard TOCTOU: two concurrent sessions can each pass the check and co-commit a cycle (reliability). Backstop: schedule diagnostics report it; writes stay atomic.
4. No template-parity guard for `.bee/bin/bee.mjs` itself — the PROJ-08 hazard `test_lib_mirror` names, open for the dispatcher (test-coverage; gated_auto fix: add the pair to the mirror check).

### P3 (backlogged)

5. `onboarding.drift_detail` is a conditional JSON key (api-contract).
6. `cells.schedule` added without a `SCHEMA_VERSION` bump — additive, defensible (api-contract).
7. `addCells` "all-or-nothing" comment overpromises the write phase (reliability).
8. Security posture note: `gate_bypass: "total"` lifts the high-risk floor incl. secret reads — intended, documented, banner + audit trail (security).
9. `.codex/config.toml` `approval_policy = "never"` + `gate_bypass: "total"` are committed repo-wide, inherited by every clone (security).
10. `cells schedule --feature X` mislabels cross-feature deps as unsatisfiable (code-quality).
11. Two file-hash conventions: `fsutil.hashFile` (utf8) vs `release_manifest.sha256File` (buffer) (architecture).
12. `status.source` classifies the repo-carried hive while onboarding classifies the running launcher — same field name, two subjects (architecture).
13. New integrity guards not frozen into `test_verify_manifest` MANDATORY_SUITES (test-coverage; gated_auto).

## What was verified safe

No guard weakened, no test deleted/softened anywhere in the range — `commands.verify` grew 6 → 16 suites, each new guard carries a biting self-test. No injection surface, no secret reads, no credential logging; the security-relevant changes are hardening (downgrade block fail-closed and unforceable, source classifier fail-closed, sha256 manifest check, machine-checked bypass doctrine). Public CLI surface changes are additive and backward-compatible; plugin manifests only bump version; templates ↔ runtime byte-parity holds for every touched lib file.

## Verification after fixes

Full configured verify chain (now 16 suites incl. the census): **green end-to-end** (test_lib 334/0, test_bee_cli 132/0, mirror 17+9 files byte-identical, manifest --selftest/--check pass, gate-bypass doctrine 0 failures, census clean).

Delta re-review + defect-class sweep: see the addendum recorded on the session (`.bee/reviews/unreviewed-batch-20260716.json`).
