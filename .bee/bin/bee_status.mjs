#!/usr/bin/env node
// bee_status.mjs — read-only scout: onboarding health, state, gates, handoff,
// cell counts, reservations, decisions, staleness, recommended next step.
// Usage: node .bee/bin/bee_status.mjs [--json]

import fs from 'node:fs';
import path from 'node:path';
import {
  BEE_VERSION,
  COMMAND_KEYS,
  GATE_NAMES,
  PHASES,
  isKnownPhase,
  findRepoRoot,
  readConfig,
  readState,
  readHandoff,
  readOnboarding,
  hasStaleAdvisorKey,
  STALE_ADVISOR_KEY_WARNING,
} from './lib/state.mjs';
import { listCells, readyCells, scribingDebt, tierMix, ceilingScarcityWarning } from './lib/cells.mjs';
import { captureQueue } from './lib/capture.mjs';
import { readBacklogCounts } from './lib/backlog.mjs';
import { listReservations } from './lib/reservations.mjs';
import { activeDecisions, datamark } from './lib/decisions.mjs';
import { listCandidates, listReviews, deriveCandidateStatus } from './lib/reviews.mjs';

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

// Slot values may be a model name, null, {model, effort}, or {kind:'cli'}
// (decisions 0019/0021) — render each honestly in one token.
function formatSlot(value) {
  if (value == null) return 'null';
  if (typeof value === 'string') return value;
  if (value.kind === 'cli') return `cli(${String(value.command).split(/\s+/)[0]})`;
  if (value.model) return value.effort ? `${value.model}@${value.effort}` : value.model;
  return 'null';
}

function renderText(status) {
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

function main(argv) {
  const json = argv.includes('--json');
  try {
    const root = findRepoRoot(process.cwd());
    if (!root) {
      throw new Error(
        'No bee repo root found (no .bee/onboarding.json or .git up the tree). Run bee-hive onboarding.',
      );
    }
    const status = buildStatus(root);
    process.stdout.write(json ? `${JSON.stringify(status, null, 2)}\n` : `${renderText(status)}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) process.stdout.write(`${JSON.stringify({ error: message })}\n`);
    else process.stderr.write(`${message}\n`);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
