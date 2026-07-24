# bee harness — state registers

The cross-stage shared state. Every stage in the [chain](index.md) reads and writes
these files, and they are the reason work is resumable and reviewable. Two
invariants govern all of them:

1. **Never hand-edit `.bee/*.json(l)`.** Every mutation goes through the CLI
   (`node .bee/bin/bee.mjs <group> <verb>`). A mutation with no CLI verb is filed
   as friction (`backlog add`), then edited by hand — never silently.
2. **State is the truth the hook cannot see.** The write-guard hook is a net; the
   phase and gate fields below are what actually decide whether work may proceed.

Anchors below are linked from stage pages and [index.md](index.md).

## The registers

### `.bee/state.json`
The single runtime state file — the spine of the workflow.

| Key | Holds |
|-----|-------|
| `schema_version` | state-file format version |
| `phase` | current chain phase (`idle` · `exploring` · `planning` · `validating` · `swarming` · `scribing` · `compounding` · `compounding-complete`) |
| `feature` | active feature slug |
| `mode` | lane (`tiny` · `small` · `standard` · `high-risk` · `docs`) |
| `approved_gates` | `{context, shape, execution, review}` booleans — the four gates |
| `gate_revoked_at` | map of gate name → ISO timestamp (revocation audit) |
| `workers` | array of `{nickname, cell, tier, status}` |
| `cells` | rollup counts `{open, claimed, capped, blocked}` |
| `summary`, `next_action` | human-readable resume hints |
| `last_scribing_run` | `{feature, date, at, areas_synced, next_action}` |
| `last_compounding_run` | `{feature, at, learnings, critical_promotions, decisions_logged, …}` |
| `advisor_ref` | high-risk advisor record `{consulted_at, feature, newest_decision_id, plan_sha256, advisor, digest_head}` |
| `last_activity` | heartbeat |

Written by: every stage, via `state set --owner <phase>`, `state gate`,
`state worker add/update`, `state scribing-run`, `state start-feature`,
`state advisor-ref record`.

### `.bee/config.json`
Per-repo configuration.

| Key | Holds |
|-----|-------|
| `commands` | `{setup, start, test, verify}` shell commands (a `"none"` sentinel means the gate is deliberately disabled) |
| `hooks` | toggle map: `session-init`, `prompt-context`, `state-sync`, `chain-nudge`, `session-close`, `write-guard`, … |
| `gate_bypass` | `off` · `normal` · `full` · `total` — the opt-in gate autopilot level |
| `models` | per-runtime tier→model map: `{claude:{extraction, generation, review, advisor}, codex:{…}}` |
| `lanes`, `capabilities` | per-repo overrides |

Mutated via `config get/set/unset/validate`. Read by hive (CI/verify gate,
bypass level), swarming (model tiers), executing (`commands.verify`).

### `.bee/onboarding.json`
Onboarding state + managed-file version hashes (drift detection).

Keys: `schema_version`, `bee_version`, `managed` (sha256 per tracked file:
`agents_block`, `gitignore_block`, `helpers.bee.mjs`, `lib.*.mjs`, `repo_hooks.*`,
`statusline.*`), `agents_sync`, `created_at`, `updated_at`. Written by
`scripts/onboard_bee.mjs --apply` (hive onboarding). Read at session start to
detect drift.

### `.bee/cells/<feature>-<n>.json`
One unit of executable work — the atom the swarm dispatches. One file per cell.

| Field | Holds |
|-------|-------|
| `id`, `feature`, `lane`, `title` | identity |
| `files` | paths the cell may write (reserved before write) |
| `read_first` | files the worker must read before editing |
| `action` | free-text instruction |
| `must_haves` | `{truths[], artifacts[], key_links[], prohibitions[]}` |
| `behavior_change` | bool — gates scribing + goal-check judge |
| `verify` | the runnable verify command (an assertion is not evidence) |
| `deps` | cell ids that must cap first |
| `tier` | dispatch tier (`generation`, …) |
| `status` | `open` · `claimed` · `capped` · `blocked` · `dropped` |
| `trace` | populated on cap: `{worker, outcome, files_changed[], verification_evidence, verify_output, verify_passed, verified_at, attempts[]…}` |

Created by planning (`cells add`), mutated by swarming/executing
(`cells claim/verify/cap/…`).

### `.bee/decisions.jsonl`
Append-only decision log — the source of truth for *why*. One JSON object per line:
`{id (uuid), type, date, decision, rationale, alternatives, scope, source, confidence}`.
Written via `decisions log/supersede`, never by hand. Archived to
`.bee/decisions-archive.jsonl`.

### `.bee/reservations.json`
File holds for same-checkout swarms. Shape:
`{reservations: [{agent, cell, path, ttl_seconds, reserved_at, released_at}]}`
(`released_at` null while held). Written via `reservations reserve/release/sweep`.
A write to a held path is refused with the holder named — do not write around it.

### `.bee/backlog.jsonl`
Event-sourced friction + PBI records. Event shapes include `proposal`
(`{ts, type, title, detail, predicted_impact, lane, source}`) and PBI lifecycle
events. Written via `backlog add/propose/pbi.*`. Rendered to `docs/backlog.md`
(generated — never hand-edited).

### `.bee/HANDOFF.json`
The pause/resume artifact — exists only while paused. Exactly one file, two `kind`s:

- **`pause`** — `{…, kind:'pause', written_at}`. Surfaced and **waited on**; never
  auto-resumed. A missing/unknown kind reads as `pause` (fail-safe).
- **`planned-next`** — requires `writer_session`, `previous_cell` (capped, verify
  green), `next_cell` (claimed by the same session). Adopted automatically **only**
  at a fresh-session boundary (`/clear` or fresh start) via `state handoff adopt`.

Written via `state handoff write/adopt/show`.

### `.bee/capture-queue.jsonl`
Deferred capture stubs awaiting their spec merge.
Shape: `{kind:'stub', id, at, outcome, dids[], area, files[], lane}`. Written via
`capture add`, drained via `capture flush`.

### Logs & caches (read-mostly)
- `.bee/logs/hooks.jsonl` — hook audit/crash log `{ts, hook, event, tool_name, tool_input_keys[]}`
- `.bee/logs/timings.jsonl` — per-invocation `{ts, cmd, ms, ok}`
- `.bee/logs/dispatch.jsonl`, `scribing-runs.jsonl`, `tools.jsonl` — stage traces
- `.bee/review-candidates.jsonl` — review queue for reviewing/compounding
- `.bee/feedback-digest.json` — feedback digest cache for evolving
- `.inject-cache.json` — session-preamble cache

## The CLI — how registers are mutated

Every register above is read/written through `node .bee/bin/bee.mjs <group> <verb>`.
The primary nine groups (per `AGENTS.md`) plus the utility groups the dispatcher
also exposes:

| Group | Verbs |
|-------|-------|
| `status` | *(single verb)* |
| `cells` | list · ready · show · add · update · claim · verify · cap · block · drop · unclaim · reopen · tier · judge · claim-next · reset-budget · judge-record · schedule · archive · unarchive |
| `reservations` | reserve · release · list · sweep |
| `decisions` | log · supersede · redact · active · search · archive · tag · render |
| `state` | set · gate · worker.* · scribing-run · start-feature · lanes · session.* · handoff.* · advisor-ref.* · compact-* |
| `backlog` | counts · rank · badges · add · propose · pbi.* · render · findings |
| `capture` | add · list · flush · count |
| `reviews` | create · list · show · record · candidate.add · candidates · status |
| `feedback` | digest · count · collect · rank |
| *utility* | `intent` · `knowledge` (check·index·list·context·promote) · `perf` · `worktree` (new·merge·…) · `herding` · `config` · `tmp` · `dispatch` · `recovery` |

Run `node .bee/bin/bee.mjs --help --json` for the full tool-schema-shaped manifest,
or `<group> --help --json` before a group's first use in a session.
