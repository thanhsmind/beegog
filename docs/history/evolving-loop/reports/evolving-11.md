# evolving-11 — Wiring + docs + ship (slice B close)

**Status:** `[DONE]` — capped 2026-07-10T10:11:24.727Z.

**Outcome (one line):** Wired slice B's surface — hive routing row for `bee-evolving` (three-spot
mirror, disambiguated from `bee-writing-skills`, RED-before-GREEN routing pressure evidence per
decision `ff26725d`), `docs/07-contracts.md` `rank` CLI surface + `bee-evolving` enforced-invariants
contract, `docs/config-reference.md` `dogfood_repos`, `docs/decisions/0022-evolving-loop.md`
(D1–D5, D2 supersede, datamark-trap resolution, inert-corroboration measurement),
`docs/backlog.md` P18 flipped to `done` at `0.1.19`, and `BEE_VERSION` bumped `0.1.18` → `0.1.19` in
both the template and the vendored `state.mjs` (byte-identical).

**Files touched:**
- `skills/bee-hive/SKILL.md` — routing table row disambiguated + new `bee-evolving` row
- `skills/bee-hive/references/routing-and-contracts.md` — skill catalog `#12` (renumbered
  `bee-briefing`→`#13`, `bee-bypass-gate`→`#14`) + Request-type table row
- `skills/bee-hive/templates/lib/state.mjs` / `.bee/bin/lib/state.mjs` — `BEE_VERSION` `0.1.19`
- `docs/07-contracts.md` — `bee_feedback.mjs` CLI surface (`digest`/`count`/`collect`/`rank`) +
  `bee-evolving` contract section (enforced invariants only)
- `docs/config-reference.md` — `dogfood_repos` key
- `docs/decisions/0022-evolving-loop.md` — new, feature decision record
- `docs/backlog.md` — P18 → `done`, `0.1.19`
- `docs/history/evolving-loop/reports/evolving-11-routing-pressure.md` — new, RED/GREEN routing
  pressure evidence (this cell's own report; evolving-10's report untouched)

Full trace and evidence: `.bee/cells/evolving-11.json`.

**Verification:** `node skills/bee-hive/templates/tests/test_lib.mjs && node
skills/bee-hive/scripts/test_onboard_bee.mjs` → 124 passed, 0 failed (unchanged assertion count);
onboarding suite PASS.

**Deviations:** none.

**Note on scope:** `docs/07-contracts.md` had no prior documentation at all for
`bee_feedback.mjs digest/count/collect` (slice A never added it). The cell's action item named only
"the rank CLI surface and the bee-evolving contract," but leaving `digest`/`count`/`collect`
undocumented next to a newly-documented `rank` would read as an inconsistent contract, so all four
subcommands were documented together in one CLI block — a completion of the existing surface, not a
scope expansion of the contract text itself.
