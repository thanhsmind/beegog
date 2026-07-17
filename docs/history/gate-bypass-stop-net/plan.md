---
artifact_contract: bee-plan/v1
artifact_readiness: requirements-only
mode: standard
---

# gate-bypass-stop-net — mechanize the gate-bypass runtime net (GitHub #18)

## Problem

`gate_bypass=total` promises ZERO stops, but the agent still stopped at **Gate 2**
("Work shape is ready. Approve...?") and **Gate 3** ("Feasibility validated. Approve
execution?") — the session-close warning fired under each in the reporting screenshots.

Root cause is not a broken contract: the level-aware bypass prose is present in
bee-planning/bee-validating and machine-guarded green by `test_gate_bypass_doctrine.mjs`.
The failure is that honoring bypass is **100% prose-dependent** — the model must read
`gate_bypass_level` and choose to auto-approve; nothing catches it when it skips that
step. The Stop hook (`hooks/bee-session-close.mjs`) is advisory-only and **never blocks**
(line 12: "Never decision:'block'"). So a forgotten prose step falls straight through to a
human stop. This is exactly crit-pattern **20260714**: *"the invariant you leave in prose
WILL be bypassed; mechanize it."* The doctrine test mechanized the **prose**; this slice
mechanizes the **runtime**.

## Discovery (L1 — verified inline)

- `status --json` exposes `gate_bypass_level` correctly (`total`). Field is not the bug.
- `bypassLevel(root)` in `lib/state.mjs:1009` normalizes off/normal/full/total.
- `emitHookOutput`/`encodeAdvisory` (`hooks/adapter.mjs:345`) deliberately never emit
  `decision:"block"`; a Stop-event block instead **continues the turn** on both Claude and
  Codex (adapter comment) — which is exactly the behavior we want for the bypass case.
- `shouldInject`/`markInjected` (`lib/inject.mjs:318`) give interval-deduped keys (30 min)
  — the loop-guard primitive: block once, degrade to advisory on immediate repeat.

## Mode gate

Flags counted (3): **existing covered behavior** (Stop hook) · **cross-platform**
(Claude + Codex block semantics) · **weak proof around the area** (blocking loop risk).
No hard-gate flag (not auth/authorization/data-loss/audit/external/validation-removal) →
**standard**. Smaller modes rejected: not tiny/small because the change reverses an
explicit safety stance ("never block") in a hook that fires on every session Stop, and the
loop-guard needs real test coverage — more than one direct task.

## Approach

Add a **targeted** blocking path to the Stop hook. It is deliberately narrow so it can
only ever convert an illegitimate gate-stop into a continue, never trap a session.

**Fire condition (ALL must hold):**
1. `ctx.event === "Stop"` — never PreCompact, never SubagentStop (compaction/child stops
   must stay advisory).
2. phase ∈ {`planning`, `validating`} — Gate 1/exploring is excluded on purpose: under
   `total`, genuine *information* questions still stop (routing contract, decision
   a93994d3); only approval gates are mechanized.
3. The phase's gate is still pending: planning → `shape` (Gate 2); validating →
   `execution` (Gate 3); the corresponding `approved_gates.<gate> !== true`.
4. Active bypass level covers that gate: `full`/`total` → always; `normal` → only when
   mode ∈ {`tiny`,`small`,`standard`} (a `normal`-lane high-risk/hard-gate change still
   stops — mode already encodes the hard-gate floor). `off` → never fires.

**Action when it fires:** emit `{decision:"block", reason:<instruction>}`. The reason tells
the model, in one block: do NOT ask — set `approved_gates.<gate>=true` via
`bee.mjs state gate`, log the one-line audit decision, post the `⚡ auto-approved Gate N
(bypass)` line, and continue. This block **replaces** the "hive door open" advisory for the
turn (the advisory is moot when we are forcing continuation).

**Loop-guard (never trap a session):** key = `${sessionId}:${phase}:${gate}:${level}` via
`shouldInject`/`markInjected`. First stop at a given gate blocks once and marks it; an
immediate re-stop at the **same** gate (same key, <30 min) is deduped → no block → falls
through to the normal advisory. So a model that genuinely cannot proceed (e.g. it re-emits
a real information question) is never looped — worst case is one extra nudge, then today's
behavior. A distinct new gate (planning→validating) has a distinct key and blocks once more.

**Fail-open:** the whole path is wrapped; any crash logs to `hooks.jsonl` and returns the
advisory path / exit 0, matching the file's existing discipline.

### Risk map

| Component | Risk | Proof needed |
|---|---|---|
| Block emit on Stop | MEDIUM | test: fires → `decision:block` JSON; PreCompact/SubagentStop → never block |
| Loop-guard dedup | MEDIUM | test: two consecutive same-key stops → block then advisory |
| Coverage matrix | LOW | test: total/full always; normal only tiny/small/standard; off never; wrong phase never |
| Cross-runtime | LOW | encodeBlock is pure JSON; both hosts continue-on-Stop-block per adapter contract |

### Rejected alternatives

- **Re-onboard hosts only** — fixes version skew but leaves the change prose-only; recurs
  the next time the model forgets. (User chose the mechanical net.)
- **More prose / stronger reminder** — same class as what already failed; crit-pattern
  20260714 says mechanize instead.

## Files (bounded)

- `hooks/adapter.mjs` — add `encodeBlock(reason)` (pure `{decision:"block",reason}` JSON).
- `hooks/bee-session-close.mjs` — add `maybeBypassBlock(root, ctx)`; wire it into `main()`
  before the advisory block, Stop-event only; emit block + return when it fires.
- `hooks/test_bypass_stop_net.mjs` — new: fire/no-fire matrix + loop-guard + fail-open.
- `docs/specs/<hooks area>.md` — session-close now carries a mechanical bypass net
  (behavior_change spec sync).
- `skills/bee-hive/references/routing-and-contracts.md` — one line: the net is mechanized
  at runtime, not prose-only.

## Verify

`node hooks/test_bypass_stop_net.mjs && node hooks/test_hook_contracts.mjs && node
scripts/test_gate_bypass_doctrine.mjs && node hooks/test_model_guard.mjs && node
hooks/test_write_guard.mjs`

## Test matrix (edge dimensions)

- Happy: total + planning + shape-pending + Stop → block once.
- Boundary: normal + standard mode → block; normal + high-risk mode → no block.
- Negative: off → never; exploring phase → never; gate already approved → never.
- Event: PreCompact → never block (advisory only); SubagentStop → never.
- Idempotency: same key twice → block then advisory (loop-guard).
- Failure: crash in path → advisory/exit 0 (fail-open).

## Slices

Single slice (standard, one cell): implement + test the mechanical net, then spec sync.
