# issues-46-53 — CONTEXT

**Mode:** standard · **Opened:** 2026-07-23

## Why this feature exists

Seven issues were filed against bee on 2026-07-22 (#46, #47, #48, #49, #51, #52, #53). A triage pass
measured or code-proved each one. The headline finding is that **four of the seven name the wrong
cause** — so fixing what was reported would have fixed nothing, or fixed the wrong thing.

| # | Symptom | Verdict | Reported cause |
|---|---|---|---|
| 49 | Duplicate PBI id | REAL — `P50` is duplicated on disk today | **Wrong.** No allocator code exists and no concurrency was involved |
| 47 | `--cleanup` skipped on a no-op merge | REAL, deliberate, test-pinned | Correct |
| 46 | worktree / branch / feature name mismatch | REAL | **Wrong.** All three are one value at creation; the drift is later |
| 48 | close phase fires before the commit | REAL gap, no code defect | Partly — it is a missing step, not a misordered write |
| 51 | verify runs on the first question | PROSE-ONLY | **Wrong.** Nothing executes verify automatically |
| 52 | tokens burned on arrival | REAL, measured | Partly — the hooks are cheap; the instruction checklist is not |
| 53 | internal scratch scripts shown in the view | agent habit | **Wrong.** Bee has no mechanism that surfaces them |

## Locked decisions

**D1 — #49 is a missing uniqueness CHECK, not a missing allocator.** There is no code that allocates
`P<n>`; the rule lives in prose and is executed by an agent editing a markdown table. The committed
duplicate was authored **a day apart on different branches**, each author computing "next free" from
a snapshot that predated the other — so a lock would prevent nothing. The fix is a uniqueness check
over the rows in the chain, plus repairing the live duplicate. A CLI allocator is a larger, separate
idea and is out of scope: the check is what stops silent drift, and it is what was missing.

**D2 — The live `P50` duplicate is repaired by renumbering the LATER row,** because ids are cited
elsewhere and the earlier row has had the id longest. The vacated number is never reused (the
backlog's own stated rule).

**D3 — #47: `--cleanup` must not silently evaporate.** On the `ALREADY_UP_TO_DATE` path the flag is
accepted and then dropped, exit 0, no message. The general rule "cleanup is strictly post-commit" is
correct for a conflicted or verify-red merge, where work is not integrated — but `ALREADY_UP_TO_DATE`
means the branch holds nothing main lacks, and the dirty-tree refusal upstream has *already proved*
the worktree has no uncommitted work. Cleanup is safe there and must run. A test currently pins the
opposite; that assertion encodes the defect and is rewritten, not worked around.

**D4 — #46: the worktree's identity is fixed at creation and must stop being read from a mutable
field.** Directory, branch and feature all derive from one slug at creation. What drifts is
`state.feature`, which is freely rewritten later — and the paved road tells the agent to create the
worktree *before* exploring has settled what the feature is called, so the drift is designed-in, not
user error. The merge check derives its expected branch from that mutated field and therefore refuses
with a message blaming the **branch** — the one thing the user must not change. Record the creation
slug immutably at bootstrap and prefer it; the refusal message must name the field that actually
drifted.

**D5 — #51 is an instruction defect: a conditional rule sitting inside an unconditional numbered
list.** The baseline gate reads "run it once per session **before claiming any cell**" as item 7 of a
`## Startup` list whose items 1, 3 and 6 say "every session". An agent working the list top-to-bottom
runs it on a question that touches no cell, costing 30–90 s. The rule itself is right; its placement
and its word order are not. Lead with the trigger, and move it out of the startup list.

**D6 — #52 is real, and the cost is in the instructions, not the hooks.** Measured: the whole
automatic layer is ~150 ms and ~1.4k tokens. What the instructions then mandate before the agent has
read the question is ~99 KB of text plus a 20k-token knowledge budget — and `status --json` and
`decisions active` re-fetch what the preamble just injected. The fix is to say so: the preamble is
the source for phase, gates, feature and recent patterns, and the scout re-runs only when about to
route work.

**D7 — #53 gets an honest answer, not a code change.** No bee mechanism surfaces scratch scripts;
bee's own write guard *forces* helper scripts into the scratch home, and the harness displays the
call like any other. Hiding it is a harness display concern, outside bee. The one real adjacent
finding is that the scratch home holds 75 stale entries, so the documented per-feature sweep is not
actually running at close — that is in scope.

**D8 — Where a fix contradicts an existing pinned assertion, the assertion is rewritten with its
reason, never bypassed.** #47's current test pins the silent drop.

**D9 — The last cell owns the derived-artifact regeneration for the whole feature** (runtime mirror,
plugin trees, release manifest, managed-hash ledger), and the full chain runs after the final edit,
both with and without the agent-name prefix.

## Out of scope

- A `bee backlog next-id` allocator (D1) — the check is the fix; the allocator is a separate idea.
- Hiding scratch-script calls from the harness display (D7) — not bee's surface.
- Reducing the instruction corpus itself (D6 addresses the duplicate *fetches*, not the size of the
  skills).
