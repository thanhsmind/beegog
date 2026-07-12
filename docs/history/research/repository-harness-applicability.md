---
artifact_contract: bee-research/v1
topic: repository-harness-applicability
depth: standard
date: 2026-07-12
---

## Bottom Line

- Recommendation (ladder rung): adapt-upstream
- Why this is the lightest credible path: bee already implements most of the workflow ideas; the
  useful delta is three small mechanisms, not the upstream Rust/SQLite/Symphony architecture.
- Why the next-best rung lost: pure reuse leaves bee's documented entropy audit non-executable and
  its existing `capabilities` configuration without discovery or health semantics.
- Confidence (0–100%): 88%
- Suggested next step: bee-planning

Adopt in this order:

1. **Mechanical entropy audit** — make bee's existing formula a deterministic command with JSON
   output, evidence rows, trend, and proposal input. This is the strongest immediate fit.
2. **Mechanical reviewer closure** — compare a review session's planned reviewer manifest with
   recorded outcomes. Every planned reviewer must end as `ran`, `explicitly skipped`, or
   `named fallback` before synthesis and Gate 4.
3. **Inbound capability registry** — give `.bee/config.json` `capabilities` validated provider
   entries plus `check` and `query --capability` behavior. Keep this separate from the unified
   command registry: one describes what bee offers; the other describes optional tools a host equips.
4. **Trace/context scoring only after trace capture improves** — first prove that missing or excess
   context is a recurring problem. Bee does not currently record actual reads/actions well enough for
   the upstream scorer to be trustworthy.

Do not adopt now: SQLite as the workflow source of truth, semantic changesets, Symphony's runner/UI,
or its hand-written raw Codex app-server adapter.

## Repo Snapshot

- Repo type / primary languages / runtimes: bee is a Node-based skill/plugin and vendored CLI
  harness with Markdown/JSON records; the inspected upstream is a Rust workspace plus a
  TypeScript/React/Electron controller.
- Frameworks and detectable versions: bee requires Node 18+ and ran here on Node 24.14.1. Upstream
  declares `harness-cli` 0.1.11, Rust 2021, Clap 4.6.1, bundled SQLite through rusqlite 0.39.0, and
  a separate `harness-symphony` crate. Cargo is not installed in this environment, so upstream
  runtime behavior was not re-executed.
- Relevant packages, services, tools: upstream has a compiled CLI, SQLite migrations, an optional
  tool-provider registry, trace/context scoring, drift audit/proposals, story verification, and a
  Codex-capable isolated runner. Bee has file-owned state, cells with verification evidence,
  decisions, friction/backlog records, specs, grooming/evolving skills, hooks, and a unified CLI
  command catalog.
- Constraints or workflows that shape the answer: bee's active decisions favor lightweight,
  repo-local, human-gated behavior; source edits require validated cells; review is user-invoked;
  templates remain the source of truth for vendored runtime files.

## Question & Assumptions

- What was asked: inspect the Codex-oriented `repository-harness` clone and identify mechanisms that
  can improve bee.
- What success appears to mean: increase bee's reliability and observability without duplicating
  features or turning bee into a separate orchestration platform.
- Assumptions still needing confirmation: bee is intended to remain a workflow harness rather than
  become a persistent local runner with its own desktop UI and database.

## Findings

### Local

- Bee already covers intake lanes, gates, scoped cells, verification-before-cap, decision memory,
  behavior specs, friction collection, review records, and a gated improvement loop. Rebuilding
  these from upstream would add a second vocabulary and competing sources of truth.
- Bee already specifies the same weighted entropy formula in `bee-grooming`, including trend and
  outcome tracking, but computes it procedurally during an audit. No vendored command produces a
  stable breakdown. This is a genuine implementation gap across code, config, docs, and tests.
- `.bee/config.json` already has a `capabilities` object and `readConfig()` exposes it, while
  `bee-xia` declares capability dependencies such as `web-docs-search` and
  `upstream-pattern-research`. There is no schema, provider-kind model, presence reconciliation, or
  query operation. This is a real extension point, not a new abstraction.
- Bee's unified `COMMAND_REGISTRY` is outbound: it catalogs commands bee offers. It must not be
  overloaded with optional host tools. An inbound capability registry should be a distinct data
  model and command group.
- Bee cell traces record outcome, changed files, deviations, friction, verification output, and
  behavior evidence, but not a reliable actual-read/action stream. A context scorer copied now
  would score declarations or incomplete telemetry, not observed context selection.
- Bee's feedback vocabulary already normalizes `scope-correction`, approvals, findings, outcomes,
  audits, blocked work, deviations, and learnings. A separate intervention database would duplicate
  this path; producer ergonomics can be improved later if corrections are under-recorded.
- Bee already closes the prediction loop through kill proposals/outcomes and ranks cross-repository
  feedback. Upstream's proposal pipeline is useful precedent, not a missing subsystem.
- Bee has a substantially stronger implementation-subagent protocol than the inspected upstream:
  dependency waves, one assigned cell per worker, isolated prompts, file reservations, result tokens,
  verification before cap, and parent re-checks for external executors. The upstream core does not
  provide an equivalent worker swarm.
- Bee review sessions already persist a planned reviewer manifest and require the orchestrator to
  wait for every reviewer. What is missing is a mechanical closure assertion that reconciles every
  planned reviewer with a completed, skipped, or fallback record before synthesis/Gate 4.

### Upstream

- `harness-cli audit` implements a deterministic weighted drift score over orphaned work,
  unverified work/decisions, outcome-less backlog, stale work, and broken tools. Its `propose`
  operation turns findings into structured recommendations. This closely matches bee's documented
  grooming contract and is the best pattern to adapt.
- The inbound tool registry separates **capability** from provider name, supports provider kinds
  (`cli`, `binary`, `mcp`, `skill`, `http`), reconciles intent with current presence, and lets steps
  query an equipped provider by capability. Missing optional tools degrade cleanly. This maps
  directly to bee-xia's capability/fallback language.
- Trace scoring uses lane-specific minimum field sets; context scoring compares recorded reads and
  changed files against phase/lane rules, including over-read detection. The design is coherent,
  but its input quality depends on a trace schema bee does not yet possess.
- Story-level `verify` and `verify-all` overlap with bee's cell verification and session baseline.
  Importing them would create another proof status unless bee first identifies a concrete batch
  verification gap.
- The maturity matrix is a useful audit document, but bee already has vision, roadmap, contracts,
  specs, critical patterns, and grooming. Adding another maturity hierarchy would increase memory
  surfaces without a clear decision it enables.
- Symphony solves a different problem: isolated worktrees, explicit run contracts, durable run
  artifacts, optional PR creation, and replayable database changesets. Bee currently orchestrates
  work inside an active agent session and uses Git plus file records. Importing Symphony would be a
  product-direction change, not a harness enhancement.
- Upstream's committed operation-log changesets are a sound answer to SQLite merge/rebuild risk.
  Bee does not have that risk because its durable team records are already reviewable files and
  append-only logs where appropriate.

#### Subagent-specific finding

- The reusable Harness template explicitly classifies **Sub-agents** as `Missing`: no delegated
  specialist-agent protocol exists in the core repository, and Phase 5 defers subagents to Phase 6+.
- Symphony launches one configured agent for one story inside an isolated worktree. The Codex adapter
  manages one app-server thread/turn and waits for `turn/completed`; it does not decompose that story
  into child workers.
- The apparent subagent implementation in the Web UI audit came from an external
  `frontend-agents:frontend-production-workflow`, not from the repo-local Harness skill or Symphony.
  It fanned out six read-only reviewer personas: frontend architecture, React quality, shadcn,
  accessibility, Vite performance, and design polish. An editor persona was explicitly skipped for
  the audit-only run.
- When a configured reviewer role failed because its bound model was unavailable, the first audit
  used default read-only subagents as a named fallback. Findings were summarized by specialist group
  into one durable audit story rather than allowing reviewers to edit the implementation.
- Follow-up story US-071 locks the closure rule: every configured reviewer must run, be explicitly
  skipped, or have a named fallback before acceptance. It also states the limitation honestly: the
  rule is policy-only and Harness does not inspect delegation logs to prove closure.
- This closure rule is the part worth adapting. The external frontend persona roster is
  domain-specific and install-dependent; bee should retain its runtime-default subagent plus inline
  persona contract, then enforce completeness against its own persisted reviewer manifest.

### Docs

- Current official Codex documentation says app-server is for deep custom-client integrations with
  authentication, history, approvals, and streamed events. For job automation or CI it recommends
  the Codex SDK instead: https://learn.chatgpt.com/docs/app-server
- The current Codex SDK supports programmatic threads and sandbox selection, with a Node 18+ SDK
  that fits bee's runtime better than a new Rust JSON-RPC client:
  https://learn.chatgpt.com/docs/codex-sdk
- Therefore, if bee later builds an isolated runner, start with a small Codex SDK adapter and an
  explicit result contract. Do not copy Symphony's raw app-server protocol client as-is. This is a
  current-doc mismatch with the upstream story, not evidence that Symphony itself is defective.

### Inference

- A mechanical `bee audit --json` can likely reuse the existing grooming formula and current JSON
  records without changing the state model. It should be a small/standard feature, depending on how
  stale-spec mapping is bounded.
- A capability registry is likely a standard feature because it changes configuration contracts,
  onboarding, command discovery, and several skills, even if its storage stays inside the existing
  config file.
- Reviewer closure is likely a small feature: extend review-session records with one terminal outcome
  per manifest entry and refuse synthesis/Gate 4 while any reviewer is unresolved. A configured-model
  failure should either block or record the exact fallback reviewer; it must never silently reduce
  coverage.
- Context scoring should remain a research/proof obligation until actual file-read telemetry can be
  collected without leaking secrets, bloating records, or confusing declared `read_first` paths
  with observed reads.
- A runner, worktree controller, or UI should be considered only after repeated demand for unattended
  execution. At that point it should be scoped as a separate product layer, not folded casually into
  bee-hive.

## Risks, Unknowns, Follow-Ups

- Technical risks / evidence gaps / version uncertainties: upstream tests were inspected but not run
  because Cargo is unavailable. The local clone is at commit `14e6f10`; its behavior may continue to
  evolve. Stale-spec detection in bee's entropy formula includes semantic mapping that is harder to
  make deterministic than upstream's database-backed categories.
- Open questions (for the user, or as proof obligations for bee-validating): define the exact
  machine-provable subset for the first audit command; decide whether capability providers are
  repository config only or may inherit runtime/global discoveries; define the reviewer terminal
  record (`ran | skipped | fallback`) and whether a failed configured model blocks by default; measure
  whether missing context or over-reading has caused enough real friction to justify telemetry.

## Source Pack

- Local files read: `docs/specs/reading-map.md`, `docs/specs/workflow-state.md`,
  `docs/specs/feedback-digest.md`, `docs/03-workflow.md`, `docs/04-skills-spec.md`,
  `docs/07-contracts.md`, `docs/config-reference.md`, `.bee/config.json`,
  `skills/bee-grooming/SKILL.md`, `skills/bee-grooming/references/grooming-reference.md`,
  `skills/bee-evolving/SKILL.md`, `skills/bee-xia/SKILL.md`, and feedback/state/registry code and tests.
- Upstream repos/pages checked: local clone `/home/thanhsmind/projects/REFs/repository-harness`
  at `14e6f10`; `README.md`, `AGENTS.md`, Cargo manifests, architecture/harness/component/maturity,
  trace/context/tool/audit/improvement/test-matrix/Symphony docs, relevant story packets, migrations,
  CLI domain/application/interface code, Symphony adapter/run code, Web UI audit evidence, US-071,
  and the repo-local `.codex` skill/hook configuration.
- Docs pages checked: official Codex App Server and Codex SDK pages listed above. The Codex manual
  helper failed because the response lacked its expected integrity header, so the official docs MCP
  search/fetch route was used as prescribed.
