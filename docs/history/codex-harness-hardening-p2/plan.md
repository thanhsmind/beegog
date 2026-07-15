---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
feature: codex-harness-hardening-p2
context_source: review session review-integrity-2026-07-15 (backlog P2 rows)
decisions: review findings arch P2-1 (shared hasher), arch P2-3 (manifest guard not standing)
---

# Slice P2 — harden the just-shipped integrity guards (two P2 review findings)

Clear the two highest-value, lowest-risk P2 findings from the v1.1.0 integrity review while the code is
fresh. The `--force-downgrade` transparency finding (P2-2) stays backlogged (lowest value, touches the
just-validated guard).

## Mode gate (mechanical)

Flags: **existing-covered-behavior** (managed-hash recorder + drift reader) · **public-contracts** (the
`commands.verify` chain gains a suite) · **multi-domain** (onboard + status + release-guard). = 3 flags,
no hard-gate, no gray areas (design locked by the review findings) → **standard.** Smaller rejected: it
spans three modules and changes the verify contract.

## Discovery (L0 — locked by the review)

- Two hashers must agree for drift to be honest: `buildManagedVersions` (`onboard_bee.mjs:1840,1844`,
  `sha256(readFileSync(...,"utf8"))`) records, `computeRuntimeDrift` (`bee.mjs:254`,
  `createHash(...).update(readFileSync(abs,"utf8"))`) reads. v1.1.0 already matched their input type;
  this slice makes it ONE function so they can't drift (arch P2-1).
- `release_manifest.mjs --check` runs only as the one-shot verify on cell 1a-1, never in the standing
  `commands.verify` (10→11 suites today, none is the manifest check) — so the manifest silently goes
  stale (arch P2-3). `fsutil.mjs` (templates/lib + mirror) already exports `readJson`/`writeJsonAtomic`
  and is already imported by `bee.mjs` — the natural home for `hashFile`.

## Approach

### P2-1a — shared `hashFile()` (one hasher)
Add `hashFile(abs)` to `templates/lib/fsutil.mjs` (+ mirror `.bee/bin/lib/fsutil.mjs`): read the file as
utf8 and return its sha256 — byte-identical to what both sites do today. Rewire the two FILE-hashing
sites to it: `onboard_bee.mjs` `buildManagedVersions` lib/helper hashing (:1840,:1844) and `bee.mjs`
`computeRuntimeDrift` (:254). Leave the generic `sha256(text)` (onboard) / `computeManifestHash`
(bee.mjs) untouched — they hash non-file content (rendered blocks, the command registry), a different
concern. Regenerate the onboarding ledger + release manifest after (the fsutil byte-change moves their
hashes). Prove: beegog self-onboard reconciles to `drift:false`; a content edit still reads `drift:true`.

### P2-3 — make the release manifest a standing guard
Append `node scripts/release_manifest.mjs --selftest && node scripts/release_manifest.mjs --check` to
`.bee/config.json` `commands.verify` (regenerate the stored manifest first so `--check` is green). The
`--selftest` proves the checker bites; `--check` proves the tree matches. Verify chain 11→12 suites.

### Rejected
- `--force-downgrade` blast-radius transparency (P2-2) — deferred: lowest value (--force is rare +
  post-review), and it touches the downgrade guard we just validated. Stays in backlog.

## Risk map

| Component | Risk | Proof |
|---|---|---|
| shared `hashFile` in fsutil (+mirror) | LOW-MED | test_lib fsutil suite green; beegog reconciles drift:false; a content edit reads drift:true; recorder==reader by construction |
| onboard/bee.mjs rewire | LOW | managed-hash values byte-identical to before (ledger unchanged after regen); mirror byte-identical |
| release_manifest in verify | LOW | `--selftest` + `--check` green; full 12-suite chain EXIT=0 |

## Test matrix
- Recorder/reader agree: after regen, beegog `bee status` drift:false; edit a lib file → drift:true naming it.
- Manifest guard bites: `--selftest` passes (injected diff detected); `--check` green on the real tree.
- Mirror: templates/lib/fsutil.mjs ≡ .bee/bin/lib/fsutil.mjs; templates/bee.mjs ≡ .bee/bin/bee.mjs.
- No regression: full verify chain (now 12 suites) green.

## Cells (current slice)
- **codex-harness-hardening-p2-1 — shared hashFile()**: add to fsutil (+mirror), rewire onboard + bee.mjs
  file-hashing, regenerate ledger + manifest. behavior_change (drift/record internals unified).
- **codex-harness-hardening-p2-2 — release_manifest --check joins commands.verify**: append the two
  invocations, regenerate the stored manifest, 12-suite green.
