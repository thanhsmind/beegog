// guards.mjs — gate guard, reservation guard, privacy/scout read guard,
// and bash write-target extraction. Used by the write-guard hook and helpers.

import { findConflicts } from './reservations.mjs';
import { readConfig } from './state.mjs';

/** File-path patterns that must never be read without asking the human. */
export const SECRET_PATTERNS = [
  /(^|[\\/])\.env(\.[A-Za-z0-9._-]+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /(^|[\\/])id_rsa[^\\/]*$/i,
  /\.p12$/i,
  /(^|[\\/])credentials[^\\/]*$/i,
  /(^|[\\/])secrets\.[^\\/]+$/i,
];

/** Directories agents should never scout through. */
export const SCOUT_DIRS = [
  'node_modules/',
  'dist/',
  'build/',
  '.git/objects',
  'vendor/',
  'coverage/',
  '.next/',
  '__pycache__/',
];

/** Paths writable in gated phases even before execution approval. */
export const GATE_ALLOWED_PREFIXES = ['.bee/', 'docs/', '.spikes/', 'plans/', 'AGENTS.md'];

const GATED_PHASES = new Set(['exploring', 'planning', 'validating']);

function normalizeRel(relPath) {
  return String(relPath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '');
}

function underAllowedPrefix(relPath) {
  const normalized = normalizeRel(relPath);
  return GATE_ALLOWED_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) {
      return normalized === prefix.slice(0, -1) || normalized.startsWith(prefix);
    }
    return normalized === prefix;
  });
}

/**
 * Gate + reservation write check.
 * - Idle (intake gate): no bee work is active, so source writes are blocked
 *   until the request is routed through bee-hive. Repository-harness lesson:
 *   a default-open first move is the hole every ad-hoc edit slips through.
 *   Disable per repo with {"guards":{"idle_gate":false}} in .bee/config.json.
 * - Gated phases (exploring/planning/validating): block writes outside
 *   GATE_ALLOWED_PREFIXES while approved_gates.execution is false.
 * - Swarming: deny writes that conflict with another agent's reservation
 *   (agent identity from agentName arg or BEE_AGENT_NAME env).
 */
export function checkWrite(root, state, relPath, agentName = null) {
  const normalized = normalizeRel(relPath);
  const phase = state?.phase || 'idle';

  if (phase === 'idle') {
    const config = readConfig(root);
    const idleGateOn = !(config.guards && config.guards.idle_gate === false);
    if (idleGateOn && !underAllowedPrefix(normalized)) {
      return {
        allow: false,
        kind: 'intake',
        reason:
          `bee intake gate: no bee work is active (phase: idle) — writing "${normalized}" is blocked. ` +
          'Route the request through bee-hive first: classify the mode (tiny fixes stay tiny — one cell, ' +
          'a 2-minute reality check, Gate 3, go), then execute. ' +
          `Writable without routing: ${GATE_ALLOWED_PREFIXES.join(', ')}. ` +
          'To disable this gate for the repo: set {"guards":{"idle_gate":false}} in .bee/config.json.',
      };
    }
    return { allow: true };
  }

  if (GATED_PHASES.has(phase)) {
    const executionApproved = state?.approved_gates?.execution === true;
    if (!executionApproved && !underAllowedPrefix(normalized)) {
      return {
        allow: false,
        kind: 'gate',
        reason:
          `bee gate: phase is "${phase}" and gate "execution" is not approved — ` +
          `writing "${normalized}" is blocked. Allowed now: ${GATE_ALLOWED_PREFIXES.join(', ')}. ` +
          'Get execution approval (bee-hive) before touching source files.',
      };
    }
    return { allow: true };
  }

  if (phase === 'swarming') {
    const agent = agentName || process.env.BEE_AGENT_NAME || null;
    if (agent) {
      const conflicts = findConflicts(root, agent, [normalized]);
      if (conflicts.length > 0) {
        const held = conflicts
          .map((c) => `${c.agent} holds "${c.path}" (cell ${c.cell})`)
          .join('; ');
        return {
          allow: false,
          kind: 'reservation',
          reason:
            `bee reservation conflict: "${normalized}" is reserved by another agent — ${held}. ` +
            'Reserve the path first or return [BLOCKED] to the orchestrator.',
        };
      }
    }
    return { allow: true };
  }

  return { allow: true };
}

/**
 * Privacy/scout read check. Privacy denials carry a marker the hook prints
 * so the runtime can surface the question to the human.
 */
export function checkRead(relPath) {
  const normalized = normalizeRel(relPath);

  if (SECRET_PATTERNS.some((pattern) => pattern.test(normalized))) {
    const question = `"${normalized}" looks like a secret/credential file. Ask the user before reading it.`;
    const marker = `@@BEE_PRIVACY@@${JSON.stringify({ file: normalized, question })}@@END@@`;
    return {
      allow: false,
      kind: 'privacy',
      reason: `bee privacy guard: ${question}`,
      marker,
    };
  }

  const scoutHit = SCOUT_DIRS.find(
    (dir) => normalized.startsWith(dir) || normalized.includes(`/${dir}`),
  );
  if (scoutHit) {
    return {
      allow: false,
      kind: 'scout',
      reason:
        `bee scout guard: "${normalized}" is inside "${scoutHit}" — generated/vendored content. ` +
        'Read the source or lockfile instead.',
    };
  }

  return { allow: true };
}

const WRITE_COMMANDS = new Set(['rm', 'mv', 'cp', 'mkdir', 'touch', 'tee']);
const SEPARATORS = new Set(['&&', '||', ';', '|', '&']);
const BROAD_TARGETS = new Set(['.', '..', '/', '~', '*', './*', '/*']);

function tokenize(command) {
  const matches = String(command || '').match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ''));
}

function isFlag(token) {
  return token.startsWith('-');
}

function isBroad(target) {
  const normalized = normalizeRel(target);
  return (
    BROAD_TARGETS.has(target) ||
    BROAD_TARGETS.has(normalized) ||
    normalized.endsWith('/*') ||
    normalized.endsWith('/.') ||
    normalized === '*'
  );
}

/**
 * Extract file targets a bash command may write to (khuym patterns:
 * `sed -i`, `tee`, `rm`, `mv`, `cp`, `mkdir`, `touch`, `git add|mv|rm`,
 * redirection `>`). Returns { paths, broadWrite }.
 */
export function extractBashTargets(command) {
  const tokens = tokenize(command);
  const paths = [];
  let broadWrite = false;

  const addTarget = (target) => {
    if (!target || target === '/dev/null' || target === 'NUL') return;
    if (isBroad(target)) broadWrite = true;
    paths.push(target);
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    // Redirection: "> file", ">> file", ">file", "2> file"
    const redirect = token.match(/^\d?>{1,2}(.*)$/);
    if (redirect) {
      const inline = redirect[1];
      if (inline) addTarget(inline);
      else if (tokens[i + 1] && !SEPARATORS.has(tokens[i + 1])) {
        addTarget(tokens[i + 1]);
        i += 1;
      }
      continue;
    }

    if (SEPARATORS.has(token)) continue;

    const cmd = token.replace(/\\/g, '/').split('/').pop();

    if (cmd === 'git' && ['add', 'mv', 'rm'].includes(tokens[i + 1])) {
      for (let j = i + 2; j < tokens.length && !SEPARATORS.has(tokens[j]); j += 1) {
        if (!isFlag(tokens[j])) addTarget(tokens[j]);
        i = j;
      }
      continue;
    }

    if (cmd === 'sed') {
      let inPlace = false;
      let last = i;
      const args = [];
      for (let j = i + 1; j < tokens.length && !SEPARATORS.has(tokens[j]); j += 1) {
        if (tokens[j].startsWith('-i')) inPlace = true;
        else if (!isFlag(tokens[j])) args.push(tokens[j]);
        last = j;
      }
      if (inPlace) {
        // First non-flag arg is the script; the rest are files.
        for (const file of args.slice(1)) addTarget(file);
      }
      i = last;
      continue;
    }

    if (WRITE_COMMANDS.has(cmd)) {
      let sawAny = false;
      let last = i;
      for (let j = i + 1; j < tokens.length && !SEPARATORS.has(tokens[j]); j += 1) {
        if (!isFlag(tokens[j])) {
          addTarget(tokens[j]);
          sawAny = true;
        }
        last = j;
      }
      if (cmd === 'rm' && !sawAny) broadWrite = true;
      i = last;
      continue;
    }
  }

  return { paths, broadWrite };
}
