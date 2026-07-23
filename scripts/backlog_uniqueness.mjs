#!/usr/bin/env node
// Backlog PBI event-stream integrity gate (backlog-unification bu-2, D5).
//
// RETARGETED from the legacy docs/backlog.md TABLE uniqueness check (i-1,
// docs/history/issues-46-53/CONTEXT.md D1/D2) onto the event-sourced PBI
// layer that table was migrated into (bu-1/bu-2): `.bee/backlog.jsonl`
// `kind:"pbi"` records are now the source of truth, so this is where a
// duplicate id, a malformed event, or a stale generated docs/backlog.md view
// get caught. Same path, same filename, same `--check` contract — this file
// is manifest-pinned into run_verify.mjs's EXTRA_SUITES (this exact
// invocation) and covered by the release manifest/test_verify_manifest as
// before; retargeting its BODY needs no change anywhere else in the chain.
//
// foldPbis() (.bee/bin/lib/backlog.mjs) silently absorbs a duplicate 'add'
// event — first add wins, the later one is ignored (the fold's defensive
// backstop, documented there). That is a RUNTIME safety net, not a
// substitute for this CHECK: an id getting a second 'add' event at all means
// something upstream (a migration bug, a bad `--id` override, two racing
// writers who independently generated the same id) slipped past addPbi's own
// guard, and the fold's silence would hide that forever. This script reads
// the RAW event stream itself — never through the fold — so a duplicate is
// loud, named, and line-numbered, the same discipline the legacy check used
// on the old table's duplicate P50 row.
//
// Checks (each violation named individually on failure):
//   1. every `kind:"pbi"` line parses as JSON, is an object, carries a known
//      event (`add`|`status`|`amend`) and a non-empty string `id`.
//   2. an `add` event carries a non-empty `title`; an `amend` event carries
//      at least one of `title`/`cos`.
//   3. every `status` value present on an `add` or `status` event is one of
//      the 5 PBI_STATUSES.
//   4. no id gets a second `add` event (duplicate id — the historic P50
//      failure mode, now against the event stream instead of table rows).
//   5. the generated docs/backlog.md view is not stale relative to the
//      current fold (render freshness — the ONLY place in the verify chain
//      this gets checked, since run_verify.mjs's EXTRA_SUITES pins this
//      file's `--check` but not a separate `bee backlog render --check`).
//
// Usage:
//   node scripts/backlog_uniqueness.mjs --check [--root <path>]
//
// Exit 0 when every check passes, OR when .bee/backlog.jsonl carries no
// `kind:"pbi"` events at all (nothing migrated yet — the legacy pre-
// migration state, nothing to check); exit 1, naming every violation,
// otherwise. --root lets tests point this at a disposable fixture repo; it
// defaults to this file's own repo root.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PBI_STATUSES, renderBacklogPbiView } from "../.bee/bin/lib/backlog.mjs";

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

function backlogJsonlPath(root) {
  return path.join(root, ".bee", "backlog.jsonl");
}

/**
 * Raw (never-folded) walk of .bee/backlog.jsonl's `kind:"pbi"` lines.
 * @returns {{malformed:{line:number,reason:string}[], duplicates:{id:string,lines:number[]}[], hasEvents:boolean}}
 */
export function findPbiViolations(root) {
  const malformed = [];
  const addLines = new Map(); // id -> 1-based line numbers of every 'add' event

  let text;
  try {
    text = fs.readFileSync(backlogJsonlPath(root), "utf8");
  } catch {
    return { malformed, duplicates: [], hasEvents: false };
  }

  const lines = text.split(/\r?\n/);
  let hasEvents = false;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const lineNo = i + 1;
    let row;
    try {
      row = JSON.parse(raw);
    } catch {
      // Not every line in this stream is a pbi event — friction/feedback
      // rows already live here (`bee backlog add`) and are out of this
      // gate's scope. A parse failure on a non-pbi-shaped line belongs to
      // whichever consumer that line was meant for (they already skip
      // malformed lines fail-open); this gate stays silent on it.
      continue;
    }
    if (!row || typeof row !== "object" || row.kind !== "pbi") continue;
    hasEvents = true;

    const event = row.event;
    if (event !== "add" && event !== "status" && event !== "amend") {
      malformed.push({ line: lineNo, reason: `unknown event "${event}"` });
      continue;
    }
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : null;
    if (!id) {
      malformed.push({ line: lineNo, reason: `missing/empty id on a ${event} event` });
      continue;
    }

    if (event === "add") {
      const hasTitle = typeof row.title === "string" && row.title.trim().length > 0;
      if (!hasTitle) malformed.push({ line: lineNo, reason: `add event for id "${id}" has no non-empty title` });
      if (row.status !== undefined && !PBI_STATUSES.includes(row.status)) {
        malformed.push({ line: lineNo, reason: `add event for id "${id}" has invalid status "${row.status}"` });
      }
      if (!addLines.has(id)) addLines.set(id, []);
      addLines.get(id).push(lineNo);
    } else if (event === "status") {
      if (!PBI_STATUSES.includes(row.status)) {
        malformed.push({ line: lineNo, reason: `status event for id "${id}" has invalid status "${row.status}"` });
      }
    } else if (event === "amend") {
      const hasTitle = typeof row.title === "string" && row.title.trim().length > 0;
      const hasCos = typeof row.cos === "string" && row.cos.trim().length > 0;
      if (!hasTitle && !hasCos) {
        malformed.push({ line: lineNo, reason: `amend event for id "${id}" has neither title nor cos` });
      }
    }
  }

  const duplicates = [];
  for (const [id, lineNumbers] of addLines) {
    if (lineNumbers.length > 1) duplicates.push({ id, lines: lineNumbers });
  }

  return { malformed, duplicates, hasEvents };
}

export function runCheck(root) {
  const { malformed, duplicates, hasEvents } = findPbiViolations(root);

  if (!hasEvents) {
    console.log(
      "backlog_uniqueness --check: no kind:\"pbi\" events in .bee/backlog.jsonl yet — nothing to check (pre-migration state)",
    );
    return 0;
  }

  let ok = true;
  for (const { line, reason } of malformed) {
    ok = false;
    console.error(`MALFORMED .bee/backlog.jsonl pbi event at line ${line}: ${reason}`);
  }
  for (const { id, lines } of duplicates) {
    ok = false;
    console.error(`DUPLICATE pbi id "${id}": a second 'add' event appears on line ${lines.join(", line ")}`);
  }

  const rendered = renderBacklogPbiView(root, { write: false });
  if (rendered.changed) {
    ok = false;
    console.error(
      'STALE docs/backlog.md: does not match the current .bee/backlog.jsonl fold. FIX: run "bee backlog render --write".',
    );
  }

  if (ok) {
    console.log(
      "backlog_uniqueness --check: every pbi id is unique, every event is well-formed, docs/backlog.md is current",
    );
    return 0;
  }
  console.error(
    `backlog_uniqueness --check: FAIL — ${malformed.length} malformed event(s), ${duplicates.length} duplicated id(s)${rendered.changed ? ", docs/backlog.md stale" : ""}.`,
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
