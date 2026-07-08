# Approach — harness09

Chosen path: five slices in dependency order, slice 1 first (it is the mechanism the
others reference), then four independent tiny/small slices. All changes are additive:
a new optional config key, new preamble lines, new reference paragraphs, one contract
section. Nothing existing is removed or re-shaped.

## Why this shape

- Slice 1 (commands + baseline gate) is the only slice touching executable surface
  (`inject.mjs`, `bee_status`, onboarding, AGENTS template) — it carries the test work
  and the managed-file version bumps. Doing it first means slices 2–5 can cite a real
  mechanism instead of a promised one.
- Slices 2–4 are reference-doc paragraphs in owning skills (compounding, grooming) —
  tiny lane, no runtime surface.
- Slice 5 (ERROR/WHY/FIX) is contract text plus a string audit with test assertions —
  small lane because it touches `bin/lib` test files.

## Risks

| Risk | Mitigation |
|---|---|
| Preamble bloat from injected commands | 4 short lines max, only when `commands` present; inject dedup already caps repetition |
| Managed-file bump breaks re-onboarding | `test_onboard_bee.mjs` idempotency suite runs before cap; bee's own repo re-onboarded as the smoke test |
| Baseline gate nags repos with no verify command | Gate is conditional on `commands.verify` being set; absent → status warning only, never a block |
| Skill edits drift from bee-writing-skills law | CREATION-LOG note per touched skill; doc-09 evidence recorded as baseline rationale |

## Proof needs (for validating)

- `inject.mjs`/`bee_status` changes covered by new assertions in `templates/tests/test_lib.mjs`.
- Onboarding idempotency suite green after version bumps.
- One manual smoke: re-onboard bee's own repo, confirm preamble shows commands and
  status warns before they are set.
