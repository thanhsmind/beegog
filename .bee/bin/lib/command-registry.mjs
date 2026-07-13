// command-registry.mjs — the single source of truth for every subcommand
// bee.mjs's dispatcher accepts, across all 9 groups (status, cells,
// reservations, decisions, state, backlog, capture, reviews, feedback).
//
// D3 (harness-integration CONTEXT.md): each entry's `parameters` field is
// JSON-Schema in the exact shape Claude Code's own tool definitions use —
// {type:"object", properties, required} — never a bespoke shape. This is what
// makes the `bee --help --json` manifest zero-translation for any
// Claude-based agent.
//
// The 9 bee_*.mjs shims that used to sit in front of this registry are
// retired (shim-retire D1/D5) — `bee.mjs <group> <verb>` is now the sole
// canonical and sole shipped CLI, so entries no longer carry an informational
// `helper` field naming a shim; only {name, invoke, description, parameters,
// examples, deprecated} make up an entry.
//
// `examples[]` are literal, runnable `bee <group> <verb> ...` argument
// strings — the manifest-as-tested-contract discipline (every example is
// executed by tests/test_bee_cli.mjs and asserted not to error) holds
// against the unified dispatcher and, via the shims, against every
// bee_*.mjs entrypoint too.

import { MODEL_TIERS, KNOWN_PHASES, GATE_NAMES, HANDOFF_KINDS } from './state.mjs';
import { REVIEW_MODES } from './reviews.mjs';

export const SCHEMA_VERSION = '1.0';

// Mirrors the status enum cells.mjs's addCell/claimCell/capCell/blockCell/
// dropCell transition between (open -> claimed -> capped, or -> blocked /
// dropped at any point). Not re-exported by cells.mjs today, so restated here
// deliberately narrow — this is the one place a future status rename would
// need to update alongside cells.mjs itself.
const CELL_STATUSES = ['open', 'claimed', 'capped', 'blocked', 'dropped'];

export const COMMAND_REGISTRY = [
  // ─── status (bee_status.mjs — no subcommand, flags only) ─────────────────
  {
    name: 'status',
    invoke: 'bee status',
    description:
      'Read-only snapshot: onboarding health, phase, gates, handoff, cell counts, reservations, decisions, staleness warnings, recommended next step.',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of the text report.' },
      },
      required: [],
    },
    examples: ['bee status --json'],
    deprecated: null,
  },

  // ─── cells (bee_cells.mjs) ────────────────────────────────────────────────
  {
    name: 'cells.list',
    invoke: 'bee cells list',
    description: 'List cells, optionally filtered by feature and/or status.',
    parameters: {
      type: 'object',
      properties: {
        feature: { type: 'string', description: 'Restrict to one feature slug.' },
        status: { type: 'string', description: 'Restrict to one status.', enum: CELL_STATUSES },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line-per-cell summary.' },
      },
      required: [],
    },
    examples: ['bee cells list --json'],
    deprecated: null,
  },
  {
    name: 'cells.ready',
    invoke: 'bee cells ready',
    description: 'List open cells whose deps are all capped — claimable right now.',
    parameters: {
      type: 'object',
      properties: {
        feature: { type: 'string', description: 'Restrict to one feature slug.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line-per-cell summary.' },
      },
      required: [],
    },
    examples: ['bee cells ready --json'],
    deprecated: null,
  },
  {
    name: 'cells.show',
    invoke: 'bee cells show',
    description: 'Show one cell by id, including its full trace.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Cell id, e.g. auth-3.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of pretty-printed JSON (show always prints JSON; flag kept for surface consistency).' },
      },
      required: ['id'],
    },
    examples: ['bee cells show --id demo-1 --json'],
    deprecated: null,
  },
  {
    name: 'cells.add',
    invoke: 'bee cells add',
    description:
      'Add a new cell from a JSON file or stdin. Exactly one of --file / --stdin is required at call time (both satisfy the schema; the handler itself enforces the choice).',
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Path to a cell JSON file. Required unless --stdin is set.' },
        stdin: { type: 'boolean', description: 'Read the cell JSON from stdin instead of --file.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee cells add --file cell-demo-1.json --json'],
    deprecated: null,
  },
  {
    name: 'cells.update',
    invoke: 'bee cells update',
    description:
      'Door-validated in-place revision for validation-repair loops: only open|blocked cells are updatable. Plan fields only (title/action/verify/files/read_first/deps/decisions/must_haves/behavior_change/lane/pbi); frozen keys (id/feature/status/trace/tier) and any unknown key refuse the whole patch untouched. Exactly one of --file / --stdin is required at call time (both satisfy the schema; the handler itself enforces the choice).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Cell id to update.' },
        file: { type: 'string', description: 'Path to a patch JSON file. Required unless --stdin is set.' },
        stdin: { type: 'boolean', description: 'Read the patch JSON from stdin instead of --file.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['id'],
    },
    examples: ['bee cells update --id demo-1 --file cell-demo-1-update.json --json'],
    deprecated: null,
  },
  {
    name: 'cells.claim',
    invoke: 'bee cells claim',
    description: 'Claim an open, dep-free cell for a worker. Refuses while Gate 3 (execution) is unapproved or deps are uncapped.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Cell id to claim.' },
        worker: { type: 'string', description: 'Reservation identity of the claiming worker.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['id', 'worker'],
    },
    examples: ['bee cells claim --id demo-1 --worker worker-a --json'],
    deprecated: null,
  },
  {
    name: 'cells.verify',
    invoke: 'bee cells verify',
    description: "Record a verify run's command, output, and pass/fail for a cell — the proof `cap` later requires.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Cell id.' },
        command: { type: 'string', description: 'The exact verify command that was run.' },
        passed: { type: 'boolean', description: 'Whether the verify run passed ("true" or "false").' },
        output: { type: 'string', description: 'What the verify command printed (inline). Mutually exclusive with --output-file.' },
        'output-file': { type: 'string', description: 'Path to a file holding the verify command\'s output, for long output.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['id', 'command', 'passed'],
    },
    examples: ['bee cells verify --id demo-1 --command "manual check" --output "0 failing" --passed true --json'],
    deprecated: null,
  },
  {
    name: 'cells.cap',
    invoke: 'bee cells cap',
    description: 'Cap a cell — refuses without a recorded passing verify (and, for small+ lanes, recorded output/evidence plus non-empty files_changed).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Cell id, e.g. auth-3.' },
        outcome: { type: 'string', description: 'One-line outcome summary.' },
        files: { type: 'string', description: 'Comma-separated list of files the worker changed.' },
        'behavior-change': { type: 'boolean', description: 'Force behavior_change true (a cell-declared true cannot be unset by omitting this flag).' },
        'evidence-stdin': { type: 'boolean', description: 'Read verification_evidence JSON from stdin (preferred — no evidence file is persisted).' },
        'evidence-file': { type: 'string', description: 'Path to a verification_evidence JSON file (back-compat; prefer --evidence-stdin).' },
        'deviations-file': { type: 'string', description: 'Path to a deviations list (JSON array or newline-delimited text).' },
        friction: { type: 'string', description: 'One-line friction note, only when a friction trigger fired.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['id'],
    },
    examples: ['bee cells cap --id demo-1 --outcome "demo cell capped" --files cell-demo-1.json --json'],
    deprecated: null,
  },
  {
    name: 'cells.block',
    invoke: 'bee cells block',
    description: 'Mark a cell blocked with a reason.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Cell id.' },
        reason: { type: 'string', description: 'Why the cell is blocked.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['id', 'reason'],
    },
    examples: ['bee cells block --id demo-1 --reason "test block" --json'],
    deprecated: null,
  },
  {
    name: 'cells.drop',
    invoke: 'bee cells drop',
    description: 'Mark a cell dropped with a reason.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Cell id.' },
        reason: { type: 'string', description: 'Why the cell was dropped.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['id', 'reason'],
    },
    examples: ['bee cells drop --id demo-1 --reason "test drop" --json'],
    deprecated: null,
  },
  {
    name: 'cells.tier',
    invoke: 'bee cells tier',
    description: "Record the orchestrator's dispatch-time model-tier judgment for a cell.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Cell id.' },
        tier: { type: 'string', description: 'Model tier chosen at dispatch.', enum: [...MODEL_TIERS] },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['id', 'tier'],
    },
    examples: ['bee cells tier --id demo-1 --tier generation --json'],
    deprecated: null,
  },
  {
    name: 'cells.judge',
    invoke: 'bee cells judge',
    description: "Frozen-judge check: flags test/CI/lockfile files changed outside the cell's declared file scope.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Cell id.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line verdict.' },
      },
      required: ['id'],
    },
    examples: ['bee cells judge --id demo-1 --json'],
    deprecated: null,
  },
  {
    name: 'cells.claim-next',
    invoke: 'bee cells claim-next',
    description:
      "Cross-session selection + claim (fresh-session-handoff fsh-11, D2/D4): sweeps stale claims (TTL expired AND heartbeat stale) in-pass first — this IS sweepExpiredClaims's production trigger — then picks the next open cell to claim: the acting session's own bound lane (or the default pipeline when unbound) first, ONLY when its execution gate is approved; empty or unapproved falls back to every OTHER pipeline whose OWN execution gate is approved (an unapproved lane is never touched), ordered by backlog rank then lane created_at. Cells whose files intersect another session's active reservation hold are skipped (the acting session's own holds never exclude a cell). Claims via the two-store sequence (claims.mjs claimCellFile then cells.mjs claimCell, unwound with a claim-file release on any claimCell throw). Refuses (non-zero exit) when nothing is claimable (NO_APPROVED_WORK), the claims-store race is lost (CLAIMED), or the session's lane binding is broken (LANE_INVALID/LANE_MISSING/LANE_CORRUPT).",
    parameters: {
      type: 'object',
      properties: {
        worker: { type: 'string', description: 'Reservation identity of the claiming worker.' },
        'session-id': { type: 'string', description: "Acting session's cross-session identity (claims.mjs) — resolves its bound lane, if any." },
        ttl: { type: 'number', description: 'Claim TTL in seconds (default 3600).' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['worker', 'session-id'],
    },
    examples: ['bee cells claim-next --worker worker-a --session-id sess-claim-next --json'],
    deprecated: null,
  },

  // ─── reservations (bee_reservations.mjs) ─────────────────────────────────
  {
    name: 'reservations.reserve',
    invoke: 'bee reservations reserve',
    description: "Reserve a file or glob path for a cell. A conflicting active reservation held by another agent returns ok:false with the holder(s). Optional --session (fresh-session-handoff D3) stamps the reservation as owned by that cross-session identity, so the write guard's hold check (checkWrite) can deny another live session's write into the same path — a reservation made without --session keeps today's exact intra-swarm-only semantics.",
    parameters: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Reservation identity making the request.' },
        cell: { type: 'string', description: 'Cell id the reservation is for.' },
        path: { type: 'string', description: 'File or directory path to reserve.' },
        ttl: { type: 'number', description: 'Time-to-live in seconds (default 3600).' },
        session: { type: 'string', description: 'Owning cross-session identity (D3 hold). Omit to keep an intra-swarm-only reservation with no cross-session hold effect.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['agent', 'cell', 'path'],
    },
    examples: [
      'bee reservations reserve --agent worker-a --cell demo-1 --path src/example.ts --json',
      'bee reservations reserve --agent worker-a --cell demo-1 --path src/example-session.ts --session sess-fsh7 --json',
    ],
    deprecated: null,
  },
  {
    name: 'reservations.release',
    invoke: 'bee reservations release',
    description: "Release an agent's reservations, optionally scoped to one cell.",
    parameters: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Reservation identity releasing its holds.' },
        cell: { type: 'string', description: 'Restrict release to reservations for this cell id.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['agent'],
    },
    examples: ['bee reservations release --agent worker-a --cell demo-1 --json'],
    deprecated: null,
  },
  {
    name: 'reservations.list',
    invoke: 'bee reservations list',
    description: 'List reservations, optionally active-only.',
    parameters: {
      type: 'object',
      properties: {
        'active-only': { type: 'boolean', description: 'Only list reservations not released and not TTL-expired.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line-per-reservation summary.' },
      },
      required: [],
    },
    examples: ['bee reservations list --active-only --json'],
    deprecated: null,
  },
  {
    name: 'reservations.sweep',
    invoke: 'bee reservations sweep',
    description: 'Release every TTL-expired reservation that was never explicitly released.',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee reservations sweep --json'],
    deprecated: null,
  },

  // ─── decisions (bee_decisions.mjs) ───────────────────────────────────────
  {
    name: 'decisions.log',
    invoke: 'bee decisions log',
    description: 'Append a decision event to the append-only decision log. Rejects secret-shaped or instruction-like content.',
    parameters: {
      type: 'object',
      properties: {
        decision: { type: 'string', description: 'The decision text.' },
        rationale: { type: 'string', description: 'Why this decision was made.' },
        alternatives: { type: 'string', description: 'Alternatives considered, if any.' },
        scope: { type: 'string', description: 'Decision scope (default "repo").' },
        source: { type: 'string', description: 'Who/what decided (default "user").' },
        confidence: { type: 'number', description: 'Confidence, 0-100.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['decision', 'rationale'],
    },
    examples: [
      'bee decisions log --decision "Use in-repo registry for CLI commands" --rationale "Avoid duplicated validation logic across dispatcher and hook" --json',
    ],
    deprecated: null,
  },
  {
    name: 'decisions.supersede',
    invoke: 'bee decisions supersede',
    description: 'Replace an earlier decision with a new one; the earlier decision drops out of the active set.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Id of the decision being superseded.' },
        decision: { type: 'string', description: 'The replacement decision text.' },
        rationale: { type: 'string', description: 'Why the replacement supersedes the original.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['id', 'decision', 'rationale'],
    },
    examples: [
      'bee decisions supersede --id 00000000-0000-0000-0000-000000000000 --decision "Superseding decision" --rationale "Updated approach" --json',
    ],
    deprecated: null,
  },
  {
    name: 'decisions.redact',
    invoke: 'bee decisions redact',
    description: 'Redact a decision from the active set with a reason (the event stays in the log; only its active status changes).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Id of the decision being redacted.' },
        reason: { type: 'string', description: 'Why the decision was redacted.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['id', 'reason'],
    },
    examples: ['bee decisions redact --id 00000000-0000-0000-0000-000000000000 --reason "test redaction" --json'],
    deprecated: null,
  },
  {
    name: 'decisions.active',
    invoke: 'bee decisions active',
    description: 'List active (non-superseded, non-redacted) decisions, newest first.',
    parameters: {
      type: 'object',
      properties: {
        recent: { type: 'number', description: 'Return only the N most recent active decisions.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a formatted list.' },
      },
      required: [],
    },
    examples: ['bee decisions active --recent 5 --json'],
    deprecated: null,
  },
  {
    name: 'decisions.search',
    invoke: 'bee decisions search',
    description: 'Search active decisions by substring match across decision/rationale/alternatives.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Substring to search for (case-insensitive).' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a formatted list.' },
      },
      required: ['text'],
    },
    examples: ['bee decisions search --text "registry" --json'],
    deprecated: null,
  },

  // ─── state (bee_state.mjs — .bee/state.json mutation verbs) ───────────────
  // Nested worker verbs use a 3-segment name (state.worker.add) resolved by
  // the dispatcher's longest-prefix match; every other verb is 2-segment.
  //
  // `required: []` on every state entry is deliberate (DB3): the generic
  // validate() layer emits a structured error on STDOUT, but the legacy
  // bee_state.mjs contract (pinned by test_lib.mjs) emits missing-flag / bad-
  // value errors on STDERR. So each state handler owns its own required-flag
  // and enum checks (requireFlag / requireBoolFlag / MODEL_TIERS / GATE_NAMES),
  // throwing the legacy message text — which the dispatcher routes to STDERR —
  // rather than letting validate() preempt it onto STDOUT. Types stay 'string'
  // for the same reason (a bad --approved must reach the handler, not validate).
  {
    name: 'state.set',
    invoke: 'bee state set',
    description:
      'Set one or more top-level state fields; only the flags given are written and every other field is preserved. --phase is validated against the known-phase enum (including the terminal alias compounding-complete). Optional --lane <feature> (fresh-session-handoff D2/D4) routes the mutation to that per-feature lane record (.bee/lanes/<feature>.json, via readLaneStrict) instead of the default state.json; a missing or corrupt lane refuses loudly with zero writes. --feature is rejected when --lane is given (a lane\'s feature is its identity/filename, not a mutable field).',
    parameters: {
      type: 'object',
      properties: {
        phase: { type: 'string', description: 'Workflow phase to set.', enum: [...KNOWN_PHASES] },
        mode: { type: 'string', description: 'Mode to set.' },
        feature: { type: 'string', description: 'Feature slug to set. Rejected together with --lane.' },
        'next-action': { type: 'string', description: 'Top-level next_action string.' },
        summary: { type: 'string', description: 'Session summary string.' },
        lane: { type: 'string', description: 'Route the mutation to this lane record instead of the default state.json. Refuses if the lane is missing or corrupt.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: [
      'bee state set --phase planning --json',
      'bee state set --lane demo-lane --phase planning --json',
    ],
    deprecated: null,
  },
  {
    name: 'state.gate',
    invoke: 'bee state gate',
    description: 'Approve or unapprove a named gate. Idempotent: the same call run twice yields an identical file. Optional --lane <feature> (D2/D4) routes the gate mutation to that lane record instead of the default state.json; a missing or corrupt lane refuses loudly with zero writes.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Gate name.', enum: [...GATE_NAMES] },
        approved: { type: 'string', description: 'Whether the gate is approved ("true" or "false").' },
        lane: { type: 'string', description: 'Route the mutation to this lane record instead of the default state.json. Refuses if the lane is missing or corrupt.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: [
      'bee state gate --name execution --approved true --json',
      'bee state gate --lane demo-lane --name execution --approved true --json',
    ],
    deprecated: null,
  },
  {
    name: 'state.worker.add',
    invoke: 'bee state worker add',
    description: 'Append a worker entry (nickname + cell, optional tier/status) to state.workers.',
    parameters: {
      type: 'object',
      properties: {
        nickname: { type: 'string', description: 'Worker nickname.' },
        cell: { type: 'string', description: 'Cell id the worker is assigned.' },
        tier: { type: 'string', description: 'Model tier chosen at dispatch.', enum: [...MODEL_TIERS] },
        status: { type: 'string', description: 'Worker status.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee state worker add --nickname w1 --cell c1 --json'],
    deprecated: null,
  },
  {
    name: 'state.worker.update',
    invoke: 'bee state worker update',
    description: 'Merge the given fields onto an existing worker entry found by nickname.',
    parameters: {
      type: 'object',
      properties: {
        nickname: { type: 'string', description: 'Worker nickname to update.' },
        cell: { type: 'string', description: 'New cell id.' },
        tier: { type: 'string', description: 'New model tier.', enum: [...MODEL_TIERS] },
        status: { type: 'string', description: 'New worker status.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee state worker update --nickname w1 --status done --json'],
    deprecated: null,
  },
  {
    name: 'state.worker.remove',
    invoke: 'bee state worker remove',
    description: 'Drop the worker entry matching the given nickname.',
    parameters: {
      type: 'object',
      properties: {
        nickname: { type: 'string', description: 'Worker nickname to remove.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee state worker remove --nickname w1 --json'],
    deprecated: null,
  },
  {
    name: 'state.worker.clear',
    invoke: 'bee state worker clear',
    description: 'Empty the whole state.workers array.',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee state worker clear --json'],
    deprecated: null,
  },
  {
    name: 'state.worker.prune',
    invoke: 'bee state worker prune',
    description: 'Delete stale dispatch transients from .bee/workers/ (keeps active-worker and non-capped-cell files). Reads state via readStateStrict and never writes state.json.',
    parameters: {
      type: 'object',
      properties: {
        'dry-run': { type: 'boolean', description: 'Report the candidate set without deleting anything.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee state worker prune --json'],
    deprecated: null,
  },
  {
    name: 'state.scribing-run',
    invoke: 'bee state scribing-run',
    description: 'Stamp last_scribing_run (date + ISO-precise at), mirror --next-action to the top-level next_action, and advance phase to compounding. Optional --lane <feature> (D2/D4) routes the stamp to that lane record instead of the default state.json; a missing or corrupt lane refuses loudly with zero writes.',
    parameters: {
      type: 'object',
      properties: {
        feature: { type: 'string', description: 'Feature slug the scribing run covers.' },
        areas: { type: 'string', description: 'Comma-separated areas synced.' },
        'next-action': { type: 'string', description: 'Next action after scribing.' },
        lane: { type: 'string', description: 'Route the mutation to this lane record instead of the default state.json. Refuses if the lane is missing or corrupt.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: [
      'bee state scribing-run --feature demo --areas auth --next-action bee-compounding --json',
      'bee state scribing-run --lane demo-lane --feature demo-lane --areas auth --next-action bee-compounding --json',
    ],
    deprecated: null,
  },
  {
    name: 'state.start-feature',
    invoke: 'bee state start-feature',
    description: 'Guarded atomic feature start: fails closed with zero mutations unless the workspace is clean (idle/terminal phase, no handoff/workers/reservations/claimed or nonterminal prior cells); on success sets feature/mode/phase and resets all four gates. Optional --as-lane (D2/D4) starts the feature as a per-feature lane record (.bee/lanes/<feature>.json) beside the default pipeline instead of mutating state.json; --session-id names the calling session so its own active holds never count against the declared-paths check; --paths is a comma-separated list of intended file paths checked against other sessions\' active claims/reservations before the lane starts.',
    parameters: {
      type: 'object',
      properties: {
        feature: { type: 'string', description: 'New feature slug.' },
        mode: { type: 'string', description: 'Mode for the new feature.' },
        phase: { type: 'string', description: 'Entry phase (defaults to exploring).', enum: [...KNOWN_PHASES] },
        'as-lane': { type: 'boolean', description: 'Start this feature as a per-feature lane record instead of the default state.json.' },
        'session-id': { type: 'string', description: 'Calling session id, so its own active holds never count as a conflict in the declared-paths check (only meaningful with --as-lane).' },
        paths: { type: 'string', description: 'Comma-separated declared file paths checked against other sessions\' active claims/reservations before the lane starts (only meaningful with --as-lane).' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: [
      'bee state start-feature --feature newf --json',
      'bee state start-feature --feature demo-lane --as-lane --json',
    ],
    deprecated: null,
  },
  {
    name: 'state.lanes',
    invoke: 'bee state lanes',
    description: 'List every per-feature lane record (D2/D4) with its phase, gates, and which sessions are currently bound to it.',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line-per-lane summary.' },
      },
      required: [],
    },
    examples: ['bee state lanes --json'],
    deprecated: null,
  },
  {
    name: 'state.session.list',
    invoke: 'bee state session list',
    description: 'List every session record (id, started_at, last_heartbeat, bound lane if any) — the cross-session identities lane claims key off (fresh-session-handoff fsh-1/fsh-3).',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line-per-session summary.' },
      },
      required: [],
    },
    examples: ['bee state session list --json'],
    deprecated: null,
  },
  {
    name: 'state.session.bind',
    invoke: 'bee state session bind',
    description: "Bind a session to a lane (session→lane binding, D2/D4) so pipeline reads/writes for that session resolve to the named lane instead of the default state.json (resolvePipeline). Does not verify the lane record exists — a binding to a missing/invalid lane is a typed refusal at resolution time, not at bind time.",
    parameters: {
      type: 'object',
      properties: {
        'session-id': { type: 'string', description: 'Session id to bind.' },
        lane: { type: 'string', description: 'Lane feature name to bind the session to.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee state session bind --session-id sess-demo --lane demo-lane --json'],
    deprecated: null,
  },
  {
    name: 'state.session.unbind',
    invoke: 'bee state session unbind',
    description: "Remove a session's lane binding (omits the key entirely, restoring the unbound shape) so the session resolves back to the default pipeline.",
    parameters: {
      type: 'object',
      properties: {
        'session-id': { type: 'string', description: 'Session id to unbind.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee state session unbind --session-id sess-demo --json'],
    deprecated: null,
  },
  {
    name: 'state.handoff.write',
    invoke: 'bee state handoff write',
    description: "Write .bee/HANDOFF.json through the guarded writer (fresh-session-handoff fsh-9, D1). --kind is required and never guessed: 'pause' writes today's free-form fields (--cell/--files/--done/--remaining/--next-action/--feature/--phase/--mode, whichever apply) plus the kind — no new precondition, the same surface-and-wait record as always. 'planned-next' REFUSES (typed, zero mutation) unless --previous-cell is capped with a passing verify AND --next-cell already has a claim owned by --writer-session (the carried claim) — on success the record stores writer_session/previous_cell/next_cell alongside kind.",
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', description: 'Handoff kind — required, never guessed.', enum: [...HANDOFF_KINDS] },
        'writer-session': { type: 'string', description: 'planned-next only: the writing session id, which must already own the claim on --next-cell.' },
        'previous-cell': { type: 'string', description: 'planned-next only: the just-capped cell id (must be capped with trace.verify_passed true).' },
        'next-cell': { type: 'string', description: "planned-next only: the next cell id, whose claim must already be owned by --writer-session." },
        cell: { type: 'string', description: 'pause only: the cell mid-flight when the pause was written.' },
        files: { type: 'string', description: 'pause only: comma-separated files touched so far.' },
        done: { type: 'string', description: 'pause only: comma-separated completed steps.' },
        remaining: { type: 'string', description: 'pause only: comma-separated remaining steps.' },
        feature: { type: 'string', description: 'Feature slug to record on the handoff.' },
        phase: { type: 'string', description: 'Phase to record on the handoff.' },
        mode: { type: 'string', description: 'Mode to record on the handoff.' },
        'next-action': { type: 'string', description: 'Saved next-action text.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['kind'],
    },
    examples: [
      'bee state handoff write --kind pause --cell wip-1 --next-action "resume wip-1" --json',
      'bee state handoff write --kind planned-next --writer-session sess-handoff-writer --previous-cell handoff-prev --next-cell handoff-next --json',
    ],
    deprecated: null,
  },
  {
    name: 'state.handoff.adopt',
    invoke: 'bee state handoff adopt',
    description: "Adopt a planned-next handoff's carried claim into --session-id (fresh-session-handoff fsh-9, D1): transfers ownership of the handoff's next_cell claim to the adopting session, then clears .bee/HANDOFF.json — clear-after-adopt with idempotent recovery, not a single cross-file transaction (a crash between the two steps self-heals on the next call via a benign self-adopt). Refuses (typed, non-zero exit) when there is no handoff, the handoff is not kind planned-next (pause handoffs are never adopted — surface and wait instead), or the underlying claim adopt fails — every refusal leaves both the claim and the handoff untouched.",
    parameters: {
      type: 'object',
      properties: {
        'session-id': { type: 'string', description: 'Adopting session id.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['session-id'],
    },
    examples: ['bee state handoff adopt --session-id sess-handoff-adopter --json'],
    deprecated: null,
  },
  {
    name: 'state.handoff.show',
    invoke: 'bee state handoff show',
    description: 'Show the current .bee/HANDOFF.json, if any, with kind normalized for display (a missing/unknown kind reads as "pause" — fail-safe, D1). Reports "no handoff" when none exists.',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line summary.' },
      },
      required: [],
    },
    examples: ['bee state handoff show --json'],
    deprecated: null,
  },

  // ─── backlog (bee_backlog.mjs — docs/backlog.md mechanical passes + the
  // .bee/backlog.jsonl `add` verb). `required: []` on `backlog.add` is
  // deliberate (DB3, same discipline as the state.* entries above): the
  // generic validate() layer would emit its structured error on STDOUT, but
  // the legacy bee_backlog.mjs `add` contract (pinned by test_lib.mjs) emits
  // its validation refusals on STDERR. So the handler owns every required-
  // flag / enum / length check itself, throwing the legacy message text —
  // which the dispatcher routes to STDERR. ─────────────────────────────────
  {
    name: 'backlog.counts',
    invoke: 'bee backlog counts',
    description: 'Render PBI backlog counts (done/in-flight/proposed/total) parsed from docs/backlog.md.',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line summary.' },
      },
      required: [],
    },
    examples: ['bee backlog counts --json'],
    deprecated: null,
  },
  {
    name: 'backlog.rank',
    invoke: 'bee backlog rank',
    description: 'P2 mechanical pass: reorder docs/backlog.md rows by status group (in-flight, proposed, done). Reports the resulting order; --write persists it, otherwise nothing is changed.',
    parameters: {
      type: 'object',
      properties: {
        write: { type: 'boolean', description: 'Persist the reordering to docs/backlog.md.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line summary.' },
      },
      required: [],
    },
    examples: ['bee backlog rank --json'],
    deprecated: null,
  },
  {
    name: 'backlog.badges',
    invoke: 'bee backlog badges',
    description: "P3 mechanical pass: refresh README.md's backlog badges from docs/backlog.md counts. --write persists, otherwise nothing is changed.",
    parameters: {
      type: 'object',
      properties: {
        write: { type: 'boolean', description: 'Persist the refreshed badges to README.md.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line summary.' },
      },
      required: [],
    },
    examples: ['bee backlog badges --json'],
    deprecated: null,
  },
  {
    name: 'backlog.add',
    invoke: 'bee backlog add',
    description:
      'Validate then append one row to .bee/backlog.jsonl (the feedback-digest source lib/feedback.mjs\'s collectFeedback reads) — agents never hand-edit .bee state. --type must be a KIND_ALIASES key or an already-normalized NORMALIZED_KINDS value (lib/feedback.mjs), --severity is P1|P2|P3, --layer is a free non-empty string <=40 chars (no allowlist), --title is required and <=200 chars. Any rejection leaves the file untouched.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Backlog row type (a KIND_ALIASES key or an already-normalized NORMALIZED_KINDS value).' },
        title: { type: 'string', description: 'Row title, <=200 chars.' },
        severity: { type: 'string', description: 'Row severity.', enum: ['P1', 'P2', 'P3'] },
        layer: { type: 'string', description: 'Free non-empty layer string, <=40 chars.' },
        detail: { type: 'string', description: 'Optional detail text.' },
        feature: { type: 'string', description: 'Optional feature slug.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee backlog add --type friction --title "example backlog row" --severity P2 --layer state --json'],
    deprecated: null,
  },

  // ─── capture (bee_capture.mjs — the capture-queue CLI, decision 0017) ─────
  {
    name: 'capture.add',
    invoke: 'bee capture add',
    description: 'Append a capture-queue stub for a same-turn settlement (decision 0017); the full BA-grade spec merge happens later at flush. High-risk lane never queues.',
    parameters: {
      type: 'object',
      properties: {
        outcome: { type: 'string', description: 'Outcome text for the stub.' },
        did: { type: 'string', description: 'Comma-separated decision ids the settlement relates to.' },
        area: { type: 'string', description: 'Spec area the stub belongs to.' },
        files: { type: 'string', description: 'Comma-separated list of files touched.' },
        lane: { type: 'string', description: 'Lane the settlement ran at (high-risk never queues).' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee capture add --outcome "example capture stub outcome" --json'],
    deprecated: null,
  },
  {
    name: 'capture.list',
    invoke: 'bee capture list',
    description: 'List pending (not yet flushed) capture stubs, oldest first.',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a formatted list.' },
      },
      required: [],
    },
    examples: ['bee capture list --json'],
    deprecated: null,
  },
  {
    name: 'capture.flush',
    invoke: 'bee capture flush',
    description: 'Mark a pending capture stub flushed (its content merged into a spec by bee-scribing). Refuses when the id names no pending stub.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stub id to flush.' },
        into: { type: 'string', description: 'Where the stub content landed, e.g. docs/specs/<area>.md.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee capture flush --id 00000000-0000-0000-0000-000000000000 --json'],
    deprecated: null,
  },
  {
    name: 'capture.count',
    invoke: 'bee capture count',
    description: 'Report the pending capture-stub count.',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee capture count --json'],
    deprecated: null,
  },

  // ─── reviews (bee_reviews.mjs — review-session store + candidates ledger,
  // dispatcher-unify du-3). `reviews.candidate.add` is a NESTED 3-segment
  // name resolved by the dispatcher's longest-prefix match (du-1), sitting
  // alongside the separate FLAT `reviews.candidates` verb (bee_reviews.mjs
  // :186-207/199-207) — two distinct verbs, both pinned. `required: []` on
  // every reviews entry is deliberate (DB3, same discipline as state.*/
  // backlog.*): the generic validate() layer would emit its structured error
  // on STDOUT, but the legacy bee_reviews.mjs contract (pinned by
  // test_lib.mjs) emits its validation refusals on STDERR. So each handler
  // owns its own required-flag / enum checks, throwing the legacy message
  // text — which the dispatcher routes to STDERR. ─────────────────────────
  {
    name: 'reviews.create',
    invoke: 'bee reviews create',
    description:
      'Freeze a review scope (R5) into .bee/reviews/<id>.json. Runs the A10 verification-evidence preflight and A6 in-progress auto-exclusion BEFORE any write; fails closed with zero files written on missing evidence or an id that already exists (ids are never reused). Exactly one of --file / --stdin is required at call time (both satisfy the schema; the handler itself enforces the choice, same discipline as cells.add).',
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Path to a scope JSON file (id, requested_by, scope_description, included, excluded?, baseline, head). Required unless --stdin is set.' },
        stdin: { type: 'boolean', description: 'Read the scope JSON from stdin instead of --file.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee reviews create --file scope.json --json'],
    deprecated: null,
  },
  {
    name: 'reviews.list',
    invoke: 'bee reviews list',
    description: 'List every review session, one line per session (id, decision status, scope description).',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line-per-session summary.' },
      },
      required: [],
    },
    examples: ['bee reviews list --json'],
    deprecated: null,
  },
  {
    name: 'reviews.show',
    invoke: 'bee reviews show',
    description: 'Show one review session by id, full contents.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Review session id.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of pretty-printed JSON (show always prints JSON; flag kept for surface consistency).' },
      },
      required: [],
    },
    examples: ['bee reviews show --id rev-example --json'],
    deprecated: null,
  },
  {
    name: 'reviews.record',
    invoke: 'bee reviews record',
    description:
      'Set or append a sub-record on an existing session: manifest/preflight/decision SET the field, finding/uat APPEND one entry per call. Refuses any payload touching baseline/head/included/excluded — those are frozen at create (R5). Exactly one of --file / --stdin is required at call time (both satisfy the schema; the handler itself enforces the choice).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Review session id.' },
        kind: { type: 'string', description: 'Sub-record kind.', enum: ['manifest', 'preflight', 'finding', 'uat', 'decision'] },
        file: { type: 'string', description: 'Path to the payload JSON file. Required unless --stdin is set.' },
        stdin: { type: 'boolean', description: 'Read the payload JSON from stdin instead of --file.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee reviews record --id rev-example --kind finding --file finding.json --json'],
    deprecated: null,
  },
  {
    name: 'reviews.candidate.add',
    invoke: 'bee reviews candidate add',
    description:
      "Append one entry to .bee/review-candidates.jsonl for a closing feature. --mode is required and must be the closing feature's lane.",
    parameters: {
      type: 'object',
      properties: {
        feature: { type: 'string', description: 'Closing feature slug.' },
        head: { type: 'string', description: 'Head commit sha.' },
        mode: { type: 'string', description: "The closing feature's lane.", enum: [...REVIEW_MODES] },
        baseline: { type: 'string', description: 'Optional baseline commit sha.' },
        cells: { type: 'string', description: 'Optional comma-separated cell ids covered by this candidate.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: [],
    },
    examples: ['bee reviews candidate add --feature demo3 --head sha1 --mode standard --json'],
    deprecated: null,
  },
  {
    name: 'reviews.candidates',
    invoke: 'bee reviews candidates',
    description: 'List every review-candidate ledger entry (append-only, one per feature close), oldest first.',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line-per-entry summary.' },
      },
      required: [],
    },
    examples: ['bee reviews candidates --json'],
    deprecated: null,
  },
  {
    name: 'reviews.status',
    invoke: 'bee reviews status',
    description:
      'Derived coverage summary (R10 — status is never stored): verified count plus the four coverage labels unreviewed/in review/reviewed/review stale, one line per candidate. A candidate reviewed by an unchanged approved session reports "reviewed (covered by <review-id>)" (A7).',
    parameters: {
      type: 'object',
      properties: {
        feature: { type: 'string', description: 'Restrict to one feature slug.' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a formatted summary.' },
      },
      required: [],
    },
    examples: ['bee reviews status --json'],
    deprecated: null,
  },

  // ─── feedback (bee_feedback.mjs — the dogfood feedback digest CLI, P18,
  // dispatcher-unify du-3). NO collection, redaction, or pain logic lives in
  // the dispatcher — that all lives in lib/feedback.mjs. ───────────────────
  {
    name: 'feedback.digest',
    invoke: 'bee feedback digest',
    description: 'Build the allowlist feedback digest (P18) and write it to disk (default .bee/feedback-digest.json).',
    parameters: {
      type: 'object',
      properties: {
        out: { type: 'string', description: 'Output path, relative to repo root (default .bee/feedback-digest.json).' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line summary.' },
      },
      required: [],
    },
    examples: ['bee feedback digest --json'],
    deprecated: null,
  },
  {
    name: 'feedback.count',
    invoke: 'bee feedback count',
    description: 'Report the local feedback digest counts without writing anything to disk.',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line summary.' },
      },
      required: [],
    },
    examples: ['bee feedback count --json'],
    deprecated: null,
  },
  {
    name: 'feedback.collect',
    invoke: 'bee feedback collect',
    description:
      "Merge the local digest with every configured dogfood repo's already-written digest (D2b — the consumer revalidates every foreign entry). With no dogfood_repos configured, returns the local digest only.",
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line summary.' },
      },
      required: [],
    },
    examples: ['bee feedback collect --json'],
    deprecated: null,
  },
  {
    name: 'feedback.rank',
    invoke: 'bee feedback rank',
    description: 'Cluster the merged digest view by normalized title and rank clusters by pain x frequency x corroboration, descending.',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line summary.' },
      },
      required: [],
    },
    examples: ['bee feedback rank --json'],
    deprecated: null,
  },
];
