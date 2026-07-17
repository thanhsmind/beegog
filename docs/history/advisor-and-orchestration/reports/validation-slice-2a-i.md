# Validation — Slice 2A-i (safety floor)

**Verdict: NOT READY — RETURN TO PLANNING (cell repair).** Date 2026-07-17.
Baseline verify GREEN this session (exit 0, full `commands.verify` suite). Schedule: 2 waves, no cycle (`ao-2ai-1` → `ao-2ai-2`). No source touched.

## Reality gate

| Lens | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | High-risk correct — external provider + audit/security (unsafe exec flags, write-guard bypass). |
| REPO FIT | PASS | Seams confirmed: `state.mjs` normalizeTierValue:173 / normalizeModels:228 / resolveTier:880 (standalone, cli branch is a pure return); command-registry is generic (`resolveCommand` bee.mjs:2163, `HANDLERS` :2055-2124, no group allowlist); `test_lib_mirror` enforces template↔`.bee/bin/lib` byte-identity. |
| ASSUMPTIONS | PASS (with corrections) | Validator can be added beside `resolveTier` without a throw on the hook hot path (AO12 sound: guard :133 → modelForTier → resolveTier). |
| SMALLER PATH | **CHANGED** | Panel found part of 2A-i **already shipped**: `config-sample-cli-executors.json` B3/B7 fixed by `ao-2e` (commit `22e92f8`, 2026-07-14). The slice is smaller than planned. |
| PROOF SURFACE | PASS | `scripts/test_config_validate.mjs` per-refusal rows + malformed-input row; behavior_change true. |

## Panel findings (opus, review slot)

### ao-2ai-1 — config-validate verb
- **[BLOCKER] mirror file missing.** `.bee/bin/lib/command-registry.mjs` not in `files`; the verb's own reachability artifact + `test_lib_mirror` both require editing the mirror. Registration pattern confirmed clean (registry entry + `handleConfigValidate` + HANDLERS row).
- **[BLOCKER] security blocklist naive.** Literal `--yolo`/`--dangerously-skip-permissions` block is bypassed by aliases (`--dangerously-bypass-approvals-and-sandbox`, `--full-auto`, `-s danger-full-access`). Blocklist ≠ positive read-only guarantee; env/wrapper/alias injection is invisible to string inspection — must be enumerated + framed honestly.
- **[WARNING]** `bee status --json` warning host unspecified (→ `handleStatus` bee.mjs:529); B2 transport-detection mechanism unspecified (trailing `-` / `"$(cat)"` sniff is runtime-specific).

### ao-2ai-2 — fix shipped defaults
- **[BLOCKER] stale premise.** All three target files already remediated (`config-sample-cli-executors.json`, `model-presets.md:74/112`, `swarming-reference.md:209`). The live `--yolo … workspace-write` now sits in `.bee/config-sample.json:37` and `docs/config-reference.md:40` — **neither in the cell's `files`.** Cell fixes already-fixed files.
- **[BLOCKER] grep-test scope unspecified** → either fails in-bounds or passes vacuously.

## Repairs applied (return-to-planning, this session)

- **ao-2ai-1:** added `.bee/bin/lib/command-registry.mjs` to `files`; action enumerates the unsafe-flag alias closure and frames the check as a *known-bad blocklist, not a read-only guarantee*; names the `bee status` warning host and the B2 transport-detection mechanism; prohibition records that env/wrapper/alias injection is out of string-inspection reach (documented gap, handed to a later capability slice, not silently claimed resolved).
- **ao-2ai-2:** re-scoped to the surviving defects — `files` now `.bee/config-sample.json` + `docs/config-reference.md`; grep-test pinned to **all** shipped configs/docs; note that the originally-named files were already fixed by `ao-2e`.

## Next

Re-validate the repaired cells (one lighter panel pass on the changed dimensions), then Gate 3. A fresh session is recommended — full context for the re-check.
