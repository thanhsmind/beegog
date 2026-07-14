---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: high-risk
---

# advisor-and-orchestration — Plan

Source of truth: `docs/history/advisor-and-orchestration/CONTEXT.md` (AO1–AO8).
Decisions are cited as `AO<n>`, never `D<n>` (AO7).

## Mode Gate

**6 risk flags → `high-risk`.** Counted, not vibed:

| Flag | Present? | Evidence |
|------|----------|----------|
| audit / security | **yes** | The work repairs an audit trail that currently **records lies** (`dispatch.jsonl` logs `model:"banana"` as a legitimate `transport:"model-param"`), and it edits `bee-model-guard`, a control-channel guard hardened against marker forgery (decision 0023, critical pattern 20260711). |
| external systems | **yes** | The advisor is an external CLI executor (`codex exec …`); AO8 changes its transport privileges. |
| public contracts | **yes** | `hooks/catalog.mjs` projections (`claude-hooks.json`, `hooks.json`, `.codex/hooks.json`) and the CLI manifest (`command-registry.mjs`) are **synced into host repos** by onboarding. A new hook and a new CLI verb change both. |
| cross-platform | **yes** | Hooks and paths run on Windows/WSL; `scripts/test_portable_paths.mjs` is in the verify chain for exactly this reason. |
| existing covered behavior | **yes** | The shipped advisor loop, the degenerate check, the lane table's Execute column, and the guard all have existing behavior this feature changes. |
| weak proof around the area | **yes** | **Two hook suites are RED at HEAD** — `test_model_guard.mjs` (18 failures) and `test_hook_contracts.mjs` (22 failures) — and **no verify chain and no CI runs any of them**. They are not "silently green": they exit 1 and say so loudly. Nobody listens. See Slice 0. |

Hard-gate flags present: **audit/security**, **external provider**. High-risk is mandatory, not discretionary; `gate_bypass` does **not** apply. `standard` was rejected: it would skip the persona panel over a guard whose own suite is broken.

## Discovery — L1 (verify, do not research)

Everything needed was established and verified this session; no candidate comparison is open. One L1 verification was performed and it changed the plan:

Measured at HEAD, this session:

| Suite | Exit | Output |
|---|---|---|
| `hooks/test_model_guard.mjs` | **1** | `18 FAILURE(S)` |
| `hooks/test_hook_contracts.mjs` | **1** | `22 FAILURE(S)` |
| `hooks/test_write_guard.mjs` | 0 | `ALL PASS` |
| `commands.verify` (the declared chain) | 0 | green |

- **`test_model_guard.mjs` fails 18 deny rows.** `copyLib()` (`:40-46`) hand-enumerates `["state.mjs","fsutil.mjs"]`, but `state.mjs:5,8-9` now imports `claims.mjs` and `reservations.mjs`. The import throws in the fixture, `bee-model-guard.mjs:147-150` fail-opens (exit 0), and every "bare dispatch is denied" row reports *allowed*. **Correction:** an earlier draft of this plan called the suite "silently green". It is not — it prints `18 FAILURE(S)` and exits 1. The failure is not that it lies; it is that **nothing runs it**.
- **`test_hook_contracts.mjs` fails 22 rows** — the *same rot class, a second file*: its route fixture stages wrappers at `<fixture>/hooks/*.mjs` while `.codex/hooks.json` execs `.bee/bin/hooks/bee-*.mjs`, plus one `codex-repo-target-drift` row. **Not** fixed by repairing `test_model_guard.mjs`.
- **No verify chain and no CI runs any hook suite.** `.bee/config.json` `commands.verify` runs only `test_lib.mjs`, `test_onboard_bee.mjs`, `test_portable_paths.mjs`. **That is why both rots survived** — and why the standing learning of 2026-07-14 (`critical-patterns.md:6-18`) was cited as if it had been applied while a second instance of the exact class stayed live.

No L2/L3 discovery is warranted: `references/planning-reference.md`'s fan-out table gives high-risk a standalone `approach.md`; see it for the risk map and rejected alternatives.

## Slices

Cells are created for the **current slice only** (Slice 0 + Slice 1). Later slices are described here as shape, never as cells.

### Slice 0 — Fix-first: make the hook suites real, then wire them in (BLOCKING)

Nothing in this feature is verifiable until this lands. A guard change proven by a suite that fail-opens is not proven. **Order matters and is not negotiable** — the verify-chain edit is the **last commit on a green tree, never the first on a red one.** Adding a red suite to `commands.verify` would brick the baseline for every session in every host that syncs the config, and bee's own law then makes the next session's first act "fix the baseline".

1. **`ao-0a`** — repair `hooks/test_hook_contracts.mjs` (22 failures): stage wrappers into `<fixture>/.bee/bin/hooks/` derived with `readdirSync`, and resolve the `codex-repo-target-drift` row by regenerating `.codex/hooks.json` from `hooks/catalog.mjs`.
2. **`ao-0`** — repair `hooks/test_model_guard.mjs`'s `copyLib` the same way. Prove falsifiability once (break the guard, watch it go red, restore byte-for-byte).
3. **`ao-0b`** — only once all three suites are green: add them to `.bee/config.json` `commands.verify`.

### Slice 1 — Two spikes, parallel, independent

**S1 (gates AO1's tiny clause — binding, per CONTEXT.md Resolve-Before-Planning).** Can a `tiny`-lane cell execute through a dispatched worker without breaking (a) the merged Gate 2+3 question and (b) the in-session done-report contract (diff + fresh verify output)? See `bee-hive/SKILL.md:116` (tiny Execute = *"direct, in-session (solo)"*) and `:125`. **A NO returns to the user, not to the planner.** No cell derived from AO1's tiny clause is planned until S1 returns.

**S2 (gates the logger's `agent` column, not the logger).** Can a `PreToolUse` payload distinguish an orchestrator tool call from a subagent one? Probe hook dumps its stdin payload, bound on `Read`; run once at top level and once inside a dispatched subagent; diff. Answer is recorded either way — a NO is a finding, not a failure.

### Slice 2 — Guard + "config is the authority" (AO5, AO1-guard, AO8)

- **W1** — `hooks/bee-model-guard.mjs:123-146` **and its byte-identical mirror** `.bee/bin/hooks/bee-model-guard.mjs` (they move together). Two holes: (i) `model` accepted as any non-empty string → per AO5 it must **equal the model configured for the declared tier** (`resolveTier`); (ii) an anchored `[bee-tier:]` marker asserts intent and **selects nothing** → per AO5 the marker satisfies **`ceiling` only**, where "inherit" *is* the correct semantics (decision 0015).
- **W2** — Remove the degenerate check (`bee-swarming/SKILL.md:43-45`): the hardcoded `haiku < sonnet < opus` ladder that **silently skips the configured advisor**. Per AO5 this is the model overruling its owner; **deleting it is the point, not a side effect.** Narrow at most to the one honest no-op (advisor resolves to literally the same model as the worker). Generalise: a dispatch declaring `generation`/`extraction` must run the configured model for that tier; same-family fallback only when the tier is unconfigured.
- **W6 (AO8)** — the advisor runs **read-only**. Today `.bee/config.json`'s advisor is `codex exec … --yolo … workspace-write`.

**Open, must be answered by validating, not assumed:** AO5 says "enforced at config-validate time" — **there is no config-validate stage.** `normalizeModels`/`normalizeTierValue` (`state.mjs:108-124`) **silently ignore invalid shapes and drop unknown keys**; `bee.mjs` has no `config validate` verb; the only precedent is the passive `STALE_ADVISOR_NOTICE` (`state.mjs:679-689`), a warning not a refusal. The host for this validation must be **named** (onboarding? `bee status`? `resolveTier` itself?), and it is net-new plumbing.

### Slice 3 — Visibility + measurement (AO1-logger, AO3-agents)

- **W3** — pinned agent types: `.claude/agents/bee-*.md` with `model:` in frontmatter (`bee-gather`=sonnet, `bee-extract`=haiku, `bee-review`=opus); guard rejects catch-all `general-purpose` for bee dispatches. **This explicitly does not reduce cost** (CONTEXT.md) — no cell or report may claim it does. **Sync (AO10, binding):** `.claude/agents/` **must not** become a third `REPO_SKILL_TARGETS` entry — the three-version preflight would resolve it as `unknown` (no `bee-hive` *directory* under an agents root) and **refuse onboarding permanently and non-forceably on every host**. It ships through a separate flat managed-file sync with its own version marker. **Codex (AO11):** documented asymmetry, not parity — Codex has no per-agent model selection, so a pinned `model:` is a no-op file there.
- **W4** — passive tools logger → `.bee/logs/tools.jsonl` (PostToolUse, fail-open, **zero enforcement**). It answers the one question nothing can answer today. New-hook surface is 9 files (catalog, wrapper, mirror, three projections, `.claude/settings.json`, contract-test `WRAPPERS`, toggle default). **Standing trap:** fail-open turns a crashed logger into universal green — the logger needs a test that **fails when the logger is broken**.

### Slice 4 — The orchestrator advisor path (AO2, AO3, AO4)

The user's core ask; `bee-executing/SKILL.md:74` explicitly rules it out today. **One** trigger in v1: **(b)** hard-gate/high-risk before Gate 3. Enforcement: **Gate 3 does not open** for hard-gate work without a non-stale `advisor_ref`; nothing blocked mid-flight; the worker close point stays `[BLOCKED]` exactly as shipped.

**Zero precedent — this is real plumbing.** `handleStateGate` (`bee.mjs:806-823`) validates a gate's *name* and writes the flag; **no gate anywhere checks a precondition.** Needs a new state field **and** a CLI verb (hive law 12).

**Staleness is settled (AO13):** a ref is stale if its feature differs from `state.feature`, or the newest active decision id changed, or `sha256(plan.md)` changed, or it predates the last revocation of the execution gate. **Not a TTL** — this feature already burned itself on one invented number.

**AO2(c) is deferred, not built (AO9).** Validating proved it has no mechanical detector against the current record shape; the `structured-decisions` feature is its prerequisite. Do not plan a proxy.

### Slice 5 — Worker-ise cell execution (AO1) — BLOCKED ON S1

The only part with leverage on the bill. Orchestrator's window becomes a control plane: cells, digests, cap results — never file bodies. Discretion: full `bee-swarming` dispatch vs a lighter direct Agent dispatch under the same execution contract.

### Slice 6 — The spec the user asked for (AO-deliverable)

`docs/specs/` area spec covering the advisor protocol **as a whole** — the shipped worker loop *and* the new orchestrator path — plus the orchestration contract. Owned by `bee-scribing`. **The absence of this spec is what let this feature's own CONTEXT.md be written on a false premise.** It is not a nice-to-have.

## Test Matrix (edge dimensions, scaled to high-risk)

| Dimension | Coverage this feature owes |
|---|---|
| **Malformed input** | `null` stdin, wrong-type `tool_input`, non-object payload → every new hook must have a row (learning 20260711: a stated fail-open contract is not implemented until malformed top-level input is a test-row class). |
| **Fail-open masking** | Sentinel-deny row in every hook suite; a logger test that **fails when the logger is broken**. |
| **Marker forgery** | `[bee-tier:]` embedded mid-content must still be rejected (decision 0023 regression row). |
| **Config shapes** | advisor as string / `{model,effort}` / `{kind:"cli"}` / `null` / unconfigured tier — the AO5 rule must be **type-based**, not string-based. |
| **Mirror drift** | `hooks/*.mjs` vs `.bee/bin/hooks/*.mjs` byte-identity; catalog projections vs rendered JSON (`test_hook_contracts.mjs:579-705`). |
| **Cross-platform** | New paths pass `scripts/test_portable_paths.mjs`; no non-ASCII in any `.ps1` (learning 20260714). |
| **Removal census** | The degenerate check's removal is verified by **invariants, not by grepping the names deleted** (learning 20260711); re-derive any constant computed from it. |
| **Migration** | An advisor previously *skipped* by the degenerate check will now be **consulted**. Blast radius small (shipped presets ship `advisor: null`) but the behavior change is real and belongs in the release note. |

## Current Slice — bounded, implementation-ready

**Slice 0 + Slice 1.** Three cells, no dependencies between them (all three may run in parallel):

| Cell | Lane | Files bounded to | Verify command (dry-run this session) |
|---|---|---|---|
| `ao-0` | standard | `hooks/test_model_guard.mjs`, `.bee/config.json` | `node hooks/test_model_guard.mjs && node hooks/test_write_guard.mjs && node hooks/test_hook_contracts.mjs && node skills/bee-hive/templates/tests/test_lib.mjs` — **correctly RED pre-fix (18 failures), goes green on completion** |
| `ao-s1` | spike | `.bee/spikes/advisor-and-orchestration/s1-tiny-worker.md` | `test -s <spike> && grep -qE '^## (Verdict\|Answer)' <spike>` — regex validated |
| `ao-s2` | spike | `.bee/spikes/advisor-and-orchestration/s2-payload-probe.md`, `probe-hook.mjs` | same shape, regex validated |

`ao-0` explicitly does **not** touch `hooks/bee-model-guard.mjs`: this cell restores the *ability to test* the guard; changing the guard is Slice 2. Neither spike writes source.

Slices 2–6 are shape only. No cell for them exists, and Gate 3 approval does not cover them.

## Rejected Shapes

- **Ship the whole thing as one slice.** Rejected: Slice 5 is blocked on a spike whose NO answer returns to the user; planning speculative cells on top of a locked-but-unproven decision is exactly the failure the round-2 review flagged.
- **Start with the guard (W1).** Rejected: its test suite is red and fail-opens. Fixing the guard first means proving it with a broken instrument.
- **Route as `standard`.** Rejected: 6 flags, two of them hard-gate. See Mode Gate.
