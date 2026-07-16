---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
---

# Plan: Codex Agent Wait Loop

Mode: `standard` — 3 risk flags: public contracts, existing covered behavior,
multi-domain.

Why smaller modes are insufficient: the visible defect is one repeated tool call,
but its prevention must reach every native delegation flow through shipped
doctrine, stay aligned with the swarming contract, and carry a drift test.

## Requirements

- D1: timeout/no-completion is not failure and never licenses interruption,
  duplicate dispatch, or ownership release.
- D2: `empty wait → wait_agent` is forbidden with no authority or urgency
  exception.
- D3: another wait requires this exact interval: continue material task-local
  work or, only when none remains, take exactly one `list_agents` snapshot; then
  send one concise commentary update naming both the live agent state and the
  next action. No-op work, repeated state reads, hidden reasoning, or commentary
  without the material action do not qualify.
- D4: the rule covers every bee-owned native Codex subagent flow; external
  process/artifact polling remains separate.
- D5: always-loaded doctrine names `wait_agent` and `list_agents`, and explicitly
  reconciles bounded native waiting with the older anti-file-polling rule.
- D6: at least one material action satisfies the interval; completions arriving
  during it are handled exactly once, liveness is recomputed, and zero live
  agents ends collection without another wait.
- D7: proof isolates the live root-only boundary and captures controlled native
  traces for ordinary delegation and swarming/review behavior.

## Discovery

L1 quick verification. The literal UI strings do not exist in repository source;
they are Codex collaboration UI. The live ambiguity is
`skills/bee-swarming/references/swarming-reference.md:19`, which permits
`wait_agent` for a needed result but says nothing about a timeout. The established
placement pattern is `docs/specs/doctrine-layer.md` B2/B4: always-applies behavior
lives in the AGENTS doctrine and is pinned by the `test_lib.mjs` census. No
external research or new runtime mechanism is needed.

The RED baseline is recorded in [pressure-tests.md](pressure-tests.md): under
authority/no-chatter pressure, an agent selected immediate re-wait in all three
maximum-pressure scenarios and rationalized it as the official lowest-noise path.

## Approach

Add one always-loaded “no consecutive empty waits” rule to the master AGENTS
doctrine and current root projection, with the exact D3 sequence and D1
ownership protections. Repeat only the procedure-level details needed by
ordinary gathers and Codex swarming. Apply the same feature hunks to the
writable `.claude` projection. The current Codex runtime receives the rule from
root `AGENTS.md`, which is always loaded and has higher scope than skill-local
instructions; canonical `skills/**` remains the authoritative payload for a
future host sync. The checked-in `.agents` projection is read-only in this
sandbox, so it is an explicit deployment constraint rather than a silently
claimed write. A whole-tree onboarding sync is also excluded: this source
checkout self-skips, while an external-source sync would absorb unrelated
pre-existing projection drift. Tighten the existing doctrine census around a
localized normalized contract block, with order-sensitive and mutation
assertions for D1–D6 so inverted ordering, authority exceptions,
timeout-as-failure, ownership release, stale completion, or loss of the
external-process carve-out turns `test_lib.mjs` red. Amend the swarming creation
log with the observed RED rationalizations and exact replay protocol, then
rerun those same scenarios sequentially with the new rule loaded for GREEN.
Add a root-only replay and controlled native traces that cover material work
remaining, completion during the interval, and zero remaining live agents.
Finally sync the doctrine spec.

Rejected alternatives:

- Change Codex UI — outside repository ownership; it would hide rather than stop
  repeated calls.
- Swarming-reference-only edit — misses exploring, planning, validation, review,
  and ordinary gathers, violating D4.
- Ban `wait_agent` entirely — leaves the orchestrator no native bounded yield and
  contradicts D3.
- Poll files or send routine status pings — reintroduces the older polling failure
  and adds more transcript noise.

| Component | Risk | Reason | Proof needed |
|-----------|------|--------|--------------|
| Always-loaded doctrine | Medium | A vague rule can be bypassed in turns where no skill is active. | Census asserts tool names, forbidden sequence, exact fallback, required commentary content, ownership preservation, and external carve-out in master + current root. |
| Shared delegation contract | Medium | Ordinary gathers do not load swarming procedure. | Text inspection plus GREEN pressure scenario for a delegated gather. |
| Swarming contract | Medium | Current Codex row permits wait without timeout aftermath. | GREEN pressure scenario for a multi-reviewer/worker wave. |
| Skill TDD evidence | Medium | Plain prose may still lose to authority/no-chatter pressure. | Same three RED scenarios rerun with amended instruction, all choose D3 sequence. |
| Projection/spec sync | Medium | Canonical skills do not update this source checkout during self-onboarding; `.agents` is sandbox-read-only and full-file parity already contains unrelated drift. | Census exact anchors across canonical/root/`.claude`; record the `.agents` write denial and root-doctrine coverage honestly; run `test_lib.mjs`, `git diff --check`, and spec comparison without reconciling unrelated hunks. |

## Shape

One current slice: install a drift-resistant orchestration rule and prove it under
the exact pressures that reproduced the defect. The user-visible demo is a
timeout followed by a meaningful state/progress interval before any later wait;
the Codex transcript no longer contains back-to-back empty wait panels.

Exit conditions:

- no active instruction permits an immediate second `wait_agent` after timeout;
- native timeout does not interrupt, redispatch, or release agent ownership;
- ordinary gathers and swarm workers inherit the same behavior;
- all three maximum-pressure RED scenarios turn GREEN;
- one root-only replay turns GREEN without canonical skill text helping it;
- controlled ordinary-gather and swarm/review traces show a real empty wait,
  at least one material action or the single snapshot fallback, handling of any
  completion, a state-and-next-action update, and only then a later wait when
  live agents remain;
- every GREEN run uses the verbatim prompt/options/rubric recorded before any
  doctrine edit, loads the amended doctrine/skill surfaces explicitly, and
  records its verbatim result in the creation log;
- doctrine census and `test_lib.mjs` pass;
- the worker runs the configured full repository verify after the narrow cell
  verify; if this sandbox denies nested child processes, the exact command,
  denial evidence, and narrower green results are retained and the limitation
  is reported rather than relabeled green.

## Test matrix

| Dimension | Applicable case | Expected result |
|-----------|-----------------|-----------------|
| User types | User requests silence/no progress messages. | Safety/progress interval still wins; one concise update, no consecutive wait. |
| Input extremes | 0, 1, or many running agents; empty completion set. | Zero agents returns without waiting; running agents use the same interval regardless of count. |
| Timing | 10-second and 60-second timeouts; completion arrives during/after interval. | Timeout stays non-failure; completion is handled exactly once, liveness is recomputed, and zero live agents prevents another wait. |
| Scale | A six-reviewer wave produces large status output. | One compact state inspection/update, not per-agent polling chatter. |
| State transitions | running → timeout → running; running → completed; mixed wave. | Only the timeout→wait edge is forbidden; completion collection remains valid. |
| Environment | Codex native agents versus external CLI workers. | Native rule uses `wait_agent`; external workers keep process/artifact polling. |
| Error cascades | Repeated timeouts under deadline pressure. | No interrupts, duplicate dispatches, or released ownership caused by silence. |
| Authorization | Manager/user orders “no chatter.” | Instruction cannot authorize unsafe consecutive waiting behavior. |
| Data integrity | Claims/reservations exist while worker is quiet. | Ownership remains intact until an actual terminal state. |
| Integration | Plain delegated gather and swarming wave. | Both load an unambiguous equivalent contract. |
| Compliance | Absolute paths or agent identifiers in commentary. | Update is concise and does not expose unnecessary internal paths/data. |
| Business logic | Useful work remains versus “no useful work remains”. | At least one material action qualifies in the first case; exactly one `list_agents` snapshot qualifies in the second; neither no-op commands nor exhausting every independent action is required. |

## Out of scope

- Codex UI rendering and collaboration-tool implementation.
- Agent scheduling, timeout duration tuning, or a new wait API.
- External CLI worker polling rules beyond preserving their current carve-out.
- Any change to the separate `worktree-isolation` feature.

## Current slice

**Slice:** Native Codex wait discipline.

**Entry state:** D1–D5 locked; RED pressure evidence records three immediate
re-wait violations; core library baseline is green at 321/0, while the configured
full verify remains unavailable in the current nested-child-restricted sandbox.

**Exit state:** always-loaded doctrine and procedure references encode the exact
post-timeout interval; the doctrine census is green; the same maximum-pressure
scenarios are GREEN with the amended skill loaded; the creation log and doctrine
spec are synchronized.

**Bounded files:** master/current AGENTS doctrine; canonical shared delegation
and bee-swarming surfaces; the six matching writable `.claude` projection files
for AGENTS template, delegation reference, census test, swarming skill/reference,
and creation log; doctrine spec. Projection edits carry only this feature's
hunks and preserve all unrelated pre-existing drift. `.agents` is not written in
this sandbox; the report names that deployment constraint and the always-loaded
root doctrine remains the live Codex enforcement surface.

**Verification:** run `node skills/bee-hive/templates/tests/test_lib.mjs` as the
cell's literal judge and run `git diff --check` as a separate artifact check;
never report a failing shell conjunction as passed. Also attempt the configured
full repository verify and retain its exact output/constraint,
feature-anchor checks across canonical/root/`.claude`, explicit `.agents`
read-only evidence, the three GREEN pressure scenarios, an isolated root-only
replay, and controlled native traces recorded verbatim under the frozen replay
protocol.

## Cells

- `codex-agent-wait-loop-1` — dropped after the sandbox denied every required
  `.agents` write before feature wording changed.
- `codex-agent-wait-loop-2` — install and pressure-test the native wait discipline
  through always-loaded root doctrine, canonical skills, and writable `.claude`
  projections; retain the `.agents` deployment constraint explicitly.
- `codex-agent-wait-loop-3` — repair independently reviewed wording and drift
  anchors, add root-only and native-tool evidence, and use a literal runnable
  cell judge without rewriting the historical cell-2 trace.
