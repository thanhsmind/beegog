// inject.mjs — the single source for session/prompt context injection.
// Used by the SessionStart hook, the AGENTS.md block, and bee_status.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJson, writeJsonAtomic } from './fsutil.mjs';
import { BEE_VERSION, GATE_NAMES, readState, readHandoff, readOnboarding } from './state.mjs';
import { activeDecisions, datamark } from './decisions.mjs';

const INJECT_INTERVAL_MS = 30 * 60 * 1000;

function injectCachePath(root) {
  return path.join(root, '.bee', '.inject-cache.json');
}

function stableHash(fields) {
  return crypto.createHash('sha1').update(JSON.stringify(fields)).digest('hex');
}

function criticalPatternsDigest(root, maxLines = 10) {
  const file = path.join(root, 'docs', 'history', 'learnings', 'critical-patterns.md');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('<!--'));
  if (lines.length === 0) return null;
  return lines.slice(0, maxLines);
}

function gatesLine(state) {
  return GATE_NAMES.map(
    (gate) => `${gate}: ${state.approved_gates?.[gate] === true ? 'approved' : 'pending'}`,
  ).join(' | ');
}

export function buildSessionPreamble(root) {
  const state = readState(root);
  const onboarding = readOnboarding(root);
  const handoff = readHandoff(root);
  const lines = [];

  lines.push(`## bee v${BEE_VERSION}`);
  if (!onboarding) {
    lines.push('- Onboarding: MISSING — run bee-hive onboarding before anything else.');
  } else if (onboarding.bee_version && onboarding.bee_version !== BEE_VERSION) {
    lines.push(
      `- Onboarding: installed at bee ${onboarding.bee_version} but plugin is ${BEE_VERSION} — re-run onboarding to refresh vendored helpers.`,
    );
  } else {
    lines.push(`- Onboarding: ok (bee ${onboarding.bee_version || BEE_VERSION})`);
  }
  lines.push(
    `- Phase: ${state.phase} | Mode: ${state.mode ?? 'none'} | Feature: ${state.feature ?? 'none'}`,
  );
  lines.push(`- Gates: ${gatesLine(state)}`);

  if (handoff) {
    lines.push('');
    lines.push('### HANDOFF present — present it and WAIT — never auto-resume');
    lines.push(
      `- Phase: ${handoff.phase ?? 'unknown'} | Feature: ${handoff.feature ?? 'unknown'} | Mode: ${handoff.mode ?? 'unknown'}`,
    );
    if (Array.isArray(handoff.cells_in_flight) && handoff.cells_in_flight.length > 0) {
      lines.push(`- Cells in flight: ${handoff.cells_in_flight.join(', ')}`);
    }
    if (handoff.next_action) lines.push(`- Saved next action: ${handoff.next_action}`);
  }

  const digest = criticalPatternsDigest(root);
  if (digest) {
    lines.push('');
    lines.push('### Critical patterns (digest)');
    for (const line of digest) lines.push(line);
  }

  let decisions = [];
  try {
    decisions = activeDecisions(root, { recent: 3 });
  } catch {
    decisions = [];
  }
  if (decisions.length > 0) {
    lines.push('');
    lines.push('### Recent decisions');
    for (const event of decisions) {
      lines.push(`- ${datamark(event.decision)} (${event.date})`);
    }
  }

  lines.push('');
  lines.push('Run `node .bee/bin/bee_status.mjs --json` for detail. Route via bee-hive.');
  return lines.join('\n');
}

export function buildPromptReminder(root) {
  const state = readState(root);
  const firstOpenGate =
    GATE_NAMES.find((gate) => state.approved_gates?.[gate] !== true) ?? null;
  const fields = {
    phase: state.phase,
    mode: state.mode ?? null,
    next_action: state.next_action ?? null,
    first_open_gate: firstOpenGate,
  };

  const lines = [`bee: phase=${fields.phase}${fields.mode ? ` mode=${fields.mode}` : ''}`];
  if (fields.next_action) lines.push(`next: ${fields.next_action}`);
  if (fields.first_open_gate) lines.push(`gate pending: ${fields.first_open_gate}`);

  return { text: lines.slice(0, 3).join('\n'), hash: stableHash(fields) };
}

/** Inject when the hash differs from the last injection or >30 min elapsed. */
export function shouldInject(root, key, hash) {
  const cache = readJson(injectCachePath(root), {}) || {};
  const entry = cache[key];
  if (!entry) return true;
  if (entry.hash !== hash) return true;
  const lastMs = Date.parse(entry.at);
  if (!Number.isFinite(lastMs)) return true;
  return Date.now() - lastMs > INJECT_INTERVAL_MS;
}

export function markInjected(root, key, hash) {
  const cache = readJson(injectCachePath(root), {}) || {};
  cache[key] = { hash, at: new Date().toISOString() };
  writeJsonAtomic(injectCachePath(root), cache);
}
