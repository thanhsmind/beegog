// hooks/adapter.mjs — the one shared runtime adapter used by every bee
// wrapper hook (cell codex-parity-3; CONTEXT.md decision D2: "Codex receives
// full hook parity on every compatible event and tool path ... unsupported
// paths fail open with visible limits and runtime-specific tests";
// approach.md section 2 "Shared hook logic, exact host adapters").
//
// Responsibilities, in order:
//   1. stdin normalization — arbitrary stdin (empty, junk bytes, top-level
//      null, arrays, non-string cwd, missing cwd, multi-MB payloads) is
//      normalized to a plain object BEFORE any property access. No wrapper
//      ever touches `payload.<anything>` on an un-normalized value again.
//   2. root discovery inside the fail-open boundary — findRepoRoot is called
//      inside readHookContext's own try/catch, so no discovery throw can
//      escape into a wrapper crash.
//   3. per-host/event output encoding — Codex requires non-empty stdout on
//      SubagentStop/Stop to be JSON and ignores plain stdout on PreCompact
//      (discovery.md "Current Codex Contracts"); Claude Code accepts the same
//      JSON hook-output shape. Advisories on those events are therefore
//      encoded as a parseable JSON `systemMessage` — NEVER `decision:"block"`,
//      which on SubagentStop continues the child and on Stop loops the main
//      turn (D2: an advisory must stay advisory). SessionStart and
//      UserPromptSubmit keep plain stdout: both hosts consume it as developer
//      context.
//   4. crash + coverage-gap logging that NEVER changes the allow/deny
//      result — every log write is wrapped; a throwing import, a log-write
//      failure, or malformed input can never flip an allow into a deny or a
//      deny into an allow. Fail-open means fail-open, visibly logged in
//      .bee/logs/hooks.jsonl.
//
// Source identity (approach.md section 1): a hook catalog command may pass
// `--source plugin|repo` explicitly. The adapter parses and threads it into
// every crash/coverage-gap log line so source arbitration (a later
// Distribution-slice cell) can audit which installed source produced an
// event. An unknown value is recorded as a visible `invalid-source` coverage
// gap and treated as null — never a behavior change.
//
// Coverage-gap classes (each asserted by a dedicated harness row in
// hooks/test_hook_contracts.mjs):
//   - malformed-payload  : stdin was non-empty but not a JSON object
//   - invalid-cwd        : payload.cwd present but not a usable string
//   - invalid-source     : --source value is not plugin|repo
//   - applypatch-unparsed: (logged by bee-write-guard) an intercepted
//                          apply_patch whose targets could not all be proved

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Events whose non-empty stdout must be a parseable JSON systemMessage.
export const ADVISORY_EVENTS = Object.freeze(["PreCompact", "SubagentStop", "Stop"]);

const SOURCE_IDENTITIES = new Set(["plugin", "repo"]);
const DETAIL_MAX = 300;

function truncateDetail(text) {
  const s = text == null ? "" : String(text);
  return s.length <= DETAIL_MAX ? s : `${s.slice(0, DETAIL_MAX)}...`;
}

// --- source identity -------------------------------------------------------

// Returns { source: "plugin"|"repo"|null, invalid?: string }. Never throws.
export function parseSourceIdentity(argv = process.argv) {
  try {
    for (let i = 0; i < argv.length; i += 1) {
      const arg = argv[i];
      if (typeof arg !== "string") continue;
      let value = null;
      if (arg.startsWith("--source=")) {
        value = arg.slice("--source=".length).trim();
      } else if (arg === "--source") {
        value = typeof argv[i + 1] === "string" ? argv[i + 1].trim() : "";
      } else {
        continue;
      }
      if (SOURCE_IDENTITIES.has(value)) {
        return { source: value };
      }
      return { source: null, invalid: value || "<missing>" };
    }
  } catch {
    // fail-open: source identity is audit metadata, never a decision input
  }
  return { source: null };
}

// --- root discovery --------------------------------------------------------

export function findRepoRoot(startDir) {
  let candidate = path.resolve(typeof startDir === "string" && startDir ? startDir : process.cwd());
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

export function libModuleUrl(root, name) {
  return pathToFileURL(path.join(root, ".bee", "bin", "lib", name)).href;
}

// --- fail-open logging -----------------------------------------------------

// Low-level append to .bee/logs/hooks.jsonl. A log failure is swallowed:
// logging never changes a hook's decision or exit code.
export function appendHookLog(root, entry) {
  try {
    const logsDir = path.join(root, ".bee", "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(path.join(logsDir, "hooks.jsonl"), `${JSON.stringify(entry)}\n`);
  } catch {
    // fail-open: never break (or flip) a hook over logging
  }
}

export function logCrash(root, hookName, error, source = null) {
  if (!root) return;
  appendHookLog(root, {
    ts: new Date().toISOString(),
    hook: hookName,
    ...(source ? { source } : {}),
    error: String((error && error.stack) || error),
  });
}

// A coverage gap is a host path the hook could not fully cover (malformed
// payload, unprovable patch target, ...). It is logged VISIBLY and the hook
// proceeds fail-open — the gap line never alters the allow/deny result (D2).
export function logCoverageGap(root, hookName, gap, detail, source = null) {
  if (!root) return;
  appendHookLog(root, {
    ts: new Date().toISOString(),
    hook: hookName,
    event: "coverage-gap",
    gap,
    detail: truncateDetail(detail),
    ...(source ? { source } : {}),
  });
}

// --- stdin normalization + context -----------------------------------------

async function readRawStdin() {
  const chunks = [];
  try {
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
  } catch {
    return "";
  }
  return Buffer.concat(chunks).toString("utf8");
}

// The one entry point every wrapper calls first. NEVER throws. Returns:
//   payload : plain object (malformed stdin normalized to {})
//   cwd     : usable string cwd (payload.cwd when valid, else process.cwd())
//   root    : bee repo root or null
//   source  : "plugin" | "repo" | null (explicit --source identity)
//   event   : payload.hook_event_name when a string, else ""
//   gaps    : coverage gaps found during normalization (already logged when
//             a root was found)
export async function readHookContext(hookName, { argv = process.argv } = {}) {
  const gaps = [];

  const raw = await readRawStdin();
  let payload = {};
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        payload = parsed;
      } else {
        gaps.push({
          gap: "malformed-payload",
          detail: `top-level ${parsed === null ? "null" : Array.isArray(parsed) ? "array" : typeof parsed} payload — normalized to {}`,
        });
      }
    } catch {
      gaps.push({ gap: "malformed-payload", detail: "stdin is not parseable JSON — normalized to {}" });
    }
  }

  let cwd = process.cwd();
  if (typeof payload.cwd === "string" && payload.cwd.trim()) {
    cwd = payload.cwd;
  } else if (payload.cwd !== undefined) {
    gaps.push({
      gap: "invalid-cwd",
      detail: `payload.cwd is ${Array.isArray(payload.cwd) ? "an array" : typeof payload.cwd}, not a usable string — fell back to process.cwd()`,
    });
  }

  const parsedSource = parseSourceIdentity(argv);
  if (parsedSource.invalid) {
    gaps.push({
      gap: "invalid-source",
      detail: `--source "${parsedSource.invalid}" is not plugin|repo — recorded as unknown`,
    });
  }

  let root = null;
  try {
    root = findRepoRoot(cwd);
  } catch {
    // fail-open boundary: a discovery throw means "no root" — with no root
    // there is nowhere to log, so the hook simply no-ops (exit 0 upstream).
    root = null;
  }

  if (root) {
    for (const g of gaps) {
      logCoverageGap(root, hookName, g.gap, g.detail, parsedSource.source);
    }
  }

  const event = typeof payload.hook_event_name === "string" ? payload.hook_event_name : "";
  return { payload, cwd, root, source: parsedSource.source, event, gaps };
}

// --- output encoding -------------------------------------------------------

export function isAdvisoryEvent(event) {
  return ADVISORY_EVENTS.includes(event);
}

// Encode one advisory as the parseable JSON shape both hosts accept. NEVER
// emits decision:"block" — on Codex that would continue a child
// (SubagentStop) or loop the main turn (Stop) instead of advising (D2,
// discovery.md "Current Codex Contracts").
export function encodeAdvisory(text) {
  return JSON.stringify({ systemMessage: String(text) });
}

// Write hook output encoded for the event: advisory events (PreCompact,
// SubagentStop, Stop) get JSON systemMessage; context events (SessionStart,
// UserPromptSubmit) stay plain stdout. `defaultEvent` covers hosts/payloads
// that omit hook_event_name: pass the event the wrapper is wired to.
export function emitHookOutput(ctx, text, { defaultEvent = "" } = {}) {
  const message = String(text);
  if (!message.trim()) return;
  const event = (ctx && ctx.event) || defaultEvent;
  if (isAdvisoryEvent(event)) {
    process.stdout.write(encodeAdvisory(message));
  } else {
    process.stdout.write(message);
  }
}
