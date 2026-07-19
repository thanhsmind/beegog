# cnt-5 — canary native-probe leg + A/B protocol update (D3 evidence, V1–V3)

**Status:** [DONE]. **Outcome:** `scripts/canary_codex.mjs` gained `--probe-selftest`
(offline TOML-isolation invariant check, the cell's `verify` command) and `--probe`
(the real, live V1/V3 native-transport observation leg, built on a fixture created via
`onboard_bee.mjs --apply --repo-hooks` with an injected envelope-capture hook ahead of the
real installed `bee-model-guard.mjs`). A live `--probe` run on this host's codex-cli 0.144.6
found V1 has **regressed to REFUSED** since the spike's 0.144.4 CONFIRMED-YES (a new
API-level schema rejection, reproduced on a plain no-override turn too), so V3 stays
UNOBSERVED for a different reason than the spike's gap (the turn never reaches tool
execution here, rather than the hook silently not firing). Either answer was a valid green
per CONTEXT D3 — full detail in `reports/probe-evidence.md`.

A genuine duplicate-key TOML bug in the predecessor's uncommitted `nativeTransportUnlockToml()`
was found live (`codex debug models` failed outright) and fixed; `--probe-selftest` gained a
regression assertion for the shape.

**Files touched:** `scripts/canary_codex.mjs`, `docs/decisions/ab-tiny-protocol.md`,
`docs/history/codex-native-transport/reports/probe-evidence.md`.

**Full trace/evidence:** `.bee/cells/cnt-5.json`.
