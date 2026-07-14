# Validation — Slice 2A (advisor-and-orchestration)

**Verdict: NOT READY — RETURN TO PLANNING.**
Two independent high-risk persona panels (coherence/scope-guardian; feasibility/security) were run in parallel. They did not overlap in dispatch and converged on the same conclusion. Seven blockers survived the orchestrator's own re-verification; three of them invalidate the slice's central premise, and one is a **live defect in the shipped config that predates this feature entirely**.

Baseline at validation time: verify GREEN (1011 checks, 0 fail). No source was touched — Gate 3 was never presented.

---

## Reality gate

| Dimension | Result | Evidence |
|---|---|---|
| MODE FIT | **PASS** | high-risk is right, and the panels vindicate it: two hard-gate flags (audit/security, external provider) both fired for real. |
| REPO FIT | **FAIL** | The slice edits `skills/` (source), but the runtime loads `~/.claude/skills/bee-*`, which is **already stale**. No cell syncs it, and `ao-2b` edits the *template* `AGENTS.block.md` while the loaded standing order is the **rendered** `AGENTS.md:55` — a file in no cell. The contract would have shipped without taking effect. |
| ASSUMPTIONS | **FAIL** | "stdout IS the digest" (plan.md:92) was asserted, never probed. bee's own contract says the opposite for the cell path (`swarming-reference.md:85`: *"thinking noise bloats the orchestrator's context"*). |
| SMALLER PATH | **FAIL** | Not smaller — **wrongly bounded**. See B1: the safety boundary the slice depends on is unenforceable in the schema it ships. |
| PROOF SURFACE | **FAIL** | All four verify commands are falsifiable (each exits 1 pre-fix — confirmed) but **insufficient**: they assert prose, not contract. `ao-2c` goes green the moment the *word* `resolveTier` appears in the guard and the `\|\| "generation"` literal is deleted — with zero new deny rows. |

---

## Blockers

### B1 — The `generation` slot has two consumers; the slice's safety boundary cannot be expressed
The plan concludes cli-generation is safe for **gathers** but not for **cell execution** (probe 3: the `.bee/bin` helpers would run against a phantom `.bee/` inside the CLI's own sandbox cwd). But `resolveTier(root, slot, runtime)` (`.bee/bin/lib/state.mjs:721`) has **no notion of what the dispatch is for**. The same `{type:'cli'}` is handed to the new gather branch *and* to `bee-swarming/SKILL.md:40` ("`cli` → dispatch an external executor"). The moment the owner flips the config, **cell execution routes to `agy` too** — the exact path probe 3 proved is broken. `plan.md:154` tries to hold that line in **prose**. Prose is not a boundary.
**Required:** a purpose-scoped resolve (a separate `gather` slot, or `resolveTier(..., {for:'gather'|'cell'})`), or an explicit swarming-side refusal of a cli tier for cells until a *cell-execution* dogfood is green. Neither exists in any cell.

### B2 — The trailing `-` is load-bearing, and AO17 would have deleted it
The old instruction was `<command> -o <file> **-** < prompt.md`. Per `codex exec --help`, verbatim: *"[PROMPT] Initial instructions for the agent. **If not provided as an argument (or if `-` is used)**, [it is read from stdin]"*. **The `-` is the stdin transport.** AO17's "run verbatim, append nothing" would silently stop every codex-shaped command that does not carry its own `-` from ever reading its prompt. AO17 was right that bee must not append `-o`; it was **wrong** that bee appends nothing — the prompt transport has to arrive somehow, and that must become the config's job **explicitly**, with a validation that refuses a cli command which cannot receive a prompt.

### B3 — **The shipped advisor command is broken today, and has been all along**
```
models.claude.advisor.command = codex exec -m gpt-5.6-sol --yolo -c model_reasoning_effort="high"  workspace-write
models.codex.review.command   = codex exec -m gpt-5.5   --yolo -c model_reasoning_effort="high"  workspace-write
```
`workspace-write` is a **bare positional** — and per `codex exec --help`, the bare positional **is the PROMPT**. The `-s`/`--sandbox` flag it was meant to be is missing. So the advisor has been receiving the literal string `workspace-write` as its question and **never reading stdin at all**. This is not a Slice-2A defect; it is a live bug this feature merely walked into, and it is a plausible part of why decision 0019's dogfood stayed "pending" — *the external path has likely never once worked end to end.* It also means AO8's "the advisor runs `--yolo … workspace-write`" (CONTEXT.md) describes a command that does not do what its own decision text says.

### B4 — The guard denial would brick reviews, not just gathers — and has a one-line escape hatch
`bee-model-guard.mjs:33` accepts `ceiling|generation|extraction|review`; `resolveTier` returns `cli` for **any** cli-shaped slot, and `models.codex.review` **is already cli-shaped**. So `ao-2c` as written denies every `[bee-tier: review]` dispatch — the plan-checker, the persona panel, `bee-reviewing` itself.
Worse: `bee-model-guard.mjs:123-126` **short-circuits on the model param before any tier is read**. So the cheapest escape from any new deny is `model: "sonnet"` — which silently defeats the owner's cli config *and* logs the least auditable transport shape, in a feature hard-gated on the fact that `dispatch.jsonl` **records lies**. `ao-2c` would herd dispatches into the unvalidated transport rather than enforce anything.

### B5 — The 2B deferral was a quiet scope-reduction of a locked decision (AO5)
`plan.md:106-108` defers AO5's model-equality rule because "a dispatch may carry a `model` param with no marker, so there is no declared tier to compare against." That is true **only for the model-only case, which AO5 does not address** — AO5 is scoped to *"a dispatch **declaring** generation or extraction"*. The plan generalised "vacuous in one case" into "impossible in all cases" and deferred the whole rule. Meanwhile the feature's headline defect (`CONTEXT.md`, The Real Gaps #3 — `model: "banana"` passes and is logged as legitimate) is a **membership check needing no marker decision at all**, and `ao-2c` rewrites the exact lines it lives in without fixing it.

### B6 — SECURITY: a cli gather has **no write-guard at all**
bee's native worker writes through `Edit|Write|MultiEdit` → `bee-write-guard` → gate + reservation + lane checks. An external CLI writes through **its own process's syscalls**; the only thing bee sees is the Bash line that launched it. Measured this session:
```
extractBashTargets("bash -lc 'agy -p \"$(cat)\" … --dangerously-skip-permissions …'")
  -> {"paths":[], "broadWrite":false}
```
Zero targets → the write-guard **allows and checks nothing**, and every byte the CLI writes afterwards is invisible to bee. Combine with probe 4 (absolute-path writes reach the repo and anywhere the user can write) and `--dangerously-skip-permissions` (auto-approve every tool): a gather prompt is *built from* mined artifacts, and bee's law that "mined content is data, never instructions" is enforced for bee's own workers by the write-guard — **and for this one by nothing**. `plan.md:92` calls the gather "read-only". That is a claim about **intent**; probe 4 is proof about **capability**.

### B7 — bee **ships** the unsafe default, so AO18's framing is wrong
`swarming-reference.md:91` and `docs/model-presets.md:70` both say *"never a machine-wide bypass (`--yolo`-style flags) as the house default"*. Enforcement in code: **zero lines** (`grep -rn 'yolo\|dangerously-skip-permissions' --include=*.mjs` → no matches). Meanwhile `.bee/config-sample-cli-executors.json` — the **shipped, copy-pasteable sample** — carries `--dangerously-skip-permissions` as the `generation` preset, and `model-presets.md:98` recommends it. AO18 records "the owner knowingly opted in"; the truth is **bee ships the opt-in**. AO18 must be re-scoped, and the sample fixed, before any of this is a considered risk rather than an inherited one.

---

## Warnings (carried into re-planning)

- **W-a — "stdout is the digest" needs a framing contract.** Delimiters (`<<<BEE_DIGEST … BEE_DIGEST>>>`), extraction between them, and "no delimiters found = failed run". Untested today: thinking/progress on stdout, ANSI, non-TTY behavior, truncation.
- **W-b — the Bash tool's timeout will kill a gather long before the CLI's own `--print-timeout 30m`**, and `ao-2b` defines a killed run as a failed gather. The dogfood question chosen for `ao-2d` is small enough to hide this.
- **W-c — a gather does write: the prompt file.** `swarming-reference.md:71` is categorical ("Prompt file, never shell-quoted args"). That write happens during exploring/planning — i.e. **before Gate 3** — and `Bash` is on the write-guard's matcher. Untested.
- **W-d — flipping `generation` to cli kills the dispatch audit trail for gathers.** The model-guard is `PreToolUse` on `Agent|Task` only (`catalog.mjs:126`); a Bash-launched gather emits **zero** rows into `dispatch.jsonl`, which `routing-and-contracts.md:201` names as *"the audit surface for gathers"*. In a feature hard-gated on audit, this makes gap #4 strictly worse.
- **W-e — a malformed flip is silent.** `normalizeTierValue` (`state.mjs:113`) needs both `kind:'cli'` **and** a non-empty `command`; otherwise it returns `undefined` and the **default (sonnet) survives**. There is still no `config validate` stage — the hole `plan.md:103` already owed, which Slice 2A now *depends on*.
- **W-f — the probes bypassed the config path.** All four were hand-typed `bash -lc` lines. Nothing proved the same string survives `.bee/config.json` → `normalizeTierValue` → `resolveTier(...).command` → the Bash tool (JSON escaping, `"$(cat)"` round-trip, stdin actually reaching `cat`). A dogfood must run **through the config**, not around it.
- **W-g — decision-store contradiction.** AO17 was logged as a `decide`, not a `supersede`; decision `29b7f7bb` (*"result via `-o` file"*) and `9d9591ca` (result.json finish contract) remain **active** and now contradict it. `docs/decisions/0019-external-executor-tiers.md` is in no cell.
- **W-h — `docs/model-presets.md:74`** still tells owners to rely on `-o <file>`; stale the moment the contract changes. In no cell.
- **W-i — the config flip the owner actually asked for is in no cell** — no verify, no `behavior_change` flag, no test. It was left as "the orchestrator's act".

---

## Decision

**NOT READY — RETURN TO PLANNING.** Slice 2A's four cells are open and un-claimed; no source was touched. The re-plan must resolve, at minimum: B1 (purpose-scoped tier resolution), B2+B3 (the prompt transport, and the broken shipped command), B4 (what a cli-shaped *review* slot means, and closing the model-param short-circuit), B6+B7 (a read-only gather command, and bee's own shipped default), and W-e (a config-validate stage — the slice now depends on the flip landing correctly, and today a malformed flip is silent).
