# CONTEXT — tree-hygiene

**Feature slug:** `tree-hygiene` · **Date:** 2026-07-21 · **Source:** user report — "bee khi chạy sẽ ghi ra file rất nhiều để làm document, nhưng có những file quên xoá khiến rác… tất cả các file nếu được ghi ra từ bee làm file tạm nên ghi trong thư mục `.bee`"

## Boundary

In scope: **every ephemeral file bee itself writes while working** — judge payloads, evidence/deviation files, batch data, digests, verify logs, probe scripts, debug harnesses, review manifests — where they land, and who removes them. Also in scope: the crash-leak scratch (atomic-write tmp, render swap dirs) that nobody sweeps. Out of scope: deliberate deliverables (`docs/history/<feature>/**` reports, CONTEXT/plan, `docs/specs/`, `docs/decisions/`, `.bee/cells/`, `.bee/decisions.jsonl`, plugin trees) — those are the product of the work, not scratch; and machine-level files outside the repo.

## Evidence (measured in this repo, 2026-07-21)

1. **153 MB / 9,176 files accumulated in `.bee/spikes/`**, never swept. It is gitignored (so `git status` stays quiet) but it is exactly the "rác" the user reports: verdict payloads (`verdict-1710-*.json`), ad-hoc notes (`d1710-*.txt`), `verify-out.txt`, `review-diff-files.txt`, probe scripts, PNGs, and a whole nested clean-clone of the repo.
2. **This very session added ~30 more scratch files** to that pile — judge payloads, deviation notes, 24 backfill batch/result JSONs, a wave-close verify log — every one written to a hand-picked path, none swept afterwards. The pattern is the norm, not an accident.
3. **Scratch has landed in TRACKED directories:** a crashed worker left `.rel1710rc3_stress_debug.sh` and `.rel1710rc3_stress_verify.sh` inside `.bee/bin/` (tracked); they were only removed because the next worker was explicitly told to delete them. Nothing structural prevented it.
4. **The prose already patches this case-by-case, which proves the gap:** `bee-executing` forbids evidence files ("pipe with `--evidence-stdin` so no evidence file is ever written… if you must use `--evidence-file`, write to a throwaway path outside `docs/history/` and delete it"), `bee-planning` forbids "per-cell scratchpad files", `bee-validating` routes disposable harnesses to `.bee/spikes/<feature>/`. Three separate rules, three different homes, no sweep, and a decision (0009) already had to delete duplicated evidence files once.
5. **Crash-leak scratch nobody sweeps:** `render_plugin_skill_trees.mjs` sweeps stale `<base>.tmp-*` siblings but never `<base>.old-*` (created at `:197`, removed only on the success path at `:208`), and those sit beside tracked, non-`.bee/` trees. `writeJsonAtomic` (`fsutil.mjs:87-91`) and the jsonl/text variants leave `<file>.<pid>-<ctr>-<rand>.tmp` behind if the rename throws, with no `*.tmp` ignore rule anywhere.
6. **Not the problem (user corrected an earlier misreading):** the onboarding `.bak` backups are a small, separate matter. They ride along under the same "scratch lives in `.bee/`" rule (D2) but are not the cause of the reported garbage.

## Locked decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | **One canonical scratch home: `.bee/tmp/<feature-or-session>/`.** Every ephemeral file bee writes — judge payloads, `--evidence-file`/deviation files, batch inputs, digests, verify logs, probe/debug scripts, review manifests — is written there and nowhere else. `.bee/spikes/<feature>/` narrows to what its name means: code that proves a yes/no feasibility question. Nothing ephemeral is ever written to a tracked directory (`.bee/bin/`, `docs/**`, repo root, plugin trees) or to a hand-picked path. | The user's ask, stated as a single rule an agent can follow without judgement. Today's three partial rules with three different homes are why scratch still lands wherever the writer felt like it. |
| D2 | **Scratch is swept, not merely ignored — by an explicit verb and at close.** A `bee tmp sweep` verb removes scratch: by default everything for closed/absent features plus anything older than an explicit age; `--all` clears the lot; `--dry-run` lists first. Feature close (compounding) and session finish run it for the finishing feature. `.bee/spikes/<feature>/` for a closed feature is swept the same way. In-repo `.bak` backups relocate under `.bee/backups/` (stamped) so they too live in one swept-able place. | "Gitignored" answered the wrong half of the complaint: `git status` stayed clean while 153 MB accumulated. Deletion must have an owner and a moment, or it never happens. |
| D3 | **Crash-leak scratch cleans itself.** The render's `.old-*` swap dirs get the same stale-sweep and `finally` cleanup its `.tmp-*` siblings already have (never touching a dir owned by a live pid); the atomic writers unlink their tmp when the rename throws, then rethrow the original error. The managed `.gitignore` block gains `.bee/tmp/`, `.bee/backups/`, the atomic-tmp *shape* (never a greedy `*.tmp` — a human's own `notes.tmp` stays visible), and the four plugin swap-dir patterns. | Cleanup that only runs on the happy path is not cleanup. Ignoring is the belt; self-cleaning is the braces. |
| D4 | **The guard enforces the home; the prose states it once.** The write-guard denies a scratch-shaped write (`.tmp`, `.log`, `.bak`, `debug`/`stress`-named scripts, `verdict-*.json`-style payloads) that targets a tracked directory, naming `.bee/tmp/` in the refusal. The three scattered prose rules collapse into one doctrine-layer rule that every skill cites instead of restating. | A crashed worker put a debug script into `.bee/bin/` because nothing stopped it — prose alone did not hold. This is the same "hook is a safety net, law is the doctrine" split bee already uses. |
| D5 | **A deliverable is defined by where it is required to be, not by its extension.** Reports under `docs/history/<feature>/reports/`, specs, decisions, backlog, plugin renders and cell/decision stores stay exactly where they are — the sweep never touches them, and the guard never blocks them. | The fix must not start eating the knowledge layer; the failure mode of an over-eager cleanup is worse than the garbage. |
| D6 | **Existing garbage is cleared once, with the numbers reported.** The 153 MB backlog is swept in this feature (closed features first, `--dry-run` reviewed before deletion), and the before/after size is recorded in the close report. | The user asked for the mess to stop *and* the mess to go; a rule that only applies to future files leaves the reported symptom on disk. |

## Pinned terms

- **Scratch** — any file bee writes for its own working purposes, whose deletion loses nothing a human or a later session needs.
- **Deliverable** — a file the workflow *requires* at a defined path (reports, specs, decisions, backlog, stores, renders). Never scratch.
- **Scratch home** — `.bee/tmp/<feature-or-session>/`, gitignored and swept.
- **Feasibility spike** — code proving one yes/no question, `.bee/spikes/<feature>/`; swept when the feature closes.

## Scout paths

- `.bee/spikes/` (153 MB / 9,176 files — the measured backlog)
- `skills/bee-executing/SKILL.md:113,125` + `references/worker-details.md:90` · `skills/bee-planning/references/planning-reference.md:142` · `skills/bee-validating/SKILL.md:57` (the three partial rules)
- `scripts/render_plugin_skill_trees.mjs:155-178,197,208-211` · `skills/bee-hive/templates/lib/fsutil.mjs:87-91` · `templates/lib/decisions.mjs:218,983`
- `skills/bee-hive/scripts/onboard_bee.mjs:102-130` (managed ignore block), `:3140,3148` (in-repo `.bak`), `:3160` (machine-level, out of scope)
- `.bee/bin/hooks/bee-write-guard.mjs` (the guard that will carry D4)

## Open questions (for planning)

- Default age for `bee tmp sweep` when no feature filter is given (leaning: require an explicit `--before` or `--all`, same discipline as `decisions archive`).
- Whether the guard's scratch-shape list is configurable per host or fixed (leaning: fixed, with `.bee/config.json` escape hatch only if a host complains).

## Deferred ideas

- Auto-sweep on a timer or at session start (rejected for now: deletion should ride an explicit moment a human can see, not a background daemon — consistent with the no-daemon rule).
- Quota/size warning in `bee status` when the scratch home crosses a threshold.

## Canonical references

- User report + correction, 2026-07-21 (this session)
- Decision 0009 (duplicated evidence files removed once already — the precedent this generalizes)
