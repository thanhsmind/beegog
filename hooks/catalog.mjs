// hooks/catalog.mjs — the single logical hook catalog for bee's runtime
// parity (cell codex-parity-2, docs/history/codex-runtime-parity/approach.md
// section 1 "Plugin-first distribution and one active source", decisions
// D1/D2 in CONTEXT.md).
//
// hooks/hooks.json is rendered from this catalog as the CODEX default
// projection: the Codex plugin manifest (.codex-plugin/plugin.json) omits an
// explicit "hooks" path and Codex loads hooks/hooks.json from its default
// plugin-root location (approach.md: "Make hooks/hooks.json the Codex
// default projection so the Codex manifest can omit a redundant hooks
// field."). hooks/claude-hooks.json is rendered as the CLAUDE projection and
// is wired explicitly by .claude-plugin/plugin.json's "hooks" field — the
// two projections and that manifest switch land in one atomic commit (P1
// repair, plan-review.md) so no intermediate state leaves Claude consuming
// the Codex projection.
//
// Exactly one difference is currently allowed between the two rendered
// projections (approach.md section 2: "Keep model-tier guard in the Claude
// projection because Codex does not expose collaboration spawn through
// PreToolUse."): the Agent|Task -> bee-model-guard.mjs rule renders
// Claude-only. Every other rule renders byte-identically into both files.
// No wrapper .mjs is forked per runtime — only this catalog's projection
// output differs; see ALLOWED_DIFFERENCES and the drift-check test in
// hooks/test_hook_contracts.mjs.
//
// Version-parity guard and publisher metadata (BEE_VERSION, both plugin
// manifests' "version"/publisher fields) are explicitly OUT of scope here —
// they belong to the Distribution slice (approach.md "Likely Files" item 3).

export const RUNTIMES = Object.freeze({ CLAUDE: "claude", CODEX: "codex" });

// A projection is rendered for a TARGET as well as a runtime (cell
// codex-parity-6a):
//
//   "plugin" (DEFAULT) — the hook file ships inside the plugin root, so the
//     host exports ${CLAUDE_PLUGIN_ROOT} and the command resolves against it.
//     This is what hooks/hooks.json and hooks/claude-hooks.json are rendered
//     as; keeping it the default is what makes those two checked-in
//     projections, and every existing caller, byte-identical across this cell.
//
//   "repo" — the SOURCE-REPOSITORY fallback (.codex/hooks.json). Codex loads
//     a project's own .codex/hooks.json with NO plugin root exported, and the
//     old hand-authored file resolved through "$CLAUDE_PROJECT_DIR" — a
//     Claude-only variable that Codex never sets (0 occurrences in the shipped
//     Codex binary). With it unset the command collapsed to
//     `node /.bee/bin/hooks/bee-state-sync.mjs` and every hook died with
//     MODULE_NOT_FOUND (docs/history/codex-runtime-parity/reports/
//     diagnosis-codex-stop-hooks.md). The repo target instead resolves the git
//     root from Codex's session cwd, which the official hooks contract
//     guarantees (decision d91a8398) and which Codex's `$SHELL -lc` command
//     runner makes possible.
export const TARGETS = Object.freeze({ PLUGIN: "plugin", REPO: "repo" });

const BOTH = Object.freeze([RUNTIMES.CLAUDE, RUNTIMES.CODEX]);
const CLAUDE_ONLY = Object.freeze([RUNTIMES.CLAUDE]);

// The PINNED fail-open diagnostic for the repo transport. It goes to STDERR
// and the command writes NOTHING to stdout: stdout on a Stop hook must parse
// as a JSON systemMessage, so a diagnostic on stdout would break that same
// command. Fail-open must be VISIBLE, never silent (spec R2) — a bare
// `[ -n "$r" ] || exit 0` is silent and violates it. Cell codex-parity-6b
// asserts this literal mechanically; do not paraphrase it.
export const REPO_TRANSPORT_UNAVAILABLE_DIAGNOSTIC =
  "bee: hook transport unavailable (no git root)";

// Pre-wrapper transport setup for the repo target: resolve the git root from
// the session cwd. `git rev-parse` fails the same way whether git is absent
// from PATH or the cwd is not a repository — both leave $r empty, both take
// the visible fail-open arm (exit 0), and NEITHER reaches node. That arm is
// load-bearing, not decorative: without it, the same command in a non-git cwd
// crashes with exactly the MODULE_NOT_FOUND this cell repairs.
function repoCommand(script) {
  return [
    'r="$(git rev-parse --show-toplevel 2>/dev/null)"',
    `[ -n "$r" ] || { echo "${REPO_TRANSPORT_UNAVAILABLE_DIAGNOSTIC}" >&2; exit 0; }`,
    `exec node "$r"/hooks/${script} --source=repo`,
  ].join("\n");
}

function commandFor(script, target) {
  if (target === TARGETS.REPO) return repoCommand(script);
  return `node "\${CLAUDE_PLUGIN_ROOT}/hooks/${script}"`;
}

// Catalog entries carry the logical (script, statusMessage) pair; the concrete
// command string is a function of the TARGET and is produced only at render
// time. Nothing in the catalog is hand-authored per runtime or per target.
function cmd(script, statusMessage) {
  return { script, statusMessage };
}

// One entry per lifecycle event bee wires today. `groups` is the ordered
// list of hook-group objects that event carries in the checked-in hooks.json
// shape (each optionally matcher-scoped); each group's `runtimes` says which
// projection(s) render it.
const CATALOG = Object.freeze([
  {
    event: "SessionStart",
    groups: [
      {
        runtimes: BOTH,
        matcher: "startup|resume|clear|compact",
        hooks: [cmd("bee-session-init.mjs", "bee: session bootstrap")],
      },
    ],
  },
  {
    event: "UserPromptSubmit",
    groups: [
      {
        runtimes: BOTH,
        hooks: [cmd("bee-prompt-context.mjs", "bee: phase reminder")],
      },
    ],
  },
  {
    event: "PreToolUse",
    groups: [
      {
        runtimes: BOTH,
        matcher: "Edit|Write|MultiEdit|Bash|Read|Glob|Grep",
        hooks: [cmd("bee-write-guard.mjs", "bee: write guard")],
      },
      {
        runtimes: CLAUDE_ONLY,
        matcher: "Agent|Task",
        hooks: [cmd("bee-model-guard.mjs", "bee: model-tier guard")],
      },
    ],
  },
  {
    event: "PostToolUse",
    groups: [
      {
        runtimes: BOTH,
        matcher: "TaskCreate|TaskUpdate|TodoWrite",
        hooks: [cmd("bee-state-sync.mjs", "bee: state sync")],
      },
    ],
  },
  {
    event: "SubagentStop",
    groups: [
      {
        runtimes: BOTH,
        hooks: [
          cmd("bee-state-sync.mjs", "bee: state sync"),
          cmd("bee-chain-nudge.mjs", "bee: chain nudge"),
        ],
      },
    ],
  },
  {
    event: "PreCompact",
    groups: [
      {
        runtimes: BOTH,
        hooks: [cmd("bee-session-close.mjs", "bee: pre-compact flush check")],
      },
    ],
  },
  {
    event: "Stop",
    groups: [
      {
        runtimes: BOTH,
        hooks: [
          cmd("bee-state-sync.mjs", "bee: state sync"),
          cmd("bee-session-close.mjs", "bee: session close check"),
        ],
      },
    ],
  },
]);

function assertRuntime(runtime) {
  if (runtime !== RUNTIMES.CLAUDE && runtime !== RUNTIMES.CODEX) {
    throw new Error(
      `catalog.mjs renderProjection: unknown runtime "${runtime}" (expected "claude" or "codex")`,
    );
  }
}

function assertTarget(target) {
  if (target !== TARGETS.PLUGIN && target !== TARGETS.REPO) {
    throw new Error(
      `catalog.mjs renderProjection: unknown target "${target}" (expected "plugin" or "repo")`,
    );
  }
}

// Render one projection ("claude" | "codex") for one target ("plugin" |
// "repo") as the plain hooks.json object — no runtime/target metadata leaks
// into the output, only the matcher/hooks shape Claude Code and Codex both
// already load. `plugin` is the DEFAULT target, so every pre-existing caller
// (and both checked-in plugin projections) render exactly as before.
export function renderProjection(runtime, { target = TARGETS.PLUGIN } = {}) {
  assertRuntime(runtime);
  assertTarget(target);
  const hooks = {};
  for (const { event, groups } of CATALOG) {
    const rendered = groups
      .filter((g) => g.runtimes.includes(runtime))
      .map((g) => {
        const out = {};
        if (g.matcher !== undefined) out.matcher = g.matcher;
        out.hooks = g.hooks.map((h) => ({
          type: "command",
          command: commandFor(h.script, target),
          statusMessage: h.statusMessage,
        }));
        return out;
      });
    if (rendered.length > 0) hooks[event] = rendered;
  }
  return { hooks };
}

// Deterministic, byte-stable JSON text for a projection: 2-space indent plus
// exactly one trailing newline — matches the checked-in file formatting
// exactly, so the drift-check test can compare rendered text to disk
// byte-for-byte.
export function renderProjectionText(runtime, { target = TARGETS.PLUGIN } = {}) {
  return `${JSON.stringify(renderProjection(runtime, { target }), null, 2)}\n`;
}

// The full set of event names the catalog defines, in declaration order.
export const EVENTS = Object.freeze(CATALOG.map((entry) => entry.event));

// The approved differences between the two rendered projections. Anything
// not covered here is drift and must fail the drift-check test in
// hooks/test_hook_contracts.mjs.
export const ALLOWED_DIFFERENCES = Object.freeze([
  {
    id: "model-tier-guard-claude-only",
    event: "PreToolUse",
    matcher: "Agent|Task",
    description:
      'bee-model-guard.mjs (PreToolUse matcher "Agent|Task") is Claude-only: ' +
      "Codex does not expose collaboration spawn through PreToolUse " +
      "(approach.md section 2; CONTEXT.md decisions D1/D2).",
  },
]);
