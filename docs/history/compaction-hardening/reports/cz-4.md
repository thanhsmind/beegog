# cz-4 — [DONE]

Two dispatcher verbs — `bee state compact-log` and `bee state compact-check` —
now wrap cz-3's `lib/compaction.mjs` (`appendCompactionRecord` /
`compactCheck`) so both surfaces are reachable by command, not just from a
hook (D3's helper floor). `state compact-capsule` is deliberately NOT
registered here — its builder ships in cz-5.

**Files touched**

- `skills/bee-hive/templates/lib/command-registry.mjs` (two new entries)
- `skills/bee-hive/templates/bee.mjs` (two handlers, two dispatch-map lines,
  the `state` group's Use-list at :4830)
- `skills/bee-hive/templates/tests/test_bee_cli.mjs` (3 new checks: example
  execution, mismatch-still-exits-0, bad-event usage refusal)
- `.bee/bin/lib/command-registry.mjs`, `.bee/bin/bee.mjs` (byte-identical
  mirrors — D17)
- `scripts/test_compact_verbs.mjs` (new, 7 black-box scenarios over the real
  `.bee/bin/bee.mjs` binary)
- `docs/history/codex-harness-hardening/release-manifest.json`,
  `.bee/onboarding.json`
- rendered projections in `.agents/`, `.claude/`, `.claude-plugin/`,
  `.codex-plugin/` (D24 chain: render → onboard --apply → manifest --write,
  in that order)

**Verify:** `node scripts/test_compact_verbs.mjs && node scripts/test_conformance.mjs
&& node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/release_manifest.mjs --check
&& node scripts/ledger_parity.mjs --check` — green (exit 0; 248 passed in test_bee_cli.mjs).

Full trace, `verification_evidence` and the red-failure record:
[`.bee/cells/cz-4.json`](../../../../.bee/cells/cz-4.json).

**Note for downstream cells:** `compact-check`'s JSON `checks[]` carries an
`anchor_missing` entry distinct from `compactCheck`'s own presence-only
`anchor` check — it mirrors `anchorMissing()`'s phase/gate-scoped predicate
and always names `ANCHOR_NUDGE_COMMAND` verbatim, so cz-7's hook wiring and
this verb stay provably in sync. `.bee/bin/bee.mjs`'s file mode dropped from
755 to 644 as a side effect of `onboard --apply`'s copy step (the source
template is 644) — functionally inert since every caller invokes it via
`node`, never directly, but worth a backlog note if a future cell wants the
mirror's mode preserved.
