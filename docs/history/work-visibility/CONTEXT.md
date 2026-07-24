# work-visibility — CONTEXT

User feedback (2026-07-24, verbatim intent): the bee harness feels like it is
"only running CLI commands and agents" — terse to the point of opaque. The user
does NOT want bookkeeping narration back (cells, claims, slices stay silent).
What they want is to *follow the work*: the purpose of each step in one
sentence, agent dispatches that say what the agent is going to do (not just a
model name and id), and CLI runtimes surfaced so slow spots can be found and
optimized later.

## Locked decisions

**D1 — Purpose-first narration: silent bookkeeping gains a positive duty.**
The Silent Bookkeeping rule (decision 1689af1b) stays intact — bee mechanics
never enter chat. Added on top: every *work unit* the user can perceive (a
phase of real work starting, a worker being sent out, a long-running step, a
direction change) opens with ONE work-language sentence naming what is being
done and for what outcome ("Đang X để Y" / "Doing X so that Y"). The existing
litmus ("strip bee terms — if nothing is lost, they didn't belong") gains a
twin: *strip the message entirely — if the user loses the thread of what is
being worked on and why, the sentence was owed.* Silence about mechanics was
never meant to be silence about purpose.

**D2 — Dispatch descriptions carry intent.** Every Agent dispatch's
`description` (the line the harness UI shows the human) is one work-language
sentence of intent — what this worker is going to find, build, or check —
with the model/tier tag appended in parentheses. `description` is for the
human; the `[bee-tier: …]` transport marker in the prompt is for the guard —
D2 adds the human layer and changes nothing about transport (decision 0023
untouched). A dispatch whose description is only a model name or a codename
is the new red flag.

**D3 — CLI self-timing.** Every `bee.mjs` invocation measures its own wall
time and (a) appends one line `{ts, cmd, ms, ok}` to `.bee/logs/timings.jsonl`
(same fail-open discipline as hooks.jsonl — never crash the command over a log
write), and (b) prints one short summary line to **stderr** — stdout stays
byte-identical so every `--json` consumer and test is untouched. Analysis of
the log (a `timings report` verb) is deferred as a PBI, not built now.

## Scope

- Machinery: one timing wrapper at the bee.mjs dispatch boundary + fail-open
  jsonl append (exact insertion point per validation).
- Instruction layer: routing-and-contracts.md (Silent Bookkeeping + Delegation
  contract), AGENTS.md rules 11/13, bee-hive/bee-swarming dispatch templates —
  exact file list per the gather digest.

## Out of scope

- Timings analysis/report verb (PBI).
- Any change to gate presentation (already plain-language by contract).
- Progress bars, spinners, or streaming UI — narration is prose, not chrome.
