# Advisor evidence bundle — codex-native-runtime-v2, slice 2 (pre-Gate-3 consult)

You are a read-only advisor. Assess feasibility and risk. Do NOT approve anything; return numbered findings + verdict (PROCEED / PROCEED-WITH-CHANGES / RETURN-TO-PLANNING). Do not attempt to run bee state mutations — your sandbox is read-only and that is the caller's job.

## Context

Feature codex-native-runtime-v2 slice 1 shipped: docs truth cleanup (cnr2-1), unique-tmp atomic-write hardening + parallel test (cnr2-5), state-sync matcher superset update_plan|TaskCreate|TaskUpdate|TodoWrite in catalog + both host renderers with a real-payload behavior row (cnr2-2), and a read-only capability spike on codex-cli 0.144.4 (cnr2-4). Matrix verdicts: custom agents (.codex/agents/*.toml) NOT discovered — spawn_agent accepts only built-in default/explorer/worker; plugin-hooks feature removed/false; OBSERVED: update_plan reaches PostToolUse; spawn_agent fires PreToolUse with tool_input.agent_type; trust gate live (untrusted hooks silently skipped). DEFER D6/D8; PROCEED D7/D10/doctor.

## Slice 2 cells

- cnr2-6 (D7, docs): document Codex approval_policy vs bee gate_bypass distinction + bee-safe/bee-autopilot profiles in INSTALL.md + 06-runtime-integration.md. Evidence: approval_policy exists ONLY in this repo's local .codex/config.toml; bee distributes none.
- cnr2-7: regenerate bee's own .codex/hooks.json fully from the catalog repo-target render — cnr2-2 found it drifted (PreToolUse matcher missing AskUserQuestion; SubagentStart/Stop audit entries missing entirely; only the matcher line was patched in-scope then). Add a test row pinning repo file == catalog repo-target render.
- cnr2-8 (deps cnr2-7): add PreToolUse spawn_agent guard entry to the CODEX projections (catalog + host renderers; Claude projection untouched) and extend hooks/bee-model-guard.mjs for the observed Codex spawn ABI (tool_name spawn_agent, tool_input.agent_type; tier from an anchored [bee-tier:] marker in the prompt field). Deny bare/mid-text-marker dispatches (decision 0023 parity), allow anchored-marker dispatches, FAIL-OPEN on payload shapes the spike did not observe. Fixtures for allow/deny/fail-open in test_model_guard.mjs.

## Questions

1. cnr2-8's fail-open rule: any payload variants you'd expect from codex 0.144.4 spawn_agent that the fixtures must cover (e.g. missing tool_input, agent_type absent, prompt field named differently) to avoid bricking real Codex sessions?
2. cnr2-7: any risk that regenerating .codex/hooks.json (adding SubagentStart/Stop audit entries + AskUserQuestion) changes behavior for THIS repo's live Codex sessions in a way that needs sequencing care?
3. Anything in slice 2 that should be deferred to the adapter-split slice (S5) instead?
