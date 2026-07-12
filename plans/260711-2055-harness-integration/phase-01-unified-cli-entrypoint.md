# Phase 1 — Unified CLI entrypoint

## Context

- [docs/decisions/0024-harness-cross-pollination-analysis.md](../../docs/decisions/0024-harness-cross-pollination-analysis.md) §5 (CLI surface: one entrypoint, two audiences)
- Existing helpers: `skills/bee-hive/templates/bee_status.mjs`, `bee_cells.mjs`, `bee_reservations.mjs`, `bee_decisions.mjs`
- Existing shared lib: `.bee/bin/lib/` (`state.mjs`, `cells.mjs`, `reservations.mjs`, `guards.mjs`, `inject.mjs`, `backlog.mjs`, `commands_detect.mjs` — per docs/02-architecture.md)
- Anti-drift precedent already in the codebase: `bin/lib/inject.mjs` feeds the session-init hook, the AGENTS.md block, and `bee_status` output from one module, "so the runtimes can never drift" (docs/02). This phase applies the same technique to command discovery.
- **Reframe from the original draft:** exposing a `--help --json` manifest solves *discoverability* only. It does not solve *compliance* — an agent can read the schema perfectly and still call a hallucinated flag, call against a stale cached copy after a rename, or get a bare stack trace on a malformed call with no path to self-correct. bee's entire thesis elsewhere (cap-requires-proof, goal-check, frozen-judge, write-guard) is "never trust behavior, verify mechanically" — this phase now applies that same principle to the CLI surface itself, not just to cell execution.

## Requirements

### Discoverability (original scope)

- One dispatcher entrypoint `bee.mjs` (vendored to `.bee/bin/bee.mjs`) routing to the 4 existing helper modules' logic — a thin router, not a rewrite of their internals.
- `bee --help` — human-readable command tree, generated from one shared command registry.
- Reuse the existing `--json` flag convention; no new flag name (e.g. no `--robot`).
- The 4 existing entrypoints keep working unchanged during/after this phase — no breaking change for any skill instruction that still says `node .bee/bin/bee_cells.mjs ...`.
- `onboard_bee.mjs --apply` vendors the new dispatcher + registry with managed-hash drift detection, same as the other helpers.

### Manifest shape — speak the agent's native tool-call dialect

- `bee --help --json` emits each command in the **same JSON-Schema tool-definition shape Claude Code's own tool/subagent surface already uses** (visible verbatim in this session as `{name, description, parameters: {type:"object", properties, required}}`), not a bespoke ad-hoc format:
  ```json
  {
    "schema_version": "1.0",
    "commands": [
      {
        "name": "cells.cap",
        "invoke": "bee cells cap",
        "description": "Cap a cell — refuses without recorded verify proof.",
        "parameters": {
          "type": "object",
          "properties": {
            "id": {"type": "string", "description": "Cell id, e.g. auth-3"},
            "json": {"type": "boolean", "description": "Machine-readable output"}
          },
          "required": ["id"]
        },
        "examples": ["bee cells cap --id auth-3 --outcome \"wired middleware\""],
        "deprecated": null
      }
    ]
  }
  ```
- This is zero-translation for any Claude-based agent, and forward-compatible with wrapping the registry as an MCP tool server later (out of scope for this phase — see Deferred, below) without reshaping anything.

### Compliance — validate before executing, never trust the call was right

- `bee.mjs` validates parsed arguments against the matching command's `parameters` schema **before** dispatching to the handler. On mismatch, it returns a structured, actionable rejection — never a raw stack trace:
  ```json
  {"ok": false, "error": {"field": "id", "reason": "required, missing", "command": "cells.cap"}}
  ```
  This is the CLI's own goal-check: the harness verifies the call was well-formed instead of trusting the agent typed it correctly, mirroring decision 0018's "evidence, not assertion" applied to argument parsing itself.
- Unknown-command calls get a suggestion, not a bare "command not found" — nearest-match against the registry (e.g. `cells.cap` vs. a typo `cells.caps`), same spirit as harness's `clap` "did you mean" behavior.

### Versioning — no silent breakage for a stale cached manifest

- The manifest carries `schema_version`. A renamed or removed command keeps a stub entry: `"deprecated": {"since": "0.1.21", "use_instead": "cells.cap"}` — an agent calling the old name gets redirected with a clear reason, not a cold failure.
- `bee_status.mjs` (or the dispatcher itself) tracks the manifest's content hash across the session. If the hash changes mid-session (e.g. `onboard_bee.mjs --apply` ran, or the agent's cached copy predates a rename), the **next** response from any command includes `"manifest_changed": true` with a one-line hint to re-read `bee --help --json` — cheaper than forcing a discovery call every session regardless of drift (see Alternatives considered).

### Examples are tested contracts, not prose

- Every `examples[]` entry in the registry is executed verbatim by the test suite and asserted not to error. A manifest can never advertise an example that doesn't actually work — this is the same "an assertion is not evidence" discipline bee applies to cell verification, applied to its own documentation.

### Enforcement — the mechanical belt, not just the manifest

- Extend the **existing** `bee-write-guard.mjs` hook (PreToolUse) — do not add a 7th hook; bee's own rule is any new hook must name which of the six it replaces, and this is squarely write-guard's existing job (it already gates Bash calls pre-Gate-3). Add one more check: a Bash call invoking `.bee/bin/bee.mjs` (or a legacy `bee_*.mjs` entrypoint) with a command/argument shape that doesn't match the registry is **denied** with the same structured correction the dispatcher itself would give, *before* the shell even runs it. This closes the loop between "the manifest exists" and "the agent's actual call obeys it" — the difference between hoping an agent read `--help --json` and knowing malformed calls physically cannot execute.

## Deferred (explicitly out of scope for this phase — avoid overbuilding)

- **MCP server wrapper.** The manifest shape (parameters as JSON-Schema) makes a future `bee-mcp` adapter a thin pass-through, not a redesign — but building it now is a foundation-add without demonstrated need, the same reasoning bee already applied to reject worktree-as-default-primitive (decision 0018) and to skip harness's copied-DB/changeset machinery (docs/08 #7). Revisit only if a non-Claude-Code agent runtime needs it.
- **Mandatory `--help --json` call at the start of every session, hook-enforced.** Considered and rejected in favor of the lighter hash-change-detection above: forcing a discovery call regardless of whether anything changed adds token cost for no benefit in the common case (nothing changed since last session). Revisit if dogfood shows agents missing drift in practice despite the `manifest_changed` hint.

## Files

- Create: `skills/bee-hive/templates/bee.mjs`
- Create: `skills/bee-hive/templates/lib/command-registry.mjs` (registry + JSON-Schema `parameters` per command + `deprecated` fields)
- Create: `skills/bee-hive/templates/lib/validate-args.mjs` (schema validation used by both `bee.mjs` at dispatch time and `bee-write-guard.mjs` at PreToolUse time — one validator, two call sites, no duplicated logic)
- Modify: `skills/bee-hive/scripts/onboard_bee.mjs` (vendor + hash-track the new files)
- Modify: `hooks/bee-write-guard.mjs` (add the registry-shape check to its existing PreToolUse pass)
- Modify: `skills/bee-hive/templates/AGENTS.block.md` (bootstrap step referencing `bee --help --json`)
- Modify: `docs/02-architecture.md`, `docs/07-contracts.md` (document the new CLI surface, the manifest shape, and the hash-change-detection behavior)

## Implementation steps

1. Define the command registry: array of `{name, invoke, description, parameters (JSON-Schema), examples[], deprecated}`, covering all subcommands of the 4 existing helpers.
2. Write `bin/lib/validate-args.mjs`: given a command's `parameters` schema and parsed args, return `{ok, error?}` — the single validator both call sites use.
3. Write `bee.mjs` as a thin dispatcher: parse the first argv token as a command group, validate args via step 2, dispatch to the matching existing module's handler only on a valid call; on invalid, return the structured rejection.
4. Implement `--help` (prose render of the registry) and `--help --json` (raw registry, Claude-tool-schema shaped), both sourced from the one registry file `bin/lib/inject.mjs` also reads.
5. Add nearest-match suggestion for unknown commands (simple edit-distance against registered names).
6. Add manifest content-hash tracking; surface `manifest_changed` on the next call after a detected change.
7. Extend `hooks/bee-write-guard.mjs`: reuse `validate-args.mjs` against any Bash call shaped like a `bee`/`bee_*.mjs` invocation; deny with the same structured correction on mismatch.
8. Wire `onboard_bee.mjs --apply` to vendor `bee.mjs`, the registry, and the validator, with managed-hash drift detection.
9. Update `skills/bee-hive/templates/AGENTS.block.md`'s bootstrap block to reference `bee --help --json` once, noting the `manifest_changed` hint replaces the need for a mandatory re-read every session.
10. Keep the 4 existing entrypoints as thin wrappers around the same modules `bee.mjs` uses, so nothing currently referencing them breaks.

## Tests / validation

- Extend `test_lib.mjs` (or add `test_bee_cli.mjs`):
  - `bee --help` returns non-empty prose; `bee --help --json` parses as valid JSON, matches the Claude-tool-schema shape, and lists every existing subcommand.
  - Every `examples[]` entry executes without error (manifest-as-tested-contract).
  - A call missing a required parameter returns the structured `{ok:false, error:{...}}` shape, never a stack trace.
  - A typo'd command name returns a nearest-match suggestion.
  - A `deprecated` command redirects with `use_instead` rather than failing cold.
  - `bee cells ready` output is identical to `bee_cells.mjs ready` (parity check against the pre-existing entrypoints).
  - `bee-write-guard.mjs`'s existing gate/reservation/secret-guard tests still pass unchanged (regression guard for the shared hook) *and* a new test confirms a malformed `bee.mjs` Bash call is denied before execution.
- Manual: onboard a scratch repo, confirm `.bee/bin/bee.mjs` vendors correctly and `bee --help --json` is well-formed; force a manifest content change and confirm `manifest_changed` surfaces on the next call.

## Risks / rollback

- Risk: dispatcher drifts from the underlying modules if help text or validation is hand-duplicated instead of generated/validated from the one registry — mitigated by construction (steps 2–4 share one source).
- Risk: extending `bee-write-guard.mjs` (a shared, load-bearing hook) risks regressing its existing gate/reservation/secret-guard responsibilities — mitigated by requiring the existing hook test suite to pass unchanged, plus the new check being additive (only fires on `bee`/`bee_*.mjs`-shaped calls, untouched otherwise).
- Rollback: additive only. Deleting `bee.mjs`, the registry, and the validator reverts to the pre-existing 4-entrypoint behavior; reverting the `bee-write-guard.mjs` change is a single-hunk diff since the new check is isolated from the hook's existing logic. No state schema changes in this phase, zero data loss.
