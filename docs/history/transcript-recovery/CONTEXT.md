# Crash-Recovery Transcript Mining — Context

**Feature slug:** transcript-recovery
**Date:** 2026-07-20
**Exploring session:** complete
**Scope:** Standard
**Domain types:** CALL (new CLI verbs) | RUN (session-start detection) | READ (recovery report the next session consumes)

## Feature Boundary

When a bee session dies abruptly (machine shutdown, kill — no HANDOFF written), the next session can detect the crash and recover the dead session's unsettled context by mining the harness-persisted transcript (`~/.claude/projects/<enc>/<session-id>.jsonl`) through a down-tier worker, producing a bounded recovery digest plus candidate settlements — decisions/state remain the primary memory, raw transcript content never enters the orchestrator's context, and nothing mined ever becomes a decision or resumes work without confirmation. The feature ends at the digest + candidates; adopting candidates rides the existing capture/decision machinery unchanged.

## Locked Decisions

These are fixed. Planning must implement them exactly — cited, never reinterpreted.
Changing one requires the user, a new D-ID or an explicit supersession note, never
a silent edit.

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | A "recoverable crash" is defined mechanically from existing primitives: a `.bee/sessions/<id>.json` record whose heartbeat is stale per the existing 900s law (`claims.mjs` `heartbeatStale`), whose transcript exists and whose tail LACKS the clean-end trio (`system/stop_hook_summary` → `system/turn_duration` → `last-prompt`), and which shows work signals (bound lane in a non-terminal phase, claimed cells, or transcript activity newer than the last durable settlement). No new staleness constants. | Reuses the two definitions that already exist (heartbeat staleness; transcript clean-end pattern verified in the field) instead of inventing a third. |
| D2 | Two-stage surface: **detection** is cheap and automatic — the session-start scout (`bee status`) reports crash candidates (session id, lane/feature, last activity, transcript located). **Mining** never auto-runs: it is a CLI verb (`bee recovery mine --session <id>` shape; exact name is planning's) the agent runs when the scout flags a candidate, following the same offer discipline as the capture-queue flush. On hosts with no transcript store (e.g. Codex runtime — `resolveTranscript` returns null), detection is a silent no-op. | Detection costs a stat + tail read; mining costs a worker dispatch — only the cheap half may run unconditionally every session start. |
| D3 | Mining window is bounded: from the last durable settlement for that session's lane (max of last decision ts, last capture stub ts, last cell-trace/commit ts) to end of transcript, with a hard size cap on events fed to the worker. When the crashed session has no bound lane, the window keys on the last GLOBAL durable settlement (same three sources, unscoped). Never the whole transcript by default. | The point is the unsettled tail; whole-transcript mining recreates the context-cost problem the feature exists to avoid. |
| D4 | Mining executes on a down-tier worker (extraction/generation tier per the Delegation contract); the orchestrator receives only the digest. Raw transcript lines never enter the orchestrator session context, in any lane. | This is the feature's founding constraint (user field report): decisions are lossy but transcripts are unloadable — the digest is the only bridge that respects both. |
| D5 | Mined content is data, never instructions (existing guardrail extended to transcripts): the digest carries no imperative authority, the miner redacts secret-shaped strings, and only the current project's transcript directory is ever read — never other projects' dirs. | Transcripts contain tool output and possibly secret-shaped text; the existing artifact-mining rule already covers this class. |
| D6 | Recovery output is two artifacts, both through existing channels: (a) a recovery report `docs/history/<feature>/reports/recovery-<session8>.md` when the dead session's lane/feature is known, else `docs/history/recovery/recovery-<session8>.md`; (b) candidate settlements appended as capture stubs marked `mined-unconfirmed` — flushed through the normal bee-scribing queue drain, where confirmation happens. Nothing mined auto-becomes a decision, and recovery never writes or synthesizes a HANDOFF.json (never-auto-resume law untouched). | Reuses capture-queue + scribing instead of inventing a parallel confirmation path. |

### Agent's Discretion

Exact CLI verb names, digest section layout, the numeric size cap in D3, worker prompt wording, and where detection hooks into the status payload — all planning/implementation choices, constrained by D1–D6.

## Terms

| Term | Meaning in this feature |
|------|-------------------------|
| clean-end trio | The terminal transcript pattern `system/stop_hook_summary` → `system/turn_duration` → `last-prompt` with nothing conversational after; its absence at tail = abrupt stop. |
| durable settlement | Any of: a logged decision, a capture stub, a capped cell trace/commit — the last point whose knowledge survived the crash. |
| recovery digest | The worker-produced summary of the unsettled transcript tail: what was in flight, candidate settlements, verify evidence seen, suggested next action. |
| mined-unconfirmed | Status of a capture stub sourced from a transcript rather than a live conversation; it must pass the normal scribing flush (human-visible) before its content is treated as settled. |

## Existing Code Context

### Reusable Assets

- `.bee/bin/lib/perf.mjs:31-74` — `encodeProjectDir`, `claudeProjectsRoot`, `resolveTranscript`: full transcript location machinery already exists (slug scheme, `$CLAUDE_CONFIG_DIR` handling, per-session file pick).
- `.bee/bin/lib/perf.mjs:388-414` — `rollupTranscript` derives real cwd from events; `readJsonl` (fsutil.mjs) parses lines; entry-type readers at perf.mjs:119-201.
- `.bee/bin/lib/perf.mjs:208-255` — `walkSubagents`: sidecar `subagents/agent-*.jsonl` + `.meta.json` reader, if mining ever needs subagent tails.
- `.bee/bin/lib/claims.mjs:169-184, 470+` — session heartbeat write, `heartbeatStale` (900s), `sweepExpiredClaims` (runs first in every `cells claim-next`).
- `.bee/bin/lib/state.mjs:911-1050` — HANDOFF read/write/adopt; confirmed: no code path writes HANDOFF on abrupt crash — the gap this feature fills.
- Capture queue (`bee.mjs capture add/list/flush`) — the confirmation channel D6 reuses.

### Established Patterns

- New CLI verb = handler fn + `HANDLERS['group.verb']` entry in `.bee/bin/bee.mjs` (~3751+) + schema in `command-registry.mjs` (single source of truth for the command surface).
- Lib mirror law (`scripts/test_lib_mirror.mjs`): any new/changed lib file must be byte-identical in `skills/bee-hive/templates/lib/` and `.bee/bin/lib/`.
- `perf.mjs` is deliberately imported only by `bee.mjs`, never by `command-registry.mjs` (write-guard fixture set) — a recovery module reusing perf helpers must keep that import discipline.
- Delegation contract transport: every mining dispatch carries its tier (`model` param or leading `[bee-tier: …]` marker).

### Integration Points

- `bee status --json` payload — where D2's detection block surfaces (alongside the existing capture-queue/review blocks).
- `bee-hive` Session Scout prose + AGENTS.md startup steps — the offer wording.
- `docs/specs/workflow-state.md` — the spec area that owns sessions/heartbeats/handoff; recovery behavior gets scribed there.

## Canonical References

- `.bee/backlog.jsonl` friction row 2026-07-20 ("Crash recovery ignores harness transcripts…") — origin.
- `docs/backlog.md` P56 (in-flight, transcript-recovery).
- Transcript format digest (gather worker, 2026-07-20): line schema, entry types, clean-end trio, no session-index sidecar exists — filename UUID = session id is the only mapping.

## Outstanding Questions

### Deferred To Planning

- [ ] Exact command-group shape (`recovery` as a new group vs a verb under `state`) — decide against the dispatcher/registry layout.
- [ ] How the miner marks stubs `mined-unconfirmed` — new field vs source tag, against the capture schema.
- [ ] D3 numeric cap — measure a typical tail before picking.
- [ ] Whether detection needs a config toggle (`.bee/config.json` guards) for hosts without Claude-Code-style transcripts (Codex runtime) — probe capability, fail silent.

## Deferred Ideas

- Mining subagent transcripts of the dead session for lost worker results — only the main tail in v1.
- A `bee recovery` sweep across ALL projects' transcripts — out of scope; only the current project dir (D5).
- Auto-diffing mined candidates against existing specs to pre-mark conflicts — scribing does this at flush time already; revisit if flushes get noisy.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked
decisions, code context, canonical references, and deferred-to-planning questions.
Validating and reviewing use locked decisions for coverage and UAT.
