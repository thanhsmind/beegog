# bee

**bee** is a lightweight, validate-first agentic development plugin suite for **Claude Code** and **Codex**, distilled from the strongest ideas of seven upstream systems: khuym, claudekit, gsd-core, gstack, repository-harness, superpowers, and compound-engineering.

bee is not a greenfield framework. Like khuym before it, bee sits downstream of proven agentic-development systems and keeps only the pieces that hold up in practice for a solo developer: a staged workflow with hard gates, evidence-based validation, bounded multi-agent execution, and a compounding knowledge loop that makes both the human and the agents less wrong over time.

## The metaphor

A hive is a staged, self-regulating system — and every bee role maps to a workflow stage:

| Hive role | bee skill | What it does |
|---|---|---|
| The hive itself | `bee-hive` | Bootstrap, routing, state, gates — load first in every session |
| Scout bees | `bee-exploring` | Find the nectar: lock fuzzy intent into decisions, scout *just enough* |
| Waggle dance | `bee-planning` | Communicate the found path precisely enough that workers can fly it |
| Guard bees | `bee-validating` | Nothing enters the hive unproven: reality gate, feasibility evidence |
| The swarm | `bee-swarming` | Orchestrate bounded workers over validated cells |
| Worker bees | `bee-executing` | One worker, one cell: implement, verify, **cap the cell** |
| Inspector bees | `bee-reviewing` | Multi-agent review, artifact verification, UAT |
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
  -> bee-compounding   writes  learnings + decisions
  (on demand) bee-grooming    kills tech debt, audits hive health
```

## Install

Quick (greenfield or brownfield, both runtimes):

```bash
curl -fsSL https://raw.githubusercontent.com/thanhsmind/beegog/main/scripts/install.sh | bash -s -- -d /path/to/project -y
```

```powershell
iwr -useb https://raw.githubusercontent.com/thanhsmind/beegog/main/scripts/install.ps1 -OutFile install-bee.ps1; .\install-bee.ps1 -Directory C:\path\to\project -Yes
```

Full options, the Claude Code plugin route (`/plugin marketplace add thanhsmind/beegog` + `/plugin install bee@bee`), manual installs, verify/update/uninstall: [INSTALL.md](INSTALL.md).

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

**v0.1.0 built.** All 10 skills, the 6-hook automation skeleton, 4 vendored helpers over a shared `lib/`, onboarding for both runtimes, and two test suites (28 lib contract tests + onboarding/idempotency/`--repo-hooks` tests) — all green, smoke-tested end-to-end (onboard → gate-locked claim → verify-gated cap → hook denials).

Known debt before 1.0 (recorded in each skill's CREATION-LOG.md): pressure-testing of the skills themselves per the Iron Law — v0.1 skills inherit bulletproofing from their khuym/superpowers lineage but have not yet been RED/GREEN/REFACTOR-tested in bee form.

Try it in a repo:

```bash
node <plugin>/skills/bee-hive/scripts/onboard_bee.mjs --repo-root <your-repo>          # plan (dry-run)
node <plugin>/skills/bee-hive/scripts/onboard_bee.mjs --repo-root <your-repo> --apply  # install
node .bee/bin/bee_status.mjs --json                                                # scout
```
