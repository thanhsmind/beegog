FINDINGS: 10

### [P1] A symlinked launcher can select an unauthorized skill source

**Plain-language summary:** The source-identity check can be bypassed, allowing sibling skills from an unrelated directory to replace or remove globally installed skills.

**What the code does today:** `SCRIPT_PATH`, `HIVE_DIR`, and `sourceRoot` retain the launcher’s lexical path. The identity check then compares `HIVE_DIR` with the equivalent `<parent>/bee-hive` path, so a `bee-hive` symlink passes.

**Why it matters:** This defeats D2’s authoritative-source boundary. With `--repo-hooks`, the same lexical path also controls which hook code is installed.

**Concrete failure scenario:** A trusted installed `bee-hive` is exposed through `attacker/skills/bee-hive`, and Node runs it with `--preserve-symlinks-main`. The script accepts `attacker/skills` as authoritative, installs attacker-controlled sibling skills, and removes legitimate target-only skills.

**File/line evidence:** [onboard_bee.mjs:29](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:29), lines 29-35 and 379-396.

**Smallest credible fix:** Canonicalize `SCRIPT_PATH` first and derive `HIVE_DIR`, source root, and plugin root exclusively from that physical path. Verify the canonical script occupies the expected `bee-hive/scripts/onboard_bee.mjs` layout.

### [P1] A repo inside the global skill root can delete itself

**Plain-language summary:** Onboarding a repository located under `~/.claude/skills/bee-*` can erase that repository during the same apply.

**What the code does today:** Preflight compares only source and target roots. Repo actions run first; target-only skill removals run afterward; the final onboarding write can recreate only a small `.bee` fragment.

**Why it matters:** A legitimate live skill checkout becomes indistinguishable from a stale installed skill, causing direct repository and Git-history loss.

**Concrete failure scenario:** `repoRoot` is `~/.claude/skills/bee-local`, while the source has no `bee-local`. Apply writes the onboarding files, recursively removes `bee-local`, then recreates only `.bee/onboarding.json`.

**File/line evidence:** [onboard_bee.mjs:409](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:409), lines 409-428, 939-946, 1109-1115, and 1128-1143.

**Smallest credible fix:** Canonicalize repo and target roots during preflight and refuse overlap in either direction before any write. For missing paths, resolve the deepest existing ancestor before checking containment.

### [P1] A partial installation bypasses the installed-version guard

**Plain-language summary:** Existing `bee-*` skills are treated as a fresh install whenever `bee-hive` itself is missing.

**What the code does today:** Installed-tree existence is determined solely by `fs.existsSync(<target>/bee-hive)`. Other installed `bee-*` directories do not make the installed version `unknown`.

**Why it matters:** D3 says only a bee tree that does not exist at all is absent. An existing but unidentifiable set must refuse; otherwise newer skills can be deleted without downgrade protection.

**Concrete failure scenario:** A newer manual install contains `bee-evolving` but no `bee-hive`. An older source lacking `bee-evolving` reports `installed_skills: "absent"` and recursively removes it.

**File/line evidence:** [onboard_bee.mjs:440](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:440), lines 440-447 and 344-371; [CONTEXT.md:28](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:28).

**Smallest credible fix:** Report `absent` only when no target `bee-*` entry exists. If any exists but no valid plain `bee-hive` version can be read, return non-forceable `unknown` and perform zero mutations.

### [P1] Concurrent applies can defeat the downgrade preflight

**Plain-language summary:** D3 is a stale snapshot, not a protected transaction. A previously approved older apply can overwrite a newer installation.

**What the code does today:** Versions and plan items are computed once, with no interprocess lock or compare-and-swap before mutation. Post-apply recheck also derives `up_to_date` solely from plan length, ignoring `recheck.skillSync.blocked`.

**Why it matters:** Multiple agents or repositories can run onboarding concurrently against the same global target, silently defeating the primary downgrade safeguard.

**Concrete failure scenario:** With v0.1.18 installed, v0.1.19 and v0.2.0 applies both pass preflight. v0.2.0 finishes first; the stale v0.1.19 process then overwrites it. A later blocked recheck can also be mislabeled `up_to_date` because blocked skill items are withheld from the plan.

**File/line evidence:** [onboard_bee.mjs:986](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:986), lines 986-1005, 1018-1126, 941-944, and 1305-1312.

**Smallest credible fix:** Acquire an interprocess lock for the global target, stage an immutable source snapshot, and recompute versions, roots, and fingerprints under the lock immediately before commit. Hold the lock through recheck, and treat any blocked recheck as failure.

### [P1] Symlink swaps can redirect mutations outside the managed namespace

**Plain-language summary:** The lstat-only policy is check-then-use; filesystem paths are trusted again later, after they may have changed.

**What the code does today:** A target tree is walked once, then files and directories are written or recursively removed through ordinary path resolution. No operation pins directory identity or protects intermediate components.

**Why it matters:** The claimed symlink fence does not survive concurrent changes, so writes and deletions can escape `~/.claude/skills/bee-*`.

**Concrete failure scenario:** After `bee-alpha/references` is walked, another process replaces it with a symlink to an outside directory. Cleanup of `references/old.md` then removes the outside file, or a source write lands outside the skill root.

**File/line evidence:** [onboard_bee.mjs:533](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:533), lines 533-575 and 598-604. Existing tests cover only stable pre-existing symlinks at [test_onboard_bee.mjs:770](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:770).

**Smallest credible fix:** Stage each complete skill in a private randomized directory and atomically swap or quarantine only its top-level entry under a pinned canonical root. Use no-follow, descriptor-relative operations where available; another lstat alone does not close the race.

### [P1] Case-insensitive filesystems can sync and then delete the same path

**Plain-language summary:** Exact-case manifest keys are unsafe on supported Windows and case-insensitive macOS filesystems.

**What the code does today:** Source names are compared as case-sensitive JavaScript strings, while filesystem lookup may resolve differently cased names to the same physical entry.

**Why it matters:** One physical skill or nested file can be considered both the source match and a target-only stale entry, causing the newly synchronized content to be deleted.

**Concrete failure scenario:** Source contains `bee-hive`; target contains `bee-Hive`. Apply accesses the target through `bee-hive`, synchronizes it, then schedules `bee-Hive` for removal because the strings differ. Nested names have the same failure mode.

**File/line evidence:** [onboard_bee.mjs:287](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:287), lines 287, 313-371, 233-266, and 556-575.

**Smallest credible fix:** Match existing entries by canonical filesystem identity, detect aliases before planning, and fail closed on ambiguous collisions. Apply the same identity rule to nested paths and add case-insensitive-platform tests.

### [P1] Version parsing can mistake comments or symlinks for authoritative evidence

**Plain-language summary:** The supposedly strict reader accepts the first numeric-looking `BEE_VERSION` substring anywhere and follows symlinks.

**What the code does today:** `existsSync` and `readFileSync` follow the marker path, while an unanchored regex can match comments, unrelated identifiers, or attacker-selected linked content.

**Why it matters:** A corrupt or ambiguous marker is classified as resolved instead of D3’s non-forceable `unknown`, allowing an actual helper or skill downgrade.

**Concrete failure scenario:** A newer state file starts with `// previous BEE_VERSION = '0.1.18'` before exporting `0.1.20`. Source `0.1.19` is incorrectly considered newer and overwrites the real `0.1.20` tree.

**File/line evidence:** [onboard_bee.mjs:198](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:198), lines 198-210 and 434-447; [CONTEXT.md:28](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:28).

**Smallest credible fix:** Require plain, non-symlink ancestors and one regular marker file containing exactly one anchored declaration, or use a dedicated non-executable version marker. Anything else must resolve to `unknown`.

### [P2] File-to-directory transitions corrupt the mirror

**Plain-language summary:** Legitimate source shape changes can delete the newly written replacement or abort midway.

**What the code does today:** It creates the source shape, then cleans up using the old target manifest. That manifest still describes paths using their former types.

**Why it matters:** A normal release can leave the installed skill incomplete even without permissions failures, races, or malicious input.

**Concrete failure scenario:** `references/config` changes from a directory to a file. Apply removes the old directory and writes the file, then stale directory cleanup removes the new file or stale child cleanup throws through it. The reverse transition similarly attempts non-recursive removal of the newly created directory.

**File/line evidence:** [onboard_bee.mjs:548](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:548), lines 548-575. The deep-mirror test at [test_onboard_bee.mjs:1165](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:1165) does not cover type changes.

**Smallest credible fix:** Remove target-only and type-conflicting paths depth-first before creating the source shape, or stage the complete source tree and atomically replace the skill. Test both transition directions.

### [P2] Permission and I/O failures leave mixed live versions

**Plain-language summary:** The apply is sequential and has no rollback, so a late failure preserves every earlier write and deletion.

**What the code does today:** Repo helpers are mutated before global skill actions. Exceptions such as `EACCES` or `ENOSPC` reach the outer catch without restoring either domain.

**Why it matters:** The one-command consistency promise can fail precisely on permission-constrained machines, leaving helpers and skills interpreting different workflow contracts.

**Concrete failure scenario:** Helpers and two skills update successfully; writing a later skill fails because its directory is non-writable or the disk fills. The command exits nonzero, but the host and global installation remain partially upgraded.

**File/line evidence:** [onboard_bee.mjs:939](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:939), lines 939-946, 1018-1126, and 1324-1328.

**Smallest credible fix:** Stage and validate all outputs before touching live paths, commit through tracked atomic swaps, and restore quarantined originals if any commit step fails. Add an injected mid-sync failure test.

### [P2] The fake-HOME assertion does not verify the child’s effective target

**Plain-language summary:** Current call sites pass fake home values, but the safety invariant checks only what the wrapper intended—not where the destructive child actually resolved its home.

**What the code does today:** `runOnboardAt` copies the full parent environment, including `NODE_OPTIONS`, records its assigned `HOME` and `USERPROFILE`, and launches the child. Final assertions merely compare those recorded inputs after all applies have finished.

**Why it matters:** A child preload or future target-resolution regression can reach the real `~/.claude/skills`; the assertions can still pass, and any failure is detected only after possible damage.

**Concrete failure scenario:** An inherited `NODE_OPTIONS=--require home-normalizer.js` preload resets child `HOME` from `os.userInfo().homedir()`. The child mirrors the real global skills, while `spawnedHomes` still contains the fake values and the suite-wide checks pass.

**File/line evidence:** [test_onboard_bee.mjs:44](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:44), lines 44-55 and 1270-1282; target resolution at [onboard_bee.mjs:180](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:180).

**Smallest credible fix:** Remove Node startup-injection variables from the child environment and, before every apply, run a non-mutating child-home/plan probe under the identical environment. Abort unless both canonical `os.homedir()` and `skills.target_root` equal the case’s fake paths.