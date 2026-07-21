# Backlog sweep — clearing the accumulated scratch (th-7, CONTEXT D6)

Date: 2026-07-21 · Verb: `bee tmp sweep` (shipped in th-4, safety-reworked after an independent judge found a data-loss escape)

## What was run

1. **Reviewed plan first.** `bee tmp sweep --all --dry-run --json` → 21 entries, 171.5 MB, 9,165 files. Review caught that `--all` also targeted the **live** feature's own scratch (`.bee/tmp/tree-hygiene`, 3 files — including the plan file and the judge verdicts of this very feature). The cell's must-have forbids silently destroying a live feature's scratch, so `--all` was **not** used.
2. **Ran the default target set instead**, age-gated: `bee tmp sweep --before <now> --json`. The default set sweeps closed/absent-feature scratch and protects live features by construction.

## Result

| | before | after |
|---|---|---|
| `.bee/spikes` | 153 MB | 124 KB |
| `.bee/tmp` | 24 KB | 28 KB (this feature's own, preserved) |
| removed | — | **20 entries · 171.5 MB · 9,162 files** |

Dominant single item: a 146 MB nested clean-clone of the repo left behind by an earlier release-verification run.

Safety observations from the run itself:
- `refused_roots: []`, `refused_escapes: []` — nothing tried to leave the two allowed roots.
- `skipped: [tree-hygiene (reason: live)]` — the running feature's scratch was preserved, as required.
- Every removed entry's `scratchRoot` was `.bee/tmp` or `.bee/spikes`; zero entries outside them.

## Verification after the sweep

- `git status --porcelain` byte-identical before and after (captured to files and diffed) — the scratch was already ignored, so removing it changed no tracked state. This is the honest proof that nothing tracked was touched.
- Deliverables spot-checked present: `docs/specs/decision-memory.md`, `.bee/cells/th-7.json`, `.bee/decisions.jsonl`.

## Why this needed a cell of its own

The rule (D1-D4) only governs files written from now on. The 153 MB already on disk was the user's actual reported symptom; leaving it would have shipped a fix that changed nothing they could see.
