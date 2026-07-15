// fsutil.mjs — small filesystem primitives shared by all bee modules.
// Zero deps, Node 18+, Windows-safe. Atomic writes: <file>.tmp then renameSync.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// hashFile — sha256 of a file's utf8 content. The SINGLE hasher shared by the
// managed-hash recorder (onboard buildManagedVersions) and the drift reader
// (bee.mjs computeRuntimeDrift), so the two can never disagree about what a
// vendored file's fingerprint is. utf8 (not raw Buffer) matches the values the
// onboarding ledger already records.
export function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8')).digest('hex');
}

export function readJson(file, fallback = null) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return fallback;
  }
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// readText — the raw-text sibling of readJson, for non-JSON sources (e.g. a
// learnings *.md whose YAML frontmatter must be parsed by the caller). Content
// readers live here so callers like feedback.mjs stay free of any bare
// filesystem read — the read-scope drift guard depends on that.
export function readText(file, fallback = '') {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return fallback;
  }
}

export function writeJsonAtomic(file, obj) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

export function appendJsonl(file, obj) {
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, `${JSON.stringify(obj)}\n`, 'utf8');
}

export function readJsonl(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const events = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // Skip corrupt lines rather than failing the whole read.
    }
  }
  return events;
}
