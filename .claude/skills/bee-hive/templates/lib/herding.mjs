// herding.mjs — the human-facing "bee herding enable/disable/status" verbs
// (herding-dispatch-lock-toggle, decisions D1-D5). These perform BYTE-FOR-
// BYTE the same filesystem operation as today's manual `touch`/`rm` of the
// dispatch loop's owner enable marker: resolveHerdingMainRoot mirrors
// dispatch-interlock.mjs's resolveMainRoot EXACTLY (same git command, same
// strip-trailing-.git logic), and ENABLE_BASENAME is the identical constant
// — so this module and dispatch-interlock.mjs always agree on the same file
// (`.claude/skills/bee-herding/scripts/dispatch-interlock.mjs`, the sole
// reader; never modified or called from here, per D4).
//
// D4: these functions are a convenience for the human owner's own terminal
// action only. Never call them from dispatch-interlock.mjs, bootstrap,
// dispatch, merge, or any other bee automation/skill/agent code.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const ENABLE_BASENAME = 'bee-herding.enable';

export function resolveHerdingMainRoot(explicit) {
  if (explicit) return explicit;
  try {
    const gitCommonDir = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { encoding: 'utf8' },
    ).trim();
    if (!gitCommonDir) return null;
    return path.dirname(gitCommonDir);
  } catch {
    return null;
  }
}

function markerPath(mainRoot) {
  return path.join(mainRoot, '.bee', 'tmp', ENABLE_BASENAME);
}

function requireMainRoot(explicit) {
  const mainRoot = resolveHerdingMainRoot(explicit);
  if (!mainRoot) {
    throw new Error(
      'could not resolve the MAIN checkout root (`git rev-parse --path-format=absolute --git-common-dir` failed) — run this from inside a git checkout.',
    );
  }
  return mainRoot;
}

// D3: idempotent — enabling an already-enabled marker is not an error.
export function enableHerding(explicit) {
  const mainRoot = requireMainRoot(explicit);
  const marker = markerPath(mainRoot);
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, '');
  return { enabled: true, marker, main_root: mainRoot };
}

// D3: idempotent — disabling an already-absent marker is not an error.
export function disableHerding(explicit) {
  const mainRoot = requireMainRoot(explicit);
  const marker = markerPath(mainRoot);
  if (fs.existsSync(marker)) fs.rmSync(marker);
  return { enabled: false, marker, main_root: mainRoot };
}

export function herdingStatus(explicit) {
  const mainRoot = requireMainRoot(explicit);
  const marker = markerPath(mainRoot);
  return { enabled: fs.existsSync(marker), marker, main_root: mainRoot };
}
