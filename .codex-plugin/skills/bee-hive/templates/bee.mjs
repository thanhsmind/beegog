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
//   bee cells <list|ready|show|add|claim|verify|cap|block|drop|tier|judge|claim-next|reset-budget|judge-record|schedule> ... [--json]
//   bee reservations <reserve|release|list|sweep> ... [--json]
//   bee decisions <log|supersede|redact|active|search> ... [--json]
//   bee state <set|gate|worker add/update/remove/clear/prune|scribing-run|start-feature|lanes|session list/bind/unbind> ... [--json]
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
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  findRepoRoot,
  readConfig,
  bypassLevel,
  bypassBanner,
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
  checkPhaseTransition,
  checkScribingRunPhase,
  startFeature,
  hasStaleAdvisorKey,
  STALE_ADVISOR_KEY_WARNING,
  validateModelsConfig,
  validateAgentFilesDrift,
  readLaneStrict,
  writeLane,
  listLanes,
  writeHandoff,
  adoptHandoff,
  resolveRoots,
  cacheFilePath,
  advisorRefAnchors,
  advisorRefStale,
} from './lib/state.mjs';
// Lane + session CLI surface (fresh-session-handoff fsh-4, D2/D4): claims.mjs
// stays out of this cell's file scope — these are already-exported read/
// mutate primitives from fsh-3, composed here for presentation (session list)
// and forwarded as-is (bind/unbind), never a second implementation.
import { sessionsDir, readSession, bindSessionLane, unbindSessionLane, resolveSessionId } from './lib/claims.mjs';
import {
  listCells,
  readyCells,
  readCell,
  addCell,
  addCells,
  updateCell,
  claimCellCrossSession,
  recordVerify,
  capCell,
  blockCell,
  dropCell,
  unclaimCell,
  reopenCell,
  setTier,
  judgeCell,
  scribingDebt,
  tierMix,
  ceilingScarcityWarning,
  claimNextCell,
  resetCellBudget,
  deriveChangeClass,
  parseVerificationEvidence,
  evidenceRidesExceptionDoor,
  recordJudgeVerdict,
} from './lib/cells.mjs';
import { reserve, release, listReservations, sweepExpired } from './lib/reservations.mjs';
// D6 — the state.set/gate/worker-add|update|remove/scribing-run verbs below
// each wrap their read-check-write body in this lock (startFeature already
// wraps its own body inside lib/state.mjs); CLI verbs WAIT normally, so no
// maxAttempts override is ever passed here.
import { withStoreLock } from './lib/lock.mjs';
import { writeGrant, removeGrant, listGrants, bootstrapWorktreeStore, createFeatureWorktree, mergeFeatureWorktree } from './lib/worktree-store.mjs';
import { prepareDispatch } from './lib/dispatch-prepare.mjs';
import {
  classifyNativeTransport,
  NATIVE_TRANSPORT_NATIVE_MODEL_OVERRIDE,
  NATIVE_TRANSPORT_NATIVE_BUDGET_ONLY,
  PINNED_MODEL_STATUS,
} from './lib/dispatch-guard.mjs';
import { computeSchedule } from './lib/schedule.mjs';
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
import { readJson, writeJsonAtomic, appendJsonl, hashFile, removeFileIfExists } from './lib/fsutil.mjs';
// perf.mjs is imported ONLY here (never by command-registry.mjs) so it stays
// out of the write-guard fixture's hand-listed VENDORED_LIB_MODULES.
import {
  claudeProjectsRoot,
  resolveTranscript,
  computeMetrics,
  buildSection,
  appendSection,
  readSections,
  writeReport,
  scanCachePath,
  syncSessionsToLog,
  readSessionRecords,
  buildMatrixFromLog,
} from './lib/perf.mjs';
import { KIND_ALIASES, NORMALIZED_KINDS, buildDigest, mergeDigests, clusterEntries, rankClusters } from './lib/feedback.mjs';
import { SCHEMA_VERSION, COMMAND_REGISTRY } from './lib/command-registry.mjs';
import { validate } from './lib/validate-args.mjs';
import { classifySource } from './lib/source-identity.mjs';

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

// Per-lane phase/gates/binding rows for the status payload (fresh-session-
// handoff fsh-6, D4). Reused by handleStateLanes below (this cell composes
// no second implementation): every lane record plus the session ids currently
// bound to it (listSessionRecords/listLanes are already-exported fsh-3
// primitives). Zero lanes on disk -> []: the field is additive, never
// altering any pre-existing status field's shape (D4 zero-lane parity).
function buildLaneRows(root) {
  const lanes = listLanes(root);
  const sessions = listSessionRecords(root);
  const boundBy = {};
  for (const session of sessions) {
    if (typeof session.lane === 'string' && session.lane) {
      (boundBy[session.lane] ||= []).push(session.id);
    }
  }
  return lanes.map((lane) => ({ ...lane, bound_sessions: boundBy[lane.feature] || [] }));
}

// Honest runtime drift (codex-harness-hardening 1c, decisions 485e949a /
// 579bbad7). The false-green it replaces compared only the ledger version
// string against the running constant — both of which a downgrade rewrites in
// lockstep. Instead, compare the LIVE vendored runtime bytes against the
// per-file sha256 the onboarding ledger recorded at install
// (managed.lib + managed.helpers). A content mismatch, a missing/extra managed
// lib file, or a version-string mismatch is drift — even at the same
// bee_version (PROJ-08). Report-only and fail-open: an absent/legacy/unreadable
// ledger degrades to the version-only signal and NEVER throws, so status always
// renders. The managed file set is derived from the recorded map, never
// hand-listed (crit-pattern 20260714).
function computeRuntimeDrift(root, onboardingRaw) {
  const versionDrift = Boolean(
    onboardingRaw && onboardingRaw.bee_version && onboardingRaw.bee_version !== BEE_VERSION,
  );
  const managed = onboardingRaw && onboardingRaw.managed;
  if (!managed || typeof managed !== 'object') {
    // Legacy/absent managed map: fail-open to the version-only signal.
    return { drift: versionDrift, detail: [] };
  }
  const detail = [];
  const checkGroup = (recorded, relDir) => {
    if (!recorded || typeof recorded !== 'object') return;
    for (const [name, recordedHash] of Object.entries(recorded)) {
      const abs = path.join(root, '.bee', 'bin', relDir, name);
      const relPosix = ['.bee', 'bin', relDir, name].filter(Boolean).join('/');
      let live;
      try {
        // hashFile is the SAME function buildManagedVersions (onboard_bee.mjs)
        // records with — one hasher, so recorder and reader can never disagree.
        live = hashFile(abs);
      } catch {
        detail.push(`${relPosix} (missing)`);
        continue;
      }
      if (live !== recordedHash) detail.push(relPosix);
    }
  };
  checkGroup(managed.lib, 'lib');
  checkGroup(managed.helpers, '');
  // File-set drift for the fully-managed lib dir: an extra .mjs on disk that
  // the recorded map does not list. (Helpers live beside non-managed files in
  // .bee/bin, so extra-detection is scoped to lib to avoid false positives.)
  if (managed.lib && typeof managed.lib === 'object') {
    try {
      for (const f of fs.readdirSync(path.join(root, '.bee', 'bin', 'lib'))) {
        // hasOwnProperty, not `in`: a lib file literally named constructor.mjs /
        // toString.mjs would otherwise resolve through Object.prototype and
        // escape extra-detection.
        if (f.endsWith('.mjs') && !Object.prototype.hasOwnProperty.call(managed.lib, f)) {
          detail.push(`.bee/bin/lib/${f} (extra)`);
        }
      }
    } catch {
      /* fail-open: unreadable lib dir degrades to the checks above */
    }
  }
  return { drift: versionDrift || detail.length > 0, detail };
}

// The bee-hive source tree this repo carries, in canonical-first order: a dev
// checkout's real source (skills/), else a host's vendored projection
// (.claude/skills or .agents/skills). Used to classify the repo's source
// identity for the status `source` field (DIST-04, SRC-01).
function findRepoHive(root) {
  for (const segs of [['skills'], ['.claude', 'skills'], ['.agents', 'skills']]) {
    const hive = path.join(root, ...segs, 'bee-hive');
    try {
      if (fs.existsSync(hive)) return hive;
    } catch {
      /* fail-open: unreadable path is simply not this candidate */
    }
  }
  return null;
}

// config-validate (ao-2ai-1) — readJson(file, undefined) does NOT do what it
// looks like: a default parameter (`fallback = null` in fsutil.mjs) fires on
// an explicitly-passed `undefined` argument too, so that call silently
// returns `null` regardless of whether the file is missing or malformed.
// validateModelsConfig needs to tell those two cases apart (undefined = no
// config file at all, the common/harmless case; null = something WAS read
// and is unusable) — so check existence ourselves rather than leaning on a
// readJson fallback value that JS itself collapses back to the default.
function readRawConfigForValidation(root) {
  const file = path.join(root, '.bee', 'config.json');
  return fs.existsSync(file) ? readJson(file, null) : undefined;
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
  // config-validate (ao-2ai-1): the same validator `bee config validate` runs
  // explicitly is also read here so a malformed/prompt-less/unsafe cli-tier
  // config surfaces on every `bee status` — joined onto staleness_warnings,
  // never replacing anything already collected above.
  for (const problem of validateModelsConfig(readRawConfigForValidation(root))) {
    staleness.push(`config validate [${problem.code}]${problem.runtime ? ` models.${problem.runtime}.${problem.slot}:` : ''} ${problem.message}`);
  }
  // W3 drift advisory (ao-3b-2, AO12): a rendered .claude/agents/bee-*.md
  // whose model: frontmatter no longer matches the configured tier. Advisory
  // only — the dispatch itself is already protected by the guard's marker+
  // param equality rule, independent of this check. Appended onto the same
  // staleness_warnings output as the config-validate problems above, never a
  // separate field.
  for (const problem of validateAgentFilesDrift(root, readRawConfigForValidation(root))) {
    staleness.push(`config validate [${problem.code}] ${problem.agent} (${problem.slot}): ${problem.message}`);
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

  const runtimeDrift = computeRuntimeDrift(root, onboardingRaw);
  const repoHive = findRepoHive(root);
  const sourceId = repoHive
    ? classifySource({ hiveDir: repoHive, homeDir: os.homedir() })
    : { kind: 'unknown', root: null };
  return {
    onboarding: {
      installed: Boolean(onboardingRaw),
      bee_version: onboardingRaw?.bee_version ?? null,
      plugin_version: BEE_VERSION,
      drift: runtimeDrift.drift,
      ...(runtimeDrift.detail.length > 0 ? { drift_detail: runtimeDrift.detail } : {}),
    },
    // Source identity of the bee-hive tree this repo carries (DIST-04, SRC-01):
    // report-only — never a decision input here. Same classifier onboarding uses.
    source: { kind: sourceId.kind, root: sourceId.root },
    phase: state.phase,
    mode: state.mode,
    feature: state.feature,
    gates: state.approved_gates,
    gate_bypass: bypassLevel(root) !== 'off',
    gate_bypass_level: bypassLevel(root),
    models: readConfig(root).models,
    tier_mix: tierMix(root, { feature: state.feature || null }),
    ceiling_scarcity: ceilingScarcityWarning(root),
    handoff,
    cells: counts,
    lanes: buildLaneRows(root),
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
    `Onboarding: ${status.onboarding.installed ? `installed (bee ${status.onboarding.bee_version})` : 'MISSING'}${status.onboarding.drift ? ` [drift${status.onboarding.drift_detail ? `: ${status.onboarding.drift_detail.length} file(s)` : ''}]` : ''}`,
    `Phase: ${status.phase} | Mode: ${status.mode ?? 'none'} | Feature: ${status.feature ?? 'none'}`,
    `Gates: ${GATE_NAMES.map((g) => `${g}=${status.gates?.[g] ? 'approved' : 'pending'}`).join(' ')}`,
    ...(status.gate_bypass_level && status.gate_bypass_level !== 'off'
      ? [bypassBanner(status.gate_bypass_level)]
      : []),
    `Handoff: ${status.handoff ? 'PRESENT — surface it and WAIT' : 'none'}`,
    `Cells: open=${status.cells.open} claimed=${status.cells.claimed} capped=${status.cells.capped} blocked=${status.cells.blocked}`,
    // Lanes (fsh-6, D4): additive — zero lanes on disk renders no line at
    // all, keeping every zero-lane text render byte-identical to today.
    ...(status.lanes && status.lanes.length > 0
      ? [
          `Lanes: ${status.lanes
            .map((l) => {
              const gates = GATE_NAMES.map((g) => `${g}=${l.approved_gates[g] ? 'approved' : 'pending'}`).join(' ');
              const bound = l.bound_sessions.length ? ` sessions=${l.bound_sessions.join(',')}` : '';
              return `${l.feature} [${l.phase}] ${gates}${bound}`;
            })
            .join(' | ')}`,
        ]
      : []),
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

// H2 (post-advisor-hardening, learnings 20260717 "the release-manifest trap
// recurred at cell-writing time, second sighting"): a cell whose verify chain
// ends in `release_manifest.mjs --check` but whose `files` omits the manifest
// itself strands a cold worker at a red verify with no sanctioned fix. This
// lint is advisory ONLY — it never refuses the write and never changes the
// exit code (CONTEXT.md H2); it just names the trap and the fix at authoring
// time, the moment `cells add`/`cells update` writes the offending shape.
const RELEASE_MANIFEST_LINT_PATH = 'docs/history/codex-harness-hardening/release-manifest.json';

// Tolerates every malformed shape silently (missing/non-string verify,
// missing/non-array files) — the lint must never throw on a bad cell; that
// judgment belongs to validateNewCell/updateCell's own refusals, not this
// advisory pass.
export function manifestLintWarning(cell) {
  if (!cell || typeof cell !== 'object') return null;
  if (typeof cell.verify !== 'string' || !cell.verify.includes('release_manifest')) return null;
  const files = Array.isArray(cell.files) ? cell.files : [];
  if (files.includes(RELEASE_MANIFEST_LINT_PATH)) return null;
  const id = typeof cell.id === 'string' && cell.id ? cell.id : '(unknown id)';
  return (
    `WARNING: cell "${id}" verify mentions release_manifest but files is missing ` +
    `"${RELEASE_MANIFEST_LINT_PATH}" — a cold worker will hit red verify with no ` +
    `sanctioned fix. FIX: add the manifest path to files; regenerate it only via ` +
    `"node scripts/release_manifest.mjs --write".`
  );
}

// Written straight to stderr (drift-warning precedent at emit()'s
// manifest_changed line below) rather than folded into the handler's
// {result, text} — so the warning surfaces identically whether the caller
// used --json or text output, and never reshapes stdout's machine-parseable
// result (P1 discipline the same file already documents for drift).
function emitManifestLintWarnings(cells) {
  for (const cell of Array.isArray(cells) ? cells : [cells]) {
    const warning = manifestLintWarning(cell);
    if (warning) process.stderr.write(`${warning}\n`);
  }
}

// D3 (self-correcting-loop) — judge-standard sufficiency matrix (F4): advisory
// WARNING at `cells add`/`cells update`, STDERR only, manifest-lint pattern
// (pah-2 emitManifestLintWarnings precedent above) — NEVER folded into the
// JSON result, NEVER a refusal at authoring (CONTEXT D3). change_class
// resolution matches cells.mjs's own deriveChangeClass exactly: an
// unclassified cell (no change_class, no behavior_change:true) gets no check
// at all. Each class' minimum is checked against what is knowable at
// authoring time — the cell's own `verify` string, or (for `behavior`) any
// pre-attached verification_evidence; most `behavior` cells will warn at add
// time since evidence is normally attached later at cap, which is expected
// and harmless (advisory-only).
// Plain case-insensitive substring checks, not \b-anchored regexes — verify
// strings are free-form shell commands where the keyword often sits inside
// an underscore-joined filename (e.g. "test_contract.mjs"), and \w includes
// underscore, so a \b boundary silently fails to match right there. This is
// an advisory heuristic (never a refusal), so a substring match is the right
// amount of precision.
function verifyMentions(cell, ...needles) {
  const verify = String(cell.verify || '').toLowerCase();
  return needles.some((needle) => verify.includes(needle));
}

const JUDGE_STANDARD_MINIMUMS = {
  formatting: {
    label: 'a lint/typecheck check present in verify',
    test: (cell) => verifyMentions(cell, 'lint', 'typecheck', 'tsc'),
  },
  bugfix: {
    label: 'verify names a test path',
    test: (cell) => verifyMentions(cell, 'test', 'spec'),
  },
  behavior: {
    label: 'red_failure_evidence attached (verification_evidence.red_failure_evidence)',
    test: (cell) => {
      const evidence = parseVerificationEvidence(cell.verification_evidence);
      return typeof evidence.red_failure_evidence === 'string' && evidence.red_failure_evidence.trim().length > 0;
    },
  },
  api: {
    label: 'a contract/integration test named in verify',
    test: (cell) => verifyMentions(cell, 'contract', 'integration'),
  },
  security: {
    label: 'a negative-path/security test named in verify',
    test: (cell) => verifyMentions(cell, 'security', 'negative'),
  },
  migration: {
    label: 'forward + rollback checks named in verify',
    test: (cell) => verifyMentions(cell, 'forward') && verifyMentions(cell, 'rollback', 'down', 'revert'),
  },
};

// Tolerates every malformed shape silently, same discipline as
// manifestLintWarning above — the advisory must never throw on a bad cell.
export function judgeStandardWarning(cell) {
  if (!cell || typeof cell !== 'object') return null;
  const changeClass = deriveChangeClass(cell);
  if (!changeClass) return null; // unclassified — no matrix check (CONTEXT D3)
  const minimum = JUDGE_STANDARD_MINIMUMS[changeClass];
  if (!minimum || minimum.test(cell)) return null;
  const id = typeof cell.id === 'string' && cell.id ? cell.id : '(unknown id)';
  return (
    `JUDGE_STANDARD_INSUFFICIENT: cell "${id}" is change_class "${changeClass}" but is missing the matrix ` +
    `minimum — ${minimum.label}. Advisory only (never a refusal at authoring); see CONTEXT.md D3 for the full matrix.`
  );
}

function emitJudgeStandardWarnings(cells) {
  for (const cell of Array.isArray(cells) ? cells : [cells]) {
    const warning = judgeStandardWarning(cell);
    if (warning) process.stderr.write(`${warning}\n`);
  }
}

// F5: at CAP time (not authoring), a behavior-class cell that rode the
// pre-existing deliberate_exceptions door skipped the D3 length/duplicate
// floor entirely (capCell's own contract) — note that on STDERR so it is
// never silent, without turning it into a refusal. Recomputed from the
// returned (already-capped) cell, same recompute-not-side-channel discipline
// as emitManifestLintWarnings/emitJudgeStandardWarnings above.
function emitJudgeStandardCapAdvisory(cell) {
  if (!cell || typeof cell !== 'object') return;
  if (deriveChangeClass(cell) !== 'behavior') return;
  const evidence = parseVerificationEvidence(cell.trace && cell.trace.verification_evidence);
  if (!evidenceRidesExceptionDoor(evidence)) return;
  process.stderr.write(
    `JUDGE_STANDARD_INSUFFICIENT: behavior-class cell "${cell.id}" capped via the deliberate_exceptions door — ` +
      `the D3 red_failure_evidence floor (>=80 chars, non-duplicate) was not enforced for this cap (F5).\n`,
  );
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
    emitManifestLintWarnings(added);
    emitJudgeStandardWarnings(added);
    return {
      result: added,
      text: added.map((c) => `Added ${summarizeCell(c)}`).join('\n'),
    };
  }
  const added = addCell(root, cell);
  emitManifestLintWarnings(added);
  emitJudgeStandardWarnings(added);
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
  // Lint the MERGED cell (updateCell's return), not the raw patch — a patch
  // that only touches `title` still carries the cell's existing verify/files
  // through the merge, and the trap is exactly as live post-update as it was
  // pre-update if the merged shape now qualifies.
  emitManifestLintWarnings(updated);
  emitJudgeStandardWarnings(updated);
  return {
    result: updated,
    text: `Updated ${updated.id} (${Object.keys(patch).join(', ')}).`,
  };
}

// D1 (msh-2): re-backed by the same claims.mjs claim-file-first sequence
// claim-next already uses (via claimCellCrossSession) — the claim file is
// acquired BEFORE the cell JSON flips, so a losing concurrent claimant gets a
// typed CLAIMED refusal naming the owner + expiry instead of silently
// double-owning the cell. D3: --session-id is optional — resolveSessionId
// falls back to CLAUDE_CODE_SESSION_ID, then to a legal sessionless claim
// (single-session flow keeps working exactly as before, with no id at all).
function handleCellsClaim(root, flags) {
  const id = requireFlag(flags, 'id');
  const worker = requireFlag(flags, 'worker');
  const sessionId = resolveSessionId({
    flag: flags['session-id'] !== undefined ? String(flags['session-id']) : undefined,
  });
  const ttl = flags.ttl !== undefined ? Number.parseInt(String(flags.ttl), 10) : undefined;
  if (flags.ttl !== undefined && (!Number.isFinite(ttl) || ttl <= 0)) {
    throw new Error('--ttl must be a positive integer (seconds).');
  }
  const result = claimCellCrossSession(root, { sessionId, worker, cellId: id, ttl });
  if (!result.ok) {
    throw new Error(`claim: ${result.code} — ${result.reason}`);
  }
  return { result: result.cell, text: `Claimed ${result.cell.id} for ${result.cell.trace.worker}.` };
}

// D4 (msh-4): the ownership pair shared by every claim-aware mutator below —
// --session-id resolves like everywhere else (explicit flag, else
// CLAUDE_CODE_SESSION_ID at the lib layer via resolveSessionId), and
// --force-ownership is the audited rescue door (typed refusal otherwise).
function ownershipFlags(flags) {
  return {
    sessionId: flags['session-id'] !== undefined ? String(flags['session-id']) : undefined,
    forceOwnership: flags['force-ownership'] === true,
  };
}

async function handleCellsVerify(root, flags) {
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
  // D1: --signature is the worker-suppliable override for the ledger's
  // failure_signature; omitted, recordVerify falls back to the mechanical
  // normalizer on `output`.
  const signature = flags.signature !== undefined ? String(flags.signature) : null;
  // GH #27.2 (ghf-4): recordVerify's read-mutate-write body now runs under
  // withStoreLock, so it is async — every handler below awaits it (dispatch
  // already does `await handler(...)`, so this only needed the local await).
  const cell = await recordVerify(root, id, {
    command,
    output,
    passed: passedRaw === 'true',
    signature,
    ...ownershipFlags(flags),
  });
  return { result: cell, text: `Recorded verify on ${cell.id}: passed=${cell.trace.verify_passed}.` };
}

async function handleCellsCap(root, flags) {
  const id = requireFlag(flags, 'id');
  const deviations = flags['deviations-file'] ? parseDeviationsFile(String(flags['deviations-file'])) : [];
  const cell = await capCell(root, id, {
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
    overrideJudge: flags['override-judge'] !== undefined ? String(flags['override-judge']) : null,
    ...ownershipFlags(flags),
  });
  emitJudgeStandardCapAdvisory(cell); // F5
  return { result: cell, text: `Capped ${cell.id} at ${cell.trace.capped_at}.` };
}

async function handleCellsBlock(root, flags) {
  const cell = await blockCell(root, requireFlag(flags, 'id'), requireFlag(flags, 'reason'), ownershipFlags(flags));
  return { result: cell, text: `Blocked ${cell.id}.` };
}

function handleCellsDrop(root, flags) {
  const cell = dropCell(root, requireFlag(flags, 'id'), requireFlag(flags, 'reason'));
  return { result: cell, text: `Dropped ${cell.id}.` };
}

function handleCellsUnclaim(root, flags) {
  const cell = unclaimCell(root, requireFlag(flags, 'id'), ownershipFlags(flags));
  return { result: cell, text: `Unclaimed ${cell.id} — back to open.` };
}

function handleCellsReopen(root, flags) {
  const cell = reopenCell(root, requireFlag(flags, 'id'), requireFlag(flags, 'reason'), ownershipFlags(flags));
  return { result: cell, text: `Reopened ${cell.id} — back to open.` };
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

// D2 + GH #27.4 (D-GHF-C): the audited reset door for a cell whose claim
// door is closed by CELL_BUDGET_EXHAUSTED/REPEATED_FAILURE. --reason is
// required at the lib layer (resetCellBudget throws otherwise); --session-id
// follows the same optional/env-resolved convention as every other
// ownership-aware verb, but resetCellBudget never enforces claim ownership
// (a budget-exhausted cell has already been claim-cleared by the refusal
// path — there is no live claim to own). resetCellBudget itself now refuses
// unless the cell is actually budget-blocked, and refuses without an actor
// (--operator here, or its own BEE_AGENT_NAME env fallback when --operator
// is omitted).
async function handleCellsResetBudget(root, flags) {
  const id = requireFlag(flags, 'id');
  const reason = requireFlag(flags, 'reason');
  const sessionId = flags['session-id'] !== undefined ? String(flags['session-id']) : undefined;
  const operator = flags['operator'] !== undefined ? String(flags['operator']) : undefined;
  const cell = await resetCellBudget(root, id, reason, { sessionId, operator });
  return { result: cell, text: `Reset the claim-lifetime budget door for ${cell.id}.` };
}

// D5 (self-correcting-loop): validates the --file payload against schema
// judge-verdict/1 and appends the stamped result to trace.semantic_judge.
// --builder-model/--judge-model presence is what marks that side PINNED —
// the orchestrator only ever supplies a model name from its OWN pinned
// dispatch param (Δ6; rule 13's mandatory transport means there is no code
// path that would hand this flag an unverified guess) — so no separate
// --*-status flag is needed at the CLI boundary; deriveModelIndependence
// itself stays 4-arg/testable directly in test_lib.mjs regardless.
// .bee/logs/dispatch.jsonl is never read here — Δ6: it is corroboration
// only and must never feed a fail-closed guard.
function handleCellsJudgeRecord(root, flags) {
  const id = requireFlag(flags, 'id');
  const raw = readFileText(String(requireFlag(flags, 'file')), 'judge verdict');
  let verdict;
  try {
    verdict = JSON.parse(raw);
  } catch {
    // Free prose — validateJudgeVerdict rejects this with a typed error
    // (never throws itself); recordJudgeVerdict surfaces that as a refusal.
    verdict = raw;
  }
  const builderModel = flags['builder-model'] !== undefined ? String(flags['builder-model']) : null;
  const judgeModel = flags['judge-model'] !== undefined ? String(flags['judge-model']) : null;
  const cell = recordJudgeVerdict(root, id, verdict, {
    builderModel,
    builderStatus: builderModel ? PINNED_MODEL_STATUS : null,
    judgeModel,
    judgeStatus: judgeModel ? PINNED_MODEL_STATUS : null,
    ...ownershipFlags(flags),
  });
  const entries = cell.trace.semantic_judge || [];
  const latest = entries[entries.length - 1];
  return {
    result: cell,
    text: `Recorded judge verdict on ${cell.id}: ${latest.verdict} (model_independence=${latest.model_independence}).`,
  };
}

// fresh-session-handoff fsh-11 (D2/D4): typed refusals (NO_APPROVED_WORK,
// CLAIMED, CLAIM_CELL_FAILED, LANE_INVALID/LANE_MISSING/LANE_CORRUPT) surface
// as a thrown Error at the CLI boundary — same convention handleStateHandoffAdopt
// already uses for adoptHandoff's own typed refusals — so the process exits
// non-zero with the reason on stderr rather than a misleadingly "successful" exit.
function handleCellsClaimNext(root, flags) {
  const worker = requireFlag(flags, 'worker');
  // D3: --session-id keeps working exactly as before; it is now also
  // resolvable from CLAUDE_CODE_SESSION_ID when the flag is omitted.
  // claim-next's own cross-session selection logic still genuinely needs a
  // session id (it resolves the acting session's bound lane), so — unlike
  // the sessionless-claim relaxation in `cells claim` — neither source
  // resolving is still a refusal, just from one of two places now.
  const sessionId = resolveSessionId({
    flag: flags['session-id'] !== undefined ? String(flags['session-id']) : undefined,
  });
  if (!sessionId) {
    throw new Error('claim-next: --session-id or CLAUDE_CODE_SESSION_ID env is required.');
  }
  const ttl = flags.ttl !== undefined ? Number.parseInt(String(flags.ttl), 10) : undefined;
  if (flags.ttl !== undefined && (!Number.isFinite(ttl) || ttl <= 0)) {
    throw new Error('--ttl must be a positive integer (seconds).');
  }
  const result = claimNextCell(root, { sessionId, worker, ttl });
  if (!result.ok) {
    throw new Error(`claim-next: ${result.code} — ${result.reason}`);
  }
  return { result, text: `Claimed ${result.cell.id} for ${worker} (session ${sessionId}).` };
}

// D1/D4: plan-time only, read-only — loads the feature's declared cells (or
// every cell when --feature is omitted) and hands them to computeSchedule
// unmodified. Feature resolution mirrors handleCellsReady exactly: no
// state.json fallback (plan-checker W3 resolution) — an unscoped call means
// "every cell", not "the current session's feature".
function handleCellsSchedule(root, flags) {
  const cells = listCells(root, { feature: flags.feature ? String(flags.feature) : null });
  const schedule = computeSchedule(cells);
  const lines = [];
  if (schedule.waves.length === 0) {
    lines.push('No schedulable cells.');
  } else {
    schedule.waves.forEach((wave, index) => {
      lines.push(`Wave ${index + 1}: ${wave.join(', ')}`);
    });
  }
  const { cycles, unsatisfiable_deps: unsatisfiableDeps, empty_files: emptyFiles } = schedule.diagnostics;
  if (cycles.length > 0) {
    lines.push('Cycles:');
    for (const cycle of cycles) lines.push(`- ${cycle.join(' -> ')}`);
  }
  if (unsatisfiableDeps.length > 0) {
    lines.push('Unsatisfiable deps:');
    for (const row of unsatisfiableDeps) lines.push(`- ${row.cell} -> ${row.dep} (${row.reason})`);
  }
  if (emptyFiles.length > 0) {
    lines.push(`Empty files: ${emptyFiles.join(', ')}`);
  }
  return { result: schedule, text: lines.join('\n') };
}

async function handleReservationsReserve(root, flags) {
  const ttl = flags.ttl !== undefined ? Number.parseInt(String(flags.ttl), 10) : undefined;
  if (flags.ttl !== undefined && (!Number.isFinite(ttl) || ttl <= 0)) {
    throw new Error('--ttl must be a positive integer (seconds).');
  }
  const result = await reserve(root, {
    agent: requireFlag(flags, 'agent'),
    cell: requireFlag(flags, 'cell'),
    path: requireFlag(flags, 'path'),
    ...(ttl !== undefined ? { ttl } : {}),
    ...(flags.session ? { session: String(flags.session) } : {}),
  });
  const text = result.ok
    ? `Reserved "${result.reservation.path}" for ${result.reservation.agent} (cell ${result.reservation.cell}, ttl ${result.reservation.ttl_seconds}s).`
    : [
        'Reservation CONFLICT — return [BLOCKED] to the orchestrator:',
        ...result.conflicts.map((c) => `- ${c.agent} holds "${c.path}" (cell ${c.cell})`),
      ].join('\n');
  return { result, text, exitCode: result.ok ? 0 : 1 };
}

async function handleReservationsRelease(root, flags) {
  const result = await release(root, {
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

async function handleReservationsSweep(root) {
  const released = await sweepExpired(root);
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

// Optional --lane target resolution (fresh-session-handoff fsh-4, D2/D4),
// shared by state.set/gate/scribing-run. `--lane` bare (no value) is a
// malformed call, not "no lane requested" — refuse rather than silently
// falling back to the default record. A named lane that is missing or
// corrupt refuses loudly here, before any read/write of the target record —
// readLaneStrict already throws loud on corrupt; missing reads as null
// (creation is start-feature's job, never an implicit side effect of set/
// gate/scribing-run), so that case is refused explicitly below.
function optionalLaneFlag(flags, verb) {
  if (flags.lane === undefined) return null;
  if (flags.lane === true || flags.lane === '') {
    throw new Error(`${verb}: --lane requires a value (the lane's feature name).`);
  }
  return String(flags.lane);
}

function resolveMutationTarget(root, laneFeature, verb) {
  if (!laneFeature) return { record: readStateStrict(root), write: (record) => writeState(root, record) };
  const record = readLaneStrict(root, laneFeature);
  if (!record) {
    throw new Error(
      `${verb}: refused — lane "${laneFeature}" does not exist (no .bee/lanes/${laneFeature}.json). FIX: start it first ("state start-feature --feature ${laneFeature} --as-lane"), then retry.`,
    );
  }
  return { record, write: (updated) => writeLane(root, updated) };
}

// D6 — async: the whole record-read through write() body runs inside
// withStoreLock('state', ...) below so a concurrent set/gate/worker/
// scribing-run/start-feature CLI invocation can no longer race this
// function's read-check-write into a lost update. Argument-only validation
// (no store I/O) stays outside the lock.
async function handleStateSet(root, flags) {
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
  const laneFeature = optionalLaneFlag(flags, 'set');
  if (laneFeature && flags.feature !== undefined) {
    throw new Error(
      "set: --feature cannot be combined with --lane — a lane's feature is its identity (the lane record's filename), not a mutable field. FIX: omit --feature, or start a new lane instead.",
    );
  }

  const { state, changed, waived } = await withStoreLock(root, 'state', () => {
    const { record: state, write } = resolveMutationTarget(root, laneFeature, 'set');
    // chain-integrity D1-REVISED / D2 — read `from` off the record actually being
    // mutated (lanes included), never off global state.
    let waived = null;
    if (flags.phase !== undefined) {
      const target = String(flags.phase);
      const transition = checkPhaseTransition(state.phase, target);
      if (!transition.ok) throw new Error(transition.reason);
      if (target === 'compounding-complete') {
        waived = closeGuardScribingDebt(root, flags);
      }
    }
    const selectedRecord = laneFeature ? `lane "${laneFeature}"` : 'default state';
    if (!isKnownPhase(state.phase)) {
      throw new Error(
        `set: refused — selected ${selectedRecord} has missing or invalid pre-mutation phase "${state.phase ?? ''}". Ownership cannot be derived from a corrupt routing record, so nothing was written. FIX: restore a valid phase before retrying.`,
      );
    }
    if (flags.owner === undefined || flags.owner === true || flags.owner === '') {
      throw new Error(
        `set: missing --owner — selected ${selectedRecord}'s pre-mutation phase is "${state.phase}". FIX: retry with --owner ${state.phase}.`,
      );
    }
    const owner = String(flags.owner);
    if (owner !== state.phase) {
      throw new Error(
        `set: owner mismatch — selected ${selectedRecord}'s pre-mutation phase is "${state.phase}", not "${owner}". FIX: retry with --owner ${state.phase}.`,
      );
    }
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
    write(state);
    return { state, changed, waived };
  });

  // D4 — the waiver is loud and attributable. Logged AFTER the write succeeds so
  // a refused close never leaves a decision claiming one happened. decisions.jsonl
  // is append-only and outside the 'state' lock's store scope, so this stays
  // after the lock releases, unchanged from before.
  if (waived && waived.length > 0) {
    logDecision(root, {
      decision: `Closed feature "${state.feature}" with scribing debt WAIVED for ${waived.length} capped behavior_change cell(s): ${waived.join(', ')}. Their settled behavior is NOT in docs/specs/.`,
      rationale:
        'Explicitly waived via `state set --phase compounding-complete --waive-scribing-debt`. bee refuses this close by default (chain-integrity D2); the waiver is the sanctioned door, and this record is its price.',
      scope: 'repo',
      source: 'agent',
    });
  }
  const waiverNote = waived && waived.length > 0
    ? ` — SCRIBING DEBT WAIVED for ${waived.length} cell(s): ${waived.join(', ')} (decision logged)`
    : '';
  return {
    result: state,
    text: `Updated state: ${changed.join(' ')}.${laneFeature ? ` (lane "${laneFeature}")` : ''}${waiverNote}`,
  };
}

// chain-integrity D2/D4 — the close boundary is the ONE place scribing debt is a
// wall instead of a signal. It lives here, not in state.mjs: scribingDebt is in
// cells.mjs, and cells.mjs already imports state.mjs (a back-import would close
// the cycle state.mjs:6-7 exists to avoid). Returns the waived cell ids when the
// caller explicitly waived them, otherwise null. Throws when debt stands.
function closeGuardScribingDebt(root, flags) {
  const debt = scribingDebt(root);
  if (debt.count === 0) return null;
  if (flags['waive-scribing-debt']) return debt.cells;
  throw new Error(
    `set: refusing to close this feature — ${debt.count} capped behavior_change cell(s) have not been synced to docs/specs/: ${debt.cells.join(', ')}.\n` +
      '"compounding-complete" asserts that scribing already ran for them. It has not.\n' +
      'FIX: run bee-scribing to merge the settled behavior into its area spec, then `bee state scribing-run ...` to stamp it.\n' +
      'If the behavior genuinely belongs in no spec, close with --waive-scribing-debt — it is permitted, but it logs a decision naming every cell you waived.',
  );
}

// D6 — async: record-read through write() runs inside withStoreLock('state').
async function handleStateGate(root, flags) {
  rejectDryRun(flags);
  if (flags.owner !== undefined) {
    throw new Error(
      'gate: --owner is not accepted — routing ownership protects generic `state set` fields only. FIX: omit --owner and use the dedicated gate command.',
    );
  }
  const name = requireFlag(flags, 'name');
  if (!GATE_NAMES.includes(name)) {
    throw new Error(
      `gate: invalid gate name "${name}" — must be one of ${GATE_NAMES.join(', ')}. FIX: pass --name <one of these>.`,
    );
  }
  const approved = requireBoolFlag(flags, 'approved');
  const laneFeature = optionalLaneFlag(flags, 'gate');

  const state = await withStoreLock(root, 'state', () => {
    const { record: state, write } = resolveMutationTarget(root, laneFeature, 'gate');
    // Gate 3 advisor precondition (AO3/AO13): high-risk execution never opens
    // without a non-stale advisor_ref. Computed BEFORE any write, so a refusal
    // makes zero mutations. Bound to the SELECTED record's feature (M1): a lane
    // approval checks the lane's own advisor_ref against the lane's plan.md.
    if (name === 'execution' && approved === true && state.mode === 'high-risk') {
      const staleness = advisorRefStale(root, state.advisor_ref, state);
      if (staleness.stale) {
        throw new Error(
          `gate: execution approval refused for high-risk work — the advisor consult is missing or stale (AO3/AO13). ` +
            `Reason(s): ${staleness.reasons.join('; ')}. ` +
            `FIX: resolve the advisor from config (models.<runtime>.advisor), run it read-only with the evidence bundle on stdin, ` +
            `then record the consult: bee state advisor-ref record --advisor "<identity>" --digest-file <path>` +
            `${laneFeature ? ` --lane ${laneFeature}` : ''}. Nothing is written until a non-stale advisor_ref exists.`,
        );
      }
    }
    // Revocation tracking (AO13): stamp the execution revocation moment so a ref
    // recorded before it reads stale. Only the execution gate is tracked — it is
    // the only revocation the staleness rule needs.
    if (name === 'execution' && approved === false) {
      state.gate_revoked_at = { ...state.gate_revoked_at, execution: new Date().toISOString() };
    }
    state.approved_gates = { ...state.approved_gates, [name]: approved };
    write(state);
    return state;
  });
  return {
    result: state,
    text: `Gate "${name}" set to ${approved}.${laneFeature ? ` (lane "${laneFeature}")` : ''}`,
  };
}

// D6 — async: shared by worker add/update/remove/clear, so all four get the
// lock for free. The read-check-write body runs inside withStoreLock('state').
async function stateWorkerMutate(root, flags, mutate, text) {
  rejectDryRun(flags);
  return withStoreLock(root, 'state', () => {
    const state = readStateStrict(root);
    const workers = Array.isArray(state.workers) ? [...state.workers] : [];
    const resultText = mutate(workers);
    state.workers = workers;
    writeState(root, state);
    return { result: state, text: text ?? resultText };
  });
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

// D6 — async: record-read through write() runs inside withStoreLock('state').
async function handleStateScribingRun(root, flags) {
  rejectDryRun(flags);
  const feature = requireFlag(flags, 'feature');
  const areas = splitList(requireFlag(flags, 'areas'));
  const nextAction = requireFlag(flags, 'next-action');
  const now = new Date();
  const at = now.toISOString();
  const date = at.slice(0, 10);
  const laneFeature = optionalLaneFlag(flags, 'scribing-run');

  const state = await withStoreLock(root, 'state', () => {
    const { record: state, write } = resolveMutationTarget(root, laneFeature, 'scribing-run');
    // chain-integrity D3 — scribing-run is the SOLE producer of phase=compounding,
    // so it is also the door that must be guarded. It used to advance the phase
    // from anywhere, with no check that execution had happened at all.
    const phaseCheck = checkScribingRunPhase(state.phase);
    if (!phaseCheck.ok) throw new Error(phaseCheck.reason);
    state.last_scribing_run = { feature, date, at, areas_synced: areas, next_action: nextAction };
    // "plus top-level phase/next_action" (bee-scribing SKILL.md:112).
    state.phase = 'compounding';
    state.next_action = nextAction;
    write(state);
    return state;
  });
  return {
    result: state,
    text: `Recorded scribing run for "${feature}" at ${at}.${laneFeature ? ` (lane "${laneFeature}")` : ''}`,
  };
}

// D6 — async: startFeature (lib/state.mjs) already wraps its own
// read-check-write in withStoreLock('state'); this just awaits it.
async function handleStateStartFeature(root, flags) {
  rejectDryRun(flags);
  const feature = requireFlag(flags, 'feature');
  const mode = flags.mode !== undefined ? String(flags.mode) : null;
  const phase = flags.phase !== undefined ? String(flags.phase) : 'exploring';
  // Lane mode (fresh-session-handoff fsh-4, D2/D4): --as-lane starts the
  // feature as a per-feature lane record instead of mutating state.json;
  // --session-id/--paths feed the declared-paths holds-overlap check that
  // startFeature's lane path already implements (fsh-3) — this cell only
  // wires the CLI surface through, no new precondition logic here.
  const lane = flags['as-lane'] === true;
  const sessionId = flags['session-id'] !== undefined ? String(flags['session-id']) : null;
  const paths = flags.paths !== undefined ? splitList(flags.paths) : [];
  // startFeature() re-reads state and performs every precondition check (C1).
  const state = await startFeature(root, { feature, mode, phase, lane, sessionId, paths });
  return {
    result: state,
    text: `Started feature "${state.feature}"${lane ? ' as a lane' : ''} at phase "${state.phase}" (mode ${state.mode ?? 'null'}); all four gates reset.`,
  };
}

// ─── state.lanes / state.session.*: read-only lane listing + session→lane
// binding (fresh-session-handoff fsh-4, D2/D4). claims.mjs stays out of this
// cell's file scope (fsh-3 owns it) — listSessionRecords composes already-
// exported primitives (sessionsDir, readSession) for presentation, exactly
// the same discipline buildReviewBlock above uses for reviews.mjs; it is not
// a second implementation of a mutation, only a read-side enumeration no
// lib module currently offers.

function listSessionRecords(root) {
  let entries;
  try {
    entries = fs.readdirSync(sessionsDir(root));
  } catch {
    return [];
  }
  const sessions = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const record = readSession(root, entry.slice(0, -'.json'.length));
    if (record) sessions.push(record);
  }
  return sessions;
}

function summarizeSession(session) {
  const laneNote = typeof session.lane === 'string' && session.lane ? `-> lane "${session.lane}"` : '(unbound)';
  return `${session.id} ${laneNote} | started ${session.started_at} | heartbeat ${session.last_heartbeat}`;
}

function handleStateLanes(root) {
  const rows = buildLaneRows(root);
  const text = rows.length
    ? rows
        .map((l) => {
          const gates = GATE_NAMES.map((g) => `${g}=${l.approved_gates[g] ? 'approved' : 'pending'}`).join(' ');
          const bindingsNote = l.bound_sessions.length ? ` sessions=${l.bound_sessions.join(',')}` : '';
          return `${l.feature} [${l.phase}] ${gates}${bindingsNote}`;
        })
        .join('\n')
    : 'No lane records.';
  return { result: rows, text };
}

function handleStateSessionList(root) {
  const sessions = listSessionRecords(root);
  return {
    result: sessions,
    text: sessions.length ? sessions.map(summarizeSession).join('\n') : 'No session records.',
  };
}

function handleStateSessionBind(root, flags) {
  const sessionId = requireFlag(flags, 'session-id');
  const laneFeature = requireFlag(flags, 'lane');
  const result = bindSessionLane(root, sessionId, laneFeature);
  if (!result.ok) {
    throw new Error(`session bind: ${result.reason}`);
  }
  return { result: result.session, text: `Session "${sessionId}" bound to lane "${laneFeature}".` };
}

function handleStateSessionUnbind(root, flags) {
  const sessionId = requireFlag(flags, 'session-id');
  const result = unbindSessionLane(root, sessionId);
  if (!result.ok) {
    throw new Error(`session unbind: ${result.reason}`);
  }
  return { result: result.session, text: `Session "${sessionId}" unbound from its lane.` };
}

// ─── state.handoff.*: the two-kind handoff lifecycle CLI surface (fresh-
// session-handoff fsh-9, D1) over lib/state.mjs's guarded writeHandoff/
// adoptHandoff. This cell owns the LIFECYCLE only — claim-next selection is
// fsh-11's, SessionStart wiring (register/rehydrate/auto-resume) is fsh-10's.

function handleStateHandoffWrite(root, flags) {
  rejectDryRun(flags);
  const kind = requireFlag(flags, 'kind');
  const input = { kind };
  if (flags.feature !== undefined) input.feature = String(flags.feature);
  if (flags.phase !== undefined) input.phase = String(flags.phase);
  if (flags.mode !== undefined) input.mode = String(flags.mode);
  if (flags['next-action'] !== undefined) input.next_action = String(flags['next-action']);
  if (kind === 'planned-next') {
    input.writer_session = requireFlag(flags, 'writer-session');
    input.previous_cell = requireFlag(flags, 'previous-cell');
    input.next_cell = requireFlag(flags, 'next-cell');
  } else {
    if (flags.cell !== undefined) input.cell = String(flags.cell);
    if (flags.files !== undefined) input.files = splitList(flags.files);
    if (flags.done !== undefined) input.done = splitList(flags.done);
    if (flags.remaining !== undefined) input.remaining = splitList(flags.remaining);
  }
  const record = writeHandoff(root, input);
  return { result: record, text: `Wrote "${record.kind}" handoff.` };
}

function handleStateHandoffAdopt(root, flags) {
  rejectDryRun(flags);
  const sessionId = requireFlag(flags, 'session-id');
  const result = adoptHandoff(root, sessionId);
  if (!result.ok) {
    throw new Error(`state handoff adopt: ${result.reason}`);
  }
  return {
    result,
    text: `Adopted the handoff's carried claim on "${result.next_cell}" into session "${sessionId}"; handoff cleared.`,
  };
}

function handleStateHandoffShow(root) {
  const handoff = readHandoff(root);
  if (!handoff) return { result: null, text: 'No handoff.' };
  return {
    result: handoff,
    text: `kind=${handoff.kind} feature=${handoff.feature ?? 'unknown'} phase=${handoff.phase ?? 'unknown'} mode=${handoff.mode ?? 'unknown'}`,
  };
}

// ─── state advisor-ref: record/show the AO3/AO13 advisor consult ────────────
// hive law 12: the Gate 3 precondition needs a state field AND a CLI verb. The
// verb stamps the staleness anchors ITSELF (current feature, newest active
// decision id, sha256 of that feature's plan.md) — the caller supplies only the
// advisor identity and a digest for audit; anchors are never caller-supplied.
function handleStateAdvisorRefRecord(root, flags) {
  rejectDryRun(flags);
  const advisor = requireFlag(flags, 'advisor');
  const digestFile = requireFlag(flags, 'digest-file');
  const laneFeature = optionalLaneFlag(flags, 'advisor-ref record');
  const { record: state, write } = resolveMutationTarget(root, laneFeature, 'advisor-ref record');
  const phase = state.phase;
  if (!state.feature || phase === 'idle' || phase === 'compounding-complete') {
    throw new Error(
      `advisor-ref record: refused — no active feature to anchor the consult to (phase "${phase ?? 'idle'}", feature "${state.feature ?? 'none'}"). ` +
        'FIX: start a feature and reach an in-flight phase before recording an advisor consult.',
    );
  }
  let digestHead = '';
  try {
    digestHead = fs.readFileSync(path.resolve(String(digestFile)), 'utf8').slice(0, 500);
  } catch (err) {
    throw new Error(
      `advisor-ref record: could not read --digest-file "${digestFile}" (${err && err.code ? err.code : err}). ` +
        'FIX: pass the path to the captured advisor consult digest.',
    );
  }
  // Anchors bound to the SELECTED record's feature (M1), stamped by the verb.
  const anchors = advisorRefAnchors(root, state.feature);
  state.advisor_ref = {
    consulted_at: new Date().toISOString(),
    feature: anchors.feature,
    newest_decision_id: anchors.newest_decision_id,
    plan_sha256: anchors.plan_sha256,
    advisor: String(advisor),
    digest_head: digestHead,
  };
  write(state);
  return {
    result: state.advisor_ref,
    text: `Recorded advisor_ref (advisor "${advisor}", feature "${anchors.feature}").${laneFeature ? ` (lane "${laneFeature}")` : ''}`,
  };
}

function handleStateAdvisorRefShow(root, flags) {
  const laneFeature = optionalLaneFlag(flags, 'advisor-ref show');
  const state = laneFeature ? readLaneStrict(root, laneFeature) : readStateStrict(root);
  if (laneFeature && !state) {
    throw new Error(`advisor-ref show: lane "${laneFeature}" does not exist (no .bee/lanes/${laneFeature}.json).`);
  }
  const raw = state ? state.advisor_ref : null;
  const ref = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  if (!ref) return { result: null, text: 'No advisor_ref recorded.' };
  const staleness = advisorRefStale(root, ref, state);
  return {
    result: { advisor_ref: ref, stale: staleness.stale, reasons: staleness.reasons },
    text:
      `advisor="${ref.advisor}" feature="${ref.feature}" consulted_at=${ref.consulted_at} stale=${staleness.stale}` +
      `${staleness.reasons.length ? ` (${staleness.reasons.join('; ')})` : ''}`,
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
  const feature = requireFlag(flags, 'feature');
  // GitHub #16: when --cells is omitted, auto-fill from the feature's capped
  // cells. A cells-less candidate can never cell-match a review session that
  // included the work by CELL, so it stayed stuck "unreviewed" even after the
  // session approved it. Deriving the cells here closes that coverage gap.
  const cells = flags.cells
    ? splitList(flags.cells)
    : listCells(root)
        .filter((c) => c.feature === feature && c.status === 'capped')
        .map((c) => c.id);
  const entry = addCandidate(root, {
    feature,
    head: requireFlag(flags, 'head'),
    mode: requireFlag(flags, 'mode'),
    baseline: flags.baseline ? String(flags.baseline) : null,
    cells,
  });
  return {
    result: entry,
    text: `Added candidate ${entry.id} for feature "${entry.feature}" (mode ${entry.mode}${
      entry.cells.length ? `, ${entry.cells.length} cell(s)` : ''
    }).`,
  };
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

// ─── perf group (lib/perf.mjs) — global cross-project performance log ──────
// Sections are computed post-hoc from the Claude Code session transcript on
// disk. Handlers degrade gracefully: a missing transcript / open marker yields
// zeroed metrics or a clear message, never a throw (so the read-only registry
// examples pass under assertExampleOk in a transcript-less CI).

function perfMarkerPath(root) {
  return cacheFilePath(root, 'perf-open.json');
}
// Legacy location (pre-#11): the marker used to sit directly in .bee/ root.
function legacyPerfMarkerPath(root) {
  return path.join(root, '.bee', 'perf-open.json');
}

function perfGitBranch(root) {
  try {
    const head = fs.readFileSync(path.join(root, '.git', 'HEAD'), 'utf8').trim();
    const m = /ref:\s*refs\/heads\/(.+)$/.exec(head);
    return m ? m[1] : head || null;
  } catch {
    return null;
  }
}

// perfParseSince — a trailing-window start: "30m"/"2h"/"1d"/"45s" relative to
// nowMs, or an ISO timestamp. Returns epoch-ms, or NaN when unparseable.
function perfParseSince(since, nowMs) {
  if (!since) return NaN;
  const m = /^(\d+)\s*([smhd])$/.exec(String(since).trim());
  if (m) {
    const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
    return nowMs - Number(m[1]) * unit;
  }
  const t = Date.parse(since);
  return Number.isNaN(t) ? NaN : t;
}

function perfShortModel(model) {
  return String(model).replace(/^claude-/, '').replace(/-\d{6,}$/, '');
}

function perfSectionLine(rec) {
  const models = Object.entries(rec.models || {})
    .map(([m, v]) => `${perfShortModel(m)} ${v.total}`)
    .join(', ') || '—';
  const flag = rec.parallel ? '∥' : 'seq';
  const scope = rec.project ? `${rec.project}${rec.branch ? `@${rec.branch}` : ''}` : '';
  return `${rec.started_at}  ${rec.label || '(unlabeled)'}  · ${rec.running_time_human} · ${flag} · ${models}${scope ? ` · ${scope}` : ''}`;
}

function perfRenderMarkdown(sections) {
  if (!sections.length) return '# bee performance log\n\n_No sections logged yet._\n';
  const lines = ['# bee performance log', ''];
  for (const rec of sections) {
    lines.push(`## ${rec.label || '(unlabeled)'} — ${rec.started_at}`);
    if (rec.note) lines.push(`_${rec.note}_`);
    lines.push('');
    lines.push(`- Project: \`${rec.project || '?'}\`${rec.branch ? ` (branch \`${rec.branch}\`)` : ''}`);
    lines.push(`- Running time: **${rec.running_time_human}** (${rec.running_time_ms} ms active)`);
    lines.push(`- Parallel: ${rec.parallel ? 'yes' : 'no'}${rec.subagent_count ? ` (${rec.subagent_count} subagent${rec.subagent_count === 1 ? '' : 's'})` : ''}`);
    const models = Object.entries(rec.models || {});
    if (models.length) {
      lines.push('- Models:');
      for (const [m, v] of models) {
        lines.push(`  - \`${perfShortModel(m)}\`: total ${v.total} (new ${v.new}, cached ${v.cached})`);
      }
    } else {
      lines.push('- Models: —');
    }
    const sub = Object.entries(rec.subagent_models || {});
    if (sub.length) {
      lines.push('- Subagent tokens:');
      for (const [m, v] of sub) lines.push(`  - \`${perfShortModel(m)}\`: total ${v.total} (new ${v.new}, cached ${v.cached})`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function handlePerfStart(root, flags) {
  const projectPath = root;
  const transcript = resolveTranscript(claudeProjectsRoot(), projectPath, { sessionId: flags.session });
  const marker = {
    label: flags.label || null,
    transcript,
    session_id: transcript ? path.basename(transcript, '.jsonl') : flags.session || null,
    started_at: new Date().toISOString(),
    project: projectPath,
    branch: perfGitBranch(root),
  };
  writeJsonAtomic(perfMarkerPath(root), marker);
  removeFileIfExists(legacyPerfMarkerPath(root));
  const text = transcript
    ? `perf: section "${marker.label || '(unlabeled)'}" started — measuring session ${marker.session_id}.`
    : `perf: section "${marker.label || '(unlabeled)'}" started, but no session transcript resolved yet — metrics will be empty at stop.`;
  return { result: marker, text };
}

function handlePerfStop(root, flags) {
  const markerPath = perfMarkerPath(root);
  // Prefer the new .bee/cache/ marker; fall back to a legacy root marker opened
  // before the #11 migration so an in-flight section can still be stopped.
  const marker = readJson(markerPath, null) || readJson(legacyPerfMarkerPath(root), null);
  if (!marker) {
    return { result: { ok: false, reason: 'no-open-section' }, text: 'perf: no open section — run `bee perf start` first.' };
  }
  const endTs = new Date().toISOString();
  const metrics = computeMetrics(marker.transcript, Date.parse(marker.started_at), Date.parse(endTs));
  const rec = buildSection({
    label: marker.label,
    note: flags.note || null,
    projectPath: marker.project || root,
    branch: marker.branch || perfGitBranch(root),
    sessionId: marker.session_id,
    startTs: marker.started_at,
    endTs,
    metrics,
  });
  const file = appendSection(rec);
  // Clear both the new and any legacy marker (best-effort; the section is logged).
  removeFileIfExists(markerPath);
  removeFileIfExists(legacyPerfMarkerPath(root));
  return { result: rec, text: `${perfSectionLine(rec)}\nlogged → ${file}` };
}

function handlePerfSection(root, flags) {
  const endTs = new Date().toISOString();
  const endMs = Date.parse(endTs);
  const startMs = perfParseSince(flags.since, endMs);
  if (Number.isNaN(startMs)) {
    return { result: { ok: false, reason: 'bad-since' }, text: 'perf: --since must be a duration (e.g. 30m, 2h, 1d) or an ISO timestamp.' };
  }
  const transcript = resolveTranscript(claudeProjectsRoot(), root, { sessionId: flags.session });
  const metrics = computeMetrics(transcript, startMs, endMs);
  const rec = buildSection({
    label: flags.label || null,
    note: flags.note || null,
    projectPath: root,
    branch: perfGitBranch(root),
    sessionId: transcript ? path.basename(transcript, '.jsonl') : flags.session || null,
    startTs: new Date(startMs).toISOString(),
    endTs,
    metrics,
  });
  const file = appendSection(rec);
  return { result: rec, text: `${perfSectionLine(rec)}\nlogged → ${file}` };
}

function handlePerfLog(_root, flags) {
  const limit = flags.limit ? Number(flags.limit) : 20;
  const sections = readSections({ limit: Number.isFinite(limit) && limit > 0 ? limit : undefined });
  const text = sections.length ? sections.map(perfSectionLine).join('\n') : 'perf: no sections logged yet.';
  return { result: sections, text };
}

function handlePerfRender(_root, flags) {
  const limit = flags.limit ? Number(flags.limit) : undefined;
  const sections = readSections({ limit: Number.isFinite(limit) && limit > 0 ? limit : undefined });
  return { result: sections, text: perfRenderMarkdown(sections) };
}

function handlePerfSync(_root, _flags) {
  const res = syncSessionsToLog(claudeProjectsRoot(), { cachePath: scanCachePath() });
  return { result: res, text: `perf: synced ${res.sessions} session(s) across ${res.projects} project(s) into the log.` };
}

function handlePerfReport(_root, flags) {
  // The report READS the persistent store (performance.jsonl); it never scans
  // transcripts at view time. If the store is empty (first run), backfill once.
  if (readSessionRecords().length === 0) {
    try {
      syncSessionsToLog(claudeProjectsRoot(), { cachePath: scanCachePath() });
    } catch {
      // backfill is best-effort; an empty matrix is still valid output.
    }
  }
  const matrix = buildMatrixFromLog(process.env, os.homedir(), { since: flags.since });
  if (flags.html || flags.out) {
    const file = writeReport(matrix, { out: flags.out });
    return {
      result: { path: file, projects: matrix.projects.length, sessions: matrix.totals.sessions },
      text: `perf: matrix for ${matrix.projects.length} project(s) written → ${file}`,
    };
  }
  if (!matrix.projects.length) return { result: matrix, text: 'perf: no session activity found yet. Run `bee perf sync`.' };
  const lines = matrix.projects.map(
    (p) => `${p.project}  · ${p.sessions} sess · ${Math.round(p.running_time_ms / 1000)}s · ${p.total_tokens} tok (${p.parallel_sessions}/${p.sessions} parallel)`,
  );
  return { result: matrix, text: lines.join('\n') };
}

// ─── worktree: register/list/unregister the opt-in per-worktree store grant
// (worktree-feature-parallelism Slice A). `root` here is main()'s already-
// resolved storeRoot, whose value is GRANT-STATE-DEPENDENT for a linked
// worktree (resolveRoots falls back to mainRoot when ungranted, but returns
// the worktree's own root once granted) — so every handler below re-resolves
// `process.cwd()` itself via resolveRoots to get the authoritative, grant-
// state-INDEPENDENT `{ id, mainRoot, worktreeRoot }` rather than trusting the
// ambient `root` value. ───────────────────────────────────────────────────

/**
 * The MAIN store's checkout root, regardless of the current directory's own
 * grant state: for a linked worktree (granted or not), resolveRoots' own
 * `mainRoot` field is authoritative; for an ordinary checkout, `root` (the
 * dispatcher's already-resolved storeRoot) already IS the main root.
 */
function resolveMainRoot(root) {
  let resolution;
  try {
    resolution = resolveRoots(process.cwd());
  } catch {
    return root;
  }
  if (resolution.worktreeResolution === 'linked-valid' && resolution.mainRoot) {
    return resolution.mainRoot;
  }
  return root;
}

function handleWorktreeRegister(_root, flags) {
  const feature = requireFlag(flags, 'feature');
  let resolution;
  try {
    resolution = resolveRoots(process.cwd());
  } catch (error) {
    throw new Error(
      `"bee worktree register" must be run from inside a linked git worktree (git worktree add): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (resolution.worktreeResolution !== 'linked-valid') {
    throw new Error(
      `"bee worktree register" must be run from inside a linked git worktree (git worktree add), not an "${resolution.worktreeResolution}" checkout.`,
    );
  }
  const { id, mainRoot, worktreeRoot } = resolution;
  const mainStoreRoot = path.join(mainRoot, '.bee');
  writeGrant(mainStoreRoot, id);
  const bootstrap = bootstrapWorktreeStore(worktreeRoot, mainStoreRoot, feature);
  const result = { ok: true, id, feature, main_root: mainRoot, worktree_root: worktreeRoot, bootstrap };
  const text = [
    `Registered worktree grant: id ${id} (feature "${feature}").`,
    `  worktree:    ${worktreeRoot}`,
    `  main store:  ${mainStoreRoot}`,
    bootstrap.created
      ? `  bootstrapped ${bootstrap.worktreeStoreRoot} (phase idle, gates unapproved).`
      : `  worktree .bee/state.json already existed — left untouched (${bootstrap.reason}).`,
  ].join('\n');
  return { result, text };
}

// "bee worktree new --feature <slug>" (GH #21, decision D7): create AND
// register a fresh linked git worktree in one move. MUST run from the MAIN
// (ordinary) checkout — resolveRoots is the same primitive
// handleWorktreeRegister uses to require the opposite ('linked-valid'); here
// it must be 'ordinary', because "new" is what CREATES the linked worktree
// register later runs inside of.
function handleWorktreeNew(_root, flags) {
  const feature = requireFlag(flags, 'feature');
  const baseRef = flags['base-ref'] !== undefined ? String(flags['base-ref']) : undefined;
  let resolution;
  try {
    resolution = resolveRoots(process.cwd());
  } catch (error) {
    throw new Error(
      `"bee worktree new" must be run from inside the main checkout (not a linked worktree): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (resolution.worktreeResolution !== 'ordinary' || !resolution.workRoot) {
    throw new Error(
      `"bee worktree new" must be run from inside the main checkout, not a "${resolution.worktreeResolution}" checkout — run it from the main repo root, then open your next session inside the created worktree.`,
    );
  }
  const mainRoot = resolution.workRoot;
  const created = createFeatureWorktree(mainRoot, { feature, baseRef });
  const result = {
    id: created.id,
    worktreeRoot: created.worktreeRoot,
    branch: created.branch,
    baseRef: created.baseRef,
    baseRefSha: created.baseRefSha,
  };
  const text = [
    `Created worktree for feature "${feature}": ${created.worktreeRoot}`,
    created.baseRefSha
      ? `  branch:      ${created.branch} (based on ${JSON.stringify(created.baseRef)}, resolved to ${created.baseRefSha})`
      : `  branch:      ${created.branch}`,
    created.bootstrap.created
      ? `  bootstrapped ${created.bootstrap.worktreeStoreRoot} (phase idle, gates unapproved).`
      : `  worktree .bee/state.json already existed — left untouched (${created.bootstrap.reason}).`,
    `Open your next session in ${created.worktreeRoot} to work this feature.`,
  ].join('\n');
  return { result, text };
}

// "bee worktree merge --id <id>" (GH #21, decision D8): merge a granted
// worktree's branch back into MAIN and run the host project's configured
// verify against the merged tree — the semantic-conflict alarm for a merge
// that is textually clean but breaks behavior. Requires an ORDINARY checkout
// (same resolveRoots-based guard handleWorktreeNew uses, for the same
// reason: running merge from inside ANY linked worktree — including the one
// named by --id — already fails this check, which IS the "a worktree cannot
// merge itself" refusal; mergeFeatureWorktree's own isOrdinaryCheckout(mainRoot)
// re-check is the belt-and-braces layer, exactly like createFeatureWorktree's).
// verifyCommand is resolved HERE (readConfig(mainRoot).commands.verify) and
// passed down as a plain option, per worktree-store.mjs's zero-deps-beyond-
// node-builtins module contract (see mergeFeatureWorktree's header comment).
function handleWorktreeMerge(_root, flags) {
  const id = requireFlag(flags, 'id');
  const cleanup = flags.cleanup === true;
  let resolution;
  try {
    resolution = resolveRoots(process.cwd());
  } catch (error) {
    throw new Error(
      `"bee worktree merge" must be run from inside the main checkout (not a linked worktree): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (resolution.worktreeResolution !== 'ordinary' || !resolution.workRoot) {
    throw new Error(
      `"bee worktree merge" must be run from inside the main checkout, not a "${resolution.worktreeResolution}" checkout — a worktree, including the one being merged, cannot merge itself.`,
    );
  }
  const mainRoot = resolution.workRoot;
  const verifyCommand = readConfig(mainRoot).commands.verify || undefined;
  const mergeResultValue = mergeFeatureWorktree(mainRoot, { id, cleanup, verifyCommand });

  const lines = [];
  if (mergeResultValue.ok && mergeResultValue.code === 'ALREADY_UP_TO_DATE') {
    lines.push(`Worktree ${id} (branch ${mergeResultValue.branch}) is already up to date with ${mainRoot} — nothing to merge; no commit was made.`);
  } else if (mergeResultValue.ok) {
    lines.push(`Merged worktree ${id} (branch ${mergeResultValue.branch}) into ${mainRoot}.`);
    lines.push(`  verify: ${mergeResultValue.verify}`);
    if (mergeResultValue.warning) {
      lines.push(`  WARNING (${mergeResultValue.warning.code}): ${mergeResultValue.warning.message}`);
    }
    if (mergeResultValue.cleanup) {
      lines.push(
        mergeResultValue.cleanup.ok
          ? '  cleanup: worktree removed, branch deleted.'
          : `  cleanup: refused (${mergeResultValue.cleanup.code}) — ${mergeResultValue.cleanup.reason}`,
      );
      if (mergeResultValue.cleanup.warning) {
        lines.push(`  WARNING: ${mergeResultValue.cleanup.warning}`);
      }
    } else if (mergeResultValue.cleanup_suggested_command) {
      lines.push(`  cleanup: run \`${mergeResultValue.cleanup_suggested_command}\` when ready.`);
    }
  } else if (mergeResultValue.code === 'MERGE_VERIFY_RED') {
    lines.push(`Merge of worktree ${id} (branch ${mergeResultValue.branch}) was TEXTUALLY CLEAN, but verify is RED (semantic-conflict alarm).`);
    lines.push(`The merge was aborted — ${mainRoot} was left byte-untouched; no merge commit exists. Fix-first before release, then retry the merge.`);
    lines.push('--- verify output tail ---');
    lines.push(mergeResultValue.output_tail);
  } else {
    lines.push(`Merge of worktree ${id} hit a textual conflict — the merge was aborted and ${mainRoot} was left byte-untouched; bee does not auto-resolve a textual conflict. Resolve it in the worktree and retry.`);
  }
  return { result: mergeResultValue, text: lines.join('\n'), exitCode: mergeResultValue.ok ? 0 : 1 };
}

function handleWorktreeList(root, _flags) {
  const mainRoot = resolveMainRoot(root);
  const mainStoreRoot = path.join(mainRoot, '.bee');
  const grants = listGrants(mainStoreRoot);
  const ids = Object.keys(grants).filter((id) => grants[id] === true);
  const text = ids.length ? ids.map((id) => `${id} (granted)`).join('\n') : 'No worktree grants.';
  return { result: { grants, main_root: mainRoot }, text };
}

function handleWorktreeUnregister(root, flags) {
  const mainRoot = resolveMainRoot(root);
  const mainStoreRoot = path.join(mainRoot, '.bee');
  let id = flags.id ? String(flags.id) : null;
  if (!id) {
    let resolution;
    try {
      resolution = resolveRoots(process.cwd());
    } catch (error) {
      throw new Error(
        `--id not given, and the current directory is not a linked worktree: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (resolution.worktreeResolution !== 'linked-valid' || !resolution.id) {
      throw new Error('--id not given, and the current directory is not a linked worktree — pass --id explicitly.');
    }
    id = resolution.id;
  }
  removeGrant(mainStoreRoot, id);
  return { result: { ok: true, id, main_root: mainRoot }, text: `Removed worktree grant for id ${id}.` };
}

// config (ao-2ai-1) — reads the RAW .bee/config.json (readJson fallback
// `undefined`, never `null`: a missing file is the normal, silent "no config
// yet" state every other config reader tolerates — only content that was
// actually read and is unusable counts as a problem, per validateModelsConfig's
// own undefined-vs-null contract) and runs the shared validator so a
// malformed/prompt-less/unsafe cli-tier value gets a LOUD, non-zero-exit
// refusal instead of today's silent revert to the seeded default.
function handleConfigValidate(root, _flags) {
  const raw = readRawConfigForValidation(root);
  // W3 (ao-3b-2, AO12): the same drift advisory `bee status` surfaces joins
  // the models-config problems here too, one CLI verb covering both checks.
  const problems = [...validateModelsConfig(raw), ...validateAgentFilesDrift(root, raw)];
  const result = { ok: problems.length === 0, problem_count: problems.length, problems };
  const text =
    problems.length === 0
      ? 'config validate: OK — no malformed/prompt-less/unsafe cli-tier config or rendered-agent drift found.'
      : problems
          .map(
            (p) =>
              `[${p.code}]${p.runtime ? ` models.${p.runtime}.${p.slot}:` : ''} ${p.message}`,
          )
          .join('\n');
  return { result, text, exitCode: problems.length === 0 ? 0 : 1 };
}

// ─── config get/set/unset (GitHub #15) ────────────────────────────────────
// So a config value (product_root, guards.idle_gate, gate_bypass, …) is changed
// through a validated CLI instead of hand-editing .bee/config.json — the same
// "everything through the CLI" contract every other .bee file already has.

function configFilePath(root) {
  return path.join(root, '.bee', 'config.json');
}

// Read the RAW config object for editing (not readConfig — that normalizes and
// fills defaults, which would balloon the file). Refuses on a present-but-broken
// file so a set/unset never silently clobbers an unparseable config and loses it.
function readRawConfigForEdit(root) {
  const file = configFilePath(root);
  if (!fs.existsSync(file)) return {};
  const raw = readJson(file, undefined);
  if (raw === undefined || raw === null) {
    throw new Error(
      `config: .bee/config.json exists but is not valid JSON — fix it before "config set"/"config unset" (refusing to overwrite and lose your config).`,
    );
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('config: .bee/config.json is not a JSON object.');
  }
  return raw;
}

// Coerce a CLI value string: JSON when it parses (true/false/numbers/objects),
// else the literal string. So `set guards.idle_gate false` stores boolean false
// and `set product_root repo` stores the string "repo". --string forces a string.
function coerceConfigValue(raw, asString) {
  if (asString) return String(raw);
  try {
    return JSON.parse(String(raw));
  } catch {
    return String(raw);
  }
}

function getConfigAtPath(obj, keyPath) {
  let cur = obj;
  for (const part of keyPath.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

function setConfigAtPath(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object' || Array.isArray(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function unsetConfigAtPath(obj, keyPath) {
  const parts = keyPath.split('.');
  const chain = []; // [container, key] pairs, so empty parents can be pruned
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object' || Array.isArray(cur[p])) return false;
    chain.push([cur, p]);
    cur = cur[p];
  }
  const leaf = parts[parts.length - 1];
  if (!Object.prototype.hasOwnProperty.call(cur, leaf)) return false;
  delete cur[leaf];
  // Prune ancestors left empty by the delete (removing guards.idle_gate must not
  // leave a stray "guards": {} — that is the config clutter #15 is about).
  for (let i = chain.length - 1; i >= 0; i--) {
    const [parent, key] = chain[i];
    const child = parent[key];
    if (child && typeof child === 'object' && !Array.isArray(child) && Object.keys(child).length === 0) {
      delete parent[key];
    } else {
      break;
    }
  }
  return true;
}

// Refuse a write that INTRODUCES a new models/cli-safety problem (the same check
// `config validate` runs). Pre-existing, unrelated problems never block an
// unrelated set — only newly-introduced ones do.
function refuseIfNewConfigProblem(verb, before, after) {
  const key = (p) => `${p.code}|${p.runtime || ''}|${p.slot || ''}`;
  const had = new Set(before.map(key));
  const introduced = after.filter((p) => !had.has(key(p)));
  if (introduced.length > 0) {
    throw new Error(
      `config ${verb}: refusing to write — this would make the config invalid:\n` +
        introduced.map((p) => `[${p.code}] ${p.message}`).join('\n'),
    );
  }
}

function handleConfigGet(root, flags) {
  const key = requireFlag(flags, 'key');
  const value = getConfigAtPath(readRawConfigForEdit(root), key);
  const present = value !== undefined;
  return {
    result: { key, present, value: present ? value : null },
    text: present ? `${key} = ${JSON.stringify(value)}` : `config get: "${key}" is not set.`,
  };
}

function handleConfigSet(root, flags) {
  const key = requireFlag(flags, 'key');
  const value = coerceConfigValue(requireFlag(flags, 'value'), flags.string === true);
  const before = validateModelsConfig(readRawConfigForValidation(root));
  const config = readRawConfigForEdit(root);
  setConfigAtPath(config, key, value);
  refuseIfNewConfigProblem('set', before, validateModelsConfig(config));
  writeJsonAtomic(configFilePath(root), config);
  return { result: { key, value }, text: `config set: ${key} = ${JSON.stringify(value)}` };
}

function handleConfigUnset(root, flags) {
  const key = requireFlag(flags, 'key');
  const before = validateModelsConfig(readRawConfigForValidation(root));
  const config = readRawConfigForEdit(root);
  const removed = unsetConfigAtPath(config, key);
  if (!removed) {
    return { result: { key, removed: false }, text: `config unset: "${key}" was not set (no change).` };
  }
  refuseIfNewConfigProblem('unset', before, validateModelsConfig(config));
  writeJsonAtomic(configFilePath(root), config);
  return { result: { key, removed: true }, text: `config unset: removed "${key}".` };
}

// ─── doctor (codex-native-runtime-v2 D11): fail-closed runtime health report
// ─────────────────────────────────────────────────────────────────────────
// Every row states its own evidence and status (ok/warn/unknown/unsupported);
// overall_status is a THREE-state verdict (g22-3, D4): 'blocked' when any
// MECHANICAL row marked `blocking: true` is not-ok (hooks file missing,
// capability-baseline drift, handlers unresolvable, skills missing/warn);
// 'degraded' when every mechanical row is ok but codex's four trust rows
// (marked `degrades: true`, never `blocking` anymore) are still structurally
// unknown and no valid attestation covers them; 'ready' only when mechanical
// rows are all ok AND (codex) a valid attestation exists, or (claude, which
// has no trust-unknown rows) mechanical green alone — no attestation
// concept on claude, deliberately kept simple. File presence alone never
// grants 'ready'. This whole command performs ZERO writes EXCEPT `doctor
// attest`, which records a static attestation file on request (D5-REVISED)
// — `doctor` (no verb) itself still performs zero writes, every helper below
// still only reads.

// D6: the codex-cli version the capability matrix (docs/history/
// codex-native-runtime-v2/reports/capability-matrix.md) actually probed.
// Trust/discovery verdicts below are conclusions about THIS version only —
// a live codex whose --version differs is unprobed territory, never
// silently asserted as if it shared the same F1 capability-matrix row.
const PROBED_CODEX_VERSION = '0.144.4';

const CODEX_DOCTOR_TRUST_UNKNOWN_REASON =
  `codex-cli ${PROBED_CODEX_VERSION} exposes no machine-readable hook-discovery/trust surface — \`codex doctor --json\` reports no hook/trust/agent rows (capability matrix row F1); trust state lives only in the interactive \`/hooks\` TUI, which is not machine-readable.`;

// `codex --version` prints a full label ("codex-cli 0.144.4"), not a bare
// semver — extract just the number for comparison against
// PROBED_CODEX_VERSION so this never false-mismatches on the label text.
function doctorExtractVersionNumber(raw) {
  if (typeof raw !== 'string') return null;
  const match = raw.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

// D6: when the live codex --version does not match PROBED_CODEX_VERSION, the
// trust rows must not assert the probed version's conclusions — they report
// `unprobed_version` instead (evidence carries that literal token so callers
// can grep for it), naming the mismatch and asking for a re-probe rather
// than a silent guess either way (ready or blocked). An unresolved live
// version (codex not on PATH) cannot be proven to differ, so it keeps the
// default (probed) wording rather than a speculative mismatch claim.
function doctorCodexTrustUnknownReason(liveVersionRaw) {
  const liveVersionNumber = doctorExtractVersionNumber(liveVersionRaw);
  if (liveVersionNumber && liveVersionNumber !== PROBED_CODEX_VERSION) {
    return (
      `unprobed_version: live codex --version reports "${liveVersionRaw}" (${liveVersionNumber}), which has not been ` +
      `capability-probed (only ${PROBED_CODEX_VERSION} has — capability matrix row F1); re-run the probe before ` +
      'trusting any hook-discovery/trust conclusion for this version. Trust state lives only in the interactive ' +
      '`/hooks` TUI, which is not machine-readable.'
    );
  }
  return CODEX_DOCTOR_TRUST_UNKNOWN_REASON;
}

function doctorRow(row, status, value, evidence, extra = {}) {
  return { row, status, value, evidence, ...extra };
}

function doctorSafeReadText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function doctorSafeReadJson(file) {
  const text = doctorSafeReadText(file);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function doctorExtractHookCommands(hooksJson) {
  const commands = [];
  const events = hooksJson && hooksJson.hooks && typeof hooksJson.hooks === 'object' ? hooksJson.hooks : {};
  for (const matchers of Object.values(events)) {
    if (!Array.isArray(matchers)) continue;
    for (const matcher of matchers) {
      const list = matcher && Array.isArray(matcher.hooks) ? matcher.hooks : [];
      for (const h of list) {
        if (h && typeof h.command === 'string') commands.push(h.command);
      }
    }
  }
  return commands;
}

// Every rendered hook command (both the repo and plugin targets) execs
// "node .../hooks/<file>.mjs" — pull every referenced filename regardless of
// which absolute prefix precedes it (repo target resolves it at runtime from
// $r, so no static prefix is provable here; only the filename is).
function doctorHookHandlerFilenames(commands) {
  const files = new Set();
  const re = /hooks\/([A-Za-z0-9_.-]+\.mjs)/g;
  for (const command of commands) {
    let match;
    while ((match = re.exec(command)) !== null) files.add(match[1]);
  }
  return [...files];
}

export function doctorCodexVersion() {
  try {
    const result = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 5000 });
    if (result.error || typeof result.status !== 'number' || result.status !== 0) {
      return doctorRow(
        'codex_version',
        'warn',
        null,
        'codex binary not found on PATH (or exited non-zero) — cannot report an installed version.',
      );
    }
    const value = (result.stdout || '').trim() || null;
    return doctorRow(
      'codex_version',
      value ? 'ok' : 'warn',
      value,
      value ? `codex --version -> ${value}` : 'codex --version produced no output.',
    );
  } catch (error) {
    return doctorRow(
      'codex_version',
      'warn',
      null,
      `codex --version threw: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Mechanical/blocking (D4): a missing hooks file is a MECHANICAL fact, not a
// codex-runtime-trust unknown — it blocks readiness outright rather than
// merely degrading it.
function doctorHooksFilePresent(root) {
  const present = fs.existsSync(path.join(root, '.codex', 'hooks.json'));
  return doctorRow(
    'hooks_file_present',
    present ? 'ok' : 'warn',
    present,
    present ? '.codex/hooks.json exists.' : '.codex/hooks.json is missing.',
    { blocking: true },
  );
}

// Byte-compares the LIVE repo-fallback hooks file against the sha256 the
// onboarding ledger recorded at install time (managed.repo_hooks) — the same
// honest-drift discipline bee_status already uses for vendored runtime files
// (no second hashing implementation; reuses lib/fsutil.mjs's hashFile).
// Mechanical/blocking (D4): every non-ok status here (warn OR unknown) is a
// file-state fact, never a trust unknown — all of them block readiness.
function doctorCapabilityBaselineMatch(root) {
  const hooksPath = path.join(root, '.codex', 'hooks.json');
  if (!fs.existsSync(hooksPath)) {
    return doctorRow('capability_baseline_match', 'warn', false, '.codex/hooks.json is absent — cannot compare against the recorded baseline.', { blocking: true });
  }
  const onboarding = readOnboarding(root);
  const recorded = onboarding?.managed?.repo_hooks?.['.codex/hooks.json'] ?? null;
  if (!recorded) {
    return doctorRow('capability_baseline_match', 'unknown', null, 'no recorded baseline hash in .bee/onboarding.json managed.repo_hooks — run onboarding.', { blocking: true });
  }
  const live = hashFile(hooksPath);
  if (live !== recorded) {
    return doctorRow(
      'capability_baseline_match',
      'warn',
      false,
      `live .codex/hooks.json sha256 (${live}) does not match the recorded baseline (${recorded}).`,
      { fix: 'Re-render via self-onboard sync: node skills/bee-hive/scripts/onboard_bee.mjs --repo-root . --apply', blocking: true },
    );
  }
  return doctorRow('capability_baseline_match', 'ok', true, `live .codex/hooks.json byte-matches the recorded baseline (${live}).`, { blocking: true });
}

// D4 re-class: these four rows used to carry `blocking: true` (holding
// overall_status at not_ready outright). They now carry `degrades: true`
// instead — structurally unknown trust state no longer BLOCKS readiness by
// itself, it only prevents 'ready' until a valid attestation (D5-REVISED,
// `doctor attest`) covers it; `degraded_reason` is the short, user-facing
// instruction (review /hooks) distinct from the long evidence string.
function doctorCodexTrustUnknownRows(liveVersion) {
  const reason = doctorCodexTrustUnknownReason(liveVersion);
  return ['hooks_discovered', 'hooks_trusted', 'project_trust', 'pending_hook_review'].map((row) =>
    doctorRow(row, 'unknown', null, reason, {
      degrades: true,
      degraded_reason: 'trust state is not machine-verifiable — review it yourself via the interactive `/hooks` TUI, then run `bee doctor attest --runtime codex` once satisfied.',
    }),
  );
}

// Ported from skills/bee-hive/scripts/onboard_bee.mjs::repoOwnsHookCatalog
// (a bare reference here would ReferenceError — bee.mjs and onboard_bee.mjs
// are separate files, not mirrors of each other). Used only for evidence
// labeling below: which install topology produced the resolution, never to
// change which locations are checked.
function repoOwnsHookCatalog(root) {
  return fs.existsSync(path.join(root, 'hooks', 'catalog.mjs'));
}

// GH #22 P1-1: a normal host install renders hook commands as
// "$r"/.bee/bin/hooks/<f>.mjs and has NO root hooks/ dir at all — only bee's
// own source checkout (and the conformance fixture that mimics it) also has
// a root hooks/. Checking a single hard-coded dir (formerly always "hooks")
// reported every healthy hybrid host install as broken. Mirrors the
// Claude-side resolver precedent (doctorClaudeHandlersResolvable below):
// resolvable = file exists at .bee/bin/hooks/<f> OR hooks/<f>; the evidence
// names WHICH location resolved each file (or that neither did).
// Mechanical/blocking (D4): every branch below is a file-resolution fact.
function doctorHookHandlersResolvable(root) {
  const hooksPath = path.join(root, '.codex', 'hooks.json');
  const hooksJson = doctorSafeReadJson(hooksPath);
  if (!hooksJson) {
    return doctorRow('hook_handlers_resolvable', 'warn', null, `${hooksPath} is missing or unparsable — no command paths to resolve.`, { blocking: true });
  }
  const commands = doctorExtractHookCommands(hooksJson);
  const files = doctorHookHandlerFilenames(commands);
  if (files.length === 0) {
    return doctorRow('hook_handlers_resolvable', 'warn', [], 'no hooks/*.mjs command references found in .codex/hooks.json.', { blocking: true });
  }
  const topology = repoOwnsHookCatalog(root)
    ? 'repo owns hook catalog -> source-checkout topology'
    : 'host topology (.bee/bin/hooks)';
  const resolvedAt = [];
  const missing = [];
  for (const f of files) {
    if (fs.existsSync(path.join(root, '.bee', 'bin', 'hooks', f))) {
      resolvedAt.push(`${f} -> .bee/bin/hooks/`);
    } else if (fs.existsSync(path.join(root, 'hooks', f))) {
      resolvedAt.push(`${f} -> hooks/`);
    } else {
      missing.push(f);
    }
  }
  if (missing.length) {
    return doctorRow(
      'hook_handlers_resolvable',
      'warn',
      files,
      `${topology}; missing handler file(s) under .bee/bin/hooks/ or hooks/: ${missing.join(', ')}.`,
      { fix: `Restore ${missing.join(', ')} under .bee/bin/hooks/ (or hooks/ in a source checkout), or re-render .codex/hooks.json from the catalog.`, blocking: true },
    );
  }
  return doctorRow(
    'hook_handlers_resolvable',
    'ok',
    files,
    `${topology}; ${resolvedAt.length} handler file(s) resolved: ${resolvedAt.join(', ')}.`,
    { blocking: true },
  );
}

// Provable ONLY against a session-start boundary, which a fresh bee.mjs
// process never has — never inferred from recent log activity; the newest
// row timestamp(s) are surfaced as context only, not as proof of observation.
function doctorHooksObservedThisSession(root) {
  const text = doctorSafeReadText(path.join(root, '.bee', 'logs', 'hooks.jsonl'));
  if (!text || !text.trim()) {
    return doctorRow('hooks_observed_this_session', 'unknown', null, 'no .bee/logs/hooks.jsonl on disk yet — no session-start boundary to test against.');
  }
  const lines = text.split(/\r?\n/).filter(Boolean);
  const recent = lines
    .slice(-3)
    .map((line) => {
      try {
        return JSON.parse(line).ts;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return doctorRow(
    'hooks_observed_this_session',
    'unknown',
    null,
    `bee.mjs runs as a fresh process with no session-start boundary to test against — never inferred from recent log activity alone. Newest logged row timestamp(s) as context only: ${recent.join(', ') || '(none)'}.`,
  );
}

function doctorPermissionModeCodex(root) {
  const text = doctorSafeReadText(path.join(root, '.codex', 'config.toml'));
  const match = text ? text.match(/approval_policy\s*=\s*"([^"]*)"/) : null;
  const configured = match ? match[1] : null;
  return doctorRow(
    'permission_mode',
    'unknown',
    { configured, observed: null },
    configured
      ? `configured approval_policy = "${configured}" in .codex/config.toml; observed permission_mode has no doctor-time runtime surface on codex-cli 0.144.4 (it only appears inside a fired hook envelope, matrix row C2).`
      : 'no approval_policy configured in .codex/config.toml; observed permission_mode has no doctor-time runtime surface.',
  );
}

function doctorHookSourcesCodex(root) {
  const repoPresent = fs.existsSync(path.join(root, '.codex', 'hooks.json'));
  const pluginProjectionCheckedIn = fs.existsSync(path.join(root, 'hooks', 'hooks.json'));
  const configured = { repo: repoPresent, plugin_projection_checked_in: pluginProjectionCheckedIn };
  return doctorRow(
    'hook_sources',
    repoPresent ? 'ok' : 'warn',
    { configured, active: 'unknown' },
    repoPresent
      ? `repo-fallback .codex/hooks.json is configured and is the sole exercisable source today (plugin hooks not-observed on codex-cli ${PROBED_CODEX_VERSION}, capability matrix row B1); which source is actively loaded has no runtime surface, so "active" stays unknown rather than inferred from presence.`
      : 'no repo-fallback .codex/hooks.json found; nothing configured to load.',
  );
}

// D7/g22-4: the bee-render/2 sidecar schema this deep audit expects. bee.mjs
// cannot import skills/bee-hive/scripts/onboard_bee.mjs (separate
// distribution target — templates/bee.mjs and .bee/bin/bee.mjs ship without
// the scripts/ tree; see the mirror-discipline note at the top of this
// file), so this literal and the digest algorithm below are hand-mirrors of
// onboard_bee.mjs's RENDER_SCHEMA / skillDigest / walkSkillTree — keep them
// in lockstep by hand when either side changes.
const SKILL_RENDER_SCHEMA_V2 = 'bee-render/2';

// Walks one installed skill dir exactly like onboard_bee.mjs's
// walkSkillTree(dir) (no transform — reading already-rendered bytes off
// disk): a symlink or unsupported entry anywhere blocks the whole walk
// (never partially hashed), every plain file is hashed by its raw bytes.
// Returns { blocked } or { sha256 } — sha256 is
// sha256(JSON.stringify(sorted [relPath, sha256(fileBytes)] pairs)), the
// same fold onboard_bee.mjs's skillDigest(manifestFingerprint(files)) uses.
function doctorWalkSkillDir(dirAbs) {
  const files = [];
  let blocked = null;
  const walk = (dir, relPrefix) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      blocked = { path: relPrefix || '.', reason: 'unreadable directory' };
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (blocked) return;
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        blocked = { path: rel, reason: 'symlink' };
        return;
      }
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.isFile()) {
        files.push([rel, crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex')]);
      } else {
        blocked = { path: rel, reason: 'unsupported entry type' };
        return;
      }
    }
  };
  walk(dirAbs, '');
  if (blocked) return { blocked };
  files.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { sha256: crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex') };
}

// Deep-audits the installed skill set at `dir` against a bee-render/2
// sidecar: every expected skill dir (sidecar.skills[]) must be present, no
// unexpected plain bee-* stray dir may exist, and every expected skill's
// recomputed content digest must match. A blocked walk (e.g. a symlink
// inside an installed skill dir) counts as drifted — it can never be proven
// to match.
function doctorDeepAuditSkills(dir, sidecar) {
  const expected = new Map((Array.isArray(sidecar.skills) ? sidecar.skills : []).map((s) => [s.name, s.sha256]));
  const installedNames = fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && /^bee-/.test(e.name))
        .map((e) => e.name)
    : [];
  const installed = new Set(installedNames);
  const missing = [...expected.keys()].filter((name) => !installed.has(name)).sort();
  const stray = installedNames.filter((name) => !expected.has(name)).sort();
  const drifted = [];
  for (const [name, expectedHash] of expected) {
    if (!installed.has(name)) continue; // already reported as missing
    const walk = doctorWalkSkillDir(path.join(dir, name));
    if (walk.blocked || walk.sha256 !== expectedHash) {
      drifted.push(name);
    }
  }
  drifted.sort();
  return { ok: missing.length === 0 && stray.length === 0 && drifted.length === 0, missing, stray, drifted };
}

// Mechanical/blocking (D4) — shared by both runtimes (codex's .agents/skills,
// claude's .claude/skills). g22-4/D7: a v2 sidecar drives a DEEP audit
// (missing/stray/hash-drift, all mechanical/blocking — a drifted skill makes
// doctor `blocked`, which is correct: g22-3's three-state has no room for a
// silently-wrong installed skill tree). A v1 sidecar (pre-D7) or a missing
// sidecar both fall back to the shallow "dir count + provenance present"
// check that shipped before this cell — v1 additionally warns that deep
// inventory is unavailable, but per decision it must NEVER block (legacy
// hosts stay usable until they re-onboard); a missing sidecar keeps its
// original blocking behavior unchanged.
function doctorSkillsInstalled(root, skillsDir) {
  const dir = path.join(root, skillsDir);
  const sidecar = doctorSafeReadJson(path.join(dir, '.bee-render.json'));
  const exists = fs.existsSync(dir);
  const entries = exists ? fs.readdirSync(dir).filter((n) => !n.startsWith('.')) : [];
  if (!exists) {
    return doctorRow('skills_installed', 'warn', { count: 0, provenance: null }, `${skillsDir}/ is absent.`, { blocking: true });
  }
  if (!sidecar) {
    return doctorRow(
      'skills_installed',
      'warn',
      { count: entries.length, provenance: null },
      `${entries.length} skill dir(s) under ${skillsDir}/, provenance sidecar MISSING; runtime-side discovery has no machine-readable surface to confirm against.`,
      { blocking: true },
    );
  }
  if (sidecar.schema !== SKILL_RENDER_SCHEMA_V2) {
    return doctorRow(
      'skills_installed',
      'warn',
      { count: entries.length, provenance: sidecar },
      `${entries.length} skill dir(s) under ${skillsDir}/, provenance sidecar present (${sidecar.schema || '(unversioned)'}) — inventory unavailable (bee-render/1) — re-run onboarding/render to upgrade.`,
      { blocking: false },
    );
  }
  const audit = doctorDeepAuditSkills(dir, sidecar);
  if (!audit.ok) {
    const parts = [];
    if (audit.missing.length) parts.push(`missing: ${audit.missing.join(', ')}`);
    if (audit.stray.length) parts.push(`stray: ${audit.stray.join(', ')}`);
    if (audit.drifted.length) parts.push(`drifted: ${audit.drifted.join(', ')}`);
    return doctorRow(
      'skills_installed',
      'warn',
      { count: entries.length, provenance: sidecar, audit },
      `${entries.length} skill dir(s) under ${skillsDir}/ do not match the bee-render/2 sidecar inventory — ${parts.join('; ')}.`,
      { blocking: true, fix: 'Re-render via self-onboard sync: node skills/bee-hive/scripts/onboard_bee.mjs --repo-root . --apply' },
    );
  }
  return doctorRow(
    'skills_installed',
    'ok',
    { count: entries.length, provenance: sidecar },
    `${entries.length} skill dir(s) under ${skillsDir}/ match the bee-render/2 sidecar inventory (deep audit: every skill's content digest verified).`,
    { blocking: true },
  );
}

function doctorCustomAgentsCodex(codexVersionValue) {
  return doctorRow(
    'custom_agents',
    'unsupported',
    codexVersionValue,
    `${codexVersionValue || '(codex version unknown)'}: .codex/agents/*.toml discovery is not-observed on codex-cli ${PROBED_CODEX_VERSION} (capability matrix rows A1/A2) — only built-in default/explorer/worker agent types spawn, carrying no bee developer_instructions. This verdict is version-scoped: other versions are unverified until re-probed.`,
  );
}

// Claude's analogous mechanical set (D4): hook_wiring_resolvable /
// handlers_resolvable / model_guard_entry_present / skills_installed (shared
// helper above) — the four rows that block claude's readiness outright.
// Claude has no structurally-unknown trust rows (no `degrades` concept), so
// mechanical-green alone reaches 'ready' — no attestation required; see
// doctorOverallStatus for why that is kept deliberately simple.
function doctorClaudeHookWiring(root) {
  const settings = doctorSafeReadJson(path.join(root, '.claude', 'settings.json'));
  if (!settings || !settings.hooks) {
    return doctorRow('hook_wiring_resolvable', 'warn', false, '.claude/settings.json has no hooks block.', { blocking: true });
  }
  const events = Object.keys(settings.hooks);
  const required = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'];
  const missing = required.filter((e) => !events.includes(e));
  if (missing.length) {
    return doctorRow('hook_wiring_resolvable', 'warn', events, `missing lifecycle event(s) in .claude/settings.json hooks: ${missing.join(', ')}.`, { blocking: true });
  }
  return doctorRow('hook_wiring_resolvable', 'ok', events, `${events.length} lifecycle event(s) wired in .claude/settings.json.`, { blocking: true });
}

function doctorClaudeHandlersResolvable(root) {
  const settings = doctorSafeReadJson(path.join(root, '.claude', 'settings.json'));
  const commands = doctorExtractHookCommands({ hooks: settings ? settings.hooks : {} });
  if (!commands.length) {
    return doctorRow('handlers_resolvable', 'warn', [], 'no hook commands found in .claude/settings.json.', { blocking: true });
  }
  const files = doctorHookHandlerFilenames(commands);
  const missing = files.filter(
    (f) => !fs.existsSync(path.join(root, '.bee', 'bin', 'hooks', f)) && !fs.existsSync(path.join(root, 'hooks', f)),
  );
  if (missing.length) {
    return doctorRow(
      'handlers_resolvable',
      'warn',
      files,
      `missing handler file(s): ${missing.join(', ')}.`,
      { fix: 'Re-run onboarding to restore .bee/bin/hooks/*.', blocking: true },
    );
  }
  return doctorRow('handlers_resolvable', 'ok', files, `${files.length} handler file(s) resolved.`, { blocking: true });
}

function doctorClaudeModelGuardEntry(root) {
  const settings = doctorSafeReadJson(path.join(root, '.claude', 'settings.json'));
  const preToolUse = settings && settings.hooks && Array.isArray(settings.hooks.PreToolUse) ? settings.hooks.PreToolUse : [];
  const found = preToolUse.some(
    (m) =>
      m &&
      typeof m.matcher === 'string' &&
      /Agent/.test(m.matcher) &&
      Array.isArray(m.hooks) &&
      m.hooks.some((h) => h && typeof h.command === 'string' && h.command.includes('bee-model-guard')),
  );
  return doctorRow(
    'model_guard_entry_present',
    found ? 'ok' : 'warn',
    found,
    found
      ? 'PreToolUse Agent-shaped matcher is wired to bee-model-guard.mjs.'
      : 'no PreToolUse Agent-shaped bee-model-guard entry found in .claude/settings.json.',
    { blocking: true },
  );
}

function doctorClaudeRenderedAgents(root) {
  const onboarding = readOnboarding(root);
  const files = Array.isArray(onboarding?.agents_sync?.files) ? onboarding.agents_sync.files : [];
  if (!files.length) {
    return doctorRow('rendered_agents_present', 'unknown', [], 'no agents_sync.files recorded in .bee/onboarding.json.');
  }
  const missing = files.filter((f) => !fs.existsSync(path.join(root, f)));
  if (missing.length) {
    return doctorRow('rendered_agents_present', 'warn', files, `missing rendered agent file(s): ${missing.join(', ')}.`);
  }
  return doctorRow('rendered_agents_present', 'ok', files, `${files.length} rendered agent file(s) present.`);
}

function doctorClaudePermissionMode(root) {
  const settings = doctorSafeReadJson(path.join(root, '.claude', 'settings.json'));
  const configured =
    settings && settings.permissions && typeof settings.permissions.defaultMode === 'string' ? settings.permissions.defaultMode : null;
  return doctorRow(
    'permission_mode',
    configured ? 'ok' : 'unknown',
    { configured, observed: null },
    configured
      ? `configured permissions.defaultMode = "${configured}" in .claude/settings.json; observed mode has no doctor-time runtime surface.`
      : 'no permissions.defaultMode configured in .claude/settings.json.',
  );
}

// A row is load-bearing (blocking) only when the cell that produced it says
// so explicitly — never inferred from its status alone, so a `warn` on a
// non-load-bearing informational row (codex_version, hooks_observed_this_
// session, permission_mode, hook_sources, custom_agents, claude's rendered_
// agents_present) can never silently promote itself into the verdict. D4:
// three states, computed in two passes —
//   1. any `blocking` row not-ok -> 'blocked', full stop (mechanical facts:
//      a missing/drifted hooks file or an unresolvable handler/skill set
//      means nothing downstream is provable, attested or not).
//   2. otherwise, any `degrades` row (codex's 4 structurally-unknown trust
//      rows) without a currently-VALID attestation -> 'degraded'; a valid
//      attestation covers them -> 'ready'.
//   3. no blocking, no degrading (or claude, which has neither concept for
//      today's row set) -> 'ready' outright — mechanical green is the whole
//      bar; no attestation concept applies.
// `attestation` is null for claude (and for a codex call that never reaches
// this far) — see doctorValidateAttestation below.
function doctorOverallStatus(rows, attestation = null) {
  const blocked = rows.filter((r) => r.blocking && r.status !== 'ok');
  if (blocked.length > 0) {
    return {
      overall_status: 'blocked',
      reasons: blocked.map((r) => `${r.row}: BLOCKS readiness — ${r.evidence}`),
    };
  }
  const degrading = rows.filter((r) => r.degrades);
  if (degrading.length === 0) {
    return { overall_status: 'ready', reasons: [] };
  }
  if (attestation && attestation.valid) {
    return { overall_status: 'ready', reasons: [] };
  }
  const reasons = [
    ...degrading.map((r) => `${r.row}: ${r.evidence}${r.degraded_reason ? ` ${r.degraded_reason}` : ''}`),
    attestation
      ? `${attestation.reason}: ${attestation.detail}`
      : 'no_attestation: no attestation recorded — run `bee doctor attest --runtime codex` once trust state has been reviewed via /hooks.',
  ];
  return { overall_status: 'degraded', reasons };
}

// ─── doctor attest (g22-3, D5-REVISED): a static, request-only attestation
// that a human (or an agent on the human's behalf) reviewed codex trust
// state via the interactive /hooks TUI and is vouching for THIS exact
// hooks-file/codex-version/repo pairing. Recorded to a gitignored runtime-
// tier file — never tracked state, never auto-run by `doctor` itself (D5-
// REVISED: attest is a distinct, deliberate verb, not a doctor side effect).
// No liveness leg exists on codex: hooks.jsonl only ever logs deny/crash
// events and tools.jsonl is claude-only (bee-tools-logger.mjs, PostToolUse)
// — a healthy codex session writes NOTHING codex-side that doctor could
// observe, so attestation validity is purely static (hash/version/identity),
// and the reason string says so honestly rather than implying a liveness
// check that does not exist.
function doctorAttestPath(root) {
  return path.join(root, '.bee', 'doctor-attest.json');
}

function doctorRepoIdentity(root) {
  try {
    return fs.realpathSync(root);
  } catch {
    return root;
  }
}

// Validates a recorded attestation against LIVE state: hooks-file sha256,
// codex --version, and repo identity must all still match what was attested.
// Any single failed leg makes the whole attestation inert (never partially
// trusted) — the specific stale reason is one of hash_changed / version_
// changed / identity_changed / no_attestation, exactly as D5-REVISED names
// them, so a caller can branch on `reason` without parsing prose.
function doctorValidateAttestation(root, liveCodexVersion) {
  const record = doctorSafeReadJson(doctorAttestPath(root));
  if (!record) {
    return {
      valid: false,
      reason: 'no_attestation',
      detail: 'no attestation recorded — run `bee doctor attest --runtime codex` once trust state has been reviewed via /hooks.',
      record: null,
    };
  }
  const hooksPath = path.join(root, '.codex', 'hooks.json');
  const liveHash = fs.existsSync(hooksPath) ? hashFile(hooksPath) : null;
  if (!liveHash || liveHash !== record.hooks_file_sha256) {
    return {
      valid: false,
      reason: 'hash_changed',
      detail: `live .codex/hooks.json sha256 (${liveHash || '(file missing)'}) no longer matches the attested hash (${record.hooks_file_sha256}) — re-review /hooks and re-attest.`,
      record,
    };
  }
  if ((liveCodexVersion || null) !== (record.codex_version || null)) {
    return {
      valid: false,
      reason: 'version_changed',
      detail: `live codex --version (${liveCodexVersion || '(unresolved)'}) no longer matches the attested version (${record.codex_version || '(unresolved)'}) — re-review /hooks and re-attest.`,
      record,
    };
  }
  const liveIdentity = doctorRepoIdentity(root);
  if (liveIdentity !== record.repo_identity) {
    return {
      valid: false,
      reason: 'identity_changed',
      detail: `live repo identity (${liveIdentity}) no longer matches the attested identity (${record.repo_identity}) — an attestation from a different checkout never carries over; re-attest here.`,
      record,
    };
  }
  return {
    valid: true,
    reason: null,
    detail:
      `attested at ${record.at} — hooks-file sha256, codex version, and repo identity all still match. ` +
      'codex exposes no hook-fire event surface (hooks.jsonl is deny/crash-only, tools.jsonl is claude-only) — attestation is static, not a liveness check.',
    record,
  };
}

function handleDoctorAttest(root, flags) {
  const runtime = requireFlag(flags, 'runtime');
  if (runtime !== 'codex') {
    throw new Error(`doctor attest: --runtime must be "codex" (got "${runtime}") — claude has no trust-unknown rows and no attestation model.`);
  }
  const hooksPath = path.join(root, '.codex', 'hooks.json');
  if (!fs.existsSync(hooksPath)) {
    throw new Error(`doctor attest: ${hooksPath} does not exist — nothing to attest.`);
  }
  const versionRow = doctorCodexVersion();
  const sessionId =
    typeof flags.session === 'string' && flags.session
      ? flags.session
      : process.env.CODEX_SESSION_ID || process.env.CLAUDE_SESSION_ID || null;
  const record = {
    hooks_file_sha256: hashFile(hooksPath),
    codex_version: versionRow.value,
    session_id: sessionId,
    at: new Date().toISOString(),
    repo_identity: doctorRepoIdentity(root),
  };
  writeJsonAtomic(doctorAttestPath(root), record);
  const result = { ok: true, attestation: record };
  return {
    result,
    text: `doctor attest: recorded (hooks sha256 ${record.hooks_file_sha256.slice(0, 12)}…, codex ${record.codex_version || '(unresolved)'}, repo ${record.repo_identity}).`,
  };
}

// ─── native transport capability probe (codex-native-transport D3/D4,
// advisor Δ2/R3 — binding): a version+config-scoped record of whether the
// installed codex-cli can accept a native spawn_agent model override,
// mirroring the g22-3 doctor-attest pattern above (same validity-leg
// discipline: any single failed leg invalidates the whole record, never
// partially trusted) but stored in its OWN separate gitignored file —
// doctor-attest's 3 legs (hooks hash, codex version, repo identity) cannot
// see codex FEATURE/config changes, so this record needs a 4th leg
// (config_scope_hash) alongside version+identity. Never merged into
// doctor-attest.json (Δ2, binding: attest is a human-reviewed /hooks trust
// vouching, this is a machine-observed capability fact — different
// questions, different files).
//
// Evidence is produced by `codex features list` (read-only, safe against
// the real environment — it lists, it never sets) and, for the actual
// override-spawn acceptance leg, the g22-6 canary harness (cnt-5) running
// under an ISOLATED per-run CODEX_HOME (D4: bee never flips flags on the
// user's real config). This cell (cnt-2) only defines the record shape,
// the writer cnt-5 calls with its canary evidence, and the reader every
// downstream consumer gates on (readNativeTransportClassification — R3).
export function nativeTransportProbePath(root) {
  return path.join(root, '.bee', 'native-transport-probe.json');
}

const NATIVE_TRANSPORT_PROBE_SCHEMA = 'native-transport-probe/1';

// The feature/config scope this probe cares about (D3a/Δ2-amended,
// decisions c0cba64e/760e9b05 — authoritative): the hash covers ALL FOUR
// verdict-determining flags — multi_agent, multi_agent_v2 (both directly
// observable via `codex features list`, doctorCodexFeaturesList below —
// D3a made base multi_agent a determinant too, via the external_cli_only
// trigger, so it must be hashed or an unhashed multi_agent toggle would
// leave a stale verdict standing) plus hide_spawn_agent_metadata and
// tool_namespace (config.toml-only settings the canary configures inside
// its isolated CODEX_HOME and cannot be independently re-observed later
// without re-running the canary — included in the schema/hash for
// completeness and provenance, but honestly excluded from the LIVE
// re-check in readNativeTransportClassification below, which only has a
// re-observation surface for the first two).
const NATIVE_TRANSPORT_SCOPE_KEYS = ['multi_agent', 'multi_agent_v2', 'hide_spawn_agent_metadata', 'tool_namespace'];

function nativeTransportScopeFromEvidence(evidence) {
  const scope = {};
  for (const key of NATIVE_TRANSPORT_SCOPE_KEYS) {
    scope[key] = evidence && typeof evidence === 'object' && key in evidence ? evidence[key] : null;
  }
  return scope;
}

export function nativeTransportConfigScopeHash(scope) {
  const flat = scope && typeof scope === 'object' ? scope : {};
  const keys = Object.keys(flat).sort();
  return crypto.createHash('sha256').update(JSON.stringify(flat, keys)).digest('hex');
}

// Read-only `codex features list` — the same tolerance for a subprocess call
// as doctorCodexVersion() above (identical failure handling: binary absent,
// non-zero exit, or a hung call all degrade to null rather than throwing).
// Never mutates codex state; safe to run against the user's real CODEX_HOME.
export function doctorCodexFeaturesList() {
  try {
    const result = spawnSync('codex', ['features', 'list'], { encoding: 'utf8', timeout: 5000 });
    if (result.error || typeof result.status !== 'number' || result.status !== 0) {
      return null;
    }
    const flags = {};
    for (const rawLine of (result.stdout || '').split('\n')) {
      const line = rawLine.trimEnd();
      const match = /^(\S+)\s+(.+?)\s+(true|false)\s*$/.exec(line);
      if (match) {
        flags[match[1]] = { maturity: match[2].trim(), enabled: match[3] === 'true' };
      }
    }
    return flags;
  } catch {
    return null;
  }
}

/**
 * writeNativeTransportProbe(root, { codexVersion, evidence }) — the writer
 * cnt-5's canary calls after it runs. `evidence` carries every raw
 * observation: { multi_agent, multi_agent_v2, hide_spawn_agent_metadata,
 * tool_namespace, override_spawn_accepted } (D3a/Δ2-amended). The
 * classification (classifyNativeTransport, dispatch-guard.mjs, pure) and the
 * config_scope hashed for the 3rd validity leg (the 4 verdict-determining
 * flags, Δ2-amended) are BOTH derived from this single evidence object —
 * one source, so classification and hash can never independently drift the
 * way two separately-passed parameters could. Stamps the remaining validity
 * legs (repo identity, codex version) at write time and stores atomically.
 * Returns the written record.
 */
export function writeNativeTransportProbe(root, { codexVersion = null, evidence = null } = {}) {
  const configScope = nativeTransportScopeFromEvidence(evidence);
  const record = {
    schema: NATIVE_TRANSPORT_PROBE_SCHEMA,
    at: new Date().toISOString(),
    codex_version: codexVersion || null,
    repo_identity: doctorRepoIdentity(root),
    config_scope: configScope,
    config_scope_hash: nativeTransportConfigScopeHash(configScope),
    evidence: evidence || null,
    classification: classifyNativeTransport(evidence),
  };
  writeJsonAtomic(nativeTransportProbePath(root), record);
  return record;
}

/**
 * readNativeTransportClassification(root) — R3 (binding), the ONE reader
 * every downstream consumer (cnt-3's prepare, cnt-4's guard) gates on.
 * Applies the validity legs in order — repo identity, codex version,
 * config-scope integrity, then a live re-check of the codex-observable
 * subset of the scope — and returns `native_budget_only` the moment any leg
 * fails, or the record is missing/malformed. D3: unknown/absent evidence
 * stays inert until proven on the host's actual build.
 *
 * Returns { classification, valid, reason, record }: `classification` is
 * the single string downstream code should branch on; `valid`/`reason`/
 * `record` exist so a caller can build the named-reason refusal D1 requires
 * ("reports its reason; it never silently runs CLI") without re-deriving
 * the leg logic itself.
 */
export function readNativeTransportClassification(root) {
  const record = doctorSafeReadJson(nativeTransportProbePath(root));
  if (!record || record.schema !== NATIVE_TRANSPORT_PROBE_SCHEMA) {
    return { classification: NATIVE_TRANSPORT_NATIVE_BUDGET_ONLY, valid: false, reason: 'no_probe_record', record: null };
  }
  const liveIdentity = doctorRepoIdentity(root);
  if (liveIdentity !== record.repo_identity) {
    return { classification: NATIVE_TRANSPORT_NATIVE_BUDGET_ONLY, valid: false, reason: 'identity_changed', record };
  }
  const liveVersion = doctorCodexVersion().value;
  if ((liveVersion || null) !== (record.codex_version || null)) {
    return { classification: NATIVE_TRANSPORT_NATIVE_BUDGET_ONLY, valid: false, reason: 'version_changed', record };
  }
  const recomputedHash = nativeTransportConfigScopeHash(record.config_scope);
  if (recomputedHash !== record.config_scope_hash) {
    return { classification: NATIVE_TRANSPORT_NATIVE_BUDGET_ONLY, valid: false, reason: 'config_scope_corrupt', record };
  }
  const liveFlags = doctorCodexFeaturesList();
  if (liveFlags) {
    const scope = record.config_scope || {};
    const liveMultiAgent = liveFlags.multi_agent ? liveFlags.multi_agent.enabled : null;
    const liveMultiAgentV2 = liveFlags.multi_agent_v2 ? liveFlags.multi_agent_v2.enabled : null;
    if (liveMultiAgent !== (scope.multi_agent ?? null) || liveMultiAgentV2 !== (scope.multi_agent_v2 ?? null)) {
      return { classification: NATIVE_TRANSPORT_NATIVE_BUDGET_ONLY, valid: false, reason: 'flag_state_changed', record };
    }
  }
  return { classification: record.classification, valid: true, reason: null, record };
}

// D4 (binding): informational only — this row NAMES the unlock, it never
// applies it. Bee never writes features.multi_agent_v2 / hide_spawn_agent_
// metadata into the user's real ~/.codex/config.toml (only the canary's
// isolated per-run copy does). Deliberately non-blocking, non-degrading —
// same "informational, never load-bearing" family as codex_version /
// hooks_observed_this_session / permission_mode / hook_sources / custom_
// agents (see the doctorOverallStatus comment above).
export function doctorNativeTransportUnlock(root, liveFeatures) {
  const probe = readNativeTransportClassification(root);
  const shipsFlag = !!(liveFeatures && liveFeatures.multi_agent_v2);
  if (probe.classification === NATIVE_TRANSPORT_NATIVE_MODEL_OVERRIDE) {
    return doctorRow(
      'native_transport_unlock',
      'ok',
      { classification: probe.classification, ships_flag: shipsFlag },
      'native model-override transport is classified native_model_override — no unlock needed.',
    );
  }
  if (probe.classification !== NATIVE_TRANSPORT_NATIVE_BUDGET_ONLY || !shipsFlag) {
    return doctorRow(
      'native_transport_unlock',
      'ok',
      { classification: probe.classification, ships_flag: shipsFlag },
      `native transport classification is "${probe.classification}"; this codex-cli install does not ship the multi_agent_v2 feature flag, so there is no unlock to name.`,
    );
  }
  return doctorRow(
    'native_transport_unlock',
    'ok',
    { classification: probe.classification, ships_flag: true },
    'native model-override transport is classified native_budget_only, but this codex-cli build ships the multi_agent_v2 feature flag (currently disabled). ' +
      'To unlock native per-agent model override, enable `features.multi_agent_v2 = true` and `hide_spawn_agent_metadata = false` in YOUR OWN ~/.codex/config.toml ' +
      '(D4: bee never writes this for you), then re-run the canary probe to re-classify. This row only names the unlock.',
  );
}

// dispatch (g22-1, GH #22 P0-3) — thin flag-parsing wrapper: every actual
// resolution/payload-construction/prepare-time-record decision lives in
// lib/dispatch-prepare.mjs's prepareDispatch, so this handler's only job is
// pulling flags and letting prepareDispatch's own errors/refusals surface
// (a bad --runtime/--kind or a missing --cell throws; a cli-shaped cell
// resolution or an unconfigured advisor slot is a typed {ok:false} result,
// not a throw — same discipline as reservations.reserve's conflict result).
// Native-transport classification (codex-native-transport D1/D3, R3 —
// binding): this handler is the ONE place that reads
// readNativeTransportClassification(root) and hands its `.classification`
// string into prepareDispatch — dispatch-prepare.mjs (lib) deliberately never
// imports that reader itself (it lives here, in the bin layer; a lib module
// reaching back into bin would invert the repo's bin->lib import direction —
// see prepareDispatch's own docstring). Only the codex runtime ever carries a
// native-transport probe; every other runtime passes classification
// undefined, which prepareDispatch treats exactly like an unprobed host (D3:
// "unprobed/unknown => native_budget_only") — inert for every non-native slot.
function handleDispatchPrepare(root, flags) {
  const runtime = requireFlag(flags, 'runtime');
  const kind = requireFlag(flags, 'kind');
  const cellId = typeof flags.cell === 'string' && flags.cell ? flags.cell : null;
  const classification = runtime === 'codex' ? readNativeTransportClassification(root).classification : undefined;
  const out = prepareDispatch(root, { runtime, kind, cell: cellId, classification });
  return { result: out, text: JSON.stringify(out, null, 2) };
}

function handleDoctor(root, flags) {
  const runtime = requireFlag(flags, 'runtime');
  if (runtime !== 'codex' && runtime !== 'claude') {
    throw new Error(`doctor: --runtime must be "codex" or "claude", got "${runtime}".`);
  }
  let rows;
  let attestation = null;
  if (runtime === 'codex') {
    const versionRow = doctorCodexVersion();
    rows = [
      versionRow,
      doctorHooksFilePresent(root),
      doctorCapabilityBaselineMatch(root),
      ...doctorCodexTrustUnknownRows(versionRow.value),
      doctorHookHandlersResolvable(root),
      doctorHooksObservedThisSession(root),
      doctorPermissionModeCodex(root),
      doctorHookSourcesCodex(root),
      doctorSkillsInstalled(root, path.join('.agents', 'skills')),
      doctorCustomAgentsCodex(versionRow.value),
      doctorNativeTransportUnlock(root, doctorCodexFeaturesList()),
    ];
    attestation = doctorValidateAttestation(root, versionRow.value);
  } else {
    rows = [
      doctorClaudeHookWiring(root),
      doctorClaudeHandlersResolvable(root),
      doctorClaudeModelGuardEntry(root),
      doctorSkillsInstalled(root, path.join('.claude', 'skills')),
      doctorClaudeRenderedAgents(root),
      doctorClaudePermissionMode(root),
      doctorHooksObservedThisSession(root),
    ];
  }
  const { overall_status, reasons } = doctorOverallStatus(rows, attestation);
  const result = { runtime, overall_status, rows, reasons };
  if (runtime === 'codex') {
    result.attestation = attestation.valid
      ? { status: 'valid', at: attestation.record.at, codex_version: attestation.record.codex_version, repo_identity: attestation.record.repo_identity }
      : { status: 'invalid', reason: attestation.reason, detail: attestation.detail };
  }
  const lines = [`bee doctor --runtime ${runtime}: ${overall_status.toUpperCase()}`];
  for (const row of rows) lines.push(`  [${row.status}] ${row.row}: ${row.evidence}`);
  if (reasons.length) {
    lines.push('', 'Reasons:');
    for (const reason of reasons) lines.push(`  - ${reason}`);
  }
  return { result, text: lines.join('\n') };
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
  // session (fresh-session-handoff fsh-4, D2/D4): a new nested verb family,
  // mirroring the worker branch above exactly.
  if (verb === 'session') {
    const sub = leading[2];
    return `Unknown session action "${sub || '(missing)'}". Use: list, bind, unbind.`;
  }
  // handoff (fresh-session-handoff fsh-9, D1): a new nested verb family for
  // the two-kind handoff lifecycle, mirroring the worker/session branches.
  if (verb === 'handoff') {
    const sub = leading[2];
    return `Unknown handoff action "${sub || '(missing)'}". Use: write, adopt, show.`;
  }
  // advisor-ref (ao-4-1, AO3/AO13): the two-verb advisor-consult family,
  // mirroring the worker/session/handoff branches above.
  if (verb === 'advisor-ref') {
    const sub = leading[2];
    return `Unknown advisor-ref action "${sub || '(missing)'}". Use: record, show.`;
  }
  return `Unknown command "${verb || '(missing)'}". Use: set, gate, worker, scribing-run, start-feature, lanes, session, handoff, advisor-ref.`;
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

function perfUsageFallback(leading) {
  const verb = leading[1];
  return `Unknown command "${verb || '(missing)'}". Use: start, stop, section, log, render, report, sync.`;
}

function configUsageFallback(leading) {
  const verb = leading[1];
  return `Unknown command "${verb || '(missing)'}". Use: get, set, unset, validate.`;
}

function worktreeUsageFallback(leading) {
  const verb = leading[1];
  return `Unknown command "${verb || '(missing)'}". Use: register, list, unregister, new, merge.`;
}

function dispatchUsageFallback(leading) {
  const verb = leading[1];
  return `Unknown command "${verb || '(missing)'}". Use: prepare.`;
}

// Legacy-4 group fallbacks (dispatcher-unify du-4): bee_cells.mjs/
// bee_reservations.mjs/bee_decisions.mjs are now shims, so their own
// default-case "Unknown command ... Use: ..." messages (previously emitted
// by each helper's own run() switch) must be reproduced byte-exact here —
// the DA5 bijection probe (test_bee_cli.mjs) still spawns the shims
// directly and parses this exact stderr line.
function cellsUsageFallback(leading) {
  const verb = leading[1];
  return `Unknown command "${verb || '(missing)'}". Use: list, ready, show, add, update, claim, verify, cap, block, drop, unclaim, reopen, tier, judge, claim-next, reset-budget, judge-record, schedule.`;
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
  perf: perfUsageFallback,
  worktree: worktreeUsageFallback,
  config: configUsageFallback,
  dispatch: dispatchUsageFallback,
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
  'cells.unclaim': handleCellsUnclaim,
  'cells.reopen': handleCellsReopen,
  'cells.tier': handleCellsTier,
  'cells.judge': handleCellsJudge,
  'cells.claim-next': handleCellsClaimNext,
  'cells.reset-budget': handleCellsResetBudget,
  'cells.judge-record': handleCellsJudgeRecord,
  'cells.schedule': handleCellsSchedule,
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
  'state.lanes': handleStateLanes,
  'state.session.list': handleStateSessionList,
  'state.session.bind': handleStateSessionBind,
  'state.session.unbind': handleStateSessionUnbind,
  'state.handoff.write': handleStateHandoffWrite,
  'state.handoff.adopt': handleStateHandoffAdopt,
  'state.handoff.show': handleStateHandoffShow,
  'state.advisor-ref.record': handleStateAdvisorRefRecord,
  'state.advisor-ref.show': handleStateAdvisorRefShow,
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
  'perf.start': handlePerfStart,
  'perf.stop': handlePerfStop,
  'perf.section': handlePerfSection,
  'perf.log': handlePerfLog,
  'perf.render': handlePerfRender,
  'perf.report': handlePerfReport,
  'perf.sync': handlePerfSync,
  'worktree.register': handleWorktreeRegister,
  'worktree.list': handleWorktreeList,
  'worktree.unregister': handleWorktreeUnregister,
  'worktree.new': handleWorktreeNew,
  'worktree.merge': handleWorktreeMerge,
  'config.get': handleConfigGet,
  'config.set': handleConfigSet,
  'config.unset': handleConfigUnset,
  'config.validate': handleConfigValidate,
  'dispatch.prepare': handleDispatchPrepare,
  doctor: handleDoctor,
  'doctor.attest': handleDoctorAttest,
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
// (bee_backlog.mjs parsed it boolean-alone too). `as-lane` (fresh-session-
// handoff fsh-4, D2/D4) is state.start-feature's lane-mode opt-in — a
// DISTINCT flag name from the `--lane <feature>` string flag used by
// state.set/gate/scribing-run/session.bind, so the two never collide here.
// `cleanup` (worktree-session-routing wsr-2, GH #21, decision D8b) is
// `worktree merge`'s flag-alone opt-in for post-merge worktree removal.
export const FLAG_ALONE_BOOLEANS = new Set(['json', 'stdin', 'behavior-change', 'evidence-stdin', 'active-only', 'dry-run', 'write', 'as-lane', 'waive-scribing-debt', 'html', 'string', 'cleanup', 'force-ownership']);

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
  return cacheFilePath(root, 'manifest-hash.json');
}
// Legacy location (pre-#11): the drift cache used to sit directly in .bee/ root.
function legacyManifestHashStatePath(root) {
  return path.join(root, '.bee', 'manifest-hash.json');
}

/** Compare the current registry hash against the last-persisted one, then
 * persist the current hash. Returns {manifest_changed, hint} — hint is only
 * meaningful when manifest_changed is true.
 *
 * `skipWrite` (codex-native-runtime-v2 D11): doctor is read-only FOR REAL —
 * zero writes anywhere, including this cache. main() passes skipWrite:true
 * only for the doctor route, which never even attempts the write, so it
 * cannot fail even on an unwritable cache dir. For every OTHER (mutating)
 * command the write still runs, but is now wrapped best-effort: a write
 * failure (e.g. a read-only sandbox) must never crash drift detection — the
 * comparison above already completed off the successfully-read prior hash,
 * so drift checking itself is never weakened, only the persistence step. */
function checkManifestDrift(root, { skipWrite = false } = {}) {
  const current = computeManifestHash();
  const stateFile = manifestHashStatePath(root);
  // Prefer the new .bee/cache/ hash; fall back to a legacy root file once so the
  // first post-#11 call doesn't spuriously report "manifest changed".
  const prior = readJson(stateFile, null) || readJson(legacyManifestHashStatePath(root), null);
  const priorHash = prior && typeof prior.hash === 'string' ? prior.hash : null;
  if (!skipWrite) {
    try {
      writeJsonAtomic(stateFile, { hash: current, checked_at: new Date().toISOString() });
      removeFileIfExists(legacyManifestHashStatePath(root));
    } catch {
      // best-effort persistence only; see doc comment above.
    }
  }
  if (priorHash && priorHash !== current) {
    return {
      manifest_changed: true,
      hint: 'Command registry content changed since the last bee.mjs call — re-run "bee --help --json" to refresh the manifest.',
    };
  }
  return { manifest_changed: false, hint: null };
}

// ─── --help / --help --json: D3 tool-schema-shaped manifest ────────────────

function toManifestEntries(entries) {
  return entries.map(({ name, invoke, description, parameters, examples, deprecated }) => ({
    name,
    invoke,
    description,
    parameters,
    examples,
    deprecated,
  }));
}

function publicManifestEntries() {
  return toManifestEntries(COMMAND_REGISTRY);
}

function renderHelpText(entries = publicManifestEntries()) {
  const lines = [`bee — unified CLI dispatcher (schema_version ${SCHEMA_VERSION})`, ''];
  for (const entry of entries) {
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

export async function main(argv) {
  if (argv[0] === '--help') {
    return handleHelp(argv.includes('--json'));
  }

  const { leading, rest } = splitCommandTokens(argv);
  const { commandName, extra } = resolveCommand(leading);
  const jsonRequested = rest.some((t) => t === '--json' || t.startsWith('--json='));

  // Group/command-scoped --help (GH #23): "bee <group> --help" or "bee
  // <group> <verb> --help" renders help filtered to just that group/command,
  // reusing the same publicManifestEntries/renderHelpText shapes as top-level
  // --help. Only fires when commandName resolves to at least one registry
  // entry (itself or a "<commandName>." prefix) — an unrecognized group falls
  // through unchanged to the existing GROUP_USAGE_FALLBACKS / nearest-match
  // error path below, byte-exact (DA5 bijection probe never sends --help).
  if (commandName && rest.includes('--help')) {
    const filtered = COMMAND_REGISTRY.filter(
      (e) => e.name === commandName || e.name.startsWith(`${commandName}.`),
    );
    if (filtered.length > 0) {
      const entries = toManifestEntries(filtered);
      if (jsonRequested) {
        const manifest = { schema_version: SCHEMA_VERSION, commands: entries };
        process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
      } else {
        process.stdout.write(renderHelpText(entries));
      }
      return 0;
    }
  }

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

  // doctor is read-only FOR REAL (codex-native-runtime-v2 D11): bypass the
  // pre-routing cache write entirely rather than merely best-effort for this
  // one route, since "zero writes" is the command's own contract, not a
  // side effect of a hostile sandbox.
  const drift = checkManifestDrift(root, { skipWrite: commandName === 'doctor' });
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
    // reservations.reserve/release/sweep (D2) run their read-check-write body
    // under withStoreLock, which is async — `handler` may return a plain
    // value or a Promise; `await` resolves either uniformly and still routes
    // a rejection (e.g. LockBusyError) into this same catch, unchanged.
    const response = await handler(root, parsed.flags);
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
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`${error instanceof Error ? (error.stack || error.message) : String(error)}\n`);
      process.exitCode = 1;
    },
  );
}
