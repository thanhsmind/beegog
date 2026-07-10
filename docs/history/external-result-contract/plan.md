---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: small
---

# external-result-contract — file-checkable finish + durable workspace contract for cli executors

## Request

Adopt two patterns from `REFs/repository-harness` (SYMPHONY_SCOPE.md §4.4 run-contract/AGENTS.md shim, §4.6 finish protocol) into bee's External Executors protocol:

1. **File-based finish contract** — an external (cli-tier) worker signals completion through a structured result file the orchestrator can validate mechanically, never by exiting or by a free-text token alone.
2. **Durable workspace contract** — the worker contract lives at a stable file path the external CLI can (re)read, and when dispatch uses an isolated workspace/worktree, the contract is surfaced in that workspace's AGENTS.md — the one file coding CLIs reliably read first.

## Discovery (L1)

- Source patterns read directly: `/home/thanhsmind/projects/REFs/repository-harness/docs/SYMPHONY_SCOPE.md` §4.4 (RUN_CONTRACT.json + AGENTS.md shim, required_outputs, forbidden_paths), §4.6 ("Agents should not signal success only by exiting"; RESULT.json outcome enum + validation evidence; acceptance checklist §11.3).
- Precedent (beats research): decision 0019 (`0a03b45a`) — cli executors run the same bee-executing contract via prompt-file dispatch; decision `29b7f7bb` (2026-07-10) — result via `-o` file, never parse JSONL, stderr suppressed, resume-first rescue, dispatch guards.
- Gap analysis against `skills/bee-swarming/references/swarming-reference.md` (External Executors section):
  - Already covered: result lands in a file; tend-by-artifact; goal-check (0018) on every external [DONE]; prompt file at a stable path; template step 1 "Read AGENTS.md".
  - **Missing (pattern 1):** the result file is free-form markdown with a leading token — no required fields, no acceptance rule, no defined behavior for a missing/garbled/empty result file. A run that dies silently or emits junk has no deterministic detection path today.
  - **Missing (pattern 2):** nothing states the prompt file is the durable contract (a worker that loses context mid-run has no named re-read path), and nothing covers contract delivery for isolated-workspace dispatch (worktree AGENTS.md shim).

## Approach

Chosen: extend the existing External Executors section in `swarming-reference.md` — no new files, no new tooling, no schema code. Two tight additions:

1. **Finish contract + acceptance rule.** The cli-dispatch prompt instructs the external worker to write `.bee/workers/<cell-id>.result.json` as its last act: `{ "cell_id", "outcome": "done|blocked|handoff|noop", "verify_command", "verify_passed": bool, "files_changed": [], "notes" }`. Outcome vocabulary **reuses bee's four status tokens** — no new enum, no ripple into bee-executing or hooks. Orchestrator acceptance checklist (mirrors harness §11.3): a cli run counts only if the result file exists, parses, and carries a valid outcome; missing/invalid/garbled → treated as a failed run and routed to the existing rescue ladder (resume → 2 rounds → [BLOCKED]). The 0018 goal-check stays on top unchanged — the result file is a signal, never the evidence.
2. **Durable workspace contract.** Codify: `.bee/workers/<cell-id>.prompt.md` *is* the contract, at a stable path; the prompt tells the worker to re-read it if context is lost (resume rounds reference it instead of re-pasting). When dispatch runs in an isolated workspace/worktree, write a short contract block into that workspace's AGENTS.md (assigned cell, contract path, required output path, forbidden paths) — AGENTS.md is the file external CLIs reliably read first.

Rejected alternatives:
- Adding `partial` / `needs_intake` outcomes (harness enum) — bee's [HANDOFF]/[BLOCKED] already cover them; new tokens would ripple into bee-executing, chain-nudge, and result-format docs for no acceptance gain.
- A machine-validated JSON schema / helper script for result files — ceremony; the orchestrator reads one small JSON per worker, and 0018 re-verification is the real gate.
- Mutating the repo-root AGENTS.md per dispatch — shared file, concurrent waves, git noise; only isolated workspaces get a shim.

Risk map: `swarming-reference.md` wording drift vs SKILL.md — LOW (SKILL.md already defers mechanics to the reference; check one sentence for consistency). No runtime code touched — the verify suite stays green by construction.

## Test matrix sketch (lane-scaled)

- Presence: new "finish contract" and "durable contract" text greps in the reference file.
- Consistency: SKILL.md external-executor sentence still true (goal-check wording unchanged).
- Baseline: repo verify command still green (no code touched).

## Reality check (inline, lane-scaling v2)

- Target section exists and is the only place cli dispatch is specified: `skills/bee-swarming/references/swarming-reference.md` lines 52–75 — confirmed by direct read.
- `codex exec` supports `-o <file>` and stdin prompt — already relied upon by decision 29b7f7bb; the result.json instruction rides in the prompt, needing no CLI feature beyond shell access the worker already has (it runs `.bee/bin` node helpers).
- No hook or helper parses the current result.md format — grep confirms only the reference documents it, so changing the documented shape breaks nothing mechanical.

## Advisor consult (decision 0013 — shape point)

VERDICT: **agree** (fable, fresh context, 2026-07-10). Notes folded into execution:
- The worktree AGENTS.md shim stays a single conditional sentence — no required_outputs/forbidden_paths machinery for a dispatch mode that does not exist yet.
- State explicitly that `result.json` is the cli **transport** of the same four status tokens, so native markdown results and cli JSON results read as one contract, not two.

## Files (bounded)

- `skills/bee-swarming/references/swarming-reference.md` — External Executors section: dispatch step 2/3 rewrite + acceptance rule + durable-contract paragraph.
- `skills/bee-swarming/SKILL.md` — only if one sentence needs syncing (expected: no change or one clause).

## Verify

`grep -q "result.json" skills/bee-swarming/references/swarming-reference.md && node skills/bee-hive/templates/tests/test_lib.mjs`
