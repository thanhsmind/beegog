# backlog-unification — plan (frozen at Gate 2)

Mode: standard. Four cells, serial (bu-1 → bu-2 → {bu-3, bu-4}); shared-file axes
sequenced at dispatch. Every cell verify is scoped; the full suite is CI-owned.

- **bu-1 — store + CLI core.** `.bee/bin/lib/backlog.mjs` (+ template twin): item-store
  reader (frontmatter parse of `docs/backlog/items/P<n>.md`), status enum
  `proposed|in-flight|parked|done|declined`; verbs `pbi add` (mechanical next-free-ID),
  `pbi status --id --to`, `pbi list [--status] [--json]`, `render --write|--check`
  (generated `docs/backlog.md`, KNOWLEDGE_INDEX_HEADER idiom, done/declined as one-line
  links); `counts`/`rank`/`badges`/`featureBacklogRank` re-derived from items (fallback
  to legacy table parse when `docs/backlog/items/` absent — host repos migrate later);
  command-registry entries; tests in templates/tests/test_backlog_capture.mjs extended.
  Verify: that suite + lib_mirror + manifest/ledger/registry checks.
- **bu-2 — migration + uniqueness retarget.** `scripts/migrate_backlog_items.mjs`
  splits all 73 rows (IDs kept, statuses normalized incl. P74 `declined`), renders the
  index; run it here (one commit). `scripts/backlog_uniqueness.mjs` retargets:
  id↔filename parity + frontmatter enum + `render --check` freshness; still a mandatory
  suite. Registry --write (new files). Deps: bu-1.
- **bu-3 — guard.** `docs/backlog.md` + `docs/backlog/items/**` become CLI-owned in
  guards.mjs (+ hook twins): direct edits denied naming the verb, `render`/`pbi` CLI
  writes pass. Guard tests extended. Deps: bu-2 (guard lands after migration so it
  cannot block it). Manifest/ledger/mirror obligations.
- **bu-4 — instruction layer.** bee-scribing (D8 append + close-flip), bee-qualifying
  (D13 park), bee-exploring (D11a flip), bee-grooming (drift audit), bee-herding
  (Status interlock → `pbi list --json` / generated index), scribing-reference "two
  backlogs" section, AGENTS.block.md working-files lines — all reworded to the verbs;
  grep-proof: zero surfaces teach hand-editing the table. Knowledge concept updated
  (decision-memory or doctrine-layer area) + knowledge index. Mirrors + manifest regen.
  Deps: bu-2.

Validation (before Gate 3 / swarming, next session): one review-tier plan-check over
CONTEXT.md + this plan + the four cells — same shape as ci-owned-verify's, P1s folded
before dispatch.
