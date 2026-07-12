# Reading Map

Where things live. Read the touched area's spec before its code.

## Area specs

- [`feedback-digest.md`](./feedback-digest.md) — how a repository turns its own workflow records into a
  safe portable snapshot, how the maintainers' repository reads other repositories' snapshots
  without trusting them, and how the collected view is ranked and fed to the gated
  self-improvement process.
- [`onboarding.md`](./onboarding.md) — what onboarding installs and keeps current in a host
  project; currently full on the opt-in status-display (statusline) vendoring, the rest of the
  surface is declared Open Gaps (`coverage: partial`).
- [`hook-runtime.md`](./hook-runtime.md) — the lifecycle guardrails around the assistant: one
  catalog of record rendered into per-runtime projections, hostile-input immunity, advisory
  encoding, per-target batch-write guarding, named coverage gaps (`coverage: partial`).
- [`workflow-state.md`](./workflow-state.md) — the durable workflow record: closed phase
  vocabulary, four gates, the guarded feature-start that can never inherit approvals or
  bury unfinished work, and the review records — user-invoked review sessions with frozen
  scope (`.bee/reviews/`), the append-only candidates ledger, and derived review statuses
  (verified/unreviewed/in review/reviewed/review stale) (`coverage: partial`).

## Not yet specced

- The workflow's skills themselves (`skills/bee-*`, including the new `bee-evolving`) have no area
  specs by convention. Their contracts live in `docs/07-contracts.md` and in each skill's own
  `SKILL.md` + `CREATION-LOG.md`; the self-improvement *process* behavior is specced in
  `feedback-digest.md` (B5).
- `docs/specs/system-overview.md` does not exist. Offered, not yet written.

## Elsewhere

- `docs/history/learnings/critical-patterns.md` — mandatory pre-work rules for agents.
- `docs/history/<feature>/` — how a feature was decided, planned, validated, reviewed, and shipped.
- `docs/decisions/` — numbered design decisions. `.bee/decisions.jsonl` — the live decision log.
- `docs/backlog.md` — the product backlog. `.bee/backlog.jsonl` — friction and findings.
- `.bee/state.json` and `.bee/backlog.jsonl` are **CLI-owned**: every mutation goes through `bee_state.mjs` (set/gate/worker/scribing-run; `worker prune` cleans `.bee/workers` transients — prefix keep-set, fail-closed destructive verbs; contract in the script's usage comment + swarming-reference Transient hygiene, decision a0285993) or `bee_backlog.mjs add` (source: `skills/bee-hive/templates/`); direct edits are denied by the write-guard, and a standing suite test keeps templates byte-identical to `.bee/bin/`. Shipped as `docs/history/cli-mutations/` (`walkthrough.md` carries the full contract).
- `docs/history/research/` — standalone bee-xia research briefs (topic-slug files; each leads with its Bottom Line).
- `hooks/` — plugin runtime hooks (source of truth; vendored to `.bee/bin/hooks/` by onboarding). The subagent model-tier guard contract (explicit tier per dispatch, anchored `[bee-tier]` marker) lives in `docs/decisions/0023-explicit-tier-transport.md` + `skills/bee-swarming/`, enforced by `hooks/bee-model-guard.mjs`, tested by `hooks/test_model_guard.mjs`. The same hook audit-logs every evaluated dispatch (transport, model, tier) to `.bee/logs/dispatch.jsonl` (P22).
