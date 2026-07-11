FINDINGS: 10

### [P1] A partial install without `bee-hive` bypasses the downgrade guard

A damaged installation containing `bee-*` skills but no `bee-hive` is treated as a fresh install.

- **What the code does today:** Installed-tree existence is defined solely by `fs.existsSync(<target>/bee-hive)`. If that directory is missing, `installed_skills` becomes `absent`, even when other `bee-*` directories exist.
- **Why it matters:** D3 permits `absent` only when the installed skill tree does not exist at all. An existing but unreadable tree must be `unknown` and unforceable.
- **Failure scenario:** Newer `bee-reviewing` and `bee-swarming` skills remain installed after `bee-hive` is accidentally deleted. Running an older source reports the installation as absent and overwrites or removes those newer skills without requiring `--force-downgrade`.
- **Evidence:** [onboard_bee.mjs:440](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:440), [onboard_bee.mjs:473](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:473), [onboard_bee.mjs:494](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:494), [CONTEXT.md:28](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:28).
- **Smallest credible fix:** Define installed-tree existence as “at least one `bee-*` entry exists.” If entries exist but the canonical version marker is missing or unreadable, report `unknown` and refuse unforceably. Add this partial-install case to the version matrix.

### [P2] File-to-directory transitions corrupt the mirrored skill

The in-place mirror mishandles paths whose filesystem type changes.

- **What the code does today:** It creates the desired source shape, then deletes paths recorded from the old target walk. The cleanup still treats replaced paths according to their previous type.
- **Why it matters:** A valid D4/D5 mirror can delete its newly written replacement or fail after partial mutation.
- **Failure scenario:** If installed `references/` is a directory and source changes `references` to a file, the file loop replaces the directory, then stale-directory cleanup deletes the new file. The reverse transition can attempt non-recursive deletion of the newly created directory and throw.
- **Evidence:** [onboard_bee.mjs:532](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:532), [onboard_bee.mjs:547](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:547), [onboard_bee.mjs:556](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:556), [onboard_bee.mjs:566](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:566), [onboard_bee.mjs:571](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:571).
- **Smallest credible fix:** Make cleanup type-aware and mark replaced paths as consumed so stale cleanup cannot revisit them. Add tests for both file→directory and directory→file transitions.

### [P2] Forced downgrade executes destructive actions hidden by dry-run

The preview shown before authorization is not the plan that force mode applies.

- **What the code does today:** A forceable downgrade computes skill actions internally, but `computePlan` withholds them while status is blocked. `applyPlan` later injects them when `--force-downgrade` is passed.
- **Why it matters:** D2 requires skill drift to be visible in dry-run. Destructive removals are least acceptable when hidden during explicit downgrade review.
- **Failure scenario:** Version 0.1.18 lacks a skill installed by 0.1.19. Dry-run shows only the version refusal; after approval, forced apply executes an undisclosed `remove_skill`.
- **Evidence:** [onboard_bee.mjs:479](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:479), [onboard_bee.mjs:494](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:494), [onboard_bee.mjs:941](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:941), [onboard_bee.mjs:999](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:999), [CONTEXT.md:27](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:27).
- **Smallest credible fix:** Include those actions in blocked dry-run output under `would_apply_if_forced`, while retaining `blocked_downgrade`.

### [P2] Incomplete parity is reported as successful application

The result contract does not distinguish a complete sync from a partial one.

- **What the code does today:** Symlink- or race-blocked skills are skipped, but apply returns exit 0 and `status: "applied"`. Recheck is based only on `recheck.plan.length`; a blocked recheck can therefore also be mislabeled `up_to_date`.
- **Why it matters:** Machine callers can proceed with stale workflow skills, while callers that re-run onboarding can be trapped in permanent `changes_needed`.
- **Failure scenario:** A symlinked stale `bee-reviewing` is skipped. Helpers update, the command reports success, and future sessions either use the stale reviewer or repeatedly request an apply that cannot converge.
- **Evidence:** [onboard_bee.mjs:1101](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:1101), [onboard_bee.mjs:1145](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:1145), [onboard_bee.mjs:1305](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:1305), [test_onboard_bee.mjs:806](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:806), [SKILL.md:34](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/SKILL.md:34), [SKILL.md:38](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/SKILL.md:38).
- **Smallest credible fix:** Centralize final outcome classification: blocked recheck, partial/skipped, remaining drift, then complete. Return an explicit partial status rather than plain `applied`.

### [P2] Plan-item `path` no longer identifies its mutation root

Repo-local and global actions now share an ambiguous public shape.

- **What the code does today:** Global `sync_skill` and `remove_skill` actions use `path: "bee-..."` inside the same plan array as repo-relative paths. The apply loop initially resolves every path against `repoRoot`, then special-cases skill actions to another root.
- **Why it matters:** Consumers must hard-code action names to discover what `path` means. The text renderer identifies the repository but does not display the global root.
- **Failure scenario:** An approval interface renders `remove_skill bee-old` as `<repo>/bee-old`; apply actually deletes `~/.claude/skills/bee-old`.
- **Evidence:** [onboard_bee.mjs:324](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:324), [onboard_bee.mjs:344](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:344), [onboard_bee.mjs:939](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:939), [onboard_bee.mjs:1018](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:1018), [onboard_bee.mjs:1205](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:1205).
- **Smallest credible fix:** Add a stable `scope: "repo" | "global_skills"` field, or place global actions under `skills.plan`. Resolve and render targets through that scoped representation.

### [P2] The two-root apply has no commit or recovery boundary

Preflight is atomic, but ordinary execution failures are not.

- **What the code does today:** One sequential loop mutates the repository first and global skills later. Atomicity is per file only; the outer error handler has no rollback, journal, or recovery state.
- **Why it matters:** An I/O failure can recreate the exact helper-versus-skill drift this feature is intended to eliminate.
- **Failure scenario:** Repo helpers update, several skills sync, then a later write fails because of permissions or disk exhaustion. The process exits 1 with both roots partially advanced.
- **Evidence:** [CONTEXT.md:5](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:5), [onboard_bee.mjs:939](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:939), [onboard_bee.mjs:1018](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:1018), [onboard_bee.mjs:1101](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:1101), [onboard_bee.mjs:1324](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:1324).
- **Smallest credible fix:** Add prepare/commit phases: stage and hash-verify all global changes before repository writes, retain backups or a recovery journal, and roll back completed operations when commit fails.

### [P2] Version reporting has no single complete contract

Different outcome paths expose missing or contradictory source-version values.

- **What the code does today:** Top-level `bee_version` uses a lenient parser with a fallback, while preflight uses a strict numeric parser. Source-identity and overlap failures return before the three-version object is populated.
- **Why it matters:** D3 requires all refusal/source-resolution outcomes to report the three version states, but callers can receive `versions: null` or `bee_version: "not-a-version"` alongside `versions.source: "unknown"`.
- **Failure scenario:** Automation handles `blocked_no_source` but cannot determine host/global skew; after source relocation it discovers a second downgrade block. With malformed source metadata, different fields give conflicting answers.
- **Evidence:** [onboard_bee.mjs:161](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:161), [onboard_bee.mjs:198](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:198), [onboard_bee.mjs:381](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:381), [onboard_bee.mjs:399](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:399), [onboard_bee.mjs:431](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:431), [CONTEXT.md:28](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:28).
- **Smallest credible fix:** Resolve one structured version triplet before all outcome returns, using explicit `resolved`, `absent`, `unknown`, and `unavailable` states. Derive every public version field from it.

### [P2] An invalid source entry preserves a zombie installed skill

Source presence is recorded before validating that the entry is a skill.

- **What the code does today:** `sourceNames` includes every prefix-matching entry. A plain file named `bee-obsolete` is then skipped as “not a skill dir,” but its name prevents removal of the installed `bee-obsolete/` directory.
- **Why it matters:** The installed skill remains loadable although no valid authoritative source skill exists, violating D2/D4 mirror semantics.
- **Failure scenario:** A malformed checkout contains a file `skills/bee-obsolete`; the old global `bee-obsolete/` survives indefinitely and the run may report no drift.
- **Evidence:** [onboard_bee.mjs:284](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:284), [onboard_bee.mjs:300](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:300), [onboard_bee.mjs:344](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:344), [CONTEXT.md:27](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:27).
- **Smallest credible fix:** Build authoritative source names only from validated plain directories. Surface top-level invalid entries as blocked diagnostics rather than silently treating them as skills.

### [P3] README still documents the superseded manual update path

The repository now publishes two incompatible update contracts.

- **What the code does today:** The new onboarding section says apply automatically mirrors `~/.claude/skills`; the status note still says users must manually copy to both Claude and Codex directories and that onboarding only updates helpers.
- **Why it matters:** This obscures D1’s ownership boundary and revives the manual drift source the feature removes.
- **Failure scenario:** A user follows the later note, manually maintains `~/.codex/skills`, and assumes onboarding did not update the Claude installation.
- **Evidence:** [README.md:346](/home/thanhsmind/projects/goglbe/beegog/README.md:346), [README.md:408](/home/thanhsmind/projects/goglbe/beegog/README.md:408), [CONTEXT.md:26](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:26).
- **Smallest credible fix:** Remove or rewrite the stale parenthetical and make the onboarding section the single update contract.

### [P3] Fake-source tests vendor the launcher’s private import graph

The safety fixture is coupled to implementation layout rather than the observable CLI contract.

- **What the code does today:** Tests copy the raw launcher plus a hand-maintained list of its current relative dependencies and template files into each fake authoritative tree.
- **Why it matters:** Routine internal decomposition can disable every safety case before any behavior is exercised.
- **Failure scenario:** Extracting skill-sync logic into `skill_sync.mjs`, or adding another shared import, makes cases 10a–10p fail with `ERR_MODULE_NOT_FOUND` until the fixture’s private dependency list is updated.
- **Evidence:** [test_onboard_bee.mjs:469](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:469), [test_onboard_bee.mjs:488](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:488), [onboard_bee.mjs:169](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:169).
- **Smallest credible fix:** Copy the complete real `bee-hive` tree into the fixture and override only controlled version and skill content, retaining behavior-level assertions.