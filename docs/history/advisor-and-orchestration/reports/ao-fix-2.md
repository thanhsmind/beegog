# ao-fix-2

**Status:** [DONE]

**Outcome:** `hooks/test_model_guard.mjs`'s `copyLib()` hand-enumerated
`["state.mjs", "fsutil.mjs"]`, but `state.mjs` now also imports `claims.mjs` and
`reservations.mjs`. Inside the fixture the import threw `ERR_MODULE_NOT_FOUND`,
which `bee-model-guard.mjs`'s fail-open catch (lines 147-150) turned into exit 0
— every expect-deny row read as "allowed" (18 FAILURE(S)). Confirmed the whole
causal chain by hand (manual repro fixture reproduced the exact
`ERR_MODULE_NOT_FOUND` and the fail-open crash line) before touching anything.
Fixed by deriving the vendored lib set with `fs.readdirSync` over the real lib
directory, mirroring `hooks/test_write_guard.mjs:42-57` exactly (no hand-kept
list). Falsifiability proven: temporarily changed the guard's deny return from
`2` to `0`, reran the suite (6 FAILURE(S), landing exactly on the expect-deny
rows: row1, row-table[Agent], row-table[Task], row20c), then restored the guard
byte-for-byte — `git diff --quiet hooks/bee-model-guard.mjs` passes. No
behavioral change shipped in `bee-model-guard.mjs`.

**Files touched:** `hooks/test_model_guard.mjs` (copyLib fixed). `hooks/bee-model-guard.mjs`
was reserved and deliberately broken/restored for the falsifiability check only —
`git diff` on it is empty at cap.

**Full trace/evidence:** `.bee/cells/ao-fix-2.json`
