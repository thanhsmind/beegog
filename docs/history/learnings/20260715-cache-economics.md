---
date: 2026-07-15
feature: session-economics (cross-feature; observed on the codex-harness-hardening marathon session)
categories: [pattern, cost]
severity: high
tags: [prompt-caching, prefix-stability, delegation, context-window, cost, fan-out]
---

# Cache economics: the bill is turns × prefix — keep the prefix immutable and warm

## What Happened

A full-day orchestrator session (5 slices shipped, 3 releases, 1 independent review) billed
**opus 1.4M new / 120.2M cached (~99% cache-read)** + **sonnet 73k new / 1.3M cached = $0.53**
for all subagents — $80 total where an uncached equivalent would have cost many times more.
This was not luck; it fell out of a specific working shape.

## Root Cause (why the ratio is achievable at all)

Prompt caching is **prefix matching**: every tool call re-sends the whole conversation, and only
a byte-identical prefix bills at ~1/10 price. The 120M "cached" is cumulative re-reads across
hundreds of tool calls — so the true cost function is **turns × context-per-turn**, and the two
levers are the *size* and the *stability* of the prefix every turn re-pays for.

## The load-bearing factors, ranked

1. **Never break the prefix (the critical one).** The conversation stayed strictly append-only:
   no compaction, no history edits, no mid-session system-prompt/tool changes. **Compaction is
   the cache killer** — it rewrites the entire prefix, so every token re-bills as new. A large
   context window matters mostly because it *postpones compaction*.
2. **Stay inside the cache TTL.** Continuous tool-call rhythm means every request lands on a warm
   cache (~1h TTL here). An idle gap past TTL re-heats the whole prefix at full price once.
3. **Fan out the gathering; keep the deciding** (AGENTS.md rule 13). Every multi-file scan —
   recon, doc census, the 4-reviewer wave — ran in a subagent with its *own* context and returned
   a digest. The orchestrator's prefix stayed small (cheaper per re-read) AND stable (file dumps
   never entered it). The measured proof: all subagent work together cost **$0.53**.
4. **Fewer, fatter turns.** Batch independent commands into one Bash call; never re-read a file
   already in context; don't poll (event-driven waits). Every tool call avoided is one full
   prefix re-bill avoided — turn count is a first-order cost term, not hygiene (backlog P33).

## Recommendation

- **When a session will be long, protect the prefix like an invariant:** delegate every >3-file
  gather (rule 13), batch tool calls, and treat approaching-compaction as a cost cliff — hand off
  or split the session *before* compaction, not after.
- **Rule 13's justification is double:** it was written for context-window scarcity, but its
  bigger payoff is cache leverage — the expensive thing is not new tokens, it is bloating or
  breaking the prefix that every later turn re-pays for.
- **Keep the work rhythm continuous** during expensive phases (execution, review waves); long
  pauses mid-flow silently forfeit the warm cache.
- When measuring cost (P33/P35), record turns and per-turn context, not just token totals — the
  ratio `new : cached` is the health metric; ~99% cached is what "right-shaped session" looks like.
