# Review — skill-sync (high-risk full wave)

Wave: 4 core + `api-contract` (trigger: the script's JSON contract changed) = 5/6, all on
the review slot (external codex CLI), isolated context (diff `fe80a87..47ea74a` +
CONTEXT.md + plan.md). Raw reports: `.bee/workers/review-ss-*.result.md` (50 raw findings).
Synthesis: orchestrator, after all five returned; every P1 cluster was verified against the
implementation before acceptance — reviewer word is never the evidence.

## Verification-evidence gate — PASS
`skill-sync-1` trace carries structured evidence: real red before-state (36 named failures
of the new suite against the pre-change script), tests inspected/added, green run (160→200
checks). Frozen judge intact on all four cells at goal-check.

## Artifact verification — PASS (EXISTS / SUBSTANTIVE / WIRED)
All five promised artifacts exist and are substantive; the stage is wired (29 integration
points in the script, SKILL.md teaches the new statuses, suite exercises them).

## Findings after synthesis (dedupe + corroboration + code verification)

### P1 — block merge (9 clusters, all code-confirmed)

1. **Partial install misclassified as fresh** (5/5 reviewers). `installed_skills` existence
   = `existsSync(<target>/bee-hive)` only (:440-447): a target holding newer `bee-*` skills
   but no `bee-hive` reads `absent` → older source overwrites/deletes them with no refusal.
   Fix: absent only when NO `bee-*` entry exists; otherwise unreadable version = `unknown`,
   refuse. `gated_auto`.
2. **Version reader accepts decoys and follows links** (2 reviewers). The "strict" reader
   matches the first `BEE_VERSION` substring anywhere (:198-210) — a comment
   `// BEE_VERSION = '0.1.18'` above the real `0.1.20` yields 0.1.18 and lets an older
   source pass; marker path follows symlinks. Fix: single line-anchored export match on a
   regular non-symlinked file, else `unknown`. `gated_auto`.
3. **Dir→file transition: the mirror deletes its own output** (4 reviewers). Cleanup loops
   use the stale target snapshot AFTER materializing the source shape (:547-575): installed
   dir `guide/` → source file `guide` writes the file, then the stale-dirs pass rm -rf's
   the path. Parity (D5) silently broken. Fix: remove stale/opposite-type entries
   deepest-first BEFORE materializing, or stage-and-swap the whole skill. `gated_auto`.
4. **Repo inside the global skill root can delete itself** (security). Overlap preflight
   compares source↔target only; `repoRoot=~/.claude/skills/bee-local` + a source lacking
   `bee-local` → `remove_skill` erases the live checkout (git history included). Fix:
   refuse repoRoot↔targetRoot overlap at preflight. `gated_auto`.
5. **Case-insensitive filesystems: sync then delete the same physical dir** (security).
   Exact-case string matching (`bee-hive` vs `bee-Hive`) on Windows/macOS lets the removal
   pass delete what the sync pass just wrote. Windows Git Bash is a supported platform.
   Fix: canonical-identity alias detection, fail closed on collision. `gated_auto`.
6. **Forced apply executes mutations hidden from dry-run** (2 reviewers). Blocked-forceable
   runs suppress skill items from `plan` but apply them under `--force-downgrade` — the
   human authorizes a downgrade without seeing which skills get overwritten/DELETED (D2
   violation). Fix: expose the computed items in the blocked dry-run. `gated_auto`.
7. **Recheck can report `up_to_date` while blocked** (3 reviewers). Post-apply recheck uses
   `plan.length` only (:1305-1312), discarding a blocked skill stage — false parity claim
   (D5). Fix: blocked-first precedence in recheck. `gated_auto`.
8. **`blocked_no_source` omits the version triple** (2 reviewers). Identity/overlap
   failures return `versions: null` — D3's letter requires all three reported. Fix:
   populate versions (with `unknown`) before every blocked return. `gated_auto`.
9. **Plan-item `path` silently changes root** (2 reviewers). Legacy items are repo-relative;
   new items are global-target-relative; `blocked_symlink` may reference source or install —
   an approval surface can render a deletion under the wrong root. Fix: per-item `scope`
   discriminator + document the base. `gated_auto`.

### P2 — filed, non-blocking (orchestrator-adjudicated severity where noted)

- **Symlink-swap TOCTOU / staging** (2 reviewers said P1; adjudicated P2 with reason: the
  race requires a concurrent adversarial process running AS the user, who can already edit
  anything directly; apply-time re-verification and random temp names exist. The
  stage-and-swap fix for P1-3 closes most of this window as a side effect). Backlog.
- **No interprocess lock for concurrent applies** (adjudicated P2: two simultaneous
  onboards on one machine is plausible in multi-session use; lock file is cheap hardening).
  Backlog.
- Planning-path unstructured reads can throw past the preflight (EACCES on realpath etc.) —
  mixed-state risk; backlog.
- Permission/IO failure mid-mirror leaves mixed versions (no per-skill transaction);
  largely subsumed by stage-and-swap. Backlog.
- Zombie skill preserved when a source entry is an invalid type. Backlog.
- Test gaps mirrored from the above (digit-width version compare, force-convergence,
  I/O-failure fixtures, self-referential fake-HOME assertion, dry-run read-only proof).
  Fold into the fix cells' test work where the fix lands; rest to backlog.
- **README still instructs the obsolete manual copy** (3 reviewers, P3→P2 by corroboration;
  also filed as friction by mason-3). Fix rides the fix wave's docs touch.

### P3
- Two matrix tests leak fake-home installs across cases (hygiene). Backlog.

## Disposition
P1 = 9 → merge blocked. All nine are `gated_auto` with concrete fixes; the natural shape is
one fix wave: a staging/identity hardening cell (fixes 1-5), a contract cell (6-9), and the
suite/README additions riding both.

## Fix wave disposition (post-Gate-4 fix-now choice)

- skill-sync-4 (02662bf, ceiling): P1 clusters 1-5 fixed RED-FIRST — each failure reproduced
  pre-fix (incl. the mirror deleting a foreign skill, the repo erasing itself with .git, and
  the real sync-then-delete on a case-insensitive /mnt/c mount), then greened. Suite 232
  checks; alias case re-run on a genuine case-insensitive filesystem with 0 skips.
- skill-sync-5 (3d36b22, generation): P1 clusters 6-9 + README P2 fixed RED-FIRST (16 new
  assertions captured failing against 02662bf, all green after). scope discriminator
  documented in SKILL.md.
- Orchestrator goal-check: both verifies re-run in the session shell (suite + test_lib
  green), judge intact on both cells, reservations empty.
- Cluster re-verification: live plan mode reports the versions triple; live apply synced the
  drifted skill and recheck reported up_to_date with hash parity (UAT RUN item, real output
  in session).

**P1 open: 0. P2 filed to backlog: TOCTOU staging, interprocess lock, planning-read
hardening, per-skill transaction, zombie-type entry, remaining test-gap items, fake-home
test hygiene (P3).**
