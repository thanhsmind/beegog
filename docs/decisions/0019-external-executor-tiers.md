# 0019 — External executor tiers: multi-provider workers (backlog P14)

- **Status:** active — owner-approved 2026-07-10 ("thực hiện toàn bộ các backlog"); built in 0.1.17. Depends on decision 0018 (goal-check) as its safety floor.
- **Date:** 2026-07-10
- **Source:** owner direction (2026-07-10): the plan-big/execute-small pattern should let bee mix providers — Claude orchestrates, and workers can be GPT/Codex, GLM, Kimi, or anything with a CLI. Mechanics adapted from the LOOP survey: codex-orchestrator-graph's detached `codex exec` dispatch (prompt via file, output via job log, PID/status polling) and delegator's provider-adapter + secrets-isolation discipline. Anthropic's managed-agents cookbook confirms the economics (coordinator + cheap readers: ~2.5× cheaper, ~3× faster on token-heavy work).
- **Confidence:** 0.6 (resolver + config are built and tested; the dispatch protocol is prose and has NOT run a real external worker yet — first dogfood pending).

## Decision

A configurable tier value in `.bee/config.json` `models` may now be an **external executor** object instead of a model name:

```json
"generation": { "kind": "cli", "command": "codex exec --json -m gpt-5.3-codex --full-auto" }
```

- `lib/state.mjs` `resolveTier(root, tier, runtime)` returns a typed dispatch: `inherit` (ceiling) / `model` / `budget` / `cli`. Invalid executor shapes (missing command, unknown kind) are ignored — the tier's default survives. Legacy `modelForTier` degrades a cli tier to `null`, never a bogus model name.
- **Dispatch protocol** (bee-swarming reference, External Executors section): worker prompt written verbatim to `.bee/workers/<cell-id>.prompt.md` (file, never shell-quoted args); command spawned detached with stdin from the prompt file, stdout/stderr to `.bee/workers/<cell-id>.out.log`; tend by artifact (cell status + reservations via the `.bee/bin` helpers the external process runs like any worker) plus the job log's final status token.
- **The worker contract does not fork.** External workers follow the same bee-executing loop, the same status tokens, the same reservation identity — the contract was runtime-agnostic by design; only the spawn mechanism is new.
- **Safety floor (0018, tightened):** external `[DONE]`s are ALWAYS goal-checked (orchestrator re-runs the verify) and frozen-judge-checked — the tiny/small spot-check relaxation never applies to an external executor.
- **Secrets isolation:** the external process gets only its own provider's credentials from the user's environment; bee passes none.

## Rationale

- The cost lever of decision 0012 gets a wider handle: "cheapest capable" can now be whatever provider is actually cheapest for the job, not just the cheapest Claude/Codex model.
- Config-only, additive: repos that never set a `cli` tier see zero change. No new state, no new skill.
- Prompt-file dispatch (not args) dodges the shell-quoting failure class; job-log polling matches bee's "silence is not failure" tending rule.

## Alternatives considered

- **Adopt delegator (`dlg`) as the dispatch layer.** Rejected — brings worktree isolation and its own state store that conflict with bee's reservations model; bee needs the dispatch seam, not the whole runtime.
- **An ultracodex-style executor contract with JSON-RPC adapters.** Rejected for now — right shape at a scale bee has not reached; a single `{kind:'cli'}` seam covers today's need and can grow kinds later (`http`, `app-server`) without breaking config.
- **Per-cell executor override (instead of per-tier).** Deferred — tiers are bee's routing vocabulary; a per-cell escape hatch invites scarcity erosion. Revisit with dogfood evidence.

## Scope (built)

- `lib/state.mjs`: `normalizeTierValue` (string | null | `{kind:'cli', command}`), `resolveTier`, `modelForTier` degradation; version 0.1.17.
- `bee-swarming/SKILL.md` step 4 (typed resolution) + `references/swarming-reference.md` External Executors section (config, 5-step protocol, constraints).
- Tests: `test_lib.mjs` resolveTier fixtures (defaults, cli shape, invalid shapes keep defaults, legacy degradation).

## Deferred

- First real external-worker dogfood run (a tiny-lane cell through `codex exec`) — the go/no-go evidence for widening use.
- Rate-limit-aware dispatch substitution (smart-orchestrate's budget probe) — file under grooming when external dispatch sees real volume.
