# Advisor evidence bundle — codex-native-runtime-v2, slice 3 (pre-Gate-3 consult)

You are a read-only advisor. Assess feasibility and risk. Do NOT approve anything; return numbered findings + verdict (PROCEED / PROCEED-WITH-CHANGES / RETURN-TO-PLANNING). Your sandbox is read-only; do not attempt bee state mutations.

## Context

codex-native-runtime-v2 slices 1-2 shipped (docs truth, atomic-write hardening, update_plan matcher superset, capability matrix on codex-cli 0.144.4, permission/profile docs, manifest regen + byte pin, Codex spawn_agent guard with isolated fail-open branch). Slice 3 is the adapter split (D9, refined by logged decision): the 5 runtime-sensitive skills get inline runtime-conditional blocks — `<!-- bee:only claude -->…<!-- bee:end -->` / `<!-- bee:only codex -->…<!-- bee:end -->` — and the onboarding skill-sync renders each managed repo root by filtering (`.claude/skills` drops codex blocks, `.agents/skills` drops claude blocks, markers stripped; unmarked = shared core). skills/ stays the single human-edited source; plugin routes keep shipping source for now (pre-render at release filed as follow-up PBI).

## Slice 3 cells

- cnr2-9 (ceiling): renderer in onboard_bee.mjs sync path + scripts/test_skill_render.mjs (filter unit tests, nesting/unclosed refusal loud with zero writes, idempotency, and the no-marker no-op invariant: with zero markers, rendered output byte-identical to source — the regression net). Per-target version/drift hashing moves to rendered bytes. Must resolve how bee's own repo mirrors (.claude/skills, .agents/skills — currently byte-identical to skills/, kept by a mechanism the worker must find, self_skip claimed for onboarding) receive rendered copies.
- cnr2-10 (deps 9): attribution-only tagging of bee-hive, bee-swarming, bee-executing (+ references files) — Claude-only: Agent tool/subagent_type, .claude/agents refs, model-param transport, worktree dispatch; Codex-only: spawn_agent/wait_agent tending, read budgets, AO11 notes. ONE content change (D10): the `claude -p` advisor fallback becomes claude-only; codex block gets Codex-native consult transport, no cross-vendor fallback unless the advisor slot is configured as that CLI.
- cnr2-11 (deps 9): same for bee-validating, bee-reviewing; render out; full recorded verify chain (23 scripts) recorded green.

## Questions

1. The rendered managed roots will differ from skills/ source once markers land — what existing byte-equality checks (mirror/distribution/release-manifest suites, three-version downgrade preflight in onboarding) do you expect to break, and what is the safest hashing contract (source-hash vs rendered-bytes-hash per target) that keeps downgrade protection honest?
2. Any risk class in the inline-marker approach itself (markdown rendering of HTML comments in the two runtimes' skill loaders, marker collisions inside code fences, skills that quote marker syntax as documentation)?
3. Is attribution-only tagging of AO11-style asymmetry notes coherent (a note explaining "Codex has no per-agent subagent type" is ABOUT codex but useful to a Claude orchestrator dispatching cross-runtime — which side should carry it, or should it stay shared core)?
