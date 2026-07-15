# CONTEXT — codex-harness-hardening Slice 1d (SRC source-tree classifier)

**Boundary:** formalize SRC-01..06 into ONE pure, shared, tested classifier that names the running
launcher's source identity, consumed by both onboarding and `bee status` (DIST-04 identity half). Much
of the logic already exists implicitly in `onboard_bee.mjs`; 1d makes it explicit and surfaces it.
WRAP, not replace — the just-validated onboarding control flow stays. Last locked piece of the
codex-harness-hardening design (backlog P37).

## Domain types
- **CALL** — `bee status` gains a report-only `source` field; a shared classifier module (a library API).
- **ORGANIZE** — the running launcher's filesystem location + manifest determine its identity.

## Locked decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | SRC-01..06 ships as a PURE shared `classifySource()` in `templates/lib` (+mirror), consumed by BOTH onboarding and `bee status` (DIST-04). WRAP not replace — onboarding's `identityOk`/`selfOnboard` flow stays; the classifier formalizes/names what it already computes; status gains a report-only `source` field. | Most of SRC-01..06 already lives implicitly in onboard (realpath anchor, self-onboard, unknown-fail-closed via 1b). 1d = formalize + share + surface, a refactor + additive field, not new control flow. Wrap keeps validated behavior intact. |
| D2 | The 5 kinds by launcher location + manifest: **source_checkout** = canonical dev checkout (plugin.json marker + running from its real `skills/bee-hive`, `identityOk`); **project_projection** = under a host's `.agents/skills` or `.claude/skills`; **plugin_package** = an installed manifested package, neither dev checkout nor projection (may source the same repo's runtime+projection but NEVER global/plugin targets — SRC-03); **legacy_global** = the legacy global skills root; **unknown** = missing/unparseable manifest or ambiguous → fail closed before mutation (SRC-04). | Derived from onboard's `HIVE_DIR`/`PLUGIN_ROOT` structure + SRC-02/03/06. Path-shape + plugin.json presence distinguish them. Exact detection nailed in planning/validating. |
| D3 | `bee status` gains a report-only `source` field naming the classified kind (+ its root). Additive; does not reshape existing fields. unknown/legacy_global shown truthfully, never silently act as source (SRC-06). | DIST-04 mandates status use the same detector; showing the kind gives direct diagnostic value for the split-brain class. Report-only (consistent with 1c drift). |
| D4 | The classifier is PURE (inputs: the launcher dir, candidate repo root, filesystem probes it is handed) and returns `{ kind, root, markers }` — no mutation, no I/O side effects beyond read probes. Onboarding maps its result back onto the existing authoritative-source refusal (`identityOk` false ⇒ not a usable source). | A pure classifier is testable in isolation across all 5 kinds (incl. negative/unknown) without spawning onboard; matches SRC-01 "don't guess from nearest path". |

## Pinned terms
- **source identity** — which of the five kinds the *running launcher* is: the canonical dev checkout,
  a host's vendored projection, an installed plugin package, the legacy global root, or unknown.
- **authoritative source** — a source identity permitted to vendor the runtime; `unknown` and
  `legacy_global` are never implicitly authoritative (SRC-04/06).

## Scout paths
- `onboard_bee.mjs` — `HIVE_DIR`/`sourceRoot`/`PLUGIN_ROOT` (:48-53), `identityOk` realpath anchor
  (:877-884), `selfOnboard` (:~900), `computeSkillSyncTarget` kinds. The implicit classification to formalize.
- `skills/bee-hive/templates/lib/` (+ `.bee/bin/lib/`) — the shared-module home (mirror-guarded).
- `bee.mjs` `buildStatus` (:223) — where the `source` field is added, using the shared classifier.
- SPEC §6.2 SRC-01..06, DIST-04.

## Open questions for planning
- Exact marker detection per kind (esp. source_checkout vs plugin_package — both carry plugin.json):
  what distinguishes the dev checkout from an installed package? (git presence? running from `skills/`
  vs a package layout? the identity anchor?)
- Module name/home (`templates/lib/source-identity.mjs`?) and its exact return shape.
- How much of onboarding's existing flow is re-expressed through the classifier vs left as-is (wrap
  boundary) — validating confirms nothing observable changes for onboarding.
- Test matrix: all 5 kinds classified correctly on real/fixture trees; unknown fails closed; the
  status `source` field renders each kind; classifier is pure (no mutation).

## Deferred ideas
- `--force-downgrade` blast-radius transparency (review P2) stays backlogged — unrelated to the classifier.
