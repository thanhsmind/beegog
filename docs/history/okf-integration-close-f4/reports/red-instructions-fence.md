# RED baseline — `okf_instructions_fence` before the f4-6 fixes

Captured by cell **f4-6** before a single misroute was fixed, per the cell's red-first requirement.
The gate is `scripts/okf_instructions_fence.mjs`; the tree is a pristine checkout of **9166943**
(`git archive 9166943 | tar -x -C <dir>`), so this is reproducible at any time with
`node scripts/okf_instructions_fence.mjs --root <that dir>`.

Two runs are recorded, because the first classifier was thrown away on evidence:

- **File-level rule (discarded): 23 findings.** "The FILE must mention `docs/knowledge` somewhere."
  It scored GREEN on four of the six misroutes a human had already found by hand — every one of
  them lives in a file that names the bundle elsewhere. That is why the shipped rule is LINE-local.
- **Line-local rule (shipped): 24 findings**, below, verbatim.

    FAIL okf_instructions_fence: the instruction layer teaches the retired state layer with no bundle branch (okf-integration-close-f4 f4-6)
      hooks/bee-session-close.mjs:106 names docs/specs/
        // docs/specs/ is a PRODUCT doc tree — resolve against the product root so the
      hooks/bee-session-close.mjs:108 names docs/specs/
        // workshop-side docs/specs/ (GitHub #14).
      hooks/bee-session-close.mjs:112 names docs/specs/
        // okf-foundation D34: knowledge migrates out of docs/specs/ area by area
      hooks/bee-session-close.mjs:117 names docs/specs/
        // docs/specs/ keeps its historical flat scan.
      hooks/bee-session-close.mjs:168 names docs/specs/
        "area spec under docs/specs/ — a settled outcome may exist only in the decision log " +
      skills/bee-compounding/references/compounding-reference.md:77 names docs/history/learnings/critical-patterns.md
        Only lessons passing all three criteria (multi-feature relevance, meaningful waste prevented, generalizable) get a summary block appended to `docs/history/learnings/critical-patterns.md`:
      skills/bee-exploring/SKILL.md:29 names docs/history/learnings/critical-patterns.md
        - Read `docs/history/learnings/critical-patterns.md` and `.bee/state.json` if present.
      skills/bee-grooming/references/grooming-reference.md:20 names docs/specs/
        | stale specs | areas with a `behavior_change: true` cell capped after the area spec's `updated` frontmatter date, or with such a cell and no spec at all (map cells to areas by files touched); ALSO areas whose Pointers / reading-map locations have git commits or uncommitted changes after `updated` even with no cell — vibe edits outside the chain count too (decision 0003); count each area once | capped cell files + `git log --since=<updated> -- <paths>` + `git status --porcelain` vs `docs/specs/<area>.md` frontmatter |
      skills/bee-grooming/references/grooming-reference.md:55 names docs/specs/
        | What is this system? | `docs/specs/system-overview.md` | run `bee-scribing` **bootstrap** (offers a provable-facts skeleton for the missing map, D2) |
      skills/bee-grooming/references/grooming-reference.md:56 names docs/specs/
        | How is it organized? | `docs/specs/reading-map.md` | run `bee-scribing` **bootstrap** (writes the missing reading-map skeleton, D2) |
      skills/bee-hive/SKILL.md:67 names docs/history/learnings/critical-patterns.md
        Then read `docs/history/learnings/critical-patterns.md` and surface recent active decisions (`node .bee/bin/bee.mjs decisions active --recent 3`).
      skills/bee-hive/SKILL.md:167 names docs/history/learnings/critical-patterns.md
        7. `docs/history/learnings/critical-patterns.md` and recent active decisions are mandatory context before planning or executing.
      skills/bee-hive/SKILL.md:187 names docs/history/learnings/critical-patterns.md
        - `docs/history/learnings/critical-patterns.md` — mandatory pre-work reading
      skills/bee-planning/SKILL.md:62 names docs/history/learnings/critical-patterns.md
        3. `docs/history/learnings/critical-patterns.md` — already digested from the preamble; re-read for the feature's area as needed.
      skills/bee-scribing/SKILL.md:36 names docs/specs/
        | **bootstrap** | `docs/specs/` lacks `system-overview.md` or `reading-map.md` — typically right after onboarding | **offer — never auto-run** (D2 of harness10) a bounded skeleton pass creating ONLY the missing map file(s) from mechanically provable facts; an existing map file is never touched. Full binding rules + skeleton shapes: the reference's Bootstrap section |
      skills/bee-scribing/SKILL.md:121 names docs/specs/
        - UI areas: refresh the settled snapshot under `docs/specs/visuals/<area>/` when the screen visibly changed (ask the user for one if you cannot produce it); a UI area with no current snapshot records that as an Open Gap, never silently (decision 0003).
      skills/bee-scribing/SKILL.md:162 names docs/specs/
        `docs/specs/reading-map.md`: add lines for locations created or repurposed, fix lines made wrong, delete lines for removed locations. One line each; a map, not documentation.
      skills/bee-scribing/SKILL.md:206 names docs/specs/
        - a UI screen that visibly changed while its snapshot under `docs/specs/visuals/` did not (and no Open Gap says why)
      skills/bee-scribing/references/scribing-reference.md:24 names docs/specs/
        Path: `docs/specs/<area>.md`. Area name: kebab-case, chosen at first write, stable thereafter. Overwrite/merge freely — this file always describes *now*; history lives in git and `docs/history/`.
      skills/bee-scribing/references/scribing-reference.md:26 names docs/specs/
        `docs/specs/` holds ONLY this layer's content: area specs, `system-overview.md`, `reading-map.md`, `visuals/`. Never write other artifacts (scripts, exports, survey notes) here; when found, flag them for grooming to relocate — they pollute coverage counting and spec scans.
      skills/bee-scribing/references/scribing-reference.md:155 names docs/specs/
        - **Locate before create:** resolve every delta to an existing spec via `docs/specs/reading-map.md` (and a scan of `docs/specs/*.md` frontmatter/Pointers) before considering a new file. A renamed screen, moved route, or refactored module is still the SAME area — update its spec and its reading-map line; do not fork a new one. Creating is the exception, reserved for genuinely new surfaces.
      skills/bee-scribing/references/scribing-reference.md:232 names docs/specs/
        Path: `docs/specs/system-overview.md`. One file, singular — the cross-area glue no per-area spec owns. Same write discipline as any spec (present tense, overwrite to match reality, tech-agnostic above Pointers, never fork). Fresh sessions read it FIRST, before any area spec.
      skills/bee-scribing/references/scribing-reference.md:284 names docs/specs/
        Path: `docs/specs/reading-map.md`. One line per location, grep-friendly:
      skills/bee-swarming/SKILL.md:34 names docs/history/learnings/critical-patterns.md
        - `docs/history/learnings/critical-patterns.md` has been read when present.
      24 unbranched misroute(s) — add the branch on the line, or cite an anchor if the reference is a legacy citation.
