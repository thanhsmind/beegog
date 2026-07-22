#!/usr/bin/env node
// Backlog PBI id uniqueness gate (i-1, docs/history/issues-46-53/CONTEXT.md D1/D2).
//
// #49 reported "ids are allocated max+1 and concurrent readers collide" —
// there is no allocator anywhere in this repo: `.bee/bin/lib/backlog.mjs`
// only parses/counts/ranks/badges docs/backlog.md, and `bee backlog add`
// writes an entirely different store (.bee/backlog.jsonl, the friction
// feed). The id rule lives in PROSE (skills/bee-scribing references,
// "next free integer, never reused") and is executed by an agent hand-
// editing this markdown table. The committed duplicate this gate was built
// to catch — two `P50` rows, authored a day apart on different branches —
// proves it was never a race: each author computed "next free" from a
// snapshot that predated the other's commit. A lock would have prevented
// nothing. What was missing is a CHECK, and this is it.
//
// Reuses findDuplicateBacklogIds's row walk (the same walk rankBacklog
// already does — no second parser of docs/backlog.md exists anywhere in
// this repo) and fails loudly, naming every duplicated id and the exact
// line number of every row that carries it.
//
// Usage:
//   node scripts/backlog_uniqueness.mjs --check [--root <path>]
//
// Exit 0 when every ID on a data row is unique (or the file/table is
// absent — nothing to check); exit 1, naming every duplicate id and its
// line numbers, otherwise. --root lets tests point this at a disposable
// fixture repo; it defaults to this file's own repo root.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { findDuplicateBacklogIds } from "../.bee/bin/lib/backlog.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.join(__dirname, "..");

function parseRoot(args) {
  const i = args.indexOf("--root");
  if (i === -1) return DEFAULT_REPO_ROOT;
  const value = args[i + 1];
  if (!value) {
    console.error("usage: backlog_uniqueness.mjs --check [--root <path>]");
    process.exit(1);
  }
  return path.resolve(value);
}

export function runCheck(root) {
  const duplicates = findDuplicateBacklogIds(root);
  if (duplicates.length === 0) {
    console.log("backlog_uniqueness --check: every docs/backlog.md ID is unique");
    return 0;
  }
  for (const { id, lines } of duplicates) {
    console.error(
      `DUPLICATE docs/backlog.md id "${id}" appears on ${lines.length} rows: line ${lines.join(", line ")}`,
    );
  }
  console.error(
    `backlog_uniqueness --check: FAIL — ${duplicates.length} duplicated id(s) in docs/backlog.md. FIX: renumber the LATER row to the next genuinely free id; never reuse a vacated number (docs/history/issues-46-53/CONTEXT.md D2).`,
  );
  return 1;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.includes("--check")) {
    console.error("usage: backlog_uniqueness.mjs --check [--root <path>]");
    process.exit(1);
  }
  const root = parseRoot(args);
  process.exit(runCheck(root));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
