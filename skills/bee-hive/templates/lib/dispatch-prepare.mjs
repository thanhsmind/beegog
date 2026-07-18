// dispatch-prepare.mjs — `bee dispatch prepare`, one source of truth for
// every bee-owned dispatch payload (g22-1, GH #22 P0-3).
//
// Builds the exact envelope a caller hands to the Agent tool / spawn_agent
// tool / an external cli executor, PLUS a small "economics" record (which
// tier was requested, which channel/enforcement mechanism carries it, and
// whether the effective model is verifiably pinned) — so a worker dispatch
// never has to hand-assemble the marker/model-param/subagent_type shape
// dispatch-guard.mjs (the enforcement side) is going to judge. Two sides,
// one vocabulary: this module imports PINNED_AGENT_TYPE from
// lib/dispatch-guard.mjs rather than re-deriving its own copy, and every
// [bee-tier: <t>] marker this module writes uses the same anchored-at-start
// convention dispatch-guard.mjs's ANCHORED_TIER_MARKER_RE checks.
//
// PURPOSE MAP (advisor A1, binding):
//   kind cell               -> resolveTier(root, 'generation', runtime, {for:'cell'})
//   kind gather              -> resolveTier(root, 'generation', runtime, {for:'gather'})
//   kind reviewer            -> resolveTier(root, 'review',     runtime, {for:'gather'})
//   kind advisor             -> resolveAdvisor(root, runtime) — NEVER a bare
//                                resolveTier(root, 'advisor', ...) call, which
//                                would silently coerce to 'generation'
//                                (state.mjs CONFIGURABLE_SLOTS comment, :1247).
//
// A cli-shaped resolution for kind 'cell' is a typed refusal
// ({type:'refused', reason:'cli_tier_gather_only', ...}, state.mjs resolveTier)
// — prepare returns that refusal VERBATIM and never builds a payload around
// it (advisor A1: "prepare NEVER routes around a refusal"). A cli-shaped
// resolution for gather/reviewer/advisor is a legitimate external-executor
// dispatch (External Executors, bee-swarming/references/swarming-reference.md)
// and gets its own Bash-shaped payload, below.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveTier, resolveAdvisor } from './state.mjs';
import { readCell } from './cells.mjs';
import { PINNED_AGENT_TYPE, deriveEconomics } from './dispatch-guard.mjs';

export const DISPATCH_RUNTIMES = ['codex', 'claude'];
export const DISPATCH_KINDS = ['cell', 'gather', 'reviewer', 'advisor'];

// The tier/slot name embedded in the [bee-tier: <t>] marker and recorded as
// economics.logical_tier. cell/gather both resolve the 'generation' slot;
// reviewer resolves 'review'. advisor has no resolveTier slot at all (it is
// deliberately excluded from CONFIGURABLE_SLOTS) — 'advisor' is a label, not
// a token dispatch-guard.mjs's ANCHORED_TIER_MARKER_RE recognizes today; an
// advisor-kind payload is therefore not expected to pass the guard's marker
// branches the way cell/gather/reviewer payloads do.
function slotForKind(kind) {
  if (kind === 'cell' || kind === 'gather') return 'generation';
  if (kind === 'reviewer') return 'review';
  return 'advisor';
}

function purposeForKind(kind) {
  return kind === 'cell' ? { for: 'cell' } : { for: 'gather' };
}

// Template-consistent minimal prompt bodies (advisor spec: "for cell, render
// from the Worker Prompt Template shape ... for gather/reviewer/advisor,
// template-consistent minimal shapes"). Cell context comes from the loaded
// cell; gather/reviewer/advisor get a goal + paths + digest contract shape —
// the caller fills in the exact paths/question before dispatch.
function cellPromptBody(cell) {
  return [
    `Nickname (reservation identity): prepare-${cell.id}`,
    `Assigned cell id: ${cell.id}`,
    `Feature: ${cell.feature}`,
    '',
    `Title: ${cell.title || '(untitled)'}`,
    `Action: ${cell.action || '(no action recorded)'}`,
    '',
    'Inputs — read these; nothing else will be provided:',
    `- docs/history/${cell.feature}/CONTEXT.md`,
    `- docs/history/${cell.feature}/plan.md`,
    '',
    'Contract:',
    '- Load the bee-executing skill immediately and follow its loop exactly.',
    '- Execute only the assigned cell. Do not select or accept other work.',
    '- Reserve every file before writing, under your nickname.',
    '- Return exactly one final status token: [DONE], [BLOCKED], [HANDOFF], or [NOOP].',
    '',
    'Startup:',
    '1. Read AGENTS.md.',
    '2. Run node .bee/bin/bee.mjs status --json',
    `3. Run node .bee/bin/bee.mjs cells show --id ${cell.id}`,
    '4. Reserve, implement, verify, cap, release, report.',
  ].join('\n');
}

const GATHER_SHAPED_GOAL = {
  gather: 'Gather: locate and digest the requested paths/facts. Read-only — never write, never edit, never run a mutating command.',
  reviewer: 'Review: check the given claim/diff against the repo. Read-only; may run read-only commands (tests, linters, the configured verify) to check evidence.',
  advisor: 'Advisor consult: produce an independent digest/opinion on the given question. Read-only.',
};

function gatherShapedPromptBody(kind) {
  return [
    GATHER_SHAPED_GOAL[kind] || `${kind}: read-only task.`,
    '',
    'Paths: <caller fills in the exact files/paths to read>',
    '',
    'Digest contract: return the paths read, the facts with file:line anchors, and verbatim quotes only where asked.',
  ].join('\n');
}

function promptBodyFor(kind, cell) {
  return kind === 'cell' ? cellPromptBody(cell) : gatherShapedPromptBody(kind);
}

// PREPARE-TIME RECORD (advisor R2): one line per prepared dispatch, appended
// to the SAME .bee/logs/dispatch.jsonl the guard's own enforcement audit
// writes to, distinguished by source:'prepare' — no correlation with the
// guard's later enforcement line is attempted (a different dispatch_id/ts,
// on purpose: this is "what was asked for", the guard's line is "what was
// allowed/denied"). Fail-open like every other bee log write: a log failure
// never blocks prepare from returning its payload.
function appendPrepareRecord(root, record) {
  try {
    const logsDir = path.join(root, '.bee', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(
      path.join(logsDir, 'dispatch.jsonl'),
      `${JSON.stringify({ ts: new Date().toISOString(), source: 'prepare', ...record })}\n`,
    );
  } catch {
    // fail-open — the prepare record is an audit convenience, never a blocker
  }
}

/**
 * prepareDispatch(root, {runtime, kind, cell, json}) -> the payload envelope,
 * or a typed refusal ({ok:false, ...}). Throws only on a malformed CALL
 * (bad runtime/kind, missing/unknown --cell for kind 'cell') — never on a
 * legitimate cli-shaped or unconfigured-advisor resolution, which are typed
 * refusals returned to the caller, not exceptions.
 */
export function prepareDispatch(root, { runtime, kind, cell: cellId } = {}) {
  if (!DISPATCH_RUNTIMES.includes(runtime)) {
    throw new Error(`dispatch prepare: --runtime must be one of ${DISPATCH_RUNTIMES.join('|')}, got "${runtime}".`);
  }
  if (!DISPATCH_KINDS.includes(kind)) {
    throw new Error(`dispatch prepare: --kind must be one of ${DISPATCH_KINDS.join('|')}, got "${kind}".`);
  }

  let cell = null;
  if (kind === 'cell') {
    if (!cellId) {
      throw new Error('dispatch prepare: --cell is required when --kind cell.');
    }
    cell = readCell(root, cellId);
    if (!cell) {
      throw new Error(`dispatch prepare: cell "${cellId}" not found.`);
    }
  }

  const tierToken = slotForKind(kind);
  let resolved;
  if (kind === 'advisor') {
    resolved = resolveAdvisor(root, runtime);
    if (resolved == null) {
      return {
        ok: false,
        reason: 'advisor_not_configured',
        fix: `set models.${runtime}.advisor in .bee/config.json to enable an advisor consult (resolveAdvisor never falls back to another tier).`,
      };
    }
  } else {
    resolved = resolveTier(root, tierToken, runtime, purposeForKind(kind));
    if (resolved.type === 'refused') {
      // advisor A1: prepare NEVER routes around a refusal — surfaced verbatim,
      // never coerced into a payload.
      return { ok: false, type: 'refused', reason: resolved.reason, slot: resolved.slot, fix: resolved.fix };
    }
  }

  const promptBody = promptBodyFor(kind, cell);
  const requestedModel = resolved.type === 'model' ? resolved.model : null;
  const pinnedType = PINNED_AGENT_TYPE[tierToken] || 'general-purpose';

  let tool;
  let payload;
  let channel;

  if (resolved.type === 'cli') {
    // External-executor dispatch (swarming-reference.md "External Executors"):
    // never an Agent/spawn_agent tool call — an in-family subagent cannot BE
    // the external CLI. The prompt is carried on stdin, matching the
    // promptVia:'stdin' convention documented on cli-shaped config slots.
    tool = 'Bash';
    payload = { command: resolved.command, stdin: promptBody };
    channel = 'cli-exec';
  } else if (runtime === 'codex') {
    tool = 'spawn_agent';
    payload = {
      agent_type: 'worker',
      // Marker at the very start of message — the exact position
      // dispatch-guard.mjs's evaluateDispatch checks (ANCHORED_TIER_MARKER_RE).
      message: `[bee-tier: ${tierToken}]\n${promptBody}`,
    };
    channel = 'codex-native';
    // Codex's spawn_agent tool has no per-agent model field at all (P14/P17,
    // "Codex has no per-agent model selection today"): the tier is enforced
    // as a read budget + output cap stated in the prompt, never a structural
    // param, regardless of whether resolveTier resolved a model name.
  } else {
    tool = 'Agent';
    payload = {
      subagent_type: pinnedType,
      prompt: `[bee-tier: ${tierToken}]\n${promptBody}`,
      description: `${kind} (${requestedModel || tierToken})`,
    };
    if (resolved.type === 'model') {
      payload.model = resolved.model;
    }
    channel = 'claude-agent';
  }

  // Shared derivation (g22-2, GH #22 P1-6 D3): the honest pinned/unverified/
  // inherited-or-unknown split now lives ONCE in dispatch-guard.mjs's
  // deriveEconomics, so this module's economics block and the enforcement
  // hook's dispatch-log economics can never independently drift. A
  // structural `model` param exists here ONLY on the claude-agent channel
  // when resolved.type === 'model' (the exact condition, above, that set
  // payload.model) — codex-native's spawn_agent has no such field, and
  // cli-exec's Bash payload names its own model outside this vocabulary.
  const paramModel = channel === 'claude-agent' && resolved.type === 'model' ? resolved.model : null;
  const economics = deriveEconomics({ channel, tier: tierToken, paramModel, resolved });

  const dispatch_id = crypto.randomUUID();

  appendPrepareRecord(root, {
    dispatch_id,
    kind,
    cell: cell ? cell.id : null,
    runtime,
    ...economics,
  });

  return { tool, payload, dispatch_id, economics };
}
