---
date: 2026-07-12
feature: skill-metadata-parity
categories: [pattern, failure]
severity: standard
tags: [skills, metadata, projection, tdd, codex, claude]
---

# Learning: Generate Runtime Metadata From One Canonical Skill Contract

**Category:** pattern  
**Severity:** standard  
**Tags:** [skills, metadata, projection, codex, claude]  
**Applicable-when:** one skill identity or trigger description must appear in multiple runtime-specific manifests.

## What Happened

The bee skill tree kept `SKILL.md` frontmatter as the canonical identity and generated 15 minimal `agents/openai.yaml` projections through `render_openai_metadata.mjs`. The renderer's check mode and the canonical library suite now fail on missing, stale, malformed, or orphan projections, while the existing plugin bundle and onboarding deep mirror distribute the nested files without another installer.

## Root Cause

Runtime-specific manifests are useful presentation and policy surfaces, but independently maintained prose becomes a second source of truth. A deterministic projection preserves one authoring contract while still satisfying each runtime's packaging shape.

## Recommendation

When the same semantic metadata crosses runtime manifests, keep one canonical source, generate the smallest target-specific projection, byte-check it in the canonical suite, and reuse an existing recursive distribution path only after proving its nested-file behavior.

# Learning: A RED Check Must Fail for the Named Reason and Run in the Normal Suite

**Category:** pattern  
**Severity:** standard  
**Tags:** [tdd, verification, diagnostics]  
**Applicable-when:** adding enforcement to a repository that is intentionally noncompliant before the feature lands.

## What Happened

Cell `smp-1` committed the RED contract separately and accepted only one exact output: `MISSING skills/bee-briefing/agents/openai.yaml`. Validation rejected an earlier generic `! node ...` verify because syntax errors or unrelated crashes would also have passed, and it required the standalone test to be wired into `test_lib.mjs` before production code existed.

## Root Cause

A nonzero exit proves only that something failed; a standalone test proves nothing about normal verification unless the canonical entry point owns it. Exact diagnostic equality plus suite wiring made both the failure cause and future execution path observable.

## Recommendation

When locking a RED contract, assert the complete stable diagnostic and nonzero status, wire the test into the normal suite in the RED commit, then keep production changes in a later GREEN commit.

# Learning: Generated-Artifact Tests Need Lifecycle and Runtime Proof at Different Layers

**Category:** failure  
**Severity:** standard  
**Tags:** [codegen, lifecycle, runtime-validation, residual-risk]  
**Applicable-when:** a checked-in generated artifact is consumed by another runtime or UI.

## What Happened

The fixture suite covered folded descriptions, exact YAML bytes, missing and duplicate keys, unsupported scalar styles, add/remove/rename, stale recovery, and an orphan directory. Compounding still found two unproved classes: top-level `bee-*` file/symlink census plus explicit render-twice byte equality, and live Codex/ChatGPT loader acceptance of the generated UI metadata. Official OpenAI skill documentation specifies the metadata fields but did not establish the suspected 25–64 character limit, so description length was retained as an unverified UX concern rather than mislabeled as a defect.

## Root Cause

Repository fixtures prove the generator's local contract; they do not automatically prove every filesystem entry class or the consuming product's current schema and presentation behavior. Self-authored expected bytes cannot substitute for a live consumer check when field semantics are version-sensitive.

## Recommendation

For checked-in projections, test creation, stale edits, removal, rename, orphan/symlink/file entries, and render-twice byte equality locally; separately validate at least one representative artifact through the real consuming loader or record that absence as residual risk.

