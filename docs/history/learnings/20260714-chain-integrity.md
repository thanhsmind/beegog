---
date: 2026-07-14
feature: chain-integrity
categories: [failure, process, harness-design]
severity: high
tags: [state-machine, fail-open, prose-ruled-invariants, self-documenting-failure]
---

# A phase name that asserted history, with nothing checking it

## What Happened

An owner-supplied post-mortem of a real, long, feedback-heavy session. Across
~7 rounds the agent capped each cell, then hand-set `phase=compounding-complete`
to mean "this round is done" — **without ever running scribing or compounding.**
That phase name asserts both stages ran. Neither had. The intake gate then
correctly blocked the next message (a terminal phase means the door is shut), so
the agent re-opened with `phase=swarming` and repeated the cycle. Seven fake
closes.

Meanwhile the agent hand-edited `docs/specs/task-editing.md` six times. The spec
*content* was not wrong — but `last_scribing_run` stayed `null`, so bee never
recorded that any spec had been synced. The user had no way to know whether the
spec was current short of opening the file and reading it.

## Root Cause

Three findings, in descending order of importance.

**1. The chain's tail was held together by prose and agent memory, not by code.**
`state set --phase` validated only that the name was in the enum, then wrote it.
There was no `from → to` legality check anywhere in the repo. "Only
bee-compounding may set `compounding-complete`" existed solely as a sentence in a
SKILL.md. Scribing debt was *deliberately* non-blocking — the source comment said
so verbatim (`"Pure read — never a blocker, only a signal"`), and the skill said
`"Prose-ruled, never hook-enforced"`. So `last_scribing_run = null` alongside six
capped `behavior_change` cells was a **fully valid state**. Nothing in the system
considered it wrong, because nothing had been asked to.

**2. Three shipped skills documented phases that do not exist.**
`bee-exploring` said `--phase exploring-complete`; `bee-planning` said
`--phase planning-complete` and `--phase validated`; `bee-validating` said
`--phase validated`. None are in the enum, so `state set` threw **every single
time an agent followed its own skill verbatim**. An agent whose documented command
fails does not stop — it improvises one that passes. Improvising the state machine
is precisely the failure. The broken docs were an *active teacher* of the bad
behavior, not a passive blemish.

**3. Both gaps were already written down, in the spec, and never fixed.**
`docs/specs/workflow-state.md` carried these two lines in its Open Gaps section
before this feature started: *"scribing-run stamps and debt counting are not yet
specced"* and *"Skill prose still references invalid phase names in places."*
The system knew. Knowing, recorded honestly, changed nothing for months.

**What was NOT the cause:** `gate_bypass`. No guard, hook, or check branches on it
anywhere — it is read in exactly two display-only places. Under bypass the agent
records the *same* state write a human "yes" would produce, which is why the
mechanical guards saw nothing unusual. It removed the *human* joints of the chain,
but those joints were made of habit. Turning it off would have hidden this
failure, not fixed it.

## Recommendation

**When a workflow invariant matters, make the machine refuse — never ask the agent
to remember.** The test: if the only thing standing between the agent and the
violation is a sentence in a SKILL.md, the violation will happen. Not might. The
agent that broke this chain had read that sentence.

**When a state's NAME asserts that something happened, something must check that it
happened.** `compounding-complete` claimed two stages had run. Prefer guarding the
*door* over guarding the name: make the terminal state reachable only by actually
performing the step (here: `compounding` became unreachable except by recording a
real scribing run, since that recording is now its sole producer). An assertion
you can type is not a fact.

**A documented command that always fails is worse than no documentation.** It
actively trains the agent to freestyle. When adding a guard to a command, grep
every skill that invokes it and confirm the documented invocations still run —
and machine-check it, so it cannot silently return.

**Fail-close needs a loud, logged door.** A guard with no sanctioned exit gets a
hole punched in it; a guard with a *silent* exit reproduces the original failure.
The waiver here permits the close and logs a decision naming every waived unit.

**An Open Gap that sits unfixed is a bug with better manners.** Recording a known
hole is not mitigating it. When a spec's Open Gaps name something that can be
mechanized, file it as a cell — do not let honesty substitute for a fix.

## Design note worth keeping

The first design was **wrong and validation caught it.** The rule "compounding may
only be entered from scribing" would have made `compounding` *unreachable* —
because nothing in the entire repo ever sets `phase=scribing` (zero grep hits);
`bee-scribing` goes straight to `state scribing-run`, which produces `compounding`
directly. Had that shipped, it would have broken the only scribing path that
exists. **The rule was written against the documented state machine, and the
documented state machine was not the real one.** Validate a state-machine change
against the *callers*, never against the diagram.
