# onboard-codex-hooks — standard

## Yêu cầu (user, 2026-07-14)
Bộ cài/updater phải tự trang bị đầy đủ cho repo host:
1. **Codex hook wiring** — anphabe-gogl lộ lỗ hổng: hooks bee chỉ nối vào Claude
   (`.claude/settings.json`); Codex ở repo host chạy không guard vì thiếu
   `.codex/hooks.json`. Đã vá tay ở anphabe-gogl (commit 58ad7ee bên đó); giờ
   đưa vào onboarding để mọi project update là có.
2. **Docs skeleton** — các docs quan trọng của state layer (`docs/specs/reading-map.md`,
   `docs/specs/system-overview.md`) phải tồn tại sau onboard (skeleton, scribing sở hữu nội dung).

## Thiết kế
### 1. `.codex/hooks.json` (đi cùng --repo-hooks / sticky repo_hooks)
- `renderCodexHookEntries()` trong onboard_bee.mjs: bản chiếu repo-target đúng
  theo `hooks/catalog.mjs` (git-root transport + pinned diagnostic
  `bee: hook transport unavailable (no git root)`), nhưng đường dẫn host-repo
  `"$r"/.bee/bin/hooks/<hook>.mjs --source=repo`.
- KHÔNG gồm `bee-model-guard.mjs` — Claude-only theo catalog `ALLOWED_DIFFERENCES`.
- Merge kiểu `mergeRepoSettings`: giữ entry không phải bee, thay entry bee cũ,
  backup `.bak` khi file có sẵn. Action mới: `merge_codex_hooks`.
- Managed hash: thêm pseudo-entry `".codex/hooks.json"` vào `managed.repo_hooks`
  (không đổi subsetManaged).

### 2. Specs skeletons (mọi repo, create-only)
- Thiếu `docs/specs/reading-map.md` → tạo stub; thiếu `docs/specs/system-overview.md` → tạo stub.
- Action mới `create_specs_stub`, KHÔNG bao giờ ghi đè file có sẵn (scribing-owned).

### 3. Release
- Bump `BEE_VERSION` 0.1.35 → 0.1.36 (templates/lib/state.mjs) để skill sync
  đẩy bản mới xuống global skills và các repo host thấy changes_needed.

## Cells
1. `onboard-codex-hooks-1` — implement onboard_bee.mjs (+ tests trong test_onboard_bee.mjs). Verify: `node skills/bee-hive/scripts/test_onboard_bee.mjs` xanh.
2. `onboard-codex-hooks-2` — bump version 0.1.36, tự-onboard beegog + sync global skills, verify test toàn cục xanh.

## Ngoài phạm vi
- Status line Codex (`~/.codex/config.toml [tui]`) — config global per-machine, không thuộc onboarding per-repo.
- Trust hooks trong Codex: user phải bấm trust ở phiên Codex đầu tiên mỗi repo (Codex ghi trusted_hash vào `~/.codex/config.toml`) — installer không làm hộ được.
