---
date: 2026-07-19
feature: codex-native-transport
categories: [capability-probing, guard-design, multi-session-coordination, release-hygiene]
severity: high
tags: [version-scoped-evidence, allow-hole-by-design, canary-rows, claim-atomicity, heartbeat, negative-evidence]
---

# Learnings — codex-native-transport (cnt-1..cnt-7)

## What Happened

The feature shipped native-transport capability classification for the second
runtime: a version+config-scoped probe record with validity legs (cnt-2), the
resolver/config slot shape for native model overrides (cnt-1), dispatch-prepare
native branch with honest economics vocabulary (cnt-3), a live probe leg with an
isolated per-run home (cnt-5), and — instead of the planned D6 route-check — a
documented pass-through-open gap with canary rows (cnt-4, rescoped per Δ4).
Two fix-first cells landed mid-flight: release-manifest refresh after render
drift (cnt-6) and advisor-model folded into the guard allowlist (cnt-7).

The headline live result: the override spawn surface was **CONFIRMED accepted on
codex-cli 0.144.4 and REFUSED on 0.144.6** — the host binary auto-upgraded
mid-feature with zero changelog signal, and every turn in an elevated isolated
home then failed at the API level ("Function collaboration.spawn_agent is
reserved for use by this model"). V3 (the PreToolUse envelope carrying override
fields) ended terminal-UNOBSERVED on both builds, so cnt-4 shipped
document-the-gap + marker-only (decision 350f1e82): `evaluateCodexSpawn` never
reads override fields at all, and test rows 56–57 prove the pass-through is
deliberate.

The feature also ran as an unplanned live test of multi-session coordination:
two top-level sessions raced cnt-1/cnt-2 (~2 duplicated worker runs discarded),
a dispatched worker was denied by its own hold because the orchestrator handed
it a wrong session id, and a second session's worker tried to claim cnt-4 while
the first session's worker held it. All three near-misses trace to the same two
open gaps (heartbeat refresh cadence, non-atomic `cells claim`), filed as the
`multi-session-hardening` backlog rows (2×P1, 3×P2) after a full audit was
verified against source the same day.

## Root Cause

- **Cross-build regression**: external client capability is a property of the
  installed build + flag configuration, not of the product. Nothing upstream
  signals a regression; only a live, scoped re-check can.
- **V3 unobservable**: Run A used a hand-rolled single-hook fixture that never
  fired despite three accepted spawns (root cause STILL OPEN at close — see
  probe-evidence.md "Open follow-up"); Run B used the correct onboarded-chain
  fixture but the 0.144.6 refusal meant the turn never reached tool execution.
- **Multi-session near-misses**: heartbeat is refreshed only at SessionStart
  (900s stale threshold vs hour-long working turns) and the swarm worker path
  claims via non-atomic read-modify-write; both were confirmed against source
  (audit decision 12f54e88) and remain open until `multi-session-hardening`.
- **Manifest drift red baseline**: cnt-3 regenerated rendered plugin trees but
  deferred the release-manifest regen to "the slice-closing cell", leaving the
  shared baseline red between commits for any concurrent session (cnt-3's own
  cell verify does not run the manifest check, so it capped green).

## Recommendation

1. **When a capability verdict about an external client exists, treat it as
   version+config-scoped evidence with self-invalidation legs — and re-verify
   live before relying on it again.** Host auto-upgrade is a real, silent
   invalidation trigger, proven this feature. Never extrapolate from version
   strings or from a sibling build.
2. **When deferring a planned control, ship the gap as designed artifacts:** a
   bounded comment at the decision point citing the evidence + decision id, and
   canary test rows that FAIL if someone later adds the control casually
   (allow-rows proving pass-through-open). A documented allow-hole with canaries
   reads as design; an undocumented one reads as a bug and invites a
   speculative "fix" that could deny against an assumed envelope shape.
3. **When a probe hook does not fire, record it as inconclusive, never as a
   negative result** — and build probe fixtures with the full onboarded chain
   from the first attempt, not a hand-rolled minimal hook.
4. **When orchestrating with concurrent sessions possible: claim atomically
   (claim-next + session id) BEFORE spawning a worker, and have workers derive
   their session id from their own runtime env, never from the dispatch
   prompt.** This session's cnt-4 claim demonstrably absorbed a second
   session's claim attempt with zero duplicated work — versus ~2 duplicated
   worker runs on cnt-1/cnt-2 where the claim came after dispatch.
5. **When a cell regenerates shared generated artifacts (rendered trees,
   manifests), the same commit must leave the shared baseline green** — either
   include the shared check in the cell's verify or land the regen in the same
   commit; "the closing cell will fix it" leaves every concurrent session on a
   red baseline.
6. **Name trust stages with non-synonymous vocabulary** (`requested-accepted`
   vs `used-and-confirmed`): the economics log never claims a model ran because
   a call was accepted. This prevented false confidence the moment V1 regressed.

## Deferred / Open

- Re-run V3 once a codex build accepts elevation again; the hand-rolled-vs-
  onboarded hook-discovery divergence from Run A is unresolved (probe-evidence
  "Open follow-up"; backlog row filed).
- `multi-session-hardening` backlog rows (2×P1, 3×P2) are filed, verified
  against source, and NOT fixed by this feature's clean rule-14 resolutions.
