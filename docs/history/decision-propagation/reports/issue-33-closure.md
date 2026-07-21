# GH #33 — draft closure comment (DO NOT POST — orchestrator posts at feature close)

**Vấn đề gốc (nguyên văn reporter):** "thay đổi chỉ rơi vào decision-log, KHÔNG lan ngược về artifact nguồn" — `decisions supersede` trước đây chỉ copy id cũ vào field `supersedes` của event mới; việc resolve là read-time filter trong `activeDecisions`. Không có gì động vào các artifact *thể hiện* decision cũ (backlog row, spec, CONTEXT/plan) — mỗi session mới đọc artifact vẫn suy ra kết luận đã chết.

**Đã ship (decision-propagation dp-2, commit `f367f70`):**

- **Propagation sweep bắt buộc mỗi lần supersede:** `decisions supersede` giờ scan toàn bộ `docs/**` (backlog, specs, history CONTEXT/plan, docs/decisions) tìm id bị supersede (cả full UUID lẫn short8), trả về hit list ngay trong output của lệnh.
- **Reconcile cùng turn hoặc waive tường minh:** mỗi hit phải được sửa artifact ngay trong turn đó để phản ánh sự thật hiện tại, hoặc waive có lý do — không được im lặng bỏ qua.
- **Capture stub mỗi hit:** mỗi hit sinh một stub riêng (`source: supersede-sweep`) để flush sau nếu chưa reconcile kịp trong turn — không mất dấu.
- **Tag/scope inheritance** (D6): supersede event tự kế thừa tag/scope của decision bị thay thế nếu không truyền `--tags`/`--scope`, nên event mới vẫn group đúng chỗ trong index.
- **Citation discipline** (D3): artifact nào cite decision phải cite bằng short8 — đây là điều kiện để sweep tìm ra được; sweep chỉ với tới cái được cite, không phải một graph store lưu riêng (giữ đúng nguyên tắc D5: không graph, không daemon nền).

**Bằng chứng chạy thật, không phải giả lập (dp-9):** supersede decision `d20f4c96` ("release NOT tagged") bằng decision mới xác nhận v1.7.10-rc đã tag tại `4f23f89` (rc-1..5, CI xanh cả 2 platform ở đúng tag, run `29811023459`/`29811023424`). Sweep tìm ra đúng 2 hit trong `docs/decisions/index.md`; 1 hit reconcile bằng re-render (entry cũ tự rụng khỏi index), 1 hit waive có lý do (citation nằm trong log event bất biến khác, không assert lại claim lỗi thời). Cả 2 stub được theo dõi đúng vòng đời (tạo → 1 flush, 1 waive-and-leave). Đầy đủ trong `docs/history/decision-propagation/reports/e2e-supersede.md`.

**Kết luận:** supersede giờ không chỉ là bản ghi log — nó buộc phải lan ngược về artifact nguồn cùng turn, có bằng chứng chạy trên decision thật trong chính repo này.

**Commits:** `f367f70` (cơ chế) + báo cáo e2e chạy thật ở trên (dp-9).
