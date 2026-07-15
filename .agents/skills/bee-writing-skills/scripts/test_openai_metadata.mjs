#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const skillsRoot = path.join(repoRoot, 'skills');
const renderer = path.join(scriptDir, 'render_openai_metadata.mjs');

function slash(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

// Keep the pre-feature RED diagnostic stable and singular. Fixture contract tests
// start only after the live tree has a complete projection.
const liveSkillDirs = fs.readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('bee-'))
  .map((entry) => entry.name)
  .sort();

for (const skillDir of liveSkillDirs) {
  const relativeMetadata = path.join('skills', skillDir, 'agents', 'openai.yaml');
  if (!fs.existsSync(path.join(repoRoot, relativeMetadata))) {
    fail(`MISSING ${slash(relativeMetadata)}`);
  }
}

let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write(`PASS  ${name}\n`);
  } catch (error) {
    fail(`FAIL  ${name}\n${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeSkill(root, directory, frontmatter) {
  const skillDir = path.join(root, 'skills', directory);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---\n${frontmatter}---\n\n# Fixture\n`, 'utf8');
}

function metadataPath(root, directory) {
  return path.join(root, 'skills', directory, 'agents', 'openai.yaml');
}

function runRenderer(root, ...args) {
  return spawnSync(process.execPath, [renderer, '--root', root, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function outputOf(result) {
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function expectFailure(result, needle, label) {
  assert(result.status !== 0, `${label}: expected nonzero exit`);
  assert(outputOf(result).includes(needle), `${label}: output must name ${needle}; got ${JSON.stringify(outputOf(result))}`);
}

function withFixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-openai-metadata-'));
  try {
    fs.mkdirSync(path.join(root, 'skills'), { recursive: true });
    fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

check('live tree: renderer --check accepts every generated bee-* projection', () => {
  const result = runRenderer(repoRoot, '--check');
  assert(result.status === 0, outputOf(result));
});

check('fixture: folded multiline description renders exact representative YAML bytes', () => withFixture((root) => {
  writeSkill(root, 'bee-writing-skills', [
    'name: bee-writing-skills',
    'description: >-',
    '  Build and pressure-test bee skills.',
    '  Use when punctuation matters: colons, # hashes, and "quotes".',
    'metadata:',
    "  version: '0.1'",
    '',
  ].join('\n'));
  const result = runRenderer(root);
  assert(result.status === 0, outputOf(result));
  const expected = [
    'interface:',
    '  display_name: "Bee Writing Skills"',
    '  short_description: "Build and pressure-test bee skills. Use when punctuation matters: colons, # hashes, and \\"quotes\\"."',
    'policy:',
    '  allow_implicit_invocation: true',
    '',
  ].join('\n');
  assert(fs.readFileSync(metadataPath(root, 'bee-writing-skills'), 'utf8') === expected, 'representative YAML bytes differ');
}));

check('fixture: folded descriptions normalize line breaks to one space', () => withFixture((root) => {
  writeSkill(root, 'bee-folded', 'name: bee-folded\ndescription: >-\n  First line.\n  Second line.\n');
  const result = runRenderer(root);
  assert(result.status === 0, outputOf(result));
  assert(fs.readFileSync(metadataPath(root, 'bee-folded'), 'utf8').includes('"First line. Second line."'), 'folded description was not normalized');
}));

for (const row of [
  ['missing name key', 'description: >-\n  Has description.\n', 'name'],
  ['missing description key', 'name: bee-invalid\n', 'description'],
  ['duplicate name key', 'name: bee-invalid\nname: bee-second\ndescription: >-\n  Has description.\n', 'name'],
  ['duplicate description key', 'name: bee-invalid\ndescription: >-\n  First.\ndescription: >-\n  Second.\n', 'description'],
  ['unsupported literal description scalar style', 'name: bee-invalid\ndescription: |-\n  Literal text.\n', 'description'],
  ['unsupported plain description scalar style', 'name: bee-invalid\ndescription: Plain text.\n', 'description'],
]) {
  const [name, frontmatter, needle] = row;
  check(`fixture validation: ${name}`, () => withFixture((root) => {
    writeSkill(root, 'bee-invalid', frontmatter);
    expectFailure(runRenderer(root), needle, name);
  }));
}

check('fixture lifecycle: add a bee-* skill generates its projection', () => withFixture((root) => {
  writeSkill(root, 'bee-alpha', 'name: bee-alpha\ndescription: >-\n  Alpha skill.\n');
  assert(runRenderer(root).status === 0, 'initial render failed');
  writeSkill(root, 'bee-beta', 'name: bee-beta\ndescription: >-\n  Beta skill.\n');
  const result = runRenderer(root);
  assert(result.status === 0, outputOf(result));
  assert(fs.existsSync(metadataPath(root, 'bee-beta')), 'added skill metadata missing');
}));

check('fixture lifecycle: remove a bee-* skill leaves no unexpected projection', () => withFixture((root) => {
  writeSkill(root, 'bee-alpha', 'name: bee-alpha\ndescription: >-\n  Alpha skill.\n');
  writeSkill(root, 'bee-beta', 'name: bee-beta\ndescription: >-\n  Beta skill.\n');
  assert(runRenderer(root).status === 0, 'initial render failed');
  fs.rmSync(path.join(root, 'skills', 'bee-beta'), { recursive: true, force: true });
  const result = runRenderer(root, '--check');
  assert(result.status === 0, outputOf(result));
}));

check('fixture lifecycle: rename updates display name and stale projection', () => withFixture((root) => {
  writeSkill(root, 'bee-alpha', 'name: bee-alpha\ndescription: >-\n  Alpha skill.\n');
  assert(runRenderer(root).status === 0, 'initial render failed');
  fs.renameSync(path.join(root, 'skills', 'bee-alpha'), path.join(root, 'skills', 'bee-renamed'));
  fs.writeFileSync(path.join(root, 'skills', 'bee-renamed', 'SKILL.md'), '---\nname: bee-renamed\ndescription: >-\n  Renamed skill.\n---\n', 'utf8');
  const result = runRenderer(root);
  assert(result.status === 0, outputOf(result));
  assert(fs.readFileSync(metadataPath(root, 'bee-renamed'), 'utf8').includes('"Bee Renamed"'), 'renamed display name stayed stale');
}));

check('fixture lifecycle: stale output fails --check and rerender restores parity', () => withFixture((root) => {
  writeSkill(root, 'bee-stale', 'name: bee-stale\ndescription: >-\n  Before.\n');
  assert(runRenderer(root).status === 0, 'initial render failed');
  fs.writeFileSync(path.join(root, 'skills', 'bee-stale', 'SKILL.md'), '---\nname: bee-stale\ndescription: >-\n  After.\n---\n', 'utf8');
  expectFailure(runRenderer(root, '--check'), 'skills/bee-stale/agents/openai.yaml', 'stale output');
  assert(runRenderer(root).status === 0, 'rerender failed');
  assert(runRenderer(root, '--check').status === 0, 'rerender did not restore parity');
}));

check('fixture validation: orphan bee-* directory without SKILL.md fails closed', () => withFixture((root) => {
  fs.mkdirSync(path.join(root, 'skills', 'bee-orphan', 'agents'), { recursive: true });
  fs.writeFileSync(path.join(root, 'skills', 'bee-orphan', 'agents', 'openai.yaml'), 'interface: {}\n', 'utf8');
  expectFailure(runRenderer(root), 'skills/bee-orphan', 'orphan directory');
}));

process.stdout.write(`${passed} metadata parity checks passed\n`);
