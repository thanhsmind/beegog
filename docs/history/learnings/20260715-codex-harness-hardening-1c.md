---
date: 2026-07-15
feature: codex-harness-hardening-1c
categories: [decision, integration]
severity: medium
tags: [drift-detection, existing-artifacts, anti-reinvention, status]
---

# The authoritative reference you need often already exists in a ledger you're already writing

## What Happened

Honest status drift looked like it needed a new shipped artifact — the plan floated
"project the release manifest into `.bee/`" or "check a `plugin.json` version." A single
scout of the live `.bee/onboarding.json` collapsed the whole design: onboarding **already
records** a per-file sha256 of every vendored helper and lib module (`managed.lib`,
`managed.helpers`), written at every apply, and `computePlan` **already computes** the
current source's desired hashes to detect onboarding drift. So `bee status` needed only to
re-hash the live bytes and compare against the map the host already carried — no new
artifact, no new format, no distribution change. A ~40-line pure function.

## Root Cause

The reference existed but was invisible from where the problem was framed (the status path).
The design had jumped to "what new thing do we ship?" before checking "what does the host
already have?". The managed-hash ledger had been there since installer-hardening; the drift
code simply never consulted it.

## Recommendation

- **Before designing a new reference/manifest/fingerprint artifact, grep for one that
  already ships.** A system that vendors files almost always already records what it
  vendored — an install ledger, a lockfile, a manifest. Read the live artifact (not just the
  writer's code) before proposing a new one: `.bee/onboarding.json` answered a question three
  candidate designs were competing to answer.
- **Combine the two halves of an integrity guarantee across features.** 1b blocks the
  *write* path (onboard refuses downgrades); 1c makes the *read* path honest (status compares
  live vs recorded). Neither alone is enough — a downgrade via a non-onboard path is caught
  by 1c; a false-green after an onboard downgrade is prevented by 1b keeping the ledger from
  being rewritten downward. Design integrity as write-guard + read-truth, not one or the other.
- **A self-hosting repo must reconcile its own ledger after editing its own runtime.** Editing
  `bee.mjs` legitimately made beegog's own status show drift (recorded hash went stale); a
  self-onboard `--apply` re-records it. Expect and handle this when the tool operates on itself.
