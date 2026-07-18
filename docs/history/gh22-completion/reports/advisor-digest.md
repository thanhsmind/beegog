# Advisor digest — gh22-completion (high-risk lane)

Advisor: fable (ceiling tier, AO3/AO13). Consulted 2026-07-19. Verdict:
GO-WITH-CONDITIONS (C1 wave overlap, C2/R4 codex-ready contradiction are hard
blockers on the original design). Full text as delivered:

R1 — Guard has no exported accept fn: bee-model-guard.mjs exports nothing;
check fns are module-local and importing runs main() (stdin). MIT: extract a
pure `evaluateDispatch(payload, root)` into lib, guard main() calls it,
prepare's test calls it — one source of truth; move the anchored marker
regex (:58) there too. Lives in g22-1 (its own acceptance precondition).

R2 — dispatch_id never rejoins the guard log (model calls the Agent tool; no
correlation key survives). MIT: prepare writes its own economics record at
prepare-time keyed by dispatch_id; the guard's line stays the enforcement
audit. Two complementary logs.

R3 — `transport` field-name collision: logDispatch already writes transport
with enforcement vocab. MIT: keep legacy `transport`; name D3's channel field
`channel`; map D3.enforcement onto the existing value; fields additive.

R4 — Codex can still never reach `ready`: hooks.jsonl is deny/crash-only,
tools.jsonl is claude-only — the observation leg never fires on healthy
codex → attestation always inert → always degraded. MIT (D5-REVISED): the
observation leg is CLAUDE-only; codex VALID = hash-match + version-match +
repo-identity-match (static attest), stated honestly in the reason string.

R5 — Sidecar v2 dual-consumer/schema-dup: render_plugin_skill_trees
duplicates RENDER_SCHEMA locally (:37) while importing RENDER_SIDECAR — bump
must change both (export from onboard_bee, delete the local copy). Hashes are
over RENDERED bytes per runtime (codex/claude sidecars differ for
marker-bearing skills) and must match doctor's recompute on the installed
tree. Manifest regen in-cell.

R6 — Windows suite list unproven: worktree suites spawnSync git with path
assumptions — likely red on windows-latest. MIT: seed windows with only the
provably portable core (test_config_validate, test_lib, test_portable_paths);
add worktree suites only after a real windows run confirms them.

R7 — Canary trust pollution: --dangerously-bypass-hook-trust writes to
global ~/.codex. MIT: run with CODEX_HOME pointed at a per-run mktemp dir;
unique temp repo; cleanup in finally; skip-guarded.

A1 (D2) — "resolveTier as-is" is wrong for two kinds: 'advisor' is coerced to
'generation' (state.mjs:1247) — advisor kind must route model via
resolveAdvisor (state.mjs:1279+); reviewer on a cli review slot with
{for:'cell'} would refuse the exact dispatch the config exists for. RESOLVE
purpose map: cell→{for:'cell'}; gather/reviewer/advisor→{for:'gather'}
(read-only gather-shaped per state.mjs:1237).

A2 (D1) — envelope shape: the guard reads payload.tool_input.{agent_type,
message}; the prepare test must build {tool_name:'spawn_agent', tool_input:
out.payload}.

Wave-plan: CONFIRMED CONFLICT — g22-1 and g22-3 both edit templates/bee.mjs +
the registry in wave 1. Resequence: w1a g22-1 ∥ g22-5; w1b g22-3 (rebased on
g22-1); wave 2 unchanged (g22-2→1, g22-4→3, g22-6→5).
