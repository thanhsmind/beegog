# shim-retire-4 — AGENTS block + AGENTS.md + README + INSTALL: bee.mjs is the only CLI

[DONE]

Rewrote every `bee_*.mjs` invocation in `AGENTS.md`, `skills/bee-hive/templates/AGENTS.block.md`,
`README.md`, and `INSTALL.md` to the `node .bee/bin/bee.mjs <group> <verb>` form, rewrote AGENTS
block step 7 to describe `bee.mjs` as the sole shipped CLI (dropped the "shim is a thin layer /
helper invocations keep working" clause per D1), mirrored the template byte-identically into
`AGENTS.md`'s BEE:START/END block, rewrote the README "Vendored helpers" section to describe
`bee.mjs`'s 9 command groups instead of 4 separate files, and updated the coupled
`test_onboard_bee.mjs:153` assertion (plan-check B3) to match the new canonical text.

Files touched: `AGENTS.md`, `skills/bee-hive/templates/AGENTS.block.md`, `README.md`,
`INSTALL.md`, `skills/bee-hive/scripts/test_onboard_bee.mjs`.

Full trace/evidence: `.bee/cells/shim-retire-4.json`.
