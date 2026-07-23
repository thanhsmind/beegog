#!/usr/bin/env node
// migrate_backlog_pbis.mjs — backlog-unification bu-2 (CONTEXT.md v2 D5).
//
// One-time migration: folds every legacy docs/backlog.md TABLE row into an
// event-sourced `kind:"pbi"` "add" record appended to .bee/backlog.jsonl
// (the SAME stream `bee backlog add` already writes friction/proposal rows
// into — never a second store). P-ids are preserved verbatim via addPbi's
// migration-only `--id` path (lib/backlog.mjs addPbi). After this script
// runs, `bee backlog render --write` (a separate, deliberate step — not run
// by this script) regenerates docs/backlog.md as the short, machine-owned
// view.
//
// STATUS-ANCHORED PARSE, NEVER POSITIONAL. Three CoS cells in this table
// carry literal, unescaped '|' characters inside inline code — `recovery
// scan|window` (P56), `codex|claude` (P70), `knowledge check|index|list|
// context` (P64) — so a fixed "Status is column 3" read silently grabs the
// wrong cell on those rows once the interior pipes shift every cell after
// them. This parser instead anchors on the STRUCTURAL EDGES of each row,
// which stay stable regardless of interior pipe noise: the first cell is
// always ID, the last cell is always Feature, the second-to-last cell is
// always Status — everything in between (Story's own cell, plus however
// many fragments the CoS cell got split into) is Story (first inner cell)
// then CoS (every remaining inner fragment REJOINED with '|', restoring the
// literal pipes those inline-code spans always meant). A row missing its
// trailing pipe (P37) is handled the same way splitRow-style edge-trimming
// always has: only a genuinely EMPTY boundary cell is dropped, so a row
// short one trailing '|' still resolves its real last cell as Feature.
//
// DECORATED STATUSES (P8, P13, P32): three "done" rows carry extra prose in
// the Status cell itself (`done: killed 2026-07-12 per fanout-delegation
// D1: ...`, `done: advisor mode removed 2026-07-12 per fanout-delegation
// D1`, `done ([docs/history/advisor-and-orchestration/](...))`). Nothing is
// dropped: the cell is normalized to the bare enum value for the `status`
// field, and the decoration prose is appended into the item's `cos` as
// `(status decoration: ...)` so it survives in the migrated record.
//
// IDEMPOTENT + DIVERGENCE-REFUSING. Every row's target state (id, title,
// cos, status, feature) is computed FIRST and compared against the CURRENT
// fold (foldPbis) before anything is written: an id already present with
// MATCHING computed state is a silent no-op; an id already present with
// DIFFERING state aborts the entire run (nothing is appended this run) and
// names every mismatch, so a hand-edited or half-migrated store never gets
// silently overwritten or silently diverges further. Once docs/backlog.md
// has already been replaced by the generated view (the GENERATED FILE
// marker `bee backlog render --write` stamps in), this script can no longer
// re-derive the legacy table at all — that is expected and fine: by that
// point the fold already carries every migrated id, so a re-run just
// confirms events exist and no-ops.
//
// Usage:
//   node scripts/migrate_backlog_pbis.mjs [--root <path>]
//
// Exit 0 on success (including the "nothing to do" no-op cases); exit 1 with
// every violation/divergence named, otherwise. --root lets tests point this
// at a disposable fixture repo; it defaults to this file's own repo root.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PBI_STATUSES, foldPbis, addPbi } from "../.bee/bin/lib/backlog.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.join(__dirname, "..");
const GENERATED_MARKER = "GENERATED FILE";
const EXPECTED_ROW_COUNT = 76;
const EXPECTED_MAX_ID_NUM = 77;

function backlogPath(root) {
  return path.join(root, "docs", "backlog.md");
}

// Same edge-trim discipline as lib/backlog.mjs's private splitRow: only an
// EMPTY boundary cell (no leading/trailing '|') is dropped, so a row missing
// one outer pipe (P37) still resolves correctly.
function splitRawCells(line) {
  const raw = line.split("|");
  if (raw.length && raw[0] === "") raw.shift();
  if (raw.length && raw[raw.length - 1] === "") raw.pop();
  return raw.map((c) => c.trim());
}

function stripMarkup(cell) {
  return cell.replace(/[`*_]/g, "").trim();
}

/**
 * Parse the legacy docs/backlog.md table, anchoring each data row on its
 * structural edges (ID first, Feature last, Status second-to-last) rather
 * than a fixed column index — see file header for why.
 * @returns {{rows: object[]|null, alreadyGenerated: boolean}}
 */
export function parseLegacyBacklogTable(root) {
  const file = backlogPath(root);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return { rows: null, alreadyGenerated: false };
  }

  if (text.includes(GENERATED_MARKER)) {
    return { rows: null, alreadyGenerated: true };
  }

  const lines = text.split(/\r?\n/);
  let statusHeaderSeen = false;
  let separatorSeen = false;
  const rows = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.includes("|")) {
      if (separatorSeen && rows.length > 0) break; // table body ended
      continue;
    }
    const cells = splitRawCells(line);
    if (!statusHeaderSeen) {
      const hasStatusHeader = cells.some((c) => stripMarkup(c).toLowerCase() === "status");
      if (hasStatusHeader) statusHeaderSeen = true;
      continue;
    }
    if (!separatorSeen) {
      separatorSeen = true; // the |---|---|...| row right after the header
      continue;
    }
    if (cells.length < 5) continue; // not a real data row (id/story/cos/status/feature minimum)

    const id = stripMarkup(cells[0]);
    const feature = stripMarkup(cells[cells.length - 1]);
    const statusRaw = cells[cells.length - 2];
    const story = cells[1];
    // Everything between Story (index 1) and Status (index length-2) is CoS,
    // rejoined with '|' — this is what undoes the literal-pipe split.
    const cos = cells.slice(2, cells.length - 2).join("|").trim();

    rows.push({ id, story, cos, statusRaw, feature, sourceLine: i + 1 });
  }

  return { rows, alreadyGenerated: false };
}

/**
 * Normalize a (possibly decorated) Status cell to a bare enum value plus
 * whatever decoration prose followed it. Returns {status: null, decoration}
 * when nothing recognizable is found — callers treat that as a hard error,
 * never a guess.
 */
export function normalizeStatusCell(raw) {
  const cleaned = stripMarkup(raw);
  const lowered = cleaned.toLowerCase();
  for (const status of PBI_STATUSES) {
    if (lowered === status) return { status, decoration: "" };
    if (lowered.startsWith(status)) {
      const rest = cleaned.slice(status.length);
      // word-boundary guard: the character right after the matched enum
      // word must not itself be alphanumeric/hyphen (else "done" would
      // wrongly match inside some longer unrelated word).
      if (rest === "" || /^[^a-z0-9-]/i.test(rest)) {
        const decoration = rest.replace(/^[:\s]+/, "").trim();
        return { status, decoration };
      }
    }
  }
  return { status: null, decoration: cleaned };
}

function normalizeFeature(raw) {
  const cleaned = raw.trim();
  if (cleaned === "" || cleaned === "—" || cleaned === "-") return null;
  return cleaned;
}

function mergeCosWithDecoration(cos, decoration) {
  if (!decoration) return cos;
  const note = `(status decoration: ${decoration})`;
  return cos ? `${cos} ${note}` : note;
}

/**
 * Turn raw parsed table rows into final migrated PBI field sets, asserting
 * the 76-unique/max-P77 invariant and refusing any row whose Status cell
 * doesn't resolve to a known enum value even after decoration-stripping.
 */
export function normalizeRows(rawRows) {
  const seen = new Map();
  const rows = rawRows.map((r) => {
    if (!/^P\d+$/.test(r.id)) {
      throw new Error(
        `migrate: id "${r.id}" (docs/backlog.md line ${r.sourceLine}) does not match the expected "P<n>" shape.`,
      );
    }
    if (seen.has(r.id)) {
      throw new Error(
        `migrate: duplicate id "${r.id}" in docs/backlog.md — lines ${seen.get(r.id)} and ${r.sourceLine}.`,
      );
    }
    seen.set(r.id, r.sourceLine);

    const { status, decoration } = normalizeStatusCell(r.statusRaw);
    if (!status) {
      throw new Error(
        `migrate: row for id "${r.id}" (docs/backlog.md line ${r.sourceLine}) has an unrecognized status "${r.statusRaw}" — not one of ${PBI_STATUSES.join(", ")}, even after decoration-stripping.`,
      );
    }

    return {
      id: r.id,
      title: r.story,
      cos: mergeCosWithDecoration(r.cos, decoration),
      status,
      feature: normalizeFeature(r.feature),
      decorated: Boolean(decoration),
      sourceLine: r.sourceLine,
    };
  });

  if (rows.length !== EXPECTED_ROW_COUNT) {
    throw new Error(
      `migrate: expected exactly ${EXPECTED_ROW_COUNT} unique P-ids in docs/backlog.md, found ${rows.length}.`,
    );
  }
  const maxNum = Math.max(...rows.map((r) => Number(r.id.slice(1))));
  if (maxNum !== EXPECTED_MAX_ID_NUM) {
    throw new Error(`migrate: expected max id P${EXPECTED_MAX_ID_NUM}, found P${maxNum}.`);
  }

  return rows;
}

/**
 * Compare normalized rows against the CURRENT fold. Never writes anything —
 * a pure plan: which ids are new (toAdd), which already match (skipped, a
 * silent no-op), and which already exist with DIFFERENT content
 * (divergences — refusing the whole run is the caller's job).
 */
export function planMigration(root, rows) {
  const { items } = foldPbis(root);
  const toAdd = [];
  const skipped = [];
  const divergences = [];
  for (const row of rows) {
    const existing = items.get(row.id);
    if (!existing) {
      toAdd.push(row);
      continue;
    }
    const mismatch = [];
    if ((existing.title || "") !== row.title) mismatch.push(`title: existing="${existing.title}" vs migrated="${row.title}"`);
    if ((existing.cos || "") !== row.cos) mismatch.push(`cos: existing="${existing.cos}" vs migrated="${row.cos}"`);
    if (existing.status !== row.status) mismatch.push(`status: existing="${existing.status}" vs migrated="${row.status}"`);
    if ((existing.feature || null) !== (row.feature || null)) mismatch.push(`feature: existing="${existing.feature}" vs migrated="${row.feature}"`);
    if (mismatch.length > 0) {
      divergences.push({ id: row.id, mismatch });
    } else {
      skipped.push(row.id);
    }
  }
  return { toAdd, skipped, divergences };
}

/**
 * Run the full migration against `root`. Two-phase: plan first (never
 * writes), refuse atomically on any divergence, THEN append 'add' events for
 * every genuinely-new id. Returns a summary; throws on any hard failure
 * (invariant violation, unrecognized status, divergence) before writing
 * anything for this invocation.
 */
export function runMigration(root) {
  const { rows: rawRows, alreadyGenerated } = parseLegacyBacklogTable(root);
  if (alreadyGenerated) {
    const { hasEvents } = foldPbis(root);
    if (!hasEvents) {
      throw new Error(
        "migrate: docs/backlog.md is already the GENERATED view, but .bee/backlog.jsonl carries no kind:\"pbi\" events — inconsistent state, refusing to guess.",
      );
    }
    return { added: [], skipped: [], divergences: [], alreadyGenerated: true, allRows: [] };
  }
  if (!rawRows) {
    throw new Error("migrate: docs/backlog.md has no parseable legacy table (missing file, no Status header found).");
  }

  const rows = normalizeRows(rawRows);
  const { toAdd, skipped, divergences } = planMigration(root, rows);

  if (divergences.length > 0) {
    const lines = divergences.map((d) => `DIVERGENCE for id "${d.id}": ${d.mismatch.join("; ")}`);
    throw new Error(
      `migrate: refusing — ${divergences.length} id(s) already exist in .bee/backlog.jsonl with content that differs from docs/backlog.md. FIX: reconcile by hand before re-running.\n${lines.join("\n")}`,
    );
  }

  for (const row of toAdd) {
    addPbi(root, {
      id: row.id,
      title: row.title,
      cos: row.cos,
      status: row.status,
      feature: row.feature || undefined,
    });
  }

  return { added: toAdd.map((r) => r.id), skipped, divergences: [], alreadyGenerated: false, allRows: rows };
}

function main() {
  const args = process.argv.slice(2);
  const rootIdx = args.indexOf("--root");
  const root = rootIdx !== -1 && args[rootIdx + 1] ? path.resolve(args[rootIdx + 1]) : DEFAULT_REPO_ROOT;

  try {
    const result = runMigration(root);
    if (result.alreadyGenerated) {
      console.log(
        "migrate_backlog_pbis: docs/backlog.md is already the generated view and .bee/backlog.jsonl already carries pbi events — nothing to do.",
      );
      process.exit(0);
    }

    const countsByStatus = {};
    for (const row of result.allRows) countsByStatus[row.status] = (countsByStatus[row.status] || 0) + 1;
    const decorated = result.allRows.filter((r) => r.decorated);

    console.log(
      `migrate_backlog_pbis: ${result.added.length} added, ${result.skipped.length} already present (no-op), 0 divergences.`,
    );
    console.log(
      `Status counts: ${Object.entries(countsByStatus).map(([s, n]) => `${s}=${n}`).join(", ") || "(none)"}`,
    );
    console.log(
      `Decorated status rows handled (${decorated.length}): ${decorated.map((r) => r.id).join(", ") || "none"}`,
    );
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
