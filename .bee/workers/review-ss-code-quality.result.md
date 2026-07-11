FINDINGS: 11

### [P1] Decoy version text can bypass the downgrade guard

**Plain-language summary:** Version detection accepts the first `BEE_VERSION` substring, even inside comments or unrelated identifiers.

**What the code does today:** The unanchored regex validates only the captured digits, not that they came from the actual exported declaration. [onboard_bee.mjs:208-210](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:208)

**Why it matters:** D3 requires unreadable or corrupt versions to remain unknown and never become forceable. [CONTEXT.md:28](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:28)

**Concrete failure scenario:** An installed file containing a commented `BEE_VERSION = '0.1.18'` before its real `0.1.20` declaration is read as `0.1.18`; source `0.1.19` is then allowed to overwrite the newer installation.

**File/line evidence:** The first match feeds directly into downgrade comparison and force eligibility. [onboard_bee.mjs:469-491](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:469)

**Smallest credible fix:** Accept exactly one line-anchored `export const BEE_VERSION = '<numeric>'` declaration; otherwise return `unknown`. Add decoy-before-real and unrelated-identifier tests.

### [P1] Existing installed skills can be mistaken for a fresh install

**Plain-language summary:** The installed tree is considered absent solely when `bee-hive` cannot be resolved, even if other `bee-*` skills or a dangling hive symlink exist.

**What the code does today:** `fs.existsSync(installedHive)` alone supplies the `treeExists` value; false becomes `absent`, which bypasses the unknown-version refusal. [onboard_bee.mjs:440-467](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:440)

**Why it matters:** D3 permits `absent` only when the target skill tree does not exist at all; an existing but unversionable tree must refuse before writes. [CONTEXT.md:28](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:28)

**Concrete failure scenario:** A partial newer installation contains `bee-reviewing` but no `bee-hive`. It is labeled `installed_skills: absent`, so an older source overwrites or removes those installed skills without downgrade protection.

**File/line evidence:** Once classified absent, the code computes and applies mirror items normally. [onboard_bee.mjs:469-497](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:469)

**Smallest credible fix:** Determine installed-tree existence from lstat-based `bee-*` namespace entries. Only `ENOENT` for the entire namespace means absent; missing, dangling, or unreadable version carriers mean unknown.

### [P1] File-to-directory transitions break the mirror

**Plain-language summary:** Cleanup uses a stale target snapshot after creating the new source shape, so it can delete newly copied paths or abort midway.

**What the code does today:** Source directories and files are created first, followed by deletion of paths recorded as old target files and directories. [onboard_bee.mjs:547-575](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:547)

**Why it matters:** D4/D5 require full file-set parity after one apply. [CONTEXT.md:29-30](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:29)

**Concrete failure scenario:** If installed `guide/` becomes source file `guide`, the new file is written and then removed as an old directory; with nested old files, cleanup instead throws after partial repo and skill mutations. The reverse transition passes a newly created directory to non-recursive removal.

**File/line evidence:** The current deep-mirror test covers stale nested files but not either path-type transition. [test_onboard_bee.mjs:1165-1212](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:1165)

**Smallest credible fix:** Remove stale and opposite-type entries deepest-first before materializing the source tree, or stage the complete skill and swap it into place. Test both transition directions.

### [P1] In-place mutation leaves a symlink race outside the namespace fence

**Plain-language summary:** A target verified as symlink-free can change before later path-based writes and deletions.

**What the code does today:** It walks the target once, then performs multiple operations through descendant path strings. An lstat of the final path does not protect against a parent directory becoming a symlink. [onboard_bee.mjs:532-574](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:532)

**Why it matters:** D4 says non-bee paths must never be touched. [CONTEXT.md:29](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:29)

**Concrete failure scenario:** Another updater replaces `bee-alpha/references` with a symlink after the initial walk. Subsequent writes or stale-file removals under `references/...` follow it and can alter an external checkout.

**File/line evidence:** Atomic leaf writes still resolve their parent path at write and rename time. [onboard_bee.mjs:502-509](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:502)

**Smallest credible fix:** Build each complete skill in a fresh sibling directory, move the existing entry to quarantine without traversing it, then atomically rename the staged directory into place.

### [P2] Fallible planning reads can bypass the structured preflight

**Plain-language summary:** The “single preflight” runs only after other reads that can fail on the same version files.

**What the code does today:** `computePlan` reads source and host helper contents before calling `computeSkillSync`; `readTextIfExists` does not catch read errors. [onboard_bee.mjs:129-130](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:129) [onboard_bee.mjs:830-941](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:830)

**Why it matters:** D3 promises a pre-write `blocked_downgrade` result with all versions for unreadable trees. [CONTEXT.md:28](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:28)

**Concrete failure scenario:** An existing host `state.mjs` is stat-able but unreadable. Helper drift computation throws before `readVersionStrict`, and the CLI returns generic `{error}` rather than the required blocked status and version triple. [onboard_bee.mjs:1324-1328](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:1324)

**File/line evidence:** The source-unknown test also acknowledges that eager module loading prevents using a genuinely syntax-invalid source fixture. [test_onboard_bee.mjs:1052-1059](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:1052)

**Smallest credible fix:** Run a dependency-minimal strict preflight before legacy version or drift reads, derive all reported versions from it, and lazy-load command detection afterward.

### [P2] `blocked_no_source` returns without the required versions

**Plain-language summary:** Source-resolution failures report `versions: null`, contradicting D3’s diagnostic contract.

**What the code does today:** `versions` starts null, and identity or overlap failures return before the version-resolution block. [onboard_bee.mjs:381-426](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:381)

**Why it matters:** D3 requires source, host-helper, and installed-skill versions to accompany both refusal and source-resolution failure. [CONTEXT.md:28](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:28)

**Concrete failure scenario:** A misplaced launcher returns `blocked_no_source`, but the user receives no host or installed version evidence with which to diagnose the refusal.

**File/line evidence:** The CLI emits the still-null field, while the no-source test checks only status and non-mutation. [onboard_bee.mjs:1293-1303](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:1293) [test_onboard_bee.mjs:930-955](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:930)

**Smallest credible fix:** Resolve the best-effort three-version labels before every no-source return, using `unknown` where authority cannot be established, and assert them in both overlap directions and the identity case.

### [P2] Recheck can say `up_to_date` while preflight is blocked

**Plain-language summary:** Post-apply status ignores the recheck’s blocked state.

**What the code does today:** Blocked skill items are withheld from `plan`, while `recheck` is derived only from `plan.length`. [onboard_bee.mjs:939-944](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:939) [onboard_bee.mjs:1305-1313](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:1305)

**Why it matters:** D5 defines recheck as content-parity verification, not merely an empty plan array. [CONTEXT.md:30](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:30)

**Concrete failure scenario:** A forced downgrade skips a newer symlinked installed `bee-hive`. The next preflight becomes `blocked_downgrade`, withholds skill items, and the otherwise-empty plan is reported as `up_to_date`.

**File/line evidence:** Force and symlink behavior are tested separately, never in combination. [test_onboard_bee.mjs:733-827](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:733)

**Smallest credible fix:** Give `recheck.skillSync.blocked` precedence over plan length and expose its status, reason, and versions. Add a force-plus-blocked-hive regression case.

### [P2] A non-directory source entry preserves a zombie installed skill

**Plain-language summary:** A stray source file named `bee-*` is ignored as a skill but still prevents removal of the installed directory with the same name.

**What the code does today:** Every source entry enters `sourceNames` before non-directories are skipped; target removal then trusts that set. [onboard_bee.mjs:284-302](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:284) [onboard_bee.mjs:344-347](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:344)

**Why it matters:** D2/D4 require installed skills absent from the authoritative source to be removed. [CONTEXT.md:27-29](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:27)

**Concrete failure scenario:** Source `skills/bee-retired` is accidentally replaced by a regular file while installed `bee-retired/` remains a loadable directory. Dry-run can report no drift and leave the stale skill active indefinitely.

**File/line evidence:** The implementation itself labels the regular file “not a skill dir” but nevertheless retains its name as authoritative. [onboard_bee.mjs:287-301](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:287)

**Smallest credible fix:** Build authoritative names only from actual skill directories; for unsupported top-level entries, either emit a blocking collision or exclude them so normal removal proceeds.

### [P2] Version comparison loses precision for accepted numeric versions

**Plain-language summary:** The parser accepts arbitrarily large numeric segments, then converts them to lossy JavaScript `Number` values.

**What the code does today:** The regex imposes no safe-integer bound, and `compareVersions` maps segments through `Number`. [onboard_bee.mjs:208-219](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:208)

**Why it matters:** D3 relies on strict ordering to prevent every older-source overwrite. [CONTEXT.md:28](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:28)

**Concrete failure scenario:** `9007199254740992.0.0` and `9007199254740993.0.0` compare equal after rounding, allowing the older source to overwrite the newer target.

**File/line evidence:** The comparison returns zero once all rounded segments appear equal. [onboard_bee.mjs:213-221](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/onboard_bee.mjs:213)

**Smallest credible fix:** Compare validated segments as `BigInt`, or reject segments above `Number.MAX_SAFE_INTEGER`, with boundary tests.

### [P3] README still instructs users to perform the obsolete manual copy

**Plain-language summary:** The README simultaneously promises automatic sync and says onboarding does not sync skills.

**What the code does today:** The new onboarding section says every apply mirrors `~/.claude/skills`. [README.md:346](/home/thanhsmind/projects/goglbe/beegog/README.md:346)

**Why it matters:** The later status note still instructs copying into both `.claude` and `.codex`, contradicting D1/D2 and bypassing the downgrade guard. [README.md:408](/home/thanhsmind/projects/goglbe/beegog/README.md:408) [CONTEXT.md:26-28](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:26)

**Concrete failure scenario:** A user follows the later note, manually overwrites global skills, and recreates the drift or downgrade failure this change is meant to eliminate.

**File/line evidence:** The two instructions coexist in the current README at lines 346 and 408.

**Smallest credible fix:** Remove or rewrite the stale parenthetical to describe automatic Claude-global sync and explicitly identify Codex installation as out of scope.

### [P3] Two test cases leak complete fake-home skill installations

**Plain-language summary:** Default-created fake homes are never cleaned up.

**What the code does today:** `runOnboard` silently creates a home when none is passed, but does not expose ownership or remove it. [test_onboard_bee.mjs:48-67](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:48)

**Why it matters:** The two default-home calls run `--apply`, so each leaves a copied skill tree under the system temporary directory. [test_onboard_bee.mjs:166-193](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:166) [test_onboard_bee.mjs:308-325](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:308)

**Concrete failure scenario:** Repeated local or CI suite runs accumulate `bee-onboard-home-*` trees and consume temporary-disk space.

**File/line evidence:** The final isolation check records generated homes but performs no cleanup. [test_onboard_bee.mjs:1270-1282](/home/thanhsmind/projects/goglbe/beegog/skills/bee-hive/scripts/test_onboard_bee.mjs:1270)

**Smallest credible fix:** Track whether `runOnboardAt` created the home and remove owned homes after `spawnSync`, or require every caller to allocate and clean an explicit home.