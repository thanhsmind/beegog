# cli-ergonomics — CONTEXT

Origin: performance audit of the work-visibility session (2026-07-24). Headline
finding: CLI wall time is negligible (32 invocations = 740ms) — the real losses
were retry roundtrips (~18 of ~45 orchestrator calls) and worker minutes. Backlog
rows: the P2 drip-feed-flag-errors friction and the P3 cells-add-no-dry-run
friction. This feature implements every improvement from that audit.

## Locked decisions

**D1 — Batch flag validation, manifest-driven.** One generic pre-handler
validator, driven by the same manifest that serves `--help --json`, checks ALL
required/enum flags before the handler runs. On failure it reports EVERY
missing and invalid flag in one message, plus the command's ready-to-run
example from the manifest — the regen-obligation error style (name everything
+ FIX line) becomes the norm, not the exception. Per-handler checks stay as
backstops. Tests asserting the old one-flag-at-a-time strings are updated in
the same cell; the new message keeps a stable greppable prefix per flag so
future assertions can be substring-loose.

**D2 — `cells add` validates the whole array; `--dry-run` added.** Validation
(schema + regen obligations) runs over EVERY cell in the payload before
anything persists, and the refusal names every failing cell's every problem in
one message (write stays atomic: nothing lands on any failure — unchanged).
`--dry-run` runs exactly that validation pass, reports per-cell verdicts,
persists nothing, exits 0 when clean — so a big payload is never re-sent to
discover the next error.

**D3 — Three doctrine clauses (teaching layer).**
(a) *Scoped red-first:* during the red phase a worker runs ONLY the newly
added tests; the full cell verify chain runs once, at the end. Full-suite
red runs are the named waste (work-visibility wv-1 ran 271 tests per loop).
(b) *Small-lane parallel criterion:* serial stays the default. Cells may run
in parallel only when their file sets INCLUDING regen targets (release
manifest, onboarding ledger, plugin mirrors) are provably disjoint; any shared
generated artifact forces serial; in doubt, serial. This makes the existing
hardening-7 law's reason mechanical instead of implicit.
(c) *Schema-first habit:* before first use of a bee command group in a
session, load `bee <group> --help --json` — one roundtrip instead of an error
ladder.

## Out of scope

- `timings report` verb (already PBI p-10caed3f, separate).
- Write-guard allowlist for the harness memory root (separate filed friction).
- Backlog retract verb (separate filed friction).
- Any change to the atomicity of `cells add` (already all-or-nothing).
