# bee

**bee** is a lightweight, validate-first agentic development plugin suite for **Claude Code** and **Codex**, distilled from the strongest ideas of seven upstream systems: khuym, claudekit, gsd-core, gstack, repository-harness, superpowers, and compound-engineering.

bee is not a greenfield framework. Like khuym before it, bee sits downstream of proven agentic-development systems and keeps only the pieces that hold up in practice for a solo developer: a staged workflow with hard gates, evidence-based validation, bounded multi-agent execution, and a compounding knowledge loop that makes both the human and the agents less wrong over time.

## The metaphor

A hive is a staged, self-regulating system — and every bee role maps to a workflow stage:

| Hive role | bee skill | What it does |
|---|---|---|
| The hive itself | `bee-hive` | Bootstrap, routing, state, gates — load first in every session |
| Scout bees | `bee-exploring` | Find the nectar: lock fuzzy intent into decisions, scout *just enough* |
| Forager bees | `bee-xia` | Range beyond the hive: evidence-labeled research, reuse-first recommendations |
| Waggle dance | `bee-planning` | Communicate the found path precisely enough that workers can fly it |
| Guard bees | `bee-validating` | Nothing enters the hive unproven: reality gate, feasibility evidence |
| The swarm | `bee-swarming` | Orchestrate bounded workers over validated cells |
| Worker bees | `bee-executing` | One worker, one cell: implement, verify, **cap the cell** |
| Inspector bees | `bee-reviewing` | Multi-agent review, artifact verification, UAT |
| Scribe bees | `bee-scribing` | The hive's BA: tech-agnostic specs of every area — meaning survives any rewrite |
| Honey | `bee-compounding` | Convert finished work into durable knowledge |
| Undertaker bees | `bee-grooming` | Hunt and kill tech debt, drift, and dead work |
| Comb building | `bee-writing-skills` | TDD-for-skills: build and pressure-test the hive's own comb |

A **cell** is bee's task unit (honeycomb cell): a small JSON record with acceptance criteria and a verify command. A cell is **capped** (closed) only after its verification passes — never before.

## The chain

```
bee-hive
  -> bee-exploring     writes  docs/history/<feature>/CONTEXT.md        [GATE 1: human approves decisions]
  -> bee-planning      writes  discovery, approach, work shape      [GATE 2: human approves shape]
  -> bee-validating    writes  feasibility evidence, validated cells [GATE 3: human approves execution]
  -> bee-swarming      spawns  bounded workers
  -> bee-executing     caps    one verified cell per worker
  -> bee-reviewing     writes  P1/P2/P3 findings                    [GATE 4: P1s block merge]
  -> bee-scribing      writes  docs/specs/<area>.md — BA-grade, tech-agnostic area specs
  -> bee-compounding   writes  learnings + decisions
  (on demand) bee-xia         researches a topic standalone; also runs inside planning discovery L2/L3
  (on demand) bee-scribing    captures settled outcomes from discussion/testing; backfills legacy areas
  (on demand) bee-grooming    kills tech debt, audits hive health
```

## Install

Quick (greenfield or brownfield, both runtimes) — run from inside your project; the current directory is the target by default:

```bash
curl -fsSL https://raw.githubusercontent.com/thanhsmind/beegog/main/scripts/install.sh | bash -s -- -y
```

```powershell
iwr -useb https://raw.githubusercontent.com/thanhsmind/beegog/main/scripts/install.ps1 -OutFile install-bee.ps1; .\install-bee.ps1 -Yes
```

Installing into a different directory: add `-d /path/to/project` (bash) / `-Directory C:\path\to\project` (PowerShell).

Full options, the Claude Code plugin route (`/plugin marketplace add thanhsmind/beegog` + `/plugin install bee@bee`), manual installs, verify/update/uninstall: [INSTALL.md](INSTALL.md).

## How a session flows

bee has two layers that always work together:

1. **Runtime layer** (per machine) — the 12 `bee-*` skills the agent loads, plus (Claude Code) 6 lifecycle hooks.
2. **Repo layer** (per project) — the `AGENTS.md` BEE block, `.bee/` state, and 4 vendored helper CLIs that *mechanically* enforce the workflow for any agent, on any runtime.

A typical run, end to end:

```
you                         agent                              on disk
─────────────────────────── ────────────────────────────────── ─────────────────────────
open a session          →   hook prints the bee preamble       (reads .bee/state.json)
                            (phase, gates, critical patterns,
                            pending HANDOFF if any)
"add feature X"         →   bee-hive routes by scope + risk
                            bee-exploring locks decisions      docs/history/X/CONTEXT.md
you approve GATE 1      →
                            bee-planning shapes the work       plan.md, approach.md
you approve GATE 2      →
                            bee-validating proves feasibility  reality gate, spikes, cells
you approve GATE 3      →   ← before this, source writes are DENIED by the write-guard
                            bee-swarming spawns workers
                            bee-executing: implement → verify  .bee/cells/<id>.json capped
                            → cap (cap refuses without a          (verify output recorded)
                            recorded passing verify)
                            bee-reviewing: P1/P2/P3 findings
you approve GATE 4      →   (P1 findings block merge)
                            bee-scribing syncs area specs      docs/specs/<area>.md
                            bee-compounding stores learnings   decisions, critical-patterns
```

Two properties make this trustworthy rather than ceremonial:

- **Gates are human approvals, enforced by code.** Until Gate 3 is approved, `bee_cells.mjs claim` throws and the write-guard hook denies source edits (`.bee/`, `docs/`, `.spikes/`, `plans/`, `AGENTS.md` stay writable). No agent good intentions involved.
- **Ceremony scales with risk, memory never does.** Every planning pass classifies the work into a lane — `tiny` / `spike` / `small` / `standard` / `high-risk` — using mechanical risk flags (auth, data model, external systems, …). A typo fix is one cell and one lightweight review; an auth change gets mandatory spikes and a slower Gate 3. But in *every* lane, a capped cell that changed behavior obliges a spec sync, and settled decisions get logged the moment they settle.

If a session runs long, bee writes `.bee/HANDOFF.json` at ~65% context and pauses; the next session surfaces the handoff and **waits** — it never auto-resumes.

## Usage examples

bee is driven conversationally — you talk to the agent, the skills and helpers do the bookkeeping. In an onboarded repo:

| You say | What happens |
|---|---|
| "Onboard this repository for bee" | `bee-hive` runs `onboard_bee.mjs` (plan first, asks before `--apply`) |
| "Add CSV export to the report screen" | routed through the full chain above, gated at 1–4 |
| "Fix the typo in the footer" | tiny lane: one cell, one worker, no epic ceremony |
| "Research: what's the best way to do X here?" | `bee-xia` writes an evidence-labeled brief in `docs/history/research/` (every claim tagged Local/Upstream/Docs/Inference, reuse-first recommendation) |
| "Chốt: we'll always soft-delete users" / "final, ship it" | settlement signal → `bee-scribing` captures it into the area spec + decision log *same turn* |
| "Review this branch" | `bee-reviewing`: multi-agent review, P1/P2/P3 findings |
| "Clean up tech debt" / "audit the hive" | `bee-grooming` hunts drift, dead work, stale reservations |
| "What did we decide about auth?" | reads the decision log (`bee_decisions.mjs search --text auth`) |

You can also poke the state directly from any terminal — same commands the agents use:

```bash
node .bee/bin/bee_status.mjs --json            # where am I? phase, gates, cells, next action
node .bee/bin/bee_cells.mjs list               # all cells; `ready` = open cells with deps capped
node .bee/bin/bee_decisions.mjs active         # decisions currently in force
```

And verify the enforcement is armed (expected to refuse):

```bash
node .bee/bin/bee_cells.mjs claim --id anything --worker w1
# → error: gate "execution" is not approved   ✔
```

## Scripts & CLI reference

Everything is Node 18+ ESM, **zero npm dependencies**, atomic writes, Windows-safe paths. Helpers exit non-zero with a one-line `{error}` JSON on `--json`; hooks never break a session (fail-open, crash-logged to `.bee/logs/hooks.jsonl`).

### Installers — `scripts/`

| Script | Platform | What it does |
|---|---|---|
| `install.sh` | macOS / Linux / Git Bash | fetch bee, install skills for chosen runtimes, onboard the target repo |
| `install.ps1` | Windows PowerShell | same, PowerShell-native |

Both take the same flags (`--dry-run`, `--runtime claude\|codex\|both`, `--claude-md`, `--no-hooks`, `--source <path>`, `-y`) — full table in [INSTALL.md](INSTALL.md). Idempotent; existing `AGENTS.md`/`CLAUDE.md` content outside the BEE markers is preserved byte-for-byte.

### Onboarding — `skills/bee-hive/scripts/onboard_bee.mjs`

```bash
node onboard_bee.mjs --repo-root <path> [--apply] [--json] [--repo-hooks] [--claude-md]
```

Without `--apply` it only reports the plan (`up_to_date` | `changes_needed`). With `--apply` it installs/refreshes: the AGENTS.md BEE block (between `<!-- BEE:START/END -->` markers), `.bee/` runtime files, and the vendored helpers below. Existing `state.json`, `decisions.jsonl`, and `cells/` are **never** overwritten. Re-run after pulling a new bee version — it detects drift via managed hashes in `.bee/onboarding.json`. `--repo-hooks` additionally wires the 6 hooks into `<repo>/.claude/settings.json` (for the no-plugin route); `--claude-md` adds an `@AGENTS.md` import to CLAUDE.md.

### Vendored helpers — `<repo>/.bee/bin/` (source: `skills/bee-hive/templates/`)

Copied into every onboarded repo, so enforcement works even for agents that ignore instructions. All support `--json`.

**`bee_status.mjs`** — one-shot situational scout: onboarding health, phase/mode/feature, gate states, cell counts, active reservations, recent decisions, staleness warnings, recommended next action. First command of every session.

**`bee_cells.mjs`** — the task unit lifecycle:

```
list [--feature F] [--status S] | ready [--feature F] | show --id ID
add --file cell.json  (or --stdin)          # validates schema, lane, must_haves
claim --id ID --worker NAME                 # THROWS unless Gate 3 approved + deps capped
verify --id ID --command CMD --passed true|false [--output TEXT | --output-file F]
cap --id ID [--outcome TEXT] [--files a,b] [--behavior-change] [--evidence-file F] ...
                                            # REFUSES without a recorded passing verify;
                                            # small/standard/high-risk also need output/evidence + files
block --id ID --reason R | drop --id ID --reason R
```

**`bee_reservations.mjs`** — file-level conflict prevention between parallel workers:

```
reserve --agent A --cell C --path P [--ttl N]   # {ok:false, conflicts} on overlap
release --agent A [--cell C] | list [--active-only] | sweep   # sweep = release expired TTLs
```

**`bee_decisions.mjs`** — append-only decision log (injection-hardened: rejects secrets and prompt-injection patterns):

```
log --decision D --rationale R [--alternatives A] [--scope S] [--confidence N]
supersede --id UUID --decision D --rationale R | redact --id UUID --reason R
active [--recent N] | search --text T
```

### Hooks — `hooks/` (Claude Code; plugin route loads them automatically)

Self-arming: every hook exits silently unless the repo has `.bee/onboarding.json`. Per-repo kill switch in `.bee/config.json → hooks.<name>`.

| Hook | Fires on | Does |
|---|---|---|
| `bee-session-init.mjs` | session start/resume/compact | prints the bee preamble (phase, gates, handoff, critical-patterns digest) |
| `bee-prompt-context.mjs` | each user prompt | 1–3 line reminder of phase/next action, deduped (only when changed or >30 min) |
| `bee-write-guard.mjs` | before Edit/Write/Bash/Read/… | denies source writes pre-Gate-3, unreserved conflicting writes while swarming, secret-file reads; also gates ad-hoc edits while the hive is idle |
| `bee-state-sync.mjs` | after task tools / stop | refreshes cell counts + last activity into `state.json` |
| `bee-chain-nudge.mjs` | subagent stop | nudges the orchestrator to collect worker status / synthesize reviews |
| `bee-session-close.mjs` | session stop | warns about claimed-uncapped cells or a missing HANDOFF; when idle, nudges a decision review if source changed with nothing logged |

Codex has no hooks — by design the same rules hold there because the *helpers* enforce them; the AGENTS.md BEE block covers bootstrap. Parity matrix: [docs/06-runtime-integration.md](docs/06-runtime-integration.md).

### Runtime files — `<repo>/.bee/`

| File | Holds |
|---|---|
| `onboarding.json` | installed bee version + managed-file hashes (drift detection) |
| `state.json` | phase, mode, feature, the four gate approvals, workers, next action |
| `config.json` | per-repo hook/guard toggles, lanes, capabilities |
| `HANDOFF.json` | pause context at ~65% budget — surfaced next session, never auto-resumed |
| `cells/<id>.json` | one task unit each: acceptance criteria, verify command, full trace |
| `decisions.jsonl` / `backlog.jsonl` | append-only decision events / friction & grooming items |
| `reservations.json` | active file reservations (TTL-bounded) |
| `logs/hooks.jsonl` | hook crash/audit log |

## Documents

| Doc | Read when |
|---|---|
| [00-vision.md](docs/00-vision.md) | You want the principles and non-goals |
| [01-distillation.md](docs/01-distillation.md) | You want to know what bee took from each upstream framework, and what it deliberately rejected |
| [02-architecture.md](docs/02-architecture.md) | You want the plugin layout, dual-runtime (Claude Code + Codex) support, runtime files, and state model |
| [03-workflow.md](docs/03-workflow.md) | You want the full stage-by-stage workflow contract: artifacts, gates, modes, lanes |
| [04-skills-spec.md](docs/04-skills-spec.md) | You are about to write a SKILL.md — per-skill specifications |
| [05-roadmap.md](docs/05-roadmap.md) | You want the build order for bee itself |
| [06-runtime-integration.md](docs/06-runtime-integration.md) | You want the Claude Code hook automation skeleton and the Codex parity matrix — how both runtimes get first-class, mechanically-enforced support |
| [07-contracts.md](docs/07-contracts.md) | You are implementing or extending v0.1 — lib API, CLI surface, hook behaviors |
| [08-harness-adoption.md](docs/08-harness-adoption.md) | You want the repository-harness deep-dive: what else to adopt (intake records, interventions, verify-all, propose rules, maturity ladder, worktree isolation) |

## Status

**v0.1.0 built.** The original 10 skills, the 6-hook automation skeleton, 4 vendored helpers over a shared `lib/`, onboarding for both runtimes, and two test suites (28 lib contract tests + onboarding/idempotency/`--repo-hooks` tests) — all green, smoke-tested end-to-end (onboard → gate-locked claim → verify-gated cap → hook denials).

**bee-scribing added** (decision 0002, which also replaced the ten-skill hard cap with a decision gate): the 11th skill — a dedicated BA that keeps `docs/specs/` at BA grade (data dictionaries, behaviors & operations, actor access, business rules; technology quarantined to one Pointers section) so any area — screen, API, background job, integration, pipeline, process — can be understood without the code and rebuilt on another stack. Runs in the chain between reviewing and compounding, plus on-demand capture (any settled outcome of a discuss → build → test → adjust loop is logged and merged immediately) and harvest (backfill legacy areas) modes. Not yet dogfooded.

**bee-xia added** (decision 0005): the 12th skill — the anti-reinvention research scout distilled from khuym's `xia`. Standalone mode answers "research topic X" with an evidence-labeled brief (`Local/Upstream/Docs/Inference`, reuse-first recommendation ladder) in `docs/history/research/`; in-chain mode is the protocol body of planning's discovery L2/L3, merging into `approach.md`. Not yet dogfooded.

Known debt before 1.0 (recorded in each skill's CREATION-LOG.md): pressure-testing of the skills themselves per the Iron Law — v0.1 skills inherit bulletproofing from their khuym/superpowers lineage but have not yet been RED/GREEN/REFACTOR-tested in bee form.

Try it in a repo: see [Usage examples](#usage-examples) above — onboard, scout with `bee_status`, then ask the agent for a tiny fix and watch it route.
