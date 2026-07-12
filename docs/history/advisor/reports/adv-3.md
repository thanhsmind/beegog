# adv-3 — bee-swarming: dispatch-time degenerate check, Advisor line, ladder budget note

**Status:** [DONE]
**Worker:** bob (generation/sonnet)

**Outcome:** Dispatch step now resolves the advisor via `resolveAdvisor(root, runtime)` after the tier choice and runs the orchestrator-side degenerate check (same-model-name skip; ceiling worker always skip; claude order haiku < sonnet < opus; owner-configured/cli advisors presumed stronger — D2 + decision 0016). Worker prompt template gains the optional `Advisor` line with the proven transport (Agent tool, `advisor-consult <cell-id>: <advisor-model>` description prefix, `claude -p --model` fallback; cli shape via stdin per External Executors) matching bee-executing's Advisor Consult section. Rescue ladder gains exactly one note (arriving `[BLOCKED]` already spent its consult budget; rung-1 re-dispatch grants a fresh one) — three rungs byte-unchanged (D1). Goal-check gains the consults-never-substitute-for-fresh-verify sentence. A session with no advisor slot dispatches byte-identical prompts to today.

**Files touched:**
- skills/bee-swarming/SKILL.md
- skills/bee-swarming/references/swarming-reference.md

Full trace and verification evidence: `.bee/cells/adv-3.json`
