# Reading Map

Where things live. Read the touched area's spec before its code.

## Area specs

- [`feedback-digest.md`](./feedback-digest.md) — how a repository turns its own workflow records into a
  safe portable snapshot, and how the maintainers' repository reads other repositories' snapshots
  without trusting them.

## Not yet specced

- The workflow's skills themselves (`skills/bee-*`) have no area specs. Their contracts live in
  `docs/07-contracts.md` and in each skill's own `SKILL.md` + `CREATION-LOG.md`.
- `docs/specs/system-overview.md` does not exist. Offered, not yet written.

## Elsewhere

- `docs/history/learnings/critical-patterns.md` — mandatory pre-work rules for agents.
- `docs/history/<feature>/` — how a feature was decided, planned, validated, reviewed, and shipped.
- `docs/decisions/` — numbered design decisions. `.bee/decisions.jsonl` — the live decision log.
- `docs/backlog.md` — the product backlog. `.bee/backlog.jsonl` — friction and findings.
