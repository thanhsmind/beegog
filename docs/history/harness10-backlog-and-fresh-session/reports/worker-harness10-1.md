# Worker Report — harness10-1

**Status:** [DONE]
**Worker:** forager-1
**Cell:** harness10-1 — commands_detect.mjs: detect host-project standard commands from manifests (lane: small, behavior_change: true, decision D3)
**Capped:** 2026-07-08T07:43:36.465Z

## Files changed

- `skills/bee-hive/templates/lib/commands_detect.mjs` (new) — exports `detectCommands(root)`; guarded CLI entry (`node .bee/bin/lib/commands_detect.mjs [root]`) prints the JSON candidate list; importing stays side-effect-free
- `skills/bee-hive/templates/tests/test_lib.mjs` — 6 new fixture-dir tests (os.tmpdir() fixtures, Windows-safe absolute paths per critical-pattern 20260708)

## Implementation notes

- Explicit sources: package.json scripts (`npm run <script>`, `npm test` for test), Makefile column-0 targets (`make <target>`, never recipe bodies), composer.json scripts (`composer <script>`, string or array values).
- Ecosystem conventions fire only when no explicit source matched the key: pyproject.toml → `test: pytest`, lexicographically-first `*.csproj` → `test: dotnet test`, go.mod → `test: go test ./...` — each carries the marker file as `source` so the user sees it is a convention to confirm (D3 propose-only).
- Dedup: at most one candidate per key; priority package.json > Makefile > composer.json > pyproject.toml > *.csproj > go.mod; output ordered by COMMAND_KEYS.
- `COMMAND_KEYS` imported from `./state.mjs` — no duplicated key list (key_link held).
- Prohibitions held: no writes to `.bee/config.json`; reads named manifests only, never secret-shaped paths.
- No changes needed in `onboard_bee.mjs`: it enumerates `templates/lib` dynamically, so the new module vendors to `.bee/bin/lib/commands_detect.mjs` automatically (onboard suite now asserts `.bee/bin/lib/commands_detect.mjs copied verbatim`).

## Verify

Command (cell verify, run exactly):

```
node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs
```

Output tail:

```
PASS  detectCommands returns [] on a repo with no manifests
PASS  detectCommands maps package.json scripts to invocable npm commands
PASS  detectCommands maps Makefile targets, never recipe bodies
PASS  detectCommands dedups: package.json beats Makefile on the same key
PASS  detectCommands proposes ecosystem conventions only without an explicit match
PASS  commands_detect.mjs run directly prints JSON candidates (CLI entry)

47 passed, 0 failed
...
PASS - failures: 0, skipped: 0
```

Baseline before implementation: 41 passed, 0 failed + onboard PASS (green).

## Verification evidence (behavior_change)

- Red-failure proof: temporarily flipped explicit-source priority (Makefile before package.json) → `FAIL  detectCommands dedups: package.json beats Makefile on the same key — package.json wins the dedup` (46 passed, 1 failed); restored → 47 passed, 0 failed.
- Full evidence recorded on the cell trace via `--evidence-file`.

## Deviations

None. Cell implemented as written; no bugs found in touched code, no missing critical functionality, no architectural change needed.

## Friction

None recorded — no trigger fired.
