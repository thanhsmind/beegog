# 2026-07-21 — The memory layer proved itself by catching its own seed bug (decision-propagation)

**Feature:** decision-propagation (GH #32/#33/#34) · **Tags:** [decisions, taxonomy, recall, dogfood, classification]

1. **Dogfood-first found the defect no test did.** dp-7 seeded `docs/decisions/taxonomy.json` with
   plain-string tags; the dp-6 contract is `{name, description}` objects (`loadTaxonomy` maps
   `t.name`). Every known tag silently classified as unknown and the whole vocabulary leaked into
   `candidates[]` — discovered not by the 84-check suite but by logging a real decision two
   minutes after bootstrap and watching `candidates[]` grow. Rules that stuck: (a) a data file
   seeded by hand gets a steady-state schema guard in the suite the same day (the guard now pins
   object entries and forbids known tags in candidates); (b) the first real write after any
   bootstrap is part of the bootstrap's acceptance, not an afterthought.
2. **Extraction-tier batch classification works, with two known frictions.** 11 haiku batches
   classified 406 events cheaply and correctly against a 40-tag taxonomy; but (a) one batch
   over-applied a generic filler tag ("decisions") as topical noise — a taxonomy should name
   which tags are reserved for the store's own mechanics vs free topical use; (b) 4 of 406
   events were silently skipped across batches — always diff returned targets against the input
   set and classify the remainder yourself.
3. **A supersede now cleans up after itself — proven live, not claimed.** The e2e run
   (`d20f4c96` → `257ab1e5`) exercised sweep → reconcile → waive-with-reason → stub lifecycle →
   index self-correction on a genuinely outdated decision. The waiver case mattered: a citation
   inside another event's own immutable text is NOT a stale embodiment — reconciliation
   distinguishes "asserts the dead claim" from "mentions the id", and history files get appended
   correction notes, never rewrites.
