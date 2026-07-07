# Planning Reference

Use when `bee-planning` needs artifact templates, cell quality rules, or shape guidance.

## Artifact: approach.md

```markdown
# Approach: <Feature>

## Recommended path
<2–5 sentences: what we build and in what order. Cites D-IDs.>

## Rejected alternatives
- <alternative> — <why rejected, one line>

## Risk map
| Component | Risk | Reason | Proof needed |
|---|---|---|---|
| <area> | LOW/MEDIUM/HIGH | <why> | <command, inspection, or spike question> |

## Files and order
<bounded list, likely touch order>

## Relevant learnings
- <docs/history/learnings file or decision id> — <what it changes here>

## Questions for validating
- <assumption that could invalidate the path>
```

## Artifact: plan.md (unified, one file per feature)

```markdown
---
artifact_contract: bee-plan/v1
artifact_readiness: requirements-only   # → implementation-ready after Gate 2, enriched IN PLACE
mode: tiny | small | standard | high-risk | spike
---

# Plan: <Feature>

Mode: `<mode>` — <k> risk flags: <list, or "none">
Why this is the least workflow that protects the work: <one sentence>

## Requirements (from CONTEXT.md)
- D1: <locked decision restated> ...

## Shape
<one of the bodies below, by mode>

## Test matrix
<edge dimensions that apply (see edge-dimensions.md), at lane depth:
tiny/small = the 2–3 dimensions that bite; standard = one pass over all 12;
high-risk = probes written out per dimension>

## Out of scope
<explicitly not solved; deferred ideas stay deferred>

<!-- implementation-ready additions (after Gate 2): -->
## Current slice
<slice name, entry state, exit state, files bounded, verify commands>
## Cells
<ids created via bee_cells.mjs add — the cells are the JSON files, this is just the index>
```

**Shape bodies by mode:**

- `tiny` / `small` — a direct note: current work outcome, proof command, out of scope.
- `spike` — the one yes/no question, what proves YES, what NO implies, `.spikes/<feature>/` location.
- `standard` (milestone-shaped) — **phase plan**: `Phase | What Changes | Why Now | Demo | Unlocks` table. First phase obvious; later phases build on it; no technical buckets ("backend", "frontend" are not phases).
- `standard` / `high-risk` (capability/risk-shaped) — **epic map**: feature outcome, repo-reality basis, `Epic | Capability/Risk Area | Why It Exists | Slices | Proof Needed` table, slice queue with deps and feasibility status, current slice to prepare.

## Phase plan vs epic map

Use **phases** only when the work has observable milestones a user could demo in order. Use an **epic map** when capability or risk areas explain the work more honestly than a timeline — typical for `high-risk` (it defaults to epic map + mandatory feasibility proof). Never force 2–4 phases onto work that is really one slice, and never use phases as architecture layers.

## Cell quality rules

A cell is an executable prompt a cold worker can pick up with zero session history.

1. **Directive action, no code blocks.** Prose that says what to do and cites decisions (`per D2`). Code belongs in the repo, written by the worker.
2. **Bounded files.** `files` lists everything the worker may write; `read_first` what it must read. A worker touching other paths returns `[BLOCKED]`.
3. **Testable exit.** `verify` is a real command that runs in this repo today. "Manually check" is not a verify.
4. **must_haves are contracts:** `truths` (observable behavior), `artifacts` (path + substantive description — no stub counts), `key_links` (wired, not just existing), `prohibitions` (what must NOT change). Required for `standard` and `high-risk` lanes; `tiny` may omit.
5. **behavior_change honesty.** Any cell changing observable behavior is `behavior_change: true` — reviewing enforces verification evidence on these; mislabeling is a P1 waiting to happen.
6. **Deps are real.** `deps` lists cell ids whose output this cell needs. Ready = all deps capped.
7. **Current slice only.** If you can write the cell without knowing the previous slice's outcome, fine; if it belongs to a later slice, it does not exist yet.

## Example cell JSON (schema per docs/02-architecture.md)

```json
{
  "id": "auth-3",
  "feature": "auth",
  "title": "Wire session middleware into API router",
  "lane": "standard",
  "status": "open",
  "deps": ["auth-1", "auth-2"],
  "decisions": ["D2", "D4"],
  "files": ["src/api/router.ts", "src/auth/middleware.ts"],
  "read_first": ["src/api/router.ts"],
  "action": "Mount the session middleware from auth-2 onto all /api/* routes (per D2). Preserve the existing public response envelope (per D4). Follow the error-handler registration pattern already used in router.ts.",
  "must_haves": {
    "truths": ["Unauthenticated /api/* requests return 401"],
    "artifacts": [{"path": "src/auth/middleware.ts", "substantive": "exports authGuard, no TODO stubs"}],
    "key_links": ["router.ts imports and mounts authGuard"],
    "prohibitions": ["No change to public response envelope"]
  },
  "verify": "npm test -- auth",
  "trace": {
    "worker": null, "outcome": null, "files_changed": [],
    "deviations": [], "friction": null, "capped_at": null,
    "behavior_change": true, "verification_evidence": null
  }
}
```

Create with:

```bash
node .bee/bin/bee_cells.mjs add --file <cell.json>
```

The helper validates id, feature, title, lane, action, verify — and non-empty `must_haves.truths` for `standard`/`high-risk`. Fix rejects; never downgrade the lane to dodge validation.

## Trace of shapes

```text
mode -> shape (plan.md, requirements-only) -> [GATE 2] -> current slice prep (same plan.md, implementation-ready) -> cells
```
