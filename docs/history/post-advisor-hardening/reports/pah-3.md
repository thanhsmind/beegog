# pah-3 — H3 session-close B15 advisor-consult prerequisite prose

**Status:** [DONE]

**Outcome:** `maybeBypassBlock()` in `hooks/bee-session-close.mjs` (the B15 gate-bypass net) now names the AO3/AO13 advisor-consult prerequisite in the block instruction it emits for a pending **execution** gate on a **high-risk** lane: resolve the configured advisor, run it read-only with the evidence bundle on stdin, then record it via `node .bee/bin/bee.mjs state advisor-ref record --advisor "<identity>" --digest-file <path>` — *before* telling the agent to set the gate (which otherwise throws per AO3/AO13). Every other case (Gate 2/shape, non-high-risk Gate 3) is byte-unchanged: the added sentence is empty string outside that one branch. No change to when the net fires, the loop-guard, or the verdict shape.

**Files touched:**
- `hooks/bee-session-close.mjs`
- `.bee/bin/hooks/bee-session-close.mjs` (mirror, byte-identical)
- `hooks/test_bypass_stop_net.mjs`
- `docs/history/codex-harness-hardening/release-manifest.json` (via `--write`)

**Test coverage added:** two new rows in `hooks/test_bypass_stop_net.mjs` — row 3b (total + high-risk mode + validating/execution → block reason contains the `state advisor-ref record` / `AO3/AO13` consult sentence, positioned before "Set the gate yourself now"), row 3c (total + standard mode + validating/execution → block reason has no consult text, reads byte-identical to the prior instruction). All 14 pre-existing rows (incl. row 8's normal+high-risk no-block floor) regress green.

Full trace/evidence (including the `verification_evidence` object and pre-change `git show HEAD` extract): `.bee/cells/pah-3.json`.

**Commit:** see next commit — "feat(pah-3): B15 session-close names advisor-consult prerequisite for high-risk execution"
