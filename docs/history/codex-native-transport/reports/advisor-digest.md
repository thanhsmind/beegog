# Advisor digest — codex-native-transport (high-risk lane)

Advisor: ceiling tier / session model (config advisor slot; AO3/AO13). Consulted 2026-07-19.
Verdict: **GO-WITH-CONDITIONS**. Conditions folded into plan.md §Advisor conditions and the
fold decision. Full text as delivered:

R1 — Advisor marker denied by guard today, no cell owned the fix: prepare renders codex
advisor payloads as `[bee-tier: advisor]` (dispatch-prepare.mjs:157→:199) but
ANCHORED_TIER_MARKER_RE accepts only ceiling|generation|extraction|review
(dispatch-guard.mjs:38) → evaluateCodexSpawn:115-127 denies. Fix owned by cnt-4: a
codex-branch-only marker constant additionally accepting `advisor` (never reused by
evaluateClaudeDispatch — the shared regex would make claude `[bee-tier: advisor]` hit
resolveTier's silent generation-coercion, state.mjs:1247). Anchor position unchanged (D5
holds). cnt-3 adds a golden row: advisor native payload passes evaluateDispatch.

R2 — Guard cannot name "the configured route for that purpose": the PreToolUse envelope
has no slot identity. Fix: route-check = membership against the union of configured native
routes across all slots (incl. advisor via resolveAdvisor) — allow iff some configured
route matches model+effort exactly AND fork_turns==='none'; deny quotes expected-vs-got.
Root is available (hooks/bee-model-guard.mjs:183 passes it); evaluateCodexSpawn gains the
root param in-lib.

R3 — cnt-2→cnt-3 interface unpinned. Fix: cnt-2 exports one reader,
`readNativeTransportClassification(root)` (applies version/flag validity legs;
invalid/absent ⇒ 'native_budget_only'); cnt-3 gates on that reader alone — no duplicated
validity logic.

R4 — cnt-5's `--probe-selftest` does not exist (canary main() parses no argv, :262-270 —
today the flag silently runs the full ~60s canary incl. real codex exec). The cell creates
the flag; the selftest must assert the flags-only-inside-isolated-CODEX_HOME invariant, and
cap evidence must include the REAL probe run's recorded output (probe-evidence.md answering
V1/V3 by observation) — the selftest alone is not the deliverable.

R5 — `requested-accepted` would be written before acceptance is observable (economics is
prepare-time, dispatch-prepare.mjs:228-238; deriveEconomics's codex-native branch pins
'inherited-or-unknown' with a comment forbidding change absent probe proof,
dispatch-guard.mjs:272-277,299-300). Fix: key the new status strictly on
resolved.type==='native' + classification-confirmed (the probe is the justification that
comment demands); keep budget-only rows byte-identical; name the prepare-time value
`native-requested` (acceptance is codex-side validation observed by the caller, not by
prepare); update D7 wording at scribing.

Note (no condition): cnt-1 inserts the `kind:'native'` branch BEFORE the generic
`typeof value.model === 'string'` branch in both resolvers (state.mjs:1270,1297), else the
shape silently resolves as {type:'model'}.

Paths read: feature docs (CONTEXT/plan/approach/implement-plan/validating-probe), cells
cnt-1..5, templates/lib state.mjs:1240-1314 + dispatch-prepare.mjs (full) +
dispatch-guard.mjs:1-347, scripts/canary_codex.mjs:1-100,150-179,240-270,
hooks/bee-model-guard.mjs, critical-patterns.md.
