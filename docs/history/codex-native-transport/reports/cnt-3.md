# cnt-3 — dispatch prepare native-override branch + honest economics (D1/D5/D7)

**Status:** [DONE]

**Outcome:** `prepareDispatch` (dispatch-prepare.mjs) gains a `resolved.type === 'native'` branch:
a confirmed `native_model_override` classification emits a `spawn_agent` payload carrying
`model`/`reasoning_effort`/`fork_turns:'none'`, with `economics.effective_model_status` =
`'native-requested'` (R5 — not `'requested-accepted'`) and a `transport:'native-override'` field;
an unconfirmed classification with an explicit-only cli fallback configured routes to that
fallback and records the reason; unconfirmed with no fallback returns a typed
`{type:'refused', reason:'native_unavailable', detail:<classification>}` — never silent (D1/D3a).
`classification` is caller-injected: `bee.mjs`'s `handleDispatchPrepare` reads
`readNativeTransportClassification(root)` and passes the string through, so `dispatch-prepare.mjs`
never imports across the bin/lib boundary. `dispatch-guard.mjs` gains a codex-branch-only
`ANCHORED_CODEX_TIER_MARKER_RE` accepting `advisor` (claude branch regex byte-unchanged, R1) plus
the golden row (R1) proving a confirmed native advisor payload passes the real `evaluateDispatch`.
The stale "Codex has no per-agent model field at all" comment is rewritten to the verified truth.
9 new checks added to `scripts/test_dispatch_prepare.mjs` (25 total, all green); existing
budget-only/model/cli/refused rows are untouched byte-for-byte.

Deviations (see `.bee/cells/cnt-3.json` trace for full text): auto-added the codex-branch marker
regex split and the `classification` dependency-injection parameter (both needed for the cell's
own golden row and to avoid a lib->bin import inversion); auto-fixed `deriveEconomics`'s
codex-native branch, which was dishonestly reporting `prompt-budget`/`inherited-or-unknown` for a
now-possible confirmed override; regenerated the committed plugin skill trees
(`scripts/render_plugin_skill_trees.mjs`) as a byproduct, which also surfaced pre-existing
cnt-1/cnt-2 render drift unrelated to this cell. The resulting release-manifest sha256 mismatch is
left unregenerated — explicitly the slice-closing cell's job per this cell's own dispatch.

**Files touched:** `skills/bee-hive/templates/lib/dispatch-prepare.mjs`,
`.bee/bin/lib/dispatch-prepare.mjs`, `skills/bee-hive/templates/lib/dispatch-guard.mjs`,
`.bee/bin/lib/dispatch-guard.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`,
`scripts/test_dispatch_prepare.mjs`, plus the regenerated `.claude-plugin/skills/` and
`.codex-plugin/skills/` projections (render sidecars + the files they mirror).

Full trace and verification evidence: `.bee/cells/cnt-3.json`.
