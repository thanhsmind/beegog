# ao-spike-probe

**Status:** DONE
**Outcome:** Real whitelist-only PreToolUse captures were obtained, but only from the subagent-dispatch side (this worker's own Read calls and a nested subagent's Read — all byte-identical). No never-dispatched, true-orchestrator capture was obtainable from inside a worker's delegated turn (structural, not a hook-snapshot-timing issue — that anticipated blocker was empirically disproven). Verdict: **NO**.

**Files touched:** `.bee/cells/ao-spike-probe.json` (trace, committed). `.bee/spikes/advisor-and-orchestration/s2-payload-probe.md`, `probe-hook.mjs`, `capture.jsonl`, and the `.claude/settings.local.json` binding used to obtain evidence are disposable/git-ignored under `.bee/spikes/` per repo convention (binding removed before cap).

Full trace/evidence: `.bee/cells/ao-spike-probe.json`.

---

## SUPERSEDED — the verdict above is NO; the answer is YES (AO15)

This report's `NO` was correct **on the data this worker could obtain**, and the worker was right not to fabricate the missing half. But the missing half was the whole answer.

A dispatched worker **structurally cannot** execute a tool call as the top-level orchestrator, so it could only ever capture the subagent side. The orchestrator ran the control capture itself, with the same whitelist discipline (widened only to record `agent_type` verbatim — a closed-vocabulary type name — and a hashed `agent_id`):

| Caller | `agent_type` | `agent_id` | `session_id` |
|---|---|---|---|
| **Orchestrator** | *(field absent)* | *(field absent)* | `40c31dee` |
| **Subagent** | `"Explore"` | present | `40c31dee` |

**The discriminator exists: `agent_id`/`agent_type` are absent on an orchestrator tool call and present on a subagent's — with an identical `session_id`.** So `session_id` is *not* the discriminator; presence/absence of `agent_id` is. `agent_type` additionally names *which* agent type. The tools-logger's `agent` column (Slice 3) **is buildable**.

Also disproven empirically: the assumption that Claude Code snapshots hooks at session start and a mid-session binding is inert. **The binding fired on the very next `Read`.**

**This does not revive the byte-budget hook.** AO6 rejected it on five grounds; "we cannot tell orchestrator from subagent" was only one. The other four stand: it meters the second-order term (bytes) while the bill is driven by the first-order one (turns × context); a well-meaning model routes around it with `Bash("cat file")`; the threshold is invented; and it inverts critical rule 12 by teaching read-until-blocked. **A newly available mechanism is not a reason to build a thing that was rejected on its merits.**

Full payload field set, for the record: `agent_id`, `agent_type`, `cwd`, `effort`, `hook_event_name`, `permission_mode`, `prompt_id`, `session_id`, `tool_input`, `tool_name`, `tool_use_id`, `transcript_path`. Bee reads only four of these today.
