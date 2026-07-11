# Approach — skill-sync (high-risk lane)

## Chosen path

Extend `onboard_bee.mjs` in place — no new script (D2: one command). Four additions:

1. **Source/target resolution (D2).** Skills root = `path.dirname(HIVE_DIR)` — the tree the
   running script belongs to, with an **identity proof** (panel F2): `realpath(HIVE_DIR) ===
   realpath(<sourceRoot>/bee-hive)` must hold, else `blocked_no_source` (a misplaced
   launcher never adopts a sibling tree). Target = `path.join(os.homedir(), '.claude',
   'skills')` — **no production override exists** (panel F5: an env/CLI target would widen
   D1's deletion root to arbitrary paths); tests isolate by redirecting `HOME`/`USERPROFILE`
   for the spawned process, which `os.homedir()` honors on POSIX/Windows respectively.
   `realpath(source) === realpath(target)` (both existing) → skill stage is verify-only NOOP
   (installed-copy invocation); **ancestor overlap** (one root strictly containing the
   other) → fail-closed (panel F6). An absent target is a fresh install — no realpath is
   attempted on nonexistent paths. Source root missing or failing the bee-hive identity →
   fail-closed at preflight.
2. **Three-version preflight (D3).** Versions: `source` = a **fallback-free** version
   reader (advisor catch: the existing `readBeeVersion()` silently returns `0.1.0` on a
   missing/unparsable state.mjs — used as-is, a source-resolution failure would masquerade
   as an old version and `--force-downgrade` could override it, violating D3; the preflight
   reader returns `unknown` and refuses instead); `host_helpers` = same regex over
   `<repo>/.bee/bin/lib/state.mjs` (ground truth
   of what is physically vendored — `.bee/onboarding.json` can lie after a regression, as on
   2026-07-11); `installed_skills` = same regex over
   `<target>/bee-hive/templates/lib/state.mjs` (answers CONTEXT's open question: no new
   marker file — the installed tree carries its own version). Semver-compare; refuse iff
   `source < host_helpers || source < installed_skills` (unresolvable → refuse, reported
   `unknown`). Refusal/fail-closed happens BEFORE any write in `applyPlan` and is visible in
   `computePlan` output; `--force-downgrade` overrides version refusal only.
3. **Skill drift plan items (D4, D5).** Per `bee-*` dir in source: manifest = sorted
   relative file list + sha256 per file (reuses the existing `sha256`). Compare with the
   installed manifest: differ → `{action: "sync_skill", skill: "<name>"}`; installed `bee-*`
   absent from source → `{action: "remove_skill", skill: "<name>"}`. Apply = mirror the dir
   (write files, delete files/dirs not in source). The delete path iterates ONLY names
   matched by `/^bee-/` on the skill-dir level and only files inside those dirs — non-bee
   skills are structurally unreachable, not just checked.

   **Absent vs corrupt (cell-review catch, Gate-3-presented clarification of D3):** a target
   skills dir or `bee-hive` tree that does not exist = fresh install, proceed (no realpath
   comparison is attempted against a nonexistent path); a tree that exists but whose
   `state.mjs`/version cannot be read = `unknown` = refuse. Host side likewise: no vendored
   `state.mjs` = first onboard, proceed.

   **Symlink policy (cell-review + panel F6, Gate-3-presented decision):** all manifest
   walks and deletions use `lstat` semantics — symlinks are never followed, and temp files
   for atomic writes get unpredictable names (the existing predictable `<file>.tmp` is not
   used inside the managed namespace). A `bee-*` entry that is a symlink, or any symlink
   found inside a managed skill dir, marks that skill **blocked_symlink: the skill is
   SKIPPED with a loud per-skill report — never written through, never unlinked, never
   deleted**. Rationale: a symlinked skill dir is plausibly a developer's live checkout
   (e.g. `~/.claude/skills/bee-hive → <repo>/skills/bee-hive`); silently unlinking or
   mirroring through it destroys real work. Parity for that skill is reported as
   unresolved, overall status stays `changes_needed` with the reason named. Type collisions
   between non-link types (dir vs file) resolve by removing the target entry and writing
   the source shape.

   **Forced-downgrade reporting (panel F9):** a forced apply's JSON carries
   `forced_downgrade: true` plus the same `versions` triple; tests assert the field, not a
   prose notice. `--force-downgrade` is honored ONLY when all three versions resolved
   numeric — `unknown` and `blocked_no_source` are never forceable (they are resolution
   failures, not version disagreements).
4. **CLI contract.** New top-level statuses: `blocked_downgrade` and `blocked_no_source`
   (plan mode and apply mode both), each with `versions: {source, host_helpers,
   installed_skills}` and a one-line `reason`; process exit 1 on refusal in apply mode
   (plan mode reports the status, exit 0 — reporting is not failing). `changes_needed` plan
   gains the skill items; recheck after apply must land `up_to_date` with hash parity (D5).

## Rejected alternatives

- **Standalone `sync_skills.mjs`** — rejected at Gate 1 (D2): two commands to remember is
  the failure class itself.
- **Version-bump-triggered sync only** — rejected by D5: today's incident was equal-version
  stale content.
- **`.bee-skills-version` marker file** — rejected: a marker can lie independently of the
  bytes it describes; reading `BEE_VERSION` from the installed tree measures the artifact
  itself.
- **rsync shell-out** — rejected: not portable (Windows Git Bash), and the fence must live
  in code we test, not in flag spelling.

## Risk map

| Component | Risk | Proof needed |
|---|---|---|
| Delete path under `~/.claude/skills` | **HIGH** | Structural fence (delete unreachable outside `bee-*`) + hermetic tests incl. a non-bee sibling dir asserted byte-identical after a full sync-with-deletions run |
| Preflight ordering (zero mutations on refusal) | **MEDIUM** | Test: refused apply leaves target AND repo byte-identical (hash trees before/after) |
| Version parse/compare (3 sources, unknown states) | **MEDIUM** | Unit tests: missing files, unparsable state.mjs, prerelease-less semver compare |
| Installed-copy NOOP / source==target realpath | **MEDIUM** | Test via a fake HOME whose `.claude/skills` IS a copy of the source tree (no target parameter exists) |
| Windows/WSL paths, `os.homedir()` | LOW | Node-native paths only; no MSYS strings (critical pattern 20260708) |
| Existing onboarding behavior regression | LOW | Existing assertions preserved through the isolation retrofit; full suite green |

## Relevant learnings

- 20260711 (this repo): a removal is verified by invariants — the mirror + parity tests are
  exactly that discipline; also the incident that motivates D3.
- 20260708 harness09: never hand a `/tmp` MSYS string to node — tests use node-made temp
  dirs (`fs.mkdtempSync(os.tmpdir())` on the platform, or the session scratchpad).
- Critical pattern "boundary that lists field names": the bee-* fence must be structural
  (iteration domain), not a name-check sprinkled at call sites; test the fence with a
  payload (a non-bee dir present during deletion runs).

## Open questions for validating — RESOLVED by the advisor consult (code-verified)

- `applyPlan` write order: `computePlan` is fully read-only; apply's first write is inside
  the item loop, so a top-of-function preflight is cleanly pre-write. **One trap:** the
  unconditional `onboarding.json` rewrite AFTER the loop (~line 648) — refusal must return
  before reaching it. Cell 1 must_have.
- BEE_VERSION git history is plain `x.y.z` throughout — numeric triple compare suffices.

## Known consequence for the existing suite (advisor catch, reshaped by panel F5/F7)

`test_onboard_bee.mjs` spawns the real script with `--apply` and no isolation; once the
skill stage defaults to `~/.claude/skills`, every existing apply test would mutate the
developer's real home dir or trip the preflight. Resolution (F5): isolation happens by
redirecting `HOME`/`USERPROFILE` in the suite's spawn env to a per-run sentinel temp dir —
no production override exists. Ordering (F7): the isolation retrofit lands as its OWN cell
BEFORE the implementation, proven green against the current script; the implementation cell
then carries the safety-critical behavioral tests (fence payload, zero-mutation refusal,
symlink fail-closed, NOOP, fresh install) in the same cell with the suite as its verify —
destructive code and its proof are never separated. Supplementary matrix coverage follows.

**Fixture authority (panel F4):** because source authority = the executing file's own tree,
fake-source cases copy the launcher (script + its relative deps) into the fake
`skills/bee-hive` tree and execute THAT copy; only cases about the real tree run the real
launcher.

**Dispatch constraint (panel F8):** the suite spawns child processes; the codex sandbox
returns EPERM on nested spawn. Cells whose verify runs this suite are dispatched to NATIVE
workers only (matches the existing external-executor dispatch guard), and the orchestrator
goal-check re-runs the verify in the session shell — where the suite is proven to run
(baseline green this session).
