---
date: 2026-07-11
feature: session-observation (anphabe-gogl review run)
categories: [failure]
severity: critical
tags: [swarming, review, background-agents, tokens, polling]
---

# Learning: Polling scratchpad files for background subagents burns tokens for a signal the harness already delivers

**Category:** failure
**Severity:** critical
**Tags:** [swarming, review, background-agents, tokens, polling]
**Applicable-when:** any orchestrator (review, swarming, grooming) is waiting on background subagents it dispatched itself

## What Happened

During a multi-agent review run in the anphabe-gogl host project, the orchestrator dispatched
6 reviewer subagents and then waited for them by repeatedly running a bash loop of the form:

```
ls <scratchpad>/review/done_* ; for f in <scratchpad>/review/out_*.md; do echo "$f: $(wc -c < "$f") bytes"; done
```

Each iteration repeated six ~110-character absolute scratchpad paths twice (once in the
command string, once in the output) — roughly 300–400 tokens per poll — and every observed
iteration reported `0 bytes` for all six files. The user spotted the waste in the transcript
and asked why it was happening at all.

## Root Cause

The polling was a **symptom of an upstream deviation**: the orchestrator spawned its
reviewers via a self-written `run-wave.sh` that generated `prompt_$R.txt` per persona and
launched headless CLI processes writing `out_$R.md` — instead of dispatching them through
the Agent tool as bee-reviewing's spawn contract requires. Shell-spawned processes are
invisible to the harness, so no completion notify exists, so file-drop + polling became the
only channel. The whole cascade (script → prompt files → out files → poll loop) replaces
machinery the harness provides for free: Agent-tool subagents run in parallel, start with
isolated context (the stated motive for the script), re-invoke the orchestrator on
completion, and deliver the report as their final message (`swarming-reference.md`: "You are
notified when each background agent completes; its final message is the worker report").
The file scheme is also less reliable — a 0-byte file cannot distinguish "not started" from
"failed mid-write".

## Recommendation

1. **Dispatch reviewers/workers through the Agent tool, never as self-scripted shell
   processes.** A `run-wave.sh`-style fan-out forfeits harness tracking and forces the
   entire file-drop + poll cascade; Agent-tool subagents already give parallelism and
   isolated context.
2. **Never poll files/scratchpad to wait for a subagent you dispatched.** Sit idle; the
   harness wakes the orchestrator with the agent's final message. Cost while waiting: zero.
3. Reviewer/worker reports travel in the agent's **final message** (status token first), per
   the swarming reference — not via side files the parent must discover.
4. Polling is legitimate only for **external** state the harness cannot track (CI runs,
   deploys, remote queues). Even then: `cd` into the directory once and emit ONE compact line
   (e.g. a count — `ls done_* 2>/dev/null | wc -l`), never a per-file listing of absolute
   paths; and space polls to match how fast the external state actually changes.
