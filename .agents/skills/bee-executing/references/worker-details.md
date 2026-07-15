# Worker Details

Open this when the compact worker loop needs exact fields or commands.

## Parent Context

The orchestrator supplies: agent nickname (reservation identity), assigned cell id, feature name, paths to `CONTEXT.md` and `plan.md`, global constraints, model tier, and the status-token protocol. Nothing else arrives — if the cell is not executable from that plus the repo, return `[BLOCKED]`; do not guess.

## Expanded Commands

```text
node .bee/bin/bee.mjs status --json
node .bee/bin/bee.mjs cells show --id <id>
node .bee/bin/bee.mjs cells claim --id <id> --worker "<name>"
node .bee/bin/bee.mjs reservations reserve --agent "<name>" --cell "<id>" --path "<path>" --ttl 3600
node .bee/bin/bee.mjs cells verify --id <id> --command "<cmd>" --passed true|false [--output-file <f>]
node .bee/bin/bee.mjs cells cap --id <id> [--outcome TEXT] [--files a,b] [--behavior-change] [--evidence-stdin] [--deviations-file F] [--friction TEXT]
node .bee/bin/bee.mjs reservations release --agent "<name>" --cell "<id>"
node .bee/bin/bee.mjs decisions active --recent 3
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
| any lane with `behavior_change: true` | `verification_evidence` is mandatory — `cap` refuses without it; pipe it via `--evidence-stdin` (no file written) |

## Friction Triggers (verbatim — record friction only when one fires)

- had to infer a missing rule
- validation unclear/too expensive
- stale or contradictory doc
- repeated manual step that should be a template
- out-of-scope but important
- unattributable failure

One line per trigger, factual, in `--friction` (or the deviations file for multiples). No trigger fired → leave friction empty; do not invent process commentary.

## verification_evidence Example

Piped via `--evidence-stdin` on cap for any `behavior_change: true` cell (the evidence goes straight into `trace.verification_evidence` — **no file is written**):

```bash
node .bee/bin/bee.mjs cells cap --id <id> --files a,b --behavior-change --evidence-stdin <<'JSON'
{ ...the evidence object below... }
JSON
```

The evidence object:

```json
{
  "tests_inspected": ["tests/auth/middleware.test.ts"],
  "tests_added_or_changed": ["tests/auth/session-timeout.test.ts (new, 3 cases)"],
  "red_failure_evidence": "session-timeout.test.ts failed before the change: expected 401, received 200",
  "verification_run": "npm test -- auth -> 42 passed, 0 failed",
  "deliberate_exceptions": []
}
```

Every field is honest or explicitly empty with a reason in `deliberate_exceptions`. Vague evidence here becomes a P1 finding in bee-reviewing — the work comes back.

**`red_failure_evidence` is captured at cap time, not backfilled later (decision 0009).** For a `behavior_change` cell the helper *refuses to cap* unless the evidence names a "before": the prior behavior this change alters — a `git show <pre-change-commit>:<file>` extract, or a pre-change check that failed. If the surface is genuinely new (no prior behavior to characterize), say so in `deliberate_exceptions`. This is why the characterization is cheap to record now — the old state is one `git show` away while you hold the diff in context; recovering it after review means a whole extra evidence-only cell.

## Evidence lives in one place (decision 0009)

The cell **trace** is the single source of verification evidence: `trace.verification_evidence` (the JSON above) plus `trace.verify_output` (the recorded verify run). **Pipe evidence with `--evidence-stdin` so no evidence file is ever written.** Do NOT create `reports/<cell-id>-evidence.json`, `reports/execution-*-evidence.md`, or any other on-disk evidence file — that is the exact duplication decision 0009 removed. (`--evidence-file` still exists only for back-compat; if you must use it, write to a throwaway path outside `docs/history/`, pass it to cap, and delete it — never leave it in `reports/`.) The per-cell report (below) *links and summarizes* the trace in one line; it never re-embeds it.

## Verification Failure

Fix the root cause and rerun the exact failing command. After two serious attempts, return `[BLOCKED]` with: the command, the failure summary, attempts made, your diagnosis, and the smallest useful next decision for the parent. A verify command that is itself broken in the repo is a `[BLOCKED]`, never a reason to cap with a substitute check.

## Atomic Commit

One commit per cell, cell id in the message:

```bash
BEE_AGENT_NAME="<name>" git add <files>
git commit -m "feat(<cell-id>): <summary matching the cap outcome>"
```

## Result Field Spec

Every result starts with exactly one token and includes, minimum: nickname, cell id, files touched/requested, reservation outcome (released yes/no), verification result, and the parent's next action. Mirror the result into `docs/history/<feature>/reports/<cell-id>.md` as a short summary that **links** the cell (`.bee/cells/<cell-id>.json`) for the full trace and evidence — never a second copy of the `verification_evidence` JSON or the verify output (decision 0009: the trace is the single source).

- `[DONE]` — cell capped, one commit made, verification recorded as passed, reservations released.
- `[BLOCKED]` — cannot continue safely; include the blocker, diagnosis, and current reservation state.
- `[HANDOFF]` — `.bee/HANDOFF.json` written; include progress, active reservations, and the resume point.
- `[NOOP]` — the assigned cell is unavailable or unsafe; include why and a suggested parent action.

Ambiguities you deferred go in an `Outstanding Questions` section of the report.

## Post-Compaction Recovery

Reread, in order:

1. `AGENTS.md`
2. `docs/history/<feature>/CONTEXT.md`
3. `node .bee/bin/bee.mjs cells show --id <id>`
4. `node .bee/bin/bee.mjs reservations list --active-only`
