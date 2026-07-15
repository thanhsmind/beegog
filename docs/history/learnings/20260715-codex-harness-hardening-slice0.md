---
date: 2026-07-15
feature: codex-harness-hardening
categories: [failure, pattern, process]
severity: high
tags: [split-brain, downgrade, self-skip, freeze-first, sentinel-verify, swarm-rescue]
---

# codex-harness-hardening Slice 0 — freezing the split-brain before fixing it

## What Happened

Slice 0 ("Freeze reality") added executable proof of the harness's current defects **without
fixing them**: a red-now regression fixture, a red-now doc census, a capability snapshot, and one
green change — `test_bee_cli` + a `test_verify_manifest` self-guard wired into mandatory
`commands.verify`. All 4 cells capped; baseline verify stayed green (freezes deliberately kept out
of `verify`).

The regression fixture (`skills/bee-hive/scripts/test_split_brain_regression.mjs`) reproduced
E-02/E-03 hermetically and printed the exact mechanism:

```
plan_status=changes_needed  apply_status=applied  zero_mutation=false
runtime_lib_state_version_before=0.1.44  after=0.1.43
```

## Root Cause

The split-brain silent downgrade is **not** a version-compare miss. Running onboarding from the
in-repo `.agents`/`.claude` projection launcher makes `computeSkillSync` issue `self_skip` for that
projection (source realpath ⊂ repo → blanket skip, the E-05 gap). That leaves the **ungated
`.bee/bin/lib` byte-diff copy** as the sole mutation path, and that copy has no downgrade guard — so
a `0.1.43` source silently overwrites the `0.1.44` runtime lib. `bee status` still reports
`drift:false` because its detector never compares the projection's own version against the runtime.
This is the precise **VER-02 / DIST-04** gap Slices 1–2 must close (shared detector + downgrade
preflight on the vendored-helper copy path, not only the skill-sync path).

## Recommendation

1. **When a slice's job is to freeze a defect, make the freeze a red-now artifact kept OUT of the
   mandatory verify command** — the baseline must stay green so work can continue. Fold each freeze
   into `verify` only when the fix lands (regression → Slice 2, census → Slice 5).
2. **A red-now freeze's wrapper verify MUST assert a specific sentinel string it prints on the
   controlled defect path** (here: `FREEZE-RED: split-brain defect present` + exit sentinel `3`;
   census: `CENSUS-VIOLATION <file>:<line>` + exit `1`) — never a bare filename or a bare non-zero
   exit. A file the fixture merely *reads* appears in a crash stack trace, and node's uncaught-throw
   exit is `1`; either makes a lazy wrapper false-pass on a crash instead of catching the real
   defect. (Plan-checker caught exactly this on the census cell pre-execution.)
3. **When Slices 1–2 fix the downgrade, target the vendored-helper (`.bee/bin/lib`) copy path, not
   just skill-sync** — `self_skip` deliberately bypasses the skill-sync downgrade guard, so the guard
   there never sees the mutation. Prove the fix by flipping this same fixture to exit 0.
4. **Swarm rescue for a worker that dies mid-write:** the cell's `status` field is frozen (moves only
   via claim/verify/cap/block/drop) — you cannot un-claim a dangling cell. Release its reservation,
   `cells drop` it with a reason, and `cells add` the identical content under a new id. A provider
   connection drop is a rung-1 re-dispatch at the **same** tier (a provider error, not a task error).
