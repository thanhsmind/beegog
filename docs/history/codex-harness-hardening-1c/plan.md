---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: small
feature: codex-harness-hardening-1c
context_source: docs/history/codex-harness-hardening-1c/CONTEXT.md
decisions: D1-D5 (CONTEXT.md); a7ef8fb6 (scope), 485e949a (reference=onboarding.managed), 579bbad7 (report-only boolean)
---

# Slice 1c — Honest bee status drift

Make `bee status` stop reading `drift:false` over a `.bee/bin` whose content no longer matches what
onboarding recorded (E-02, DIST-04, PROJ-08). Read-only status change; no onboarding-logic change.

## Mode gate (mechanical)

Flags: **public-contracts** (status `drift` output — additive: boolean preserved, optional detail added)
· **existing-covered-behavior** (rewrites the `bee.mjs` drift computation). = **2 flags, no hard-gate,
no gray areas (locked D1-D5), ≤3 files → small.** The two flags are low-severity: the contract change is
backward-compatible (drift stays boolean) and the behavior change is a contained, well-understood
rewrite with a locked design. Merged shape+execution gate (fast path).

## Discovery (L0 — pattern exists in repo)

- The reference already ships: `.bee/onboarding.json` records `managed.lib` + `managed.helpers`
  (per-file sha256), written at onboard. Confirmed by direct read of the live ledger.
- `buildManagedVersions` (`onboard_bee.mjs:~1779`) is the exact hashing used to produce those records
  (sha256 of each helper + lib module). `bee.mjs` re-implements the same content hash inline (crypto is
  already imported; `computeManifestHash` uses it).
- Current false-green: `bee.mjs:297` `drift = Boolean(onboardingRaw && onboardingRaw.bee_version !==
  BEE_VERSION)` — ledger-version vs running-constant only; never re-hashes real bytes.
- 1b already refuses onboard-driven downgrades, so `onboarding.managed` can't be rewritten downward —
  this drift check closes the loop for manual/external edits (live ≠ recorded).

## Approach

Rewrite the `drift` computation in `bee.mjs` (status assembly, ~:292-298) — mirror to `.bee/bin/bee.mjs`:

1. Read the recorded `onboarding.managed` map (`lib` + `helpers` per-file sha256) from the ledger.
2. Hash the LIVE files: `.bee/bin/lib/*.mjs` and the managed `.bee/bin/*.mjs` helpers (sha256, same as
   `buildManagedVersions`). Derive the file set from the recorded map (never a hand-list — crit-pattern
   20260714).
3. `drift = true` when: any live file's hash ≠ its recorded hash, OR the live managed file set differs
   (missing/extra) from the recorded set, OR `ledger.bee_version !== BEE_VERSION` (PROJ-08: same-version
   content drift still red).
4. Keep `onboarding.drift` a **boolean**; add optional `onboarding.drift_detail` (array of drifted file
   paths) present only when drift (D4). Report-only — status never heals.
5. Fail-open (D4): absent/legacy `onboarding.managed`, unreadable ledger, or an I/O error → no hard
   error; drift falls back to the version-only signal and status still renders.

### Rejected alternatives (from CONTEXT)
- A new shipped artifact (release manifest into `.bee/`, plugin.json ref) — rejected per D2: the
  managed-hash ledger already exists and already records exactly these per-file hashes.
- Auto-heal in status — rejected per D4: `bee status` is read-only; healing is `onboard --apply`.

## Risk map

| Component | Risk | Proof (inline reality check + cell verify) |
|---|---|---|
| Drift rewrite in bee.mjs | LOW-MED | content-edited `.bee/bin/lib` reads `drift:true`; intact reads `drift:false`; `drift` stays boolean |
| Fail-open on absent/legacy ledger | LOW | absent `managed` → status renders, no throw (degrade to version-only) |
| Mirror byte-identity | LOW | templates/bee.mjs ≡ .bee/bin/bee.mjs (mirror guard green) |

## Test matrix (small depth)

- Content drift: a managed lib file's bytes changed → `drift:true` + `drift_detail` names it (PROJ-08).
- Intact runtime: live hashes == recorded → `drift:false`, no `drift_detail`.
- File-set drift: a managed file missing/extra vs recorded → `drift:true`.
- Version drift: `ledger.bee_version != BEE_VERSION` → `drift:true` (existing signal preserved).
- Fail-open sentinel: absent/legacy `managed` map → status renders, `drift` degrades to version-only,
  never throws (TEST-01 fail-open with a rendered result).

## Cells (current slice = 1c)

- **codex-harness-hardening-1c-1 — honest drift via the onboarding managed-hash ledger.** Rewrite
  `bee.mjs` drift (+ mirror) per the approach; add a status-drift test to `test_bee_cli.mjs`. Verify:
  the new test + `test_lib_mirror` + full verify chain green.
