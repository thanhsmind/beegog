# 07 — Implementation Contracts (v0.1)

Normative contracts every v0.1 component codes against. When this doc and another doc disagree, this doc wins for implementation details.

## Ground rules

- Node 18+, ESM (`.mjs`), **zero npm dependencies**. Windows-safe paths (use `node:path`).
- Atomic writes everywhere: write `<file>.tmp`, then `renameSync`.
- All scripts fail safe: helpers exit non-zero with a one-line JSON error on `--json`; hooks NEVER break a session (wrap everything, log to `.bee/logs/hooks.jsonl`, exit 0 unless deliberately blocking).
- Source of truth for vendored code: `skills/bee-hive/templates/` in the plugin. Onboarding copies it to `<repo>/.bee/bin/` (helpers) and `<repo>/.bee/bin/lib/` (modules).
- Hooks live in the plugin (`hooks/`). At runtime they resolve the target repo root from CWD and dynamic-import lib from `<root>/.bee/bin/lib/`. If root or lib is missing → exit 0 silently (self-arm rule).

## Refusal messages: ERROR / WHY / FIX (docs/09 item 5)

bee refuses a lot by design — the message decides whether a refusal teaches in one
correction or causes retry thrash. Every user-facing refusal from `bin/lib/` or a hook
carries three elements:

1. **ERROR** — the rule that fired, named (`capCell: cell "x-1" has no passing verify result`).
2. **WHY** — the reason in the same sentence (`— an assertion is not evidence`).
3. **FIX** — the next command or action, concrete (`run … and record it: bee_cells.mjs verify --id x-1 --command CMD --passed true`).

A refusal that ends at "not allowed" with no stated next step violates this contract.
Guard denials follow the same shape (`reason` names the gate/conflict, why, and the route:
surface Gate 3, reserve first, or return `[BLOCKED]`). Tests assert the FIX element (the
stated next action) for the three highest-traffic paths: cap-refusal, gate-block,
reservation-conflict.

## Runtime files

```
.bee/onboarding.json   { schema_version, bee_version, managed: {agents_block, helpers, lib}, created_at, updated_at }
.bee/state.json        see below
.bee/config.json       { hooks: {"session-init":true,"prompt-context":true,"write-guard":true,"state-sync":true,"chain-nudge":true,"session-close":true}, lanes:{}, capabilities:{} }
.bee/HANDOFF.json      { phase, feature, mode, cells_in_flight:[], done:[], remaining:[], next_action, written_at }
.bee/reservations.json { reservations: [ {agent, cell, path, ttl_seconds, reserved_at, released_at|null} ] }
.bee/decisions.jsonl   append-only decision events
.bee/backlog.jsonl     friction/grooming items
.bee/cells/<id>.json   one cell per file
.bee/logs/hooks.jsonl  hook crash/audit log
.bee/.inject-cache.json injection dedup state
```

`state.json` default:

```json
{
  "schema_version": "1.0",
  "phase": "idle",
  "feature": null,
  "mode": null,
  "approved_gates": { "context": false, "shape": false, "execution": false, "review": false },
  "workers": [],
  "summary": "",
  "next_action": "Invoke bee-hive."
}
```

Cell schema: as in [02-architecture.md](02-architecture.md) (id, feature, title, lane, status, deps, decisions, files, read_first, action, must_haves, verify, trace{worker, outcome, files_changed, deviations, friction, capped_at, behavior_change, verification_evidence, verify_output}).

## lib API (`skills/bee-hive/templates/lib/`)

All functions are sync unless noted. `root` = absolute repo root path.

### `fsutil.mjs`
- `readJson(file, fallback=null)`, `writeJsonAtomic(file, obj)`, `appendJsonl(file, obj)`, `readJsonl(file)` → array, `ensureDir(dir)`.

### `state.mjs`
- `findRepoRoot(startDir)` → path|null — walk up looking for `.bee/onboarding.json`, else first `.git`, else null.
- `defaultState()`, `readState(root)` (returns default when missing), `writeState(root, state)`.
- `gateApproved(state, gateName)` → boolean.
- `readHandoff(root)` → object|null, `readOnboarding(root)` → object|null, `readConfig(root)` → object (default hooks all true).
- `hookEnabled(root, name)` → boolean.

### `cells.mjs`
- `cellsDir(root)`, `listCells(root, {feature=null, status=null})` → array sorted by id.
- `readCell(root, id)` → cell|null, `writeCell(root, cell)`.
- `addCell(root, cell)` — validates: id, feature, title, lane ∈ {tiny,small,standard,high-risk,spike}, action, verify. `standard|high-risk` also require non-empty `must_haves.truths`. Throws `Error` with clear message.
- `readyCells(root, feature=null)` → open cells whose deps are all capped.
- `claimCell(root, id, worker)` — throws if: gate `execution` not approved, cell missing, status ≠ open, deps not all capped. Sets status=claimed, trace.worker.
- `recordVerify(root, id, {command, output, passed})` — stores on cell trace (`verify_output`, `verify_passed`).
- `capCell(root, id, {files_changed=[], deviations=[], friction=null, behavior_change=false, verification_evidence=null, outcome})` — throws unless `trace.verify_passed === true`; throws if `behavior_change` true and `verification_evidence` missing; for lane high-risk, requires files_changed non-empty and outcome. Sets status=capped, capped_at ISO.
- `blockCell(root, id, reason)`, `dropCell(root, id, reason)`.

### `reservations.mjs`
- `listReservations(root, {activeOnly=false})` — active = released_at null and not TTL-expired.
- `findConflicts(root, agent, paths)` → array of conflicting reservations held by *other* agents covering any path (path match: exact, prefix directory, or trivial `*` glob suffix).
- `reserve(root, {agent, cell, path, ttl=3600})` → `{ok:true}` or `{ok:false, conflicts}`.
- `release(root, {agent, cell=null})` — marks released_at.
- `sweepExpired(root)` → count released.

### `guards.mjs`
- `SECRET_PATTERNS`: regexes for `.env`(+suffixes), `*.pem`, `*.key`, `id_rsa*`, `*.p12`, `credentials*`, `secrets.*`.
- `SCOUT_DIRS`: `node_modules/`, `dist/`, `build/`, `.git/objects`, `vendor/`, `coverage/`, `.next/`, `__pycache__/`.
- `GATE_ALLOWED_PREFIXES`: `.bee/`, `docs/` (covers `docs/history/`), `.spikes/`, `plans/`, `AGENTS.md`.
- `checkWrite(root, state, relPath, agentName=null)` → `{allow:true}` or `{allow:false, kind:'intake'|'gate'|'reservation', reason}`.
  - intake (v0.1.1, repository-harness lesson): when `state.phase` is `idle` AND path not under GATE_ALLOWED_PREFIXES → deny with `kind:'intake'` pointing at bee-hive routing. Default-on; disable per repo via `config.guards.idle_gate: false`. This closes the "first ad-hoc edit slips through before any workflow starts" hole.
  - gate: block only when `state.phase` ∈ {`exploring`,`planning`,`validating`} AND path not under GATE_ALLOWED_PREFIXES AND `approved_gates.execution` is false. During `swarming`: reservation check via `findConflicts` when `agentName`/`BEE_AGENT_NAME` provided; unreserved-but-conflicting → deny.
- `checkRead(relPath)` → `{allow:true}` or `{allow:false, kind:'privacy'|'scout', reason, marker}` where privacy marker = `@@BEE_PRIVACY@@{json}@@END@@` containing `{file, question}`.
- `extractBashTargets(command)` → `{paths:[], broadWrite:boolean}` (khuym patterns: `sed -i`, `tee`, `rm`, `mv`, `cp`, `mkdir`, `touch`, `git add|mv|rm`, redirection `>`).

### `inject.mjs`
- `buildSessionPreamble(root)` → markdown string: bee version + onboarding health; phase/mode/feature; gate states; HANDOFF block ("present it and WAIT — never auto-resume") when present; up to 10-line digest of `docs/history/learnings/critical-patterns.md`; last 3 active decisions (datamarked); when `docs/specs/` exists, one state-layer line ("Area specs + reading map at `docs/specs/` — read the touched area's spec before its code"); "Run `node .bee/bin/bee_status.mjs --json` for detail. Route via bee-hive."
- `buildPromptReminder(root)` → `{text, hash}` — 1–3 lines: phase / mode / next_action / first open gate. `hash` = stable hash of those fields.
- `shouldInject(root, key, hash)` / `markInjected(root, key, hash)` — via `.bee/.inject-cache.json`; inject when hash differs from last or >30 min elapsed.

### `decisions.mjs`
- `logDecision(root, {decision, rationale, alternatives=null, scope='repo', source='user', confidence=null})` → event with uuid + ISO date; **rejects** (throws) content matching secret patterns or instruction-injection heuristics (e.g., `ignore previous`, role tags `<system>`).
- `supersedeDecision(root, {supersedes, decision, rationale})`, `redactDecision(root, {redacts, reason})`.
- `activeDecisions(root, {recent=null})` — decide events not superseded/redacted, newest first.
- `datamark(text)` — strip/neutralize backticks fences, role tags, control chars; wrap in `«…»`.

## Helper CLI surface (`skills/bee-hive/templates/*.mjs`)

Thin argv wrappers over lib. All support `--json`. Non-zero exit + `{error}` JSON on failure.

```
bee_status.mjs [--json]
  → { onboarding, phase, mode, feature, gates, handoff, cells:{open,claimed,capped,blocked}, active_reservations, critical_patterns_present, recent_decisions, staleness_warnings, recommended_next }

bee_cells.mjs list [--feature F] [--status S] | ready [--feature F] | show --id ID
             | add --file cell.json            (or --stdin)
             | claim --id ID --worker NAME
             | verify --id ID --command CMD --passed true|false [--output TEXT | --output-file F]
             | cap --id ID [--outcome TEXT] [--files a,b] [--behavior-change] [--evidence-file F] [--deviations-file F] [--friction TEXT]
               (cap refuses for small/standard/high-risk lanes when the recorded verify has no output and no evidence, or when --files is empty — decision 0004)
             | block --id ID --reason R | drop --id ID --reason R

bee_reservations.mjs reserve --agent A --cell C --path P [--ttl N]
                    | release --agent A [--cell C]
                    | list [--active-only] | sweep

bee_decisions.mjs log --decision D --rationale R [--alternatives A] [--scope S] [--confidence N]
                 | supersede --id UUID --decision D --rationale R
                 | redact --id UUID --reason R
                 | active [--recent N] | search --text T
```

## Hook contracts (`hooks/`)

`hooks/hooks.json` (Claude Code plugin hook config) wires:

| Script | Event / matcher | Behavior |
|---|---|---|
| `bee-session-init.mjs` | SessionStart `startup\|resume\|clear\|compact` | print `buildSessionPreamble` to stdout; exit 0 |
| `bee-prompt-context.mjs` | UserPromptSubmit | `buildPromptReminder`; print only when `shouldInject(root,'prompt',hash)`; mark; exit 0 |
| `bee-write-guard.mjs` | PreToolUse `Edit\|Write\|MultiEdit\|Bash\|Read\|Glob\|Grep` | parse stdin payload (`tool_name`, `tool_input`); for reads → `checkRead`; for writes/Bash → `checkWrite` (+`extractBashTargets`). Deny = **exit 2 with reason on stderr** (include marker text for privacy). Allow = exit 0 silent. |
| `bee-state-sync.mjs` | PostToolUse `TaskCreate\|TaskUpdate\|TodoWrite` + SubagentStop + Stop | refresh cell counts + last_activity into state.json; exit 0 |
| `bee-chain-nudge.mjs` | SubagentStop | if state.workers lists this agent or phase=swarming → print nudge ("collect [STATUS], update cell, check reservations; when wave clean → next step"); phase=reviewing → reviewer-synthesis nudge; else silent |
| `bee-session-close.mjs` | Stop | if phase not idle/compounding-complete and no HANDOFF → print warning listing claimed-uncapped cells + active reservations. If phase IS idle: decision-review nudge (v0.1.1) — when `git status` shows changed source files and no decision was logged in the last 6h, print a deduped (`shouldInject`) reminder to ask the user about recording a decision/learning. Never blocks; exit 0 |

Common prologue for every hook: read stdin fully (may be empty), `findRepoRoot(cwd)`, require `.bee/onboarding.json` + `hookEnabled(root, '<name>')`, dynamic-import lib from `<root>/.bee/bin/lib/` with try/catch → exit 0 on any miss; crash-log to `.bee/logs/hooks.jsonl`.

## Onboarding (`skills/bee-hive/scripts/onboard_bee.mjs`)

```
node onboard_bee.mjs --repo-root <path> [--apply] [--json] [--repo-hooks] [--claude-md]
```

1. Verify Node ≥18. 2. Compute plan: AGENTS.md BEE block (insert or update between `<!-- BEE:START -->` / `<!-- BEE:END -->`, content from `../templates/AGENTS.block.md` — do NOT touch anything outside markers); create `.bee/` runtime files if missing (never overwrite existing state/decisions/cells); copy `templates/*.mjs` + `templates/lib/*` → `.bee/bin/`; create `docs/history/learnings/critical-patterns.md` stub if missing. 3. Without `--apply` → report `{status: 'up_to_date'|'changes_needed', plan:[...]}`. With `--apply` → apply + write `.bee/onboarding.json` with managed versions. `--repo-hooks` additionally merges hook entries into `<repo>/.claude/settings.json` (backup first). `--claude-md` writes/extends `CLAUDE.md` with a bare `@AGENTS.md` import (harness pattern: auto-loads the BEE block on Claude Code when plugin hooks are unavailable); never duplicates the import, never rewrites existing user content.

`BEE_VERSION = '0.1.0'` exported from `lib/state.mjs`; onboarding compares for drift.

## Skill conventions (v0.1)

- Frontmatter: `name` (bare hyphen-case = dir name), `description` (purpose clause for the slash menu + "Use when …" trigger conditions; never workflow steps), `metadata.version: '0.1'`, `metadata.ecosystem: bee`, `metadata.dependencies` mapping or `[]`.
- Body < 200 lines; one `references/` level; end with handoff sentence `[Outcome]. Invoke bee-<next> skill.`
- Every skill documents `mode:headless` behavior in one short section.
- Commands quoted in skills MUST match the CLI surface above verbatim.
- Each skill ships `CREATION-LOG.md`: provenance (which upstream skill it adapts), what changed, and an honest `Pressure testing: PENDING (scheduled per Iron Law before 1.0)` note with the 3 scenarios from 04-skills-spec listed as the planned RED set.
