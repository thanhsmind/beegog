---
date: 2026-07-14
feature: fresh-session-handoff
categories: [architecture, testing, process]
severity: P2
tags: [concurrency, fail-closed, hooks, red-first, multi-session, review-loop]
---

# Fresh-session handoff — lessons from a 5-slice, 13-cell high-risk feature

## What Happened

Multi-terminal coordination (lanes, atomic claims, hold enforcement, two-kind
handoff, claim-next) shipped in v0.1.33 across 5 gated slices. Every slice ran
the panel + cold-pickup review loop before code; the loop caught 3 BLOCKERs
and ~16 WARNINGs pre-execution, several of which would have shipped real
defects. One session interruption occurred mid-swarm (worker resumed from
transcript after a disk-state check); one worker shipped without genuine RED
evidence (compensated by an orchestrator retro-RED probe).

## Root Cause (of the near-misses worth remembering)

1. **Fail-open hosts eat fail-closed throws.** The write-guard hook returns
   "allow" on ANY crash by contract, so a corrupt-store branch that threw
   would have silently granted the exact cross-session write it existed to
   deny. The natural strict-reader precedent (`readStateStrict` throws) points
   implementers at the wrong shape.
2. **A non-awaiting test runner turns async assertions into vacuous passes.**
   `check(fn)` never awaits; an async race test would report PASS while its
   assertion failures became unhandled rejections. The probe pattern (async
   fork+barrier) could not be transplanted into the suite directly.
3. **Unconditional rules die inside conditional short-circuits.** `checkWrite`
   early-returns per phase; a hold check appended at the tail would never run
   in swarming — the primary multi-terminal topology — while its tests
   (defaulting to a tail-reaching phase) stayed green.
4. **"Passed on the first run" is not RED-first.** fsh-11's behavioral rows
   were never demonstrated failing; only the vendor-parity guard was red.

## Recommendation

- When a guard lives inside a fail-open host, encode every fail-closed branch
  as a **returned verdict**, never an exception — and prove it end-to-end
  through the real host process, not just in-process.
- When concurrency needs testing under a synchronous runner, put the entire
  race inside a **self-contained child orchestrator** (fork racers, assert
  internally, exit 0/1) and have the suite make one blocking spawnSync call;
  prove falsifiability by breaking an invariant once.
- Place unconditional enforcement **before** phase/branch short-circuits, and
  require its tests to run in the short-circuiting branch's own topology.
- When a worker's tests pass on their first run, run the **retro-RED probe**:
  check out the parent commit's implementation against the new tests — a
  suite that stays green just proved itself tautological.
- After a session interrupt mid-swarm: read disk first (cell status,
  reservations, diffs, reports), then resume the worker from its transcript
  with a state summary — never re-dispatch blind (a resumed Jerry finished
  cleanly; nothing was duplicated).

Critical promotions this run: 2 (fail-open/returned-verdict; child-orchestrator
race testing) — see critical-patterns.md. Friction already filed: RED-first
mechanization candidate (capCell could demand red evidence for behavior_change).
