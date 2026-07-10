// state.mjs — repo root discovery, runtime state, config, gates.

import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from './fsutil.mjs';

export const BEE_VERSION = '0.1.18';

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

// Decision 0013 — advisor mode. Run the session on the generation tier and
// consult the ceiling model only at the listed hard calls (the "advisor" cost
// pattern). Off by default. `at` is a subset of ADVISOR_POINTS.
export const ADVISOR_POINTS = ['context', 'shape', 'execution', 'review', 'blocked'];
// `model` is the STRONGER-than-session model the cheap session phones at a
// consult point — it must be named because in advisor mode the session runs on
// the cheap tier, so the expert is not the session/ceiling model (decision 0015).
const DEFAULT_ADVISOR = { enabled: false, at: ['shape', 'execution', 'blocked'], model: 'fable' };

function normalizeAdvisor(raw) {
  const out = { enabled: false, at: [...DEFAULT_ADVISOR.at], model: DEFAULT_ADVISOR.model };
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    out.enabled = raw.enabled === true;
    if (Array.isArray(raw.at)) {
      const at = raw.at.filter((p) => ADVISOR_POINTS.includes(p));
      if (at.length) out.at = at;
    }
    if (typeof raw.model === 'string' && raw.model.trim()) out.model = raw.model.trim();
    else if (raw.model === null) out.model = null;
  }
  return out;
}

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
// bee repo's own session. Mirrors normalizeCommands / normalizeModels /
// normalizeAdvisor: a single parse path lives in readConfig, nowhere else.
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
      for (const slot of CONFIGURABLE_SLOTS) {
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
  return {
    ...config,
    hooks: { ...DEFAULT_HOOKS, ...(config.hooks || {}) },
    lanes: config.lanes || {},
    capabilities: config.capabilities || {},
    commands: normalizeCommands(config.commands),
    models: normalizeModels(config.models),
    advisor: normalizeAdvisor(config.advisor),
    dogfood_repos: normalizeDogfoodRepos(config.dogfood_repos),
  };
}

export function hookEnabled(root, name) {
  const config = readConfig(root);
  return config.hooks[name] !== false;
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
 * Advisor mode resolution (decision 0013). Returns the ceiling model to consult
 * when advisor mode is on and `point` is a configured consult point, else null.
 * The session itself runs on the generation tier; this is the phone-a-friend.
 */
export function advisorModel(root, point) {
  // In advisor mode the session runs on the cheap tier, so the expert it phones
  // is a STRONGER, explicitly-named model (advisor.model) — not the session
  // model, and not the ceiling (which would be the cheap session) (decision 0015).
  const { advisor } = readConfig(root);
  if (!advisor.enabled) return null;
  if (point && !advisor.at.includes(point)) return null;
  return advisor.model || null;
}
