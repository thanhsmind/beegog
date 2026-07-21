# CONTEXT — intake-gate-git-exemption

**Feature slug:** `intake-gate-git-exemption` · **Date:** 2026-07-22 · **Source:** a real incident in this repo (commit `a7d2069`), plus backlog **P46** / GH #1 which described the same trap on 2026-07-17 and has been open since v1.3.10.

## Boundary

In scope: (a) the intake gate's treatment of git/VCS commands, and (b) where machine-local guard/hook toggles are persisted. Out of scope: the intake gate's actual purpose (blocking *source* work when no bee work is active) — nothing here may reopen that door; the write-guard's other checks; `.claude/settings.json` discipline (separate, already ruled).

## The incident (what actually happened, 2026-07-22)

Closing the `merge-prs-44-45` lane set the phase to `compounding-complete`. Two bookkeeping files (`.bee/decisions.jsonl`, `.bee/cells/mpr-1.json`) were still uncommitted. The intake gate then refused the `git commit` itself — writes to `.bee/` are permitted, but the *git command* is blocked once the phase is terminal. The documented escape (`bee config set --key guards.idle_gate --value false`) writes into the **tracked** `.bee/config.json`; the commit was staged with `git add -A` **before** the gate was restored, so `a7d2069` shipped `guards.idle_gate: false`. Anyone pulling would have silently lost the intake gate. Caught on a follow-up status check and corrected in `63a41e0`.

Two independent defects made that possible, and P46 predicted the first:
1. **The gate forces a workaround for work it does not object to.** Committing `.bee/` bookkeeping is not source work; the gate has no reason to block it, yet blocking it pushes the operator toward disabling the gate — the most dangerous available action.
2. **A machine-local, temporary toggle is persisted to a team-tracked file.** `.bee/config.local.json` already exists as the gitignored overlay (hardening-8) and is the correct home; `config set` writes to `config.json` regardless of what is being toggled.

## Locked decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | **Git commands are exempt from the intake gate when everything they would commit is bookkeeping.** Read-only git (`status`, `log`, `diff`, `show`, `rev-parse`, `branch --list`, `tag --list`, …) is always allowed. A mutating git command (`commit`, `add`, `push`, `tag`, `merge`, …) is allowed while the phase is terminal **only if every staged/target path is inside the writable-without-routing set** (`.bee/`, `docs/`, `plans/`, `AGENTS.md`); a single source path in the staged set keeps the refusal exactly as today. | P46's own question, answered: read-only always, mutating only over paths the gate already permits writing. The gate exists to stop *source* work between features; it was never meant to stop the workflow from recording itself. |
| D2 | **Guard and hook toggles are machine-local: they persist to `.bee/config.local.json`, never to the tracked `.bee/config.json`.** `config set/unset` routes the `guards.*` and `hooks.*` namespaces to the local overlay (which already exists and is gitignored); reads keep the existing overlay precedence. An existing tracked toggle keeps working (read compatibility) but is never *written* there again. | A temporary, per-machine safety lift must be structurally incapable of reaching a teammate. This is the defect that turned a workaround into a leak. |
| D3 | **The refusal message stops recommending the dangerous escape as the first option.** When a mutating git command is refused, the message names the bookkeeping-only exemption and the ordinary route (commit bookkeeping *before* closing the phase); the `guards.idle_gate` switch is mentioned last, as a repo-level opt-out, not as the way to finish a commit. | The operator followed the message and the message pointed at the gun. A refusal's FIX line is an instruction — it must point at the safe path first. |
| D4 | **No exemption is inferred from intent.** Eligibility is computed from the actual staged/target paths at the moment of the check, never from the command's wording, a flag, or an environment variable. | `git commit -m "just bookkeeping"` must not be a bypass. The check is on what the command would change, and nothing else. |

## Pinned terms

- **Bookkeeping path** — a path inside the gate's existing writable-without-routing set (`.bee/`, `docs/`, `plans/`, `AGENTS.md`).
- **Terminal phase** — `idle` or `compounding-complete`; the states in which the intake gate refuses source work.
- **Local overlay** — `.bee/config.local.json`, gitignored, machine-scoped, already read by config resolution.

## Scout paths

- Incident: `a7d2069` (leak) → `63a41e0` (correction)
- Backlog `P46` (docs/backlog.md), GH #1
- `.bee/bin/lib/guards.mjs` (`checkWrite`, the intake-gate branch and its FIX text)
- `.bee/bin/lib/state.mjs:1261-1310` (`config.local.json` overlay, hardening-8)
- `.bee/bin/hooks/bee-write-guard.mjs` (the shim that extracts Bash targets)

## Open questions (for planning)

- Whether `git push` deserves the same exemption as `commit` (leaning yes — pushing bookkeeping is the same class) or should always be allowed (leaning no — pushing is outward-facing).
- Whether an already-tracked `guards.*` value should be migrated out of `config.json` automatically or only stop being written (leaning: stop writing, warn on read, never auto-edit a tracked file).

## Deferred ideas

- A `bee close` verb that commits bookkeeping and sets the terminal phase in one ordered step, removing the sequencing trap entirely.
