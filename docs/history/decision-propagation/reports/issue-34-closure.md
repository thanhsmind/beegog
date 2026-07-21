# GH #34 — draft closure comment (DO NOT POST — orchestrator posts at feature close)

**Vấn đề gốc:** rule flip done trước đây bind vào "scribing run đóng một feature khớp với một backlog row → flip row đó thành done", không đối chiếu cột CoS (Condition of Satisfaction) với những gì feature thực sự giao. Kết quả: một feature chỉ giao một phần CoS của row vẫn khiến cả row bị flip thành done — done-flip sớm (premature done-flip).

**Đã ship (decision-propagation dp-8, commit `e750945`):**

- **Done-flip yêu cầu bằng chứng theo từng CoS clause (D1):** tại thời điểm flip (scribing sync hoặc compounding fallback), mọi clause trong cột CoS của row bị match phải được liệt kê kèm bằng chứng delivered có cite cụ thể. Clause nào không có bằng chứng → row KHÔNG được flip: giữ nguyên `in-flight`, và text CoS được bổ sung annotation `Delivered:`/`Remaining:` nêu rõ phần nào đã giao, phần nào chưa.
- **Cho phép tách row khi phần giao được là shippable độc lập** — nhưng silent full-flip trên partial delivery thì không bao giờ được phép.
- **Citation discipline giữ nguyên tắc mechanical-checkable, không phải "vibes":** rule vẫn là prose-ruled (kế thừa D7 của bee-scribing) nhưng giờ có checklist cơ học để kiểm tra được, không phải suy đoán chủ quan.

**Kết luận:** cơ chế flip giờ đọc đúng cột CoS đã có sẵn làm acceptance bar, thay vì chỉ nhìn "feature nào đó đã đóng khớp tên row" — đúng root cause #34 nêu: feature-done ≠ PBI-done.

**Commit:** `e750945`.
