# scribing-integrity — CONTEXT

User report (2026-07-24): tasks look done but never got their scribing pass;
sessions over the last 2 days appear to stop at scribing. Investigation
confirmed three structural holes (evidence: gather digest in this feature's
reports, decisions.jsonl:1390 router-cost precedent, live probe closing a lane
with zero debt check):

1. `scribingDebt()` (cells.mjs:2037-2056) scopes to the current default
   `state.feature` and fires as a wall ONLY at that feature's explicit
   `compounding-complete`. A dead session never attempts the close → no wall →
   silent debt. Live orphans: full-run-retirement (frr-1), codex-loop-p0 (clp-1).
2. Lane closes (`state set --lane X --phase compounding-complete`) never
   compute debt at all — `scribingDebt` reads only the default record.
3. Herding merge role's finished predicate requires `compounding-complete`;
   an agent dying post-cap pre-tail leaves the worktree occupying a slot
   forever, reported once as a generic anomaly, never named as scribing-owed.

Locked decisions D1-D5: see decision log (this feature). Out of scope:
auto-running the scribing tail on a dead agent's behalf (herding stays
report-only by contract); rewriting historical debt for archived cells
(sweep covers live cells only).
