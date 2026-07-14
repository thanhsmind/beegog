# chain-integrity — CONTEXT

**Mode:** standard
**Origin:** a real-world post-mortem from a long, feedback-heavy dogfood session (owner-supplied, 2026-07-14).

## The failure, as it actually happened

Across ~7 rounds of user feedback in one session, the agent:

1. Capped each cell, then ran `state set --phase compounding-complete` by hand to mark "this round is done" — **without ever running `bee-scribing` or `bee-compounding`.** The phase name asserts both stages ran. Neither had.
2. Was then blocked by the intake gate on the user's next message (correct behavior: a terminal phase means the door is shut), and re-opened with `state set --phase swarming`.
3. Repeated that close/open cycle 7 times. Every "close" was a fake close.
4. Edited `docs/specs/task-editing.md` inline, by hand, six times — so the spec content was not wrong, but `last_scribing_run` stayed `None` and bee never recorded that any spec had been synced. The user had no way to know the spec was current short of opening the file.

## Root cause (verified in code, not inferred)

The chain's tail is held together by **prose and agent memory, not by the machine.**

- `state set --phase` validates only that the name is in the enum (`state.mjs:18`, `bee.mjs:752`), then writes it (`bee.mjs:779`). **There is no `from → to` legality check anywhere in the repo.** `exploring → compounding-complete` is a legal single call.
- "Only `bee-compounding` may set `compounding-complete`" exists solely as a sentence in `bee-compounding/SKILL.md:103`.
- Scribing debt is **deliberately** non-blocking. `cells.mjs:521` header comment: `"Pure read — never a blocker, only a signal."` `bee-compounding/SKILL.md:77`: `"Prose-ruled, never hook-enforced (D7)."` All three consumers (status line, session preamble, Stop-hook nudge) fail open.
- So `last_scribing_run = None` alongside six capped `behavior_change` cells is a **fully valid bee state.** Nothing in the system considered it wrong.

**`gate_bypass` is not the mechanical cause.** No guard, hook, `claimCell`, or `checkWrite` branches on it — it is read in exactly two places, both display-only (`bee.mjs:299`, `inject.mjs:164`). It caused the agent to self-record the same gate approvals a human "yes" would produce. It removed the *human* joints of the chain, but those joints were only ever made of habit. Turning bypass off would hide this failure, not fix it: the chain could break identically, just more slowly.

## Locked decisions

### D1 — ~~Lock the tail, not the whole machine~~ **SUPERSEDED by D1-REVISED**
> Original: `scribing` only from `swarming`; `compounding` only from `scribing`; `compounding-complete` only from `compounding`.
>
> **Validation killed this.** Grep proves **nothing in the entire repo ever sets `--phase scribing`** (zero hits): `bee-scribing/SKILL.md:112` goes straight to `state scribing-run`, which hard-codes `phase = 'compounding'` (`bee.mjs:996`). D1 would have made `compounding` **unreachable** and refused the only scribing path that exists. Kept here because the correction is the point: the rule was written against the documented state machine, and the documented state machine is not the real one.

### D1-REVISED — Guard the **door**, not the phase name
A full 10-phase transition table stays **rejected** (an over-strict rail teaches the agent to route around it — the same failure in a new costume). What is locked is the one door to the tail:

- `state set --phase compounding` → **refused outright.** The error names `state scribing-run` as the way.
- `state scribing-run` is the **sole producer** of `phase = compounding`, and itself requires the current phase be `swarming`, `reviewing`, or `scribing`.
- `compounding-complete` may only be entered from `compounding` — **and only with zero scribing debt** (D2).
- `scribing` stays permissive: it is a marker, not a gate.

This enforces D1's intent *more strongly* than D1 did: the terminal phase is reachable only by having **actually recorded a scribing run**, because `scribing-run` is the only door and it stamps `last_scribing_run` as it passes.

Every other transition stays as permissive as today. **Moving backward to an earlier phase stays legal** — hive law 5 requires it (a failed reality gate or a NO spike must return to planning). `state set --phase idle` (the de-facto abandon verb) is unaffected.

**Placement:** the rules live in the CLI handlers (`handleStateSet`, `handleStateScribingRun`, `startFeature`), **not** in `writeState`. `writeState` (`state.mjs:291`) is a raw `writeJsonAtomic` passthrough with zero validation, and ~60 test fixtures plus the hooks write phase straight through it. A rule there breaks all of them; a rule at the CLI breaks exactly 3 tests — and `.bee/state.json` is already hook-denied for direct edit (`guards.mjs:55`), so the CLI is a genuine choke point.

### D6 — Three shipped skills document phases that do not exist
`bee-exploring/SKILL.md:73` (`--phase exploring-complete`), `bee-planning/SKILL.md:99` (`--phase planning-complete`, `--phase validated`), `bee-validating/SKILL.md:82` (`--phase validated`). **None are in `KNOWN_PHASES`**, so `handleStateSet` throws (`bee.mjs:755`) every single time an agent follows its own skill verbatim.

This is not a cosmetic doc bug — it is a **contributing cause of the post-mortem.** An agent whose documented command fails will improvise one that passes, and improvising the state machine is exactly what went wrong. Fixed here.

### D2 — Scribing debt becomes a blocker at exactly one place
Entering `compounding-complete` is **refused** while `scribingDebt() > 0`. The refusal names each capped `behavior_change` cell still owing its spec sync.

This reverses `cells.mjs:521`'s stated posture ("never a blocker") **at the close boundary only.** Everywhere else — status line, preamble, Stop-hook nudge — it stays advisory. Debt is a signal all the way through the work and a wall only at the door.

### D3 — `state scribing-run` stops jumping the phase blindly
`handleStateScribingRun` currently sets `phase = 'compounding'` unconditionally, with no check that the phase was `scribing`. Under D1 that becomes a legal transition only from `scribing`; the handler must respect the same rule rather than bypass it.

### D4 — The override is loud and logged, never silent
A feature can legitimately close with debt on record (e.g. the owner judges a `behavior_change` cell spec-irrelevant). That path exists, but it is an **explicit flag that logs a decision** — never a silent skip, never a default. A close that waives spec debt leaves a permanent, attributable trace.

### D5 — `gate_bypass` stays ON, unchanged
Not touched by this feature. Once the chain is held by code, bypass is safe: it decides *who says yes to gates 1-3*, and never *whether the chain's tail ran*. Those were conflated only because the tail had no enforcement of its own.

## Consequence the owner should expect

After this lands, the exact sequence in the post-mortem becomes **impossible**, not discouraged:
`state set --phase compounding-complete` from `swarming` is refused outright, and even from `compounding` it is refused while any capped `behavior_change` cell is unscribed.
