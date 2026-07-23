// inject.mjs — the single source for session/prompt context injection.
// Used by the SessionStart hook, the AGENTS.md block, and bee_status.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJson, writeJsonAtomic, removeFileIfExists } from './fsutil.mjs';
import {
  BEE_VERSION,
  COMMAND_KEYS,
  GATE_NAMES,
  readConfig,
  resolveProductRoot,
  cacheFilePath,
  bypassLevel,
  bypassBanner,
  readState,
  readHandoff,
  readOnboarding,
  resolvePipeline,
  listLanes,
} from './state.mjs';
import { activeDecisions, datamark } from './decisions.mjs';
import { readBacklogCounts } from './backlog.mjs';
import { scribingDebt, ceilingScarcityWarning, CEILING_MAX_SHARE } from './cells.mjs';
import { captureQueue } from './capture.mjs';
import { collectConcepts, bundleMode, bundleDir } from './knowledge.mjs';

const INJECT_INTERVAL_MS = 30 * 60 * 1000;

function injectCachePath(root) {
  return cacheFilePath(root, 'inject-cache.json');
}

// Legacy location (pre-#11): the dedup cache used to sit directly in `.bee/` root.
function legacyInjectCachePath(root) {
  return path.join(root, '.bee', '.inject-cache.json');
}

function stableHash(fields) {
  return crypto.createHash('sha1').update(JSON.stringify(fields)).digest('hex');
}

// ─── critical-patterns digest (okf-integration-close-f4, D1) ────────────────
//
// The digest routes on the ONE bundle predicate, like every other doc-tree
// consumer (G12: never an existsSync, never a rule re-derived in prose).
//
//   * BUNDLE mode -> the bundle's own generated root index, its "## Critical
//     patterns" section (the live equivalent D21/D34 established). The retired
//     file is now a POINTER STUB, so reading it handed every session the
//     stub's forwarding address where the lessons should be — six lines of
//     redirect prose and four of YAML, not one pattern.
//   * NO bundle   -> byte-identical to before this cell: the first `maxLines`
//     non-blank, non-comment lines of docs/history/learnings/critical-patterns.md.
//
// Same line cap in both branches.
function criticalPatternsDigest(root, maxLines = 10, bundle = bundleMode(root)) {
  return bundle
    ? bundleCriticalPatternsDigest(root, maxLines)
    : legacyCriticalPatternsDigest(root, maxLines);
}

function legacyCriticalPatternsDigest(root, maxLines) {
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

const CRITICAL_PATTERNS_HEADING = '## Critical patterns';

// The index rows sit in DATE order (concept filenames are date-prefixed) and
// there are ~50 of them, so a naive first-N cut would surface the ten OLDEST
// lessons forever and never a recent one. The bundle digest therefore states
// the TOTAL, lists the N most recent rows newest-first, and names the full
// index. It deliberately does NOT rank: relevance ranking is `knowledge
// context`'s job and needs a work item to rank against, which a session
// preamble does not have. A bundle with no generated index — or an index with
// no critical section — degrades to silence; this preamble is orientation,
// never a place to fail a session.
function bundleCriticalPatternsDigest(root, maxLines) {
  let text;
  try {
    text = fs.readFileSync(path.join(bundleDir(root), 'index.md'), 'utf8');
  } catch {
    return null;
  }
  const all = text.split(/\r?\n/).map((line) => line.trim());
  const start = all.indexOf(CRITICAL_PATTERNS_HEADING);
  if (start === -1) return null;
  const rows = [];
  for (let i = start + 1; i < all.length; i += 1) {
    if (all[i].startsWith('## ')) break;
    // Index links are bundle-relative; the preamble is read from the repo
    // root, so rewrite them to paths a session can open as printed.
    if (all[i].startsWith('- ')) rows.push(all[i].replace(/\]\((?!https?:|\/)/g, '](docs/knowledge/'));
  }
  if (rows.length === 0) return null;
  // maxLines covers the whole section body: the count line plus the newest rows.
  const recent = rows.slice(-Math.max(1, maxLines - 1)).reverse();
  return [
    `- ${rows.length} critical pattern(s) in the bundle — the ${recent.length} most recent below; full list: docs/knowledge/index.md ("Critical patterns").`,
    ...recent,
  ];
}

const PROJECT_MAP_FILES = [
  ['system-overview.md', 'System overview'],
  ['reading-map.md', 'Reading map'],
];

// D5: pointers + specced-area count, never content; 2–4 lines including the heading.
// D10: one PBI line rides the section (in either branch) when docs/backlog.md
// exists, so the cap is 2–5 lines including the heading.
//
// okf-integration-close-f4 D2: the section branches on the ONE bundle predicate.
// In bundle mode it names the BUNDLE as the thing to read before the code and
// counts what the bundle actually holds; docs/specs/ is described as what it now
// is — the read-only compatibility surface. With no bundle every line below is
// byte-identical to before this cell, missing-map warning included. The PBI line
// rides BOTH branches, and the 2–5 line cap holds in both.
function projectMapLines(root, bundle = bundleMode(root)) {
  const lines = ['### Project map'];
  for (const line of bundle ? bundleProjectMapLines(root) : specProjectMapLines(root)) {
    lines.push(line);
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

function specProjectMapLines(root) {
  // docs/specs/ is a PRODUCT doc tree — resolves against the product root (= bee
  // root for ordinary repos; the nested product repo under repo-divorce, #14).
  const specsDir = path.join(resolveProductRoot(root), 'docs', 'specs');
  const present = PROJECT_MAP_FILES.filter(([file]) =>
    fs.existsSync(path.join(specsDir, file)),
  );
  const lines = [];
  if (present.length === 0) {
    // Area specs alone do not answer Q1/Q2 — the warning fires whenever both maps are missing.
    lines.push(
      '- Project map missing (Q1/Q2 unanswerable from repo) — bee-scribing bootstrap available.',
    );
    return lines;
  }
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
  return lines;
}

// Two lines, never more: the bundle pointer and what it holds. Counts come from
// the ONE inventory path (D12) rather than a second directory walk, and areas are
// the distinct `areas/<slug>/` homes those concepts actually occupy — derived,
// never a hand-maintained list.
function bundleProjectMapLines(root) {
  const lines = ['- Knowledge bundle: docs/knowledge/ (index: docs/knowledge/index.md) — read the bundle before the code'];
  let concepts;
  try {
    concepts = collectConcepts(root);
  } catch {
    return lines;
  }
  const areas = new Set();
  for (const concept of concepts) {
    const match = /^areas\/([^/]+)\//.exec(concept.path);
    if (match) areas.add(match[1]);
  }
  lines.push(
    `- Bundle holds: ${areas.size} area(s), ${concepts.length} concept(s) (docs/specs/ is the read-only compatibility surface)`,
  );
  return lines;
}

// ─── knowledge-context startup bridge (okf-foundation okf-8, D38) ───────────
//
// `bee knowledge context` only pays off if a session is TOLD to run it, so the
// preamble carries the instruction. Two disciplines hold it in shape:
//
//   * It is a POINTER, never the manifest — a heading plus two lines. The whole
//     bargain is spending a few tokens here to save thousands of scanned ones;
//     inlining entries would spend the savings at the door.
//   * Silence beats a nag. No active feature means nothing is emitted at all;
//     an active feature with no work item gets exactly ONE offer line, because
//     "author a work item" is a real next action, not noise.
//
// Resolution reuses knowledge.mjs's single inventory path (D12: no second
// frontmatter parser anywhere in bee), and a broken bundle degrades to silence —
// this preamble is orientation, never a place to fail a session.
const KNOWLEDGE_CONTEXT_BUDGET = 20000;

// The two phases where no work is open: nothing started, and the last feature
// closed. Same pair the intake gate uses — a stale `feature` string outlives
// both, which is why the phase, not the feature, decides.
const NO_WORK_PHASES = new Set(['idle', 'compounding-complete']);

function knowledgeContextLines(root, record) {
  const feature = typeof record.feature === 'string' ? record.feature.trim() : '';
  if (!feature || NO_WORK_PHASES.has(record.phase)) return [];

  let hasWorkItem = false;
  try {
    hasWorkItem = collectConcepts(root).some((concept) => {
      if (concept.data.type !== 'bee.work-item') return false;
      const bee = concept.data.bee && typeof concept.data.bee === 'object' ? concept.data.bee : {};
      return bee.id === feature;
    });
  } catch {
    return [];
  }

  if (!hasWorkItem) {
    return [
      `- No knowledge work item for "${feature}" — offer to author docs/knowledge/work/${feature}/work-item.md (template: docs/knowledge/areas/okf-profile/concept-model-and-authoring.md, Templates) so the next session starts from curated context.`,
    ];
  }
  return [
    '### Knowledge context — load it before code',
    `- \`node .bee/bin/bee.mjs knowledge context --work ${feature} --budget ${KNOWLEDGE_CONTEXT_BUDGET}\``,
    "- Run it and read the manifest's files before touching code — that manifest is this feature's curated context, and it replaces scanning docs/history.",
  ];
}

function gatesLine(state) {
  // codex-loop (advisor #54): the PREAMBLE was missed when the reminder stopped
  // reporting the on-demand review gate — it still listed "review: pending" at
  // startup and after every compaction, which is where a long session re-reads
  // its objective and is most vulnerable to a phantom-workflow signal. Gate 4 is
  // user-invoked: it is pending only inside a live review session, and a terminal
  // record owes no gate at all. Same rule, both surfaces.
  const terminal = NO_WORK_PHASES.has(state.phase);
  const shown = terminal
    ? []
    : state.phase === 'reviewing'
      ? GATE_NAMES
      : GATE_NAMES.filter((g) => g !== 'review');
  if (shown.length === 0) return 'none pending (no active work)';
  return shown
    .map((gate) => `${gate}: ${state.approved_gates?.[gate] === true ? 'approved' : 'pending'}`)
    .join(' | ');
}

// fresh-session-handoff fsh-6 (D4): OPTIONAL sessionId — omitted (today's
// exact call shape) resolves to the default pipeline, byte-identical to
// before this cell. A bound session's phase/mode/feature/gates come from its
// lane record instead (resolvePipeline), plus a one-line summary naming any
// OTHER active lanes (never the bound session's own). An unresolvable
// binding (invalid/missing/corrupt lane) falls back to the default record —
// this preamble is informational only, never a place to block a session on
// a lane-resolution gap.
//
// fresh-session-handoff fsh-10 (D1, PURITY PIN panel W2): OPTIONAL
// handoffOutcome — this builder stays a PURE renderer, it never mutates
// anything and never calls adoptHandoff itself. The caller (the
// SessionStart hook) performs the source-gated adoption attempt and passes
// its typed result in. Contract:
//   - handoffOutcome omitted/null: no adoption was even attempted (no
//     sessionId, no handoff, or the handoff's kind isn't 'planned-next') —
//     every existing handoff rendering (pause, or a missing/unknown kind
//     normalized to pause) stays BYTE-IDENTICAL to before this cell. This is
//     also what keeps a payload with no session_id byte-identical even when
//     a planned-next handoff sits on disk (fsh-10 hook-contract row d).
//   - handoffOutcome.ok === true (a real adoptHandoff success): the wait
//     block is REPLACED by a start-now block naming the adopted cell, its
//     lane, and its verify command — the fresh session begins that task
//     without asking (D1).
//   - handoffOutcome.ok === false (adoption was attempted and refused/lost,
//     including a non-qualifying source or a same-session no-op — see the
//     hook): the pause-style wait block renders exactly as it does for a
//     genuine pause handoff, PLUS one extra line naming the refusal reason —
//     still "present it and WAIT", never a fabricated start-now.
export function buildSessionPreamble(root, { sessionId = null, handoffOutcome = null } = {}) {
  const state = readState(root);
  const onboarding = readOnboarding(root);
  const handoff = readHandoff(root);
  const pipeline = resolvePipeline(root, { sessionId });
  const pipelineRecord = pipeline.ok ? pipeline.record : state;
  // okf-integration-close-f4 D1/D2/D3: the ONE predicate, resolved once and
  // handed to every section that branches on it (G12). Fail-safe direction is
  // the legacy branch — orientation never fails a session.
  let bundle = false;
  try {
    bundle = bundleMode(root) === true;
  } catch {
    bundle = false;
  }
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
    `- Phase: ${pipelineRecord.phase} | Mode: ${pipelineRecord.mode ?? 'none'} | Feature: ${pipelineRecord.feature ?? 'none'}`,
  );
  lines.push(`- Gates: ${gatesLine(pipelineRecord)}`);
  if (pipeline.ok && pipeline.source === 'lane') {
    const others = listLanes(root).filter(
      (lane) =>
        lane.feature !== pipeline.feature && lane.phase !== 'idle' && lane.phase !== 'compounding-complete',
    );
    if (others.length > 0) {
      lines.push(
        `- ${others.length} other active lane(s): ${others.map((lane) => lane.feature).join(', ')}`,
      );
    }
  }
  const bypass = bypassLevel(root);
  if (bypass !== 'off') {
    lines.push(`- ${bypassBanner(bypass)}`);
    if (bypass === 'full' || bypass === 'total') {
      lines.push(
        `  The agent does NOT stop for these gates — it records the recommended choice, logs a one-line audit decision, and continues. ${
          bypass === 'total'
            ? 'This includes secret-file reads and review P1 findings: nothing pauses for the human.'
            : 'Only reading a secret-shaped file and a review P1 finding still pause for the human.'
        }`,
      );
    }
  }
  if (handoffOutcome && handoffOutcome.ok === true) {
    // fsh-10 (D1): adoption succeeded — start-now, no confirmation needed.
    // NOTE: adoptHandoff already cleared .bee/HANDOFF.json as part of the
    // successful adopt (fsh-9's clear-after-adopt), so `handoff` above is
    // already null by the time this renders — handoffOutcome (passed in by
    // the hook) is the only surviving record of what happened, which is
    // exactly why it is a parameter rather than re-derived here.
    const nextCellId = handoffOutcome.next_cell ?? 'unknown';
    const nextCell = readJson(path.join(root, '.bee', 'cells', `${nextCellId}.json`), null);
    lines.push('');
    lines.push('### PLANNED-NEXT ADOPTED — starting now, no confirmation needed (D1)');
    lines.push(`- Cell: ${nextCellId}${nextCell?.title ? ` — ${nextCell.title}` : ''}`);
    lines.push(`- Lane: ${nextCell?.lane ?? 'unknown'}`);
    if (nextCell?.verify) lines.push(`- Verify: \`${nextCell.verify}\``);
  } else if (handoff) {
    // Byte-identical to before this cell whenever handoffOutcome is null
    // (pause, a missing/unknown kind normalized to pause, or no adoption
    // attempted at all — e.g. no session_id). A planned-next handoff whose
    // adoption was attempted and refused/lost adds one reason line, still a
    // wait block (fsh-10, D1).
    lines.push('');
    lines.push('### HANDOFF present — present it and WAIT — never auto-resume');
    lines.push(
      `- Phase: ${handoff.phase ?? 'unknown'} | Feature: ${handoff.feature ?? 'unknown'} | Mode: ${handoff.mode ?? 'unknown'}`,
    );
    if (Array.isArray(handoff.cells_in_flight) && handoff.cells_in_flight.length > 0) {
      lines.push(`- Cells in flight: ${handoff.cells_in_flight.join(', ')}`);
    }
    if (handoff.next_action) lines.push(`- Saved next action: ${handoff.next_action}`);
    if (handoff.kind === 'planned-next' && handoffOutcome && handoffOutcome.ok === false) {
      lines.push(`- Adoption not applied: ${handoffOutcome.reason ?? handoffOutcome.code ?? 'unknown reason'}`);
    }
  }

  const commands = readConfig(root).commands || {};
  const recordedKeys = COMMAND_KEYS.filter((key) => commands[key]);
  if (recordedKeys.length > 0) {
    lines.push('');
    lines.push('### Standard commands (host project)');
    for (const key of recordedKeys) lines.push(`- ${key}: \`${commands[key]}\``);
    if (commands.verify) {
      lines.push(
        '- Baseline gate: before your first `cells claim` of this session, run the verify command once; a red baseline is surfaced and becomes its own fix-first tiny cell — never build on red. The claim is the trigger, not arrival: a session that claims no cell owes no baseline run.',
      );
    }
  }

  // okf-8 (D38): the startup bridge sits ahead of the project map — the
  // curated manifest is what a session should reach for first, and the map is
  // the fallback for everything the manifest does not cover.
  const knowledge = knowledgeContextLines(root, pipelineRecord);
  if (knowledge.length > 0) {
    lines.push('');
    for (const line of knowledge) lines.push(line);
  }

  lines.push('');
  for (const line of projectMapLines(root, bundle)) lines.push(line);

  // D11: capture-mode spine — settled behavior not yet in the state layer.
  // okf-integration-close-f4 D3: the nudge names the RESOLVED target rather
  // than hardcoding docs/specs/ — a bundle repo is told where its knowledge
  // actually goes, and a repo without one still reads exactly as it did.
  const debt = scribingDebt(root);
  if (debt.count > 0) {
    lines.push('');
    lines.push(`### Scribing debt: ${debt.count} behavior_change cell(s) uncaptured`);
    lines.push(
      `- ${debt.cells.join(', ')} capped since the last scribing run — run bee-scribing capture now; settled behavior belongs in ${bundle ? 'docs/knowledge/' : 'docs/specs/'} before it evaporates (decision 0011).`,
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

  const digest = criticalPatternsDigest(root, 10, bundle);
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
  lines.push('Everything above is already read — do not re-fetch it. Run `node .bee/bin/bee.mjs status --json` (and `decisions active`) yourself when you are about to ROUTE WORK — claim, plan, change phase — or need detail this block does not carry (agent-run — never hand bee commands to the user). Route via bee-hive.');
  return lines.join('\n');
}

// fresh-session-handoff fsh-6 (D4): same optional-sessionId shape as
// buildSessionPreamble above — omitted stays byte-identical to today; a bound
// session's phase/mode/next_action/gate come from its lane, with the same
// fail-open fallback to the default record on an unresolvable binding.
export function buildPromptReminder(root, { sessionId = null } = {}) {
  const pipeline = resolvePipeline(root, { sessionId });
  const record = pipeline.ok ? pipeline.record : readState(root);
  // P0 (codex-loop-p0): the reminder must not report `review` as a pending gate
  // outside a review session. Gate 4 is on-demand and user-invoked (SPEC R1/R8):
  // once gates 1-3 are approved it is ALWAYS unapproved, so walking all four made
  // the reminder print "gate pending: review" on every single turn — including
  // at idle with nothing active — a false "there is unfinished workflow" signal
  // that pulls the agent back into the pipeline. Walk the pre-execution gates;
  // include `review` only when a review session is actually running (phase
  // `reviewing`), where it is a genuine open gate.
  // codex-loop (advisor #54): a TERMINAL record has no pending gate at all. At
  // `idle`/`compounding-complete` there is no feature, so reporting "gate pending:
  // context" announces an approval owed for work that does not exist — the same
  // phantom-workflow signal as the review gate, one gate over. Terminal states
  // report no gate; only an ACTIVE pipeline can owe one.
  const terminal = NO_WORK_PHASES.has(record.phase);
  const reminderGates = terminal
    ? []
    : record.phase === 'reviewing'
      ? GATE_NAMES
      : GATE_NAMES.filter((g) => g !== 'review');
  const firstOpenGate =
    reminderGates.find((gate) => record.approved_gates?.[gate] !== true) ?? null;
  const fields = {
    phase: record.phase,
    mode: record.mode ?? null,
    next_action: record.next_action ?? null,
    first_open_gate: firstOpenGate,
  };

  const lines = [`bee: phase=${fields.phase}${fields.mode ? ` mode=${fields.mode}` : ''}`];
  if (fields.next_action) lines.push(`next: ${fields.next_action}`);
  if (fields.first_open_gate) lines.push(`gate pending: ${fields.first_open_gate}`);

  return { text: lines.slice(0, 3).join('\n'), hash: stableHash(fields) };
}

/** Inject when the hash differs from the last injection or >30 min elapsed. */
export function shouldInject(root, key, hash) {
  const cache =
    readJson(injectCachePath(root), null) || readJson(legacyInjectCachePath(root), {}) || {};
  const entry = cache[key];
  if (!entry) return true;
  if (entry.hash !== hash) return true;
  const lastMs = Date.parse(entry.at);
  if (!Number.isFinite(lastMs)) return true;
  return Date.now() - lastMs > INJECT_INTERVAL_MS;
}

export function markInjected(root, key, hash) {
  // Migrate transparently: prefer the new .bee/cache/ location, fall back to the
  // legacy root file once so dedup history survives the move (GitHub #11).
  const cache =
    readJson(injectCachePath(root), null) || readJson(legacyInjectCachePath(root), {}) || {};
  cache[key] = { hash, at: new Date().toISOString() };
  writeJsonAtomic(injectCachePath(root), cache);
  removeFileIfExists(legacyInjectCachePath(root));
}
