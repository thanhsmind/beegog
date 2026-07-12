# Cell report: codex-parity-4

**Status:** [DONE]
**Worker:** mel (generation tier)

**Outcome:** P1 repair (plan-review third bullet, cited decision D2 in CONTEXT.md): once an `apply_patch` event is intercepted (a canonical `*** Begin Patch` envelope was found), a target set that cannot be fully proved now DENIES (exit 2) with a corrective message — never fails open. Malformed OUTER hook payloads (no patch envelope present in `tool_input` at all) keep D2's visible fail-open, unchanged. `hooks/test_write_guard.mjs` gained a 19-row apply_patch matrix (rows 8–26: Add/Update/Delete/Move, multi-target, Unicode/space/escape paths, malformed bodies, unknown-verb, gate-policy, reservation rows), every row spawning the real hook as a child process and asserting exit code + stderr shape. `hooks/test_hook_contracts.mjs`'s `applypatch-unparsed-logged` row is the one sanctioned expectation change — retargeted from fail-open (exit 0) to deny (exit 2); every other of the 70 remaining rows is untouched. Verify: `node hooks/test_write_guard.mjs && node hooks/test_hook_contracts.mjs` — 47 + 71 rows, ALL PASS, exit 0.

**Deviation (auto-fixed bug in touched code):** `extractApplyPatchTargets` now trims each captured path; a verb line whose path was pure whitespace (e.g. `*** Add File:    `) previously survived as a bogus proved target instead of correctly counting as unprovable.

**Files touched:** `hooks/bee-write-guard.mjs`, `hooks/test_write_guard.mjs`, `hooks/test_hook_contracts.mjs`.

Full trace and verification evidence (including the temporary-break proof: commenting out the "Move to" regex alternative produced a real RED at row12, then restored to GREEN): [.bee/cells/codex-parity-4.json](../../../../.bee/cells/codex-parity-4.json) (decision 0009 — the trace is the single source).
