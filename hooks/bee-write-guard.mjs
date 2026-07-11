#!/usr/bin/env node
// bee-write-guard: PreToolUse (Edit|Write|MultiEdit|Bash|Read|Glob|Grep).
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
// Deny = exit 2 with the reason (and marker, for privacy) on stderr.
// Everything else is fail-open: exit 0 (crashes logged to .bee/logs/hooks.jsonl).

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HOOK_NAME = "write-guard";
const READ_TOOLS = new Set(["Read", "Glob", "Grep"]);
const WRITE_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);

async function readStdinPayload() {
  const chunks = [];
  try {
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
  } catch {
    return {};
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function findRepoRoot(startDir) {
  let candidate = path.resolve(startDir || process.cwd());
  while (true) {
    if (fs.existsSync(path.join(candidate, ".bee", "onboarding.json"))) {
      return candidate;
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) {
      return null;
    }
    candidate = parent;
  }
}

function logCrash(root, error) {
  try {
    const logsDir = path.join(root, ".bee", "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(
      path.join(logsDir, "hooks.jsonl"),
      `${JSON.stringify({
        ts: new Date().toISOString(),
        hook: HOOK_NAME,
        error: String((error && error.stack) || error),
      })}\n`,
    );
  } catch {
    // fail-open
  }
}

function libModuleUrl(root, name) {
  return pathToFileURL(path.join(root, ".bee", "bin", "lib", name)).href;
}

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
// command name plus how many positional tokens it consumed. Returns null
// when the shape is ambiguous (e.g. no subcommand token at all) — left to
// fail open, never guessed.
function resolveCliCommandName(scriptBasename, positionalTokens) {
  const legacyMatch = scriptBasename.match(LEGACY_HELPER_RE);
  if (legacyMatch) {
    const group = legacyMatch[1];
    if (group === "status") {
      return { commandName: "status", consumed: 0 };
    }
    const action = positionalTokens[0];
    if (!action || action.startsWith("-")) return null;
    return { commandName: `${group}.${action}`, consumed: 1 };
  }
  if (DISPATCHER_RE.test(scriptBasename)) {
    const group = positionalTokens[0];
    if (!group || group.startsWith("-")) return null;
    if (group === "status") {
      return { commandName: "status", consumed: 1 };
    }
    const action = positionalTokens[1];
    if (!action || action.startsWith("-")) return null;
    return { commandName: `${group}.${action}`, consumed: 2 };
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
    const nextIsValue = next !== undefined && !next.startsWith("--");
    if (propSchema && propSchema.type === "boolean") {
      parsed[name] = true;
    } else if (nextIsValue) {
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
      const resolved = resolveCliCommandName(base, positional);
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
  const payload = await readStdinPayload();
  const root = findRepoRoot(payload.cwd || process.cwd());
  if (!root) {
    return 0;
  }
  if (!fs.existsSync(path.join(root, ".bee", "bin", "lib", "state.mjs"))) {
    return 0;
  }

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
    const cwd = payload.cwd || process.cwd();

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
    } else if (WRITE_TOOLS.has(toolName) || toolName === "Bash") {
      const state = stateLib.readState(root);
      const agentName = inferAgentName(payload, toolInput);
      let relPaths = [];

      if (toolName === "Bash") {
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
          logCrash(root, cliError);
        }
      }
    }
  } catch (error) {
    logCrash(root, error);
    return 0;
  }

  if (denial) {
    // Deliberate deny: exit 2 with the reason on stderr (Claude Code feeds
    // stderr back to the model on PreToolUse exit 2).
    process.stderr.write(denial.reason);
    return 2;
  }
  return 0;
}

process.exitCode = await main();
