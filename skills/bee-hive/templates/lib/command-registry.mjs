// command-registry.mjs — the single source of truth for every subcommand the
// 4 existing helper CLIs (bee_status/cells/reservations/decisions.mjs) accept.
//
// D3 (harness-integration CONTEXT.md): each entry's `parameters` field is
// JSON-Schema in the exact shape Claude Code's own tool definitions use —
// {type:"object", properties, required} — never a bespoke shape. This is what
// makes the future `bee --help --json` manifest (harness-integration-2)
// zero-translation for any Claude-based agent.
//
// `helper` is dispatch metadata, not part of the public manifest shape: it
// names which of the 4 existing template scripts actually implements the
// command, for the subprocess-spawn delegation mechanism the validating
// phase settled on (bee.mjs never imports the 4 CLI files — each already
// runs its handler immediately on import against real argv/stdout/exitCode,
// so delegation is a `spawnSync` per call, keyed off this field). Cell 2's
// dispatcher strips `helper` when rendering the public `--help --json`
// manifest; only {name, invoke, description, parameters, examples,
// deprecated} are shown to agents there.
//
// `examples[]` are literal, runnable argument strings for the named `helper`
// script (not the future `bee <group> <action>` form) — the manifest-as-
// tested-contract discipline (every example is executed by
// tests/test_bee_cli.mjs and asserted not to error) only holds today against
// the real, already-shipped helpers; the unified dispatcher does not exist
// yet (that is harness-integration-2).

import { MODEL_TIERS } from './state.mjs';

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
    helper: 'bee_status.mjs',
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
    helper: 'bee_cells.mjs',
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
    helper: 'bee_cells.mjs',
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
    helper: 'bee_cells.mjs',
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
    helper: 'bee_cells.mjs',
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
    helper: 'bee_cells.mjs',
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
    helper: 'bee_cells.mjs',
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
    helper: 'bee_cells.mjs',
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
    helper: 'bee_cells.mjs',
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
    helper: 'bee_cells.mjs',
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
    helper: 'bee_cells.mjs',
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
    helper: 'bee_cells.mjs',
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
    helper: 'bee_cells.mjs',
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

  // ─── reservations (bee_reservations.mjs) ─────────────────────────────────
  {
    name: 'reservations.reserve',
    helper: 'bee_reservations.mjs',
    invoke: 'bee reservations reserve',
    description: 'Reserve a file or glob path for a cell. A conflicting active reservation held by another agent returns ok:false with the holder(s).',
    parameters: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Reservation identity making the request.' },
        cell: { type: 'string', description: 'Cell id the reservation is for.' },
        path: { type: 'string', description: 'File or directory path to reserve.' },
        ttl: { type: 'number', description: 'Time-to-live in seconds (default 3600).' },
        json: { type: 'boolean', description: 'Emit machine-readable JSON instead of a one-line confirmation.' },
      },
      required: ['agent', 'cell', 'path'],
    },
    examples: ['bee reservations reserve --agent worker-a --cell demo-1 --path src/example.ts --json'],
    deprecated: null,
  },
  {
    name: 'reservations.release',
    helper: 'bee_reservations.mjs',
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
    helper: 'bee_reservations.mjs',
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
    helper: 'bee_reservations.mjs',
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
    helper: 'bee_decisions.mjs',
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
    helper: 'bee_decisions.mjs',
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
    helper: 'bee_decisions.mjs',
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
    helper: 'bee_decisions.mjs',
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
    helper: 'bee_decisions.mjs',
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
];
