---
date: 2026-07-24
feature: installer-verify-orphan-drift
categories: [onboarding, installer, drift-detection]
severity: P2
tags: [ledger-diff, self-derived-removal, onboard_bee]
---

# Learnings — installer-verify-orphan-drift

## What Happened

A `curl install.sh` onboarding run against this repo (repo-copy mode) failed at
the final verification step: `version parity failed: expected 1.14.0, got
bee=1.14.0, plugin=1.14.0, drift=true` then `Verification failed: unexpected
bee.mjs status output.` — even though every version number matched. Root cause:
`bee.mjs status`'s drift check correctly flagged `.bee/bin/lib/herding.mjs` as
`(extra)`, because the onboarding ledger's `managed.lib` map no longer listed it
(the module had been retired from `templates/lib/`), yet the physical file was
never deleted. No apply, however many times re-run, could ever clear the drift.

## Root Cause

`onboard_bee.mjs`'s plan builder only ever iterates the CURRENT
`templates/lib/` directory to decide what to copy/update — a name that
disappeared from source simply never appears in that loop again, and nothing
else ever produces a removal for it. Helpers already had this problem solved
correctly (`RETIRED_HELPERS`, a hand-maintained list, D2 shim-retire) — but
lib modules had no equivalent at all. `ledger_parity.mjs`'s own doc comment
already named this exact class of gap ("an unrecorded *.mjs sitting in the
fully-managed .bee/bin/lib dir") but its prescribed fix — "re-run self-onboard"
— only refreshes the ledger's *content hashes*, never deletes an orphaned file;
nobody had connected the two facts into an actual fix.

## Recommendation

When a managed-file set (helpers, lib modules, hooks, anything a ledger
fingerprints) can shrink because upstream retires an entry, removal must be
derived from the **ledger diff** (previous recorded keys minus the current
desired set), never a hand-maintained retired-list — a hand list requires every
future author to remember to add an entry, and this exact bug is what happens
when one is forgotten. When a status/drift check already flags "an installed
file the ledger doesn't recognize" as a defect, check next to it whether the
write path that would clear that defect actually exists — a report-only check
paired with no corresponding fix is a permanent false-positive waiting to ship.
