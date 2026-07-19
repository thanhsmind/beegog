# A/B tiny-cell execution protocol — inline vs. dispatched worker

- **Status:** active — GH #22 P1-7, decision D9 + advisor R7.
- **Date:** 2026-07-19.
- **Source:** AO14 made tiny/small cell *implementation* itself ride one dispatched execution
  worker, never in-session — but that call was never measured against the inline alternative it
  replaced. This protocol collects the comparison from real usage instead of arguing it from
  priors.

## The two arms

- **Arm A — inline.** The orchestrator implements the tiny cell itself: full cell discipline
  (cell + verify + cap), no worker spawn. This is the pre-AO14 shape.
- **Arm B — dispatched.** One dispatched execution worker implements the cell (AO14, today's
  default). The orchestrator still owns the cell record, verify, and cap; only the edit itself
  runs on a worker.

Both arms apply to **tiny cells only** — small/standard/high-risk work is out of scope, AO14's
own rationale (context economy on a mechanical edit) doesn't generalize past tiny, and mixing
sizes would confound the comparison.

## Metrics captured per tiny cell

Recorded for every tiny cell run under either arm, sourced from two places:

1. **The perf log** (`bee-perf/v1` sections, `.bee/bin/lib/perf.mjs` `buildSection`/
   `appendSection`) — `running_time_ms` (wall time), `event_count` (tool-call volume proxy),
   `models`/`subagent_models` (token usage per model).
2. **Dispatch economics fields** (landing separately via g22-2): `channel`, `logical_tier`,
   `requested_model`, `effective_model_status` — these attribute a dispatch's actual transport and
   resolved model, which the perf log alone cannot distinguish for Arm B (worker) runs.

The four comparison metrics, one row per tiny cell:

| Metric | Arm A source | Arm B source |
|---|---|---|
| Wall time | perf section `running_time_ms` | perf section `running_time_ms` (parent + worker span) |
| Time-to-first-edit | first Edit/Write tool timestamp − cell claim timestamp | same, taken from the worker's own span once `channel`/`logical_tier` attribute it |
| Total tool calls | perf section `event_count` | parent `event_count` + worker `event_count` |
| Tokens | perf section `models` usage | `models` usage, cross-checked against `requested_model`/`effective_model_status` so a silently-downgraded dispatch doesn't read as a false efficiency win |

Verify outcome (green/red) is captured alongside every row — it is the quality floor, not a speed
metric (see read-out rule below).

## Assignment rule

Deterministic, not a per-cell choice (avoids cherry-picking toward whichever arm "feels" better
for a given cell): hash the cell id and alternate.

```
arm = (sha256(cellId).charCodeAt(0) % 2 === 0) ? 'A' : 'B'
```

Any stable, cell-id-derived parity works; the property that matters is that the assignment is
fixed by the id alone, computed before implementation starts, and never overridden by the
orchestrator's judgment about the specific cell.

## Minimum sample

**10 tiny cells per arm** before any comparison is drawn. Below that, medians are noise — report
counts-so-far, not a verdict.

## Read-out rule

Once both arms have ≥10 samples:

- Compare **medians** (not means — tiny-cell wall time is right-skewed by the occasional stuck
  cell) for wall time, time-to-first-edit, total tool calls, and tokens.
- **Quality floor:** the verify-red rate must not differ meaningfully between arms. A speed win
  that comes with a higher verify-red rate is not a win — it is deferred cost. If the floor is
  violated, the faster arm is disqualified regardless of its speed numbers until the red rate is
  investigated.
- Report the comparison in the perf report (`bee.mjs perf report` / `reportHtmlPath`), tagged by
  arm, alongside the existing per-session sections.

## No synthetic benchmark

This protocol accrues its sample **only from real tiny-cell work executed during normal bee
sessions.** There is no synthetic harness, no staged repo, no scripted cell run built to produce a
comparison — every row in the sample is a cell someone actually needed done. This is deliberate:
a synthetic benchmark would measure the harness's overhead in isolation, not the thing that
actually matters, which is end-to-end cost on real work with real context pressure and real
model behavior.

## Canary probe leg protocol (codex-native-transport, cnt-5)

A second, unrelated-topic protocol recorded in this file at the same "how bee runs an
evidence-gathering experiment" altitude as the A/B arms above: the **probe leg** pattern a
canary script uses to gather version-scoped, observed (never assumed) evidence about an
external runtime's real behavior, established by `scripts/canary_codex.mjs --probe` /
`--probe-selftest` for the codex-native-transport feature (CONTEXT D3, D4; plan.md V1–V3).
Recorded here, rather than only in the feature's own history, because the pattern is meant to
be reused by future capability probes, not treated as one-off feature code.

**The pattern:**

1. **A probe is a separate CLI mode, never folded into the default canary/verify suite.** A
   probe leg may force an under-development feature flag and run a real model turn — cost and
   flakiness unsuited to riding along on every default run. `--probe-selftest` (offline, asserts
   the isolation invariant below without touching `codex` at all) is the cell's actual `verify`
   command; `--probe` (live, requires `codex` on PATH, degrades to the same skip-guard as the
   default suite when absent) is the manual-evidence-gathering step, run on demand.
2. **Isolation is non-negotiable and independently checked, not just asserted (D4).** Every
   invocation runs against a per-run `mktemp` `CODEX_HOME`, seeded with a read-only copy of
   `auth.json` and whatever config the probe needs to force. The real `CODEX_HOME`'s
   `config.toml` is snapshotted before and asserted byte-identical after, in a `finally`, whether
   the probe's own observation is positive, negative, or the process crashes.
3. **Build the fixture the way that has actually been proven to work, not the cheapest-looking
   one.** A hand-rolled single-hook `.codex/hooks.json` was tried first and never observed a
   `PreToolUse` fire despite a successful underlying tool call — a real, cited gap
   (`.bee/spikes/codex-native-transport/probe-v1v3.md`). The fix was building the fixture through
   the project's own onboarding entrypoint (`onboard_bee.mjs --apply --repo-hooks`, the full
   hook chain), the same method an earlier capability spike used when it *did* observe the hook
   fire. When a probe needs to observe something beyond what the installed chain already reports,
   inject an additional hook entry into the onboarded `.codex/hooks.json` (never replace the
   real installed hook it sits next to) so the exact real chain still runs unmodified.
4. **Either answer is a valid green.** A probe records what it observed — acceptance or refusal,
   a fired hook or a silent one — and never treats a negative result as a failure to retry or
   paper over. The only failures that stop the probe (non-zero exit) are infrastructure failures
   (fixture/codex-home build) or a violated isolation invariant; the observation itself never
   does.
5. **The evidence is version-scoped, and versions can regress.** A probe records the exact
   client version alongside its observation and treats every verdict as scoped to that version —
   never inferred from a version string, never assumed stable across a patch bump. cnt-5's own
   evidence is the concrete proof this matters: an override surface confirmed live on codex-cli
   0.144.4 was fully refused (a new API-level schema rejection) two patch versions later on
   0.144.6, with no changelog signal available to bee (full detail:
   `docs/history/codex-native-transport/reports/probe-evidence.md`).
6. **The machine record is separate from, and additive to, any existing attest/doctor record.**
   A probe's structured evidence is written through a dedicated writer (here,
   `writeNativeTransportProbe`, `.bee/bin/bee.mjs`) to its own gitignored, host-local file — never
   mixed into an unrelated attestation record, and never applied to the user's real environment
   (D4 again: bee observes, it does not flip flags on the user's behalf).
