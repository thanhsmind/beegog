# intent-anchor — CONTEXT

**Mode:** standard · **Opened:** 2026-07-23

## The problem

A Codex session on a ~250k window must split work into segments: finish, clear,
continue. Across a `/clear` that mostly works. Across an **autocompact** it does
not — the reported failure is that after ~2 compactions the agent has drifted off
the original request entirely.

Diagnosed as a **priority inversion**, not a capacity problem:

| | re-injected in full every compact | decays every compact |
|---|---|---|
| what | bee's workflow scaffolding (AGENTS, phase, gates, next step) | **the user's original request and acceptance criteria** |
| why | it is on disk, re-read every time | it lives only in the conversation, which is exactly what compaction compresses first |

So the most-durable content is bee's bookkeeping and the least-durable is the
goal. After two compacts the scaffolding is at full strength and the intent is
gone, and the agent optimises for "finish the workflow" instead of "answer the
user". A bigger context window does not fix this — it delays the compact.

## Measured (spike, `.bee/spikes/intent-anchor`)

- Per-segment re-init: **27,961 → 1,887 tok (14.8× cheaper)**.
- Intent presence after 2 compacts: **absent → present**, and the conclusion holds
  across optimistic/central/pessimistic decay curves — it does not rest on the one
  modelled quantity.
- Honest correction from the spike: intent's *share* of tokens is the wrong axis
  (≈0.2% → 6.3%, and it *should* be small). **Presence and fidelity** are what
  drive behaviour.

## Locked decisions

**D1 — The anchor is a small, fixed-shape record on disk, and `request` is
VERBATIM.** A paraphrase is the first step of the drift it exists to prevent.
Fields: the raw request, what "done" means, one next action, the current
feature/lane/cell, decisions that must not be reversed, and stop conditions
(the set an external review asked for).

**D2 — It exists for work that never enters a feature.** A direct question or a
tiny fix has no `CONTEXT.md` and no work-item today, so nothing holds its intent
at all. The anchor must be writable without a feature.

**D3 — PreCompact re-asserts it.** The compaction checkpoint already runs; it must
also emit the anchor so the summary cannot drop it. It stays **advisory** —
compaction must never carry a turn-control verdict (the existing B2/R14 contract).

**D4 — On a compact/resume start, the anchor leads and nothing re-routes.** The
objective is stated first; the phase is a detail below it. This is the inversion
being corrected, so ordering is the whole point. Handoff adoption rules are
unchanged — a compacted session still never auto-adopts a planned-next handoff.

**D5 — Silence when there is no anchor.** No anchor means today's behaviour
exactly: a repo that never writes one must not be able to tell this shipped.

**D6 — Proven by a compaction simulation, not by inspection.** A test must show
the verbatim request surviving ≥2 simulated compaction boundaries while a
control without the anchor loses it.

## Out of scope

- Shrinking AGENTS.md / the knowledge budget (the other half of the cost story).
- Auto-adopting handoffs on compact (separate rule, deliberately untouched).
- A live Codex end-to-end canary — the honest next step after this lands.
