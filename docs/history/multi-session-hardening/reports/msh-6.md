# msh-6 — doctrine sync: orchestrator-claims-before-spawn in skill text + final render/manifest

[DONE]

Skill text now matches D1/D3 reality: the orchestrator claims a cell before spawning (never the worker), a worker only validates ownership via `cells show`, and no literal session id is ever handed down in worker templates. Wired the four new race/lock/heartbeat suites into `.bee/config.json` `commands.verify`. Regenerated the release manifest.

Files touched: `skills/bee-executing/SKILL.md`, `skills/bee-executing/references/worker-details.md`, `skills/bee-swarming/SKILL.md`, `skills/bee-swarming/references/swarming-reference.md`, `.bee/config.json`, `docs/history/codex-harness-hardening/release-manifest.json`.

Full trace and evidence: `.bee/cells/msh-6.json`.

## Deviations / Friction

Wiring `test_claim_race.mjs` into `commands.verify` (as the cell's action required) surfaced a **pre-existing, out-of-scope regression**: its scenario (c) same-session round-trip (claim → block → reopen → claim) throws, because msh-4's D4 claim-ownership guard now checks `blockCell`/`reopenCell` callers, but the test (written by msh-2, before D4 existed) calls both without a matching session id. msh-4's own verify never re-ran this msh-2 suite, so the gap went uncaught until this cell wired it into the aggregate chain. `test_store_lock.mjs`, `test_reservation_race.mjs`, and `test_heartbeat_touch.mjs` all run fresh-green.

Not fixed here — `scripts/test_claim_race.mjs` is outside this cell's file scope (docs/skill-text/config only, no lib/test edits). **Needs a fix-first tiny cell** (a one-line same-session `sessionId` fix in the test's `blockCell`/`reopenCell` calls) before the next full `commands.verify` run reports green. Full detail in the cell trace's `deviations` entry.
