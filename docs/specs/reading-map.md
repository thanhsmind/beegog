# Reading Map

Where things live. Read the touched area's spec before its code.

## Area specs

- [`docs/knowledge/areas/decision-memory/`](../knowledge/areas/decision-memory/index.md) — what
  the system remembers about its own decisions, migrated into the knowledge bundle
  (okf-foundation D20/D29; okf-migration-f2 F9): the three field failures, mandatory write-time
  classification against a canonical taxonomy, append-only retro-tagging with read-time overlay,
  the derived index as the guaranteed recall surface (reading order spec → decision index →
  history), the supersede citation sweep that makes a reversal reach every citing artifact, the
  archive split with union reads, and the per-CoS-clause done-flip rule (GH #32/#33/#34) — one
  concept, `overview.md`, since the source is one coherent topic at nine rules. The legacy path
  [`decision-memory.md`](./decision-memory.md) remains as a pointer stub carrying the full
  9-anchor map (D37).
- [`feedback-digest.md`](./feedback-digest.md) — how a repository turns its own workflow records into a
  safe portable snapshot, how the maintainers' repository reads other repositories' snapshots
  without trusting them, and how the collected view is ranked and fed to the gated
  self-improvement process.
- [`onboarding.md`](./onboarding.md) — what onboarding installs and keeps current in a host
  project, including plugin-first/repo-copy exclusivity, installed-package proof, and
  proof-gated cleanup; unresolved live-install surfaces remain Open Gaps (`coverage: partial`).
- [`hook-runtime.md`](./hook-runtime.md) — the lifecycle guardrails around the assistant: one
  catalog of record rendered into per-runtime projections, hostile-input immunity, advisory
  encoding, per-target batch-write guarding, three declared runtime differences, paired Codex
  child lifecycle audit, exclusive source ownership, and named coverage gaps (`coverage: partial`).
- [`docs/knowledge/areas/doctrine-layer/`](../knowledge/areas/doctrine-layer/index.md) — the
  standing instructions an assistant always carries, migrated into the knowledge bundle
  (okf-foundation D20/D29): purpose, vocabulary, actors and open gaps (`overview.md`); what
  belongs on the always-loaded sheet versus a stage's procedure reference — a rule needed when
  no stage is running is silently absent from every such turn if buried in a reference — how
  doctrine reaches every project by copy, and the anchor tests that keep a rule from drifting
  back out of the layer (`placement-and-anchoring.md`); the rules with nothing enforcing them —
  an unblocked action is not an approved action, doctrine is not gated, the machinery is run by
  the assistant, its vocabulary stays out of the conversation (`unenforced-obedience.md`); the
  delegation threshold, gather delegates and deciding never does (`delegation-threshold.md`);
  the two helper classes, the read-only capability surface and the gather-only external-command
  tier (`helper-classes-and-transports.md`); the native Codex empty-wait discipline
  (`native-wait-discipline.md`); the lane-ceremony contract — work-packet-first tiny/small
  shapes, product-file-only caps, test-anchored risk flags, intake-first classification — plus
  the one canonical scratch home and the verify ladder (`lane-and-working-discipline.md`). The
  legacy path [`doctrine-layer.md`](./doctrine-layer.md) remains as a pointer stub carrying the
  full 39-anchor map (D37).
- [`docs/knowledge/areas/advisor-protocol/`](../knowledge/areas/advisor-protocol/index.md) —
  second opinions for workers and the orchestrator, migrated into the knowledge bundle
  (okf-foundation D20/D29): purpose, vocabulary, and actors (`overview.md`); who may consult
  the configured adviser and the mandatory pre-approval consult for high-risk work
  (`triggers.md`); the stuck-worker consult loop, the read-only rule, and what advice may
  never do — approve, override, write (`consult-loop.md`); configuration authority,
  transports, and event-based staleness (`slots-and-tiers.md`). The legacy path
  [`advisor-protocol.md`](./advisor-protocol.md) remains as a pointer stub carrying the
  full anchor map (D37).
- [`workflow-state.md`](./workflow-state.md) — the durable workflow record: closed phase
  vocabulary, four gates, the guarded feature-start that can never inherit approvals or
  bury unfinished work, and the review records — user-invoked review sessions with frozen
  scope (`.bee/reviews/`), the append-only candidates ledger, and derived review statuses
  (verified/unreviewed/in review/reviewed/review stale); also the unified nine-group
  command entry point and the worker adviser consult (a stuck worker asks a configured
  stronger model, on failure only, budgeted); plus the session-coordination
  primitives — atomic single-winner claims with TTL + heartbeat on every claim path,
  a self-derived session identity, ownership-checked claimed-unit mutation with an
  audited force door, a serialized coordination-store lock behind concurrent
  reservation/state writes, throttled self-renewing heartbeats and leases, typed
  refusal codes, gate-protected adoption/reclaim, plus pre-phase ownership for
  generic routing changes and review isolation from active execution state; plus
  opt-in isolated
  worktree dispatch with one validated main coordination store, canonical contained
  reservation checks, and transactional merge/revert/preservation rules; plus a
  self-correcting loop over each unit of work — an append-only attempt history,
  lifetime claim/failure budgets enforced at the claim door with an audited reset
  door, authoring-time change classification with a behavior-class completion
  floor on proof-of-red evidence, an append-only structured judge verdict with an
  honest model-independence stamp, and a goal-check judge that scales with lane
  risk without touching the user-invoked review gate
  (`coverage: partial`).
- [`okf-profile.md`](./okf-profile.md) — the Bee OKF Profile: the nine closed concept types plus
  the practice/pitfall polarity bit, frontmatter field rules with the id-derives-path direction,
  authority uniqueness (`bee.id`, `bee.authoritative_for`), the legacy-frontmatter carry-over map,
  the per-migration coverage report, pointer-stub anchor maps, the declared (not yet executed)
  retirement of `implement-plan.md`, the standing exemption for `docs/decisions/index.md`, and the
  exact OKF-error/profile-warning finding codes `bee knowledge check` emits — bee's own contract,
  not a ratified OKF standard (`coverage: partial`).

## Not yet specced

- The workflow's skills themselves (`skills/bee-*`, including the new `bee-evolving`) have no area
  specs by convention. Their contracts live in `docs/07-contracts.md` and in each skill's own
  `SKILL.md` + `CREATION-LOG.md`; `skills/bee-writing-skills/scripts/render_openai_metadata.mjs`
  projects each canonical frontmatter identity into `agents/openai.yaml` for Codex, and its
  `--check` mode guards drift. The self-improvement *process* behavior is specced in
  `feedback-digest.md` (B5).
- `docs/specs/system-overview.md` does not exist. Offered, not yet written.

## Elsewhere

- `scripts/lib/run-module-worker.mjs` — shared isolated test-entrypoint runner
  for onboarding, hook, command, metadata, and concurrency verification.
- Communication doctrine (plain language, Gate Presentation Contract, Silent Bookkeeping —
  bee mechanics never narrated into chat, work language only; decision 1689af1b) lives in
  `skills/bee-hive/references/routing-and-contracts.md` § Communication Contract, mirrored as
  hive law 11 (`skills/bee-hive/SKILL.md`) and host critical rule 11 (`templates/AGENTS.block.md`).
  The *placement* rule behind every such mirror — always-applies doctrine belongs in
  `AGENTS.block.md`, a stage's own procedure detail may stay in `references/` — is specced in
  `docs/knowledge/areas/doctrine-layer/placement-and-anchoring.md` (R1/B2); read it before
  authoring or relocating any rule.
- `docs/history/learnings/critical-patterns.md` — mandatory pre-work rules for agents.
- `docs/history/<feature>/` — how a feature was decided, planned, validated, reviewed, and shipped.
- `docs/decisions/` — numbered design decisions. `.bee/decisions.jsonl` — the live decision log.
- `docs/backlog.md` — the product backlog. `.bee/backlog.jsonl` — friction and findings.
- `.bee/state.json` and `.bee/backlog.jsonl` are **CLI-owned**: every mutation goes through `bee.mjs state` (generic routing changes require the selected record's pre-change phase as owner; gates use their dedicated verb; worker/scribing-run remain dedicated; `worker prune` cleans `.bee/workers` transients — prefix keep-set, fail-closed destructive verbs) or `bee.mjs backlog add`; direct edits are denied by the write-guard, and a standing suite keeps templates byte-identical to `.bee/bin/`.
- `docs/history/research/` — standalone bee-xia research briefs (topic-slug files; each leads with its Bottom Line).
- `hooks/` — the catalog and handlers for the installed plugin projection and generated repository fallback. It declares the pre-spawn model-tier guard on both runtimes (Claude via its dispatch tools, Codex via its native spawn call on the observed envelope — unobserved shapes pass through open) and the paired Codex-only child-start/child-stop audit; onboarding activates exactly one source. Vendored handlers live under `.bee/bin/hooks/`.
- `skills/bee-hive/scripts/plugin_distribution.mjs` and `test_plugin_distribution.mjs` — shared strict distribution planner/prover and transaction suite. `scripts/install.sh`, `scripts/install.ps1`, and release-inventory tests are the two platform entrypoints and package proof.
- [`docs/knowledge/areas/verify-pipeline/`](../knowledge/areas/verify-pipeline/index.md) — test
  topology & discovery, migrated into the knowledge bundle (okf-foundation D20/D29;
  okf-migration-f2 F9): per-module suites (the monolith is deleted; 430-check conservation),
  convention-based suite discovery in `scripts/run_verify.mjs` (zero-registration; serial by
  filename convention), the floor+existence manifest guard, and the shared fixture helper
  (`scripts/lib/test-fixture.mjs`) split by TOPIC into `suite-topology-and-discovery.md`; the
  lock+tmp-swap plugin-tree render, multi-worker checkout etiquette, and hermetic session-id
  scrubbing proven by deterministic race/isolation suites into
  `concurrency-and-hermetic-runs.md`. The legacy path
  [`verify-pipeline.md`](./verify-pipeline.md) remains as a pointer stub carrying the full
  14-anchor map (D37). Read before adding/moving any test file.
- [`docs/knowledge/areas/performance-log/`](../knowledge/areas/performance-log/index.md) — the
  global cross-project performance log, migrated into the knowledge bundle (okf-foundation
  D20/D29; okf-migration-f2 F9): sections summarizing a piece of work's per-model token cost
  (new/cached/total), parallelism, and active running time, plus a cross-project HTML matrix
  (`~/.config/beehive/performance.html`) that auto-refreshes at session close. Driven by the
  `bee perf start|stop|section|log|render|report` command group + `maybePerfRefresh` in
  `hooks/bee-session-close.mjs`. Core, cross-project scan, and HTML renderer live in
  `templates/lib/perf.mjs`. Split by TOPIC into `sections-lifecycle-and-measurement.md`,
  `persistent-store-and-sync.md`, and `cross-project-matrix.md`. The legacy path
  [`performance-log.md`](./performance-log.md) remains as a pointer stub carrying the full
  23-anchor map (D37).
- `skills/bee-hive/templates/bee.mjs` + `templates/lib/command-registry.mjs` — the sole shipped CLI (`bee.mjs <group> <verb>` over all 10 command groups, the 10th being `perf`; originated as an additive dispatcher in harness-integration-adopt, decision 30606de4, `docs/decisions/0024`, then made the sole canonical *and* sole shipped surface by shim-retire, D1, decision bbc6bcea — the 9 legacy per-group shims are deleted); `command-registry.mjs` is the single source of truth for the command surface. Contract in `docs/07-contracts.md`; spec-before-code still applies — read the touched area's spec before this code.
- `skills/bee-hive/templates/lib/schedule.mjs` — the computed work schedule (`computeSchedule`/`detectCycles`: dep layering + declared-path overlap packing into waves; consumed by `bee cells schedule`, cycle refusal in `cells.mjs` add/update, and the swarming/validating prose). Spec: `docs/specs/workflow-state.md` B17/B18, R26/R27.
- `skills/bee-hive/templates/lib/recovery.mjs` — crash-recovery transcript mining (`detectCrashCandidates`/`readTranscriptTail`/`hasCleanEndTrio`/`lastDurableSettlement`/`computeMiningWindow`/`buildMiningPrompt`: stale-heartbeat + non-clean-transcript-tail + work-in-flight detection; bounded mining window; the down-tier miner prompt). Consumed by `bee recovery scan|window` and the `status` recovery block; imports `perf.mjs` (transcript resolution) + `claims.mjs` (heartbeat/session), never imported by `command-registry.mjs`. Spec: `docs/specs/workflow-state.md` B33, R51.
