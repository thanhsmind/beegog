# cnt-4 — guard route-check for override spawns (D6)

**Status:** `[BLOCKED]` — unmet cross-cell precondition (Δ4 CAP GATE / V3 evidence).

**Outcome (one line):** cnt-4 cannot be implemented or capped yet because its correct shape
is bifurcated on V3 evidence that does not exist; V3 is its producer cnt-5's still-open
deliverable. No claim taken, no files reserved, no source edited.

**Files touched:** none.

## Why blocked (authority-type, instant — no advisor consult)

The cell record's `action` carries a binding **Δ4 CAP GATE**: cnt-4 "must NOT be capped until
V3 evidence exists (override fields observed in PreToolUse `tool_input`, from the live probe or
cnt-5); V3 negative ⇒ rescope to document-the-gap + marker-only." This mirrors advisor digest r2
Δ4 (`reports/advisor-digest-r2.md:28-33`): V3-positive ⇒ full route-check; V3-negative ⇒
"document the gap + keep marker-only". The implementation shape is therefore chosen by V3, not
assumed.

Current V3 status is **UNOBSERVED**, not positive and not negative
(`.bee/spikes/codex-native-transport/probe-v1v3.md:106-142`): the hand-rolled single-hook
PreToolUse probe never fired even though the override spawn itself succeeded, and
`evidence/v3-captured-envelopes.json` is empty `[]`. The probe file states the root cause is
undetermined and the follow-up is to re-run through an `onboard_bee.mjs --apply --repo-hooks`
fixture.

That onboard_bee-fixture V3 observation is explicitly **cnt-5's critical deliverable**
(`.bee/cells/cnt-5.json:16`: "V3 IS THIS CELL'S CRITICAL DELIVERABLE and MUST be observed
through an onboard_bee-built fixture ... cnt-4's cap is gated on this cell's V3 observation").
**cnt-5 is still `open` / unclaimed.**

Consequences for this worker:
- Cannot cap — Δ4 forbids it without V3 evidence.
- Cannot declare V3 negative and rescope — UNOBSERVED ≠ negative (the probe never fired; the
  verdict is genuinely undetermined). Declaring it would fabricate evidence.
- Cannot speculatively implement the V3-positive route-check — it presupposes an unproven
  answer and is what Δ4 exists to prevent (dead/wrong code if V3 turns negative).
- Cannot produce V3 in-scope — the fixture probe lives in `scripts/canary_codex.mjs` (cnt-5's
  file scope), outside cnt-4's four-file scope.

Deps cnt-1 and cnt-3 are both capped; the block is solely the V3 precondition.

## Outstanding questions (for the orchestrator)

1. Sequence cnt-5 before cnt-4: cnt-5 builds the onboard_bee-fixture probe and observes V3,
   then re-dispatch cnt-4 with the V3 answer. The plan's "cnt-4 ∥ cnt-5" parallelism is
   overridden by the Δ4 cap gate — cnt-4 is effectively downstream of cnt-5's V3 leg.
2. On re-dispatch, the V3 answer selects cnt-4's shape: positive ⇒ implement the R2/D6/Δ3
   route-check (freeze no-override rows green first, allow+deny twins per override field,
   read config through resolveTier/resolveAdvisor, config-read try/catch ⇒ noOpinion());
   negative ⇒ document-the-gap + marker-only, and say so in the cell record.

Full cell trace/evidence: `.bee/cells/cnt-4.json`.

## Resolution — rescoped per Δ4 negative branch

**Status:** `[DONE]` — capped as rescoped.

cnt-5 capped (`reports/probe-evidence.md`) with V3 **terminal-UNOBSERVED** on both probed
codex builds: 0.144.4 (the hook chain never fired for a successful override spawn, root
cause open) and 0.144.6 (the override tool schema itself is REFUSED at the API level —
`"Function 'collaboration.spawn_agent' is reserved for use by this model"` — before any
`spawn_agent` call is attempted, so no envelope ever reaches tool execution). Decision
`350f1e82` (logged 2026-07-19) treats this as the Δ4 negative branch: cnt-4 ships
**document-the-gap + marker-only**, not the route-check.

What shipped, scoped to exactly cnt-4's four files plus this report:

1. **Gap documentation** — a bounded comment on `evaluateCodexSpawn` in
   `skills/bee-hive/templates/lib/dispatch-guard.mjs` (mirrored byte-identical to
   `.bee/bin/lib/dispatch-guard.mjs`) stating the D6 route-check is intentionally absent
   pending V3 observation, citing `reports/probe-evidence.md` and decision `350f1e82`, and
   naming the pass-through as a deliberate defense-in-depth allow-hole (ADVISOR-R2 Δ3).
2. **No new deny branch** — `evaluateCodexSpawn` still never reads
   `toolInput.model`/`reasoning_effort`/`fork_turns`; an override-carrying spawn is judged on
   `agent_type` + `message` exactly like one without overrides. `hooks/bee-model-guard.mjs`
   needed no change (it already just relays `evaluateDispatch`'s decision).
3. **Canary test rows** — `hooks/test_model_guard.mjs` rows 56–57: row56 sends an
   anchored-marker spawn with `model`/`reasoning_effort`/`fork_turns` deliberately
   MISMATCHED against any plausible configured route and asserts it is still allowed (proof
   of pass-through-open); row57 proves the marker-presence requirement is unaffected by the
   gap (override fields present, no marker, still denied). Row56 was verified to be a real
   canary, not a decorative smoke test: a temporary stub route-check was injected locally,
   row56 failed (`status=2`, `TEMP stub route-check deny`) as expected, then the stub was
   reverted and the mirror re-synced — see the cell trace's `verification_evidence` for the
   full before/after transcript.
4. **Mirror sync** — `.bee/bin/lib/dispatch-guard.mjs` re-copied to stay byte-identical to
   the templates copy; `node scripts/test_lib_mirror.mjs` confirms.
5. **Existing no-override rows (1–55)** — byte-unchanged and green throughout (frozen green
   before any edit, per critical-patterns 20260716).

Deviation from the original dispatch: this is the rescoped scope per decision `350f1e82`,
not the original D6 route-check action text — recorded as a deviation in the cell trace at
cap time.

Full cell trace/evidence (rescoped): `.bee/cells/cnt-4.json`.
