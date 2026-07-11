# Walkthrough — skill-sync

Reconstructed from execution records (cell traces, review findings, UAT), not from the plan.

## What shipped

`onboard_bee.mjs --apply` now updates the host repo's vendored helpers AND the global bee
skill set (`~/.claude/skills/bee-*`) in one run. Before any write, a three-version preflight
(source / host helpers / installed skills, read by a strict single-anchored-declaration
reader) refuses downgrades and unidentifiable trees with zero mutations; `--force-downgrade`
works only when all three versions resolve numeric and the dry-run shows exactly which
skills a forced run will touch. The mirror is lstat-only inside the `bee-*` namespace:
symlinked skills are skipped loudly (`blocked_symlink`), case-alias collisions are skipped
loudly (`blocked_alias`), non-bee skills are structurally unreachable, and stale/opposite-
type entries are cleared deepest-first before new content lands. New CLI statuses
`blocked_downgrade` / `blocked_no_source` carry the versions triple and a reason; skill plan
items carry `scope: installed|source`; the post-apply recheck is blocked-first and verifies
content parity (hashes), not versions. Six cells, commits: 61b314c (suite isolation),
62b0a51 (stage + safety tests), a037d86 (outcome matrix), 47ea74a (docs), 02662bf
(hardening fixes), 3d36b22 (contract fixes).

## How it was verified (actual evidence)

- Suite: 232+ checks in `test_onboard_bee.mjs` + 124 in `test_lib.mjs`, green at every
  cell cap AND re-run by the orchestrator at every goal-check (session shell). Frozen judge
  intact on all six cells.
- Red-first: every behavior cell recorded pre-change failures — 36 named failures for the
  stage itself; each of the 9 review P1 fixes reproduced its failure before fixing (incl.
  the mirror deleting a foreign skill, a repo under `~/.claude/skills` erasing itself with
  its `.git`, and a real sync-then-delete on a case-insensitive `/mnt/c` mount).
- Review: 5 independent codex reviewers (isolated context) → 50 raw findings → 9
  code-confirmed P1s → all fixed and re-greened; 7 P2 hardening items in `.bee/backlog.jsonl`.
- UAT (RUN, live in session): dry-run reported drift with the versions triple → apply
  synced exactly the drifted skill (`bee-hive`) → recheck `up_to_date`, 0 items, spot hash
  parity confirmed.

## How to test it yourself

1. `node skills/bee-hive/scripts/onboard_bee.mjs --repo-root . --json` — see the status and
   the `versions` triple; any skill drift appears as `sync_skill`/`remove_skill` items with
   `scope`.
2. Add `--apply`, re-run the plan mode: `up_to_date`, zero items.
3. To see the guard: run the same command from an older bee checkout — it exits with
   `blocked_downgrade`, names all three versions, and writes nothing.

## Deviations from plan

- The plan's 3-cell slice became 4 (validating panel F7 reordered isolation first), then 6
  with the review fix wave — each addition gate-recorded, no silent divergence.
- One worker auto-fix (rule 3): the corrupt-source fixture had to keep a valid
  `COMMAND_KEYS` export because the source `state.mjs` is ESM-imported, not just
  regex-read (recorded in skill-sync-2's trace).

## Known limitations / follow-ups (backlog, non-blocking)

- Symlink-swap TOCTOU window (stage-and-swap hardening) and no interprocess lock for
  concurrent applies — adjudicated P2, `.bee/backlog.jsonl`.
- Planning-path unstructured reads, zombie-type source entries, residual test gaps
  (digit-width compare, I/O-failure fixtures, fake-home leak hygiene).
- `~/.codex/skills` remains out of scope (manual), as documented.
