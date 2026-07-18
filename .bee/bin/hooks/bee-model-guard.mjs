#!/usr/bin/env node
// bee-model-guard: PreToolUse (Agent|Task) — Claude projection only
// (hooks/catalog.mjs ALLOWED_DIFFERENCES: Codex does not expose collaboration
// spawn through PreToolUse).
// Enforces explicit-tier transport on subagent dispatch (decision 0023, plan
// docs/history/model-tier-guard/plan.md D1/D2, advisor-and-orchestration
// 2A-iii B4/B5/AO5): every Agent/Task dispatch must carry either a valid
// tool_input.model or a case-insensitive [bee-tier: <tier>] marker ANCHORED to
// a reserved position: the first non-whitespace token of tool_input.prompt, or
// the start of tool_input.description (leading whitespace allowed either way).
// A marker occurring anywhere else (embedded after other prompt text,
// mid-description) never satisfies the transport — that would let quoted plan
// text, user content, or retrieved docs forge the tier with no real decision
// made (review-findings.md P1-1).
//
// The declared tier is read BEFORE the model param is judged (2A-iii closes the
// old short-circuit that accepted ANY non-empty model string and logged it as a
// legitimate transport): (1) marker + param must AGREE — the param strictly
// equals the model the marker's tier resolves to, and a tier with no model name
// (ceiling/budget/cli) must carry no param; (2) a bare param with no marker must
// be a MEMBER of the models configured across the claude tier slots (config is
// the sole authority — no hardcoded allowlist; an unconfigured repo fail-opens);
// (3) a marker whose tier is cli-shaped is denied and routed to the external
// executor (an in-family subagent cannot BE the external CLI); (4) a bare
// dispatch (no param, no anchored marker) silently inherits the most expensive
// session model, so it is denied.
// (0, W3/AO5/AO10) BEFORE any of the above: a marker naming generation/
// extraction/review paired with subagent_type "general-purpose" is denied
// outright — those three tiers each have a rendered bee agent type
// (bee-gather/bee-extract/bee-review) and general-purpose carries no pinned
// identity; "ceiling" has no rendered agent and stays exempt.
// Deny = exit 2 with the reason (rule + FIX line) on stderr, and a
// {hook:'model-guard',event:'deny',...} line appended to .bee/logs/hooks.jsonl.
// Input/root/crash-logging go through the shared runtime adapter
// (hooks/adapter.mjs, cell codex-parity-3): stdin is normalized before any
// property access and root discovery lives inside the fail-open boundary.
// Everything else is fail-open: exit 0 (crashes logged to .bee/logs/hooks.jsonl).
// Deny only — this hook never auto-injects or rewrites the model param.

import fs from "node:fs";
import path from "node:path";
import { readHookContext, logCrash, libModuleUrl, appendHookLog } from "./adapter.mjs";

const HOOK_NAME = "model-guard";
const DISPATCH_TOOLS = new Set(["Agent", "Task"]);
// Codex-native collaboration spawn (codex-native-runtime-v2 D4): Codex exposes
// agent spawns through PreToolUse as tool_name "spawn_agent" (spike codex-cli
// 0.144.4, capability-matrix row D1), with tool_input.agent_type "worker" and
// the task text in tool_input.message. This is an ISOLATED branch, never a
// member of DISPATCH_TOOLS — the Claude enforcement below reads model/tier/
// subagent_type and emits Claude-specific model-param remediation, which would
// misread a real Codex spawn message as a bare Claude dispatch.
const CODEX_SPAWN_TOOL = "spawn_agent";
const CODEX_SPAWN_WORKER_TYPE = "worker";
// Anchored to the start of the string (leading whitespace allowed): the
// marker must be the first thing in prompt/description, never merely present
// somewhere inside it (P1-1 — no 500-char scan window, no mid-text match).
const ANCHORED_TIER_MARKER_RE = /^\s*\[bee-tier:\s*(ceiling|generation|extraction|review)\]/i;

// W3 pinned-type rule (plan.md Slice 3B item 3, AO5/AO10/AO11): the three
// model-backed tiers each get a rendered bee agent definition
// (.claude/agents/bee-*.md, cell ao-3b-1) — "ceiling" deliberately has none,
// it IS the session model. A dispatch that declares one of these tiers but
// spawns "general-purpose" carries no pinned identity and would silently run
// under whatever runtime default is in effect; the FIX below names the type
// that DOES exist for that tier.
const PINNED_AGENT_TYPE = {
  generation: "bee-gather",
  extraction: "bee-extract",
  review: "bee-review",
};

function logDeny(root, toolName, toolInput) {
  // appendHookLog is itself fail-open: a log failure never blocks the deny.
  appendHookLog(root, {
    ts: new Date().toISOString(),
    hook: HOOK_NAME,
    event: "deny",
    tool_name: toolName,
    tool_input_keys: Object.keys(toolInput),
  });
}

function startsWithTierMarker(text) {
  if (typeof text !== "string") {
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

// Codex-native spawn guard (codex-native-runtime-v2 D4, decision 0023 parity).
// Triggered ONLY by the exact envelope the codex-cli 0.144.4 spike observed
// (capability-matrix row D1): tool_name "spawn_agent", tool_input
// {agent_type: "worker", message: "..."}. The authoritative task field is
// MESSAGE, not prompt, and the [bee-tier: <tier>] marker must anchor to the
// START of message (leading whitespace allowed). Recognition boundary, in
// order — every UNOBSERVED shape FAILS OPEN (allow), never denies, because the
// spike only ever captured agent_type "worker"; denying a shape it never saw
// would guess at semantics the evidence does not support:
//   - tool_input missing / null / non-object / array          -> fail open
//   - agent_type missing / non-string / not "worker"
//     (includes the other built-ins "default" / "explorer")   -> fail open
//   - message missing / non-string / empty string             -> fail open
//   - message opens with an ANCHORED [bee-tier:] marker         -> allow
//   - message present, marker mid-text or absent               -> DENY (exit 2)
// Only `message` is read: an anchored marker in `prompt` (or any other field)
// never rescues an unmarked `message`. Extra fields are tolerated once the
// required fields match.
function codexSpawnGuard(root, payload) {
  const toolName = CODEX_SPAWN_TOOL;
  const toolInput = payload.tool_input;
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    return 0;
  }
  if (toolInput.agent_type !== CODEX_SPAWN_WORKER_TYPE) {
    return 0;
  }
  const message = toolInput.message;
  if (typeof message !== "string" || message === "") {
    return 0;
  }
  const tier = startsWithTierMarker(message);
  if (tier) {
    logDispatch(root, toolName, toolInput, "codex-spawn-marker", null, tier);
    return 0;
  }
  const reason =
    `bee-model-guard: Codex spawn_agent(agent_type: "worker") needs an explicit ` +
    "tier — its message must OPEN with a [bee-tier: <tier>] marker (decision 0023 " +
    "parity, codex-native-runtime-v2 D4). A marker anywhere but the start of the " +
    "message does not count, and a marker in any other field is ignored; without " +
    "one the spawned worker silently inherits the session model.\n" +
    "FIX: begin the spawn message with the marker, e.g. " +
    '"[bee-tier: generation] <task>" (tiers: ceiling/generation/extraction/review).';
  return denyWith(root, toolName, toolInput, reason, "codex-spawn-unmarked", null, null);
}

// Dispatch audit log (P22, feature dispatch-log): one line per evaluated
// Agent/Task dispatch — allowed or denied — so the resolved model/tier is
// auditable independent of what the UI shows. Fail-open like logDeny: a log
// failure never changes the guard's decision or exit code.
function logDispatch(root, toolName, toolInput, transport, model, tier) {
  try {
    const logsDir = path.join(root, ".bee", "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const description =
      typeof toolInput.description === "string" ? toolInput.description.slice(0, 120) : "";
    fs.appendFileSync(
      path.join(logsDir, "dispatch.jsonl"),
      `${JSON.stringify({
        ts: new Date().toISOString(),
        tool: toolName,
        transport,
        model: model || null,
        tier: tier || null,
        subagent_type: typeof toolInput.subagent_type === "string" ? toolInput.subagent_type : null,
        description,
      })}\n`,
    );
  } catch {
    // fail-open — auditing never blocks a dispatch
  }
}

// The set of model NAMES resolvable from the claude runtime's configured tier
// slots (extraction/generation/review). cli-shaped and null slots resolve to
// no model name and contribute nothing. This is the membership authority for a
// bare `model` param (B5) — config is the sole source, never a hardcoded
// allowlist. An empty set means the repo configures no model tier: the guard
// fail-opens (allow) exactly as before this slice.
function configuredModelSet(stateLib, root) {
  const models = new Set();
  for (const slot of stateLib.CONFIGURABLE_SLOTS) {
    const m = stateLib.modelForTier(root, slot, "claude");
    if (typeof m === "string" && m.trim()) {
      models.add(m.trim());
    }
  }
  return models;
}

// A single deny exit: record the rejected dispatch in the audit log (with the
// transport label that names WHY it was rejected), append the deny event, and
// write the reason to stderr for Claude Code to feed back on PreToolUse exit 2.
// Both log calls are fail-open — a log failure never changes the exit code.
function denyWith(root, toolName, toolInput, reason, transport, model, tier) {
  logDispatch(root, toolName, toolInput, transport, model || null, tier || null);
  logDeny(root, toolName, toolInput);
  process.stderr.write(reason);
  return 2;
}

async function main() {
  // FAIL-OPEN PRECISION (P1-2, now owned by hooks/adapter.mjs): the adapter
  // normalizes the payload before ANY property access — a top-level null or
  // array payload, or a non-string cwd, can never reach a `.` access or
  // path.resolve — and resolves the repo root inside its own fail-open
  // boundary.
  const ctx = await readHookContext(HOOK_NAME);
  const payload = ctx.payload;
  const root = ctx.root;
  if (!root) {
    return 0;
  }

  try {
    if (!fs.existsSync(path.join(root, ".bee", "bin", "lib", "state.mjs"))) {
      return 0;
    }

    const toolName = payload.tool_name || payload.toolName || "";
    // Codex spawn recognition keys on the AUTHORITATIVE field payload.tool_name
    // ONLY — a top-level `toolName` alias is not the observed Codex envelope and
    // fails open. The Claude dispatch set (Agent|Task) is evaluated exactly as
    // before; this line adds the Codex tool without changing that behavior.
    const isCodexSpawn = payload.tool_name === CODEX_SPAWN_TOOL;
    if (!isCodexSpawn && !DISPATCH_TOOLS.has(toolName)) {
      return 0;
    }

    const stateLib = await import(libModuleUrl(root, "state.mjs"));
    if (!stateLib.hookEnabled(root, HOOK_NAME)) {
      return 0;
    }

    // Isolated Codex branch (codex-native-runtime-v2 D4): returns its own
    // decision and NEVER falls through into the Claude enforcement below. The
    // guard toggle above gates it exactly like the Claude path.
    if (isCodexSpawn) {
      return codexSpawnGuard(root, payload);
    }

    // An absent or non-object tool_input can never reach the deny branch —
    // silent exit 0, no stderr.
    const rawToolInput = payload.tool_input;
    if (!rawToolInput || typeof rawToolInput !== "object" || Array.isArray(rawToolInput)) {
      return 0;
    }
    const toolInput = rawToolInput;

    // Decision order (plan 2A-iii, B4/B5, AO5): read the DECLARED tier FIRST,
    // then judge the model param against it — the old model-param short-circuit
    // (accept any non-empty string) let `model:"banana"` write a lie into
    // dispatch.jsonl. resolveTier is called 3-arg: the guard guards subagent
    // EXECUTION (the cell-default side), so a cli-shaped slot resolves to
    // {type:'refused'} here, never {type:'cli'} — the cli path stays reachable
    // only through the external-executor gather ({for:'gather'}).
    const modelParam =
      typeof toolInput.model === "string" && toolInput.model.trim()
        ? toolInput.model.trim()
        : null;
    const tier = markerTier(toolInput);
    const subagentType =
      typeof toolInput.subagent_type === "string" ? toolInput.subagent_type : null;

    // (0) Pinned-type rule (W3, AO5/AO10/AO11) — fires BEFORE every allow
    // branch below: placed after them it would be dead code, since branch (1)
    // already allows a matching marker+param and branch (3) already allows a
    // bare marker on these exact tiers (planning panel WARNING). "ceiling" is
    // deliberately excluded — it has no rendered agent, so general-purpose is
    // its only option. Fires regardless of any model param, matching or not:
    // a general-purpose subagent carries no pinned identity no matter what
    // model backs it.
    if (tier && tier !== "ceiling" && subagentType === "general-purpose") {
      const pinnedType = PINNED_AGENT_TYPE[tier];
      const reason =
        `bee-model-guard: [bee-tier: ${tier}] must spawn its pinned agent type, not ` +
        'subagent_type: "general-purpose" — general-purpose carries no tier identity and ' +
        "would run under whatever runtime default is in effect, not the rendered bee agent " +
        "for this tier (AO5/AO10).\n" +
        `FIX: set subagent_type: "${pinnedType}" (bee's rendered agent for the ${tier} tier), ` +
        'or use "Explore" for a read-only gather that does not need the rendered agent.';
      return denyWith(root, toolName, toolInput, reason, "generic-type-denied", modelParam, tier);
    }

    // (1) Marker + model param — AO5 strict equality.
    if (tier && modelParam) {
      const resolved = stateLib.resolveTier(root, tier, "claude");
      if (resolved.type === "model") {
        if (modelParam === resolved.model) {
          logDispatch(root, toolName, toolInput, "model-param", modelParam, tier);
          return 0;
        }
        const reason =
          `bee-model-guard: [bee-tier: ${tier}] resolves to model "${resolved.model}", but ` +
          `the dispatch carries model: "${modelParam}" — the tier label and the param ` +
          "disagree, so the dispatch would run on the param while the audit records the " +
          "tier (AO5: config is the authority, the model does not get a vote).\n" +
          `FIX: set model: "${resolved.model}" to match the ${tier} tier, or drop the ` +
          "marker and declare the tier whose configured model is the one you want.";
        return denyWith(root, toolName, toolInput, reason, "param-tier-mismatch", modelParam, tier);
      }
      // inherit (ceiling) / budget / refused (cli): the tier carries NO model
      // name, so a param bolted onto it can only lie in the audit trail.
      const reason =
        `bee-model-guard: [bee-tier: ${tier}] resolves to no model name` +
        (resolved.type === "refused" ? " (the slot is a cli executor)" : "") +
        `, but the dispatch carries model: "${modelParam}". The marker would record one ` +
        "thing in dispatch.jsonl while the subagent actually runs on the param.\n" +
        "FIX: drop the model param (the marker alone selects the tier), or drop the marker " +
        "and declare the tier whose configured model equals the param you intended.";
      return denyWith(root, toolName, toolInput, reason, "param-on-nameless-tier", modelParam, tier);
    }

    // (2) Model param, no marker — B5 membership against configured tier slots.
    if (modelParam) {
      const memberSet = configuredModelSet(stateLib, root);
      if (memberSet.size === 0 || memberSet.has(modelParam)) {
        // Empty set = unconfigured repo → fail-open allow (today's behavior).
        logDispatch(root, toolName, toolInput, "model-param", modelParam, null);
        return 0;
      }
      const configured = [...memberSet].sort().join(", ");
      const reason =
        `bee-model-guard: model: "${modelParam}" is not a model configured for any claude ` +
        "tier — a param outside config selects an unaudited model and, for an up-dispatch, " +
        "hides ceiling scarcity (AO5/B5: config is the sole authority; there is no hardcoded " +
        "allowlist).\n" +
        `FIX: use one of the configured models (${configured}); or, for a session-model ` +
        "dispatch, add [bee-tier: ceiling] (ceiling = the session model) to the " +
        "prompt/description; or add this model to a configured tier slot in .bee/config.json.";
      return denyWith(root, toolName, toolInput, reason, "param-not-configured", modelParam, null);
    }

    // (3) Marker, no param — B4(1)/W10.
    if (tier) {
      const resolved = stateLib.resolveTier(root, tier, "claude");
      if (resolved.type === "refused") {
        // A cli-shaped slot: an in-family Agent/Task subagent cannot BE the
        // external CLI (it runs as its own process, not a spawned subagent).
        // Route to the external-executor gather path; never name a phantom model.
        const reason =
          `bee-model-guard: [bee-tier: ${tier}] resolves to a cli executor, which an ` +
          "in-family Agent/Task subagent cannot be — a cli tier runs as an external process, " +
          "not a spawned subagent.\n" +
          "FIX: dispatch it through the external-executor gather path — a Bash call running " +
          "the configured command verbatim with the prompt on stdin (resolveTier(root, slot, " +
          "runtime, {for:'gather'}) returns {type:'cli', command}). Do not attach a model " +
          "param; the cli command names its own model.";
        return denyWith(root, toolName, toolInput, reason, "cli-tier-denied", null, tier);
      }
      // model / budget / inherit → allow (today's behavior, resolution-backed).
      logDispatch(root, toolName, toolInput, "marker", null, tier);
      return 0;
    }

    // (4) Bare — deny (today's behavior), but resolve the generation slot for
    // the FIX so we never tell the agent to pass a model that does not exist.
    const genResolved = stateLib.resolveTier(root, "generation", "claude");
    const bareFix =
      genResolved.type === "model"
        ? `FIX: pass model: "${genResolved.model}" for the generation tier, or add ` +
          "[bee-tier: ceiling] (or another tier: generation/extraction/review) to the prompt/description."
        : "FIX: add [bee-tier: ceiling] (or another tier: generation/extraction/review) to the " +
          "prompt/description; the generation tier is a cli executor or unconfigured, so run it " +
          "through the external-executor gather path (a Bash call with the command verbatim and " +
          "the prompt on stdin) rather than a model param.";
    const reason =
      "bee-model-guard: every Agent/Task dispatch needs an explicit tier — a `model` " +
      "param or a `[bee-tier: <tier>]` marker in the prompt/description (decision 0023). " +
      "A bare dispatch would silently inherit the most expensive session model.\n" +
      bareFix;
    // Deliberate deny: exit 2 with the reason on stderr (Claude Code feeds
    // stderr back to the model on PreToolUse exit 2).
    return denyWith(root, toolName, toolInput, reason, "bare-denied", null, null);
  } catch (error) {
    logCrash(root, HOOK_NAME, error, ctx.source);
    return 0;
  }
}

process.exitCode = await main();
