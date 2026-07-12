# Cell report: codex-parity-3

**Status:** [DONE]
**Worker:** otto (ceiling tier)

**Outcome:** One shared runtime adapter (`hooks/adapter.mjs`) now backs all seven wrapper hooks — hostile stdin is normalized before any property access, root discovery sits inside the fail-open boundary, Codex PreCompact/SubagentStop/Stop advisories emit parseable JSON `systemMessage` (never `decision:"block"`, per decision D2 in CONTEXT.md: an advisory must not continue a child or loop a turn), and crashes/coverage gaps are logged visibly to `.bee/logs/hooks.jsonl` without ever changing the allow/deny result. All 16 RED rows in [red-baseline.md](red-baseline.md) are GREEN on the unmodified cell-1 fixture table (`node hooks/test_hook_contracts.mjs` exits 0, 71 rows, 0 failing); zero rows deleted, weakened, or re-tuned.

**Specifics:**

- `bee-chain-nudge.mjs` matches registered workers by `nickname` (what `bee_state.mjs worker add --nickname` stores — discovery.md Proved Gaps), keeping the generic `name|agent|worker` fallback; proved by the dedicated `chain-nudge-nickname` harness group (match, fallback, silent-control rows).
- `bee-write-guard.mjs` intercepts the canonical Codex `apply_patch` envelope, parses `Add/Update/Delete File` and `Move to` targets, and routes every proved target through the existing `guards.checkWrite` gate/direct-edit/reservation decisions — the baseline's silently-allowed `.bee/state.json` patch now denies (exit 2) with the same reason Edit/Write/Bash get.
- **Cell-3/cell-4 boundary on apply_patch:** this cell recognizes the canonical shape and enforces on *provable* targets, honestly satisfying the existing fixture row. An intercepted patch whose targets cannot all be proved logs a visible `applypatch-unparsed` coverage gap and fails open today; the deny-on-unprovable policy and the full per-target matrix (malformed bodies, escapes, unicode, move semantics) belong to codex-parity-4, which may retarget that row's exit expectation to 2 (a strengthening).
- Coverage-gap classes each have a dedicated harness row: `malformed-payload` (with explicit `--source plugin|repo` identity threading), `invalid-cwd`, `invalid-source`, `applypatch-unparsed`, plus two invariant rows proving a log-write failure never flips a deny or an allow.
- New harness groups run in default mode only; `--baseline` and `--catalog-only` behavior is unchanged (cells 1 and 2 contracts untouched).

**Files touched:** `hooks/adapter.mjs` (new), `hooks/bee-session-init.mjs`, `hooks/bee-prompt-context.mjs`, `hooks/bee-state-sync.mjs`, `hooks/bee-chain-nudge.mjs`, `hooks/bee-session-close.mjs`, `hooks/bee-model-guard.mjs`, `hooks/bee-write-guard.mjs`, `hooks/test_hook_contracts.mjs`, `skills/bee-hive/scripts/onboard_bee.mjs` (deviation).

**Deviation:** `skills/bee-hive/scripts/onboard_bee.mjs` `HOOK_FILENAMES` gained `"adapter.mjs"` (rule 3 — blocking broken import: `--repo-hooks` vendoring would otherwise copy wrappers whose static `./adapter.mjs` import crashes every repo-fallback hook). File reserved before editing; onboarding suite green after.

Full trace and verification evidence: [.bee/cells/codex-parity-3.json](../../../../.bee/cells/codex-parity-3.json) (decision 0009 — the trace is the single source).
