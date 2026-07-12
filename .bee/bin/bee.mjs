#!/usr/bin/env node
// bee.mjs — unified CLI dispatcher (harness-integration Phase 1, D2/D3/D5).
//
// D5 (locked, CONTEXT.md + this cell's own action): this dispatcher imports
// the SAME lib/*.mjs functions the 4 existing entrypoints (bee_status.mjs,
// bee_cells.mjs, bee_reservations.mjs, bee_decisions.mjs) already import —
// it never imports, spawns, or edits those 4 files. Each handler below
// reimplements that file's own run()/render logic against the shared lib
// functions so `bee <group> <action>` output is byte-identical to invoking
// the original helper directly (verified by tests/test_bee_cli.mjs).
//
// Note on command-registry.mjs's header comment (informational, not a bug in
// this file): it describes an earlier "spawnSync the helper script" delegation
// idea that predates the CORRECTED MECHANISM recorded in CONTEXT.md's D5 and
// in this cell's own action text (both authoritative, both say "import lib
// functions directly"). That comment is stale documentation in an already-
// capped cell (harness-integration-1) — out of this cell's file scope to fix,
// noted here so a future reader is not misled by it.
//
// Usage:
//   bee status [--json]
//   bee cells <list|ready|show|add|claim|verify|cap|block|drop|tier|judge> ... [--json]
//   bee reservations <reserve|release|list|sweep> ... [--json]
//   bee decisions <log|supersede|redact|active|search> ... [--json]
//   bee --help [--json]
//
// D3: `bee --help --json` emits {schema_version, commands:[{name, invoke,
// description, parameters, examples, deprecated}]} — the same JSON-Schema
// tool-definition shape Claude Code's own tool/subagent surface uses.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

import {
  findRepoRoot,
  readConfig,
  readState,
  readHandoff,
  readOnboarding,
  BEE_VERSION,
  COMMAND_KEYS,
  GATE_NAMES,
  PHASES,
  isKnownPhase,
} from './lib/state.mjs';
import {
  listCells,
  readyCells,
  readCell,
  addCell,
  claimCell,
  recordVerify,
  capCell,
  blockCell,
  dropCell,
  setTier,
  judgeCell,
  scribingDebt,
  tierMix,
  ceilingScarcityWarning,
} from './lib/cells.mjs';
import { reserve, release, listReservations, sweepExpired } from './lib/reservations.mjs';
import { logDecision, supersedeDecision, redactDecision, activeDecisions, datamark } from './lib/decisions.mjs';
import { captureQueue } from './lib/capture.mjs';
import { readBacklogCounts } from './lib/backlog.mjs';
import { readJson, writeJsonAtomic } from './lib/fsutil.mjs';
import { SCHEMA_VERSION, COMMAND_REGISTRY } from './lib/command-registry.mjs';
import { validate } from './lib/validate-args.mjs';

// ─── shared small helpers (mirrors requireFlag/readFileText across all 4) ──

function requireFlag(flags, name) {
  const value = flags[name];
  if (value === undefined || value === '' || value === true) {
    throw new Error(`Missing required flag --${name}.`);
  }
  return String(value);
}

function readFileText(file, label) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    throw new Error(`Cannot read ${label} file: ${file}`);
  }
}

function parseDeviationsFile(file) {
  const raw = readFileText(file, 'deviations');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return raw.split(/\r?\n/).filter((line) => line.trim());
  }
}

function summarizeCell(cell) {
  return `${cell.id} [${cell.status}] (${cell.lane}) ${cell.title}`;
}

function formatDecision(event) {
  const head = `[${event.date}] ${datamark(event.decision)} (id ${event.id}, ${event.type})`;
  const why = `  why: ${datamark(event.rationale)}`;
  const alt = event.alternatives ? `  alternatives: ${datamark(event.alternatives)}` : null;
  return [head, why, alt].filter(Boolean).join('\n');
}

// ─── status: verbatim port of bee_status.mjs's buildStatus/renderText ─────
// (byte-parity requirement, D5 — must stay identical to the original)

const STALE_HANDOFF_MS = 7 * 24 * 60 * 60 * 1000;

function buildStatus(root) {
  const state = readState(root);
  const onboardingRaw = readOnboarding(root);
  const handoff = readHandoff(root);
  const cells = listCells(root);
  const counts = { open: 0, claimed: 0, capped: 0, blocked: 0 };
  for (const cell of cells) {
    if (counts[cell.status] !== undefined) counts[cell.status] += 1;
  }
  const allReservations = listReservations(root);
  const active = listReservations(root, { activeOnly: true });
  const expiredUnreleased = allReservations.filter(
    (r) => r.released_at == null && !active.includes(r),
  );

  const commands = readConfig(root).commands || {};
  const backlog = readBacklogCounts(root);

  const staleness = [];
  if (Object.keys(commands).length === 0) {
    staleness.push(
      "No standard commands recorded — capture the host project's setup/start/test/verify into .bee/config.json `commands` so sessions can run the baseline gate.",
    );
  }
  if (onboardingRaw && onboardingRaw.bee_version && onboardingRaw.bee_version !== BEE_VERSION) {
    staleness.push(
      `Onboarding installed bee ${onboardingRaw.bee_version} but plugin is ${BEE_VERSION} — re-run onboarding.`,
    );
  }
  if (handoff && handoff.written_at) {
    const age = Date.now() - Date.parse(handoff.written_at);
    if (Number.isFinite(age) && age > STALE_HANDOFF_MS) {
      staleness.push(`HANDOFF.json is older than 7 days (written ${handoff.written_at}).`);
    }
  }
  if (expiredUnreleased.length > 0) {
    staleness.push(
      `${expiredUnreleased.length} reservation(s) expired but never released — run bee_reservations.mjs sweep.`,
    );
  }
  if (!isKnownPhase(state.phase)) {
    staleness.push(
      `Unknown phase "${state.phase}" — not in the enum (${PHASES.join(', ')}; terminal alias: compounding-complete). Set state.phase to a valid value (idle at feature close); invented phases break machine-checkable handoffs (decision 0004).`,
    );
  }
  const POST_REVIEW_PHASES = ['scribing', 'compounding', 'compounding-complete'];
  if (POST_REVIEW_PHASES.includes(state.phase) && state.approved_gates?.review !== true) {
    staleness.push(
      `Phase "${state.phase}" is past reviewing but gate "review" is still pending — Gate 4 was never recorded. Ask the user for Gate 4 (or record the approval already given) before closing the feature (decision 0004).`,
    );
  }

  const executionApproved = state.approved_gates?.execution === true;
  const ready = readyCells(root, state.feature || null);
  let recommended;
  if (!onboardingRaw) {
    recommended = 'Onboarding missing — run bee-hive onboarding.';
  } else if (handoff) {
    recommended = 'HANDOFF present — present it to the user and WAIT. Never auto-resume.';
  } else if (state.phase === 'swarming' && !executionApproved) {
    recommended = 'NOT ready to swarm: gate "execution" is not approved.';
  } else if (executionApproved && ready.length > 0) {
    recommended = `${ready.length} ready cell(s): ${ready.map((c) => c.id).join(', ')} — orchestrator assigns them.`;
  } else {
    recommended = state.next_action || 'Invoke bee-hive.';
  }

  return {
    onboarding: {
      installed: Boolean(onboardingRaw),
      bee_version: onboardingRaw?.bee_version ?? null,
      plugin_version: BEE_VERSION,
      drift: Boolean(onboardingRaw && onboardingRaw.bee_version !== BEE_VERSION),
    },
    phase: state.phase,
    mode: state.mode,
    feature: state.feature,
    gates: state.approved_gates,
    gate_bypass: readConfig(root).gate_bypass === true,
    models: readConfig(root).models,
    advisor: readConfig(root).advisor,
    tier_mix: tierMix(root, { feature: state.feature || null }),
    ceiling_scarcity: ceilingScarcityWarning(root),
    handoff,
    cells: counts,
    scribing_debt: scribingDebt(root),
    capture_queue: (() => {
      const queue = captureQueue(root);
      return { count: queue.count, ids: queue.stubs.map((s) => s.id) };
    })(),
    pbi: backlog
      ? { proposed: backlog.proposed, in_flight: backlog.inFlight, done: backlog.done }
      : null,
    commands,
    active_reservations: active,
    critical_patterns_present: fs.existsSync(
      path.join(root, 'docs', 'history', 'learnings', 'critical-patterns.md'),
    ),
    recent_decisions: activeDecisions(root, { recent: 3 }).map((event) => ({
      id: event.id,
      date: event.date,
      decision: datamark(event.decision),
    })),
    staleness_warnings: staleness,
    recommended_next: recommended,
  };
}

function formatSlot(value) {
  if (value == null) return 'null';
  if (typeof value === 'string') return value;
  if (value.kind === 'cli') return `cli(${String(value.command).split(/\s+/)[0]})`;
  if (value.model) return value.effort ? `${value.model}@${value.effort}` : value.model;
  return 'null';
}

function renderStatusText(status) {
  const lines = [
    `bee status (plugin v${BEE_VERSION})`,
    `Onboarding: ${status.onboarding.installed ? `installed (bee ${status.onboarding.bee_version})` : 'MISSING'}${status.onboarding.drift ? ' [version drift]' : ''}`,
    `Phase: ${status.phase} | Mode: ${status.mode ?? 'none'} | Feature: ${status.feature ?? 'none'}`,
    `Gates: ${GATE_NAMES.map((g) => `${g}=${status.gates?.[g] ? 'approved' : 'pending'}`).join(' ')}`,
    ...(status.gate_bypass
      ? ['⚡ GATE BYPASS ON — Gates 1-3 auto-approved for normal-lane work; high-risk/hard-gate, secrets, UAT still stop. Off: bee-bypass-gate off']
      : []),
    `Handoff: ${status.handoff ? 'PRESENT — surface it and WAIT' : 'none'}`,
    `Cells: open=${status.cells.open} claimed=${status.cells.claimed} capped=${status.cells.capped} blocked=${status.cells.blocked}`,
    ...(status.scribing_debt && status.scribing_debt.count > 0
      ? [`Scribing debt: ${status.scribing_debt.count} behavior_change cell(s) uncaptured (${status.scribing_debt.cells.join(', ')}) — run bee-scribing capture (decision 0011)`]
      : []),
    ...(status.capture_queue && status.capture_queue.count > 0
      ? [`Capture queue: ${status.capture_queue.count} stub(s) pending flush — run bee-scribing flush at wrap-up, before compact/clear, or now if idle (decision 0017)`]
      : []),
    ...(status.pbi
      ? [`PBI: ${status.pbi.done} done / ${status.pbi.in_flight} in-flight / ${status.pbi.proposed} proposed`]
      : []),
    `Standard commands: ${
      COMMAND_KEYS.filter((key) => status.commands?.[key])
        .map((key) => `${key}=${status.commands[key]}`)
        .join(' | ') || 'none recorded'
    }`,
    `Active reservations: ${status.active_reservations.length}`,
    `Critical patterns file: ${status.critical_patterns_present ? 'present' : 'absent'}`,
    ...(status.models
      ? [
          `Models (claude): generation=${formatSlot(status.models.claude.generation)} extraction=${formatSlot(status.models.claude.extraction)} review=${formatSlot(status.models.claude.review)} · ceiling = the session model (keep it scarce; decisions 0012/0015/0021)`,
        ]
      : []),
    ...(status.advisor && status.advisor.enabled
      ? [`🧭 ADVISOR MODE ON — session on generation; consult ${status.advisor.model ?? 'the strong model'} at: ${status.advisor.at.join(', ')} (decision 0013)`]
      : []),
    ...(status.tier_mix && status.tier_mix.tiered > 0
      ? [`Tier mix: extraction=${status.tier_mix.counts.extraction} generation=${status.tier_mix.counts.generation} ceiling=${status.tier_mix.counts.ceiling} untiered=${status.tier_mix.counts.untiered} (ceiling ${Math.round(status.tier_mix.ceilingShare * 100)}%)`]
      : []),
    ...(status.ceiling_scarcity
      ? [`⚠ Ceiling scarcity: ${status.ceiling_scarcity.ceiling}/${status.ceiling_scarcity.tiered} tiered cells on ceiling (${status.ceiling_scarcity.pct}%) — re-tier routine cells (decision 0012)`]
      : []),
  ];
  if (status.recent_decisions.length > 0) {
    lines.push('Recent decisions:');
    for (const d of status.recent_decisions) lines.push(`- ${d.decision} (${d.date})`);
  }
  if (status.staleness_warnings.length > 0) {
    lines.push('Staleness warnings:');
    for (const w of status.staleness_warnings) lines.push(`- ${w}`);
  }
  lines.push(`Recommended next: ${status.recommended_next}`);
  return lines.join('\n');
}

// ─── per-group handlers: reimplement each existing CLI's run() against the
// same lib functions (D5) — every handler's {result, text} matches the
// original byte-for-byte in the steady state (no manifest drift). ──────────

function handleStatus(root) {
  const status = buildStatus(root);
  return { result: status, text: renderStatusText(status) };
}

function handleCellsList(root, flags) {
  const cells = listCells(root, {
    feature: flags.feature ? String(flags.feature) : null,
    status: flags.status ? String(flags.status) : null,
  });
  return { result: cells, text: cells.length ? cells.map(summarizeCell).join('\n') : 'No cells.' };
}

function handleCellsReady(root, flags) {
  const cells = readyCells(root, flags.feature ? String(flags.feature) : null);
  return { result: cells, text: cells.length ? cells.map(summarizeCell).join('\n') : 'No ready cells.' };
}

function handleCellsShow(root, flags) {
  const id = requireFlag(flags, 'id');
  const cell = readCell(root, id);
  if (!cell) throw new Error(`Cell "${id}" not found.`);
  return { result: cell, text: JSON.stringify(cell, null, 2) };
}

function handleCellsAdd(root, flags) {
  let text;
  if (flags.stdin === true) text = fs.readFileSync(0, 'utf8');
  else text = readFileText(requireFlag(flags, 'file'), 'cell');
  let cell;
  try {
    cell = JSON.parse(text);
  } catch {
    throw new Error('add: input is not valid JSON.');
  }
  const added = addCell(root, cell);
  return { result: added, text: `Added ${summarizeCell(added)}` };
}

function handleCellsClaim(root, flags) {
  const cell = claimCell(root, requireFlag(flags, 'id'), requireFlag(flags, 'worker'));
  return { result: cell, text: `Claimed ${cell.id} for ${cell.trace.worker}.` };
}

function handleCellsVerify(root, flags) {
  const id = requireFlag(flags, 'id');
  const command = requireFlag(flags, 'command');
  const passedRaw = requireFlag(flags, 'passed');
  if (passedRaw !== 'true' && passedRaw !== 'false') {
    throw new Error('--passed must be "true" or "false".');
  }
  const output = flags['output-file']
    ? readFileText(String(flags['output-file']), 'output')
    : flags.output
      ? String(flags.output)
      : null;
  const cell = recordVerify(root, id, { command, output, passed: passedRaw === 'true' });
  return { result: cell, text: `Recorded verify on ${cell.id}: passed=${cell.trace.verify_passed}.` };
}

function handleCellsCap(root, flags) {
  const id = requireFlag(flags, 'id');
  const deviations = flags['deviations-file'] ? parseDeviationsFile(String(flags['deviations-file'])) : [];
  const cell = capCell(root, id, {
    outcome: flags.outcome ? String(flags.outcome) : undefined,
    files_changed: flags.files
      ? String(flags.files)
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean)
      : [],
    behavior_change: flags['behavior-change'] === true ? true : undefined,
    verification_evidence: flags['evidence-stdin']
      ? fs.readFileSync(0, 'utf8')
      : flags['evidence-file']
        ? readFileText(String(flags['evidence-file']), 'evidence')
        : null,
    deviations,
    friction: flags.friction ? String(flags.friction) : null,
  });
  return { result: cell, text: `Capped ${cell.id} at ${cell.trace.capped_at}.` };
}

function handleCellsBlock(root, flags) {
  const cell = blockCell(root, requireFlag(flags, 'id'), requireFlag(flags, 'reason'));
  return { result: cell, text: `Blocked ${cell.id}.` };
}

function handleCellsDrop(root, flags) {
  const cell = dropCell(root, requireFlag(flags, 'id'), requireFlag(flags, 'reason'));
  return { result: cell, text: `Dropped ${cell.id}.` };
}

function handleCellsTier(root, flags) {
  const cell = setTier(root, requireFlag(flags, 'id'), String(requireFlag(flags, 'tier')));
  return { result: cell, text: `Cell ${cell.id} tier set to ${cell.tier}.` };
}

function handleCellsJudge(root, flags) {
  const verdict = judgeCell(root, requireFlag(flags, 'id'));
  const text = verdict.hits.length
    ? `FROZEN-JUDGE HITS for ${verdict.id}: ${verdict.hits
        .map((h) => `${h.file} (${h.rule})`)
        .join('; ')} — do not count this cell toward a clean wave; flag it for review (decision 0018).`
    : `Judge intact for ${verdict.id}: no undeclared test/CI/lockfile changes.`;
  return { result: verdict, text };
}

function handleReservationsReserve(root, flags) {
  const ttl = flags.ttl !== undefined ? Number.parseInt(String(flags.ttl), 10) : undefined;
  if (flags.ttl !== undefined && (!Number.isFinite(ttl) || ttl <= 0)) {
    throw new Error('--ttl must be a positive integer (seconds).');
  }
  const result = reserve(root, {
    agent: requireFlag(flags, 'agent'),
    cell: requireFlag(flags, 'cell'),
    path: requireFlag(flags, 'path'),
    ...(ttl !== undefined ? { ttl } : {}),
  });
  const text = result.ok
    ? `Reserved "${result.reservation.path}" for ${result.reservation.agent} (cell ${result.reservation.cell}, ttl ${result.reservation.ttl_seconds}s).`
    : [
        'Reservation CONFLICT — return [BLOCKED] to the orchestrator:',
        ...result.conflicts.map((c) => `- ${c.agent} holds "${c.path}" (cell ${c.cell})`),
      ].join('\n');
  return { result, text, exitCode: result.ok ? 0 : 1 };
}

function handleReservationsRelease(root, flags) {
  const result = release(root, {
    agent: requireFlag(flags, 'agent'),
    cell: flags.cell ? String(flags.cell) : null,
  });
  return { result, text: `Released ${result.released} reservation(s).` };
}

function handleReservationsList(root, flags) {
  const reservations = listReservations(root, { activeOnly: flags['active-only'] === true });
  const text = reservations.length
    ? reservations
        .map(
          (r) =>
            `${r.agent} | cell ${r.cell} | ${r.path} | reserved ${r.reserved_at} | ${r.released_at ? `released ${r.released_at}` : 'active/expired by TTL'}`,
        )
        .join('\n')
    : 'No reservations.';
  return { result: { reservations }, text };
}

function handleReservationsSweep(root) {
  const released = sweepExpired(root);
  return { result: { released }, text: `Swept ${released} expired reservation(s).` };
}

function handleDecisionsLog(root, flags) {
  const confidence =
    flags.confidence !== undefined ? Number.parseInt(String(flags.confidence), 10) : null;
  if (flags.confidence !== undefined && !Number.isFinite(confidence)) {
    throw new Error('--confidence must be an integer.');
  }
  const event = logDecision(root, {
    decision: requireFlag(flags, 'decision'),
    rationale: requireFlag(flags, 'rationale'),
    alternatives: flags.alternatives ? String(flags.alternatives) : null,
    scope: flags.scope ? String(flags.scope) : 'repo',
    source: flags.source ? String(flags.source) : 'user',
    confidence,
  });
  return { result: event, text: `Logged decision ${event.id}.` };
}

function handleDecisionsSupersede(root, flags) {
  const event = supersedeDecision(root, {
    supersedes: requireFlag(flags, 'id'),
    decision: requireFlag(flags, 'decision'),
    rationale: requireFlag(flags, 'rationale'),
  });
  return { result: event, text: `Superseded ${event.supersedes} with ${event.id}.` };
}

function handleDecisionsRedact(root, flags) {
  const event = redactDecision(root, {
    redacts: requireFlag(flags, 'id'),
    reason: requireFlag(flags, 'reason'),
  });
  return { result: event, text: `Redacted ${event.redacts}.` };
}

function handleDecisionsActive(root, flags) {
  const recent =
    flags.recent !== undefined ? Number.parseInt(String(flags.recent), 10) : null;
  if (flags.recent !== undefined && (!Number.isFinite(recent) || recent <= 0)) {
    throw new Error('--recent must be a positive integer.');
  }
  const decisions = activeDecisions(root, { recent });
  const text = decisions.length ? decisions.map(formatDecision).join('\n') : 'No active decisions.';
  return { result: { decisions }, text };
}

function handleDecisionsSearch(root, flags) {
  const needle = requireFlag(flags, 'text').toLowerCase();
  const decisions = activeDecisions(root).filter((event) =>
    [event.decision, event.rationale, event.alternatives]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(needle)),
  );
  const text = decisions.length
    ? decisions.map(formatDecision).join('\n')
    : `No active decisions matching "${needle}".`;
  return { result: { decisions }, text };
}

const HANDLERS = {
  status: handleStatus,
  'cells.list': handleCellsList,
  'cells.ready': handleCellsReady,
  'cells.show': handleCellsShow,
  'cells.add': handleCellsAdd,
  'cells.claim': handleCellsClaim,
  'cells.verify': handleCellsVerify,
  'cells.cap': handleCellsCap,
  'cells.block': handleCellsBlock,
  'cells.drop': handleCellsDrop,
  'cells.tier': handleCellsTier,
  'cells.judge': handleCellsJudge,
  'reservations.reserve': handleReservationsReserve,
  'reservations.release': handleReservationsRelease,
  'reservations.list': handleReservationsList,
  'reservations.sweep': handleReservationsSweep,
  'decisions.log': handleDecisionsLog,
  'decisions.supersede': handleDecisionsSupersede,
  'decisions.redact': handleDecisionsRedact,
  'decisions.active': handleDecisionsActive,
  'decisions.search': handleDecisionsSearch,
};

// ─── argv parsing: "bee <group> [<action>] [--flag value|--flag=value ...]" ─
// The flag-alone boolean set is the exact union of the 3 existing helper
// files' own hardcoded boolean-flag lists (bee_cells: json/stdin/
// behavior-change/evidence-stdin; bee_reservations: json/active-only;
// bee_decisions: json) — every OTHER flag, even one the registry declares as
// JSON-Schema type "boolean" (e.g. cells.verify's --passed), takes an
// explicit "true"/"false" argument exactly as the original CLIs parse it;
// this keeps `bee cells verify ... --passed true` byte-parity-correct.
export const FLAG_ALONE_BOOLEANS = new Set(['json', 'stdin', 'behavior-change', 'evidence-stdin', 'active-only']);

export function splitCommandTokens(argv) {
  const leading = [];
  let i = 0;
  while (i < argv.length && !argv[i].startsWith('--')) {
    leading.push(argv[i]);
    i += 1;
  }
  return { leading, rest: argv.slice(i) };
}

/** "status" takes no subcommand; every other group takes exactly one. */
export function resolveCommand(leading) {
  if (leading.length === 0) return { commandName: null, extra: [] };
  if (leading[0] === 'status') return { commandName: 'status', extra: leading.slice(1) };
  if (leading.length === 1) return { commandName: leading[0], extra: [] };
  return { commandName: `${leading[0]}.${leading[1]}`, extra: leading.slice(2) };
}

/**
 * Parse the flag section of argv into a {name: value} map plus a stripped
 * `json` flag. Returns {flags, json} on success or {error} (never throws) —
 * the {field, reason, command} shape validate-args.mjs already uses.
 */
export function parseFlags(tokens) {
  const flags = {};
  let json = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (!tok.startsWith('--')) {
      return { error: { field: null, reason: `unexpected argument "${tok}"`, command: null } };
    }
    const eq = tok.indexOf('=');
    const name = eq === -1 ? tok.slice(2) : tok.slice(2, eq);
    let value;
    if (eq !== -1) {
      value = tok.slice(eq + 1);
    } else if (FLAG_ALONE_BOOLEANS.has(name)) {
      value = true;
    } else {
      value = tokens[i + 1];
      if (value === undefined) {
        return { error: { field: name, reason: `flag --${name} requires a value`, command: null } };
      }
      i += 1;
    }
    if (name === 'json') {
      json = true;
      continue;
    }
    flags[name] = value;
  }
  return { flags, json };
}

// ─── nearest-match suggestion (unknown command → suggestion, never a bare
// not-found) — plain Levenshtein edit distance over registry names. ────────

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

export function nearestCommandName(name, names = COMMAND_REGISTRY.map((e) => e.name)) {
  let best = null;
  let bestDist = Infinity;
  for (const candidate of names) {
    const dist = levenshtein(String(name || ''), candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

// ─── deprecated redirect (D2/D3 scope gap closed, validating iteration 1) ──
// No registry entry is deprecated today (all `deprecated: null`); the DISPATCH
// LOGIC must exist regardless, exercised in tests via a synthetic entry.

export function deprecatedRedirect(entry) {
  if (!entry || !entry.deprecated) return null;
  const since = entry.deprecated.since ?? null;
  const useInstead = entry.deprecated.use_instead ?? null;
  const message = `"${entry.name}" is deprecated${since ? ` since ${since}` : ''}; use "${useInstead}" instead.`;
  return {
    result: { ok: false, deprecated: true, since, use_instead: useInstead, message },
    text: `"${entry.name}" is deprecated${since ? ` since ${since}` : ''} — use "${useInstead}" instead.`,
    exitCode: 1,
  };
}

// ─── manifest content-hash tracking (drift over time) ──────────────────────
// bee.mjs runs as a fresh process per invocation with no built-in session
// concept, so the "last seen" hash is persisted to a small state file:
// <root>/.bee/manifest-hash.json ({ hash, checked_at }) — sibling to the
// other runtime-generated .bee/ files (reservations.json, decisions.jsonl).

export function computeManifestHash(registry = COMMAND_REGISTRY, schemaVersion = SCHEMA_VERSION) {
  const payload = JSON.stringify({ schema_version: schemaVersion, commands: registry });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function manifestHashStatePath(root) {
  return path.join(root, '.bee', 'manifest-hash.json');
}

/** Compare the current registry hash against the last-persisted one, then
 * persist the current hash. Returns {manifest_changed, hint} — hint is only
 * meaningful when manifest_changed is true. */
function checkManifestDrift(root) {
  const current = computeManifestHash();
  const stateFile = manifestHashStatePath(root);
  const prior = readJson(stateFile, null);
  const priorHash = prior && typeof prior.hash === 'string' ? prior.hash : null;
  writeJsonAtomic(stateFile, { hash: current, checked_at: new Date().toISOString() });
  if (priorHash && priorHash !== current) {
    return {
      manifest_changed: true,
      hint: 'Command registry content changed since the last bee.mjs call — re-run "bee --help --json" to refresh the manifest.',
    };
  }
  return { manifest_changed: false, hint: null };
}

// ─── --help / --help --json: D3 tool-schema-shaped manifest ────────────────

function publicManifestEntries() {
  return COMMAND_REGISTRY.map(({ name, invoke, description, parameters, examples, deprecated }) => ({
    name,
    invoke,
    description,
    parameters,
    examples,
    deprecated,
  }));
}

function renderHelpText() {
  const lines = [`bee — unified CLI dispatcher (schema_version ${SCHEMA_VERSION})`, ''];
  for (const entry of publicManifestEntries()) {
    lines.push(entry.invoke);
    lines.push(`    ${entry.description}`);
    const required = entry.parameters?.required || [];
    if (required.length) lines.push(`    required: ${required.map((r) => `--${r}`).join(', ')}`);
    if (entry.deprecated) {
      lines.push(`    DEPRECATED since ${entry.deprecated.since} — use "${entry.deprecated.use_instead}" instead.`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

function handleHelp(json) {
  if (json) {
    const manifest = { schema_version: SCHEMA_VERSION, commands: publicManifestEntries() };
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } else {
    process.stdout.write(renderHelpText());
  }
  return 0;
}

// ─── response emission (stdout's top-level JSON/text shape is ALWAYS the
// bare result — byte-identical to the original CLIs, parity, D5 — regardless
// of drift. P1 fix (review-phase-1.md): a prior version nested the result
// under {manifest_changed, manifest_changed_hint, result} on drift, which
// unpredictably reshaped every data command's output for exactly one call.
// The drift signal now only ever reaches stderr, never stdout, so a
// machine consumer's parsing of stdout never has to account for it.) ───────

function emit({ result, text, exitCode = 0 }, useJson, drift) {
  if (drift && drift.manifest_changed) {
    process.stderr.write(`manifest_changed: true — ${drift.hint}\n`);
  }
  if (useJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${text}\n`);
  }
  return exitCode;
}

function emitError(message, useJson) {
  if (useJson) process.stdout.write(`${JSON.stringify({ error: message })}\n`);
  else process.stderr.write(`${message}\n`);
  return 1;
}

// ─── main ───────────────────────────────────────────────────────────────────

export function main(argv) {
  if (argv[0] === '--help') {
    return handleHelp(argv.includes('--json'));
  }

  const { leading, rest } = splitCommandTokens(argv);
  const { commandName, extra } = resolveCommand(leading);
  const jsonRequested = rest.some((t) => t === '--json' || t.startsWith('--json='));

  if (!commandName) {
    return emit(
      {
        result: { ok: false, error: { field: null, reason: 'no command given', command: null } },
        text: 'No command given. Try "bee --help".',
        exitCode: 1,
      },
      jsonRequested,
      null,
    );
  }
  if (extra.length > 0) {
    return emit(
      {
        result: {
          ok: false,
          error: { field: null, reason: `unexpected argument "${extra[0]}"`, command: commandName },
        },
        text: `Unexpected argument "${extra[0]}" after "${commandName}".`,
        exitCode: 1,
      },
      jsonRequested,
      null,
    );
  }

  let root;
  try {
    root = findRepoRoot(process.cwd());
    if (!root) {
      throw new Error(
        'No bee repo root found (no .bee/onboarding.json or .git up the tree). Run bee-hive onboarding.',
      );
    }
  } catch (error) {
    return emitError(error instanceof Error ? error.message : String(error), jsonRequested);
  }

  const drift = checkManifestDrift(root);
  const entry = COMMAND_REGISTRY.find((e) => e.name === commandName);

  if (!entry) {
    const suggestion = nearestCommandName(commandName);
    return emit(
      {
        result: {
          ok: false,
          error: { field: null, reason: `unknown command "${commandName}"`, command: null },
          suggestion,
        },
        text: `Unknown command "${commandName}". Did you mean "${suggestion}"?`,
        exitCode: 1,
      },
      jsonRequested,
      drift,
    );
  }

  const redirect = deprecatedRedirect(entry);
  if (redirect) return emit(redirect, jsonRequested, drift);

  const parsed = parseFlags(rest);
  if (parsed.error) {
    const reason = parsed.error.reason;
    const field = parsed.error.field;
    return emit(
      {
        result: { ok: false, error: { ...parsed.error, command: commandName } },
        text: `Invalid call to "${commandName}": ${reason}${field ? ` (--${field})` : ''}.`,
        exitCode: 1,
      },
      jsonRequested,
      drift,
    );
  }

  const validation = validate(entry, parsed.flags);
  if (!validation.ok) {
    const { field, reason, command } = validation.error;
    return emit(
      {
        result: { ok: false, error: validation.error },
        text: `Invalid call to "${command}": ${reason}${field ? ` (--${field})` : ''}.`,
        exitCode: 1,
      },
      jsonRequested,
      drift,
    );
  }

  const handler = HANDLERS[commandName];
  try {
    const response = handler(root, parsed.flags);
    return emit(response, jsonRequested, drift);
  } catch (error) {
    return emitError(error instanceof Error ? error.message : String(error), jsonRequested);
  }
}

// Guard direct execution vs. import: spawning `bee.mjs` (the real CLI usage,
// and how tests exercise the full dispatch path) runs main(); importing named
// exports for direct unit tests (nearestCommandName, deprecatedRedirect,
// computeManifestHash, parseFlags, ...) must never trigger it as a side effect.
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  process.exitCode = main(process.argv.slice(2));
}
