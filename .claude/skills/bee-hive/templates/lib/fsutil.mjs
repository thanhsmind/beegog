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
  // Strip a leading UTF-8 BOM (U+FEFF) before parsing. Windows tooling adds one
  // by default — e.g. PowerShell 5.1's `Set-Content -Encoding UTF8` writes a BOM
  // (it is NOT BOM-less) — and JSON.parse then throws "Unexpected token '﻿'".
  // Stripping it here fixes every reader (config, state, onboarding, the Windows
  // install distribution preflight, …) in one place. See GitHub #9.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  try {
    return JSON.parse(text);
  } catch (err) {
    // Fail open (return the fallback) so a malformed JSON never crashes bee — but
    // NEVER silently. Swallowing the parse error made a corrupt file look
    // identical to an absent one, so a broken .bee/config.json was silently
    // replaced by defaults and the user got misleading behavior with no clue why
    // (GitHub #13). Warn to STDERR (stdout is reserved for --json output).
    console.warn(`bee: could not parse JSON at ${file} — ${err.message}. Using fallback; fix the file.`);
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

// removeFileIfExists — best-effort unlink, never throws. Used to prune a cache
// file from its legacy `.bee/` root location after it has been re-homed under
// `.bee/cache/` (GitHub #11), so the old scratch file does not linger.
export function removeFileIfExists(file) {
  try {
    fs.rmSync(file, { force: true });
  } catch {
    /* best-effort cleanup — a leftover legacy cache file is harmless */
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
