# GH #32 — draft closure comment (DO NOT POST — orchestrator posts at feature close)

**Vấn đề gốc:** decision log có 411 events / ~322KB, `decisions search` chỉ là substring `.includes` trên `decision`/`rationale`/`alternatives`, không có filter theo tag/area/date, không có index, không có archive — recall không có gì đảm bảo ở scale này.

**Đã ship (decision-propagation slice 1-2, dp-1..dp-9):**

- **Structured recall — tags/scope/since filters** (`91e3329`): `decide` events có thêm `tags[]`; `decisions search` nhận `--tag`, `--scope`/`--area`, `--since`; `--text` không còn bắt buộc khi đã có filter cấu trúc.
- **Archive verb** (`df76756`): `decisions archive` chuyển event superseded/redacted/aged-out sang `.bee/decisions-archive.jsonl`, giữ file active gọn; `search --all` union cả archive.
- **Taxonomy + write-time classification bắt buộc** (`f822567`): `docs/decisions/taxonomy.json` là vocabulary canonical; `decisions log` refuse event không tag một khi taxonomy tồn tại (bootstrap-safe — chưa có taxonomy thì chỉ warn); tag lạ được chấp nhận và tự thêm vào `candidates`. Kèm ranked multi-term search (`--text` OR nhiều từ, xếp hạng theo hit-count) và `--untagged` để đo độ hoàn chỉnh.
- **Retro-tag toàn bộ 406 legacy event** (`8a802ad`, patch `746d51a`): backfill classification cho mọi event cũ, đọc-time overlay merge (không rewrite jsonl) — `search --untagged` giờ về 0.
- **Index promote thành recall surface đảm bảo** (`34ce04d`): `docs/decisions/index.md` render từ store, group theo scope→tag, `--check` để phát hiện drift; không còn là tài liệu "tiện" mà là bề mặt recall complete-by-construction.

**Bằng chứng end-to-end (dp-9, cùng slice):** một supersede thật trên decision `d20f4c96` (release-not-tagged giờ đã lỗi thời vì v1.7.10-rc đã tag ở `4f23f89`) chạy qua toàn bộ pipeline — sweep tìm đúng 2 hit trong `docs/decisions/index.md`, index re-render loại decision cũ và show decision mới (`257ab1e5`) đúng group `workflow-state`/tag `release,ci`; `decisions search --tag release --json` trả về ngay event mới. Chi tiết đầy đủ: `docs/history/decision-propagation/reports/e2e-supersede.md`.

**Kết luận:** recall giờ có 3 lớp đảm bảo thay vì chỉ substring grep: filter cấu trúc (tag/scope/since) + index derived-complete + archive tách riêng event cũ. Không cần thêm memory layer/embedding — deferred lại theo D8c, chỉ revisit nếu recall có cấu trúc vẫn miss trong thực tế.

**Commits:** `91e3329`, `f822567`, `97c12a6`, `df76756`, `34ce04d`, `8a802ad`, `746d51a`.
