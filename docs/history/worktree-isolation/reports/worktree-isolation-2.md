[DONE]

Nova implemented typed worktree/store resolution, canonical containment before authorization for every write tool, linked-invalid denial, and runtime-derived hook mirror parity. Exact verification passed, including 148 hook-contract rows and the 136-file release manifest.

Files touched: `hooks/adapter.mjs`, `hooks/bee-write-guard.mjs`, both `.bee/bin/hooks` mirrors, `hooks/test_write_guard.mjs`, `hooks/test_hook_contracts.mjs`, `scripts/test_lib_mirror.mjs`, and the release manifest.

Full cell scope and trace: [worktree-isolation-2](../../../.bee/cells/worktree-isolation-2.json)

## Commit limitation

- `.git` is read-only in this Codex sandbox, so the required one-cell commit could not be created. No workaround was attempted.
