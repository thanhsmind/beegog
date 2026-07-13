---
date: 2026-07-13
feature: tier-transport-doctrine
categories: [process, doctrine]
severity: P3
tags: [doctrine-placement, delegation, model-guard, agents-block]
---

# Tier transport rides with the order (critical rule 13)

## What Happened

v0.1.30 promoted the fan-out delegation rule into the always-loaded doctrine
layer, but dispatches issued from plain conversation turns still bounced off
the model-tier guard: the rule ordered delegation without carrying the
transport the guard requires (an explicit `model` param or an anchored
`[bee-tier:]` marker). That requirement lived only in the swarming reference,
which is not loaded when no stage is running — so the agent learned the
requirement from the rejection, one wasted attempt per session. v0.1.32 added
the transport requirement to critical rule 13 itself; a census test now
anchors it on both doctrine surfaces (AGENTS.block.md template + root
AGENTS.md).

## Root Cause

The placement failure (B2 of `docs/specs/doctrine-layer.md`) at half-scale:
the *order* travelled to the always-loaded layer, but the *required form* of
obeying it did not. A rule that commands an action guarded for shape is
incomplete without the shape.

## Recommendation

When promoting any rule to the standing sheet, carry with it the minimum
mechanics compliance requires — mandatory parameters, markers, naming
conventions that a guard enforces. Only rationale, tiers, and elaboration may
stay in a stage reference. Litmus: could a fresh session obey the rule
correctly on the first attempt with no reference loaded?

Promotion status: already promoted in-flight — critical rule 13 (census-test
anchored), spec B3a in `docs/specs/doctrine-layer.md`, decisions 0023 +
6cd34376. New critical promotions this run: 0.
