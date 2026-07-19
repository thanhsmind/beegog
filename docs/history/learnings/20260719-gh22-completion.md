# Learnings — gh22-completion (2026-07-19)

Feature: the GH #22 remainder + review P2s — dispatch prepare, economics
split, doctor three-state + attest, sidecar v2 deep inventory, CI from zero,
real-codex canary + A/B protocol. Six cells, three advisor-driven redesigns.

## 1. "Test it against the real thing" starts by making the real thing importable
The headline acceptance (prepare's payload through the guard) was impossible
against a hook that exports nothing and runs main() on import. The refactor
(pure exported `evaluateDispatch`, hook as thin wrapper) cost little and paid
twice: the test became honest, and a second consumer (prepare) got one source
of truth. When a guard/validator needs external proof, extract its decision
core first — never copy its regex.

## 2. An honesty feature must itself be reachable — audit the evidence sources before designing validity legs
D5's original "observed hook event after attestation" leg was unsatisfiable
on codex (deny/crash-only logs; the success path writes nothing), which would
have made `ready` permanently unreachable — the exact binary the feature
existed to kill. Before designing any attestation/validity scheme, enumerate
what the runtime actually RECORDS on the happy path, not just on failure.

## 3. Field vocabularies collide silently — grep the log writer before adding fields
D3's `transport` would have overwritten a same-named legacy key carrying a
different vocabulary in the same jsonl. One grep of the writer found it;
`channel` was born. Additive log evolution means checking every existing key,
not just adding new ones.

## 4. Real-CLI canaries need TOTAL environment isolation, and trust models have layers
`--dangerously-bypass-hook-trust` writes to the global CODEX_HOME (pollution)
and bypasses only per-HOOK trust — per-PROJECT trust must be seeded too, or
hooks silently no-op in a way indistinguishable from "nothing happened".
Point CODEX_HOME at a per-run mktemp; seed both trust layers in the fixture;
clean up in finally.

## 5. Parallel cells sharing a generated artifact always conflict on it — plan the regeneration, not the merge
Every wave merge conflicted only on release-manifest.json / rendered trees.
The resolution is always: take either side, re-render, --write, commit. Never
hand-merge a generated file; budget one regeneration commit per merge.

## Follow-ups
- Live A/B data accrues per docs/decisions/ab-tiny-protocol.md.
- Windows lane grows suites only after a real windows-latest run proves them.
- install.ps1 E2E harness remains the named backlog item.
