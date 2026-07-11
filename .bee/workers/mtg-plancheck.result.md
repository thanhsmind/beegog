OUTCOME: done

## BLOCKERS

1. **BLOCKER — Cell 4 has undeclared write targets, so file ownership and reservation scope are structurally false (dimensions 2 and 5).** `model-tier-guard-4.files` lists only `docs/decisions/0023-explicit-tier-transport.md`, `.claude/settings.json`, and `.bee/bin/hooks/bee-model-guard.mjs`, but its action also says: **“Add one Status line to 0015”**, **“Log the decision to the runtime log”**, and **“hash-syncs the 7 updated source skills to ~/.claude/skills.”** Those writes target `docs/decisions/0015-ceiling-is-the-session-model.md`, `.bee/decisions.jsonl`, and paths outside the repository, none of which is declared in `files`. The cell therefore cannot be safely reserved or cold-picked from its declared scope.

2. **BLOCKER — The required live payload-contract integration check has no owning cell (dimension 4).** `plan.md` says validating must **“confirm the PreToolUse payload field names for the Agent tool (`tool_name`, `tool_input.model`, `tool_input.prompt`, `tool_input.description`) against a live hook log before trusting them.”** It also identifies **“Payload field-name mismatch”** as MEDIUM risk and requires a **“live-fire one denied dispatch.”** Cell 4 instead directs only: **“Pipe one bare Agent payload through the VENDORED hook path”**; its verify likewise feeds hand-authored JSON to Node. That proves the hook against an assumed schema, not the actual Agent/Task payload. Because the hook is deliberately fail-open on parse misses, this missing link can leave the feature fully ineffective while every cell passes.

3. **BLOCKER — Cell 4's verify can pass while most of its declared must-haves are false (dimension 2).** Its must-haves require onboarding recheck `up_to_date`, preservation of existing settings keys, a correctly targeted hook command, a decision-log entry, the 0015 amendment, correct 0023 scoping, and installed-skill synchronization. The verify checks only file existence, any occurrence of **“Agent|Task”**, vendored-hook denial against synthetic JSON, and the onboarding test suite. It never checks the recheck result, hook command target, preservation, either decision mutation, or skill sync. This is not a complete runnable proof for the cell's own acceptance contract.

## WARNINGS

1. **WARNING — Cell 1's payload-table verification is materially narrower than the plan and its own must-haves (dimension 2).** `plan.md` names boundary positions 490/600, config-off, missing `tool_input`, no repo, description markers, casing, and deny-message content. Cell 1's verify exercises only bare denial, model allowance, a prompt marker, wrong tool, and junk JSON; stderr is discarded for the denial. The action owns the behavior, but the runnable verify does not catch regressions in several promised branches, including the required `FIX` line and configured generation-model name.

2. **WARNING — Cell 4 combines repository apply, global installed-skill sync, decision amendment/logging, and live verification in one standard-lane cell (dimension 5).** Its title presents **“Decision 0023 doc + onboarding apply”**, while the directive also mutates an earlier decision, runtime decision state, repo settings, vendored hooks, and `~/.claude/skills`. Even apart from the undeclared targets in Blocker 1, this is a broad operational blast radius for one cell and makes partial failure/retry state difficult to distinguish.

## EVIDENCE

### 1. Requirement/decision coverage

- **D1 covered:** cell 1 implements the transport guard; cell 3 updates transport wording; cell 4 records the amendment.
- **D2 covered:** cell 1 owns fail-open/toggle/deny behavior; cell 2 owns `Agent|Task` registration and onboarding propagation.
- **D3 covered:** cell 3 names all seven skill-document targets and the generation-default/ceiling-marker rule.
- **D4 covered:** cell 2 explicitly says **“Per D4 leave .codex/hooks.json untouched”** and prohibits edits to it.
- No uncovered locked decision found.

### 2. Cell completeness

- All four JSON cells contain non-empty `files`, `read_first`, `action`, `must_haves`, and shell/Node `verify` commands.
- Cell 4's declared file list contradicts its action and its verify does not enforce its acceptance contract: Blockers 1 and 3.
- Cell 1's verify is runnable but under-covers its stated behavior: Warning 1.

### 3. Dependency correctness

- The graph is acyclic: cell 1 and cell 3 have no deps; cell 2 depends on cell 1; cell 4 depends on cells 1, 2, and 3.
- `plan.md` states **“Single slice (current)”** and **“No future-slice cells”**; no dependency crosses into a future slice.
- No dependency finding.

### 4. Key links

- Hook implementation is owned by cell 1.
- Plugin registration plus onboarding copy/merge are owned by cell 2. The cited sources confirm the current seams: `hooks/hooks.json` has one `PreToolUse` matcher for `Edit|Write|MultiEdit|Bash|Read|Glob|Grep`; `onboard_bee.mjs` has the six-entry `HOOK_FILENAMES` list and mirrors that matcher in `renderRepoHookEntries()`; `test_onboard_bee.mjs` hard-codes those same six hook names.
- Skill-source wording is owned by cell 3; repo vendoring/settings apply and decision publication are assigned to cell 4.
- Actual Agent/Task payload compatibility is not owned: Blocker 2.
- The cited hook patterns support the proposed implementation seam: `bee-chain-nudge.mjs` supplies stdin parsing, repo-root lookup, dynamic library import, and crash logging; `bee-write-guard.mjs` documents and implements **“Deny = exit 2”** with all other paths fail-open.

### 5. Scope sanity

- Cells 1–3 stay within the standard lane: one hook, three registration/test files, and seven narrowly directed documentation edits respectively.
- Cell 4 hides additional repository and global writes and spans several operational concerns: Blocker 1 and Warning 2.
