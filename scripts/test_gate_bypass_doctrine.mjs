#!/usr/bin/env node
// Machine-check: every gate-presenting skill's OPERATIVE gate step must apply the
// LEVEL-AWARE gate-bypass rule (routing-and-contracts.md §Gate bypass), and no
// live gate surface may carry the stale `normal`-only phrasing that contradicts
// the `full`/`total` levels.
//
// Why this exists (crit-pattern 20260714 — "the invariant you leave in prose WILL
// be bypassed; mechanize it"): the level-aware rule was correct in the canonical
// contract, but bee-exploring (Gate 1) and bee-planning (Gate 2) never applied it
// and bee-validating (Gate 3) + go-mode carried stale "high-risk => bypass does
// not apply" text. A Codex runtime following the step literally therefore stopped
// at Gate 1/2 even under `total` autopilot. This test fails closed if a gate skill
// drops the carve-out or re-introduces the stale unconditional floor.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const REPO_ROOT = path.join(path.dirname(scriptPath), '..');

// Each gate-presenting surface + the tokens proving it honors the level-aware
// rule. The OPERATIVE gate steps (exploring/planning/validating) must read the
// active level (`gate_bypass_level`) AND state the full/total floor-lift; go-mode
// is a REFERENCE that points to the contract, so it only owes the floor-lift
// statement, not the level-read call.
const GATE_SKILLS = [
  { file: 'skills/bee-exploring/SKILL.md', gate: 'Gate 1', tokens: ['gate_bypass_level', 'full'] },
  { file: 'skills/bee-planning/SKILL.md', gate: 'Gate 2', tokens: ['gate_bypass_level', 'full'] },
  { file: 'skills/bee-validating/SKILL.md', gate: 'Gate 3', tokens: ['gate_bypass_level', 'full'] },
  { file: 'skills/bee-hive/references/go-mode.md', gate: 'go mode', tokens: ['full'] },
];

// Phrases that assert an UNCONDITIONAL high-risk stop — true only under `normal`,
// false under `full`/`total`. Banned on every live gate surface.
const BANNED_PHRASES = [
  'safety floor is absolute',
  'bypass does not apply', // the stale normal-only exclusion
];

let failed = 0;
const fail = (msg) => {
  failed += 1;
  console.log(`FAIL  ${msg}`);
};
const ok = (msg) => console.log(`ok    ${msg}`);

for (const { file, gate, tokens } of GATE_SKILLS) {
  const abs = path.join(REPO_ROOT, file);
  let text;
  try {
    text = fs.readFileSync(abs, 'utf8');
  } catch {
    fail(`${file} (${gate}): unreadable — a gate-presenting surface must exist`);
    continue;
  }
  let fileFailed = false;
  for (const token of tokens) {
    if (!text.includes(token)) {
      fail(`${file} (${gate}): missing required level-aware token "${token}" — the gate step must honor the full/total floor-lift`);
      fileFailed = true;
    }
  }
  for (const banned of BANNED_PHRASES) {
    if (text.includes(banned)) {
      fail(`${file} (${gate}): carries stale phrase "${banned}" — contradicts full/total (which lift the high-risk floor)`);
      fileFailed = true;
    }
  }
  if (!fileFailed) ok(`${file} (${gate}): level-aware bypass carve-out present, no stale floor phrasing`);
}

// Information-vs-approval refinement (decision a93994d3): bee-exploring's
// Socratic step must keep asking for genuine INFORMATION under full/total while
// suppressing mere APPROVALS. Assert the distinguishing litmus survives.
{
  const exploringAbs = path.join(REPO_ROOT, 'skills/bee-exploring/SKILL.md');
  let exploringText = '';
  try {
    exploringText = fs.readFileSync(exploringAbs, 'utf8');
  } catch {
    fail('skills/bee-exploring/SKILL.md: unreadable — the info-vs-approval refinement lives here');
  }
  if (!exploringText.includes('confident best answer')) {
    fail('skills/bee-exploring/SKILL.md: missing the info-vs-approval litmus ("confident best answer") — under full/total, approval questions are suppressed but genuine information questions must still be asked (decision a93994d3)');
  } else {
    ok('skills/bee-exploring/SKILL.md: info-vs-approval refinement present (asks for information, not approval, under bypass)');
  }
}

// Lane-ceremony-v3 doctrine (D1/D3/D4/D5/D8): bee-planning must carry the NEW
// plan-freeze + intake-first + lane-shape wording and must NOT carry the retired
// in-place plan enrichment. Prose-only invariants get bypassed unless mechanized
// (crit-pattern 20260714); these pins keep the rewrite from silently reverting to
// the shrunken-feature-plan model this feature removes.
{
  const planningAbs = path.join(REPO_ROOT, 'skills/bee-planning/SKILL.md');
  let planningText = '';
  try {
    planningText = fs.readFileSync(planningAbs, 'utf8');
  } catch {
    fail('skills/bee-planning/SKILL.md: unreadable — lane-ceremony-v3 planning doctrine lives here');
  }

  // (a) D1: the retired in-place enrichment instruction must be gone.
  if (planningText.includes('Enrich the **same**')) {
    fail('skills/bee-planning/SKILL.md (D1): still carries the retired in-place enrichment "Enrich the **same**" — plan.md is frozen at Gate 2, the enrichment step is removed');
  } else {
    ok('skills/bee-planning/SKILL.md (D1): retired in-place enrichment instruction absent');
  }

  // (b)-(f) Present-wording pins: each new lane invariant must be stated in text.
  const REQUIRED_PLANNING = [
    { token: 'frozen at Gate 2', d: 'D1', why: 'plan.md content is immutable once approved_gates.shape is set' },
    { token: 'approval stamp', d: 'D1', why: 'the only permitted post-approval plan.md write is an approval stamp' },
    { token: 'intake classification', d: 'D8', why: 'cheap intake classification runs before the lane-scaled bootstrap' },
    { token: 'request + one cell', d: 'D3', why: 'tiny lane shape = request + one cell, no plan.md' },
    { token: 'scoping synthesis', d: 'D4', why: 'small lane default = a logged scoping synthesis + 1-3 cells' },
    { token: 'plan.md is opt-in', d: 'D4', why: 'plan.md is opt-in for small, never written by default' },
    { token: 'never persist-then-preview', d: 'D5', why: 'draft cells are previewed before the merged gate; persisted only after approval' },
  ];
  for (const { token, d, why } of REQUIRED_PLANNING) {
    if (!planningText.includes(token)) {
      fail(`skills/bee-planning/SKILL.md (${d}): missing required lane-doctrine wording "${token}" — ${why}`);
    } else {
      ok(`skills/bee-planning/SKILL.md (${d}): "${token}" present`);
    }
  }
}

// Lane-ceremony-v3 doctrine (D3/D4/D5/D6/D7): the bee-hive surfaces (SKILL.md,
// go-mode.md, routing-and-contracts.md) must restate the SAME lane doctrine as
// the already-rewritten bee-planning/SKILL.md (lcv3-1) — never the old
// shrunken-feature-plan / unconditional-plan-caps wording. Consistency across
// restatements is the point of this cell.
{
  const hiveAbs = path.join(REPO_ROOT, 'skills/bee-hive/SKILL.md');
  const goModeAbs = path.join(REPO_ROOT, 'skills/bee-hive/references/go-mode.md');
  const routingAbs = path.join(REPO_ROOT, 'skills/bee-hive/references/routing-and-contracts.md');
  let hiveText = '';
  let goModeText = '';
  let routingText = '';
  try {
    hiveText = fs.readFileSync(hiveAbs, 'utf8');
  } catch {
    fail('skills/bee-hive/SKILL.md: unreadable — lane-ceremony-v3 hive doctrine lives here');
  }
  try {
    goModeText = fs.readFileSync(goModeAbs, 'utf8');
  } catch {
    fail('skills/bee-hive/references/go-mode.md: unreadable — lane-ceremony-v3 go-mode doctrine lives here');
  }
  try {
    routingText = fs.readFileSync(routingAbs, 'utf8');
  } catch {
    fail('skills/bee-hive/references/routing-and-contracts.md: unreadable — lane-ceremony-v3 routing doctrine lives here');
  }

  // (a) D7: old narrow-flag wordings must be gone from bee-hive/SKILL.md.
  const OLD_FLAG_PHRASES = ['existing covered behavior', 'weak proof around the area'];
  for (const phrase of OLD_FLAG_PHRASES) {
    if (hiveText.includes(phrase)) {
      fail(`skills/bee-hive/SKILL.md (D7): still carries the retired flag wording "${phrase}" — narrowed per D7`);
    } else {
      ok(`skills/bee-hive/SKILL.md (D7): retired flag wording "${phrase}" absent`);
    }
  }

  // (b) D7: new narrowed wordings present, matching bee-planning verbatim.
  const NEW_FLAG_TOKENS = [
    'changes behavior an existing test asserts',
    'weakening, deleting, or replacing existing proof',
  ];
  for (const token of NEW_FLAG_TOKENS) {
    if (!hiveText.includes(token)) {
      fail(`skills/bee-hive/SKILL.md (D7): missing narrowed flag wording "${token}"`);
    } else {
      ok(`skills/bee-hive/SKILL.md (D7): narrowed flag wording "${token}" present`);
    }
  }

  // (c) D6: product-files-only carve-out present.
  if (!hiveText.includes('product files only')) {
    fail('skills/bee-hive/SKILL.md (D6): missing "product files only" carve-out — lane caps must count product files only');
  } else {
    ok('skills/bee-hive/SKILL.md (D6): "product files only" carve-out present');
  }

  // (d) D3/D4: lane table states tiny has no plan.md, small's plan.md is opt-in.
  const LANE_TOKENS = [
    { token: 'cell is the micro-plan', d: 'D3' },
    { token: 'plan.md is opt-in', d: 'D4' },
    { token: 'logged scoping synthesis', d: 'D4' },
  ];
  for (const { token, d } of LANE_TOKENS) {
    if (!hiveText.includes(token)) {
      fail(`skills/bee-hive/SKILL.md (${d}): missing lane-table wording "${token}"`);
    } else {
      ok(`skills/bee-hive/SKILL.md (${d}): "${token}" present`);
    }
  }

  // (e) D5: go-mode's fast-path line describes preview-then-merged-gate, and
  // AO14's dispatched execution worker — not plan.md-first / solo-in-session.
  if (!goModeText.includes('previewed before persist')) {
    fail('skills/bee-hive/references/go-mode.md (D5): fast-path line missing "previewed before persist"');
  } else {
    ok('skills/bee-hive/references/go-mode.md (D5): fast-path line describes preview-before-persist');
  }
  if (goModeText.includes('solo in-session execution')) {
    fail('skills/bee-hive/references/go-mode.md (AO14): still carries retired "solo in-session execution" wording — tiny/small execute via one dispatched execution worker');
  } else {
    ok('skills/bee-hive/references/go-mode.md (AO14): retired "solo in-session execution" wording absent');
  }
  if (!goModeText.includes('one dispatched execution worker')) {
    fail('skills/bee-hive/references/go-mode.md (AO14): fast-path line missing "one dispatched execution worker"');
  } else {
    ok('skills/bee-hive/references/go-mode.md (AO14): "one dispatched execution worker" present');
  }

  // (f) D1: STEP 2/3 and the Gate 2 revise line no longer restate the retired
  // requirements-only -> implementation-ready mutation.
  if (goModeText.includes('plan.md enriched to implementation-ready')) {
    fail('skills/bee-hive/references/go-mode.md (D1): STEP 3 still carries the retired "plan.md enriched to implementation-ready" wording');
  } else {
    ok('skills/bee-hive/references/go-mode.md (D1): retired "plan.md enriched to implementation-ready" wording absent');
  }
  if (goModeText.includes('still `requirements-only`')) {
    fail('skills/bee-hive/references/go-mode.md (D1): Gate 2 revise line still carries the retired "still requirements-only" wording');
  } else {
    ok('skills/bee-hive/references/go-mode.md (D1): retired "still requirements-only" wording absent');
  }

  // (g) D1/D2: routing-and-contracts.md Chaining Contract / working-files tree
  // no longer state plan.md as unconditional or requirements-only -> implementation-ready.
  if (routingText.includes('requirements-only → implementation-ready')) {
    fail('skills/bee-hive/references/routing-and-contracts.md (D1): Chaining Contract still carries the retired "requirements-only → implementation-ready" arrow');
  } else {
    ok('skills/bee-hive/references/routing-and-contracts.md (D1): retired "requirements-only → implementation-ready" arrow absent');
  }
  if (!routingText.includes('frozen at Gate 2')) {
    fail('skills/bee-hive/references/routing-and-contracts.md (D1): missing "frozen at Gate 2" wording');
  } else {
    ok('skills/bee-hive/references/routing-and-contracts.md (D1): "frozen at Gate 2" wording present');
  }
}

// Sentinel: prove the checker bites. A synthetic gate surface missing the tokens
// (and carrying a banned phrase) MUST be flagged by the same predicates.
const sentinelBad = 'Present Gate X, then verbatim ask. The safety floor is absolute.';
const sentinelMissingToken = !['gate_bypass_level', 'full'].every((t) => sentinelBad.includes(t));
const sentinelHasBanned = BANNED_PHRASES.some((b) => sentinelBad.includes(b));
if (!sentinelMissingToken || !sentinelHasBanned) {
  fail('sentinel: the checker does not bite a non-compliant gate surface (fail-open) — the guard is useless');
} else {
  ok('sentinel: a non-compliant gate surface is correctly flagged (checker bites)');
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} - gate-bypass doctrine: ${failed} failure(s)`);
process.exit(failed > 0 ? 1 : 0);
