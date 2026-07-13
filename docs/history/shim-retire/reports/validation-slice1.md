# Validation report — shim-retire slice 1 (cells shim-retire-1..6)

Lane: standard · Plan: `docs/history/shim-retire/plan.md` (implementation-ready)
Decisions: entry `bbc6bcea` (D1–D5) + bypass audit entries.

## Reality gate

| Check | Verdict | Evidence |
|---|---|---|
| MODE FIT | PASS | 3 flags counted (public contracts, existing covered behavior, cross-platform) → standard; no hard-gate flag. |
| REPO FIT | PASS | `bee.mjs --help --json` manifest covers all 9 groups (run this session); onboard copy-only loop confirmed at `onboard_bee.mjs:1435-1441`; installer verify at `install.sh:254`, `install.ps1:197`; `LEGACY_HELPER_RE` at `bee-write-guard.mjs:130`. |
| ASSUMPTIONS | PASS | (1) DA5 bijection re-point feasible: `node .bee/bin/bee.mjs cells nosuchverb` prints the same "Unknown command … Use: list, ready, …" contract line per group (probe output this session). (2) Manifest-hash test is behavioral (`test_bee_cli.mjs:1022-1026` — deterministic + content-sensitive), no pinned constant to chase. (3) No runtime spawns a shim: hooks wiring JSONs, session-init, statusline all grep-clean (probe this session). |
| SMALLER PATH | PASS | Docs-only sweep without deletion would leave dead shipped files and the compat trap the owner explicitly rejected; deletion without onboarding removal (D2) strands every host — both smaller paths are dishonest. |
| PROOF SURFACE | PASS | Every cell `verify` is a runnable command (test suites, `bash -n`, grep-zero checks); full baseline verify was green at session start (exit 0). |

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| bee.mjs implements every verb the shims exposed | LOW | manifest + parity tests | dispatcher-unify shipped with parity suite green (decision 0a4949e7); manifest lists 9 groups | PROVEN |
| Unknown-command contract line exists on dispatcher group path (DA5 re-point) | MED | runtime probe | probe: `bee.mjs cells nosuchverb` → "Unknown command … Use: …" | PROVEN |
| Onboarding never deletes vendored files today (D2 needed) | MED | code inspection | `buildPlan` §3 only pushes `copy_helper` when missing/drifted (`onboard_bee.mjs:1435-1441`); no removal action exists | PROVEN |
| Nothing at runtime spawns shim files | HIGH if wrong | grep of hook wiring/session-init/statusline/plugin configs | all clean (probes this session) | PROVEN |
| Write-guard already supports dispatcher shape | LOW | code inspection | `DISPATCHER_RE` at `bee-write-guard.mjs:131` | PROVEN |

## Plan-checker findings (review tier: opus) — 4 BLOCKERS / 5 WARNINGS, all resolved

- **B1** cell 5 verify swept 9 `CREATION-LOG.md` files outside its scope → un-cappable. **Fixed:** verify + scope exclude CREATION-LOG.md (historical records per D4).
- **B2** cell 6 living-docs sweep missed docs/01/03/04/05/08/09, docs/specs/feedback-digest.md, reading-map.md, docs/config-reference.md, docs/model-presets.md and verified none of them. **Fixed:** full file list + grep-zero verify over `docs/specs docs/0*-*.md docs/config-reference.md docs/model-presets.md`.
- **B3** `test_onboard_bee.mjs:153` pins `bee_status.mjs` inside the AGENTS block; block-editing cell (4) and test-owning cell (2) were siblings → red baseline with no owner. **Fixed:** cell 4 owns the assertion update, depends on cell 2, runs the onboard suite in its verify.
- **B4** hook tests copy lib from stale `.bee/bin/lib` until the cell-6 self-onboard; flipping guard-message assertions in cell 3 would go red, not flipping them leaves post-feature red. **Fixed:** cell 3 explicitly prohibited from flipping them; cell 6 flips them after `--apply` and runs both hook suites in its verify.
- **W1** "manifest strip code" was a phantom; `computeManifestHash` hashes raw registry incl. `helper` → drift hash changes. Folded into cell 1.
- **W2/W3** test_lib shim-spawn sections (~3325-4080, 5658-5852, 6226-6830) and parity span (through ~1225) understated. Folded into cell 1 anchors.
- **W4** DA5 bijection is a rewrite (magic probe token lives in the deleted shims); reconstruct from the dispatcher's `Use:` contract lines — probe-verified feasible. Folded into cell 1.
- **W5** `.claude/settings.local.json` stale shim permission grants — harmless allowlist entries, out of D4 scope, left alone.
- Confirmed non-issues: no runtime spawns a shim; `commands.verify` references no deleted file; no templates↔`.bee/bin` drift check blocks claim/cap mid-feature.

## Cold-pickup cell review (review tier: opus) — FIX FIRST → fixed

- Cell 1: 2 CRITICAL (misleading parity line-range; three-edit coupling unflagged) — fixed via callsite-keyed instructions (`runScript(BEE_*)` = delete, `runBee`-only = keep, demo-2 fixture survives) and an explicit atomicity note. 2 MINOR folded (phantom strip code; `test_lib.mjs:937` legacy parser input stays per D3).
- Cell 5: 1 CRITICAL (verify vs scope mismatch, same as B1) — fixed.
- Cells 2/3/4/6: COLD-PICKUP OK; MINORs folded (remove_skill precedent at onboard_bee.mjs:1785 cited in cell 2; cell 6 grep-zero verify added).

## Approval block

Verdict: **READY** (iteration 2 self-check: every blocker fix verified present in the updated cells — deps `shim-retire-4 ← 2`, verifies re-read via `cells show`).
Gate 3: auto-approved via gate bypass (standard lane, no hard-gate flag) — audit decision logged.
