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
