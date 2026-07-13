// state.mjs — repo root discovery, runtime state, config, gates.

import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from './fsutil.mjs';

export const BEE_VERSION = '0.1.32';

export const GATE_NAMES = ['context', 'shape', 'execution', 'review'];

// The phase enum (02-architecture state model). 'compounding-complete' is the
// one blessed terminal alias written at feature close (07-contracts, hook 6).
// Anything else is agent drift — bee_status flags it (decision 0004).
export const PHASES = [
  'idle',
  'exploring',
  'planning',
  'validating',
  'swarming',
  'reviewing',
  'scribing',
  'compounding',
  'grooming',
];
export const KNOWN_PHASES = [...PHASES, 'compounding-complete'];

export function isKnownPhase(phase) {
  return KNOWN_PHASES.includes(phase);
}

// Host-project standard commands (docs/09 item 1, decision D1): the record is
// the primitive — .bee/config.json `commands`, no init.sh, no second location.
export const COMMAND_KEYS = ['setup', 'start', 'test', 'verify'];

function normalizeCommands(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const commands = {};
  for (const key of COMMAND_KEYS) {
    if (typeof raw[key] === 'string' && raw[key].trim()) commands[key] = raw[key].trim();
  }
  return commands;
}

const DEFAULT_HOOKS = {
  'session-init': true,
  'prompt-context': true,
  'write-guard': true,
  'state-sync': true,
  'chain-nudge': true,
  'session-close': true,
};

// Decision 0012 — model tiers, runtime-keyed. bee is dual-runtime, and each
// runtime names its models differently, so the map is keyed by runtime first,
// then tier. `extraction` = cheapest capable, `generation` = mid, `ceiling` =
// the strongest (kept scarce — the orchestrator's own model). A null value
// means "this runtime cannot select a per-agent model" → the tier is enforced
// via read budgets + output caps in the worker prompt instead (Codex today).
// Cells can be tiered at any of these; `ceiling` is a concept ("keep it on the
// session model"), not a configured value (decision 0015).
export const MODEL_TIERS = ['extraction', 'generation', 'ceiling'];
// Only these two are configured — the CHEAPER tiers you downgrade workers to.
// The ceiling is never configured: it is always the session/orchestrator model,
// so it has no entry and resolves to "inherit the session model".
export const CONFIGURABLE_TIERS = ['extraction', 'generation'];
// Decision 0021 (P16) — `review` is a configurable ROLE beside the tiers: the
// model that reviews what generation implemented (reviewing specialists,
// fresh-eyes, plan-checker). Independent reviewer > self-review; a review slot
// stronger than generation catches what the implementer's own model misses.
// null → falls back to the generation tier.
export const CONFIGURABLE_SLOTS = [...CONFIGURABLE_TIERS, 'review'];
// Decision D2 (advisor feature) — `advisor` is normalized alongside the
// configurable slots but is deliberately NOT one of them: CONFIGURABLE_SLOTS
// stays exactly [extraction, generation, review] so resolveTier's slot gate
// and its review-falls-back-to-generation semantics never apply to it
// (decision 0015 collision avoided — the ceiling tier stays unconfigured and
// `advisor` is not a tier either). Only normalizeModels loops this extended
// list; resolveAdvisor (below, beside resolveTier) is the sole reader.
const MODEL_NORMALIZE_SLOTS = [...CONFIGURABLE_SLOTS, 'advisor'];
// Decision 0021 (P17) — per-slot reasoning effort, applied where the runtime
// has a per-agent effort switch; ignored (recorded only) where it does not.
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];
export const RUNTIMES = ['claude', 'codex'];
const DEFAULT_MODELS = {
  // Claude Code Agent tool accepts short model names: haiku | sonnet | opus | fable.
  // The all-Claude default role split (owner, 2026-07-10): session model
  // orchestrates (ceiling), opus reviews, sonnet implements, haiku extracts —
  // every slot editable per repo to whatever models the user actually has.
  claude: { extraction: 'haiku', generation: 'sonnet', review: 'opus' },
  // Codex has no per-agent model selection today → null tiers = budget/cap fallback.
  // Set real model ids here if your runtime supports switching (e.g. generation: 'gpt-5').
  codex: { extraction: null, generation: null, review: null },
};

// Decisions 0019/0021 (P14/P16/P17) — a configurable slot value is one of:
//   "model-name"                       → the runtime's per-agent model switch
//   null                               → budget/cap fallback (no per-agent
//     switch); for the `review` slot: fall back to the generation tier
//   { model: "...", effort: "..." }    → model + reasoning effort, applied
//     where the runtime has a per-agent effort switch (invalid efforts drop)
//   { kind: "cli", command: "..." }    → an EXTERNAL executor: a separate CLI
//     process (codex exec, a GLM/Kimi CLI, ...) dispatched by the orchestrator
//     under the same bee-executing contract; effort rides inside the command.
// Invalid shapes are ignored (the default for that slot stays).
function normalizeTierValue(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value === null) return null;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.kind === 'cli' && typeof value.command === 'string' && value.command.trim()) {
      return { kind: 'cli', command: value.command.trim() };
    }
    if (value.kind === undefined && typeof value.model === 'string' && value.model.trim()) {
      const out = { model: value.model.trim() };
      if (typeof value.effort === 'string' && EFFORT_LEVELS.includes(value.effort.trim())) {
        out.effort = value.effort.trim();
      }
      return out;
    }
  }
  return undefined;
}

// Decision 8cd4c84e / D2b (P18, evolving loop) — dogfood_repos: the foreign repos
// whose ALREADY-WRITTEN .bee/feedback-digest.json bee's evolving loop consumes.
// Each entry normalizes to { path, label }: a bare string is the path (label
// defaults to its basename), or an explicit { path, label } object. Absent key,
// or any other shape, → [] / skipped — never thrown. Every path is path.resolve()d
// THEN fs.realpath()ed here (critical pattern [20260708]: an MSYS /tmp string must
// never reach a node fs API unresolved), and a path that does not exist or is
// unreadable is WARNED and SKIPPED — one dead dogfood repo must never break the
// bee repo's own session. Mirrors normalizeCommands / normalizeModels: a
// single parse path lives in readConfig, nowhere else.
function normalizeDogfoodRepos(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    let rawPath = null;
    let label = null;
    if (typeof item === 'string') {
      rawPath = item;
    } else if (item && typeof item === 'object' && !Array.isArray(item) && typeof item.path === 'string') {
      rawPath = item.path;
      if (typeof item.label === 'string' && item.label.trim()) label = item.label.trim();
    } else {
      continue; // any other shape is ignored, never thrown
    }
    if (typeof rawPath !== 'string' || !rawPath.trim()) continue;
    const resolved = path.resolve(rawPath.trim());
    let real;
    try {
      real = fs.realpathSync(resolved);
    } catch (err) {
      // A missing or unreadable dogfood repo is warned and skipped, never thrown.
      console.warn(
        `dogfood_repos: skipping "${rawPath}" — ${err && err.code ? err.code : err} (dead or unreadable repo; the bee session continues)`,
      );
      continue;
    }
    out.push({ path: real, label: label || path.basename(resolved) });
  }
  return out;
}

function normalizeModels(raw) {
  const out = {
    claude: { ...DEFAULT_MODELS.claude },
    codex: { ...DEFAULT_MODELS.codex },
  };
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const rt of RUNTIMES) {
      const src = raw[rt];
      if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
      for (const slot of MODEL_NORMALIZE_SLOTS) {
        const value = normalizeTierValue(src[slot]);
        if (value !== undefined) out[rt][slot] = value;
      }
    }
  }
  return out;
}

/**
 * Walk up from startDir looking for `.bee/onboarding.json`; if none found
 * anywhere up the tree, walk up again for the first `.git`; else null.
 * (Onboarding marker wins over .git even when .git is closer to startDir.)
 */
export function findRepoRoot(startDir) {
  const start = path.resolve(startDir || process.cwd());

  let dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, '.bee', 'onboarding.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

export function defaultState() {
  return {
    schema_version: '1.0',
    phase: 'idle',
    feature: null,
    mode: null,
    approved_gates: { context: false, shape: false, execution: false, review: false },
    workers: [],
    summary: '',
    next_action: 'Invoke bee-hive.',
  };
}

export function statePath(root) {
  return path.join(root, '.bee', 'state.json');
}

export function readState(root) {
  const state = readJson(statePath(root), null);
  if (!state || typeof state !== 'object' || Array.isArray(state)) return defaultState();
  const merged = { ...defaultState(), ...state };
  merged.approved_gates = { ...defaultState().approved_gates, ...(state.approved_gates || {}) };
  return merged;
}

// readStateStrict — the CLI-only sibling of readState (review P1-1). readState
// stays fail-open on purpose: hooks (bee-state-sync, bee-write-guard) and
// bee_status read it constantly and must never throw on a corrupt file mid-
// session, so its "present-but-unparseable -> defaultState()" shape is untouched
// here and must stay untouched. readStateStrict is for bee_state.mjs's mutation
// verbs only, which is the one place a fail-open read is actively harmful: every
// verb re-reads-then-writes, so a corrupt file silently read as defaults gets
// written straight back as a fresh skeleton — gates reset, workers emptied,
// feature nulled, exit 0, no trace anything was lost. readStateStrict instead
// distinguishes:
//   - absent state.json           -> defaultState() (same as readState; a
//     first mutation on a fresh repo must still be able to create the file)
//   - present but unparseable, or -> throws, so the caller (bee_state.mjs's
//     present but not a JSON object    main()) prints the message to stderr and
//                                       exits non-zero with the file untouched
export function readStateStrict(root) {
  const file = statePath(root);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return defaultState();
    throw new Error(
      `readStateStrict: could not read "${file}" (${err && err.code ? err.code : err}). ` +
        'The bee CLI refuses to rebuild state from defaults when it cannot read the existing file — that could ' +
        'silently clobber real state (gates, workers, feature). ' +
        `FIX: inspect/restore the file (e.g. "git checkout -- ${path.relative(root, file)}"), then retry.`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `readStateStrict: "${file}" exists but is not valid JSON. ` +
        'The bee CLI refuses to rebuild state from defaults over a present-but-corrupt file — that would silently ' +
        'clobber real state (gates, workers, feature) while reporting success. ' +
        `FIX: inspect/restore the file (e.g. "git checkout -- ${path.relative(root, file)}"), then retry.`,
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `readStateStrict: "${file}" exists but is not a JSON object (found ${Array.isArray(parsed) ? 'an array' : typeof parsed}). ` +
        'The bee CLI refuses to rebuild state from defaults over a present-but-corrupt file — that would silently ' +
        'clobber real state (gates, workers, feature) while reporting success. ' +
        `FIX: inspect/restore the file (e.g. "git checkout -- ${path.relative(root, file)}"), then retry.`,
    );
  }
  const merged = { ...defaultState(), ...parsed };
  merged.approved_gates = { ...defaultState().approved_gates, ...(parsed.approved_gates || {}) };
  return merged;
}

export function writeState(root, state) {
  writeJsonAtomic(statePath(root), state);
  return state;
}

export function gateApproved(state, gateName) {
  return Boolean(state && state.approved_gates && state.approved_gates[gateName] === true);
}

export function readHandoff(root) {
  return readJson(path.join(root, '.bee', 'HANDOFF.json'), null);
}

export function readOnboarding(root) {
  return readJson(path.join(root, '.bee', 'onboarding.json'), null);
}

export function readConfig(root) {
  const raw = readJson(path.join(root, '.bee', 'config.json'), null);
  const config = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  // Advisor mode is removed in full (D1, reverses decisions 0013/0015). A
  // stale `advisor` key left over in a repo's .bee/config.json must be
  // TOLERATED, never thrown on — but it must not flow through this spread
  // into the parsed result (a bare `...config` would let it ride through
  // untouched). Destructure it out here; onboard_bee.mjs/bee_status.mjs warn
  // (never error) when the raw file still carries the key.
  const { advisor: _staleAdvisor, ...rest } = config;
  return {
    ...rest,
    hooks: { ...DEFAULT_HOOKS, ...(config.hooks || {}) },
    lanes: config.lanes || {},
    capabilities: config.capabilities || {},
    commands: normalizeCommands(config.commands),
    models: normalizeModels(config.models),
    dogfood_repos: normalizeDogfoodRepos(config.dogfood_repos),
  };
}

export function hookEnabled(root, name) {
  const config = readConfig(root);
  return config.hooks[name] !== false;
}

// D1 — one shared warning line for both surfacers (bee_status.mjs and
// onboard_bee.mjs) so a stale `advisor` key reads identically wherever it is
// noticed. Warn only, never error: readConfig above already tolerates the key.
// Names the TOP-LEVEL key explicitly (advisor feature, D2 open question) so
// it cannot be misread as covering the new models.<runtime>.advisor slot,
// which is a different, still-valid config path resolved by resolveAdvisor.
export const STALE_ADVISOR_KEY_WARNING =
  'advisor mode was removed in 0.1.23; the top-level advisor key in .bee/config.json is ignored — delete it. (This does not affect the models.<runtime>.advisor slot, which is separate and still valid.)';

export function hasStaleAdvisorKey(root) {
  const raw = readJson(path.join(root, '.bee', 'config.json'), null);
  return Boolean(raw && typeof raw === 'object' && !Array.isArray(raw) && 'advisor' in raw);
}

/**
 * Resolve tier → model name for a runtime (decision 0012). Returns the
 * configured model, or null when the runtime cannot switch models per agent
 * (caller then enforces the tier via read budget + output cap in the prompt).
 * Unknown runtime falls back to 'claude'; unknown tier to 'generation'.
 */
export function modelForTier(root, tier, runtime = 'claude') {
  // The ceiling tier is never configured — it is always the session/orchestrator
  // model (decision 0015). null means "inherit the session model" (omit the
  // subagent model param). Only generation/extraction resolve to a pinned model.
  // A cli-executor tier (decision 0019) has no model NAME — callers that can
  // dispatch externally should use resolveTier(); here it degrades to null.
  const resolved = resolveTier(root, tier, runtime);
  return resolved.type === 'model' ? resolved.model : null;
}

/**
 * Typed slot resolution (decisions 0019/0021). `slot` is a tier
 * (extraction/generation/ceiling) or the `review` role. Returns one of:
 *   { type: 'inherit' }                — ceiling: omit the model param, the
 *     worker inherits the session model (decision 0015)
 *   { type: 'model', model, effort? }  — spawn a subagent with this model
 *     (and per-agent reasoning effort where the runtime supports it)
 *   { type: 'budget' }                 — no per-agent switch: enforce the tier
 *     as a read budget + output cap in the worker prompt
 *   { type: 'cli', command }           — dispatch an EXTERNAL executor process
 *     (protocol: bee-swarming reference, External Executors section)
 * A null `review` slot falls back to the generation tier (decision 0021).
 */
export function resolveTier(root, slot, runtime = 'claude') {
  if (slot === 'ceiling') return { type: 'inherit' };
  const { models } = readConfig(root);
  const rt = RUNTIMES.includes(runtime) ? runtime : 'claude';
  const s = CONFIGURABLE_SLOTS.includes(slot) ? slot : 'generation';
  let value = models[rt] ? models[rt][s] : null;
  if (value == null && s === 'review') {
    value = models[rt] ? models[rt].generation : null; // review falls back to generation
  }
  if (value == null) return { type: 'budget' };
  if (typeof value === 'string') return { type: 'model', model: value };
  if (value.kind === 'cli') return { type: 'cli', command: value.command };
  if (typeof value.model === 'string') {
    return value.effort
      ? { type: 'model', model: value.model, effort: value.effort }
      : { type: 'model', model: value.model };
  }
  return { type: 'budget' };
}

/**
 * Resolve the advisor slot (decision D2, advisor feature) for a runtime:
 * `models.<runtime>.advisor`, the `review`-slot shape reused for a new
 * purpose. Unlike resolveTier, this NEVER returns a budget type and NEVER
 * falls back to another tier — null unambiguously means "no advisor" (unset,
 * invalid, or a cli shape missing its command), which is exactly what a
 * degenerate-consult check (D2/D3) needs to skip straight to `[BLOCKED]`.
 * Deliberately NOT routed through resolveTier: `advisor` is not in
 * CONFIGURABLE_SLOTS (decision 0015 collision avoided), so resolveTier would
 * silently coerce an unrecognized slot to 'generation' — the one behavior
 * this function must never exhibit.
 */
export function resolveAdvisor(root, runtime = 'claude') {
  const { models } = readConfig(root);
  const rt = RUNTIMES.includes(runtime) ? runtime : 'claude';
  const value = models[rt] ? models[rt].advisor : undefined;
  if (value == null) return null; // unset, absent runtime, or explicit null -> no advisor
  if (typeof value === 'string') return { type: 'model', model: value };
  if (value.kind === 'cli') return { type: 'cli', command: value.command };
  if (typeof value.model === 'string') {
    return value.effort
      ? { type: 'model', model: value.model, effort: value.effort }
      : { type: 'model', model: value.model };
  }
  return null;
}

// ─── startFeature: guarded atomic feature start (decision D2, plan.md test ──
// matrix row 5 / codex-runtime-parity). ONE atomic operation for beginning a
// new feature so a new feature can never inherit approvals or silently step
// over abandoned work (plan-review.md P1: "feature start could clear evidence
// of active work"). Fails closed — every precondition is read BEFORE any
// write, so a refusal makes ZERO mutations — unless ALL of the following hold:
//   - the CURRENT phase is 'idle' or the terminal alias 'compounding-complete'
//     (a mid-flight prior feature must finish or be explicitly wound down —
//     never silently stepped over by starting a new one)
//   - no .bee/HANDOFF.json exists (a paused session must resume/close first)
//   - state.workers is empty (registered workers must be cleared through the
//     existing worker remove/clear verbs first)
//   - no active (unreleased, unexpired) reservation exists
//   - no cell anywhere has status 'claimed' (live worker state; only cap/drop
//     end a claim)
//   - no cell belonging to the PRIOR feature (state.feature) is in a
//     nonterminal status (open/claimed/blocked) — capped and dropped are the
//     only terminal statuses. An abandoned cell must first be resolved through
//     the EXISTING drop verb (bee_cells.mjs drop --id ID --reason R) —
//     startFeature never auto-clears workers/cells/reservations as cleanup
//     (P1 repair, plan-review.md).
// On success, exactly one atomic write sets feature/mode/phase, resets ALL
// FOUR gates to false, and refreshes summary/next_action.
//
// Self-contained by design: cells.mjs already imports readState/gateApproved/
// MODEL_TIERS from this module, so this function reads .bee/cells/*.json and
// .bee/reservations.json directly (small local helpers below) rather than
// importing lib/cells.mjs or lib/reservations.mjs, avoiding a state.mjs <->
// cells.mjs import cycle.

function listAllCellsForStart(root) {
  const dir = path.join(root, '.bee', 'cells');
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const cells = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const cell = readJson(path.join(dir, entry), null);
    if (!cell || typeof cell !== 'object' || Array.isArray(cell)) continue;
    cells.push(cell);
  }
  return cells;
}

function listActiveReservationsForStart(root) {
  const store = readJson(path.join(root, '.bee', 'reservations.json'), null);
  const reservations = store && Array.isArray(store.reservations) ? store.reservations : [];
  const nowMs = Date.now();
  return reservations.filter((reservation) => {
    if (!reservation || reservation.released_at != null) return false;
    const ttl = reservation.ttl_seconds;
    if (Number.isFinite(ttl) && ttl > 0) {
      const reservedMs = Date.parse(reservation.reserved_at);
      if (Number.isFinite(reservedMs) && reservedMs + ttl * 1000 <= nowMs) return false; // expired, not active
    }
    return true;
  });
}

export function startFeature(root, { feature, mode = null, phase = 'exploring' } = {}) {
  if (typeof feature !== 'string' || !feature.trim()) {
    throw new Error('startFeature: a non-empty --feature slug is required.');
  }
  const phaseValue = String(phase);
  if (!isKnownPhase(phaseValue)) {
    throw new Error(
      `startFeature: invalid phase "${phaseValue}" — not in the known-phase enum (isKnownPhase). FIX: use one of ${KNOWN_PHASES.join(', ')}.`,
    );
  }

  // Re-read immediately before any check (C1) — every read below happens
  // before the single write at the end, so a refusal leaves zero mutations.
  const state = readStateStrict(root);

  if (state.phase !== 'idle' && state.phase !== 'compounding-complete') {
    throw new Error(
      `startFeature: refused — current phase is "${state.phase}", not idle or the terminal alias "compounding-complete". A prior feature must finish or be explicitly wound down before a new feature starts. FIX: resume/close the current feature through its normal chain, or drop its remaining cells (bee_cells.mjs drop), then retry.`,
    );
  }

  const handoffPath = path.join(root, '.bee', 'HANDOFF.json');
  if (fs.existsSync(handoffPath)) {
    throw new Error(
      'startFeature: refused — .bee/HANDOFF.json exists. A paused session must resume and clear the handoff before a new feature starts. FIX: resume the session (or explicitly delete HANDOFF.json once its work is truly abandoned), then retry.',
    );
  }

  const workers = Array.isArray(state.workers) ? state.workers : [];
  if (workers.length > 0) {
    const names = workers.map((w) => (w && w.nickname) || '?').join(', ');
    throw new Error(
      `startFeature: refused — ${workers.length} registered worker(s) remain (${names}). FIX: clear them first (bee_state.mjs worker remove --nickname N, or worker clear).`,
    );
  }

  const activeReservations = listActiveReservationsForStart(root);
  if (activeReservations.length > 0) {
    throw new Error(
      `startFeature: refused — ${activeReservations.length} active reservation(s) remain (${activeReservations
        .map((r) => `${r.agent}:${r.path}`)
        .join(', ')}). FIX: release them first (bee_reservations.mjs release).`,
    );
  }

  const cells = listAllCellsForStart(root);
  const claimed = cells.filter((cell) => cell.status === 'claimed');
  if (claimed.length > 0) {
    throw new Error(
      `startFeature: refused — claimed cell(s) remain: ${claimed.map((c) => c.id).join(', ')}. FIX: cap or drop them first (bee_cells.mjs cap / bee_cells.mjs drop).`,
    );
  }

  const priorFeature = state.feature;
  if (priorFeature) {
    const nonterminal = cells.filter(
      (cell) =>
        cell.feature === priorFeature &&
        (cell.status === 'open' || cell.status === 'claimed' || cell.status === 'blocked'),
    );
    if (nonterminal.length > 0) {
      throw new Error(
        `startFeature: refused — prior feature "${priorFeature}" has nonterminal cell(s): ${nonterminal
          .map((c) => `${c.id}(${c.status})`)
          .join(', ')}. An abandoned cell must first be resolved through the existing drop verb (bee_cells.mjs drop --id ID --reason R) — startFeature never auto-clears cells as cleanup. FIX: cap or drop each listed cell, then retry.`,
      );
    }
  }

  // All preconditions hold — ONE atomic write: feature/mode/phase, reset all
  // four gates, refreshed summary/next_action. A new feature never inherits
  // approvals from whatever came before it.
  state.feature = feature.trim();
  state.mode = mode == null ? null : String(mode);
  state.phase = phaseValue;
  state.approved_gates = { context: false, shape: false, execution: false, review: false };
  state.summary = `Feature "${state.feature}" started at phase "${phaseValue}".`;
  state.next_action = `Invoke bee-hive for "${state.feature}" (phase: ${phaseValue}).`;
  writeState(root, state);
  return state;
}
