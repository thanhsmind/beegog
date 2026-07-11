PANEL: 11 findings

### [BLOCKER] COHERENCE / FEASIBILITY / SCOPE-GUARDIAN — F1: D3 has no coherent first-install/unknown contract

- Evidence: D3 says any unresolvable version refuses ([CONTEXT.md:28](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:28)); cell 1 says “any unknown” refuses ([skill-sync-1.action](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-1.json:22)). But a fresh host lacks both host helpers and installed skills, while the plan requires first install to succeed ([plan.md:61](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/plan.md:61), [skill-sync-2.action](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-2.json:23)). Unknown source versions are also not clearly protected from `--force-downgrade`.
- Smallest fix: lock a version-state table distinguishing absent destination artifacts from existing-but-invalid artifacts, and state whether force is allowed only for three valid numeric versions. Otherwise remove first-install success from the plan.

### [BLOCKER] COHERENCE / FEASIBILITY — F2: Source discovery does not prove the launcher belongs to its “own bee-hive”

- Evidence: D2 forbids adopting a tree the script does not belong to ([CONTEXT.md:27](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:27)). The proposed check derives `path.dirname(HIVE_DIR)` and merely looks for `bee-hive` there ([approach.md:7](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/approach.md:7)); current `HIVE_DIR` is only path-derived ([onboard_bee.mjs:21](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:21)). A misplaced launcher could adopt a sibling `bee-hive`.
- Smallest fix: require realpath identity between `HIVE_DIR` and `<sourceRoot>/bee-hive`, with a misplaced-launcher regression test.

### [BLOCKER] COHERENCE / FEASIBILITY — F3: The three-version matrix omits the exact host-helper failure branch

- Evidence: the plan promises a three-version matrix ([plan.md:51](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/plan.md:51)), but cell 2 specifies source-versus-installed refusal without independently proving `source < host_helpers`, unknown host helpers, source newer than both, or the planned unreadable-installed case ([skill-sync-2.action](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-2.json:23), [plan.md:67](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/plan.md:67)).
- Smallest fix: add independent host-only and installed-only refusal cases, unknown-host coverage, source-newer success, and unknown-plus-force coverage after F1 is settled.

### [BLOCKER] COHERENCE / FEASIBILITY — F4: Fake source fixtures are disconnected from source resolution

- Evidence: source authority comes from the executing file, but `runOnboard` always invokes the fixed real launcher ([test_onboard_bee.mjs:14](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:14), [test_onboard_bee.mjs:37](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:37)). Cell 2 creates fake source trees but defines only a target override and has no key link connecting fixtures to the executed launcher ([skill-sync-2.action](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-2.json:23), [skill-sync-2.key_links](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-2.json:33)).
- Smallest fix: require the fixture helper to copy the launcher and its relative dependencies into each fake `skills/bee-hive` tree and execute that copy.

### [BLOCKER] SECURITY / SCOPE-GUARDIAN / FEASIBILITY — F5: The test override widens D1’s production deletion root

- Evidence: D1 locks the only target to global `~/.claude/skills` ([CONTEXT.md:26](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:26)), while the approach and cell 1 permit an arbitrary parameter/environment target, explicitly suggesting `BEE_SKILLS_TARGET` ([approach.md:8](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/approach.md:8), [skill-sync-1.action](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-1.json:22)).
- Smallest fix: remove the production CLI/environment override. Isolate tests through fake `HOME`/`USERPROFILE`, or a non-CLI dependency seam unavailable to normal runs.

### [BLOCKER] SECURITY / FEASIBILITY — F6: The bee-* fence is lexical, not filesystem-safe

- Evidence: the fence only specifies names matching `/^bee-/` that are directories ([implement-plan.md:79](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/implement-plan.md:79)). It defines no policy for a top-level `bee-*` symlink, nested target symlink, or source symlink. Writes beneath such paths can follow outside the target. Exact root equality does not reject ancestor overlap and fails on a missing target ([approach.md:10](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/approach.md:10)). The existing atomic writer also uses a predictable `*.tmp` path that may itself be a symlink ([onboard_bee.mjs:125](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:125)).
- Smallest fix: choose reject-versus-safe-unlink semantics for symlinks, then require a pre-write `lstat` no-follow walk, canonical containment and root-overlap checks, unpredictable temp files, and external-sentinel tests.

### [BLOCKER] SECURITY / SCOPE-GUARDIAN / FEASIBILITY — F7: Destructive implementation lands before isolation and behavioral proof

- Evidence: cell 1 can cap zero-mutation, deletion-fence, NOOP, and parity claims using syntax plus token greps only ([skill-sync-1.must_haves](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-1.json:23), [skill-sync-1.verify](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-1.json:41)). Cell 2, which adds all executable safety proof and the home override, depends on cell 1 ([skill-sync-2.deps](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-2.json:6)). Meanwhile the existing suite performs real applies without isolation ([test_onboard_bee.mjs:80](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:80)).
- Smallest fix: land harness isolation before implementation, and move the safety-critical refusal/fence/parity tests into cell 1’s scope and verify. Leave only supplementary matrix coverage in cell 2.

### [BLOCKER] FEASIBILITY — F8: The exact verification surface cannot run in the current worker sandbox

- Evidence: all three verify strings were executed. Cells 1 and 3 parsed and reached expected preimplementation greps. Cell 2’s exact command exited 1 because `runOnboard` uses nested `spawnSync` ([skill-sync-2.verify](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-2.json:40), [test_onboard_bee.mjs:38](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:38)); the child returned `EPERM` with empty output, followed by a null-payload crash at [test_onboard_bee.mjs:114](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:114).
- Smallest fix: choose either a verifier environment that permits child processes or an in-process harness around exported `main()` with captured output. Record a fresh pass of the exact final commands.

### [WARNING] COHERENCE — F9: Forced-downgrade success reporting is undefined

- Evidence: the plan and test cell require the forced run to “report it” ([plan.md:73](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/plan.md:73), [skill-sync-2.action](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-2.json:23)), but the CLI contract names no successful-force field or notice ([approach.md:33](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/approach.md:33)).
- Smallest fix: select one stable JSON field or notice and assert it explicitly.

### [WARNING] SCOPE-GUARDIAN / COHERENCE — F10: The docs cell can run before behavior is test-settled and under-verifies its truths

- Evidence: cell 3 depends only on implementation, although cell 2 may return implementation gaps to cell 1 ([skill-sync-3.deps](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-3.json:6), [skill-sync-2.prohibitions](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-2.json:34)). Its verify checks tokens but not the required response guidance or README’s helpers-plus-skills promise ([skill-sync-3.must_haves](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-3.json:22), [skill-sync-3.verify](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-3.json:34)).
- Smallest fix: make cell 3 depend on cell 2 and verify the actual declared documentation truths.

### [WARNING] COHERENCE — F11: The implementation brief is a stale projection

- Evidence: it says Gate 2 is pending ([implement-plan.md:13](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/implement-plan.md:13)) despite an implementation-ready plan and existing cells; it also calls the suite “unchanged and green” while mandating a retrofit of every invocation ([implement-plan.md:113](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/implement-plan.md:113), [implement-plan.md:128](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/implement-plan.md:128)).
- Smallest fix: refresh the gate status and replace “unchanged” with “existing assertions preserved after isolation retrofit.”

## AUTO-FIX

Mechanical, but not applied because this review is read-only:

- F2 source-root identity check and regression test.
- F3 complete the version matrix after F1’s policy decision.
- F4 bind fake sources to copied launchers.
- F5 remove the production target override and isolate the fake home.
- F7 repair cell ordering, scope, and behavioral verification.
- F10 repair the docs dependency and verify.
- F11 refresh the implementation brief.

## PRESENT-FOR-DECISION

- F1: how absent, invalid, unreadable, and forceable versions differ.
- F6: whether managed symlinks are rejected or safely unlinked/replaced.
- F8: in-process CLI testing versus a child-process-capable execution environment.
- F9: the public JSON/notice contract for a successful forced downgrade.