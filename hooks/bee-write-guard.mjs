#!/usr/bin/env node
// bee-write-guard: PreToolUse (Edit|Write|MultiEdit|Bash|Read|Glob|Grep) plus
// the Codex apply_patch tool path (cell codex-parity-3, decision D2).
// Four checks in one guard, first hit wins:
//   (a) gate guard   - no source writes before Gate 3 (execution approval)
//   (b) reservation  - during swarming, writes to unreserved paths are denied
//   (c) privacy/scout- secret-file reads emit the @@BEE_PRIVACY@@ marker;
//                      scout dirs (node_modules/, dist/, ...) are denied
//   (d) CLI-shape    - a Bash call shaped like a bee.mjs/bee_*.mjs invocation
//                      is validated against the shared command registry
//                      (harness-integration D4); malformed args are denied
//                      before the shell executes them. Strictly additive:
//                      runs only when checks (a)-(c) found no denial, and its
//                      own parsing failures are contained to itself (never
//                      allowed to reach the shared catch below, which would
//                      fail-open for ALL FOUR checks instead of just this one).
// Codex apply_patch: the canonical patch envelope's Add/Update/Delete/Move
// target lines are parsed and every proved target runs the SAME
// gate/direct-edit/reservation decisions as Edit/Write/Bash (cell
// codex-parity-3). P1 repair (cell codex-parity-4, plan-review third bullet):
// once an apply_patch event is INTERCEPTED (a canonical "*** Begin Patch"
// envelope was found), a target set that cannot be fully proved — zero
// Add/Update/Delete/Move/"Move to" lines parsed, or any parsed target that
// does not resolve to an in-repo relative path — DENIES (exit 2) with a
// corrective message, never allows. A visible "applypatch-unparsed" coverage
// gap is still logged either way. Malformed OUTER hook payloads (apply_patch
// called but no canonical patch envelope is present in tool_input at all)
// and genuinely unsupported host paths keep D2's visible fail-open.
// Input/root/logging go through the shared runtime adapter (hooks/adapter.mjs):
// stdin is normalized before any property access and root discovery lives
// inside the fail-open boundary.
// Deny = exit 2 with the reason (and marker, for privacy) on stderr.
// Everything else is fail-open: exit 0 (crashes logged to .bee/logs/hooks.jsonl).

import fs from "node:fs";
import path from "node:path";
import { readHookContext, logCrash, logCoverageGap, libModuleUrl } from "./adapter.mjs";

const HOOK_NAME = "write-guard";
const READ_TOOLS = new Set(["Read", "Glob", "Grep"]);
const WRITE_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);
const APPLY_PATCH_TOOLS = new Set(["apply_patch", "ApplyPatch"]);

// Convert a tool-supplied path (absolute or relative) to a forward-slash
// path relative to the repo root. Returns null when the path escapes the repo.
function toRelPath(root, cwd, rawPath) {
  if (!rawPath || typeof rawPath !== "string") {
    return null;
  }
  const abs = path.isAbsolute(rawPath) ? rawPath : path.resolve(cwd || root, rawPath);
  const rel = path.relative(root, abs);
  if (!rel || rel === "." || rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }
  return rel.split(path.sep).join("/");
}

function getNestedString(obj, keys) {
  for (const key of keys) {
    const value = obj && typeof obj === "object" ? obj[key] : undefined;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function inferAgentName(payload, toolInput) {
  const fromPayload = getNestedString(payload, [
    "agent_name",
    "agentName",
    "agent_nickname",
    "subagent_type",
  ]);
  if (fromPayload) {
    return fromPayload;
  }
  const command = typeof toolInput.command === "string" ? toolInput.command : "";
  const match = command.match(/\bBEE_AGENT_NAME=(["']?)([^"'\s]+)\1/);
  if (match) {
    return match[2];
  }
  return process.env.BEE_AGENT_NAME || null;
}

// --- Codex apply_patch target extraction (canonical envelope) ---------------
// One target line per file operation:
//   *** Add File: <path> | *** Update File: <path> | *** Delete File: <path>
//   *** Move to: <path>   (destination of an Update File move)
const PATCH_TARGET_RE = /^\*\*\*\s+(?:Add File|Update File|Delete File|Move to):\s*(.+?)\s*$/;

function applyPatchText(toolInput) {
  // Canonical Codex shape is tool_input.input; tolerate the patch envelope
  // arriving under patch/command without forking per runtime.
  for (const key of ["input", "patch", "command"]) {
    const value = toolInput[key];
    if (typeof value === "string" && value.includes("*** Begin Patch")) {
      return value;
    }
  }
  return null;
}

function extractApplyPatchTargets(patchText) {
  const targets = [];
  for (const line of String(patchText).split(/\r?\n/)) {
    const match = PATCH_TARGET_RE.exec(line);
    if (match) {
      // Trim: the lazy `(.+?)\s*$` can otherwise capture a lone leftover
      // whitespace character for a verb line whose path is pure whitespace
      // (e.g. "*** Add File:    "). Trimming turns that into "", which
      // toRelPath's `!rawPath` check correctly treats as unprovable below —
      // a bug found while building this cell's matrix (auto-fixed per the
      // worker's rule-1 deviation policy: a bug in touched code).
      targets.push(match[1].trim());
    }
  }
  return targets;
}

// ─── check (d): CLI-shape validation (harness-integration D4, additive) ────
// Recognizes a Bash command shaped like a legacy helper invocation
// (`node .../bee_cells.mjs show --id X`) or the future unified dispatcher
// (`node .../bee.mjs cells show --id X`), resolves it to a command-registry
// entry, and validates its parsed flags against that entry's JSON-Schema
// `parameters` via validate-args.mjs. Unknown/unrecognized shapes are left
// alone (fail open) — that classification (nearest-match suggestions for a
// typo'd command) is the future dispatcher's own job, not this guard's.

const LEGACY_HELPER_RE = /^bee_([a-z]+)\.mjs$/i;
const DISPATCHER_RE = /^bee\.mjs$/i;
const CLI_SEGMENT_SEPARATORS = new Set(["&&", "||", ";", "|", "&"]);

function tokenizeCommand(command) {
  const matches = String(command || "").match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ""));
}

function splitCliSegments(tokens) {
  const segments = [];
  let current = [];
  for (const token of tokens) {
    if (CLI_SEGMENT_SEPARATORS.has(token)) {
      if (current.length > 0) segments.push(current);
      current = [];
    } else {
      current.push(token);
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

// Resolve (scriptBasename, positional-tokens-after-script) to a registry
// command name plus how many positional tokens it consumed. Longest-prefix
// match over `registry`'s own names — the SAME rule du-1 added to
// resolveCommand() in skills/bee-hive/templates/bee.mjs (that function is the
// source of truth; it is duplicated rather than imported here because this
// hook only ever dynamically imports repo-root `lib/*.mjs` modules via
// libModuleUrl, never bee.mjs itself). Without this, a 3-segment command
// (state.worker.add, reviews.candidate.add) collapsed onto the old hardcoded
// 2-token shape (e.g. "state.worker.add" -> guessed as "state.worker"),
// matched no registry entry, and silently skipped schema validation — a
// documented fail-open gap this closes (plan.md "Write-guard hook gap").
// Returns null when the shape is ambiguous (no verb token at all) or no
// prefix length matches any registry name — left to fail open, never guessed.
function resolveCliCommandName(scriptBasename, positionalTokens, registry) {
  const legacyMatch = scriptBasename.match(LEGACY_HELPER_RE);
  const isDispatcher = !legacyMatch && DISPATCHER_RE.test(scriptBasename);
  if (!legacyMatch && !isDispatcher) return null;

  const group = legacyMatch ? legacyMatch[1] : positionalTokens[0];
  if (legacyMatch && group === "status") {
    return { commandName: "status", consumed: 0 };
  }
  if (isDispatcher) {
    if (!group || group.startsWith("-")) return null;
    if (group === "status") {
      return { commandName: "status", consumed: 1 };
    }
  }

  // Collect the run of non-flag tokens after the group — the same "leading
  // tokens" shape bee.mjs's own splitCommandTokens/resolveCommand match
  // against, so a 3-segment name resolves identically here.
  const scanFrom = isDispatcher ? positionalTokens.slice(1) : positionalTokens;
  const verbTokens = [];
  for (const token of scanFrom) {
    if (token.startsWith("-")) break;
    verbTokens.push(token);
  }
  if (verbTokens.length === 0) return null; // no verb token at all: ambiguous, fail open

  const names = registry && Array.isArray(registry) ? new Set(registry.map((e) => e.name)) : null;
  if (!names) return null;

  const nameSegments = [group, ...verbTokens];
  for (let n = nameSegments.length; n >= 2; n -= 1) {
    const candidate = nameSegments.slice(0, n).join(".");
    if (names.has(candidate)) {
      // Legacy shape: positionalTokens holds ONLY verb tokens (the group came
      // from the script name), so consumed = n - 1 (excludes the group).
      // Dispatcher shape: positionalTokens[0] IS the group, so consumed = n.
      return { commandName: candidate, consumed: isDispatcher ? n : n - 1 };
    }
  }
  return null;
}

// Parse the remaining flag tokens into a { flagName: value } object, using
// the resolved registry entry's own parameter schema to decide whether a
// `--flag` is boolean (no value consumed) or value-taking (next token
// consumed) — the schema is the parsing contract, not a hardcoded flag list.
function parseCliFlags(flagTokens, propertiesSchema) {
  const parsed = {};
  for (let i = 0; i < flagTokens.length; i += 1) {
    const token = flagTokens[i];
    if (!token.startsWith("--")) continue;
    const eq = token.indexOf("=");
    if (eq !== -1) {
      parsed[token.slice(2, eq)] = token.slice(eq + 1);
      continue;
    }
    const name = token.slice(2);
    const propSchema = propertiesSchema && propertiesSchema[name];
    const next = flagTokens[i + 1];
    if (propSchema && propSchema.type === "boolean") {
      parsed[name] = true;
    } else if (next !== undefined) {
      // Consume the next token as the value unconditionally, even if it
      // starts with "--" — matching bee.mjs's parseFlags exactly (a value
      // legitimately starting with "--" must not be misread as a new flag).
      parsed[name] = next;
      i += 1;
    } else {
      parsed[name] = true;
    }
  }
  return parsed;
}

// Scan every shell segment of `command` for a recognizable bee-cli
// invocation and validate it against `registry` via `validateFn`. Returns
// `{ reason }` on the first structural mismatch found, else null. Never
// throws by construction (empty/malformed inputs just fail to match); the
// caller still wraps this in its own try/catch as a second line of defense.
function checkCliShape(command, registry, validateFn) {
  if (!command || !Array.isArray(registry)) return null;
  const segments = splitCliSegments(tokenizeCommand(command));
  for (const segment of segments) {
    for (let i = 0; i < segment.length; i += 1) {
      const base = segment[i].replace(/\\/g, "/").split("/").pop();
      if (!LEGACY_HELPER_RE.test(base) && !DISPATCHER_RE.test(base)) continue;
      const positional = segment.slice(i + 1);
      const resolved = resolveCliCommandName(base, positional, registry);
      if (!resolved) break; // ambiguous shape for this segment: fail open
      const entry = registry.find((candidate) => candidate.name === resolved.commandName);
      if (!entry) break; // unknown command name: dispatcher's concern, not this guard's
      const flagTokens = positional.slice(resolved.consumed);
      const parsedArgs = parseCliFlags(flagTokens, entry.parameters && entry.parameters.properties);
      const result = validateFn(entry, parsedArgs);
      if (result && result.ok === false) {
        const field = result.error && result.error.field;
        const reason = (result.error && result.error.reason) || "does not match the command's schema";
        return {
          reason:
            `bee CLI-shape guard: "${String(command).trim()}" ` +
            `does not match ${entry.name}'s schema — ${reason}${field ? ` (field: ${field})` : ""}. ` +
            `Correction: run \`${entry.invoke}\` with the required parameters (see \`bee --help --json\`).`,
        };
      }
      break; // this segment resolved to one bee-cli call; move to the next segment
    }
  }
  return null;
}

async function main() {
  const ctx = await readHookContext(HOOK_NAME);
  const root = ctx.root;
  if (!root) {
    return 0;
  }
  if (!fs.existsSync(path.join(root, ".bee", "bin", "lib", "state.mjs"))) {
    return 0;
  }

  const payload = ctx.payload;
  let denial = null; // { reason }
  try {
    const stateLib = await import(libModuleUrl(root, "state.mjs"));
    if (!stateLib.hookEnabled(root, HOOK_NAME)) {
      return 0;
    }
    const guards = await import(libModuleUrl(root, "guards.mjs"));

    const toolName = payload.tool_name || payload.toolName || "";
    const toolInput =
      payload.tool_input && typeof payload.tool_input === "object" ? payload.tool_input : {};
    const cwd = ctx.cwd;

    if (READ_TOOLS.has(toolName)) {
      const rel = toRelPath(root, cwd, toolInput.file_path || toolInput.path || "");
      if (rel) {
        const verdict = guards.checkRead(rel);
        if (verdict && verdict.allow === false) {
          const parts = [verdict.reason || `bee ${verdict.kind || "read"} guard denied: ${rel}`];
          if (verdict.marker) {
            parts.push(verdict.marker);
          }
          denial = { reason: parts.join("\n") };
        }
      }
    } else if (
      WRITE_TOOLS.has(toolName) ||
      toolName === "Bash" ||
      APPLY_PATCH_TOOLS.has(toolName)
    ) {
      const state = stateLib.readState(root);
      const agentName = inferAgentName(payload, toolInput);
      let relPaths = [];

      if (APPLY_PATCH_TOOLS.has(toolName)) {
        // D2 / approach.md §2: an intercepted apply_patch runs the existing
        // gate/direct-edit/reservation decisions on every proved target.
        const patchText = applyPatchText(toolInput);
        if (patchText === null) {
          // Malformed OUTER payload: apply_patch fired but tool_input carries
          // no recognizable "*** Begin Patch" envelope at all — nothing was
          // genuinely intercepted, so this stays D2's visible fail-open.
          logCoverageGap(
            root,
            HOOK_NAME,
            "applypatch-unparsed",
            "apply_patch intercepted but no canonical patch envelope found in tool_input",
            ctx.source,
          );
        } else {
          const targets = extractApplyPatchTargets(patchText);
          relPaths = targets.map((p) => toRelPath(root, cwd, p)).filter(Boolean);
          if (targets.length === 0 || relPaths.length < targets.length) {
            // P1 repair (codex-parity-4): the envelope WAS intercepted, but
            // the target set cannot be fully proved (no Add/Update/Delete/
            // Move line parsed at all, or a parsed target escapes the repo /
            // fails to resolve) — deny rather than risk an unchecked write.
            // Still logged as a visible coverage gap for audit (D2).
            logCoverageGap(
              root,
              HOOK_NAME,
              "applypatch-unparsed",
              targets.length === 0
                ? "apply_patch intercepted but no Add/Update/Delete/Move/\"Move to\" target line could be parsed from the patch body"
                : `apply_patch intercepted but ${targets.length - relPaths.length} of ${targets.length} target(s) could not be proved inside the repo`,
              ctx.source,
            );
            denial = {
              reason:
                "bee apply_patch guard: this patch's target set could not be fully proved inside the repo — " +
                "denying rather than risking an unchecked write. " +
                "FIX: use canonical \"*** Add File:\", \"*** Update File:\", \"*** Delete File:\", and \"*** Move to:\" " +
                "lines naming plain in-repo relative paths (no path traversal, no unresolvable escapes), then resubmit.",
            };
          }
        }
      } else if (toolName === "Bash") {
        const command = typeof toolInput.command === "string" ? toolInput.command : "";
        if (command) {
          const targets = guards.extractBashTargets(command);
          const paths = (targets && targets.paths) || [];
          relPaths = paths.map((p) => toRelPath(root, cwd, p)).filter(Boolean);
          if (relPaths.length === 0 && targets && targets.broadWrite) {
            relPaths = ["**"];
          }
        }
      } else {
        const rel = toRelPath(root, cwd, toolInput.file_path || "");
        if (rel) {
          relPaths = [rel];
        }
      }

      for (const rel of relPaths) {
        const verdict = guards.checkWrite(root, state, rel, agentName);
        if (verdict && verdict.allow === false) {
          denial = {
            reason:
              verdict.reason || `bee ${verdict.kind || "write"} guard denied write to: ${rel}`,
          };
          break;
        }
      }
    }

    // Check (d) — CLI-shape validation (additive, D4). Runs unconditionally
    // for Bash calls (appended after checks (a)-(c), never gating on them),
    // but can only ever ASSIGN a denial when none exists yet (`!denial` right
    // before the write — first hit wins, matching this file's documented
    // semantics) — so it can never overwrite or discard a denial checks
    // (a)-(c) already computed. Its try/catch is intentionally separate from
    // the outer one below: a bug in the Bash-parsing logic here must fail
    // open for THIS check only, never propagate to the shared catch (which
    // would discard any denial already set by checks (a)-(c) and fail open
    // for all four checks at once).
    if (toolName === "Bash") {
      const command = typeof toolInput.command === "string" ? toolInput.command : "";
      if (command) {
        try {
          const validateLib = await import(libModuleUrl(root, "validate-args.mjs"));
          const registryLib = await import(libModuleUrl(root, "command-registry.mjs"));
          const cliDenial = checkCliShape(command, registryLib.COMMAND_REGISTRY, validateLib.validate);
          if (cliDenial && !denial) {
            denial = cliDenial;
          }
        } catch (cliError) {
          logCrash(root, HOOK_NAME, cliError, ctx.source);
        }
      }
    }
  } catch (error) {
    logCrash(root, HOOK_NAME, error, ctx.source);
    return 0;
  }

  if (denial) {
    // Deliberate deny: exit 2 with the reason on stderr (Claude Code feeds
    // stderr back to the model on PreToolUse exit 2; Codex blocks supported
    // PreToolUse paths the same way). A log-write failure can never cancel
    // this deny — logging is fail-open inside the adapter.
    process.stderr.write(denial.reason);
    return 2;
  }
  return 0;
}

process.exitCode = await main();
