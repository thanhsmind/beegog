# 0014 — Grooming is project-first; the harness is out of scope

- **Status:** active — owner-approved 2026-07-09; **built in 0.1.12** (grooming rescope + capCell fix) and **0.1.13** (write-guard fd-dup fix + the missing skill-deploy step). Lib suite green (64/64), onboarding suite green.

> **Deploy gap found 2026-07-09 (important):** the first grooming rescope did not take effect in anphabe-gogl because skills live in `~/.claude/skills` + `~/.codex/skills` (installed once), while `onboard --repo-hooks` only refreshes the per-repo vendored `.bee/bin/`. So every SKILL.md prose change since ~0.1.6 (grooming scope, scribing-debt prose, model-tier prose, advisor contract) and the `bee-bypass-gate` skill itself were never on the machine — only the lib mechanics were. **Deploying bee changes needs BOTH: (1) `onboard --repo-hooks` per repo for `.bee/bin/`, and (2) copy `skills/*` → `~/.claude/skills` + `~/.codex/skills`.** Fixed by syncing all 14 skills to both runtimes.
- **Date:** 2026-07-09
- **Source:** owner ran `bee-grooming` in a real project (anphabe-gogl) and the report was almost entirely about **bee's own plumbing** — the entropy score (bee bookkeeping), `broken_tools` (a bee helper), a `.claude/*.bak` file, and a bug in bee's vendored `cells.mjs` — with the project's actual code debt barely present. Verdict: grooming had drifted into auditing the harness, in bee-jargon, instead of hunting the user's project. "Mục đích của grooming là tập trung trên project hiện tại, chứ không phải trên bee hay .claude/.codex."

## The problem

Two design faults made grooming navel-gaze:

1. **The entropy score is harness bookkeeping, not project debt.** Six of its seven terms come from `.bee/` records (orphaned/unverified cells, stale decisions, stale work, backlog, broken tools); only `stale_specs` is about the user's docs. Leading the report with that score frames grooming as "is the hive tidy", not "is the project healthy".
2. **The hunt never excluded the harness.** Nothing scoped the checks to the project's own files, so `.bee/`, `.claude/`, `.codex/`, and bee's vendored helpers surfaced as if they were project debt — including a genuine bee-lib bug presented as a project "kill".

## Decision

Rescope `bee-grooming` to be **project-first**, with a hard harness boundary and plain-language output:

- **Scope = the current project** (its source, docs, tests). A new "Scope" section makes this the first rule.
- **Harness is out of scope as project debt** — `.bee/`, `.claude/`, `.codex/`, the AGENTS.md bee block, vendored `.bee/bin/` helpers, plus `node_modules/`/build/generated trees are never kill/move candidates. A real bee/harness bug found during a hunt is a **one-line "report upstream to bee" note**, never a project proposal.
- **The entropy score is demoted** to a short "hive housekeeping" side-note (a few lines), explicitly labelled as bee's own tidiness; `broken_tools` and bee-lib bugs are harness health that routes upstream. `stale_specs` (the user's docs) stays in the project hunt.
- **Plain language** — findings name the module/file and what it costs in ordinary words, not bee vocabulary (cells, traces, capCell). Red flags added for jargon, for treating the harness as project debt, and for letting the score dominate.

## Companion bugfix (the harness bug grooming caught)

Grooming correctly diagnosed a real defect in bee's own `cells.mjs` (from decision 0011's work): `capCell` read `behavior_change` only from the CLI flag, never from the cell's declared `behavior_change`, so a cell planned as a behavior change lost its evidence/before-state guards — and its scribing debt — at cap unless `--behavior-change` was repeated. Fixed: `capCell` now falls back to the cell's declared value when the caller omits the flag (`bc = behavior_change === undefined ? cell.behavior_change === true : ...`), and `bee_cells.mjs cap` passes `undefined` when the flag is absent so the fallback applies. This makes decision 0011's scribing-debt signal and the 0009 before-state guard actually fire on planned behavior_change cells. Under 0014 this is exactly a "harness bug → fixed upstream in bee", not a project kill.

## Companion bugfix 2 — write-guard misparses `2>&1` (0.1.13)

Grooming also (correctly) flagged that the write-guard blocks read-only bash containing `2>&1`. Root cause: the redirect parser in `lib/guards.mjs` (`/^\d?>{1,2}(.*)$/`) captured `&1` from `2>&1` as an inline file target, so the idle intake-gate refused the command as a "write to a file named &1". Fix: fd-duplication targets (those starting with `&`, e.g. `2>&1`, `1>&2`, `>&2`) are no longer treated as file writes; a real redirect to a filename (`2>err.log`) still is. This is a pure harness bug — under 0014 it belongs upstream in bee, which is exactly where it was fixed.

## Rationale

- **Grooming's value is the project.** A hygiene pass that mostly reports on its own tool is noise to the user and buries the real debt. The harness has its own audit surface (`bee_status`); grooming should point outward.
- **The boundary is mechanical and simple.** A path-based exclude list is unambiguous and cheap to apply, and "harness bug → one-line upstream note" keeps genuine bee defects visible without polluting the project proposal list.
- **Plain language is the whole point of a human-facing audit.** If the owner can't read the finding without knowing bee internals, the audit failed its reader.

## Alternatives considered

- **Drop the entropy score entirely.** Rejected — hive housekeeping (loose cells, stale reservations, un-synced specs) is still useful; it just belongs in a small labelled side-note, not the headline.
- **Auto-file harness bugs to bee's backlog from the project.** Rejected — a project's `.bee/backlog.jsonl` is that project's, not bee's; a one-line upstream note is the honest hand-off. (A cross-repo harness-issue channel is a possible future PBI.)

## Scope (built)

- `bee-grooming/SKILL.md`: new Scope section (project vs harness, plain language), audit demoted to "hive housekeeping", hunt scoped to project files, harness/jargon red flags.
- `bee-grooming/references/grooming-reference.md`: harness-health note on the entropy table, exclude-paths rule at the top of the hunt checklists.
- Companion: `lib/cells.mjs` + `bee_cells.mjs` capCell behavior_change fallback; `test_lib.mjs` fix test. Version 0.1.11 → 0.1.12.

## Consequences

- Existing project grooming reports become project-focused and readable; harness issues shrink to one-line upstream notes.
- The capCell fix means cells planned as behavior_change now enforce evidence at cap even if the worker forgets the flag — slightly stricter capping (correct; that strictness was the intent of 0009/0011 all along).
- Not yet dogfooded: re-run grooming in anphabe-gogl to confirm the report now leads with project debt.
