# E2E supersede dry-run — real decision (dp-9)

Date: 2026-07-21 · Cell: dp-9 · Target: `d20f4c96-97b8-493b-b034-ae3471d778ec`

## Why this decision was genuinely outdated

`d20f4c96` (logged 2026-07-21T03:37:12.551Z) asserted: "...full verify 54/54 green normal AND hermetic; claim_race 10/10; **release NOT tagged** (user decision)".

That clause is factually stale — repo evidence:

- `git tag -l "v1.7.10*"` → `v1.7.10-rc`
- `git log --oneline -1 4f23f89` → `4f23f89 fix(claims): bounded transient-fs retry for Windows rename/unlink races + diagnosable race harness [rel1710rc-5]`

So the tag exists, at the exact commit, after rc-1..5 hardening. This is not a fabricated reversal — it is the same event whose own final rc landed and got tagged after the decision was logged.

## The supersede command run

```
node .bee/bin/bee.mjs decisions supersede \
  --id d20f4c96-97b8-493b-b034-ae3471d778ec \
  --decision "hardening-1-7-10 complete AND released as v1.7.10-rc on 4f23f89 (rc-1..5: CPU-count-proof race suites, timeout-capture split, Windows transient-fs retry); exact-tag CI green both platforms" \
  --rationale "v1.7.10-rc tagged at exact commit 4f23f89 after rc-1..5 hardening (CPU-count-proof race suites, timeout-capture split, Windows transient-fs retry for rename/unlink races); exact-tag CI green on both Linux and Windows, runs 29811023459/29811023424 - the original 'release NOT tagged' clause is factually outdated" \
  --tags release,ci \
  --json
```

Note: the CLI's actual flag is `--id` (not `--target`); confirmed against `bee.mjs --help --json` → `decisions.supersede` schema before running.

### Full output (new event, verbatim)

```json
{
  "id": "257ab1e5-e6ec-46fd-9ba1-ac52bc08601c",
  "type": "supersede",
  "date": "2026-07-21T12:48:43.029Z",
  "supersedes": "d20f4c96-97b8-493b-b034-ae3471d778ec",
  "decision": "hardening-1-7-10 complete AND released as v1.7.10-rc on 4f23f89 (rc-1..5: CPU-count-proof race suites, timeout-capture split, Windows transient-fs retry); exact-tag CI green both platforms",
  "rationale": "v1.7.10-rc tagged at exact commit 4f23f89 after rc-1..5 hardening (CPU-count-proof race suites, timeout-capture split, Windows transient-fs retry for rename/unlink races); exact-tag CI green on both Linux and Windows, runs 29811023459/29811023424 - the original 'release NOT tagged' clause is factually outdated",
  "scope": "workflow-state",
  "sweep": {
    "scanned_at": "2026-07-21T12:48:43.028Z",
    "hit_count": 2,
    "files": [
      {
        "file": "docs/decisions/index.md",
        "line": 150,
        "excerpt": "- e230444a · 2026-07-21 · auto-approved slices 3-4 shape+execution (bypass total): dp-8 prose rules (CoS-checked flip + citation discipline), dp-9 e2e supers..."
      },
      {
        "file": "docs/decisions/index.md",
        "line": 699,
        "excerpt": "- d20f4c96 · 2026-07-21 · hardening-1-7-10 complete: 11 cells capped (1710-1..11), each red-first, orchestrator-re-verified, and opus-judged PASS where behav..."
      }
    ]
  },
  "tags": ["release", "ci"]
}
```

Tag/scope inheritance (D6) did not trigger — `--tags release,ci` was passed explicitly; `scope` inherited from the target (`workflow-state`, absent from the flags).

A broader grep confirms the sweep's `docs/**` root is exhaustive here — no other artifact in `docs/` cites the target, by short8 or full id:

```
$ grep -rn "d20f4c96" docs/            # short8, pre-reconcile
docs/decisions/index.md:150: ...dp-9 e2e supersede dry-run on d20f4c96 + issue-closure drafts
docs/decisions/index.md:699: - d20f4c96 · 2026-07-21 · hardening-1-7-10 complete: ...release NOT tagged (user decision)

$ grep -rln "d20f4c96-97b8-493b-b034-ae3471d778ec" docs/   # full id
(no output — zero hits)
```

## Per-hit reconciliation

Both hits landed in `docs/decisions/index.md`, which is a **derived, rendered document (D4b)** — never hand-edited. That splits the two hits into two different outcomes:

| # | Line | What it is | Outcome |
|---|------|------------|---------|
| 1 | 699 | The superseded decision's own entry in the index, rendered from `d20f4c96`'s `decide` event | **Reconciled by re-render.** `decisions render` regenerates the index from the store; `activeDecisions` already excludes a superseded id, so the entry drops out mechanically — no hand-edit needed or possible. |
| 2 | 150 | A *different* decide event, `e230444a` ("auto-approved slices 3-4 shape+execution..."), whose own text mentions `d20f4c96` as the id of the target this very cell (dp-9) was scoped to operate on | **Waived.** This is a citation inside an immutable append-only log entry (`.bee/decisions.jsonl` is never hand-edited — AGENTS.md critical rule 7 / decision-propagation D5). `e230444a`'s text does not assert the outdated "release NOT tagged" claim — it names `d20f4c96` only as the id of the task's target, which remains historically accurate (dp-9 *did* target `d20f4c96`). Re-rendering the index cannot change this line because the index reproduces the event's stored text verbatim. There is nothing to fix and nothing that should be fixed. |

## Index re-render

```
$ node .bee/bin/bee.mjs decisions render
Wrote docs/decisions/index.md (414 decision(s)).

$ node .bee/bin/bee.mjs decisions render --check
docs/decisions/index.md is up to date.
```

### Before / after (grep both short8s)

Before (pre-supersede):
```
150:- e230444a · 2026-07-21 · auto-approved slices 3-4 shape+execution (bypass total): dp-8 prose rules (CoS-checked flip + citation discipline), dp-9 e2e supersede dry-run on d20f4c96 + issue-closure drafts
699:- d20f4c96 · 2026-07-21 · hardening-1-7-10 complete: 11 cells capped (1710-1..11), each red-first, orchestrator-re-verified, and opus-judged PASS where behavior-changing; full verify 54/54 green normal AND hermetic; claim_race 10/10; release NOT tagged (user decision)
```

After (post-supersede, post-render):
```
150:- e230444a · 2026-07-21 · auto-approved slices 3-4 shape+execution (bypass total): dp-8 prose rules (CoS-checked flip + citation discipline), dp-9 e2e supersede dry-run on d20f4c96 + issue-closure drafts
746:- 257ab1e5 · 2026-07-21 · hardening-1-7-10 complete AND released as v1.7.10-rc on 4f23f89 (rc-1..5: CPU-count-proof race suites, timeout-capture split, Windows transient-fs retry); exact-tag CI green both platforms
```

`d20f4c96` as its own index row (line 699) is gone. `257ab1e5` — the successor — appears grouped under `workflow-state` (its inherited scope), tagged `release`/`ci`. Line 150's benign citation is unchanged (waived per above), confirming the sweep target was found and left alone deliberately, not missed.

Independently confirmed via the store directly (not just the index):

```
$ node .bee/bin/bee.mjs decisions active --json   # filtered in Python
old decide event still active as own entry: False
successor present: True
```

## Capture stub lifecycle

Sweep created exactly one stub per hit (2 hits → 2 stubs), source `supersede-sweep`:

| Stub id | Hit (file:line) | Outcome |
|---|---|---|
| `d4faffe3-1be7-4e68-ad2e-b06d6bd21ceb` | `docs/decisions/index.md:699` | **Flushed** — `capture flush --id d4faffe3-1be7-4e68-ad2e-b06d6bd21ceb --into "docs/decisions/index.md (re-rendered; superseded entry d20f4c96 dropped, successor 257ab1e5 appears)"` |
| `09bf2874-b86c-435b-bbfe-5fa3c29a4704` | `docs/decisions/index.md:150` | **Left pending, waived** — reason recorded in the reconciliation table above (benign historical citation inside an immutable log entry; nothing to reconcile) |

`capture list --json` after flush shows 2 pending stubs: `09bf2874-...` (this run's waiver, intentionally left) and `e22a982d-...` (pre-existing, unrelated — a D7/D8 slice-2 spec-sync stub logged 2026-07-21T08:08:32Z, out of scope for dp-9).

## Tag search proof

```
$ node .bee/bin/bee.mjs decisions search --tag release --json | grep -B2 -A6 "257ab1e5"
  "decisions": [
    {
      "id": "257ab1e5-e6ec-46fd-9ba1-ac52bc08601c",
      "type": "supersede",
      "date": "2026-07-21T12:48:43.029Z",
      "supersedes": "d20f4c96-97b8-493b-b034-ae3471d778ec",
      "decision": "hardening-1-7-10 complete AND released as v1.7.10-rc on 4f23f89 (rc-1..5: CPU-count-proof race suites, timeout-capture split, Windows transient-fs retry); exact-tag CI green both platforms",
      "rationale": "v1.7.10-rc tagged at exact commit 4f23f89 after rc-1..5 hardening ...",
      "scope": "workflow-state",
```

`--tag release` recall (D8b's ranked multi-term search) surfaces the new event directly — end-to-end proof that a real supersede propagates through: append → sweep → reconcile/waive → stub lifecycle → index re-render → tag-filtered recall.

## Verify

```
$ node .bee/bin/bee.mjs decisions render --check
docs/decisions/index.md is up to date.

$ node scripts/run_verify.mjs
```
(tail captured separately below in the worker's final report — full run green.)
