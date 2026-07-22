---
area: advisor-protocol
updated: 2026-07-22
migrated_to: docs/knowledge/areas/advisor-protocol/
---

# Advisor Protocol (migrated — pointer stub)

This area's current truth now lives in the knowledge bundle:
[`docs/knowledge/areas/advisor-protocol/`](../knowledge/areas/advisor-protocol/index.md)
(okf-foundation D20/D29/D37). Purpose, vocabulary, and actors are in
`overview.md`; who may consult and when in `triggers.md`; the stuck-worker
consult loop and the limits on advice in `consult-loop.md`; configuration
authority, transports, and consult staleness in `slots-and-tiers.md`. This
path stays alive as a pointer stub — it is never deleted in this feature
(D20) — and the anchor map below sends every numbered anchor the old spec
exposed to the concept that now owns it, so existing citations keep
resolving. Coverage is machine-checked by `scripts/okf_migrate.mjs --check
advisor-protocol` in the verify chain (D35).

## Anchor map

Edge Cases bullets carry `E` ids and Pointers bullets carry `P` ids, assigned
in the source's document order at migration time.

| Anchor | Now owned by | Was |
|---|---|---|
| B1 | [docs/knowledge/areas/advisor-protocol/triggers.md](../knowledge/areas/advisor-protocol/triggers.md) | the dispatcher offers the adviser; the worker never self-assesses |
| B2 | [docs/knowledge/areas/advisor-protocol/consult-loop.md](../knowledge/areas/advisor-protocol/consult-loop.md) | a stuck worker consults inside its own turn |
| B3 | [docs/knowledge/areas/advisor-protocol/triggers.md](../knowledge/areas/advisor-protocol/triggers.md) | the orchestrator consults before high-risk execution approval |
| B4 | [docs/knowledge/areas/advisor-protocol/consult-loop.md](../knowledge/areas/advisor-protocol/consult-loop.md) | advice is advice |
| R1 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | config is the authority; the model does not get a vote |
| R2 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | the only skip is the literal same-model no-op |
| R3 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | advice-class slots are read-only |
| R4 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | live consult record; event-based staleness, never a time limit |
| R5 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | consult anchors are machine-stamped; callers cannot forge freshness |
| R6 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | advice never approves, never overrides, never writes |
| R7 | [docs/knowledge/areas/advisor-protocol/consult-loop.md](../knowledge/areas/advisor-protocol/consult-loop.md) | the worker budget is two per claim; exhaustion returns blocked |
| R8 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | dispatch payloads have one source of truth |
| R9 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | dispatch records tell the economic truth |
| E1 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | external command reporting success while doing nothing |
| E2 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | adviser configured but the command cannot receive a prompt |
| E3 | [docs/knowledge/areas/advisor-protocol/triggers.md](../knowledge/areas/advisor-protocol/triggers.md) | corrupt or hand-edited consult record reads as missing |
| E4 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | execution gate revoked after a consult makes it stale |
| E5 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | unconfirmed native-override route refuses the dispatch by name |
| E6 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | guard allowlist folds the configured adviser's model (cnt-7) |
| P1 | [docs/knowledge/areas/advisor-protocol/consult-loop.md](../knowledge/areas/advisor-protocol/consult-loop.md) | worker loop; dispatch-time offer + same-model no-op |
| P2 | [docs/knowledge/areas/advisor-protocol/triggers.md](../knowledge/areas/advisor-protocol/triggers.md) | orchestrator consult + throw |
| P3 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | read-only validation |
| P4 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | guard allowlist fold |
| P5 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | resolution + external gather contract |
| P6 | [docs/knowledge/areas/advisor-protocol/triggers.md](../knowledge/areas/advisor-protocol/triggers.md) | gate precondition spec detail |
| P7 | [docs/knowledge/areas/advisor-protocol/slots-and-tiers.md](../knowledge/areas/advisor-protocol/slots-and-tiers.md) | native-override transport |
