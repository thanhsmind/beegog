# Pre-release review — v0.1.44 (session `pre-release-0-1-44`)

Scope: 12 unreviewed candidates, cumulative diff `c8886f88..0847310`
(235 files, ~25.3K insertions / 5.4K deletions, 94 commits).
Wave: code-quality · architecture · security · test-coverage · api-contract · reliability (6 reviewers, opus, review tier).

`.bee/bin/lib/*.mjs` is a byte-identical vendored mirror of `skills/bee-hive/templates/lib/*.mjs`; reviewed at source. All file:line anchors are source paths.

## Headline

- **The 12 in-scope features carry ZERO P1.** Chain-integrity refusals, cross-session fail-closed writes, and handoff source-gating all ship with genuine RED-first tests, not tautological assertions (test-coverage). Registry↔handler bijection is exact (58↔58) and the vendored-mirror parity test is real (api-contract, architecture).
- **One P1 was found at the release tip (`f3b4425`), introduced this session, now FIXED** (commit `434817b`, delta re-review clean).

---

## P1 — RESOLVED

### P1-1 `cells.add` manifest example was non-runnable → `test_bee_cli.mjs` red (api-contract)
The stdin-first-nudge change set `cells.add` `examples[0]` to `printf '%s' '[{...cell...}]' | bee cells add --stdin --json` — a shell pipeline with placeholder JSON. The registry contract requires every `examples[]` entry to be a runnable `bee <group> <verb>` string that `test_bee_cli.mjs` executes and asserts non-erroring, and `cells.add`'s example must create the `demo-1` fixture the rest of the CLI-test chain depends on. Result: `test_bee_cli.mjs` went 109/12.
**Fix (434817b):** reverted `examples[0]` to `'bee cells add --file cell-demo-1.json --json'`; kept the stdin-first nudge in the (non-executed) description + `07-contracts.md`; source+mirror byte-identical. `test_bee_cli.mjs` back to 121/0. Delta re-review: the passing suite runs every registry example, so the defect class is swept clean.

---

## P2 — open, non-blocking (filed to backlog)

### P2-1 Lane/session records are gate-decision inputs but freely hand-writable (security; corroborated by architecture P2-4)
`checkWrite` resolves the intake/Gate-3 decision from `.bee/lanes/<f>.json` + `.bee/sessions/<id>.json` when a `session_id` is present, but `DIRECT_EDIT_DENY` protects only `.bee/state.json` / `.bee/backlog.jsonl`; both lane and session files match the `.bee/` allowlist and are writable in every phase. An agent can hand-write a lane (`phase:swarming`, gates approved) + a session binding and flip its own gate / force `compounding-complete`, bypassing both the write-guard and the chain-integrity close guard — no CLI verb, no "never self-approve" discipline. Rated P2 because lanes are opt-in and bee's threat model is a forgetful, not adversarial, agent; the P1 reading is legitimate if adversarial agents are in scope. **Highest-severity open finding.**
Fix: treat `.bee/lanes/` + `.bee/sessions/` as CLI-owned (deny direct Edit/Write like state.json).
Evidence: `guards.mjs:33,55-58,160-171`; `state.mjs:471-507`; `bee.mjs:785`.

### P2-2 Orphaned `.adopting` gate wedges a claim permanently after a hard crash (reliability + code-quality — independently corroborated)
`adoptClaim`/`releaseClaim`/`sweepExpiredClaims` serialize on an exclusive `<cell>.adopting` gate with no TTL/stale-reclaim. A SIGKILL/OOM/power-loss between `acquireGate` and the `finally` `releaseGate` orphans the file; every later adopt/release/sweep on that cell returns `GATE_HELD` forever — on the HIGH-RISK fresh-session-handoff path. Fix: on `EEXIST`, read the gate's `at` stamp and reclaim if older than a short bound.
Evidence: `claims.mjs` `acquireGate`/`releaseGate`/`sweepExpiredClaims`.

### P2-3 `adoptClaim` transfers ownership with no expected-owner check → concurrent double-adopt / steal (reliability)
`adoptHandoff`→`adoptClaim` rewrites whatever claim exists to the new session unconditionally; "read handoff → adopt → clear" is not atomic across sessions. Two fresh sessions can each adopt the same planned-next (fixture: high-risk) cell and both render a start-now preamble. Fix: thread the handoff's `writer_session` as `expectedOwner`; refuse under the gate when the re-read owner differs.
Evidence: `state.mjs:261-287`, `claims.mjs:254-279`, `hooks/bee-session-init.mjs:90`.

### P2-4 D3 manifest `required: []` is dishonest for ~15 commands (architecture; corroborated by api-contract)
~15 `state.*`/`backlog.*`/`reviews.*` entries declare `required:[]` while handlers mandate the flags — deliberate, to keep legacy errors on stderr (DB3), but it means an agent auto-driving off the `parameters.required` schema omits mandatory flags on a third of the surface. Fix: populate honest `required` and route those handlers' required-flag errors to stderr, or mark the entry's strict stream.
Evidence: `command-registry.mjs:799-822, 1138-1158, 1236-1252`.

### P2-5 Two divergent flag parsers (dispatcher vs write-guard hook) (architecture)
`bee.mjs` uses a hardcoded `FLAG_ALONE_BOOLEANS` set; the write-guard's `parseCliFlags` decides value-less purely from `propSchema.type==='boolean'`. They provably disagree for `cells.verify --passed`. The guard can model a different command line than the dispatcher runs. (Code-quality confirmed check-(d) is currently safe against false-denials, limiting blast radius.) Fix: one shared `parseFlags` imported by both.

### P2-6 Schema `enum` declared everywhere, enforced by no shared layer (architecture)
`validate()` checks `required`+`type` only, never `enum`; enforcement is scattered — `bee cells list --status bogus` silently returns "No cells." Fix: add an enum branch to `validate()` or a test asserting each enum handler rejects out-of-enum.

### P2-7 chain-integrity close guard lives at handler altitude, not the state-mutation primitive (architecture)
`checkPhaseTransition` + `closeGuardScribingDebt` run only inside `handleStateSet`; `writeState`/`writeLane` don't. Any future direct state writer reaches `compounding-complete` unchecked. (Overlaps P2-1's lane vector.) Fix: route phase writes through one `applyPhaseTransition` in `state.mjs`.

### P2-8 `test_bee_cli.mjs` is not in the release verify gate (api-contract)
`.bee/config.json` `commands.verify` runs `test_lib` + hook tests but NOT `test_bee_cli.mjs` — the very test that enforces "every registry example runs." This is exactly how P1-1 shipped red unnoticed. Fix: add `node skills/bee-hive/templates/tests/test_bee_cli.mjs` to `commands.verify`.

### P2-9 D6 doc-honesty guard weaker than the runtime after ci-1 (test-coverage)
D6 flags documented `--phase <name>` only when `<name>` is outside `KNOWN_PHASES`, but `state set` now also throws for in-enum `compounding` (and misordered `compounding-complete`). A future SKILL.md adding `--phase compounding` passes D6 yet makes every agent following it hit a throw. Fix: add `compounding`/`scribing` to a documented-but-unsettable denylist checked alongside membership.

---

## P3 — cleanup/debt (filed to backlog)

- **P3-1** `writeJsonAtomic` uses a fixed `${file}.tmp` sibling → concurrent same-file writers (session/lane/reservation) can collide; make the temp name unique. (reliability)
- **P3-2** `claimNextCell` returns `CLAIMED` on losing the race for its top candidate without trying the next ready cell — an un-expired orphan claim blocks `claim-next` for up to the TTL. (code-quality)
- **P3-3** `checkPhaseTransition`/`checkScribingRunPhase` are never unit-tested directly. (test-coverage)
- **P3-4** `SCRIBING_RUN_FROM` legal entries `reviewing`/`scribing` are untested. (test-coverage)
- **P3-5** `CELL_STATUSES` duplicated in the registry, comment-synced to `cells.mjs`; export+import instead. (architecture)
- **P3-6** `HANDLERS` is a second parallel structure to `COMMAND_REGISTRY`; add a set-equality test or attach handler refs to entries. (architecture)

---

## Verification & artifact gates

- Verification-evidence preflight (`reviews create`) passed — no behavior_change cell in scope with missing evidence.
- Full verify suite + `test_bee_cli.mjs` green at HEAD after the P1 fix.
- No fail-open-where-must-fail-closed defects in the four hooks (security + reliability both cleared them); the intake gate now covering `compounding-complete` and the corrupt-reservation-store fail-closed path are genuine hardening improvements.
