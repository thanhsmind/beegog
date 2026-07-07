#!/usr/bin/env node
// bee_status.mjs — read-only scout: onboarding health, state, gates, handoff,
// cell counts, reservations, decisions, staleness, recommended next step.
// Usage: node .bee/bin/bee_status.mjs [--json]

import fs from 'node:fs';
import path from 'node:path';
import {
  BEE_VERSION,
  GATE_NAMES,
  PHASES,
  isKnownPhase,
  findRepoRoot,
  readState,
  readHandoff,
  readOnboarding,
} from './lib/state.mjs';
import { listCells, readyCells } from './lib/cells.mjs';
import { listReservations } from './lib/reservations.mjs';
import { activeDecisions, datamark } from './lib/decisions.mjs';

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

  const staleness = [];
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
    handoff,
    cells: counts,
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

function renderText(status) {
  const lines = [
    `bee status (plugin v${BEE_VERSION})`,
    `Onboarding: ${status.onboarding.installed ? `installed (bee ${status.onboarding.bee_version})` : 'MISSING'}${status.onboarding.drift ? ' [version drift]' : ''}`,
    `Phase: ${status.phase} | Mode: ${status.mode ?? 'none'} | Feature: ${status.feature ?? 'none'}`,
    `Gates: ${GATE_NAMES.map((g) => `${g}=${status.gates?.[g] ? 'approved' : 'pending'}`).join(' ')}`,
    `Handoff: ${status.handoff ? 'PRESENT — surface it and WAIT' : 'none'}`,
    `Cells: open=${status.cells.open} claimed=${status.cells.claimed} capped=${status.cells.capped} blocked=${status.cells.blocked}`,
    `Active reservations: ${status.active_reservations.length}`,
    `Critical patterns file: ${status.critical_patterns_present ? 'present' : 'absent'}`,
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
