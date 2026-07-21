// guards.mjs — gate guard, reservation guard, privacy/scout read guard,
// and bash write-target extraction. Used by the write-guard hook and helpers.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { findConflicts, findSessionConflicts, reservationsPath } from './reservations.mjs';
import { readConfig, resolvePipeline, resolveRoots } from './state.mjs';
// xwh-4: cross-worktree foreign-hold consultation. worktree-holds.mjs imports
// only fsutil/lock/reservations.mjs — no cycle (same discipline cells.mjs's
// own findForeignHolds import documents).
import { findForeignHolds, holdsStoreCorrupt } from './worktree-holds.mjs';

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

// docs/history/ is the tech-agnostic KNOWLEDGE layer (.md only: CONTEXT.md,
// plan.md, reports, walkthrough). Executable/code files (a verify.sh, a helper
// script) never belong there — a persistent verify script lives in the project's
// own scripts (committed with the product), a disposable proof in .bee/spikes/.
// GitHub #17: agents were dropping verify.sh scripts into docs/history/<feature>/.
const HISTORY_CODE_EXTENSIONS = new Set([
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  '.mjs', '.cjs', '.js', '.jsx', '.ts', '.tsx',
  '.py', '.rb', '.go', '.rs', '.java', '.php', '.pl', '.lua', '.r',
]);
function docsHistoryCodeDeny(normalized) {
  if (!normalized.startsWith('docs/history/')) return null;
  const dot = normalized.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = normalized.slice(dot).toLowerCase();
  return HISTORY_CODE_EXTENSIONS.has(ext) ? ext : null;
}

// ─── scratch-shape guard (tree-hygiene D4/D5, cell th-6) ───────────────────
// One canonical scratch home (docs/specs/doctrine-layer.md Business Rules,
// decision f21efe6e): every ephemeral file bee writes for its own working
// purposes belongs in .bee/tmp/<feature-or-session>/ (feasibility code in
// .bee/spikes/<feature>/), never a tracked path. This denies a write whose
// TARGET NAME looks scratch-shaped when it lands anywhere else in the
// tracked tree — first-hit, same precedence class as direct-edit and
// docs-history-code above.
//
// The hard requirement (plan-review, decision f21efe6e): a FALSE DENY on a
// real deliverable is worse than the garbage this guard prevents. Two
// independent safety nets keep this rule narrow:
//   1. An explicit allow-list runs BEFORE any shape pattern is even
//      evaluated: the scratch homes themselves, and every known deliverable
//      store (docs/**, .bee/cells/, .bee/decisions.jsonl, the four rendered
//      plugin skill trees). Nothing under these paths is ever denied here,
//      no matter how scratch-shaped its basename looks.
//   2. The shape patterns themselves are deliberately narrow band, chosen so
//      a real project source/test file is unlikely to collide:
//        - SCRATCH_DOTFILE_RE only matches a basename that STARTS WITH "."
//          and contains debug/stress/scratch — the exact shape of the crash
//          leak this feature was filed over (.rel1710rc3_stress_debug.sh).
//          Committed project sources are essentially never dot-prefixed.
//        - SCRATCH_PREFIX_RE only matches a basename STARTING WITH
//          verdict-/probe-/digest- — bee's own scratch vocabulary, not
//          plausible deliverable naming.
//        - SCRATCH_EXT_RE (bare .tmp/.log/.bak) is the one genuinely
//          ambiguous shape — a project can legitimately commit a fixture
//          named `sample.log` or `snapshot.bak` for a test. This is the ONE
//          pattern additionally exempted whenever the path runs through a
//          recognized test/fixture directory segment (test/, tests/,
//          __tests__/, fixtures/, __fixtures__/, testdata/, examples/) — a
//          project's own `foo.log`-named source/test file is not bee
//          scratch, and this is how that distinction is drawn: by directory
//          convention, not by guessing intent from the extension alone.
const SCRATCH_HOME_PREFIXES = ['.bee/tmp/', '.bee/spikes/', '.bee/logs/', '.bee/workers/'];
// Deliverable stores that must never be false-denied: docs/** (reports,
// specs, decisions, backlog), the cell store, the decisions ledger, and the
// four rendered plugin skill trees (scripts/render_plugin_skill_trees.mjs
// TARGET_ROOTS + the two skills/ mirrors onboarding also keeps in sync).
const DELIVERABLE_PREFIXES = [
  'docs/',
  '.bee/cells/',
  '.claude-plugin/skills/',
  '.codex-plugin/skills/',
  '.claude/skills/',
  '.agents/skills/',
];
const DELIVERABLE_EXACT = new Set(['.bee/decisions.jsonl']);
const TEST_FIXTURE_DIR_RE = /(^|\/)(test|tests|__tests__|fixtures|__fixtures__|testdata|examples)(\/|$)/i;
const SCRATCH_EXT_RE = /\.(tmp|log|bak)$/i;
const SCRATCH_DOTFILE_RE = /^\.[^/]*(?:debug|stress|scratch)[^/]*$/i;
const SCRATCH_PREFIX_RE = /^(?:verdict|probe|digest)-/i;

function underAnyPrefix(normalized, prefixes) {
  return prefixes.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
}

// Returns a short kind string when `normalized` is a scratch-shaped write
// landing outside every allowed home/deliverable, else null.
function scratchShapeDeny(normalized) {
  if (underAnyPrefix(normalized, SCRATCH_HOME_PREFIXES)) return null;
  if (DELIVERABLE_EXACT.has(normalized)) return null;
  if (underAnyPrefix(normalized, DELIVERABLE_PREFIXES)) return null;

  const basename = normalized.slice(normalized.lastIndexOf('/') + 1);
  if (SCRATCH_DOTFILE_RE.test(basename)) return 'a dotfile named like a debug/stress/scratch script';
  if (SCRATCH_PREFIX_RE.test(basename)) return 'a verdict-/probe-/digest- style scratch payload';
  if (SCRATCH_EXT_RE.test(basename) && !TEST_FIXTURE_DIR_RE.test(normalized)) {
    return `a ${basename.slice(basename.lastIndexOf('.'))} scratch file`;
  }
  return null;
}

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
  '.bee/state.json': 'bee.mjs state set --owner <selected pre-mutation phase>, or the dedicated state gate/worker/scribing-run verb',
  '.bee/backlog.jsonl': 'bee.mjs backlog add',
  // xwh-4: the cross-worktree coordination stores are CLI-owned too — the
  // holds ledger is mirrored/released only by bee.mjs reservations (xwh-2)
  // and the grant registry only by bee.mjs worktree register/unregister. A
  // hand edit bypasses the store lock and the atomic tmp+rename write both
  // stores rely on (worktree-holds.mjs / worktree-store.mjs).
  '.bee/runtime/cross-worktree-holds.json':
    'bee.mjs reservations reserve/release (holds are mirrored into the ledger automatically)',
  '.bee/runtime/worktree-grants.json': 'bee.mjs worktree register / unregister',
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

// ─── intake-gate refusal message (D3, ige-2 / P46 / GH #1) ────────────────
// One shared builder for every terminal-phase ("intake gate") refusal —
// plain source writes AND the git-command denials below all funnel through
// this, so the wording fix applies everywhere the operator can hit it, not
// just the git path the incident happened to use. D3: the FIX line names the
// bookkeeping-direct-commit route and bee-hive FIRST; `guards.idle_gate` is
// mentioned LAST, as a repo-level opt-out, never as the way to finish a
// commit — the previous ordering pointed the operator straight at the
// dangerous escape, which is exactly how the incident (a7d2069) happened.
function intakeFixLine() {
  return (
    `FIX: commit or write bookkeeping directly — ${GATE_ALLOWED_PREFIXES.join(', ')} are exempt from this gate — ` +
    'or route the request through bee-hive first (classify the mode; tiny fixes stay tiny — one cell, a 2-minute ' +
    'reality check, Gate 3, go), then execute. Last resort, repo-level opt-out: ' +
    'bee config set --key guards.idle_gate --value false (re-enable with: bee config unset --key guards.idle_gate).'
  );
}

function intakeRefusal(phase, blockedDescription, extraSentence = '') {
  return (
    `bee intake gate: no bee work is active (phase: ${phase}) — ${blockedDescription} is blocked. ` +
    extraSentence +
    intakeFixLine()
  );
}

// Resolves the effective phase/gate record for a write decision: a bound
// sessionId reads through resolvePipeline's lane record; an absent one uses
// the caller's own `state` (byte-identical to the pre-fsh-8 checkWrite
// contract). An unresolvable lane binding is a typed deny, never a silent
// fallback to the default pipeline. Shared by checkWrite and
// checkGitBashCommand so both apply the SAME phase/lane semantics.
function resolveWriteRecord(root, state, sessionId) {
  if (typeof sessionId === 'string' && sessionId.trim()) {
    const resolved = resolvePipeline(root, { sessionId });
    if (!resolved.ok) {
      return { ok: false, reason: `bee lane guard: ${resolved.reason}` };
    }
    return { ok: true, record: resolved.record };
  }
  return { ok: true, record: state };
}

// ─── git write-exemption classification (D1/D3/D4, ige-2 / P46 / GH #1) ───
// Read-only git subcommands, deliberately enumerated — never inferred. Two
// of these are read-only ONLY with a specific flag: a bare `git branch
// <name>` / `git tag <name>` MUTATES (creates), so they must not match here
// without --list; `git remote` similarly needs -v/--verbose to be read-only.
const GIT_READONLY_SUBCOMMANDS = new Set([
  'status', 'log', 'diff', 'show', 'rev-parse', 'ls-files', 'check-ignore',
  'merge-base', 'rev-list', 'describe', 'blame', 'cat-file',
]);
const GIT_READONLY_FLAG_GATED = {
  branch: new Set(['--list']),
  tag: new Set(['--list']),
  remote: new Set(['-v', '--verbose']),
};

// Mutating git subcommands this exemption logic recognizes at all (D1).
// `push` is deliberately NOT a member — it never gets the bookkeeping-path
// exemption (outward-facing) and is classified separately below. Anything
// NOT in this set and NOT read-only is "unrecognized" and refused at a
// terminal phase rather than silently allowed through (fail closed).
const GIT_MUTATING_SUBCOMMANDS = new Set([
  'commit', 'add', 'rm', 'mv', 'checkout', 'restore',
  'tag', 'merge', 'reset', 'stash', 'clean', 'apply', 'cherry-pick', 'revert', 'rebase',
]);
// Subset of GIT_MUTATING_SUBCOMMANDS whose changed paths this classifier can
// actually resolve from real git state (D4). The rest (merge/reset/stash/
// clean/apply/cherry-pick/revert/rebase/tag) are structural/broad operations
// with no reliable pathspec model here — they always fail closed (today's
// refusal), never inferred safe just because they're "recognized".
const GIT_PATH_RESOLVABLE_SUBCOMMANDS = new Set(['commit', 'add', 'rm', 'mv', 'checkout', 'restore']);
const GIT_BROAD_PATHSPECS = new Set(['.', ':', ':/', './']);

function gitGlobalFlagTakesValue(token) {
  return token === '-C' || token === '-c' || token === '--git-dir' || token === '--work-tree' || token === '--namespace';
}

// Finds the FIRST top-level `git <subcommand>` invocation in `command`
// (skipping git's own global flags, e.g. `-C <dir>`), returning
// { subcommand, rest } — `subcommand` is null for a bare "git" with no
// subcommand token at all — or null when `command` contains no `git`
// invocation whatsoever. Only the first invocation is classified; a compound
// command chaining a SECOND git call is a documented limitation of this cell.
function findGitInvocation(tokens) {
  for (let i = 0; i < tokens.length; i += 1) {
    if (SEPARATORS.has(tokens[i])) continue;
    const cmd = tokens[i].replace(/\\/g, '/').split('/').pop();
    if (cmd !== 'git') continue;
    let end = i + 1;
    while (end < tokens.length && !SEPARATORS.has(tokens[end])) end += 1;
    const invocationTokens = tokens.slice(i + 1, end);
    let subcommand = null;
    let subIdx = -1;
    for (let j = 0; j < invocationTokens.length; j += 1) {
      const t = invocationTokens[j];
      if (gitGlobalFlagTakesValue(t)) { j += 1; continue; }
      if (t.startsWith('-')) continue;
      subcommand = t;
      subIdx = j;
      break;
    }
    if (subcommand === null) return { subcommand: null, rest: [] };
    return { subcommand, rest: invocationTokens.slice(subIdx + 1) };
  }
  return null;
}

function runGitCapture(cwd, args) {
  try {
    const out = execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

function hasGitShortFlag(tokens, letter) {
  return tokens.some((t) => /^-[a-zA-Z]+$/.test(t) && t.slice(1).includes(letter));
}

// Explicit pathspec args: everything after a literal `--`, or (when no `--`
// is present) every non-flag token. Used for add/rm/mv/checkout/restore,
// whose syntax is `git <verb> [flags] [--] <pathspec>...` — a pathspec here
// is exactly what the command names, nothing inferred.
function extractExplicitPathspecs(restTokens) {
  const dashDashIdx = restTokens.indexOf('--');
  const scanTokens = dashDashIdx === -1 ? restTokens : restTokens.slice(dashDashIdx + 1);
  if (dashDashIdx === -1) return scanTokens.filter((t) => !t.startsWith('-'));
  return scanTokens;
}

/**
 * Resolves the repo-relative paths a mutating git subcommand would actually
 * change, from REAL git state at check time (D4) — never from the command's
 * wording, a flag, or an env var. Returns null when the set cannot be proved
 * (a broad/glob pathspec, no pathspec at all where one is required, or the
 * git call itself failed) — the caller fails closed on null, exactly like a
 * proved source path.
 *
 * `commit`: a pathspec is only ever recognized AFTER a literal `--`
 * (git's own disambiguator) — never a bare trailing token, because a bare
 * trailing token after `-m`/`-c`/etc. is that flag's VALUE (the commit
 * message), not a pathspec; treating it as one would let a message's wording
 * masquerade as a path, which D4 forbids. No `--` pathspec -> resolves to the
 * STAGED index (`git diff --cached --name-only`); `-a`/`--all` (or a short
 * flag containing 'a', e.g. `-am`) folds in tracked-but-unstaged paths too.
 */
function resolveGitMutationPaths(cwd, subcommand, restTokens) {
  if (subcommand === 'commit') {
    const dashDashIdx = restTokens.indexOf('--');
    const explicitPathspecs = dashDashIdx === -1 ? [] : restTokens.slice(dashDashIdx + 1);
    const preDashDash = dashDashIdx === -1 ? restTokens : restTokens.slice(0, dashDashIdx);
    const isAll = hasGitShortFlag(preDashDash, 'a') || preDashDash.includes('--all');

    const staged = runGitCapture(cwd, ['diff', '--cached', '--name-only']);
    if (staged === null) return null;

    if (explicitPathspecs.length > 0) {
      if (explicitPathspecs.some((p) => GIT_BROAD_PATHSPECS.has(p) || p.includes('*'))) return null;
      return explicitPathspecs;
    }
    if (!isAll) return staged;
    const unstaged = runGitCapture(cwd, ['diff', '--name-only']);
    if (unstaged === null) return null;
    return Array.from(new Set([...staged, ...unstaged]));
  }

  // add / rm / mv / checkout / restore: resolve to literal pathspec args.
  const pathspecs = extractExplicitPathspecs(restTokens);
  if (pathspecs.length === 0) return null; // bare/flags-only invocation: unprovable
  if (pathspecs.some((p) => GIT_BROAD_PATHSPECS.has(p) || p.includes('*'))) return null; // broad/glob: unprovable
  return pathspecs;
}

/**
 * Git-command awareness for the intake gate (D1/D3/D4, ige-2 / P46 / GH #1).
 * Scoped ONLY to the terminal-phase intake gate — D1 says "while the phase
 * is terminal", and the Boundary this cell shipped under is explicit that
 * nothing here may reopen the gate's actual purpose. Outside a terminal
 * phase (gated phases, swarming, ...), this returns null unconditionally and
 * the caller's existing Bash-target logic is completely unaffected — the
 * fix stays confined to the one door the incident (a7d2069) walked through.
 *
 * Returns:
 *   null                          — not a git command, phase isn't
 *                                    terminal, or the idle gate is disabled:
 *                                    caller's existing logic decides.
 *   { allow: true, kind }         — read-only git, or a mutating git command
 *                                    whose actually-changed paths are ALL
 *                                    inside GATE_ALLOWED_PREFIXES.
 *   { allow: false, kind, reason } — `git push` (never exempt), an
 *                                    unrecognized subcommand (fail closed),
 *                                    or a mutating command touching a
 *                                    non-bookkeeping path (today's refusal).
 */
export function checkGitBashCommand(root, state, command, { cwd = root, sessionId = null } = {}) {
  const recordResolution = resolveWriteRecord(root, state, sessionId);
  if (!recordResolution.ok) {
    return { allow: false, kind: 'lane', reason: recordResolution.reason };
  }
  const phase = recordResolution.record?.phase || 'idle';
  if (!TERMINAL_PHASES.has(phase)) return null;

  const config = readConfig(root);
  const idleGateOn = !(config.guards && config.guards.idle_gate === false);
  if (!idleGateOn) return null;

  const tokens = tokenize(command);
  const invocation = findGitInvocation(tokens);
  if (!invocation) return null;
  const { subcommand, rest } = invocation;

  if (subcommand && GIT_READONLY_SUBCOMMANDS.has(subcommand)) {
    return { allow: true, kind: 'git-read-only' };
  }
  if (subcommand && GIT_READONLY_FLAG_GATED[subcommand] && rest.some((t) => GIT_READONLY_FLAG_GATED[subcommand].has(t))) {
    return { allow: true, kind: 'git-read-only' };
  }

  if (subcommand === 'push') {
    return {
      allow: false,
      kind: 'git-push',
      reason: intakeRefusal(
        phase,
        '`git push`',
        'git push is outward-facing and is never exempted from this gate, regardless of what it would push. ',
      ),
    };
  }

  if (subcommand && GIT_MUTATING_SUBCOMMANDS.has(subcommand)) {
    const resolvedPaths = GIT_PATH_RESOLVABLE_SUBCOMMANDS.has(subcommand)
      ? resolveGitMutationPaths(cwd, subcommand, rest)
      : null;
    if (resolvedPaths === null) {
      return {
        allow: false,
        kind: 'intake',
        reason: intakeRefusal(phase, `running \`git ${subcommand}\` (its changed paths could not be proved bookkeeping-only)`),
      };
    }
    const offending = resolvedPaths.map(normalizeRel).find((p) => !underAllowedPrefix(p));
    if (offending) {
      return {
        allow: false,
        kind: 'intake',
        reason: intakeRefusal(phase, `running \`git ${subcommand}\` — it would change "${offending}"`),
      };
    }
    return { allow: true, kind: 'git-bookkeeping' };
  }

  return {
    allow: false,
    kind: 'git-unrecognized',
    reason: intakeRefusal(
      phase,
      `running \`git ${subcommand || command.trim()}\``,
      'This git subcommand is not recognized as read-only or as a modeled bookkeeping-eligible mutation, so it is refused rather than assumed safe. ',
    ),
  };
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

/** Same expiry-string convention as holdExpiry above, rebased on a
 * cross-worktree ledger hold's `mirrored_at`/`ttl_seconds` fields (same shape
 * bee.mjs's holdForeignExpiry uses for its own list rendering). */
function foreignHoldExpiry(hold) {
  const mirroredMs = Date.parse(hold?.mirrored_at);
  const ttl = hold?.ttl_seconds;
  if (!Number.isFinite(mirroredMs) || !Number.isFinite(ttl) || ttl <= 0) return 'no expiry';
  return `expires ${new Date(mirroredMs + ttl * 1000).toISOString()}`;
}

// xwh-4: resolves the cross-worktree HOLD topology for the write guard —
// same shape/naming as cells.mjs's resolveHoldTopology (xwh-3), rebased on
// the `root` checkWrite already carries (the guard is a library call whose
// `root` IS the checkout being written to, exactly like claim-next). Returns
// `{ mainRoot, holder }` for the two topologies worth consulting:
//   - an ORDINARY checkout: holder = 'main', mainRoot = the checkout itself.
//   - a GRANTED linked worktree (its own storeRoot === its own worktreeRoot,
//     i.e. resolveRoots did NOT fall back to main): holder = its
//     git-verified id, mainRoot = resolveRoots' own `mainRoot`.
// Returns `null` for every other case — an UNGRANTED linked worktree
// (storeRoot === mainRoot already: the shared main store's same-checkout
// reservation guards above already govern it directly) and an
// unresolvable/invalid checkout (resolveRoots threw) both fall through to
// `null`, which checkWrite treats as "skip the foreign-hold consultation
// entirely, byte-identical to before this cell" — FAIL-OPEN, never a deny.
// An over-denying write guard can lock every session out of its own fix
// (critical pattern 20260716), so no error path in this resolution may deny.
function resolveHoldTopology(root) {
  let resolution;
  try {
    resolution = resolveRoots(root);
  } catch {
    return null;
  }
  if (resolution.worktreeResolution === 'ordinary') {
    return { mainRoot: resolution.workRoot || root, holder: 'main' };
  }
  if (resolution.worktreeResolution === 'linked-valid' && resolution.mainRoot && resolution.id) {
    const granted =
      resolution.storeRoot && resolution.worktreeRoot && path.resolve(resolution.storeRoot) === path.resolve(resolution.worktreeRoot);
    if (granted) {
      return { mainRoot: resolution.mainRoot, holder: resolution.id };
    }
  }
  return null;
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
 *   Disable per repo with: bee config set --key guards.idle_gate --value false
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
 * - Cross-WORKTREE hold deny (xwh-4): right after the cross-session block,
 *   before every phase branch, and NOT gated on sessionId — checkout
 *   identity comes from resolveHoldTopology(root) (ordinary => 'main',
 *   granted worktree => its git-verified id). A path ledger-held by a
 *   DIFFERENT checkout denies with kind 'worktree-hold' naming the holding
 *   checkout, its feature, and the expiry. Own holds, expired/released
 *   holds, and a missing ledger never deny; unresolvable/ungranted topology
 *   skips the consultation entirely (fail-open). The one deny on a broken
 *   store: a present-but-corrupt ledger => typed
 *   {allow:false, kind:'worktree-holds-unreadable'} (holdsStoreCorrupt).
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

  const historyCodeExt = docsHistoryCodeDeny(normalized);
  if (historyCodeExt) {
    return {
      allow: false,
      kind: 'docs-history-code',
      reason:
        `bee docs-history guard: "${normalized}" writes a "${historyCodeExt}" code file into docs/history/, which is ` +
        'the tech-agnostic KNOWLEDGE layer (.md only — CONTEXT.md, plan.md, reports, walkthrough). Code never lives there. ' +
        "FIX: put a persistent verify/helper script in the project's own scripts (committed with the product) and point " +
        'the cell\'s verify command at it; put a disposable proof in .bee/spikes/<feature>/. Never docs/history.',
    };
  }

  const scratchKind = scratchShapeDeny(normalized);
  if (scratchKind) {
    return {
      allow: false,
      kind: 'scratch-shape',
      reason:
        `bee scratch-shape guard: "${normalized}" looks like ${scratchKind} landing in a tracked directory. ` +
        'Every ephemeral file bee writes for its own working purposes belongs in .bee/tmp/<feature-or-session>/ ' +
        '(feasibility code in .bee/spikes/<feature>/), never a tracked path (docs/specs/doctrine-layer.md). ' +
        'FIX: write it to .bee/tmp/ instead (or .bee/spikes/ for a feasibility proof), and let `bee tmp sweep` clear it later.',
    };
  }

  const recordResolution = resolveWriteRecord(root, state, sessionId);
  if (!recordResolution.ok) {
    return { allow: false, kind: 'lane', reason: recordResolution.reason };
  }
  const record = recordResolution.record;

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

  // xwh-4: cross-WORKTREE foreign-hold consultation — unconditional on phase
  // and on sessionId, same placement discipline as the cross-session block
  // above (a foreign checkout's hold denies even in swarming with execution
  // approved). Topology unresolvable/ungranted => null => skip entirely
  // (fail-open). The ONE deliberate deny on a broken store is a
  // present-but-unparseable ledger (holdsStoreCorrupt: missing=open,
  // unparseable=deny — reservationStoreCorrupt's exact semantics): silently
  // reading a torn ledger as empty would open every foreign-held path to
  // this checkout. Any other failure inside the consultation itself is
  // swallowed into an allow, never a deny (critical pattern 20260716: an
  // over-denying guard locks the session out of its own fix).
  {
    const topology = resolveHoldTopology(root);
    if (topology) {
      if (holdsStoreCorrupt(topology.mainRoot)) {
        return {
          allow: false,
          kind: 'worktree-holds-unreadable',
          reason:
            'bee cross-worktree hold guard: the shared holds ledger (.bee/runtime/cross-worktree-holds.json ' +
            'in the main checkout) is present but unreadable/corrupt — failing closed rather than silently ' +
            'treating it as empty. FIX: inspect/restore the ledger in the main checkout, then retry.',
        };
      }
      let foreign = [];
      try {
        foreign = findForeignHolds(topology.mainRoot, topology.holder, [normalized]);
      } catch {
        foreign = []; // fail-open: a consultation crash never denies
      }
      if (foreign.length > 0) {
        const hold = foreign[0];
        return {
          allow: false,
          kind: 'worktree-hold',
          reason:
            `bee cross-worktree hold: "${normalized}" is held by checkout "${hold.holder}" ` +
            `(feature ${hold.feature || 'unknown'}${hold.cell ? `, cell ${hold.cell}` : ''}), ${foreignHoldExpiry(hold)}. ` +
            'Wait for the hold to expire or coordinate with that checkout — a cross-worktree hold is a hard block.',
        };
      }
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
        reason: intakeRefusal(phase, `writing "${normalized}"`),
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
// checkAskUserQuestion — turn the harness's opaque "Invalid tool parameters"
// rejection of an AskUserQuestion call into a CLEAR, self-documenting deny that
// names the exact schema violation, so the agent fixes it (and a screenshot
// shows the real cause). Fail-open on any shape we cannot confidently call
// invalid — never block a question we are unsure about.
export function checkAskUserQuestion(toolInput) {
  try {
    const questions =
      toolInput && Array.isArray(toolInput.questions) ? toolInput.questions : null;
    if (!questions) return { allow: true };
    if (questions.length < 1 || questions.length > 4) {
      return {
        allow: false,
        kind: 'ask-schema',
        reason: `bee AskUserQuestion guard: ${questions.length} question(s) — the tool takes 1–4 per call. Split into separate calls.`,
      };
    }
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      if (!q || typeof q !== 'object') continue; // odd shape — fail open
      const where = questions.length > 1 ? ` (question ${i + 1})` : '';
      if (typeof q.header === 'string' && q.header.length > 12) {
        return {
          allow: false,
          kind: 'ask-schema',
          reason: `bee AskUserQuestion guard: header "${q.header}" is ${q.header.length} chars${where} — max 12 (it is a short chip label, not the question). Shorten the header.`,
        };
      }
      if (Array.isArray(q.options)) {
        if (q.options.length < 2 || q.options.length > 4) {
          return {
            allow: false,
            kind: 'ask-schema',
            reason: `bee AskUserQuestion guard: ${q.options.length} option(s)${where} — each question needs 2–4 options (an "Other" free-text choice is added automatically). Fold overflow into a follow-up question.`,
          };
        }
        for (let j = 0; j < q.options.length; j += 1) {
          const o = q.options[j];
          if (!o || typeof o !== 'object') continue;
          if (typeof o.label !== 'string' || !o.label.trim()) {
            return {
              allow: false,
              kind: 'ask-schema',
              reason: `bee AskUserQuestion guard: option ${j + 1}${where} is missing a non-empty "label". Every option needs a label and a description.`,
            };
          }
          if (typeof o.description !== 'string' || !o.description.trim()) {
            return {
              allow: false,
              kind: 'ask-schema',
              reason: `bee AskUserQuestion guard: option "${o.label}"${where} is missing a non-empty "description". Every option needs a label and a description.`,
            };
          }
        }
      }
    }
    return { allow: true };
  } catch {
    return { allow: true }; // fail-open: never block on an unexpected shape
  }
}

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
