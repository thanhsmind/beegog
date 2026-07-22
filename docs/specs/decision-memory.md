---
area: decision-memory
updated: 2026-07-22
migrated_to: docs/knowledge/areas/decision-memory/
---

# Decision Memory (migrated — pointer stub)

This area's current truth now lives in the knowledge bundle:
[`docs/knowledge/areas/decision-memory/`](../knowledge/areas/decision-memory/index.md)
(okf-foundation D20/D29/D37). At this source's size — nine Business Rules, no
Behaviors/Edge Cases/Pointers sections, 39 lines — the whole area is one
coherent topic and lives in a single concept, `overview.md`: the problem
statement and three field failures, the data dictionary, the actors, and all
nine business rules — write-time classification, reversal's citation-sweep
reconciliation, place inheritance, retro-tag reclassification, the derived
index as recall surface, the bounded archive, the backlog done-flip rule,
citation discipline, and the no-stored-graph consistency model. This path
stays alive as a pointer stub — it is never deleted in this feature (D20) —
and the anchor map below sends every numbered anchor the old spec exposed to
the concept that now owns it, so existing citations keep resolving. Coverage
is machine-checked by `scripts/okf_migrate.mjs --check decision-memory` in the
verify chain (D35), against the pinned pre-migration blob `2e8ec59`
(`8710d03`, 9 anchors, 0 unparsed blocks — okf-migration-f2 F8/F9).

## Anchor map

This source carries no Behaviors, Edge Cases, or Pointers sections — only nine
Business Rules, all cleanly derived (0 unparsed blocks).

| Anchor | Now owned by | Was |
|---|---|---|
| R1 | [docs/knowledge/areas/decision-memory/overview.md](../knowledge/areas/decision-memory/overview.md) | every decision event is classified at write time |
| R2 | [docs/knowledge/areas/decision-memory/overview.md](../knowledge/areas/decision-memory/overview.md) | reversal is not finished until citing artifacts are reconciled |
| R3 | [docs/knowledge/areas/decision-memory/overview.md](../knowledge/areas/decision-memory/overview.md) | reversals inherit their place |
| R4 | [docs/knowledge/areas/decision-memory/overview.md](../knowledge/areas/decision-memory/overview.md) | memory is re-classifiable without rewriting history |
| R5 | [docs/knowledge/areas/decision-memory/overview.md](../knowledge/areas/decision-memory/overview.md) | the derived index is the recall surface |
| R6 | [docs/knowledge/areas/decision-memory/overview.md](../knowledge/areas/decision-memory/overview.md) | the store stays bounded |
| R7 | [docs/knowledge/areas/decision-memory/overview.md](../knowledge/areas/decision-memory/overview.md) | a backlog row flips `done` only when every CoS clause has cited evidence |
| R8 | [docs/knowledge/areas/decision-memory/overview.md](../knowledge/areas/decision-memory/overview.md) | citation discipline |
| R9 | [docs/knowledge/areas/decision-memory/overview.md](../knowledge/areas/decision-memory/overview.md) | no stored graph, no daemon |
