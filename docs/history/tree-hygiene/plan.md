---
artifact_contract: bee-plan/v1
mode: standard
approved_gate2: 2026-07-21 (auto-approved, gate bypass total; re-scoped after user correction — prior shape dropped with cells th-1..th-3)
---

# plan — tree-hygiene

Source: `docs/history/tree-hygiene/CONTEXT.md` (D1-D6).

## Mode-gate record

Flags: **data/layout model** (a new canonical scratch home + sweep semantics over existing stores), **multi-domain** (CLI verb + write-guard hook + three skills' prose + doctrine + onboarding ignore block), **changes behavior an existing test asserts** (write-guard suites and onboarding gitignore assertions). = 3 flags → **standard**. Not high-risk: no auth/data-loss/external-provider surface, and the sweep is opt-in-explicit with a dry-run.

## Discovery (L0 — measured in-repo)

Anchors in CONTEXT's Evidence/Scout sections; the 153 MB figure and the three partial prose rules were read directly, not inferred.

## Approach

Four cells, ordered so the home exists before anything is told to use it:

1. **th-4 (D1+D2) — the scratch home and its sweep.** `.bee/tmp/<feature-or-session>/` becomes the documented home; add `bee tmp sweep` (`--feature`, `--before`, `--all`, `--dry-run`, `--json`) covering `.bee/tmp/` **and** `.bee/spikes/<feature>/` for closed/absent features, refusing to touch anything outside those two roots. Report bytes and file counts freed. Compounding/session-finish call it for the finishing feature.
2. **th-5 (D3) — crash-leak self-cleaning + ignore coverage.** Render `.old-*` gets the stale-sweep and `finally` its `.tmp-*` sibling already has (live-pid dirs never touched); atomic writers unlink their tmp on a throwing rename and rethrow the original error; the managed ignore block gains `.bee/tmp/`, `.bee/backups/`, the atomic-tmp *shape*, and the four plugin swap-dir patterns.
3. **th-6 (D4) — one rule, enforced.** Write-guard denies scratch-shaped writes into tracked directories, naming `.bee/tmp/` in the refusal; the three scattered prose rules (executing evidence-file, planning scratchpad, validating harness) collapse into one doctrine-layer rule they cite. In-repo `.bak` writers relocate under `.bee/backups/` (stamped) as the same rule applied to backups.
4. **th-7 (D6) — clear the existing 153 MB**, dry-run reviewed first, before/after recorded in the close report.

**Rejected alternative:** relying on `.gitignore` alone (today's state) — it kept `git status` clean while 153 MB accumulated, which is precisely the reported complaint.

**Risk map:** an over-eager sweep eating a deliverable — HIGH → the sweep is root-restricted to `.bee/tmp/` + `.bee/spikes/`, has `--dry-run`, and a test asserts it refuses paths outside those roots and never touches `docs/**`; guard false-positives blocking legitimate writes — MEDIUM → shape list is narrow and tested against real deliverable paths; sweeping a live feature's spikes — MEDIUM → closed/absent features only, live feature requires `--feature` explicitly.

## Slices

- **Slice 1 (current):** th-4 → th-5 → th-6 → th-7, serial (shared render/manifest pipeline; th-6 cites th-4's home; th-7 uses th-4's verb).

## Test matrix sketch

Sweep with no args refuses (no default purge) · `--dry-run` deletes nothing and lists accurately · closed-feature spikes swept, live-feature spikes preserved unless named · refuses any root outside `.bee/tmp|spikes` · `docs/**` and `.bee/cells|decisions.jsonl` untouched under every flag combination · leaked `.old-*` from a dead pid swept, live pid preserved · failed rename leaves no tmp and rethrows the original error · a human's `notes.tmp` stays visible to git while the atomic shape is ignored · guard denies a debug script into `.bee/bin/` and names `.bee/tmp/` · guard allows a report into `docs/history/<feature>/reports/`.
