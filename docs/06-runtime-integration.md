# 06 — Runtime Integration: The Automation Skeleton

bee supports **two first-class runtimes**. Neither is a port of the other:

- **Claude Code** gets a *hook-driven automation skeleton* (learned from claudekit): the workflow chain, gates, reservations, and state are enforced and refreshed *mechanically* by lifecycle hooks, not by hoping the model remembers.
- **Codex** gets the *helper-enforced skeleton* (learned from khuym): the same rules are enforced inside the vendored CLI (`bee.mjs`) plus the AGENTS.md block and compact-prompt recovery instructions.

The principle that makes dual-runtime cheap: **enforcement lives in the shared helpers first; hooks are a second belt, not the only belt.** `bee.mjs cells cap` refusing to cap an unverified cell works identically on both runtimes. A hook that blocks an unreserved write is a Claude Code bonus on top of the same check the Codex worker runs through the helper.

## What claudekit teaches (and bee adopts)

Reading claudekit's installed skeleton (`.claude/settings.json` + 16 hooks + `lib/`), five patterns are load-bearing:

1. **Config-gated hooks.** Every hook begins with `isHookEnabled('<name>')` against one config file and exits 0 if disabled. The skeleton is one JSON edit away from silent, per-repo, per-hook.
2. **Fail-open crash wrappers.** Every hook wraps its whole body in try/catch, logs the crash to a file, and exits 0. A broken hook never breaks a session.
3. **Injection dedup.** Context-injecting hooks (claudekit's `dev-rules-reminder` on UserPromptSubmit) reserve an "injection scope" and skip when recently injected — the reminder costs tokens once, not on every prompt.
4. **Chain-nudging via SubagentStop matchers.** When a `Plan` agent finishes, `cook-after-plan-reminder` fires and tells the main agent the next stage. The workflow chain is advanced by the harness, not by memory. This is the heart of the "automation skeleton".
5. **State persistence via PostToolUse/Stop.** `session-state.cjs` fires after task-tool calls, on SubagentStop, and on Stop — state files stay fresh as a side effect of working, not as a discipline the model must maintain.

And one anti-lesson bee keeps from the earlier audit: claudekit injects context via env vars and ~16 scripts with overlapping concerns. bee caps the skeleton at **6 thin scripts**, puts shared logic in `lib/` modules (claudekit itself extracts `project-detector.cjs` etc. into `lib/` precisely so another runtime's plugin can reuse it — the exact pattern bee needs), and keeps subagent context inline in spawn prompts, not env magic.

## The bee hook skeleton (Claude Code)

Six scripts, six events. All ship inside the plugin (`hooks/` + `hooks.json`), so no user `settings.json` surgery is required. Every script:

- exits 0 silently if the repo has no `.bee/onboarding.json` (plugin enabled ≠ repo onboarded),
- checks `.bee/config.json → hooks.<name>` and exits 0 if disabled,
- is wrapped fail-open with crash logging to `.bee/logs/hooks.jsonl`,
- imports its logic from `.bee/bin/lib/` — the same modules the CLI helpers use, so hook behavior and helper behavior cannot diverge.

| # | Hook | Event (matcher) | What it does |
|---|---|---|---|
| 1 | `bee-session-init` | SessionStart (`startup\|resume\|clear\|compact`) | Runs the `bee.mjs status` logic inline and injects: onboarding health, current phase + gate states, `HANDOFF.json` surfacing ("do not auto-resume — present and wait"), `critical-patterns.md` digest, top-3 recent active decisions. This is superpowers' session-start injection + gstack's preamble, done once by the harness. |
| 2 | `bee-prompt-context` | UserPromptSubmit | Injects a one-to-three-line reminder: `phase / mode / next_action / open gate`. **Deduped**: only when state changed since the last injection or after a compaction (claudekit's injection-scope reservation). Costs ~0 on quiet turns. |
| 3 | `bee-write-guard` | PreToolUse (`Edit\|Write\|MultiEdit\|Bash`) | Three checks in one script, first hit wins: **(a) Gate guard** — if `state.json` shows execution not yet approved (Gate 3) and the target is source code (paths outside `.bee/`, `docs/history/`, `docs/`, `.spikes/`), block with the reason and the gate to ask for. Mechanically enforces "validate before execute". **(b) Reservation guard** — during `swarming`, a write to a path not reserved by this agent identity is blocked with a pointer to `bee.mjs reservations` (direct descendant of khuym's `khuym_pre_tool_use.mjs`, which already parses Bash commands for broad write patterns like `sed -i`, `tee`, `rm`). **(c) Privacy/scout guard** — reads of secret globs (`.env*`, `*.pem`, key files) emit a structured `@@BEE_PRIVACY@@` JSON marker that the skill contract turns into an AskUserQuestion approval; reads of `node_modules/`, `dist/`, `.git/` internals are blocked outright (claudekit privacy-block + scout-block, merged). |
| 4 | `bee-state-sync` | PostToolUse (`TaskCreate\|TaskUpdate\|TodoWrite`) + SubagentStop + Stop | Persists a state snapshot: worker registry, cell status counts, last activity. State files stay fresh as a side effect of tool use (claudekit `session-state` pattern). |
| 5 | `bee-chain-nudge` | SubagentStop | When a registered bee worker/reviewer subagent stops, inject the contract's next step: "Worker for cell auth-3 returned — collect its `[STATUS]`, update the cell, release/verify reservations" or, when the last review agent stops, "All reviewers done — synthesize findings, then Gate 4." The chain advances mechanically (claudekit `cook-after-plan-reminder` pattern generalized to the bee chain). |
| 6 | `bee-session-close` | Stop | Warns when the session ends mid-phase with no `HANDOFF.json`, with active reservations, or with claimed-but-uncapped cells — the "you are about to leave the hive door open" check. Also nudges (deduped, warn-only): source files changed with no bee flow and no recent decision logged; and the newest decision more recent than every `docs/specs/*.md` update — something settled was never captured (decision 0003). |

Not hooks (deliberately): subagent context injection (inline in spawn prompts — claudekit's own protocol says "craft prompts explicitly", the env-var channel is its bloat), naming enforcement, kanban rendering, usage-quota caching, statusline. Any future addition must name which of the six it replaces.

### Hook Response Protocol (skill-side contract)

Hooks can only block or inject text; the *skills* define how the agent responds (claudekit documents this in CLAUDE.md — bee does the same in the hive skill and the AGENTS.md block):

- `@@BEE_PRIVACY@@ … @@END@@` marker → the agent MUST route through AskUserQuestion; on approval, retry with the documented approval prefix. Never work around the block.
- Gate-guard block → the agent MUST NOT retry the write; it surfaces the gate question to the user (Gate 3 wording from the workflow doc).
- Reservation block → the worker returns `[BLOCKED]` with the conflict; the orchestrator fixes reservations or cell scope.

## Codex parity: the helper-enforced skeleton

Codex now loads its own project hooks from `.codex/hooks.json` (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, SubagentStop, PreCompact, Stop — 7 events, rendered from the same shared catalog as the Claude Code side), replacing the earlier claim that Codex lacked lifecycle hook support. Helper-level enforcement stays the floor on both runtimes either way — hooks are a second belt, not the only one:

| Automation | Claude Code (hooks) | Codex (helpers + AGENTS.md) |
|---|---|---|
| Session bootstrap & routing | `bee-session-init` injects it | `AGENTS.md` BEE block: "run `node .bee/bin/bee.mjs status --json` first, re-read after compaction"; `compact_prompt` recovery instructions (khuym pattern) |
| HANDOFF surfacing, never auto-resume | Hook injects the handoff and the wait rule | `bee.mjs status` prints the handoff block first in its output; AGENTS.md rule |
| Phase/gate reminder per prompt | `bee-prompt-context` (deduped) | Skill preambles: every stage skill's first step is "run bee.mjs status, verify the expected gate state" |
| Gate 3 "no execution before validation" | `bee-write-guard` blocks source writes pre-approval | `bee.mjs cells claim` refuses while `approved_gates.execution: false`; workers only act on claimed cells; AGENTS.md red-flag rule |
| Reservation enforcement | `bee-write-guard` blocks unreserved writes | `bee.mjs reservations reserve` conflict → skill contract mandates `[BLOCKED]`; `BEE_AGENT_NAME` env prefix on write-heavy shell commands (khuym convention) |
| Cap requires verification | (same helper) | `bee.mjs cells cap` refuses without a recorded verify pass — **helper-level, identical on both runtimes** |
| Privacy / scout blocking | `bee-write-guard` check (c) | Guardrail text in AGENTS.md block + hive skill; no mechanical block (accepted gap, documented) |
| State freshness | `bee-state-sync` | Skills update `state.json` at their handoff step (khuym contract); `bee.mjs status` flags staleness (`state.json` phase vs cell reality) |
| Chain advancement after workers finish | `bee-chain-nudge` | The parent thread receives `[DONE]/[BLOCKED]/…` tokens directly (khuym same-session swarm); swarming skill's tend-loop is the nudge |
| End-of-session hygiene | `bee-session-close` | "Session Finish" section of the AGENTS.md block (close/update cells, leave state + HANDOFF consistent, name blockers) |

Codex's project hooks ship a PreToolUse write/privacy guard and a SubagentStop chain-nudge alongside the rest, so the privacy-block and chain-nudging gaps once listed here are mechanism-present (file-shipped) rather than truly absent; whether a given installed Codex actually discovers and trusts each event — as opposed to the file merely being present — is what the capability spike confirms, not something assumed from shipping. Everything gate- and integrity-critical remains helper-enforced first regardless, so behavior stays identical either way.

## Shared `lib/` — one brain, two belts

```
.bee/bin/
  bee.mjs            ← sole shipped CLI, all 9 command groups
  lib/
    state.mjs          ← read/write state.json, gate checks, staleness detection
    cells.mjs          ← cell schema, cap-requires-verify, lane tiers, ready-set
    reservations.mjs   ← reserve/release/conflict/sweep (khuym_reservations lineage)
    guards.mjs         ← secret globs, scout-block dirs, gate-guard path rules
    inject.mjs         ← context digests (status, patterns, decisions), injection dedup
plugin hooks/          ← 6 thin wrappers: parse stdin payload → call lib → print/exit
```

Hooks are wrappers around `lib/`; CLI helpers are wrappers around the same `lib/`. When a rule changes (say, a new secret glob), both runtimes pick it up from one file. This is claudekit's `lib/` extraction pattern applied deliberately instead of retroactively.

## Onboarding responsibilities (one script, both runtimes)

`onboard_bee.mjs` (with `--apply` after approval):

1. Installs/updates the `AGENTS.md` BEE block (BEE:START/END markers) — bootstraps Codex and any AGENTS.md-reading tool.
2. Vendors `.bee/bin/bee.mjs` + `lib/` into the repo, removes any retired `bee_*.mjs` shims found there (`RETIRED_HELPERS` pass, D2), writes `.bee/` runtime files and `config.json` (all six hooks default-on, each toggleable).
3. Claude Code hooks need **no repo install** — they ship with the plugin and self-arm when `.bee/onboarding.json` appears. `--repo-hooks` exists as a fallback that writes them into `.claude/settings.json` for environments that don't load plugin hooks.
4. Verifies drift on later runs: managed block version, helper versions, config keys (khuym's `onboarding.json` managed-versions pattern).

The session-start preamble content is generated from one source (`inject.mjs`) for all three consumers — the plugin hook, the AGENTS.md block text, and `bee.mjs status` output — so the two runtimes can never drift apart in what they tell the agent. (gstack's docs-from-code rule, applied to bee's own bootstrap.)

## Tier 3: the repo-native playbook (any agent, no plugin)

repository-harness proves a distribution model skills cannot match: because its knowledge lives *in the repo* (AGENTS.md, intake docs, durable records), **every** agent that enters the repo is governed — regardless of runtime, plugin installation, or whether any skill triggers. Skill suites are activation-dependent: no plugin, or a missed description match, and the agent is blind.

bee is already half repo-native (helpers enforce mechanically for any agent; the AGENTS block bootstraps). The gap is workflow knowledge: how to actually run the stages lives only in SKILL.md files on the plugin side. Close it with a third degradation tier:

1. `onboard_bee.mjs` additionally installs **`.bee/PLAYBOOK.md`** (~150 lines, hard cap): the compressed chain — per-stage minimum checklists, the four gates verbatim, the risk-flag mode gate, key report formats (reality gate, feasibility matrix, status tokens), and the helper command surface. Enough for a plugin-less agent (Cursor, Copilot, Gemini CLI…) to run the chain correctly at a basic level.
2. **Generated, not hand-written**: the playbook is produced from the SKILL.md sources at plugin build time (gstack's docs-from-code rule) — one source, two forms: full skills (lazy-loaded, persuasion-hardened) and compressed playbook (always-on, procedural only). Anti-rationalization content stays in skills; the playbook carries procedure, the helpers carry enforcement.
3. The AGENTS block gains one routing line: *"If bee skills are not available in this runtime, follow `.bee/PLAYBOOK.md`."*
4. `bee.mjs status`'s `recommended_next` points at the playbook section for the current phase — the repo navigates any agent, independent of skill triggering.

Degradation ladder, complete: **skills** (Claude Code/Codex with plugin) → **playbook** (any AGENTS.md-reading agent) → **helpers** (mechanical enforcement for everyone, including agents that read nothing). Scheduled with the phase-4 docs-from-code work in [05-roadmap.md](05-roadmap.md).

## Testing the skeleton

- Each hook gets a fixture test: feed a recorded stdin payload, assert block/inject/silence (khuym's `test_onboard_khuym.mjs` style, no framework).
- One parity test asserts that every rule in `guards.mjs`/`cells.mjs` is exercised by *both* a hook test and a helper test — the two-belt guarantee.
- Pressure scenarios for the skill-side contracts (e.g., agent tries to work around a privacy block) live with the hive skill per the Iron Law.
