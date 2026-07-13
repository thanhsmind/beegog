# shim-retire-3 — hooks: LEGACY_HELPER_RE transition guard, prose sweep, guard-message assertions

[DONE]

Both hook suites were RED at claim time (SITUATION UPDATE: cell shim-retire-1
had already synced `.bee/bin/lib/guards.mjs` to the new `bee.mjs state` /
`bee.mjs backlog add` message strings). Fixed both suites and swept the three
hooks' remaining shim-name prose:

- Kept `LEGACY_HELPER_RE` in `bee-write-guard.mjs` per D3; rewrote its comment
  to state plainly it is a transition guard for hosts whose vendored bins
  predate shim-retire, slated for grooming removal.
- Swept `bee_*.mjs`-named comments/messages in `bee-write-guard.mjs`,
  `bee-chain-nudge.mjs` (SubagentStop nudge text + a code comment), and
  `bee-session-close.mjs` (decision-nudge message) to the `bee.mjs <group>
  <verb>` form.
- Flipped 9 guard-message assertions in `test_write_guard.mjs` and 1 in
  `test_hook_contracts.mjs` (plus 2 adjacent comments) from
  `bee_state.mjs`/`bee_backlog.mjs` to `bee.mjs state`/`bee.mjs backlog add`,
  reading the real strings from `guards.mjs`'s `DIRECT_EDIT_DENY` map rather
  than guessing.
- Added rows 5c/5d to `test_write_guard.mjs`: both the legacy
  `bee_cells.mjs cap` shape and the dispatcher `bee.mjs cells cap` shape
  resolve to the same `cells.cap` registry entry (the coverage the cell
  called out as "verified missing").
- Filed backlog debt (type `debt`, layer `hooks`, P3) for the eventual
  `LEGACY_HELPER_RE` removal once hosts have re-onboarded past this release.

## Deviation (auto-fixed, rule 1/3 — bug in touched code)

`test_write_guard.mjs`'s `copyLib` hardcoded a 4-file list
(`state.mjs, fsutil.mjs, reservations.mjs, guards.mjs`) that omitted
`claims.mjs`, a real transitive dependency `state.mjs` now imports. Every
fixture row hit `ERR_MODULE_NOT_FOUND` at import and the hook fail-opened
universally — this, not just the stale message strings, was producing most
of the 46 failures seen at claim time (many showed `status=0 stderr=` instead
of a genuine mismatch). Switched `copyLib` to a full `readdirSync` of
`.bee/bin/lib`, matching `test_hook_contracts.mjs`'s own `copyLib`, which
also newly exercises the CLI-shape check (d) — command-registry.mjs and
validate-args.mjs are now present in the fixture, which the 5c/5d rows rely
on.

Verify: `node hooks/test_write_guard.mjs && node hooks/test_hook_contracts.mjs`
— both ALL PASS (test_write_guard.mjs: every row including new 5c/5d;
test_hook_contracts.mjs: 141 rows / 16 groups / 0 failing).

Files touched: `hooks/bee-write-guard.mjs`, `hooks/bee-chain-nudge.mjs`,
`hooks/bee-session-close.mjs`, `hooks/test_write_guard.mjs`,
`hooks/test_hook_contracts.mjs`.

Full trace and evidence: `.bee/cells/shim-retire-3.json`.

No outstanding questions.
