// dispatch-guard.mjs — the pure decision core for bee's dispatch-transport
// enforcement (g22-1, GH #22 P0-3 PRECONDITION REFACTOR / advisor R1).
//
// Extracted verbatim (byte-for-byte decision logic, zero behavior change)
// from hooks/bee-model-guard.mjs so it can be shared by two callers that both
// need the SAME allow/deny judgment without duplicating it:
//   - hooks/bee-model-guard.mjs (PreToolUse enforcement): dynamically imports
//     this module the same way it dynamically imports state.mjs — from the
//     ROOT's own .bee/bin/lib/, never a hooks-side vendored copy — and turns
//     evaluateDispatch()'s decision into the deny exit code / stderr / audit
//     log lines it always has.
//   - lib/dispatch-prepare.mjs (`bee dispatch prepare`): builds a payload,
//     then re-runs it through evaluateDispatch() itself as a self-check
//     before handing the payload back (the ALLOW/DENY the hook would render
//     is computed once and trusted by both sides — one source of truth,
//     never two copies of the same judgment call).
//
// This module does ZERO I/O — no fs writes, no stderr, no logging. Every
// decision is a pure function of (toolName, toolInput, root); `root` is only
// used to call resolveTier()/modelForTier(), which read .bee/config.json
// (a read, not a mutation). Callers own all side effects.

import { resolveTier, modelForTier, CONFIGURABLE_SLOTS } from './state.mjs';

// Codex-native collaboration spawn (codex-native-runtime-v2 D4): Codex exposes
// agent spawns through PreToolUse as tool_name "spawn_agent", with tool_input
// {agent_type: "worker", message: "..."}. This is an ISOLATED branch, never
// mixed with the Claude Agent/Task rules below.
export const CODEX_SPAWN_TOOL = 'spawn_agent';
export const CODEX_SPAWN_WORKER_TYPE = 'worker';

export const DISPATCH_TOOLS = new Set(['Agent', 'Task']);

// Anchored to the start of the string (leading whitespace allowed): the
// marker must be the first thing in prompt/description/message, never merely
// present somewhere inside it (P1-1 — no 500-char scan window, no mid-text
// match).
export const ANCHORED_TIER_MARKER_RE = /^\s*\[bee-tier:\s*(ceiling|generation|extraction|review)\]/i;

// W3 pinned-type rule (plan.md Slice 3B item 3, AO5/AO10/AO11): the three
// model-backed tiers each get a rendered bee agent definition
// (.claude/agents/bee-*.md) — "ceiling" deliberately has none, it IS the
// session model.
export const PINNED_AGENT_TYPE = {
  generation: 'bee-gather',
  extraction: 'bee-extract',
  review: 'bee-review',
};

function startsWithTierMarker(text) {
  if (typeof text !== 'string') {
    return null;
  }
  const match = ANCHORED_TIER_MARKER_RE.exec(text);
  return match ? match[1].toLowerCase() : null;
}

function markerTier(toolInput) {
  return (
    startsWithTierMarker(toolInput.description) || startsWithTierMarker(toolInput.prompt) || null
  );
}

// The set of model NAMES resolvable from the claude runtime's configured tier
// slots (extraction/generation/review). cli-shaped and null slots resolve to
// no model name and contribute nothing. This is the membership authority for
// a bare `model` param (B5) — config is the sole source, never a hardcoded
// allowlist. An empty set means the repo configures no model tier: the
// caller fail-opens (allow) exactly as before this slice.
function configuredModelSet(root) {
  const models = new Set();
  for (const slot of CONFIGURABLE_SLOTS) {
    const m = modelForTier(root, slot, 'claude');
    if (typeof m === 'string' && m.trim()) {
      models.add(m.trim());
    }
  }
  return models;
}

// A neutral "no opinion" result: transport === null tells every caller never
// to log anything — this shape is not a dispatch to evaluate at all (wrong
// tool, unobserved envelope, absent/malformed tool_input).
function noOpinion() {
  return { decision: 'allow', transport: null, reason: null, tier: null, model: null, subagentType: null };
}

function allowResult(transport, { tier = null, model = null, subagentType = null } = {}) {
  return { decision: 'allow', transport, reason: null, tier, model, subagentType };
}

function denyResult(reason, transport, { tier = null, model = null, subagentType = null } = {}) {
  return { decision: 'deny', transport, reason, tier, model, subagentType };
}

// Codex-native spawn guard (codex-native-runtime-v2 D4, decision 0023 parity).
// Triggered ONLY by the exact envelope the codex-cli 0.144.4 spike observed
// (capability-matrix row D1): tool_input {agent_type: "worker", message}. The
// authoritative task field is MESSAGE, not prompt, and the [bee-tier: <tier>]
// marker must anchor to the START of message (leading whitespace allowed).
// Every UNOBSERVED shape is a no-opinion (allow, unlogged), never a deny —
// the spike only ever captured agent_type "worker"; denying a shape it never
// saw would guess at semantics the evidence does not support.
function evaluateCodexSpawn(toolInput) {
  if (!toolInput || typeof toolInput !== 'object' || Array.isArray(toolInput)) {
    return noOpinion();
  }
  if (toolInput.agent_type !== CODEX_SPAWN_WORKER_TYPE) {
    return noOpinion();
  }
  const message = toolInput.message;
  if (typeof message !== 'string' || message === '') {
    return noOpinion();
  }
  const tier = startsWithTierMarker(message);
  if (tier) {
    return allowResult('codex-spawn-marker', { tier });
  }
  const reason =
    `bee-model-guard: Codex spawn_agent(agent_type: "worker") needs an explicit ` +
    "tier — its message must OPEN with a [bee-tier: <tier>] marker (decision 0023 " +
    "parity, codex-native-runtime-v2 D4). A marker anywhere but the start of the " +
    "message does not count, and a marker in any other field is ignored; without " +
    "one the spawned worker silently inherits the session model.\n" +
    "FIX: begin the spawn message with the marker, e.g. " +
    '"[bee-tier: generation] <task>" (tiers: ceiling/generation/extraction/review).';
  return denyResult(reason, 'codex-spawn-unmarked');
}

// The Claude Agent/Task dispatch rules (decision 0023, hardened per P1-1,
// AO5, W3/AO10/AO11) — every branch of the original bee-model-guard.mjs main(),
// unchanged.
function evaluateClaudeDispatch(rawToolInput, root) {
  if (!rawToolInput || typeof rawToolInput !== 'object' || Array.isArray(rawToolInput)) {
    return noOpinion();
  }
  const toolInput = rawToolInput;

  const modelParam =
    typeof toolInput.model === 'string' && toolInput.model.trim() ? toolInput.model.trim() : null;
  const tier = markerTier(toolInput);
  const subagentType = typeof toolInput.subagent_type === 'string' ? toolInput.subagent_type : null;

  // (0) Pinned-type rule (W3, AO5/AO10/AO11) — fires BEFORE every allow
  // branch below.
  if (tier && tier !== 'ceiling' && subagentType === 'general-purpose') {
    const pinnedType = PINNED_AGENT_TYPE[tier];
    const reason =
      `bee-model-guard: [bee-tier: ${tier}] must spawn its pinned agent type, not ` +
      'subagent_type: "general-purpose" — general-purpose carries no tier identity and ' +
      "would run under whatever runtime default is in effect, not the rendered bee agent " +
      "for this tier (AO5/AO10).\n" +
      `FIX: set subagent_type: "${pinnedType}" (bee's rendered agent for the ${tier} tier), ` +
      'or use "Explore" for a read-only gather that does not need the rendered agent.';
    return denyResult(reason, 'generic-type-denied', { tier, model: modelParam, subagentType });
  }

  // (1) Marker + model param — AO5 strict equality.
  if (tier && modelParam) {
    const resolved = resolveTier(root, tier, 'claude');
    if (resolved.type === 'model') {
      if (modelParam === resolved.model) {
        return allowResult('model-param', { tier, model: modelParam, subagentType });
      }
      const reason =
        `bee-model-guard: [bee-tier: ${tier}] resolves to model "${resolved.model}", but ` +
        `the dispatch carries model: "${modelParam}" — the tier label and the param ` +
        "disagree, so the dispatch would run on the param while the audit records the " +
        "tier (AO5: config is the authority, the model does not get a vote).\n" +
        `FIX: set model: "${resolved.model}" to match the ${tier} tier, or drop the ` +
        "marker and declare the tier whose configured model is the one you want.";
      return denyResult(reason, 'param-tier-mismatch', { tier, model: modelParam, subagentType });
    }
    // inherit (ceiling) / budget / refused (cli): the tier carries NO model
    // name, so a param bolted onto it can only lie in the audit trail.
    const reason =
      `bee-model-guard: [bee-tier: ${tier}] resolves to no model name` +
      (resolved.type === 'refused' ? ' (the slot is a cli executor)' : '') +
      `, but the dispatch carries model: "${modelParam}". The marker would record one ` +
      "thing in dispatch.jsonl while the subagent actually runs on the param.\n" +
      "FIX: drop the model param (the marker alone selects the tier), or drop the marker " +
      "and declare the tier whose configured model equals the param you intended.";
    return denyResult(reason, 'param-on-nameless-tier', { tier, model: modelParam, subagentType });
  }

  // (2) Model param, no marker — B5 membership against configured tier slots.
  if (modelParam) {
    const memberSet = configuredModelSet(root);
    if (memberSet.size === 0 || memberSet.has(modelParam)) {
      // Empty set = unconfigured repo -> fail-open allow (today's behavior).
      return allowResult('model-param', { tier: null, model: modelParam, subagentType });
    }
    const configured = [...memberSet].sort().join(', ');
    const reason =
      `bee-model-guard: model: "${modelParam}" is not a model configured for any claude ` +
      "tier — a param outside config selects an unaudited model and, for an up-dispatch, " +
      "hides ceiling scarcity (AO5/B5: config is the sole authority; there is no hardcoded " +
      "allowlist).\n" +
      `FIX: use one of the configured models (${configured}); or, for a session-model ` +
      "dispatch, add [bee-tier: ceiling] (ceiling = the session model) to the " +
      "prompt/description; or add this model to a configured tier slot in .bee/config.json.";
    return denyResult(reason, 'param-not-configured', { tier: null, model: modelParam, subagentType });
  }

  // (3) Marker, no param — B4(1)/W10.
  if (tier) {
    const resolved = resolveTier(root, tier, 'claude');
    if (resolved.type === 'refused') {
      // A cli-shaped slot: an in-family Agent/Task subagent cannot BE the
      // external CLI (it runs as its own process, not a spawned subagent).
      const reason =
        `bee-model-guard: [bee-tier: ${tier}] resolves to a cli executor, which an ` +
        "in-family Agent/Task subagent cannot be — a cli tier runs as an external process, " +
        "not a spawned subagent.\n" +
        "FIX: dispatch it through the external-executor gather path — a Bash call running " +
        "the configured command verbatim with the prompt on stdin (resolveTier(root, slot, " +
        "runtime, {for:'gather'}) returns {type:'cli', command}). Do not attach a model " +
        "param; the cli command names its own model.";
      return denyResult(reason, 'cli-tier-denied', { tier, model: null, subagentType });
    }
    // model / budget / inherit -> allow (today's behavior, resolution-backed).
    return allowResult('marker', { tier, model: null, subagentType });
  }

  // (4) Bare — deny (today's behavior), but resolve the generation slot for
  // the FIX so we never tell the agent to pass a model that does not exist.
  const genResolved = resolveTier(root, 'generation', 'claude');
  const bareFix =
    genResolved.type === 'model'
      ? `FIX: pass model: "${genResolved.model}" for the generation tier, or add ` +
        '[bee-tier: ceiling] (or another tier: generation/extraction/review) to the prompt/description.'
      : 'FIX: add [bee-tier: ceiling] (or another tier: generation/extraction/review) to the ' +
        'prompt/description; the generation tier is a cli executor or unconfigured, so run it ' +
        'through the external-executor gather path (a Bash call with the command verbatim and ' +
        'the prompt on stdin) rather than a model param.';
  const reason =
    'bee-model-guard: every Agent/Task dispatch needs an explicit tier — a `model` ' +
    'param or a `[bee-tier: <tier>]` marker in the prompt/description (decision 0023). ' +
    'A bare dispatch would silently inherit the most expensive session model.\n' +
    bareFix;
  return denyResult(reason, 'bare-denied', { tier: null, model: null, subagentType });
}

/**
 * evaluateDispatch(toolName, toolInput, root) — the single decision function
 * both the guard hook and `bee dispatch prepare` call. `toolInput` is exactly
 * what the hook would see as `payload.tool_input` (for Codex: the object
 * carrying `agent_type`/`message` directly, not a further-wrapped envelope).
 *
 * Returns { decision: 'allow'|'deny', transport, reason, tier, model,
 * subagentType }. `transport === null` means "no opinion" — the caller must
 * never log a dispatch line for it (wrong tool, or a malformed/absent
 * tool_input that never reached a real branch). Every other transport value
 * — allow or deny — is a real evaluated dispatch and the caller logs it.
 */
export function evaluateDispatch(toolName, toolInput, root) {
  if (toolName === CODEX_SPAWN_TOOL) {
    return evaluateCodexSpawn(toolInput);
  }
  if (DISPATCH_TOOLS.has(toolName)) {
    return evaluateClaudeDispatch(toolInput, root);
  }
  return noOpinion();
}
