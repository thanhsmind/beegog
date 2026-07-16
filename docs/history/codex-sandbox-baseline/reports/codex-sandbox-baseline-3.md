[BLOCKED]

Scoped repair is green locally, but the unchanged full baseline stops at an out-of-scope nested Node launcher before reaching these suites.

Files touched:

- `scripts/test_portable_paths.mjs`
- `hooks/test_hook_contracts.mjs`

Full trace and recorded verification: [codex-sandbox-baseline-3.json](../../../../.bee/cells/codex-sandbox-baseline-3.json)

## Outstanding Questions

- The first baseline command exits 1 because `skills/bee-writing-skills/scripts/test_openai_metadata.mjs` still runs its renderer through nested `spawnSync`; should a follow-up cell migrate that launcher to the shared Worker runner before this cell is re-verified?
