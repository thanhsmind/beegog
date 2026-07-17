#!/usr/bin/env node
// Proves validateModelsConfig (ao-2ai-1) loudly flags malformed/prompt-less/
// unsafe cli-tier models config where today normalizeTierValue silently
// reverts to the seeded default (a malformed cli value -> normalizeTierValue
// returns undefined -> normalizeModels never overwrites -> the seeded
// 'sonnet' stays, no error). Plain node asserts, no framework, matching the
// style of the other scripts/test_*.mjs checks.

import { validateModelsConfig, UNSAFE_CLI_FLAGS } from '../.bee/bin/lib/state.mjs';

const results = [];
function record(desc, passed, detail) {
  results.push({ desc, passed });
  console.log((passed ? 'PASS ' : 'FAIL ') + desc + (passed ? '' : ` -- ${detail}`));
}

function hasCode(problems, code) {
  return problems.some((p) => p.code === code);
}

// ── valid configs pass clean ────────────────────────────────────────────────

{
  const problems = validateModelsConfig({
    models: { claude: { extraction: 'haiku', generation: 'sonnet', review: 'opus' } },
  });
  record('valid plain model-name tier passes (no problems)', problems.length === 0, JSON.stringify(problems));
}

{
  const problems = validateModelsConfig({
    models: { claude: { generation: { model: 'sonnet', effort: 'medium' } } },
  });
  record('valid {model, effort} tier shape passes (no problems)', problems.length === 0, JSON.stringify(problems));
}

{
  const problems = validateModelsConfig({
    models: {
      claude: {
        generation: { kind: 'cli', command: 'codex exec --json -m gpt-5.3-codex -s read-only', promptVia: 'stdin' },
      },
    },
  });
  record('valid cli tier (declared transport, safe command) passes', problems.length === 0, JSON.stringify(problems));
}

{
  // no models key at all, or an empty object — nothing configured, not an error.
  const p1 = validateModelsConfig({});
  const p2 = validateModelsConfig({ hooks: {} });
  record('config with no `models` key at all produces no problems', p1.length === 0 && p2.length === 0, JSON.stringify([p1, p2]));
}

// ── malformed cli (missing kind:'cli' or non-empty command) ────────────────

{
  const problems = validateModelsConfig({
    models: { claude: { generation: { command: 'codex exec' } } }, // missing kind:'cli'
  });
  record(
    'cli-shaped value missing kind:"cli" is flagged cli-malformed',
    hasCode(problems, 'cli-malformed'),
    JSON.stringify(problems),
  );
}

{
  const problems = validateModelsConfig({
    models: { claude: { generation: { kind: 'cli', command: '' } } }, // empty command
  });
  record(
    'cli value with an empty command string is flagged cli-malformed',
    hasCode(problems, 'cli-malformed'),
    JSON.stringify(problems),
  );
}

{
  const problems = validateModelsConfig({
    models: { claude: { generation: { kind: 'cli' } } }, // missing command entirely
  });
  record(
    'cli value missing command entirely is flagged cli-malformed',
    hasCode(problems, 'cli-malformed'),
    JSON.stringify(problems),
  );
}

// ── prompt-less cli (no declared prompt transport) ──────────────────────────

{
  const problems = validateModelsConfig({
    models: {
      claude: {
        // Trailing "-" is a shell stdin convention, NOT a declared transport —
        // the validator must never sniff it; promptVia is absent here.
        generation: { kind: 'cli', command: 'codex exec -m gpt-5 -s read-only -' },
      },
    },
  });
  record(
    'cli value with no promptVia is flagged cli-prompt-transport-missing (never sniffed from a trailing "-")',
    hasCode(problems, 'cli-prompt-transport-missing') && !hasCode(problems, 'cli-malformed'),
    JSON.stringify(problems),
  );
}

// ── each unsafe alias is flagged individually ───────────────────────────────

for (const flag of UNSAFE_CLI_FLAGS) {
  const problems = validateModelsConfig({
    models: {
      claude: {
        generation: { kind: 'cli', command: `some-cli exec ${flag} --other-flag`, promptVia: 'stdin' },
      },
    },
  });
  record(
    `unsafe alias "${flag}" is flagged cli-unsafe-flag`,
    problems.some((p) => p.code === 'cli-unsafe-flag' && p.flag === flag),
    JSON.stringify(problems),
  );
}

{
  // A command carrying more than one known-bad alias reports each of them.
  const twoFlags = [UNSAFE_CLI_FLAGS[0], UNSAFE_CLI_FLAGS[1]];
  const problems = validateModelsConfig({
    models: {
      codex: {
        review: { kind: 'cli', command: `some-cli exec ${twoFlags[0]} ${twoFlags[1]}`, promptVia: 'stdin' },
      },
    },
  });
  const unsafe = problems.filter((p) => p.code === 'cli-unsafe-flag');
  record(
    'a command with two known-bad aliases reports both, one row each',
    unsafe.length === 2 && twoFlags.every((f) => unsafe.some((p) => p.flag === f)),
    JSON.stringify(problems),
  );
}

// ── malformed / null / wrong-type input never throws ───────────────────────

{
  let threw = false;
  let problems = [];
  try {
    problems = validateModelsConfig(null);
  } catch {
    threw = true;
  }
  record('validateModelsConfig(null) does not throw and reports a malformed-input row', !threw && hasCode(problems, 'config-malformed'), JSON.stringify(problems));
}

{
  // `undefined` is the "no config file on disk at all" case (a fresh repo) —
  // distinct from `null`: it must NOT be reported as a problem, or every
  // fresh repo without .bee/config.json would warn on every `bee status`.
  let threw = false;
  let problems = [];
  try {
    problems = validateModelsConfig(undefined);
  } catch {
    threw = true;
  }
  record('validateModelsConfig(undefined) does not throw and reports nothing (no config file yet is normal)', !threw && problems.length === 0, JSON.stringify(problems));
}

for (const bad of ['a string', 42, true, ['array', 'config'], () => {}]) {
  let threw = false;
  let problems = [];
  try {
    problems = validateModelsConfig(bad);
  } catch {
    threw = true;
  }
  record(
    `validateModelsConfig(${JSON.stringify(String(bad))}) (wrong type) does not throw and reports a malformed-input row`,
    !threw && hasCode(problems, 'config-malformed'),
    JSON.stringify(problems),
  );
}

{
  // `models` present but the wrong shape (not an object) — still no throw.
  let threw = false;
  let problems = [];
  try {
    problems = validateModelsConfig({ models: 'not-an-object' });
  } catch {
    threw = true;
  }
  record(
    'a `models` key of the wrong type does not throw and reports a malformed-input row',
    !threw && hasCode(problems, 'config-malformed'),
    JSON.stringify(problems),
  );
}

{
  // a runtime value of the wrong shape (not an object) — still no throw.
  let threw = false;
  let problems = [];
  try {
    problems = validateModelsConfig({ models: { claude: 'not-an-object' } });
  } catch {
    threw = true;
  }
  record(
    'a runtime value of the wrong type does not throw and reports runtime-malformed',
    !threw && hasCode(problems, 'runtime-malformed'),
    JSON.stringify(problems),
  );
}

const failed = results.filter((r) => !r.passed);
console.log(`SUMMARY: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 7 : 0);
