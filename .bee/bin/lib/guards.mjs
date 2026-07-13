// guards.mjs — gate guard, reservation guard, privacy/scout read guard,
// and bash write-target extraction. Used by the write-guard hook and helpers.

import fs from 'node:fs';
import path from 'node:path';
import { findConflicts, findSessionConflicts, reservationsPath } from './reservations.mjs';
import { readConfig, resolvePipeline } from './state.mjs';

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
export const GATE_ALLOWED_PREFIXES = ['.bee/', 'docs/', 'plans/', 'AGENTS.md'];

const GATED_PHASES = new Set(['exploring', 'planning', 'validating']);

// Phases where no bee work is active: never started ('idle') and finished
// ('compounding-complete', the terminal alias state.mjs already accepts as an
// idle-equivalent in startFeature). Both must hit the intake gate. Testing
// `phase === 'idle'` alone left every repo default-open the moment a feature
// closed — the gates stay approved from the closed feature, so the gated-phase
// branch never fires either, and source edits for the NEXT piece of work walked
// straight through with nothing blocking them.
const TERMINAL_PHASES = new Set(['idle', 'compounding-complete']);

// Direct hand-edits to these two files are denied in every phase, first-hit,
// before any other checkWrite logic (including GATE_ALLOWED_PREFIXES —
// `.bee/` is an allowed prefix today, so this precedence is mandatory, not
// incidental). Both files now have a validating, atomic-write CLI
// (cli-mutations plan.md: bee.mjs state, bee.mjs backlog) — a direct
// Edit/Write/Bash-redirect bypasses that validation and reintroduces the
// schema-drift class the CLIs exist to close. This does not touch the CLIs'
// own writes: hooks see tool calls (Edit/Write/MultiEdit/Bash), never the
// bee.mjs state / bee.mjs backlog child process's internal file I/O.
const DIRECT_EDIT_DENY = {
  '.bee/state.json': 'bee.mjs state set/gate/worker/scribing-run',
  '.bee/backlog.jsonl': 'bee.mjs backlog add',
};

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
 * Corrupt-vs-missing discriminator for the reservation store (D3 fail-closed
 * shape, panel B1). A MISSING store is today's exact open behavior — nothing
 * has ever reserved anything, so there is nothing to fail closed over. A
 * PRESENT but unparseable store is the one case that must deny rather than
 * silently read as empty: reservations.mjs's own readStore/listReservations/
 * findConflicts/findSessionConflicts stay fail-open (untouched here) because
 * they serve reads and intra-swarm nickname conflicts that must never crash a
 * whole session over one bad file; this session-aware WRITE guard is the one
 * caller that cannot afford to silently treat "corrupt" as "empty" — a stray
 * concurrent-write torn file could otherwise open every held path in the
 * repo to any session. Never called when sessionId is absent (byte-identical
 * to today in that case).
 */
function reservationStoreCorrupt(root) {
  const file = reservationsPath(root);
  if (!fs.existsSync(file)) return false; // missing store = today's open behavior
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
    return false;
  } catch {
    return true;
  }
}

/** Expiry display for a hold-deny message, computed from the reservation's own
 * public fields only (never importing reservations.mjs's private isExpired). */
function holdExpiry(reservation) {
  const reservedMs = Date.parse(reservation?.reserved_at);
  const ttl = reservation?.ttl_seconds;
  if (!Number.isFinite(reservedMs) || !Number.isFinite(ttl) || ttl <= 0) return 'no expiry';
  return `expires ${new Date(reservedMs + ttl * 1000).toISOString()}`;
}

/**
 * Gate + reservation write check.
 * - Direct-edit deny (first hit, every phase): `.bee/state.json` and
 *   `.bee/backlog.jsonl` must go through their CLI (bee.mjs state /
 *   bee.mjs backlog), never a direct Edit/Write/Bash-redirect. Checked before
 *   phase logic and before GATE_ALLOWED_PREFIXES, since `.bee/` is itself an
 *   allowed prefix in gated phases.
 * - Terminal phases (intake gate): 'idle' (never started) and
 *   'compounding-complete' (feature closed) both mean no bee work is active, so
 *   source writes are blocked until the request is routed through bee-hive.
 *   Repository-harness lesson: a default-open first move is the hole every
 *   ad-hoc edit slips through — and "the feature just closed" is a first move.
 *   Disable per repo with {"guards":{"idle_gate":false}} in .bee/config.json.
 * - Gated phases (exploring/planning/validating): block writes outside
 *   GATE_ALLOWED_PREFIXES while approved_gates.execution is false.
 * - Swarming: deny writes that conflict with another agent's reservation
 *   (agent identity from agentName arg or BEE_AGENT_NAME env).
 * - Optional sessionId (fsh-5, D2/D4): when provided, phase and gates come
 *   from resolvePipeline(root, { sessionId }) — a bound session is governed
 *   by its lane record, an unbound/unknown session by the default record.
 *   Absent sessionId is byte-identical to today: the caller's state argument
 *   decides. A binding that cannot resolve (invalid/missing/corrupt lane) is
 *   a typed DENY — a write guard never guesses a broken binding back to the
 *   default pipeline (the wrong pipeline's gates would decide the write).
 * - Cross-session hold deny (fsh-7, D3): also gated on sessionId being
 *   present. Runs right after record resolution and BEFORE every phase-based
 *   branch below (terminal/gated/swarming) — D3 is unconditional on phase, so
 *   a write into a path another LIVE session holds is denied even in
 *   swarming with execution approved, not just in tail-reaching phases. The
 *   acting session's own holds, expired holds, and legacy session-less
 *   reservation rows never block. A present-but-corrupt reservation store
 *   fails closed with a typed {allow:false, kind:'holds-unreadable'} verdict
 *   (never a throw — the production hook is fail-open and would swallow a
 *   throw into an allow); a missing store stays open, same as today.
 */
export function checkWrite(root, state, relPath, agentName = null, { sessionId = null } = {}) {
  const normalized = normalizeRel(relPath);

  const directEditVerb = DIRECT_EDIT_DENY[normalized];
  if (directEditVerb) {
    return {
      allow: false,
      kind: 'direct-edit',
      reason:
        `bee direct-edit guard: "${normalized}" is CLI-owned — direct edits are blocked in every phase. ` +
        'Hand-edited state files reintroduce schema drift (the exact class the CLI validates away). ' +
        `FIX: use ${directEditVerb} instead of editing this file directly.`,
    };
  }

  let record = state;
  if (typeof sessionId === 'string' && sessionId.trim()) {
    const resolved = resolvePipeline(root, { sessionId });
    if (!resolved.ok) {
      return {
        allow: false,
        kind: 'lane',
        reason: `bee lane guard: ${resolved.reason}`,
      };
    }
    record = resolved.record;
  }

  if (typeof sessionId === 'string' && sessionId.trim()) {
    const acting = sessionId.trim();
    if (reservationStoreCorrupt(root)) {
      return {
        allow: false,
        kind: 'holds-unreadable',
        reason:
          `bee hold guard: the reservation store (${path.relative(root, reservationsPath(root))}) is present but ` +
          'unreadable/corrupt — failing closed for a session-aware write rather than silently treating it as empty. ' +
          'FIX: inspect/restore the reservation store, then retry.',
      };
    }
    const holdConflicts = findSessionConflicts(root, acting, [normalized]);
    if (holdConflicts.length > 0) {
      const holder = holdConflicts[0];
      return {
        allow: false,
        kind: 'hold',
        reason:
          `bee cross-session hold: "${normalized}" is held by session "${holder.session}" ` +
          `(agent ${holder.agent}, cell ${holder.cell}), ${holdExpiry(holder)}. ` +
          'Wait for the hold to expire or coordinate with that session — a cross-session hold is a hard block (D3).',
      };
    }
  }

  const phase = record?.phase || 'idle';

  if (TERMINAL_PHASES.has(phase)) {
    const config = readConfig(root);
    const idleGateOn = !(config.guards && config.guards.idle_gate === false);
    if (idleGateOn && !underAllowedPrefix(normalized)) {
      return {
        allow: false,
        kind: 'intake',
        reason:
          `bee intake gate: no bee work is active (phase: ${phase}) — writing "${normalized}" is blocked. ` +
          'Route the request through bee-hive first: classify the mode (tiny fixes stay tiny — one cell, ' +
          'a 2-minute reality check, Gate 3, go), then execute. ' +
          `Writable without routing: ${GATE_ALLOWED_PREFIXES.join(', ')}. ` +
          'To disable this gate for the repo: set {"guards":{"idle_gate":false}} in .bee/config.json.',
      };
    }
    return { allow: true };
  }

  if (GATED_PHASES.has(phase)) {
    const executionApproved = record?.approved_gates?.execution === true;
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

    // Redirection: "> file", ">> file", ">file", "2> file".
    // NOT a file write: fd-duplication like `2>&1`, `1>&2`, `>&2` — the target
    // starts with `&` (a file descriptor, not a filename). Treating `&1` as a
    // write blocked read-only commands at idle (guards.mjs bug, decision 0014).
    const redirect = token.match(/^\d?>{1,2}(.*)$/);
    if (redirect) {
      const inline = redirect[1];
      if (inline) {
        if (!inline.startsWith('&')) addTarget(inline);
      } else if (
        tokens[i + 1] &&
        !SEPARATORS.has(tokens[i + 1]) &&
        !tokens[i + 1].startsWith('&')
      ) {
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
