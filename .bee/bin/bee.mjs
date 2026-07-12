#!/usr/bin/env node
// bee.mjs — unified CLI dispatcher covering all 9 command groups (status,
// cells, reservations, decisions, state, backlog, capture, reviews,
// feedback; dispatcher-unify DB1/DB2).
//
// This dispatcher imports the SAME lib/*.mjs functions the 9 bee_*.mjs
// entrypoints (bee_status.mjs, bee_cells.mjs, bee_reservations.mjs,
// bee_decisions.mjs, bee_state.mjs, bee_backlog.mjs, bee_capture.mjs,
// bee_reviews.mjs, bee_feedback.mjs) used to import directly — those 9
// files are now thin shims that prepend their group name and call this
// file's exported `main()` (DB2), so handlers run in-process (no spawnSync,
// no subprocess) and `bee <group> <verb>` output is byte-identical to
// invoking a shim directly (verified by tests/test_bee_cli.mjs).
//
// Usage:
//   bee status [--json]
//   bee cells <list|ready|show|add|claim|verify|cap|block|drop|tier|judge> ... [--json]
//   bee reservations <reserve|release|list|sweep> ... [--json]
//   bee decisions <log|supersede|redact|active|search> ... [--json]
//   bee state <set|gate|worker add/update/remove/clear/prune|scribing-run|start-feature> ... [--json]
//   bee backlog <add|counts|rank|badges> ... [--json]
//   bee capture <add|list|flush|count> ... [--json]
//   bee reviews <create|list|show|record|candidate add|candidates|status> ... [--json]
//   bee feedback <digest|count|collect|rank> ... [--json]
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
  readStateStrict,
  writeState,
  readHandoff,
  readOnboarding,
  BEE_VERSION,
  COMMAND_KEYS,
  GATE_NAMES,
  PHASES,
  KNOWN_PHASES,
  MODEL_TIERS,
  isKnownPhase,
  startFeature,
  hasStaleAdvisorKey,
  STALE_ADVISOR_KEY_WARNING,
} from './lib/state.mjs';
import {
  listCells,
  readyCells,
  readCell,
  addCell,
  addCells,
  updateCell,
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
import { captureQueue, addCaptureStub, pendingCaptureStubs, flushCaptureStub } from './lib/capture.mjs';
import { readBacklogCounts, rankBacklog, updateReadmeBadges } from './lib/backlog.mjs';
import {
  createReview,
  listReviews,
  readReview,
  recordOnReview,
  addCandidate,
  listCandidates,
  deriveCandidateStatus,
  CANDIDATE_STATUSES,
  REVIEW_MODES,
} from './lib/reviews.mjs';
import { readJson, writeJsonAtomic, appendJsonl } from './lib/fsutil.mjs';
import { KIND_ALIASES, NORMALIZED_KINDS, buildDigest, mergeDigests, clusterEntries, rankClusters } from './lib/feedback.mjs';
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

// Phases past execution where a feature can close honestly without full
// independent review (SPEC R3/§11.5, decision 565e68d0). Full review is
// user-invoked only — reaching these phases with unreviewed candidates is
// the NORMAL truthful state, not drift, so bee_status posts an informational
// §9 completion line here instead of a staleness warning.
const POST_EXECUTION_REVIEW_PHASES = ['scribing', 'compounding', 'compounding-complete'];

/**
 * review-on-demand summary (review-od-3, SPEC R3/R7/R10/§8/§9): candidate
 * counts by derived status + open (non-approved) session ids + a high-risk
 * unreviewed/stale count (R7). Sourced entirely from lib/reviews.mjs's own
 * derivation (review-od-2) — no second derivation implementation here.
 * Fail-open by construction (per SPEC + cell prohibition): every reviews.mjs
 * read path already degrades rather than throwing (corrupt session file,
 * corrupt/missing ledger, missing git binary), but the whole block is still
 * wrapped so a future change to that contract can never crash bee_status —
 * a corrupt .bee/reviews dir or missing git degrades this block, it never
 * breaks the scout.
 */
function buildReviewBlock(root) {
  const empty = {
    candidates: { total: 0, unreviewed: 0, in_review: 0, reviewed: 0, stale: 0 },
    open_sessions: [],
    high_risk_unreviewed: 0,
  };
  try {
    const candidates = listCandidates(root);
    const sessions = listReviews(root);
    const counts = { total: candidates.length, unreviewed: 0, in_review: 0, reviewed: 0, stale: 0 };
    let highRiskUnreviewed = 0;
    for (const candidate of candidates) {
      const derived = deriveCandidateStatus(root, candidate, { sessions });
      if (derived.status === 'unreviewed') counts.unreviewed += 1;
      else if (derived.status === 'in review') counts.in_review += 1;
      else if (derived.status === 'reviewed') counts.reviewed += 1;
      else if (derived.status === 'review stale') counts.stale += 1;
      if (
        candidate &&
        candidate.mode === 'high-risk' &&
        (derived.status === 'unreviewed' || derived.status === 'review stale')
      ) {
        highRiskUnreviewed += 1;
      }
    }
    const openSessions = sessions
      .filter((s) => !s.decision || s.decision.status !== 'approved')
      .map((s) => s.id);
    return { candidates: counts, open_sessions: openSessions, high_risk_unreviewed: highRiskUnreviewed };
  } catch {
    return { ...empty, degraded: true };
  }
}

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
  if (hasStaleAdvisorKey(root)) {
    staleness.push(STALE_ADVISOR_KEY_WARNING);
  }
  if (!isKnownPhase(state.phase)) {
    staleness.push(
      `Unknown phase "${state.phase}" — not in the enum (${PHASES.join(', ')}; terminal alias: compounding-complete). Set state.phase to a valid value (idle at feature close); invented phases break machine-checkable handoffs (decision 0004).`,
    );
  }
  const review = buildReviewBlock(root);

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
  } else if (POST_EXECUTION_REVIEW_PHASES.includes(state.phase) && review.candidates.unreviewed > 0) {
    // §11.5 — never propose bee-reviewing as an automatic post-execution
    // step; report the candidate count and wait for explicit user intent.
    recommended = `${review.candidates.unreviewed} review candidate(s) awaiting: full review is user-invoked only, never dispatched automatically.`;
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
    tier_mix: tierMix(root, { feature: state.feature || null }),
    ceiling_scarcity: ceilingScarcityWarning(root),
    handoff,
    cells: counts,
    review,
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
    // §9 — reaching a post-execution phase with unreviewed candidates is the
    // NORMAL truthful close (R3): informational, never a staleness warning.
    ...(POST_EXECUTION_REVIEW_PHASES.includes(status.phase) && status.review?.candidates?.unreviewed > 0
      ? [
          `Completed and verified; independent review not requested; ${status.review.candidates.unreviewed} candidate(s) awaiting review.`,
        ]
      : []),
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
    ...(status.tier_mix && status.tier_mix.tiered > 0
      ? [`Tier mix: extraction=${status.tier_mix.counts.extraction} generation=${status.tier_mix.counts.generation} ceiling=${status.tier_mix.counts.ceiling} untiered=${status.tier_mix.counts.untiered} (ceiling ${Math.round(status.tier_mix.ceilingShare * 100)}%)`]
      : []),
    ...(status.ceiling_scarcity
      ? [`⚠ Ceiling scarcity: ${status.ceiling_scarcity.ceiling}/${status.ceiling_scarcity.tiered} tiered cells on ceiling (${status.ceiling_scarcity.pct}%) — re-tier routine cells (decision 0012)`]
      : []),
    // R7 — high-risk changes never silently trigger review; bee only warns.
    ...(status.review?.high_risk_unreviewed > 0
      ? [
          `⚠ High-risk unreviewed: ${status.review.high_risk_unreviewed} high-risk candidate(s) have not passed independent review — bee will not auto-dispatch reviewers; request review before merge/release.`,
        ]
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
  // A JSON array is a batch: every cell validated before any is written
  // (all-or-nothing), so one heredoc creates a whole slice in one call
  // (ported from bee_cells.mjs's own add case, dispatcher-unify du-4 —
  // the cells-batch-add regression the pinned test_lib "a JSON array on
  // --stdin creates the whole slice in one call" check exercises).
  if (Array.isArray(cell)) {
    const added = addCells(root, cell);
    return {
      result: added,
      text: added.map((c) => `Added ${summarizeCell(c)}`).join('\n'),
    };
  }
  const added = addCell(root, cell);
  return { result: added, text: `Added ${summarizeCell(added)}` };
}

function handleCellsUpdate(root, flags) {
  // Strict flag validation (workers-prune discipline): a typoed flag on a
  // mutating verb must refuse, never silently no-op into a bad patch.
  for (const name of Object.keys(flags)) {
    if (!['id', 'file', 'stdin'].includes(name)) {
      throw new Error(`update: unknown flag --${name}. Use: --id ID --file patch.json | --stdin [--json].`);
    }
  }
  const id = requireFlag(flags, 'id');
  let text;
  if (flags.stdin === true) text = fs.readFileSync(0, 'utf8');
  else text = readFileText(requireFlag(flags, 'file'), 'patch');
  let patch;
  try {
    patch = JSON.parse(text);
  } catch {
    throw new Error('update: patch input is not valid JSON.');
  }
  const updated = updateCell(root, id, patch);
  return {
    result: updated,
    text: `Updated ${updated.id} (${Object.keys(patch).join(', ')}).`,
  };
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

// ─── state: full port of bee_state.mjs's verb logic (dispatcher-unify du-1).
// Reuses lib/state.mjs's read/write/validation exports exactly as bee_state.mjs
// did — no logic change in lib/state.mjs. Every stdout/stderr byte and exit
// code stays as the existing test_lib bee_state checks pin them (DB3). ────────

// Dispatch transients written by bee-swarming: <cell-id>.prompt.md / .out*.log
// / .result.md|json. Files outside this suffix set are never prune candidates.
const WORKER_TRANSIENT_SUFFIX = /\.(prompt\.md|result\.md|result\.json|out\d*\.log|log)$/;

function requireBoolFlag(flags, name) {
  const raw = requireFlag(flags, name);
  if (raw !== 'true' && raw !== 'false') {
    throw new Error(`--${name} must be "true" or "false", got "${raw}".`);
  }
  return raw === 'true';
}

function splitList(raw) {
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// A safety flag must never ride along with a real mutation: every state verb
// except "worker prune" mutates state, so --dry-run there is a hard error, not
// an ignored no-op that mutates anyway (bee_state.mjs:405-409, a cross-verb rule).
function rejectDryRun(flags) {
  if (flags['dry-run'] !== undefined) {
    throw new Error(
      '--dry-run is only supported by "worker prune" — refusing to run a mutating verb with a dry-run flag.',
    );
  }
}

function handleStateSet(root, flags) {
  rejectDryRun(flags);
  if (flags.phase !== undefined) {
    const phase = String(flags.phase);
    if (!isKnownPhase(phase)) {
      throw new Error(
        `set: invalid phase "${phase}" — not in the known-phase enum (isKnownPhase, not the bare PHASES array — the terminal alias "compounding-complete" must pass). FIX: use one of ${KNOWN_PHASES.join(', ')}.`,
      );
    }
  }
  if (
    flags.phase === undefined &&
    flags.mode === undefined &&
    flags.feature === undefined &&
    flags['next-action'] === undefined &&
    flags.summary === undefined
  ) {
    throw new Error(
      'set: at least one of --phase, --mode, --feature, --next-action, --summary is required.',
    );
  }
  const state = readStateStrict(root);
  const changed = [];
  if (flags.phase !== undefined) {
    state.phase = String(flags.phase);
    changed.push(`phase=${state.phase}`);
  }
  if (flags.mode !== undefined) {
    state.mode = String(flags.mode);
    changed.push(`mode=${state.mode}`);
  }
  if (flags.feature !== undefined) {
    state.feature = String(flags.feature);
    changed.push(`feature=${state.feature}`);
  }
  if (flags['next-action'] !== undefined) {
    state.next_action = String(flags['next-action']);
    changed.push('next_action');
  }
  if (flags.summary !== undefined) {
    state.summary = String(flags.summary);
    changed.push('summary');
  }
  writeState(root, state);
  return { result: state, text: `Updated state: ${changed.join(' ')}.` };
}

function handleStateGate(root, flags) {
  rejectDryRun(flags);
  const name = requireFlag(flags, 'name');
  if (!GATE_NAMES.includes(name)) {
    throw new Error(
      `gate: invalid gate name "${name}" — must be one of ${GATE_NAMES.join(', ')}. FIX: pass --name <one of these>.`,
    );
  }
  const approved = requireBoolFlag(flags, 'approved');
  const state = readStateStrict(root);
  state.approved_gates = { ...state.approved_gates, [name]: approved };
  writeState(root, state);
  return { result: state, text: `Gate "${name}" set to ${approved}.` };
}

function stateWorkerMutate(root, flags, mutate, text) {
  rejectDryRun(flags);
  const state = readStateStrict(root);
  const workers = Array.isArray(state.workers) ? [...state.workers] : [];
  const resultText = mutate(workers);
  state.workers = workers;
  writeState(root, state);
  return { result: state, text: text ?? resultText };
}

function handleStateWorkerAdd(root, flags) {
  return stateWorkerMutate(root, flags, (workers) => {
    const nickname = requireFlag(flags, 'nickname');
    const cell = requireFlag(flags, 'cell');
    let tier = null;
    if (flags.tier !== undefined) {
      tier = String(flags.tier);
      if (!MODEL_TIERS.includes(tier)) {
        throw new Error(`worker add: invalid tier "${tier}" — must be one of ${MODEL_TIERS.join(', ')}.`);
      }
    }
    const status = flags.status !== undefined ? String(flags.status) : null;
    workers.push({ nickname, cell, tier, status });
    return `Added worker "${nickname}" (cell ${cell}).`;
  });
}

function handleStateWorkerUpdate(root, flags) {
  return stateWorkerMutate(root, flags, (workers) => {
    const nickname = requireFlag(flags, 'nickname');
    const idx = workers.findIndex((w) => w && w.nickname === nickname);
    if (idx === -1) {
      throw new Error(
        `worker update: nickname "${nickname}" not found — use "worker add" to create it first.`,
      );
    }
    const worker = { ...workers[idx] };
    if (flags.cell !== undefined) worker.cell = String(flags.cell);
    if (flags.tier !== undefined) {
      const tier = String(flags.tier);
      if (!MODEL_TIERS.includes(tier)) {
        throw new Error(`worker update: invalid tier "${tier}" — must be one of ${MODEL_TIERS.join(', ')}.`);
      }
      worker.tier = tier;
    }
    if (flags.status !== undefined) worker.status = String(flags.status);
    workers[idx] = worker;
    return `Updated worker "${nickname}".`;
  });
}

function handleStateWorkerRemove(root, flags) {
  return stateWorkerMutate(root, flags, (workers) => {
    const nickname = requireFlag(flags, 'nickname');
    const next = workers.filter((w) => !(w && w.nickname === nickname));
    if (next.length === workers.length) {
      throw new Error(`worker remove: nickname "${nickname}" not found.`);
    }
    workers.length = 0;
    workers.push(...next);
    return `Removed worker "${nickname}".`;
  });
}

function handleStateWorkerClear(root, flags) {
  return stateWorkerMutate(root, flags, (workers) => {
    const removedCount = workers.length;
    workers.length = 0;
    return `Cleared ${removedCount} worker(s).`;
  });
}

function readPruneKeepSet(root) {
  // Strict read: a corrupt state.json fails loud here, before any deletion.
  // Prune never writes state.json — it is a read-only verb on state.
  const state = readStateStrict(root);
  if (state.workers !== undefined && state.workers !== null && !Array.isArray(state.workers)) {
    throw new Error(
      'worker prune: state.workers is not an array — refusing to prune against a malformed keep set (a destructive verb fails closed). FIX: repair .bee/state.json via the bee_state.mjs worker verbs first.',
    );
  }
  const keep = new Set();
  for (const w of state.workers || []) {
    if (w && w.cell !== undefined && w.cell !== null) keep.add(String(w.cell));
  }
  const cellsDir = path.join(root, '.bee', 'cells');
  if (fs.existsSync(cellsDir)) {
    for (const file of fs.readdirSync(cellsDir)) {
      if (!file.endsWith('.json')) continue;
      let cell;
      try {
        cell = JSON.parse(fs.readFileSync(path.join(cellsDir, file), 'utf8'));
      } catch {
        cell = null;
      }
      if (!cell || cell.status !== 'capped') keep.add(file.slice(0, -'.json'.length));
    }
  }
  return keep;
}

// Prefix keep-check: "<id>" or "<id>.<anything>" is protected. The suffix
// regex never decides what is kept — only what class of file is a prune
// candidate — so a dotted cell id can never be mis-stemmed into deletion.
function keptByPruneKeepSet(name, keep) {
  for (const id of keep) {
    if (name === id || name.startsWith(`${id}.`)) return true;
  }
  return false;
}

function handleStateWorkerPrune(root, flags) {
  for (const name of Object.keys(flags)) {
    if (name !== 'dry-run') {
      throw new Error(`worker prune: unknown flag --${name}. Use: worker prune [--dry-run] [--json].`);
    }
  }
  const dryRun = flags['dry-run'] !== undefined;
  const workersDir = path.join(root, '.bee', 'workers');
  let keep = readPruneKeepSet(root);
  const entries = fs.existsSync(workersDir)
    ? fs.readdirSync(workersDir, { withFileTypes: true })
    : [];
  const candidates = [];
  const kept = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const match = name.match(WORKER_TRANSIENT_SUFFIX);
    if (!match) continue;
    if (name.length === match[0].length) continue; // empty stem is not a transient
    if (keptByPruneKeepSet(name, keep)) {
      kept.push(name);
      continue;
    }
    candidates.push(name);
  }
  const pruned = [];
  if (dryRun) {
    pruned.push(...candidates);
  } else if (candidates.length > 0) {
    // C1: re-read the keep set immediately before the destructive loop.
    keep = readPruneKeepSet(root);
    for (const name of candidates) {
      if (keptByPruneKeepSet(name, keep)) {
        kept.push(name);
        continue;
      }
      fs.rmSync(path.join(workersDir, name));
      pruned.push(name);
    }
  }
  pruned.sort();
  kept.sort();
  const verb = dryRun ? 'Would prune' : 'Pruned';
  const text = `${verb} ${pruned.length} worker transient(s) from .bee/workers/ (kept ${kept.length} still-active).`;
  return { result: { dry_run: dryRun, pruned, kept }, text };
}

function handleStateScribingRun(root, flags) {
  rejectDryRun(flags);
  const feature = requireFlag(flags, 'feature');
  const areas = splitList(requireFlag(flags, 'areas'));
  const nextAction = requireFlag(flags, 'next-action');
  const now = new Date();
  const at = now.toISOString();
  const date = at.slice(0, 10);
  const state = readStateStrict(root);
  state.last_scribing_run = { feature, date, at, areas_synced: areas, next_action: nextAction };
  // "plus top-level phase/next_action" (bee-scribing SKILL.md:112).
  state.phase = 'compounding';
  state.next_action = nextAction;
  writeState(root, state);
  return { result: state, text: `Recorded scribing run for "${feature}" at ${at}.` };
}

function handleStateStartFeature(root, flags) {
  rejectDryRun(flags);
  const feature = requireFlag(flags, 'feature');
  const mode = flags.mode !== undefined ? String(flags.mode) : null;
  const phase = flags.phase !== undefined ? String(flags.phase) : 'exploring';
  // startFeature() re-reads state and performs every precondition check (C1).
  const state = startFeature(root, { feature, mode, phase });
  return {
    result: state,
    text: `Started feature "${state.feature}" at phase "${state.phase}" (mode ${state.mode ?? 'null'}); all four gates reset.`,
  };
}

// ─── backlog: full port of bee_backlog.mjs's counts/rank/badges/add verbs
// (dispatcher-unify du-2). Reuses lib/backlog.mjs's read/rank/badge exports
// and lib/feedback.mjs's KIND_ALIASES/NORMALIZED_KINDS exactly as
// bee_backlog.mjs did — no logic change in either lib file. `add`'s
// validation refusal texts and exit codes stay as the existing test_lib
// bee_backlog checks pin them (DB3). ───────────────────────────────────────

const BACKLOG_SEVERITIES = ['P1', 'P2', 'P3'];
const BACKLOG_MAX_TITLE = 200;
const BACKLOG_MAX_LAYER = 40;

function backlogAllowedTypes() {
  return [...new Set([...Object.keys(KIND_ALIASES), ...NORMALIZED_KINDS])].sort();
}

function handleBacklogCounts(root) {
  const counts = readBacklogCounts(root);
  if (!counts) return { result: null, text: 'No docs/backlog.md found.' };
  return {
    result: counts,
    text: `PBI: ${counts.done} done / ${counts.inFlight} in-flight / ${counts.proposed} proposed (${counts.total} total)`,
  };
}

function handleBacklogRank(root, flags) {
  const write = flags.write === true;
  const ranked = rankBacklog(root, { write });
  if (!ranked) return { result: null, text: 'No parseable backlog table in docs/backlog.md.' };
  const verb = write ? (ranked.changed ? 'Reordered' : 'Already ordered') : ranked.changed ? 'Would reorder to' : 'Already ordered';
  return {
    result: ranked,
    text: `${verb}: ${ranked.order.join(', ')}${write || !ranked.changed ? '' : ' (re-run with --write to apply)'}`,
  };
}

function handleBacklogBadges(root, flags) {
  const write = flags.write === true;
  const badges = updateReadmeBadges(root, { write });
  if (!badges) return { result: null, text: 'README.md or docs/backlog.md missing — nothing to badge.' };
  const verb = write ? (badges.changed ? 'README badges refreshed' : 'README badges already current') : badges.changed ? 'README badges stale (re-run with --write to apply)' : 'README badges already current';
  return { result: badges, text: `${verb}: ${badges.badges}` };
}

function handleBacklogAdd(root, flags) {
  const type = requireFlag(flags, 'type');
  if (!Object.prototype.hasOwnProperty.call(KIND_ALIASES, type) && !NORMALIZED_KINDS.has(type)) {
    throw new Error(
      `add: invalid --type "${type}" — not a KIND_ALIASES key or an already-normalized NORMALIZED_KINDS value (lib/feedback.mjs), so buildDigest would drop it as unknown_type. FIX: use one of ${backlogAllowedTypes().join(', ')}.`,
    );
  }
  const title = requireFlag(flags, 'title');
  if (title.length > BACKLOG_MAX_TITLE) {
    throw new Error(`add: --title is ${title.length} chars, over the ${BACKLOG_MAX_TITLE}-char limit. FIX: shorten the title.`);
  }
  const severity = requireFlag(flags, 'severity');
  if (!BACKLOG_SEVERITIES.includes(severity)) {
    throw new Error(`add: invalid --severity "${severity}". FIX: use one of ${BACKLOG_SEVERITIES.join(', ')}.`);
  }
  const layer = requireFlag(flags, 'layer');
  if (layer.length > BACKLOG_MAX_LAYER) {
    throw new Error(`add: --layer is ${layer.length} chars, over the ${BACKLOG_MAX_LAYER}-char limit. FIX: shorten the layer.`);
  }
  const detail = flags.detail !== undefined && flags.detail !== true ? String(flags.detail) : '';
  const feature = flags.feature !== undefined && flags.feature !== true ? String(flags.feature) : '';
  const line = {
    ts: new Date().toISOString(),
    type,
    title,
    detail,
    severity,
    layer,
    feature,
  };
  appendJsonl(path.join(root, '.bee', 'backlog.jsonl'), line);
  return { result: line, text: `Appended ${severity} ${type} row to .bee/backlog.jsonl: "${title}"` };
}

// ─── capture: full port of bee_capture.mjs's add/list/flush/count verbs
// (dispatcher-unify du-2). Reuses lib/capture.mjs's exports exactly as
// bee_capture.mjs did — no logic change there. ─────────────────────────────

function formatCaptureStub(stub) {
  const parts = [`[${stub.at}] ${stub.outcome} (id ${stub.id})`];
  if (stub.dids && stub.dids.length) parts.push(`  decisions: ${stub.dids.join(', ')}`);
  if (stub.area) parts.push(`  area: ${stub.area}`);
  if (stub.files && stub.files.length) parts.push(`  files: ${stub.files.join(', ')}`);
  return parts.join('\n');
}

function handleCaptureAdd(root, flags) {
  const stub = addCaptureStub(root, {
    outcome: requireFlag(flags, 'outcome'),
    dids: flags.did ? String(flags.did) : null,
    area: flags.area ? String(flags.area) : null,
    files: flags.files ? String(flags.files) : null,
    lane: flags.lane ? String(flags.lane) : null,
  });
  return {
    result: stub,
    text: `Queued capture stub ${stub.id}. Flush via bee-scribing at wrap-up, before compact/clear, or next session (decision 0017).`,
  };
}

function handleCaptureList(root) {
  const stubs = pendingCaptureStubs(root);
  const text = stubs.length ? stubs.map(formatCaptureStub).join('\n') : 'Capture queue is empty.';
  return { result: { count: stubs.length, stubs }, text };
}

function handleCaptureFlush(root, flags) {
  const record = flushCaptureStub(root, requireFlag(flags, 'id'), {
    into: flags.into ? String(flags.into) : null,
  });
  return {
    result: record,
    text: `Flushed stub ${record.id}${record.into ? ` into ${record.into}` : ''}.`,
  };
}

function handleCaptureCount(root) {
  const queue = captureQueue(root);
  return { result: { count: queue.count }, text: `${queue.count} pending capture stub(s).` };
}

// ─── reviews: full port of bee_reviews.mjs's create/list/show/record/
// candidate add/candidates/status verbs (dispatcher-unify du-3). Reuses
// lib/reviews.mjs's exports exactly as bee_reviews.mjs did — no logic change
// there. `required: []` on every reviews registry entry is deliberate (DB3,
// same discipline as state.*/backlog.*): the generic validate() layer would
// emit its structured error on STDOUT, but the legacy bee_reviews.mjs
// contract (pinned by test_lib.mjs) emits its validation refusals on
// STDERR. So each handler owns its own required-flag / enum checks (via the
// shared requireFlag above), throwing the legacy message text — which the
// dispatcher routes to STDERR through the catch-block -> emitError path.
// reviews.candidate.add is a NESTED 3-segment name resolved by the
// dispatcher's longest-prefix match (du-1), sitting alongside the separate
// FLAT reviews.candidates verb (bee_reviews.mjs:186-207/199-207) — two
// distinct verbs, both pinned.

function readReviewsJsonInput(flags, label) {
  const text = flags.stdin === true ? fs.readFileSync(0, 'utf8') : readFileText(requireFlag(flags, 'file'), label);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}: input is not valid JSON.`);
  }
}

function summarizeReview(session) {
  return `${session.id} [${session.decision && session.decision.status}] ${session.scope_description}`;
}

// A7: a candidate reviewed by an unchanged approved session names the
// covering review-id so the orchestrator never re-dispatches a full panel.
function candidateStatusLine(candidate, derived) {
  const target = `${candidate.feature}@${candidate.head} (${candidate.mode})`;
  if (derived.status === 'reviewed') {
    return `${target} — reviewed (covered by ${derived.session})`;
  }
  if (derived.status === 'review stale') {
    const note = derived.note ? `, ${derived.note}` : '';
    return `${target} — review stale (was covered by ${derived.session}${note})`;
  }
  if (derived.status === 'in review') {
    return `${target} — in review (session ${derived.session})`;
  }
  return `${target} — unreviewed`;
}

function buildReviewsStatusSummary(root, { feature } = {}) {
  const candidates = listCandidates(root).filter((c) => !feature || c.feature === feature);
  const sessions = listReviews(root);
  const counts = { verified: candidates.length };
  for (const label of CANDIDATE_STATUSES) counts[label] = 0;

  const rows = candidates.map((candidate) => {
    const derived = deriveCandidateStatus(root, candidate, { sessions });
    counts[derived.status] += 1;
    return {
      ...candidate,
      review_status: derived.status,
      review_session: derived.session || null,
      note: derived.note || null,
    };
  });

  return { counts, candidates: rows };
}

function renderReviewsStatusText(summary) {
  const counts = summary.counts;
  const headline =
    `verified: ${counts.verified}  unreviewed: ${counts.unreviewed}  ` +
    `in review: ${counts['in review']}  reviewed: ${counts.reviewed}  review stale: ${counts['review stale']}`;
  if (summary.candidates.length === 0) return `${headline}\nNo review candidates.`;
  return [headline, ...summary.candidates.map((c) => candidateStatusLine(c, { status: c.review_status, session: c.review_session, note: c.note }))].join('\n');
}

function handleReviewsCreate(root, flags) {
  const scope = readReviewsJsonInput(flags, 'scope');
  const session = createReview(root, scope);
  return { result: session, text: `Created review session ${session.id}.` };
}

function handleReviewsList(root) {
  const sessions = listReviews(root);
  return {
    result: sessions,
    text: sessions.length ? sessions.map(summarizeReview).join('\n') : 'No review sessions.',
  };
}

function handleReviewsShow(root, flags) {
  const id = requireFlag(flags, 'id');
  const session = readReview(root, id);
  if (!session) throw new Error(`Review session "${id}" not found.`);
  return { result: session, text: JSON.stringify(session, null, 2) };
}

function handleReviewsRecord(root, flags) {
  const id = requireFlag(flags, 'id');
  const kind = requireFlag(flags, 'kind');
  const payload = readReviewsJsonInput(flags, 'payload');
  const session = recordOnReview(root, id, { kind, payload });
  return { result: session, text: `Recorded ${kind} on ${session.id} (updated_at ${session.updated_at}).` };
}

function handleReviewsCandidateAdd(root, flags) {
  const entry = addCandidate(root, {
    feature: requireFlag(flags, 'feature'),
    head: requireFlag(flags, 'head'),
    mode: requireFlag(flags, 'mode'),
    baseline: flags.baseline ? String(flags.baseline) : null,
    cells: flags.cells ? splitList(flags.cells) : [],
  });
  return { result: entry, text: `Added candidate ${entry.id} for feature "${entry.feature}" (mode ${entry.mode}).` };
}

function handleReviewsCandidates(root) {
  const entries = listCandidates(root);
  return {
    result: entries,
    text: entries.length
      ? entries.map((e) => `${e.date} ${e.feature} @${e.head} (${e.mode})`).join('\n')
      : 'No review candidates.',
  };
}

function handleReviewsStatus(root, flags) {
  const feature = flags.feature ? String(flags.feature) : null;
  const summary = buildReviewsStatusSummary(root, { feature });
  return { result: summary, text: renderReviewsStatusText(summary) };
}

// ─── feedback: full port of bee_feedback.mjs's digest/count/collect/rank
// verbs (dispatcher-unify du-3). Reuses lib/feedback.mjs's buildDigest/
// mergeDigests/clusterEntries/rankClusters exactly as bee_feedback.mjs did —
// no logic change there. NO collection, redaction, or pain logic lives here.

const DEFAULT_FEEDBACK_DIGEST_PATH = path.join('.bee', 'feedback-digest.json');

// Presentation only — groups the digest's own `dropped[].reason` values for a
// human-readable one-line summary. No new drop reasons are invented here; the
// category vocabulary is DROP_REASONS in lib/feedback.mjs.
function summarizeDropped(dropped) {
  const byReason = {};
  for (const d of dropped) {
    const key = (d && d.reason) || 'unknown';
    byReason[key] = (byReason[key] || 0) + 1;
  }
  const keys = Object.keys(byReason).sort();
  if (keys.length === 0) return 'none';
  return keys.map((k) => `${k}: ${byReason[k]}`).join(', ');
}

function feedbackSummaryLine(digest) {
  const { counts, dropped } = digest;
  const entryWord = counts.entries === 1 ? 'entry' : 'entries';
  return `${counts.entries} ${entryWord}, ${counts.dropped} dropped (${summarizeDropped(dropped)})`;
}

function handleFeedbackDigest(root, flags) {
  const digest = buildDigest(root, { now: new Date() });
  const outRel = flags.out ? String(flags.out) : DEFAULT_FEEDBACK_DIGEST_PATH;
  const outPath = path.resolve(root, outRel);
  writeJsonAtomic(outPath, digest);
  return {
    result: { path: outRel, digest },
    text: `Digest written to ${outRel} — ${feedbackSummaryLine(digest)}.`,
  };
}

function handleFeedbackCount(root) {
  const digest = buildDigest(root, { now: new Date() });
  return {
    result: digest.counts,
    text: `${feedbackSummaryLine(digest)}.`,
  };
}

function handleFeedbackCollect(root) {
  const digest = mergeDigests(root, { now: new Date() });
  const foreign = Array.isArray(digest.merged) ? digest.merged.length : 0;
  const suffix = foreign > 0 ? ` + ${foreign} dogfood repo${foreign === 1 ? '' : 's'}` : '';
  return {
    result: digest,
    text: `Merged digest — ${feedbackSummaryLine(digest)}${suffix}.`,
  };
}

function handleFeedbackRank(root) {
  const digest = mergeDigests(root, { now: new Date() });
  const clusters = clusterEntries(digest);
  const ranked = rankClusters(clusters);
  const top = ranked.length > 0 ? ranked[0] : null;
  const topWord = top ? `top rank ${top.rank} (pain ${top.pain} × frequency ${top.frequency} × corroboration ${top.corroboration})` : 'no clusters';
  return {
    result: ranked,
    text: `${ranked.length} cluster${ranked.length === 1 ? '' : 's'} — ${topWord}.`,
  };
}

// Per-group usage fallback (dispatcher-unify du-1): the shim always supplies
// the group token, so the generic no-command path can never fire for helper
// calls. When a leading group token resolves to no registry entry, its group's
// fallback emits the legacy "Use:" line byte-exact and exits non-zero.
function stateUsageFallback(leading) {
  const verb = leading[1];
  if (verb === 'worker') {
    const sub = leading[2];
    return `Unknown worker action "${sub || '(missing)'}". Use: add, update, remove, clear, prune.`;
  }
  return `Unknown command "${verb || '(missing)'}". Use: set, gate, worker, scribing-run, start-feature.`;
}

function backlogUsageFallback(leading) {
  const verb = leading[1];
  return `Unknown command "${verb || '(missing)'}". Use: counts, rank, badges, add.`;
}

function captureUsageFallback(leading) {
  const verb = leading[1];
  return `Unknown command "${verb || '(missing)'}". Use: add, list, flush, count.`;
}

// bee_reviews.mjs's own 'candidate' verb has a nested sub-action ('add')
// with its own distinct legacy error text (bee_reviews.mjs:186-189); every
// other unknown top-level verb falls through to the default review-modes
// message (bee_reviews.mjs:213-217), preserved byte-exact including its
// trailing "(review modes: ...)" annotation (DB3).
function reviewsUsageFallback(leading) {
  const verb = leading[1];
  if (verb === 'candidate') {
    const sub = leading[2];
    return `Unknown "candidate" subcommand "${sub || '(missing)'}". Use: candidate add.`;
  }
  return (
    `Unknown command "${verb || '(missing)'}". Use: create, list, show, record, candidate add, candidates, status. ` +
    `(review modes: ${REVIEW_MODES.join(', ')})`
  );
}

function feedbackUsageFallback(leading) {
  const verb = leading[1];
  return `Unknown command "${verb || '(missing)'}". Use: digest, count, collect, rank.`;
}

// Legacy-4 group fallbacks (dispatcher-unify du-4): bee_cells.mjs/
// bee_reservations.mjs/bee_decisions.mjs are now shims, so their own
// default-case "Unknown command ... Use: ..." messages (previously emitted
// by each helper's own run() switch) must be reproduced byte-exact here —
// the DA5 bijection probe (test_bee_cli.mjs) still spawns the shims
// directly and parses this exact stderr line.
function cellsUsageFallback(leading) {
  const verb = leading[1];
  return `Unknown command "${verb || '(missing)'}". Use: list, ready, show, add, update, claim, verify, cap, block, drop, tier, judge.`;
}

function reservationsUsageFallback(leading) {
  const verb = leading[1];
  return `Unknown command "${verb || '(missing)'}". Use: reserve, release, list, sweep.`;
}

function decisionsUsageFallback(leading) {
  const verb = leading[1];
  return `Unknown command "${verb || '(missing)'}". Use: log, supersede, redact, active, search.`;
}

const GROUP_USAGE_FALLBACKS = {
  cells: cellsUsageFallback,
  reservations: reservationsUsageFallback,
  decisions: decisionsUsageFallback,
  state: stateUsageFallback,
  backlog: backlogUsageFallback,
  capture: captureUsageFallback,
  reviews: reviewsUsageFallback,
  feedback: feedbackUsageFallback,
};

const HANDLERS = {
  status: handleStatus,
  'cells.list': handleCellsList,
  'cells.ready': handleCellsReady,
  'cells.show': handleCellsShow,
  'cells.add': handleCellsAdd,
  'cells.update': handleCellsUpdate,
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
  'state.set': handleStateSet,
  'state.gate': handleStateGate,
  'state.worker.add': handleStateWorkerAdd,
  'state.worker.update': handleStateWorkerUpdate,
  'state.worker.remove': handleStateWorkerRemove,
  'state.worker.clear': handleStateWorkerClear,
  'state.worker.prune': handleStateWorkerPrune,
  'state.scribing-run': handleStateScribingRun,
  'state.start-feature': handleStateStartFeature,
  'backlog.counts': handleBacklogCounts,
  'backlog.rank': handleBacklogRank,
  'backlog.badges': handleBacklogBadges,
  'backlog.add': handleBacklogAdd,
  'capture.add': handleCaptureAdd,
  'capture.list': handleCaptureList,
  'capture.flush': handleCaptureFlush,
  'capture.count': handleCaptureCount,
  'reviews.create': handleReviewsCreate,
  'reviews.list': handleReviewsList,
  'reviews.show': handleReviewsShow,
  'reviews.record': handleReviewsRecord,
  'reviews.candidate.add': handleReviewsCandidateAdd,
  'reviews.candidates': handleReviewsCandidates,
  'reviews.status': handleReviewsStatus,
  'feedback.digest': handleFeedbackDigest,
  'feedback.count': handleFeedbackCount,
  'feedback.collect': handleFeedbackCollect,
  'feedback.rank': handleFeedbackRank,
};

// ─── argv parsing: "bee <group> [<action>] [--flag value|--flag=value ...]" ─
// The flag-alone boolean set is the closed union of the helper files' own
// hardcoded boolean-flag lists (bee_cells: json/stdin/behavior-change/
// evidence-stdin; bee_reservations: json/active-only; bee_decisions: json;
// bee_state: json/dry-run; bee_backlog: json/write) — every OTHER flag, even
// one the registry declares as JSON-Schema type "boolean" (e.g. cells.verify's
// --passed), takes an explicit "true"/"false" argument exactly as the
// original CLIs parse it; this keeps `bee cells verify ... --passed true`
// byte-parity-correct. `dry-run` MUST be here or `state worker prune
// --dry-run --json` would consume `--json` as the value of `--dry-run`
// (bee_state.mjs parsed it boolean-alone too); `write` MUST be here for the
// same reason on `backlog rank --write --json` / `backlog badges --write --json`
// (bee_backlog.mjs parsed it boolean-alone too).
export const FLAG_ALONE_BOOLEANS = new Set(['json', 'stdin', 'behavior-change', 'evidence-stdin', 'active-only', 'dry-run', 'write']);

export function splitCommandTokens(argv) {
  const leading = [];
  let i = 0;
  while (i < argv.length && !argv[i].startsWith('--')) {
    leading.push(argv[i]);
    i += 1;
  }
  return { leading, rest: argv.slice(i) };
}

/**
 * Longest-prefix match over the registry names, so a 3-token command like
 * "state worker add" resolves to state.worker.add while a 2-token one like
 * "cells ready" resolves to cells.ready and a no-subcommand group like
 * "status" resolves to status (with any trailing tokens as `extra`). When no
 * prefix matches a registry entry, fall back to the legacy shaping (bare token
 * for length 1, "<group>.<verb>" for length ≥ 2) so the unknown-command /
 * nearest-match / group-usage-fallback paths downstream behave as before.
 */
export function resolveCommand(leading) {
  if (leading.length === 0) return { commandName: null, extra: [] };
  const names = new Set(COMMAND_REGISTRY.map((e) => e.name));
  for (let n = leading.length; n >= 1; n -= 1) {
    const candidate = leading.slice(0, n).join('.');
    if (names.has(candidate)) return { commandName: candidate, extra: leading.slice(n) };
  }
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
    // Group-usage fallback (du-1): a leading group token that resolves to no
    // registry entry (bare group, unknown verb, or unknown nested action)
    // emits that group's legacy "Use:" line byte-exact on stderr — the shim
    // always supplies the group token, so the generic no-command path can
    // never fire for helper calls. The full `leading` tokens (not `extra`) are
    // passed so the fallback can reconstruct the attempted verb/sub-action.
    const group = commandName.includes('.') ? commandName.split('.')[0] : commandName;
    const fallback = GROUP_USAGE_FALLBACKS[group];
    if (fallback) {
      return emitError(fallback(leading), jsonRequested);
    }
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

  // A resolved entry with leftover leading tokens is a stray argument (e.g.
  // "cells ready foo") — refuse before dispatch. Ordered after the group
  // fallback so a nested-action miss ("state worker shave") reaches the
  // fallback's richer legacy message instead of this generic one.
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

  // After a successful parse, the authoritative "was --json requested" signal
  // is parsed.json, NOT the pre-parse rest-scan (jsonRequested): a non-boolean
  // flag can consume the "--json" token as its value (e.g. the `worker prune
  // --dryrun --json` typo, where --dryrun eats --json), in which case --json is
  // NOT a real flag and errors must go to stderr — byte-parity with the legacy
  // helpers, which read json only from their own parsed args.
  const useJson = parsed.json;

  const validation = validate(entry, parsed.flags);
  if (!validation.ok) {
    const { field, reason, command } = validation.error;
    return emit(
      {
        result: { ok: false, error: validation.error },
        text: `Invalid call to "${command}": ${reason}${field ? ` (--${field})` : ''}.`,
        exitCode: 1,
      },
      useJson,
      drift,
    );
  }

  const handler = HANDLERS[commandName];
  try {
    const response = handler(root, parsed.flags);
    return emit(response, useJson, drift);
  } catch (error) {
    return emitError(error instanceof Error ? error.message : String(error), useJson);
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
