# Advisor consult digest — herding-adopt (pre-Gate-3)

Advisor: fable (`models.claude.advisor`). Read-only. Advice, never approval.
Every claim below was measured against the live repo, not predicted.

## Verdict: SOUND WITH CHANGES

The nine locked decisions are individually right. **Two load-bearing assumptions around them are
wrong**, and one is disproven by measurement.

## Finding 1 — the "safe failure" the out-of-scope call rests on does not exist

CONTEXT deferred reconciling the backlog format, reasoning that while the formats disagree the loop
selects nothing. Measured, that is false:

- The lane classifier **does not parse by column position**. It anchors on the Status *value*,
  treating everything after it as notes — so it parses this repo's five-column table perfectly. That
  is precisely why the earlier review got 8 of 8 rows through it. The script side already agrees with
  this repo.
- The only remaining mismatch is **prose**: the dispatch role wants an inline feature annotation in a
  notes column; this repo has a column literally *headed* `Feature` holding the bare slug. The
  interpreter of that prose is not a parser — it is a cold model, re-deciding ~1,440 times a day
  whether a slug in a column named "Feature" counts as a feature annotation.
- If that coin lands wrong **once**: two rows satisfy all four dispatch conditions *right now* —
  both `in-flight`, both with a context file present, neither holding a worktree grant, both with
  zero cells. One of them is installer/release work.
- Structurally worse: exploring's own rule **manufactures** such rows as a side effect of normal
  operation — every feature that finishes exploring flips its row to `in-flight` with its slug at
  exactly the moment it has a context file, no worktree and no cells. **The dispatchable state is
  this repo's normal post-exploring state.**

> Not a loaded gun with the safety on; a loaded gun whose safety is a language model's reading of a
> column header.

## Finding 2 — the permission split is coherent in shape, wrong in premise

CONTEXT asserted the control panes "never need to write". Measured against the contribution, they do:
dispatch creates a worktree and registers a grant; merge runs an abort against main, writes marker
files, and runs the merge-with-cleanup that deletes a branch and removes a worktree.

An implementer taking "read-only" literally produces **a dispatch pane that cannot dispatch and a
merge pane that cannot merge** — and since these are headless loops that never exit, the failure is a
silent stall every 60 seconds, the exact bug class the feature exists to kill.

Correct form: narrow to the **enumerated command surface**, not "read-only".

What narrowing buys, honestly: it stops the control model improvising (a cold model at ~2,880
iterations/day will eventually decide to "helpfully" clean a dirty main). What it does **not** buy:
the merge pane runs the project's verify against the just-merged tree — i.e. it **executes code
authored by the unsandboxed working agents** in main's context. The two halves of the posture
decision are therefore **coupled, not separable**.

## Finding 3 — sequencing: harden before landing

The rename is the largest textual churn, but the shell fixes are **name-independent** — the argument
loop and its validation reference the skill name nowhere. Meanwhile "green gates" is this repo's
release signal, and the bypass level is `total`, so nothing stops between cells. Landing first opens
a window in which a **releasable tree** ships a script that one trailing flag turns into 100% CPU
forever — to external plugin users, not just here.

Minimum acceptable fix if cell order is locked: the **shipping switch** (manifest regeneration) moves
to after the hardening is green.

## Finding 4 — nobody ever runs the assembled system

Every decision is a unit-level retirement of a known defect, and every defect on that list was found
by *running things* — yet no cell runs one supervised end-to-end cycle before adoption is declared.
Given Finding 1, the first end-to-end run would otherwise happen unsupervised. Related: iterations are
bounded, **spend is not** — no turn or budget ceiling on the control invocations.

## Finding 5 — a materially smaller shape exists

The capability wanted is parallel sessions in worktrees with automated retirement. The risk
concentrates in **unattended merge** — it alone carries the merge-authority hard-gate flag, the long
stop-latency window, and the execute-agent-code-via-verify exposure.

> Bootstrap starts **only the dispatch loop**. Merge becomes an owner gesture — the single-shot flag
> already exists in the contribution. One keystroke replaces the entire stop-file apparatus for the
> dangerous half, because nothing lands in main without a human present.

Drops one of four hard-gate flags outright, shrinks stop-latency to the harmless half, and costs the
owner nothing except not being asleep when merges happen — which, for a system whose lane filter
passed "delete the entire JS runtime", is a feature.

## Highest-value single change

Replace the out-of-scope rationale with a **hard interlock**: dispatch refuses to build a dispatchable
set unless an explicit owner-created enable marker exists, created only after the classifier lands.
Every other defect requires the loop to be running to hurt; this one decides what happens in its first
minute.

---

## Owner resolution (recorded after the consult, on its recommendations)

Both of the advisor's decision-shaped findings were put to the owner and both were resolved in the
advisor's direction:

- **Finding 5 accepted — merge becomes an owner gesture.** Bootstrap starts only the dispatch loop.
  Merge runs single-shot on request using the flag the contribution already ships. This drops the
  merge-authority hard-gate flag, the stop-latency window, and the execute-agent-code-via-verify
  exposure in one move. Cost accepted: the owner is present when something lands in main.
- **Finding 2 accepted with the correction it identified — the working agents keep their broad
  posture as an explicitly recorded accepted risk, with blast radius stated; the control panes are
  narrowed to an *enumerated command surface*, never to "read-only", because the advisor measured
  that both control roles genuinely write.** The coupling the advisor named is recorded with it: the
  merge pane runs verify over the just-merged tree, so it executes code the working agents authored.

Findings 1 (harden before the shipping switch), 3 (the interlock replacing the unsound deferral) and
4 (a supervised cycle plus a spend ceiling) are adopted into the plan as D3-REVISED, D10 and D12 with
no owner question needed — they correct the plan rather than trade anything off.
