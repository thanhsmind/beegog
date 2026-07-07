# Worker Details

Open this when the compact worker loop needs exact fields or commands.

## Parent Context

The orchestrator supplies: agent nickname (reservation identity), assigned cell id, feature name, paths to `CONTEXT.md` and `plan.md`, global constraints, model tier, and the status-token protocol. Nothing else arrives — if the cell is not executable from that plus the repo, return `[BLOCKED]`; do not guess.

## Expanded Commands

```text
node .bee/bin/bee_status.mjs --json
node .bee/bin/bee_cells.mjs show --id <id>
node .bee/bin/bee_cells.mjs claim --id <id> --worker "<name>"
node .bee/bin/bee_reservations.mjs reserve --agent "<name>" --cell "<id>" --path "<path>" --ttl 3600
node .bee/bin/bee_cells.mjs verify --id <id> --command "<cmd>" --passed true|false [--output-file <f>]
node .bee/bin/bee_cells.mjs cap --id <id> [--outcome TEXT] [--files a,b] [--behavior-change] [--evidence-file F] [--deviations-file F] [--friction TEXT]
node .bee/bin/bee_reservations.mjs release --agent "<name>" --cell "<id>"
node .bee/bin/bee_decisions.mjs active --recent 3
```

Shell guard for write-heavy commands (`git add/mv/rm`, `mv`, `cp`, `rm`, `mkdir`, `touch`, `sed -i`, `tee`, redirection writes):

```bash
BEE_AGENT_NAME="<name>" git add src/foo.ts
```

## Assigned Cell Check

For the one assigned cell, confirm before claiming:

- status is `open` and all `deps` are capped
- `files` scope is clear and reservable
- the `verify` command is concrete and runnable in this repo
- referenced decision IDs resolve in `CONTEXT.md` and do not contradict the action

`[NOOP]` if the cell is missing or already done; `[BLOCKED]` for ambiguity or a locked-decision conflict.

## Trace Field Tiers By Lane

| Lane | Required trace on cap |
|---|---|
| `tiny` | one-line `outcome` |
| `small` | `outcome`, `files_changed` |
| `standard` | `outcome`, `files_changed`, `deviations`, `friction` when a trigger fired |
| `high-risk` | all of the above (non-empty `files_changed` and `outcome` are enforced by the helper), plus spike-evidence links where the plan recorded constraints, plus `verification_evidence` |
| any lane with `behavior_change: true` | `verification_evidence` is mandatory — `cap` refuses without `--evidence-file` |

## Friction Triggers (verbatim — record friction only when one fires)

- had to infer a missing rule
- validation unclear/too expensive
- stale or contradictory doc
- repeated manual step that should be a template
- out-of-scope but important
- unattributable failure

One line per trigger, factual, in `--friction` (or the deviations file for multiples). No trigger fired → leave friction empty; do not invent process commentary.

## verification_evidence Example

Passed via `--evidence-file <path>` on cap for any `behavior_change: true` cell:

```json
{
  "tests_inspected": ["tests/auth/middleware.test.ts"],
  "tests_added_or_changed": ["tests/auth/session-timeout.test.ts (new, 3 cases)"],
  "red_failure_evidence": "session-timeout.test.ts failed before the change: expected 401, received 200",
  "verification_run": "npm test -- auth -> 42 passed, 0 failed",
  "deliberate_exceptions": []
}
```

Every field is honest or explicitly empty with a reason in `deliberate_exceptions`. Vague evidence here becomes a P1 finding in bee:reviewing — the work comes back.

## Verification Failure

Fix the root cause and rerun the exact failing command. After two serious attempts, return `[BLOCKED]` with: the command, the failure summary, attempts made, your diagnosis, and the smallest useful next decision for the parent. A verify command that is itself broken in the repo is a `[BLOCKED]`, never a reason to cap with a substitute check.

## Atomic Commit

One commit per cell, cell id in the message:

```bash
BEE_AGENT_NAME="<name>" git add <files>
git commit -m "feat(<cell-id>): <summary matching the cap outcome>"
```

## Result Field Spec

Every result starts with exactly one token and includes, minimum: nickname, cell id, files touched/requested, reservation outcome (released yes/no), verification result, and the parent's next action. Mirror the result into `history/<feature>/reports/<cell-id>.md`.

- `[DONE]` — cell capped, one commit made, verification recorded as passed, reservations released.
- `[BLOCKED]` — cannot continue safely; include the blocker, diagnosis, and current reservation state.
- `[HANDOFF]` — `.bee/HANDOFF.json` written; include progress, active reservations, and the resume point.
- `[NOOP]` — the assigned cell is unavailable or unsafe; include why and a suggested parent action.

Ambiguities you deferred go in an `Outstanding Questions` section of the report.

## Post-Compaction Recovery

Reread, in order:

1. `AGENTS.md`
2. `history/<feature>/CONTEXT.md`
3. `node .bee/bin/bee_cells.mjs show --id <id>`
4. `node .bee/bin/bee_reservations.mjs list --active-only`
