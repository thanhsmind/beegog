// inject.mjs — the single source for session/prompt context injection.
// Used by the SessionStart hook, the AGENTS.md block, and bee_status.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJson, writeJsonAtomic } from './fsutil.mjs';
import {
  BEE_VERSION,
  COMMAND_KEYS,
  GATE_NAMES,
  readConfig,
  readState,
  readHandoff,
  readOnboarding,
} from './state.mjs';
import { activeDecisions, datamark } from './decisions.mjs';
import { readBacklogCounts } from './backlog.mjs';
import { scribingDebt, ceilingScarcityWarning, CEILING_MAX_SHARE } from './cells.mjs';
import { captureQueue } from './capture.mjs';

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

const PROJECT_MAP_FILES = [
  ['system-overview.md', 'System overview'],
  ['reading-map.md', 'Reading map'],
];

// D5: pointers + specced-area count, never content; 2–4 lines including the heading.
// D10: one PBI line rides the section (in either branch) when docs/backlog.md
// exists, so the cap is 2–5 lines including the heading.
function projectMapLines(root) {
  const specsDir = path.join(root, 'docs', 'specs');
  const present = PROJECT_MAP_FILES.filter(([file]) =>
    fs.existsSync(path.join(specsDir, file)),
  );
  const lines = ['### Project map'];
  if (present.length === 0) {
    // Area specs alone do not answer Q1/Q2 — the warning fires whenever both maps are missing.
    lines.push(
      '- Project map missing (Q1/Q2 unanswerable from repo) — bee-scribing bootstrap available.',
    );
  } else {
    for (const [file, label] of present) lines.push(`- ${label}: docs/specs/${file}`);
    let areaCount = 0;
    try {
      areaCount = fs
        .readdirSync(specsDir, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name.endsWith('.md') &&
            !PROJECT_MAP_FILES.some(([file]) => file === entry.name),
        ).length;
    } catch {
      areaCount = 0;
    }
    lines.push(`- Specced areas: ${areaCount} (docs/specs/ — read the spec before the code)`);
  }
  // D10: PBI line only when docs/backlog.md exists — appended in BOTH branches.
  const backlog = readBacklogCounts(root);
  if (backlog) {
    lines.push(
      `- PBI: ${backlog.done} done / ${backlog.inFlight} in-flight / ${backlog.proposed} proposed`,
    );
  }
  return lines;
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
  if (readConfig(root).gate_bypass === true) {
    lines.push(
      '- ⚡ GATE BYPASS ON — the agent auto-approves Gates 1-3 for tiny/small/standard work (records the recommended choice, logs it, continues). High-risk/hard-gate work, secret reads, and Gate 4 UAT still stop for the human. Turn off with the bee-bypass-gate skill.',
    );
  }
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

  const commands = readConfig(root).commands || {};
  const recordedKeys = COMMAND_KEYS.filter((key) => commands[key]);
  if (recordedKeys.length > 0) {
    lines.push('');
    lines.push('### Standard commands (host project)');
    for (const key of recordedKeys) lines.push(`- ${key}: \`${commands[key]}\``);
    if (commands.verify) {
      lines.push(
        '- Baseline gate: run the verify command once per session before claiming any cell; a red baseline is surfaced and becomes its own fix-first tiny cell — never build on red.',
      );
    }
  }

  lines.push('');
  for (const line of projectMapLines(root)) lines.push(line);

  // D11: capture-mode spine — settled behavior not yet in docs/specs/.
  const debt = scribingDebt(root);
  if (debt.count > 0) {
    lines.push('');
    lines.push(`### Scribing debt: ${debt.count} behavior_change cell(s) uncaptured`);
    lines.push(
      `- ${debt.cells.join(', ')} capped since the last scribing run — run bee-scribing capture now; settled behavior belongs in docs/specs/ before it evaporates (decision 0011).`,
    );
  }

  // Decision 0017: capture stubs queued mid-flow, awaiting their flush pass.
  const queue = captureQueue(root);
  if (queue.count > 0) {
    lines.push('');
    lines.push(`### Capture queue: ${queue.count} stub(s) pending flush`);
    lines.push(
      '- Settlements were stubbed mid-flow (decision 0017) — offer the flush now before new work: bee-scribing drains the queue oldest-first and merges each stub into its area spec.',
    );
  }

  // P7: keep the ceiling model scarce — warn when this feature leans on it too much.
  const scarcity = ceilingScarcityWarning(root);
  if (scarcity) {
    lines.push('');
    lines.push(`### Ceiling-model scarcity: ${scarcity.pct}% of tiered cells on ceiling`);
    lines.push(
      `- ${scarcity.ceiling}/${scarcity.tiered} cells tiered ceiling (> ${Math.round(CEILING_MAX_SHARE * 100)}%) — the cost lever erodes when the strongest model touches most dispatches; re-tier routine cells to generation/extraction (decision 0012).`,
    );
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
  lines.push('Run `node .bee/bin/bee_status.mjs --json` yourself for detail (agent-run — never hand bee commands to the user). Route via bee-hive.');
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
