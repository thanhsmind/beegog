# herding-adopt — CONTEXT

**Mode:** high-risk · **Opened:** 2026-07-23

## What this is

PR #50 (external fork, `vantt`) contributes a skill that uses **herdr as an orchestrator to drive
several Claude Code sessions in panes** — a dispatch loop that starts work and a merge loop that
retires it, each running as a cold process every 60 seconds. The owner wants that capability.

An adversarial review of the 1685-line contribution found the **design sound and the implementation
unsafe**. This feature adopts the design and lands the code only after the mechanical blockers and
the reproduced defects are fixed.

## Why high-risk

Four hard-gate flags, any one of which would suffice: it grants **merge authority to unattended
automation**; it invokes agents with **permissions fully bypassed**; it depends on an **external
provider** (`herdr`) whose JSON shapes are undocumented and unpinned; and it changes behavior an
existing test asserts (the distribution preflight refuses the skill by name today).

## What the review established, and what it corrected

**The earlier claim that CI was red only because of a stale release manifest was WRONG.** The real
refusal is `release inventory names an unsafe managed skill: herdr-orchestrating` — the distribution
preflight hard-requires `^bee-[a-z0-9-]+$`. Regenerating the manifest fixes nothing; it is the
messenger. Had it been forced green, **every plugin-first install would hard-refuse for every user**.

Second structural finding: the render filters skill directories on `/^bee-/`, so as contributed the
skill **ships to nobody** — merging it would deliver nothing to any user's skill root.

Reproduced defects, in seconds:

- A trailing flag makes both shell scripts spin at 100% CPU forever (`shift 2` fails under `set -u`
  with no `set -e`, and nothing checks it).
- A non-numeric interval turns the 60s loop into a hot loop — **872 iterations in 4 seconds**, each
  one an agent invocation in production.

Three properties the documentation calls containments, none of which is enforced by code:

- The **lane-safety filter** passed **8 of 8** real backlog rows, including one whose story is
  "delete the entire JS runtime". It reads a single backlog line and never opens the feature's own
  context, so it judges work by its title.
- The **four-slot cap** is an LLM counting panes; a spawned agent that fails to self-name leaves a
  slot looking free, and the loop spawns again every 60 seconds.
- The **stop file** is checked only at the top of each cycle, against a 5400s iteration timeout — a
  window of up to ~91 minutes in which merge and cleanup can still fire after the human said stop —
  and it never stops the working agents at all.

## Locked decisions

**D1 — Rename to `bee-herding`.** Not a preference: the distribution preflight refuses any other
shape, and the render skips it. Every internal path reference moves with it.

**D2 — Regeneration follows the rename, never precedes it.** Render first, then the manifest, and
all three of the manifest check, the installer end-to-end suite and the skill-render suite must be
proven green independently — the manifest going green does not imply the others.

**D3 — The reproduced shell defects are fixed before anything else is considered.** Argument parsing
must refuse a missing value rather than spin; the interval, timeout and iteration count must be
validated as positive integers. Both have one-line regression tests and both get one.

**D4 — The loop is bounded.** A consecutive-failure ceiling and backoff, so a missing binary cannot
produce an infinite retry, and a default iteration cap.

**D5 — The stop gesture must actually stop.** Checked before and after each iteration, and the
iteration supervised so the file takes effect during it. It must state plainly, in its own docs, that
it does not stop already-running working agents, and offer a way to stop those too.

**D6 — Documentation may not claim a containment the code does not enforce.** The line promising the
loop "will not pick up hard-gate work" is contradicted by the contribution's own text and by
measurement; it is corrected rather than shipped.

**D7 — The control panes get a tool allowlist; the working agents' posture is the owner's explicit,
recorded decision.** The two control panes read state and drive bee/herdr — they never need to write,
so they are narrowed. The working agents are what the feature exists to create, and their posture is
a judgement only the owner makes; it is recorded as an accepted risk with its reasoning, not decided
silently here.

**D8 — The lane classifier reads the work, not the title.** A filter that grades a feature by one
backlog line is the structural defect; the keyword list is only its symptom.

**D9 — The dangling rationale is resolved.** The contribution cites eighteen decisions from a
history directory that does not exist here. They are either vendored or stripped — an unresolvable
"why" is worse than none, because it reads as though a reason exists.

## Advisor consult — two of my own assumptions were disproven

Full digest: `reports/advisor-digest.md`. Returned SOUND WITH CHANGES, and the changes are
load-bearing.

**D3-REVISED — hardening precedes the shipping switch.** The shell fixes are name-independent, and
"green gates" is this repo's release signal at a bypass level where nothing stops between cells.
Landing first opens a window in which a **releasable tree** ships a script that one trailing flag
turns into 100% CPU forever — reaching plugin users, not just this checkout. The rename may land
first (largest churn), but **manifest regeneration moves to after the hardening is green**.

**D7-REVISED — the control panes DO write, and the two posture halves are coupled.** My assertion
that they "never need to write" was measured false: dispatch creates a worktree and registers a
grant; merge aborts against main, writes markers, and runs the cleanup that deletes a branch and
removes a worktree. Taking "read-only" literally yields a dispatch pane that cannot dispatch and a
merge pane that cannot merge — a silent stall every 60 seconds, the exact failure this feature exists
to kill. The allowlist is an **enumerated command surface**, never "read-only". And the halves do not
separate: the merge pane runs verify against the just-merged tree, so it **executes code the
unsandboxed working agents wrote**. The posture decision covers both or it is misleading.

**D10 — the deferred backlog reconciliation was unsound; a hard interlock replaces it.** My "the loop
selects nothing, which is the safe failure" reasoning was empirically wrong. The classifier anchors
on the Status *value*, not column position, so it already parses this repo's table — which is exactly
why the review got 8 of 8 rows through it. The only mismatch is prose, interpreted ~1,440 times a day
by a cold model deciding whether a slug in a column headed `Feature` counts as a feature annotation.
Two rows satisfy every dispatch condition today, one of them installer/release work — and exploring's
own rule **manufactures** more such rows as a side effect of normal operation, because the
dispatchable state is this repo's ordinary post-exploring state. So: **dispatch refuses to build a
dispatchable set unless an explicit owner-created enable marker exists**, honoured only once the
classifier reads real work (D8). Every other defect needs the loop running to hurt; this one decides
its first minute.

**D11 — merge is not a loop. It is an owner gesture.** The risk concentrates in unattended *merge*:
it alone carries the merge-authority hard-gate flag, the long stop-latency window, and the
execute-agent-code exposure. Bootstrap starts **only the dispatch loop**; merge runs single-shot on
request, using the flag the contribution already ships. Dispatch is the low-authority half — worst
case it starts work in an isolated worktree. This costs nothing except being present when something
lands in main, and for a system whose lane filter passed "delete the entire JS runtime", being
present is the point. Graduating merge to a loop is a later decision, on evidence.

**D12 — adoption is not done until one supervised end-to-end cycle has run.** Every decision above
retires a defect found by running things, yet nothing in the plan runs the assembled system. One
watched, cheap cycle is the exit criterion. Iterations are bounded; **spend is not** — the control
invocations get a turn ceiling too.

## Out of scope

- Making the four-slot cap mechanical (worth doing; larger than this adoption).
- Pinning a `herdr` capability probe.
- Graduating merge from a gesture back to a loop (D11) — a later decision, on evidence.
