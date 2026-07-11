ITERATION 2: 5 still open, 2 new

F1 — STILL OPEN: [CONTEXT.md:28](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/CONTEXT.md:28) makes unknown a “version refusal” yet allows force for version refusals; [implement-plan.md:155](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/implement-plan.md:155) also implies an unidentifiable source is forceable. “Unknown never forceable” remains contradictory.

F2 — CLOSED: realpath identity is required in [approach.md:7](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/approach.md:7) and [cell 1:25](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-1.json:25).

F3 — STILL OPEN: [cell 2:23](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-2.json:23) covers helper-unknown and installed-skill-unknown, but lacks corrupt existing source → source unknown → refuse.

F4 — CLOSED: copied launcher execution is explicit in [approach.md:123](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/approach.md:123) and cells [1:25](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-1.json:25), [2:23](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-2.json:23).

F5 — STILL OPEN: production cells prohibit `BEE_SKILLS_TARGET`, but stale instructions still require a “target param/override” in [approach.md:89](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/approach.md:89), [plan.md:48](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/plan.md:48), and [implement-plan.md:157](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/implement-plan.md:157).

F6 — CLOSED: ancestor refusal, lstat-only traversal, unpredictable temps, and loud per-skill `blocked_symlink` skip are specified in [approach.md:15](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/approach.md:15) and [approach.md:46](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/approach.md:46).

F7 — STILL OPEN: machine cells are correctly ordered, but implementation-ready [plan.md:44](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/plan.md:44) still puts implementation before isolation and describes the obsolete three-cell graph.

F8 — CLOSED: native-worker-only dispatch and session-shell recheck are explicit in [approach.md:128](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/approach.md:128).

F9 — CLOSED: reporting is defined in [approach.md:59](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/approach.md:59) and explicitly asserted by [cell 2:23](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-2.json:23).

F10 — CLOSED: cell 3 deps are exactly `[skill-sync-1, skill-sync-2]` in [cell 3:6](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-3.json:6).

F11 — STILL OPEN: the brief’s graph was updated, but it still says “suite unchanged” and requires a cell-2 target override in [implement-plan.md:143](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/implement-plan.md:143) and [implement-plan.md:157](/home/thanhsmind/projects/goglbe/beegog/docs/history/skill-sync/implement-plan.md:157).

NEW BLOCKER 1 — Isolation invariant is impossible: [cell 0:17](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-0.json:17) freezes fake HOME byte-identical, while cell 1 intentionally writes skills beneath that HOME. Sharing HOME fails the snapshot; recreating it per spawn breaks recheck/idempotency.

NEW BLOCKER 2 — Safety proof is incomplete: [cell 1:25](/home/thanhsmind/projects/goglbe/beegog/.bee/cells/skill-sync-1.json:25) tests only a top-level skill symlink; neither cells 1 nor 2 explicitly tests nested symlinks or ancestor-overlap refusal with zero mutations.