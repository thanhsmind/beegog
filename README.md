# bee

**bee** is a lightweight, *validate-first* agentic-development plugin suite for **Claude Code** and **Codex**. It turns "vibe-coding with an AI" into a staged, gated workflow where the agent proves each step before taking the next, records what it learns, and gets less wrong over time.

It is distilled from seven upstream systems (khuym, claudekit, gsd-core, gstack, repository-harness, superpowers, compound-engineering) — bee keeps only the pieces that hold up in daily practice for a solo developer and throws away the rest.

> Docs are in English to match the codebase. Ask if you'd like a Vietnamese companion (`README.vi.md`).

---

## Why bee exists (the idea in plain words)

Letting an AI write code freely is fast until it isn't. The usual failure modes:

- It **starts coding before the goal is clear**, then you discover halfway that it built the wrong thing.
- It says "done" when it **hasn't actually checked** — "tests pass" with no test named, "should work" as evidence.
- It **forgets**: a rule you agreed three sessions ago is gone, so it re-asks or re-breaks it.
- On a big task it **loses the thread** two-thirds of the way through the context window.

bee's answer is four ideas working together:

1. **Gates** — the human approves at four irreversible moments (what to build, how, whether to start writing code, whether to merge). Between gates the agent runs on its own; at a gate it stops.
2. **Cells** — work is cut into small, self-contained task units, each with its own acceptance criteria and a real verify command. A cell **cannot be closed until its verification passes** — this is enforced by code, not by the agent's good intentions.
3. **Lanes** — ceremony scales with risk. A typo fix is one cell and a light touch; an auth change gets mandatory proof and a slower path. Memory never scales down: even a one-line fix that changes behavior updates the spec.
4. **Compounding** — finished work becomes durable knowledge: specs that survive a rewrite, a decision log, and "critical patterns" the next session reads first.

The result is meant to be *trustworthy, not ceremonial*: every "done" is backed by recorded evidence, and every gate is something you can restate in your own words before you approve it.

---

## The core concepts in one minute

| Concept | What it is | Why it matters |
|---|---|---|
| **Gate** | One of four human approval points (decisions → shape → execution → merge) | You stay in control at the moments that are expensive to undo |
| **Cell** | A small JSON task unit: what to do, files, acceptance criteria, verify command, trace | The atom of work; can't be "capped" (closed) without proof it passed |
| **Lane** | The size/risk class of the work: `tiny`, `small`, `standard`, `high-risk`, `spike` | Decides how much process the work gets — no epic ceremony for a typo |
| **Spec** | A tech-agnostic, BA-grade description of an *area* (a screen, API, job, process) in `docs/specs/` | The system's meaning, understandable without the code and rebuildable on any stack |
| **Decision** | An append-only log entry (`D<n>`) recording a locked choice + its rationale | Nothing agreed evaporates when the session closes |
| **Handoff** | A saved pause point written at ~65% context | Long work resumes cleanly next session — and never auto-resumes |

---

## The metaphor

A hive is a staged, self-regulating system — each bee role maps to a workflow stage:

| Hive role | bee skill | What it does |
|---|---|---|
| The hive itself | `bee-hive` | Bootstrap, routing, state, gates — load first in every session |
| Scout bees | `bee-exploring` | Lock fuzzy intent into decisions; scout *just enough* |
| Forager bees | `bee-xia` | Range beyond the hive: evidence-labeled research, reuse-first recommendations |
| Waggle dance | `bee-planning` | Communicate the found path precisely enough for workers to fly it |
| The beekeeper's brief | `bee-briefing` | Translate the dance for the human: one reviewable implement plan |
| Guard bees | `bee-validating` | Nothing enters the hive unproven: reality gate, feasibility evidence |
| The swarm | `bee-swarming` | Orchestrate bounded workers over validated cells |
| Worker bees | `bee-executing` | One worker, one cell: implement, verify, **cap the cell** |
| Inspector bees | `bee-reviewing` | Multi-agent review, artifact verification, UAT |
| Scribe bees | `bee-scribing` | The hive's BA: tech-agnostic specs of every area |
| Honey | `bee-compounding` | Convert finished work into durable knowledge |
| Undertaker bees | `bee-grooming` | Hunt and kill tech debt, drift, and dead work |
| Comb building | `bee-writing-skills` | TDD-for-skills: build and pressure-test the hive's own comb |
| The keeper's override | `bee-bypass-gate` | Opt-in autopilot: auto-approve low-risk gates (safety floor stays) |

---

## The workflow, explained simply

You describe what you want. bee routes it by size and risk, then walks it through the chain below. **Bold = you decide; everything else the agent does on its own.**

```
        bee-hive               reads your request, picks the lane, routes
           │
        bee-exploring          asks the sharp questions, writes down the decisions
           ▼
   ▶ GATE 1  "Are these the right decisions?"        ← you approve
           │
        bee-planning           shapes the work: the plan, the approach
        bee-briefing           writes a human-readable implement plan (bigger work)
           ▼
   ▶ GATE 2  "Is this the right thing, at the right size?"   ← you approve
           │
        bee-planning (prep)    cuts the work into cells for the current slice
        bee-validating         proves it's actually feasible against the real repo
           ▼
   ▶ GATE 3  "May I start editing real files?"        ← you approve  (most critical)
           │
        bee-swarming           spawns bounded workers
        bee-executing          one worker per cell: implement → verify → CAP
           │
        bee-reviewing          multi-agent review, verifies the work is real
           ▼
   ▶ GATE 4  "P1 issues block merge; otherwise, merge?"   ← you approve
           │
        bee-briefing           writes the walkthrough (what shipped + how to test)
        bee-scribing           updates the area specs (the durable meaning)
        bee-compounding        stores learnings + decisions for next time
           ▼
         done
```

Each gate is a single plain-language question with the machine detail linked, not dumped. You must be able to **restate what you're approving in your own words** — a gate you can't restate is worse than no gate.

Which artifacts get written scales with the work (decision 0009): a small/standard feature produces just `CONTEXT.md` + `plan.md`; separate `discovery.md` / `approach.md` / `implement-plan.md` files appear only for deeper research (L2+) or `high-risk` work. No more four documents restating the same "current state".

---

## What is a cell?

A **cell** is bee's unit of work — one honeycomb cell of the hive. It's a single JSON file in `.bee/cells/` that a "cold" worker (an agent with zero session history) can pick up and execute correctly, then close only with proof.

Think of it as a self-contained work ticket that is *executable* and *machine-checkable*.

```jsonc
{
  "id": "auth-3",
  "feature": "auth",
  "title": "Wire session middleware into the API router",
  "lane": "standard",                      // tiny | small | standard | high-risk | spike
  "status": "open",                        // open → claimed → capped | blocked | dropped
  "deps": ["auth-1", "auth-2"],            // this cell is "ready" only when these are capped
  "decisions": ["D2", "D4"],               // locked decisions it must honor (cited, never reinterpreted)
  "files": ["src/api/router.ts", "src/auth/middleware.ts"],  // everything it may write
  "read_first": ["src/api/router.ts"],     // what it must read before touching anything
  "action": "Mount the session middleware from auth-2 onto all /api/* routes (per D2). Preserve the public response envelope (per D4).",
  "must_haves": {                          // the contract — what "done" actually means
    "truths":       ["Unauthenticated /api/* requests return 401"],   // observable behavior
    "artifacts":    [{ "path": "src/auth/middleware.ts", "substantive": "exports authGuard, no TODO stubs" }],
    "key_links":    ["router.ts imports and mounts authGuard"],       // wired, not just present
    "prohibitions": ["No change to the public response envelope"]     // what must NOT change
  },
  "verify": "npm test -- auth",            // a REAL command that runs in this repo today
  "trace": { "worker": null, "outcome": null, "files_changed": [], "behavior_change": false,
             "verification_evidence": null /* ...filled in when the work is done... */ }
}
```

The rules that make a cell trustworthy:

- **Capping requires proof, not an assertion.** `bee_cells.mjs cap` **refuses** to close a cell unless a passing `verify` result is recorded. For `small`/`standard`/`high-risk` it also requires the verify's recorded output (or evidence) and a non-empty list of changed files — "verify_passed: true" with no output and no files is rejected.
- **Behavior changes need a "before".** If a cell changes observable behavior (`behavior_change: true`), capping also refuses without a *characterization of the prior behavior* — `red_failure_evidence` such as a `git show` of the old state, or a pre-change check that failed. This blocks "it works now" being accepted as proof that behavior actually changed, and it's captured at cap time (one command away) rather than backfilled later (decision 0009).
- **Ready = all deps capped.** `bee_cells.mjs ready` lists claimable cells. Only the orchestrator assigns them; workers never self-select.
- **Evidence lives in one place.** The cell's `trace` is the single source of verification evidence. Reports link to it; they never duplicate it.
- **Lane scales strictness.** A `tiny` cell may skip `must_haves` and record a one-line trace; a `high-risk` cell needs full `must_haves`, spike evidence, and a detailed trace.
- **One commit per cell**, with the cell id in the message.

`bee_status.mjs` and every downstream skill read the cell trace, so "what happened" is always machine-readable, never buried in chat.

---

## The four gates

Gates are **human** approvals, and three of them are enforced by code — the agent physically cannot proceed past Gate 3 without it being recorded.

| Gate | Asked after | What you're really deciding | If you get it wrong |
|---|---|---|---|
| **Gate 1** | exploring | Are these the decisions I meant? | Everything downstream builds on them — cheap to fix now, costly later |
| **Gate 2** | planning shape | Is this the right thing, at the right size? | Preparation gets built against the wrong shape |
| **Gate 3** | validating | May the agent start editing real files (this slice only)? | The most irreversible step — this is where code starts changing |
| **Gate 4** | reviewing | Does this go into the main branch? | P1 findings ship broken code to users |

Enforcement, not etiquette: until Gate 3 is approved, `bee_cells.mjs claim` throws and the write-guard hook **denies source edits** (while keeping `.bee/`, `docs/`, `.spikes/`, and `AGENTS.md` writable). Gate 4 never auto-merges past an open P1.

### Gate bypass (opt-in autopilot)

If you trust bee in a given repo and want speed, turn on **`bee-bypass-gate`** (`on` / `off` / `status`). When on, the agent stops asking at **Gates 1–3 for normal-lane work** — it takes its own recommendation, records the approval, logs it, and continues, posting a short `⚡ auto-approved Gate N` line instead of a question.

The safety floor is **absolute and not configurable**:

- **High-risk / hard-gate work always stops for you** — anything touching auth, authorization, data loss, security, an external provider, validation removal, or a database migration.
- **Gate 4 UAT and P1 always stop** — you still confirm the feature works; the merge auto-approves only when there are zero P1s and every UAT item passed.
- **Reading secrets always asks** — `.env`, keys, credentials, etc.

Bypass is **not** the same as headless mode (headless still stops at every gate). It's off by default, persists per-repo, and is surfaced loudly (`GATE BYPASS ON`) in the session preamble and `bee_status` so it's never silently in effect.

---

## How review works

Cell closure is *not* proof the feature works — so `bee-reviewing` is a separate quality gate before merge. It runs in five parts:

1. **Multi-agent specialist review.** Independent reviewers run in parallel, each with an *isolated* context (the diff + `CONTEXT.md` + `plan.md` only — never session history, so they can't be led):
   - always-on: **code-quality** (correctness, types), **architecture** (boundaries, coupling), **security** (auth, secrets, injection), **test-coverage** (missing cases, weak assertions), plus a **learnings-researcher** (finds precedent) and a **learnings-synthesizer** (dedupes, corroborates).
   - conditional (spawned only when the diff matches): **performance**, **api-contract**, **data-migration**, **reliability**.
2. **Severity + synthesis.** Every finding is **P1** (security / data loss / breaking change — blocks merge), **P2** (real perf/architecture/reliability/test gap), or **P3** (cleanup, docs, future debt). Uncertain → P2. When independent reviewers corroborate a finding, it's promoted one level. Each finding is written in a fixed shape: plain-language summary → what the code does today → why it matters → concrete failure scenario → file/line evidence → smallest credible fix.
3. **Verification-evidence gate.** For every capped `behavior_change` cell, the recorded evidence must name what was tested, what changed, the before-state, and the verification run. Vague evidence ("covered by existing tests", no test named) is itself a **P1** — the work goes back. (The cap helper now blocks the worst case at source, so this is a backstop.)
4. **Artifact verification.** For everything `CONTEXT.md` and `plan.md` promised, check three levels: **EXISTS** → **SUBSTANTIVE** (not a stub/TODO/fake path) → **WIRED** (imported and used on the real path). All three = OK; substantive-but-not-wired = P2; missing or exists-only = P1.
5. **Human UAT.** For each SEE/CALL/RUN decision in `CONTEXT.md`, you confirm it actually works (Pass / Fail / Skip). A fail spawns a P1 fix cell and re-runs that item; a skip needs a recorded reason. UAT failures are never logged as passes.

Then **Gate 4**: P1 > 0 blocks merge (fix cells run through swarming, review re-runs on the fix, repeat until zero or explicit override); P1 = 0 → "Approve merge?". P2/P3 findings are filed to the backlog as non-blocking follow-ups — they never hold up the current work.

---

## Lanes: ceremony scales with risk

Every planning pass counts mechanical **risk flags** (auth · authorization · data model · audit/security · external systems · public contracts · cross-platform · existing covered behavior · weak proof · multi-domain) and picks the smallest honest lane:

| Lane | When | What it gets |
|---|---|---|
| `tiny` | 0–1 flags, ≤2 files, one direct task | one cell, one-line trace, lightest review |
| `small` | 0–1 flags, ≤3 files, no gray areas | a cell or two, optional mini-brief |
| `standard` | 2–3 flags, or story-sized behavior | full cells + must_haves, one review pass |
| `high-risk` | 4+ flags, or any hard-gate flag | mandatory spikes/feasibility proof, strict trace, slower Gate 3 |
| `spike` | one yes/no question decides if the plan is real | a disposable experiment under `.spikes/`, answers then discards |

The rule that never bends: **lanes scale ceremony, never memory.** Even a `tiny` cell that changed behavior obliges a spec sync, and a settled decision is logged the moment it settles — in every lane.

A capped `behavior_change` cell also creates **scribing debt** until its meaning reaches `docs/specs/`: `bee_status`, the session preamble, and the swarming chain-nudge all surface the count so settled behavior is captured mid-flight, not only when someone remembers (decision 0011).

---

## Model tiers — keep the strong model scarce

Not every step needs your most capable (most expensive) model. The costly loops — try, read, fix, repeat — should run on a cheap model; the strong model should touch only the decision points. bee makes this a per-repo setting, **keyed by runtime** (Claude Code and Codex name their models differently):

```json
"models": {
  "claude": { "extraction": "haiku", "generation": "sonnet", "ceiling": "fable" },
  "codex":  { "extraction": null,    "generation": null,     "ceiling": null }
}
```

- **ceiling** — the strongest model, kept *scarce*: the orchestrator that plans and fans out, or a called-only advisor when a worker is stuck. Touch it on every dispatch and the cost saving evaporates.
- **generation** — the mid worker that runs the loops (implementation, tests) — where the bulk of work goes.
- **extraction** — cheapest capable (retrieval, mechanical edits).
- `null` = the runtime can't select a per-agent model (Codex today) → the tier is enforced as a read budget + output cap in the worker prompt. Set real ids (e.g. `"ceiling": "gpt-5-pro"`) if your runtime supports switching.

Planning assigns each cell a tier; `bee-swarming` resolves it to a model per dispatch (`modelForTier(root, tier, runtime)`). To keep the discipline honest, `bee_status` and the session preamble **warn when too many cells sit on the ceiling tier** (the cost lever erodes when the strongest model touches most dispatches).

Two shapes, one map — either way the strongest model stays in the `ceiling` slot:

- **Orchestrator** (fan-out): a ceiling-tier session plans and fans out to generation-tier workers. This is `bee-swarming`'s default.
- **Advisor** (opt-in, decision 0013): run the whole session on the *generation* tier and consult the *ceiling* model only at the hard calls. Turn it on per-repo with `"advisor": { "enabled": true, "at": ["shape", "execution", "blocked"] }` — at each point the agent asks one tight question, spawns one ceiling subagent for a verdict, records it, and continues cheap. It's surfaced loudly (`ADVISOR MODE ON`) and never self-approves a human gate.

**To change the ceiling model** (or any tier / advisor), edit `.bee/config.json` `models.claude.ceiling`. Every field, the runtime keys, and a full sample to copy: **[docs/config-reference.md](docs/config-reference.md)**.

---

## How a session flows (end to end)

bee has two layers that always work together:

1. **Runtime layer** (per machine) — the 14 `bee-*` skills the agent loads, plus (Claude Code) 6 lifecycle hooks.
2. **Repo layer** (per project) — the `AGENTS.md` BEE block, `.bee/` state, and 4 vendored helper CLIs that *mechanically* enforce the workflow for any agent, on any runtime.

```
you                         agent                              on disk
─────────────────────────── ────────────────────────────────── ─────────────────────────
open a session          →   hook prints the bee preamble       (reads .bee/state.json)
                            (phase, gates, critical patterns,
                            pending HANDOFF, bypass warning)
"add feature X"         →   bee-hive routes by scope + risk
                            bee-exploring locks decisions      docs/history/X/CONTEXT.md
you approve GATE 1      →
                            bee-planning shapes the work       plan.md (+ approach, if earned)
                            bee-briefing renders the brief     implement-plan.md (bigger work)
you approve GATE 2      →
                            bee-validating proves feasibility  reality gate, spikes, cells
you approve GATE 3      →   ← before this, source writes are DENIED by the write-guard
                            bee-swarming spawns workers
                            bee-executing: implement → verify  .bee/cells/<id>.json capped
                            → cap (refuses without proof +        (verify output + before-state
                               a recorded before-state)            recorded in the trace)
                            bee-reviewing: P1/P2/P3 + UAT
you approve GATE 4      →   (P1 findings block merge)
                            bee-briefing writes walkthrough    docs/history/X/walkthrough.md
                            bee-scribing syncs area specs      docs/specs/<area>.md
                            bee-compounding stores learnings   decisions, critical-patterns
```

If a session runs long, bee writes `.bee/HANDOFF.json` at ~65% context and pauses; the next session surfaces the handoff and **waits** — it never auto-resumes.

---

## Install

Run from inside your project (the current directory is the target by default):

```bash
curl -fsSL https://raw.githubusercontent.com/thanhsmind/beegog/main/scripts/install.sh | bash -s -- -y
```

```powershell
iwr -useb https://raw.githubusercontent.com/thanhsmind/beegog/main/scripts/install.ps1 -OutFile install-bee.ps1; .\install-bee.ps1 -Yes
```

Different directory: add `-d /path/to/project` (bash) / `-Directory C:\path\to\project` (PowerShell). Full options, the Claude Code plugin route (`/plugin marketplace add thanhsmind/beegog` + `/plugin install bee@bee`), manual installs, verify/update/uninstall: [INSTALL.md](INSTALL.md).

---

## Usage examples

bee is driven conversationally — you talk, the skills and helpers do the bookkeeping. In an onboarded repo:

| You say | What happens |
|---|---|
| "Onboard this repository for bee" | `bee-hive` runs `onboard_bee.mjs` (plan first, asks before `--apply`) |
| "Add CSV export to the report screen" | routed through the full chain, gated at 1–4 |
| "Fix the typo in the footer" | `tiny` lane: one cell, one worker, no epic ceremony |
| "Research: what's the best way to do X here?" | `bee-xia` writes an evidence-labeled brief (every claim tagged Local/Upstream/Docs/Inference, reuse-first) |
| "Chốt: we'll always soft-delete users" / "ship it" | settlement signal → `bee-scribing` captures it into the spec + decision log *same turn* |
| "Review this branch" | `bee-reviewing`: multi-agent review, P1/P2/P3 findings, UAT |
| "Turn on gate bypass" | `bee-bypass-gate on` → autopilot for low-risk gates (safety floor stays) |
| "Clean up tech debt" / "audit the hive" | `bee-grooming` hunts drift, dead work, stale reservations |
| "What did we decide about auth?" | reads the decision log (`bee_decisions.mjs search --text auth`) |

Poke the state directly from any terminal — the same commands the agents use:

```bash
node .bee/bin/bee_status.mjs --json            # where am I? phase, gates, cells, bypass, next action
node .bee/bin/bee_cells.mjs list               # all cells; `ready` = open cells with deps capped
node .bee/bin/bee_decisions.mjs active         # decisions currently in force

# verify the enforcement is armed (expected to refuse before Gate 3):
node .bee/bin/bee_cells.mjs claim --id anything --worker w1
# → error: gate "execution" is not approved   ✔
```

---

## Under the hood

Everything is Node 18+ ESM, **zero npm dependencies**, atomic writes, Windows-safe paths. Helpers exit non-zero with a one-line `{error}` JSON on `--json`; hooks never break a session (fail-open, crash-logged to `.bee/logs/hooks.jsonl`).

### Vendored helpers — `<repo>/.bee/bin/` (source: `skills/bee-hive/templates/`)

Copied into every onboarded repo, so enforcement works even for agents that ignore instructions.

- **`bee_status.mjs`** — one-shot situational scout: onboarding health, phase/mode/feature, gate states, **gate-bypass state**, cell counts, **scribing debt** (uncaptured behavior changes), **model-tier map**, reservations, recent decisions, staleness warnings, recommended next action. First command of every session.
- **`bee_cells.mjs`** — the cell lifecycle: `list` / `ready` / `show` / `add` / `claim` (throws unless Gate 3 approved + deps capped) / `verify` / `cap` (refuses without recorded proof; `behavior_change` cells also require a before-state) / `block` / `drop`.
- **`bee_reservations.mjs`** — file-level conflict prevention between parallel workers: `reserve` / `release` / `list` / `sweep` (release expired TTLs). On overlap → `{ok:false, conflicts}`; the caller must return `[BLOCKED]`.
- **`bee_decisions.mjs`** — append-only decision log (rejects secrets and injection patterns): `log` / `supersede` / `redact` / `active` / `search`.

### Onboarding — `skills/bee-hive/scripts/onboard_bee.mjs`

```bash
node onboard_bee.mjs --repo-root <path> [--apply] [--json] [--repo-hooks] [--claude-md]
```

Without `--apply` it only reports the plan. With `--apply` it installs/refreshes the AGENTS.md BEE block, `.bee/` runtime files, and the vendored helpers — **never** overwriting your `state.json`, `decisions.jsonl`, or `cells/`. Re-run after pulling a new bee version; it detects drift via managed hashes in `.bee/onboarding.json`.

### Hooks — `hooks/` (Claude Code; the plugin route loads them automatically)

Self-arming (silent unless the repo has `.bee/onboarding.json`); per-repo kill switch in `.bee/config.json → hooks.<name>`.

| Hook | Fires on | Does |
|---|---|---|
| `bee-session-init.mjs` | session start/resume/compact | prints the bee preamble (phase, gates, handoff, critical patterns, bypass warning) |
| `bee-prompt-context.mjs` | each user prompt | short reminder of phase/next action, deduped |
| `bee-write-guard.mjs` | before Edit/Write/Bash/Read/… | denies source writes pre-Gate-3, unreserved conflicting writes while swarming, and secret-file reads |
| `bee-state-sync.mjs` | after task tools / stop | refreshes cell counts + last activity into `state.json` |
| `bee-chain-nudge.mjs` | subagent stop | nudges the orchestrator to collect worker status / synthesize reviews |
| `bee-session-close.mjs` | session stop | warns about claimed-uncapped cells, missing HANDOFF, or unlogged decisions |

Codex has no hooks — by design the same rules hold there because the *helpers* enforce them and the AGENTS.md block covers bootstrap. Parity matrix: [docs/06-runtime-integration.md](docs/06-runtime-integration.md).

### Runtime files — `<repo>/.bee/`

| File | Holds |
|---|---|
| `onboarding.json` | installed bee version + managed-file hashes (drift detection) |
| `state.json` | phase, mode, feature, the four gate approvals, workers, next action |
| `config.json` | per-repo hook/guard toggles, lanes, capabilities, **`gate_bypass`**, **`models`** (runtime-keyed tier→model map), **`advisor`** (cheap-loop + ceiling-consult mode) |
| `HANDOFF.json` | pause context at ~65% budget — surfaced next session, never auto-resumed |
| `cells/<id>.json` | one cell each: acceptance criteria, verify command, full trace |
| `decisions.jsonl` / `backlog.jsonl` | append-only decision events / friction & grooming items |
| `reservations.json` | active file reservations (TTL-bounded) |
| `logs/hooks.jsonl` | hook crash/audit log |

---

## Documents

| Doc | Read when |
|---|---|
| [config-reference.md](docs/config-reference.md) | You want to configure `.bee/config.json` — models/ceiling, advisor, commands, bypass (with a sample to copy) |
| [00-vision.md](docs/00-vision.md) | You want the principles and non-goals |
| [01-distillation.md](docs/01-distillation.md) | What bee took from each upstream framework, and what it rejected |
| [02-architecture.md](docs/02-architecture.md) | Plugin layout, dual-runtime support, runtime files, cell schema, state model |
| [03-workflow.md](docs/03-workflow.md) | The full stage-by-stage workflow contract: artifacts, gates, modes, lanes |
| [04-skills-spec.md](docs/04-skills-spec.md) | You are about to write a SKILL.md — per-skill specifications |
| [06-runtime-integration.md](docs/06-runtime-integration.md) | Claude Code hook automation + Codex parity matrix |
| [07-contracts.md](docs/07-contracts.md) | You are implementing or extending v0.1 — lib API, CLI surface, hook behaviors |
| [decisions/](docs/decisions/) | Why bee is shaped the way it is — one record per load-bearing choice (0001–0014) |

---

## Status

**v0.1.13.** Core built and green: the skills, the 6-hook automation skeleton, 4 vendored helpers over a shared `lib/`, onboarding for both runtimes, and the lib/onboarding test suites — smoke-tested end to end (onboard → gate-locked claim → verify-gated cap → hook denials).

Recent additions, each gated by a decision record:

- **`bee-scribing`** (0002) — a dedicated BA that keeps `docs/specs/` at BA grade so any area can be understood without the code and rebuilt on another stack.
- **`bee-xia`** (0005) — the anti-reinvention research scout: evidence-labeled briefs, reuse-first recommendations.
- **`bee-briefing`** (0008) — the beekeeper's brief: one human-readable implement plan per feature, plus the post-ship walkthrough.
- **Artifact scaling + cap-time before-state** (0009) — planning stops fanning out four overlapping documents for small work; capping a behavior change now requires a recorded "before".
- **`bee-bypass-gate`** (0010) — opt-in autopilot that auto-approves low-risk gates while keeping an absolute safety floor (high-risk/hard-gate, Gate 4 UAT, and secrets always stop).
- **Capture-mode spine / scribing debt** (0011) — behavior_change cells capped since the last spec sync are counted as *scribing debt* and surfaced in `bee_status`, the preamble, and the swarming nudge, so settled behavior reaches `docs/specs/` mid-flight instead of only when a human remembers.
- **Runtime-keyed model tiers + scarcity signal** (0012) — a per-repo `models` map (claude/codex → extraction/generation/ceiling) with a `modelForTier` resolver; cells carry a `tier`, swarming resolves tier → model, and `bee_status`/preamble warn when the ceiling share runs high — keeping the strongest model scarce.
- **Advisor mode** (0013) — opt-in: run the session on the generation tier and consult the ceiling model only at the hard calls (Gate 2/3, `[BLOCKED]`), one scarce call per point. The inverse of the orchestrator pattern; both keep the strongest model scarce.
- **Grooming is project-first** (0014) — the hygiene pass hunts the *current project's* debt in plain language; `.bee/`, `.claude/`, `.codex/` and bee's own plumbing are out of scope (a harness bug becomes a one-line upstream note, not a project kill), and the entropy score is demoted to a short hive-housekeeping side-note. Also fixes two real bugs it caught: `capCell` now honors a cell's declared `behavior_change` even when the CLI flag is omitted, and the write-guard no longer misreads `2>&1` as a file write. (Note: updating skills requires copying `skills/*` into `~/.claude/skills` + `~/.codex/skills` — `onboard` only refreshes the per-repo `.bee/bin/`.)

**Known debt before 1.0** (recorded in each skill's `CREATION-LOG.md`): the newer skills and the two most recent decisions have not yet been dogfooded/pressure-tested per bee's own Iron Law; the gate-bypass safety floor in particular wants RED-baseline testing on a real high-risk feature.

Try it: onboard a repo, scout with `bee_status`, then ask the agent for a tiny fix and watch it route.
