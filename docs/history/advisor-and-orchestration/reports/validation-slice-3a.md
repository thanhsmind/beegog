# Validation — Slice 3A (W4 passive tools logger)

Date: 2026-07-17 · Lane: high-risk (inherited) · Cell: `ao-3a-1` (single cell — panel and cold-pickup ran as one combined opus pass; scaling choice recorded)

## Reality gate

| Check | Verdict | Evidence |
|---|---|---|
| MODE FIT | PASS | New hook surface in a high-risk feature; full checker pass ran. Zero-enforcement logger — no gate/deny semantics added. |
| REPO FIT | PASS | 8-hook template mapped by extraction gather (catalog entry shape, wrapper pattern, WRAPPERS list, DEFAULT_HOOKS, settings.json block — all anchored). PostToolUse precedent exists (state-sync). |
| ASSUMPTIONS | PASS | AO15 (f1ca79b9): agent_id/agent_type present on subagent calls, absent on orchestrator — the agent column is buildable. Baseline green (contract suite ALL PASS, manifest 142 match). |
| SMALLER PATH | PASS | W4 only; W3 (pinned agent types) deferred to 3B unplanned — no speculative cells. |
| PROOF SURFACE | PASS | Verify chain members all in baseline; fails-when-broken pair specified (happy-path + crash-injection). |

## Feasibility matrix

| # | Assumption | Proof | Result |
|---|---|---|---|
| 1 | Agent attribution fields exist in the payload | AO15 measured capture (decision f1ca79b9) | PASS |
| 2 | Matcher-less catalog entry renders on both runtimes | UserPromptSubmit precedent renders matcher-less | PASS |
| 3 | hooks.json/claude-hooks.json regenerable byte-exact | drift rows in contract suite byte-check them (self-correcting) | PASS |
| 4 | .codex/hooks.json path understood | panel: hand-curated D9 snapshot, NOT rendered — hand-add one group only (was the plan's one trap; cell corrected) | PASS (after fix) |
| 5 | Contract fixtures can express PostToolUse + agent fields | buildFixture/runWrapper patterns reusable (panel) | PASS |
| 6 | No ALLOWED_DIFFERENCES entry needed | BOTH-runtimes entry renders identically (panel verified) | PASS |
| 7 | Schedule | single-cell wave, zero cycles | PASS |

## Panel + cold-pickup (opus, combined; iteration 1 → resolved)

- **BLOCKER** — ".codex/hooks.json re-render" was wrong: it is a hand-curated fallback snapshot (test_hook_contracts.mjs:773, D9) that deliberately omits SubagentStart/audit; a faithful re-render would inject ~20 unrelated lines and verify would stay green. **Fixed:** cell now mandates hand-adding only the tools-logger PostToolUse group (shape copied from :38-49) and prohibits the re-render.
- **WARNING** — hardcoded `repoCommands.length === 11` (test_hook_contracts.mjs:812) goes red at 12; named in the action as a known fix, not an unexplained failure.
- **WARNING** — read_first thinned; adapter.mjs + test_hook_contracts.mjs added.
- Cleared: no DEFAULT_HOOKS census exists (deviation clause dropped); settings.json hand-add safe; per-call spawn precedented (write-guard); unbounded log consistent with hooks.jsonl/dispatch.jsonl (notes only); fidelity clean (W4-only, zero enforcement, AO15 honored, cost-claim ban held).

## Verdict

**READY WITH CONSTRAINTS** — constraints applied in cell text before Gate 3. Approval covers `ao-3a-1` only; 3B (W3) unplanned and uncovered.

## Approval

Gate 3 auto-approved under `gate_bypass: total`; audit decision in `.bee/decisions.jsonl`.
