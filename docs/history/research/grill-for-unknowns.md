---
artifact_contract: bee-research/v1
topic: grill-for-unknowns
depth: standard
date: 2026-07-11
---

## Bottom Line

- Recommendation (ladder rung): **reuse** — do not install or vendor the upstream skill; bee already implements ~90% of it natively via decision 0020 and the exploring/xia/briefing/executing chain.
- Why this is the lightest credible path: `grill-for-unknowns` and bee's unknowns toolkit are the *same idea family* (map-vs-territory, unknowns interrogation, react-instead-of-describe, post-ship quiz). bee absorbed it on 2026-07-10 as decision 0020 (P9 blindspot pass, P10 Gate-4 quiz, P11 SEE mock), and the rest of its operating sequence maps 1:1 onto existing bee skills. Installing it would create a parallel, gate-less duplicate of bee-exploring + bee-xia.
- Why the next-best rung lost: **adapt-upstream** loses because the only genuine deltas are two prose-level lines (see Inference), not a structure worth importing; a separate skill hits the skill-cap pattern that 0020 itself already rejected ("A separate bee-teaching skill. Rejected").
- Confidence: 85%.
- Suggested next step: **none** required. Optionally file two `proposed` backlog rows for the deltas below (tiny, prose-only edits) — user's call.

## Repo Snapshot

- Repo type / primary languages / runtimes: this repo is bee itself — a Claude Code skill harness (Node.js `.mjs` scripts + markdown skills), no framework. `Local`
- Frameworks and detectable versions: bee 0.1.20 (`.bee/onboarding.json` via session hook). `Local`
- Relevant packages, services, tools: 15 `skills/bee-*` skills; gates 1–4; decisions log `docs/decisions/`. `Local`
- Constraints or workflows that shape the answer: skill-cap discipline (new skills rejected when a branch inside an existing skill suffices — pattern cited in decisions 0002/0020); "lanes scale ceremony" — techniques engage only when their trigger appears. `Local`

## Question & Assumptions

- What was asked: research https://github.com/nicobailon/grill-for-unknowns (no feature underway → standalone brief).
- What success appears to mean: know what this skill is, whether bee should adopt it, and what — if anything — it has that bee lacks.
- Assumptions still needing confirmation: none material; the overlap mapping below is checkable line-by-line.

## Findings

### Local

- **Decision 0020 (unknowns toolkit, 2026-07-10) is the direct local counterpart** — sourced from "Thariq's map-vs-territory article", it shipped three techniques in 0.1.17: P9 blindspot pass (teach-before-ask in bee-exploring), P10 Gate-4 quiz (bee-briefing walkthrough), P11 SEE mock (throwaway HTML variants under `.spikes/`). `Local` — `docs/decisions/0020-unknowns-toolkit.md`
- Coverage map of the upstream skill's operating sequence onto bee (all `Local`, from the SKILL.md files):
  | grill-for-unknowns element | bee equivalent | Status |
  |---|---|---|
  | Restate the map / inspect docs+source first | bee-xia stack ledger + local-first order; bee-exploring quick scout | covered |
  | Session ledger + persist shared understanding | `CONTEXT.md` with stable D-IDs + `.bee/state.json` | covered |
  | Known unknowns → material questions, one at a time | bee-exploring Socratic locking (one question/message, outcome-framed) | covered |
  | Unknown unknowns → blindspot pass | bee-exploring P9 (verbatim same name) | covered |
  | Unknown knowns → cheap prototypes for reaction | bee-exploring P11 SEE mock (2–4 variants, fake data) | covered |
  | ADRs only for hard-to-reverse decisions | `docs/decisions/` D-ID log — arguably stronger (gated, indexed) | covered |
  | Deviation policy during implementation | bee-executing deviation rules (auto-fix/auto-add/`[BLOCKED]`, recorded on cap) | covered |
  | Subagent launch packet | bee-swarming cell briefs + explicit-tier dispatch (decision 0023) | covered |
  | Post-implementation explainer + optional quiz | bee-briefing walkthrough + P10 Gate-4 quiz (quiz is opt-in in both) | covered |
  | Named four-quadrant unknowns taxonomy | practiced implicitly (gray areas / blindspot / SEE mock) but never named as a classification step | **gap (cosmetic)** |
  | Material-question test: material + grounded + answerable | exploring has "outcome-framed, product-decisions-only, cite scout findings" — 2 of 3 explicit; "answerable" is implicit | **gap (partial)** |
  | Domain ledger / glossary for fuzzy terms in CONTEXT.md | absent — checked `context-template.md`, bee-scribing, bee-exploring: no glossary section | **gap (real, small)** |
- No prior mention of `grill-for-unknowns` or `nicobailon` anywhere in the repo; `docs/history/research/` created by this brief. `Local`

### Upstream

- `nicobailon/grill-for-unknowns` (GitHub, MIT, 144★, 7 commits): a self-contained Claude Code / Codex / Hermes skill at `plugins/grill-for-unknowns/` — SKILL.md + references (lineage, domain modeling) + templates (ADR, CONTEXT, session ledger, launch packet). `Upstream`
- Core: map (plan/assumptions) vs territory (code/APIs/constraints) with unknowns as the gap; four-quadrant taxonomy; docs-grounded interrogation before asking the user; one material question at a time; low-risk unknowns converted to labeled assumptions. `Upstream`
- Lineage: an expansion of Matt Pocock's `grill-with-docs` (adds unknown-unknowns coverage, materiality criteria, durable artifacts, implementation-phase guidance). `Upstream` — repo README
- Fit with bee: same species (markdown skill) but *ungated and single-skill* — it compresses what bee spreads across exploring → planning → validating → executing → briefing, with no human gates. As a drop-in it would compete with, not extend, the pipeline. `Inference` from the two SKILL.md texts.

### Docs

- The "official docs" for a skill are its README + SKILL.md — both read, latest main (no releases/versioning to match). `Docs`
- No version caveats apply; nothing in it depends on runtime APIs.

### Inference

- bee's 0020 (via Thariq) and this skill (via Matt Pocock) are independent packagings of the same late-2025/2026 "grilling / map-vs-territory" discourse — convergent evolution, which is itself mild validation that 0020 pointed the right direction.
- The two deltas worth possibly folding in (both prose-only, tiny, inside existing skills — no new skill):
  1. **Materiality test for questions** — add the explicit three-part filter (material: answer changes scope/architecture/UX/acceptance; grounded: cites scout evidence; answerable: user can actually choose) to bee-exploring's Socratic-locking step. Mostly a sharpening of rules already half-present.
  2. **Glossary line in CONTEXT.md** — a "Terms" row/section in `context-template.md` where fuzzy domain words get pinned when they crystallize during locking; scribing then inherits pinned terms.
- The named four-quadrant taxonomy is not worth importing as ceremony — bee already routes each quadrant to a concrete mechanism, which is stronger than naming them.

## Risks, Unknowns, Follow-Ups

- Risk of doing nothing: none identified — the gaps are quality-of-questions refinements, not missing capability.
- Risk of adopting wholesale: pipeline duplication and gate bypass (an ungated grill session producing its own plan would sidestep Gates 1–3). Do not install.
- Open questions: does the owner want the two deltas filed as backlog `proposed` rows? (User decision; not blocking.)

## Source Pack

- Local files read: `docs/decisions/0020-unknowns-toolkit.md`, `skills/bee-exploring/SKILL.md`, `skills/bee-executing/SKILL.md` (grep), `skills/bee-exploring/references/context-template.md` (grep), `skills/bee-scribing/SKILL.md` (grep), repo tree.
- Upstream repos/pages checked: https://github.com/nicobailon/grill-for-unknowns (README/landing), `plugins/grill-for-unknowns/SKILL.md` (raw, main).
- Docs pages checked: same as upstream (README is the doc surface; no versioned docs exist).
