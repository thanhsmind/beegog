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

## Discovery-2 — L1 (Slice 2A): four probes against the real external CLI

The user's configured executor is `agy` (`/home/thanhsmind/.local/bin/agy`), driven as
`bash -lc 'agy -p "$(cat)" --model "Gemini 3.5 Flash (High)" --dangerously-skip-permissions --print-timeout 30m'`.
Everything below was **measured this session**, not reasoned about. Each row is a run.

| # | Probe | Result | Consequence |
|---|---|---|---|
| 1 | Read a repo file by relative path (`.bee/workers/canary.txt`, unique marker) | **PASS** — returned the marker byte-exact | A cli tier **can** serve as a read-only gather worker. This is the whole basis of Slice 2A. |
| 2 | Write a repo file by **relative** path, via the CLI's file tool | **SILENT FAILURE** — replied `WROTE`, exit 0, and **no file was created anywhere on disk** (`find` over `$HOME`, 10-minute window: zero hits) | A cli worker can **report success while having done nothing**. Decision 0019's "accept by file, never by exit" is not paranoia — it is load-bearing, and this is the run that proves it. |
| 3 | Write a repo file by **relative** path, via the CLI's shell tool | **WRONG TARGET** — the file was really created, inside `/home/thanhsmind/.gemini/antigravity-cli/scratch/.bee/workers/`. The CLI even narrated it: *"Created the directory `.bee/workers/` inside `/home/thanhsmind/.gemini/antigravity-cli/scratch`"* | **The external CLI's cwd is NOT the repo root**, and bee cannot make it so — the CLI relocates itself after launch. Every relative path in the shipped protocol (`.bee/workers/<id>.prompt.md`, `node .bee/bin/bee.mjs …`) misfires under such a CLI. |
| 4 | Write a repo file by **absolute** path | **PASS** — real file, real content, in the repo | The protocol is salvageable, and the fix is exact: **absolute paths everywhere in a cli worker's contract.** |

**What these four runs settle (and what they cost the plan):**

- **A cli-shaped `generation` tier is viable for gathers — read-only, digest-on-stdout.** That is precisely what the Delegation contract's I/O workers are, so the user's ask is achievable (W8).
- **A cli-shaped tier is NOT yet safe for *cell execution* under this CLI.** The execution contract requires the worker to run `.bee/bin` helpers (reserve → verify → cap → release) **against the repo** (`swarming-reference.md:91`: *"the external CLI must be able to edit the repo working tree and run node"*). Probe 3 shows those relative invocations would run in the CLI's private scratch — the helpers would touch a **phantom `.bee/`**, and reservations, caps, and verify results would all be written somewhere bee never reads, while the worker cheerfully reports done. **Slice 2A therefore ships the gather path only**; cli cell-execution stays gated behind W9's absolute-path rewrite plus its own dogfood.
- **Probe 2 is a new instance of a standing pattern**, not a new pattern: *fail-open turns a broken worker into green* (`critical-patterns.md:6`). Here the fail-open is the model's own claim of success. The countermeasure is already law (accept by artifact); Slice 2A's job is to make the *gather* path obey it too — for a gather, the artifact is the digest on stdout, and an empty/garbled digest is a failed run, never a silent one.

**Security note the user must see (it is their machine, but the house rule is explicit):** the configured command carries `--dangerously-skip-permissions`, while `swarming-reference.md:91` says *"never a machine-wide bypass (`--yolo`-style flags) as the house default"*, and AO8 puts advice-class slots read-only. A **gather** needs no write access at all. Probe 4 proves the flag is not decorative — with an absolute path this worker **can write anywhere the user can**.

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

### Slice 2 — SPLIT (see Discovery-2). 2A = the CLI-tier path; 2B = the rest of AO5/AO8.

Slice 2 as originally shaped (W1 + W2 + W6) is **split**, per the Scope-Reduction Prohibition — nothing is dropped, the boundary is drawn and the user chooses. The trigger: the user's own config exercises a path this plan never modelled — a **cli-shaped `generation` tier**, i.e. an out-of-family model doing the *gather* work, not just the *cell* work. Discovery-2 proves that path is broken in ways W1/W2/W6 never touch.

#### Slice 2A — Make a cli-shaped tier actually work (the user's ask)

- **W7 (new)** — **The External Executor invocation contract is wrong.** `bee-swarming/references/swarming-reference.md:85` tells the dispatcher to run `<command> -o <file> - < prompt.md`, **appending flags to the user's configured command**. Any command that is not codex-shaped breaks: with `bash -lc '…'` the `-o <file> -` lands on **bash**, not on the worker CLI. Fix: the configured command is invoked **verbatim**; the prompt goes in on **stdin**; stdout goes to the job log; **nothing is appended, ever.** Config is the authority — down to the argv.
- **W8 (new)** — **The Delegation contract has no cli branch at all.** `bee-hive/references/routing-and-contracts.md:201` names exactly two transports (`model` param, anchored marker) and presumes an Agent/Task dispatch unconditionally. Every skill's gather step cites it (`bee-exploring:23`, `bee-planning:45`, `bee-validating:35`, `bee-reviewing:89`, `bee-scribing:20`, `bee-compounding:29`, `bee-grooming:70`, `bee-briefing:69`, `bee-xia:30`, `bee-hive:67`) — **and so does every plain-conversation fan-out, where no skill routes at all.** `AGENTS.block.md:48` says "gathers default to the generation tier". So the moment `generation` is cli-shaped, the single most-travelled path in bee is undefined. Fix: the contract gains the `resolveTier(...).type === 'cli'` branch — a **read-only gather** runs the configured command via Bash, prompt on stdin, **stdout IS the digest**. No `result.json`, no cell, no reservation: a gather writes nothing, so the whole artifact-acceptance apparatus is not needed for it.
- **W9 (new)** — **Absolute paths are not a style preference; they are the contract.** Discovery-2 proves an external CLI's cwd is **not** the repo root and cannot be assumed to be. Every path handed to a cli worker — the contract file, `.bee/bin/bee.mjs`, the files it must touch — is **absolute**. The current protocol is relative throughout (`.bee/workers/<id>.prompt.md`, `node .bee/bin/bee.mjs …`), which under a sandboxing CLI misfires **silently and reports success**.
- **W10 (part of W1)** — `bee-model-guard.mjs:133`: `modelForTier(root,"generation","claude") || "generation"`. When the tier is cli-shaped `modelForTier` correctly returns `null` (by design, `state.mjs:703`), so the deny message's FIX line tells the agent to `pass model: "generation"` — **a model name that does not exist.** The guard's own remediation advice sends the agent into a second failure. Fix, per AO5: resolve the declared tier; if it is cli-shaped, **deny the Agent/Task dispatch** and point at the external-executor path instead of naming a model.
- **W11** — the dogfood. Decision 0019 self-reports **confidence 0.6** — "the dispatch protocol is prose and has NOT run a real external worker yet — first dogfood pending" (`0019:6`), and lists it under Deferred (`0019:41`). Slice 2A closes it with a real run, or reports honestly that it cannot.

#### Slice 2B — AO5's model-equality rule + the degenerate check + the read-only advisor (CURRENT slice)

- **W1 (remainder)** — **ABSORBED by 2A-iii (`ao-2aiii-1`).** The "no declared tier to compare against" question dissolved into B5's membership check: marker+param = strict equality, param-only = config membership. Nothing remains.
- **W2** — remove the degenerate check's strength ladder. Per AO5 verbatim: the configured advisor IS the advisor — *no family test, no strength test, no self-judged skip*; the check is "narrowed at most to the one honest no-op (advisor resolves to literally the same model as the worker)". Today's `bee-swarming/SKILL.md` §4 still carries the `haiku < sonnet < opus` ladder **and** a ceiling-always-skip — both are strength tests, both go. Prose-only: `resolveAdvisor` (state.mjs:1148) is a pure resolver with no ladder in code.
- **W6 (AO8)** — the advisor runs **read-only**. 2A-i's validator already refuses auto-approve flags (`--yolo`, `--dangerously-skip-permissions`) on every cli slot and the shipped commands are `-s read-only`. **Remainder measured 2026-07-17:** (a) a write-granting sandbox mode (`-s workspace-write`, `danger-full-access`) on an **advice-class** cli slot (advisor, review) passes the validator today — extend the blocklist for advice-class slots (honestly framed: known write-granting tokens, not a positive read-only guarantee); (b) **bee's own `.bee/config.json` fails its own validator** — both cli slots lack `promptVia: "stdin"` (`bee config validate` → 2 problems, measured) — migrate it and end on `ok: true`.

  ##### Slice 2B cells (current slice)

  | Cell | Lane | Files bounded to | Verify command |
  |---|---|---|---|
  | `ao-2b-1` | standard | `skills/bee-swarming/SKILL.md`, `skills/bee-swarming/references/swarming-reference.md`, `skills/bee-executing/SKILL.md`, their `.claude/skills/` + `.agents/skills/` mirrors, release manifest | `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs && node scripts/release_manifest.mjs --check` — AO5 form: consult whenever configured + trigger fires; only skip = literal same-model no-op; ladder and ceiling-skip deleted |
  | `ao-2b-2` | standard | `skills/bee-hive/templates/lib/state.mjs`, `.bee/bin/lib/state.mjs` (byte mirror), `skills/bee-hive/templates/tests/test_lib.mjs`, `.bee/config.json`, release manifest | `node skills/bee-hive/templates/tests/test_lib.mjs && node scripts/test_lib_mirror.mjs && node .bee/bin/bee.mjs config validate --json && node scripts/release_manifest.mjs --check` — advice-class writable-sandbox refusal rows + repo config migrated to `promptVia:"stdin"`, validate ends `ok:true` |

  Manifest overlap between the two cells is schedule-serialized (waves), not a dep.

**Still open, still owed to validating (unchanged):** AO5 says "enforced at config-validate time" — **there is no config-validate stage.** `normalizeModels`/`normalizeTierValue` (`state.mjs:108-124`) silently ignore invalid shapes; `bee.mjs` has no `config validate` verb; the only precedent is the passive `STALE_ADVISOR_NOTICE` (`state.mjs:679-689`), a warning not a refusal. The host must be **named**, and it is net-new plumbing.

#### Slice 2A — RE-PLAN (2026-07-17, after validation-slice-2a.md NOT-READY)

The prior 2A failed Gate 3 (7 blockers B1–B7 + W-e; 3 invalidate the premise, 1 is a live shipped defect). The four cells `ao-2a…2d` are dropped. Per Scope-Reduction Prohibition, 2A is **SPLIT into four ordered sub-slices** — nothing dropped, the safety-relevant work moves first so an unsafe/misconfigured cli can neither do damage nor silently degrade before the path that routes to it exists.

**Ordering (non-negotiable within 2A):** safety floor → structural boundary → guard integrity → dogfood. Cells are cut one sub-slice at a time; only the current sub-slice gets cells.

- **2A-i — Safety floor (SHIPPED 2026-07-17; cells ao-2ai-1, ao-2ai-2 capped).** Make the cli path safe and non-silent *before* anything routes to it.
  - **W-e / AO12 (B-config):** add a `bee config validate` verb backed by a shared validator in `state.mjs`, hosted in `bee status` (AO12 — never in `resolveTier`, which is on the fail-open hook hot path). It **loudly refuses** what today silently reverts to sonnet (`normalizeTierValue` → `undefined` → seeded default, `state.mjs:158-174,228`).
  - **B2 (validation half):** the validator refuses a cli tier whose command **cannot receive a prompt** — prompt transport becomes config's explicit declared job, not an appended `-`.
  - **B6 + B7:** the validator refuses a cli command carrying an auto-approve / `--dangerously-skip-permissions` / `--yolo`-style flag (today enforced by **zero lines**). Re-scope AO18; fix the shipped sample + `docs/model-presets.md` to read-only sandboxed presets.
  - **B3:** fix the broken shipped command — `workspace-write` is a **bare positional = the prompt**; it must be `-s workspace-write` and the stdin `-` must be present, or the executor never reads its prompt.
- **2A-ii — Structural boundary (SHIPPED 2026-07-17; cells ao-2aii-1, ao-2aii-2 capped, released as bee 1.4.0).** **B1:** purpose-scope `resolveTier` so a cli tier resolves for a **gather only**; a cli tier resolving for **cell execution** returns a typed refusal, not `{type:'cli'}` (prose is not a boundary). Add the Delegation-contract cli gather branch (ao-2b intent), now safe: read-only, stdout **IS** the digest, framed by a delimiter contract (`<<<BEE_DIGEST … BEE_DIGEST>>>`, W-a). Verbatim command, prompt on stdin, absolute paths (W7/W9).
  **Design settled at re-plan (2026-07-17):** `resolveTier(root, slot, runtime, purpose)` gains an optional 4th param `{for:'gather'|'cell'}` **defaulting to `'cell'`** — the fail-safe side: every existing 3-arg call (and any malformed/unknown purpose value) resolves as cell-execution and gets `{type:'refused', reason:'cli_tier_gather_only', ...}` when the tier is cli-shaped; only an explicit `{for:'gather'}` receives `{type:'cli', command}`. Non-cli values ignore purpose entirely (zero change). The refusal is a returned type, never a throw — `modelForTier` (the guard's hot path, `bee-model-guard.mjs:133`) keeps returning `null` for cli exactly as today. **Scope split settled at validation (plan-checker CRITICAL):** the resolveTier-level refusal applies to EVERY slot including `review` — a bare 3-arg resolve of a cli-shaped review slot returns `refused` in 2A-ii (the external-reviewer dispatch is a read-only gather, reachable via `{for:'gather'}`); only the *routing prose* updates (bee-reviewing/bee-validating/bee-swarming SKILL.md teaching the 4-arg call) wait for 2A-iii (B4(1)). Transitional state named in the release note: between 2A-ii and 2A-iii the documented 3-arg external-reviewer instruction resolves to `refused` — the mitigation is passing `{for:'gather'}`, which 2A-iii makes the documented form.
- **2A-iii — Guard integrity (CURRENT sub-slice).** **B4(2)/B5:** close the model-param short-circuit — read the declared tier **before** the model-param allow (`bee-model-guard.mjs:123-126`), and validate the param **equals** the model configured for that tier (reject `model:"banana"`). **B4(1):** a cli-shaped `review` slot **routes to the external-executor path**, it does not blanket-deny every `[bee-tier: review]` dispatch (plan-checker, panels, bee-reviewing).

  **Design settled at planning (2026-07-17).** The guard's decision order becomes: *read the declared tier first, then judge the model param against it.*

  1. **Marker + model param (AO5 equality):** resolve the declared tier (3-arg `resolveTier`, the guard guards subagent execution — the cell-default side). A tier resolving `{type:'model', model}` requires the param to **strictly equal** that model (trimmed); mismatch → deny, FIX names the configured model. A tier resolving to **no model name** (`inherit`/ceiling, `budget`) must **not** carry a model param — the tier label would lie in `dispatch.jsonl` while the dispatch really runs on the param; deny, FIX says drop the param or declare the tier that matches it.
  2. **Model param, no marker (B5 membership — needs no marker decision):** the param must be a **member** of the set of model names resolvable from the claude runtime's configured tier slots (`modelForTier` per slot; cli-shaped and null slots contribute nothing). `model:"banana"` → deny, FIX lists the configured models and the marker alternative (`[bee-tier: ceiling]` is the documented route for a session-model dispatch — a param outside config never is). Empty member set (unconfigured repo) → fail-open allow, exactly today's behavior.
  3. **Marker, no param (B4(1)/W10):** resolve the tier. Model/budget/inherit shapes → allow (today's behavior, now resolution-backed). A **cli-shaped** tier (3-arg resolve returns `{type:'refused', reason:'cli_tier_gather_only'}`) → **deny the Agent/Task dispatch** — an in-family subagent cannot *be* the external CLI — with a FIX that points at the external-executor gather path (Bash, verbatim command, prompt on stdin, `resolveTier(..., {for:'gather'})`) and **never names a phantom model**. A model-shaped `review` slot keeps allowing `[bee-tier: review]` dispatches — no blanket deny.
  4. **Bare (W10 fix):** deny as today, but the FIX line resolves the generation slot first — cli-shaped/null generation means the FIX points at marker tiers and the external-executor path instead of telling the agent to `pass model: "generation"`, a model that does not exist.
  5. **Fail-open discipline unchanged:** any resolution throw/unknown shape → allow (deny-only guard, crashes logged); no auto-injection or rewrite of the model param, ever; marker-forgery anchoring (P1-1) untouched.

  **Panel findings resolved at validation (2026-07-17):**
  - **BLOCKER-1 (fable lockout) — accepted by design.** `model:"fable"` with no configured fable slot becomes a non-member deny. The doctrinally honest form for a session-model dispatch was always `[bee-tier: ceiling]` (ceiling = the session model, which IS fable in a fable session), and a param-carried up-dispatch outside config is exactly the unaudited-transport shape this slice exists to close (ceiling scarcity must stay measurable). No hardcoded allowlist — config stays the sole authority. The deny FIX **teaches both escape routes** at the moment of denial (ceiling marker, or adding the model to a configured slot), a deny test row covers it, and the release note carries the behavior change. `CLAUDE.md`'s "use fable subagents" stays satisfiable via the ceiling marker; the file itself is user-authored and is not edited.
  - **WARNING-2 (opus leaves the member set if `claude.review` flips to cli) — designed behavior, pinned.** Config is the authority: a cli-shaped review slot *should* push in-family review dispatches to the external path, and the FIX text routes there. A test row pins today's model-shaped case (marker review + param opus allowed).
  - **WARNING-3 —** the cli-shaped and malformed-config test rows need new fixture builders (`buildDisabledFixture` pattern, `test_model_guard.mjs:71`); named in the cell action so a cold worker cannot under-scope.
  - **WARNING-4 —** the prose cell's `files` list now carries the `.claude/skills/` + `.agents/skills/` onboarding-synced mirrors and the release manifest (regen via `release_manifest.mjs --write` — cold-pickup CRITICAL from the cell review, same fix applied to `ao-2aiii-1`).

  **B4(1) prose half (deferred here from 2A-ii by design, plan-checker CRITICAL):** the three routing-prose sites still teaching the 3-arg call — `bee-swarming/SKILL.md:96` (cli branch still reads as *cell* dispatch), `bee-validating/SKILL.md:61` (plan-checker on the review slot), `bee-reviewing/SKILL.md:106` (external adversarial reviewer) — plus the code reference `swarming-reference.md:168,187` are updated to the 4-arg purpose-scoped form: external-reviewer/plan-checker dispatches are **read-only gathers** (`{for:'gather'}` → `{type:'cli', command}`); a cli-shaped tier on a **cell** returns `{type:'refused'}` and the orchestrator re-routes the cell to a model tier — cli cell execution stays gated behind W9's dogfood. This closes the 1.4.0 release note's named transitional state.

  ##### Slice 2A-iii cells (current sub-slice)

  | Cell | Lane | Files bounded to | Verify command |
  |---|---|---|---|
  | `ao-2aiii-1` | standard | `hooks/bee-model-guard.mjs`, `.bee/bin/hooks/bee-model-guard.mjs` (byte mirror), `hooks/test_model_guard.mjs` | `node hooks/test_model_guard.mjs && node hooks/test_write_guard.mjs && node hooks/test_hook_contracts.mjs && node scripts/release_manifest.mjs --check` — new rows: banana denied · equality mismatch denied · equality match allowed · membership match allowed · marker-without-param on model tier allowed · cli-shaped declared tier denied with external-executor FIX (asserts no phantom model name) · ceiling+param denied · bare-deny FIX under cli-shaped generation names no model · malformed/absent models config fail-opens · forgery rows regress green |
  | `ao-2aiii-2` | standard | `skills/bee-swarming/SKILL.md`, `skills/bee-validating/SKILL.md`, `skills/bee-reviewing/SKILL.md`, `skills/bee-swarming/references/swarming-reference.md` | `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs && node scripts/release_manifest.mjs --check` — deps: `ao-2aiii-1` (the prose cites the guard behavior that cell ships) |
- **2A-iv — Dogfood (CURRENT sub-slice; spike lane).** **W11 / W-f:** run one real gather **through `.bee/config.json`** (not a hand-typed `bash -lc`), closing decision 0019's pending first dogfood. GO/NO-GO recorded verbatim.

  **Shape settled at planning (2026-07-17).** One yes/no question: *does the Delegation contract's cli gather branch work end-to-end when the command comes from config resolution, not from a hand-typed line?* The config-resolvable cli slot today is `models.codex.review` (`codex exec -m gpt-5.5 -s read-only -c model_reasoning_effort="high" -`; `codex-cli 0.144.4` present at `~/.local/bin/codex`). The proof: resolve `resolveTier(root,'review','codex',{for:'gather'})` → `{type:'cli', command}` (measured green this session), run the returned command **verbatim** via Bash with a gather prompt on **stdin** demanding the `<<<BEE_DIGEST … BEE_DIGEST>>>` delimiter contract and absolute paths, capture stdout, extract the digest between delimiters. GO = a non-empty, factually correct digest between delimiters; NO-GO = anything else (empty, garbled, no delimiters — recorded verbatim either way, per W-a "no delimiters found = failed run"). Disposable record: `.bee/spikes/advisor-and-orchestration/2aiv-cli-gather-dogfood.md`. Spike lane: one cell `ao-2aiv-1`, no source edits, orchestrator-run (the cli gather is an orchestrator capability, critical rule 13's cli gather branch).

**Blast radius / test owed (high-risk):** every new refusal needs a malformed-input row (null/wrong-type config); the config-validate host must not throw on the hook hot path; a Bash-launched gather emits **zero** `dispatch.jsonl` rows (W-d) — measurement of the cli path is a known gap handed to Slice 3, not solved here.

##### Slice 2A-i cells (SHIPPED)

Created after Gate 2; both capped 2026-07-17 (`ao-2ai-1` config-validate verb + `validateModelsConfig` + 24-case suite; `ao-2ai-2` unsafe sample/doc cleanup + `test_config_samples_safe.mjs`).

##### Slice 2A-ii cells (current sub-slice)

| Cell | Lane | Files bounded to | Verify command |
|---|---|---|---|
| `ao-2aii-1` | standard | `skills/bee-hive/templates/lib/state.mjs`, `.bee/bin/lib/state.mjs` (byte mirror), `skills/bee-hive/templates/tests/test_lib.mjs`, release manifest | `node skills/bee-hive/templates/tests/test_lib.mjs && node scripts/test_lib_mirror.mjs && node hooks/test_model_guard.mjs && node scripts/release_manifest.mjs --check` — new rows: default/explicit-cell refusal, gather allow, malformed-purpose fail-safe, hot-path no-throw |
| `ao-2aii-2` | standard | `skills/bee-hive/references/routing-and-contracts.md`, `skills/bee-hive/templates/AGENTS.block.md`, root `AGENTS.md` (re-rendered via self-onboard), `skills/bee-hive/templates/tests/test_lib.mjs` (census anchors), release manifest | `node skills/bee-hive/templates/tests/test_lib.mjs && node scripts/test_gate_bypass_doctrine.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs && node scripts/release_manifest.mjs --check` — deps: `ao-2aii-1` (test_lib overlap; the branch text cites the refusal semantics) |

### Slice 3 — Visibility + measurement (AO1-logger, AO3-agents)

- **W3** — pinned agent types: `.claude/agents/bee-*.md` with `model:` in frontmatter (`bee-gather`=sonnet, `bee-extract`=haiku, `bee-review`=opus); guard rejects catch-all `general-purpose` for bee dispatches. **This explicitly does not reduce cost** (CONTEXT.md) — no cell or report may claim it does. **Sync (AO10, binding):** `.claude/agents/` **must not** become a third `REPO_SKILL_TARGETS` entry — the three-version preflight would resolve it as `unknown` (no `bee-hive` *directory* under an agents root) and **refuse onboarding permanently and non-forceably on every host**. It ships through a separate flat managed-file sync with its own version marker. **Codex (AO11):** documented asymmetry, not parity — Codex has no per-agent model selection, so a pinned `model:` is a no-op file there.
- **W4** — passive tools logger → `.bee/logs/tools.jsonl` (PostToolUse, fail-open, **zero enforcement**). It answers the one question nothing can answer today. New-hook surface is 9 files (catalog, wrapper, mirror, three projections, `.claude/settings.json`, contract-test `WRAPPERS`, toggle default). **Standing trap:** fail-open turns a crashed logger into universal green — the logger needs a test that **fails when the logger is broken**.

  **Slice 3A shape settled at planning (2026-07-17) — W4 only; W3 is 3B, unplanned.** One cell `ao-3a-1`, following the 8-existing-hook template exactly (surface mapped this session by extraction gather): catalog entry (PostToolUse, BOTH runtimes, **no matcher = every tool**, `cmd("bee-tools-logger.mjs", …)`); thin wrapper per the `bee-prompt-context.mjs` pattern (adapter → root → `hookEnabled(root,'tools-logger')` → append one JSON line to `.bee/logs/tools.jsonl`, everything fail-open, exit 0 always — a logger that can block a tool is a defect by definition); mirror; three projections re-rendered from the catalog (never hand-edited); `.claude/settings.json` PostToolUse group; `DEFAULT_HOOKS['tools-logger']: true` (`state.mjs:97-104` + lib mirror); `WRAPPERS` + malformed-input rows in `test_hook_contracts.mjs`. **Line schema (AO15, decision f1ca79b9):** `ts, tool_name, agent_id (null on orchestrator calls — field absent in payload), agent_type (ditto), duration/status only if the payload carries them; no tool_input bodies (PII/secret discipline — log names and attribution, never content).** **The fails-when-broken test:** a happy-path row runs the wrapper against a fixture root with a real PostToolUse payload and asserts the tools.jsonl line exists with `tool_name` + null-attribution; a crash-injection row (broken state.mjs fixture) asserts exit 0 AND a visible crash line in `.bee/logs/hooks.jsonl` — fail-open, never fail-silent. Cost claim ban (CONTEXT): no cell or report may claim W4 reduces cost — it measures.

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

## Current Slice — Slice 2A-iii (Slices 0, 1, 2A-i, 2A-ii are CLOSED; the pre-re-plan table below is historical — the four `ao-2a…2d` cells it names were dropped at the re-plan)

Slice 0 (hook suites repaired and wired into `commands.verify`), Slice 1 (both spikes; S2's verdict superseded by AO15), 2A-i (safety floor, bee 1.3.x) and 2A-ii (structural boundary, bee 1.4.0) are complete. Baseline verify is green this session (2026-07-17, post-1.4.0): full chain exit 0.

**Slice 2A — make a cli-shaped tier work for gathers, and prove it with a real run.**

| Cell | Lane | Files bounded to | Verify command |
|---|---|---|---|
| `ao-2a` | standard | `skills/bee-swarming/references/swarming-reference.md` | contract text: command invoked verbatim (nothing appended), prompt on stdin, **all worker-facing paths absolute**; asserted by a doc-contract test row |
| `ao-2b` | standard | `skills/bee-hive/references/routing-and-contracts.md`, `skills/bee-hive/templates/AGENTS.block.md` | the Delegation contract gains the `type === 'cli'` gather branch (stdout **is** the digest; empty digest = failed run) |
| `ao-2c` | standard | `hooks/bee-model-guard.mjs`, `.bee/bin/hooks/bee-model-guard.mjs` (byte-identical mirror), `hooks/test_model_guard.mjs` | `node hooks/test_model_guard.mjs && node hooks/test_write_guard.mjs && node hooks/test_hook_contracts.mjs` — new rows: a cli-shaped tier **denies** the Agent/Task dispatch, and the FIX line **never names a non-existent model** |
| `ao-2d` | spike | `.bee/spikes/advisor-and-orchestration/s3-cli-gather-dogfood.md` | a real `agy` gather run, end to end, digest captured — closes decision 0019's "first dogfood pending" (0.6) or reports honestly that it cannot |

**Ordering:** `ao-2a` and `ao-2b` are the contract; `ao-2c` is the guard that enforces it; `ao-2d` is the proof. `ao-2c` depends on nothing, but the config flip to `generation: {kind:"cli"}` happens **only after `ao-2d` returns green** — flipping first would route every gather in every session through an unproven path.

**Not in this slice, and not dropped:** Slice 2B (AO5 model-equality, W2 degenerate-check removal, W6 read-only advisor) and Slices 3–6. No cell for them exists, and Gate 3 approval does not cover them.

## Migration / release note (owed, carried forward)

Two behavior changes now owe the release note, not one:

1. **(from Slice 2B, still owed)** An advisor previously *skipped* by the degenerate check will now be **consulted**.
2. **(new, Slice 2A)** A cli-shaped tier changes how workers are invoked: the configured command is run **verbatim** — bee no longer appends `-o <file> -`. Any host that relied on bee adding those codex flags must put them in its own `command` string.

## Rejected Shapes

- **Ship the whole thing as one slice.** Rejected: Slice 5 is blocked on a spike whose NO answer returns to the user; planning speculative cells on top of a locked-but-unproven decision is exactly the failure the round-2 review flagged.
- **Start with the guard (W1).** Rejected: its test suite is red and fail-opens. Fixing the guard first means proving it with a broken instrument.
- **Route as `standard`.** Rejected: 6 flags, two of them hard-gate. See Mode Gate.
