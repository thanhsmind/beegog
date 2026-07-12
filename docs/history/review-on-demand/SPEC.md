# Spec: Review theo yêu cầu người dùng

## 1. Tóm tắt

Bee tách hai cơ chế bảo đảm chất lượng vốn đang bị gộp vào nhau:

- **Verification** chứng minh một đơn vị công việc vừa hoàn thành đáp ứng yêu cầu đã chốt. Đây là
  điều kiện bắt buộc của mọi cell và mọi feature.
- **Independent review** là một đợt kiểm duyệt tốn kém, dùng một nhóm reviewer độc lập để đọc toàn
  bộ thay đổi ở một mốc tích hợp, tương tự một team khác nhận PR hoặc release candidate để duyệt.
  Cơ chế này chỉ chạy sau yêu cầu rõ ràng của người dùng.

Bee không tự động gọi independent review khi một cell, slice hoặc feature hoàn thành. Người dùng chọn
thời điểm và phạm vi phù hợp: một feature, nhiều feature làm trong ngày, một diff cụ thể, hoặc toàn bộ
phần chưa được review kể từ mốc gần nhất.

Quyết định nguồn: `565e68d0-327f-404e-b49e-d1c61ba81bfd`.

## 2. Vấn đề cần giải quyết

Review hiện tại có chi phí gần giống một team kiểm duyệt thứ hai: nhiều reviewer độc lập, model mạnh,
tổng hợp findings, kiểm tra artifact, UAT và Gate 4. Khi nó tự chạy sau mọi feature, chi phí thời gian
và token có thể lớn hơn chính phần implementation, nhất là với các thay đổi tiny hoặc small.

Review quá thường xuyên còn làm mất lợi thế quan trọng nhất của review tích hợp: nhìn thấy tương tác
giữa nhiều thay đổi được làm trong cùng một buổi, một ngày, hoặc một release candidate.

Hệ thống cần giữ nguyên bằng chứng kỹ thuật bắt buộc ở từng đơn vị công việc, nhưng chuyển full review
thành một hoạt động độc lập do người dùng chủ động gọi.

## 3. Mục tiêu

1. Không tiêu tốn reviewer token nếu người dùng chưa yêu cầu review.
2. Cho phép development tiếp tục và feature đóng bình thường sau khi verification, scribing và
   compounding hoàn tất, dù feature chưa qua independent review.
3. Cho phép gom nhiều thay đổi đã hoàn thành thành một review batch có biên rõ ràng.
4. Luôn cho người dùng biết phần nào đã review, chưa review, hoặc đã thay đổi sau review.
5. Giữ nguyên chất lượng của full review khi nó được gọi: isolated reviewers, severity, artifact
   verification, UAT và Gate 4.
6. Không biến “review theo yêu cầu” thành “không còn verification” hoặc “được phép tuyên bố reviewed
   khi reviewer chưa chạy”.

## 4. Ngoài phạm vi

- Không bỏ verify command, test, verification evidence, frozen-judge check hoặc cell capping.
- Không giảm số reviewer hay đổi model của một full review; tối ưu panel là một quyết định riêng.
- Không tự động review theo lịch, theo cuối ngày, theo số cell hoặc theo kích thước diff.
- Không coi self-review của worker là independent review.
- Không tự động merge, release hoặc tuyên bố an toàn chỉ vì implementation đã hoàn thành.

## 5. Thuật ngữ và trạng thái

| Thuật ngữ | Nghĩa |
|---|---|
| Completed change | Cell hoặc feature đã hoàn thành verification bắt buộc và có evidence hợp lệ. |
| Review candidate | Completed change chưa được một review session bao phủ ở đúng phiên bản hiện tại. |
| Review scope | Tập thay đổi bất biến mà người dùng yêu cầu reviewer kiểm tra. |
| Review baseline | Điểm bắt đầu của diff thuộc review scope. |
| Review head | Điểm kết thúc của diff thuộc review scope. |
| Review session | Một lần full independent review được tạo từ một yêu cầu rõ ràng của người dùng. |
| Unreviewed | Thay đổi đã hoàn thành nhưng chưa nằm trong một review session được duyệt. |
| In review | Review session đang chạy hoặc đang chờ xử lý findings/UAT. |
| Reviewed | Đúng phiên bản thay đổi đã nằm trong scope của review session hoàn tất và được duyệt. |
| Review stale | Nội dung đã từng reviewed nhưng có thay đổi mới sau review head; chỉ phần coverage cũ còn giá trị. |

Review status độc lập với implementation status. “Completed” không đồng nghĩa với “reviewed”, và
“unreviewed” không đồng nghĩa với “verification failed”.

## 6. Quy tắc nghiệp vụ

### R1 — Full review chỉ chạy theo yêu cầu rõ ràng

Bee chỉ tạo reviewer wave khi người dùng dùng một ý định rõ ràng như:

- “review phần này”;
- “review toàn bộ việc hôm nay”;
- “kiểm tra độc lập feature A và B”;
- “review diff từ X đến Y”;
- “review tất cả phần chưa review trước khi release”.

Việc một cell, slice, feature, ngày làm việc hoặc verification vừa kết thúc không phải review trigger.
Một yêu cầu “merge”, “ship” hoặc “release” cũng không được âm thầm chuyển thành reviewer token spend;
Bee phải báo trạng thái review và xin một quyết định rõ ràng nếu người dùng chưa trực tiếp yêu cầu
review.

### R2 — Verification luôn bắt buộc

Mọi cell vẫn phải chạy verify command thật, ghi output/evidence và đáp ứng điều kiện cap hiện hành.
Behavior change vẫn phải có before-state hoặc deliberate exception theo lane. Việc bỏ auto-review
không được làm yếu bất kỳ điều kiện completion nào.

### R3 — Feature đóng được mà không cần full review

Sau khi execution hoàn tất, workflow tiếp tục qua scribing và compounding mà không tự chuyển sang
reviewing. Feature được đóng với nhãn review rõ ràng là `unreviewed` nếu chưa có review session bao
phủ nó. Việc này giải phóng active feature để development tiếp tục và cho phép tích lũy review
candidates cho một batch sau.

### R4 — Người dùng sở hữu review boundary

Người dùng có thể chọn một trong các loại scope:

1. feature hiện tại hoặc một feature được nêu tên;
2. danh sách feature/cell được nêu tên;
3. toàn bộ completed changes chưa review kể từ review baseline gần nhất;
4. khoảng thay đổi có điểm đầu và điểm cuối rõ ràng;
5. tập thay đổi hoàn thành trong một khoảng thời gian, sau khi Bee phân giải tập đó thành danh sách
   và diff bất biến.

Nếu câu yêu cầu chưa xác định được scope, Bee hỏi đúng một câu về boundary trước khi dispatch.
Nếu scope đã rõ, Bee không hỏi lại chỉ để xin phép lần hai.

### R5 — Scope được đóng băng trước khi reviewer chạy

Trước dispatch, Bee hiển thị ngắn gọn:

- các feature/cell được bao phủ;
- baseline và head;
- phần bị loại khỏi scope;
- số reviewer dự kiến và reviewer điều kiện nào được kích hoạt;
- review model/tier hoặc external executor sẽ dùng;
- cảnh báo khi scope quá lớn hoặc thiếu verification evidence.

Review session lưu scope bất biến. Commit hoặc cell phát sinh sau review head không được tự nhận là
reviewed.

### R6 — Không review lại nội dung không đổi

Bee không dispatch lại full panel cho một scope đã reviewed và không đổi, trừ khi người dùng yêu cầu
re-review. Khi có thay đổi mới sau review, chỉ delta mới mang trạng thái unreviewed/stale.

### R7 — High-risk không được âm thầm kích hoạt review

Auth, authorization, audit/security, migration, data loss, external provider và các hard-gate khác
vẫn không được tự động chạy review. Bee phải:

- hiển thị cảnh báo nổi bật rằng thay đổi high-risk chưa qua independent review;
- nêu rõ hậu quả nếu merge/release ở trạng thái đó;
- đề nghị người dùng gọi review;
- không gắn nhãn reviewed hoặc approved nếu người dùng không gọi.

Quyền quyết định chi phí và thời điểm gọi reviewer vẫn thuộc người dùng.

### R8 — Gate 4 chỉ thuộc review session

Gate 4, review findings, review UAT và câu hỏi approve merge chỉ xuất hiện sau khi người dùng đã gọi
review. Không có “Gate 4 rỗng” hoặc Gate 4 tự động sau một feature không được review.

P1 trong review session vẫn block việc duyệt session. P2/P3 vẫn được ghi lại theo contract hiện hành.
Gate bypass không được tự tạo review session.

### R9 — Sửa findings dùng delta review

Sau khi sửa một finding, Bee re-review phần delta của fix và quét toàn bộ defect class mà finding đại
diện. Không bắt buộc chạy lại toàn panel cho toàn batch nếu fix không làm thay đổi boundary hoặc mở
rộng rủi ro. Nếu fix chạm boundary khác, thay đổi public contract hoặc làm scope cũ mất ổn định, Bee
phải đề nghị mở rộng re-review.

### R10 — Trạng thái luôn trung thực và truy vết được

Mỗi completed change phải trả lời được:

- verification đã pass bằng evidence nào;
- có thuộc review session nào không;
- review bao phủ phiên bản/range nào;
- có thay đổi mới khiến coverage stale không;
- có findings nào còn mở không.

Các status summary phải phân biệt rõ `verified`, `unreviewed`, `in review`, `reviewed`, và
`review stale`.

## 7. Luồng hành vi

### 7.1 Hoàn thành một công việc mà không gọi review

1. Worker hoàn tất implementation.
2. Verify chạy và evidence được ghi vào cell trace.
3. Cell được cap.
4. Khi feature hết execution work, Bee chạy scribing và compounding theo contract.
5. Feature đóng; không reviewer nào được spawn.
6. Bee báo: implementation đã verified, independent review chưa được yêu cầu, và thay đổi đã được
   thêm vào review candidates.

### 7.2 Người dùng gọi review một feature

1. Bee phân giải feature thành completed cells và diff chính xác.
2. Bee kiểm tra mọi behavior-change cell có verification evidence hợp lệ.
3. Bee hiển thị review scope preview.
4. Reviewer wave chạy theo contract của full review.
5. Findings được tổng hợp và phân severity.
6. P1 được sửa và delta re-review; P2/P3 được ghi lại.
7. Người dùng thực hiện UAT trong scope.
8. Gate 4 quyết định review session được duyệt hay chưa.
9. Coverage của đúng baseline/head được ghi là reviewed.

### 7.3 Người dùng gọi review một batch

1. Bee liệt kê các review candidates phù hợp với yêu cầu.
2. Bee tạo một cumulative diff và mapping từ mỗi phần diff về feature/cell nguồn.
3. Reviewer đọc cumulative diff để thấy lỗi tương tác giữa các thay đổi.
4. Finding phải chỉ ra phần bị ảnh hưởng và feature/cell liên quan nếu xác định được.
5. Khi session được duyệt, toàn bộ candidates trong scope nhận cùng review-session reference.

### 7.4 Người dùng yêu cầu merge/release khi còn phần unreviewed

1. Bee không tự dispatch reviewer.
2. Bee nêu số lượng và risk level của phần unreviewed/stale.
3. Bee hỏi người dùng có muốn tạo review session cho scope đó không.
4. Chỉ câu trả lời đồng ý rõ ràng mới khởi chạy review.
5. Nếu người dùng không gọi review, Bee giữ nguyên nhãn unreviewed và không mô tả thay đổi là
   review-approved.

### 7.5 Có development đang chạy khi người dùng gọi review

Bee không ghi đè active work hoặc làm mất handoff. Nó chỉ review một immutable scope đã hoàn thành.
Phần đang claimed/open bị loại khỏi scope và được nêu rõ. Nếu runtime không thể giữ review session và
active feature đồng thời, Bee phải lưu/preserve active state trước khi vào review và khôi phục đúng
trạng thái sau đó; không được tự cap, drop hoặc giả định phần đang làm đã hoàn tất.

## 8. Yêu cầu dữ liệu và truy vết

Một review session tối thiểu lưu:

| Trường | Yêu cầu |
|---|---|
| review id | Định danh ổn định, không tái sử dụng. |
| requested by / requested at | Chứng minh đây là yêu cầu người dùng và thời điểm yêu cầu. |
| scope description | Cách người dùng mô tả boundary. |
| included work | Danh sách feature/cell/commit thuộc scope. |
| excluded work | Phần liên quan nhưng chưa hoàn thành hoặc chủ động loại khỏi scope. |
| baseline / head | Hai mốc bất biến dùng để dựng diff. |
| reviewer manifest | Reviewer, model/tier/executor thực tế đã dispatch. |
| verification preflight | Kết quả kiểm tra evidence trước review. |
| findings | Severity, evidence, trạng thái và fix/re-review reference. |
| UAT | Item, pass/fail/skip và lý do skip nếu có. |
| decision | pending, blocked hoặc approved; kèm Gate 4 record. |

Review coverage không được suy ra chỉ từ ngày hoặc tên feature. Nó phải gắn với immutable baseline/head
hoặc tập content identity tương đương để phát hiện stale coverage.

## 9. Hiển thị cho người dùng

### Sau completion không review

> Hoàn thành và verified: 4 cells. Independent review chưa được yêu cầu; 4 cells đang chờ trong review candidates.

### Trước một review batch

> Chuẩn bị review 3 feature / 11 cells, từ `<baseline>` đến `<head>`. Dự kiến 4 core reviewers + 1 reviewer điều kiện. Không gồm 1 cell đang làm dở.

### High-risk chưa review

> Cảnh báo: scope có thay đổi high-risk và chưa qua independent review. Bee sẽ không tự gọi reviewer. Hãy yêu cầu review trước khi merge/release nếu muốn có review approval.

### Scope đã review nhưng có delta mới

> Review trước vẫn bao phủ đến `<old-head>`; 2 commits mới đang unreviewed. Trạng thái hiện tại: review stale.

## 10. Acceptance scenarios

### A1 — Tiny task không phát sinh reviewer spend

Given một tiny feature có cell đã verify và cap, when execution kết thúc mà người dùng không nói
review, then không có reviewer dispatch, feature vẫn đi qua scribing/compounding và đóng với trạng thái
unreviewed.

### A2 — Standard feature cũng không auto-review

Given một standard feature hoàn thành, when không có explicit review request, then workflow không tự
chuyển vào reviewer wave hoặc Gate 4.

### A3 — High-risk cảnh báo nhưng không tự chạy

Given completed changes chứa hard-gate risk, when user chưa gọi review, then Bee hiển thị cảnh báo
high-risk, không spawn reviewer và không gắn nhãn approved.

### A4 — Explicit single-feature review

Given feature A đã hoàn thành và unreviewed, when user nói “review feature A”, then scope chỉ chứa
completed content của A, preview xuất hiện và full review chạy.

### A5 — Explicit batch review

Given A, B và C đều completed/unreviewed, when user nói “review toàn bộ phần hôm nay”, then Bee phân
giải và hiển thị danh sách A/B/C cùng immutable range, rồi reviewer đọc cumulative diff một lần.

### A6 — Không đưa work đang dở vào scope

Given A completed và B còn cell claimed, when user gọi review mọi thay đổi, then A được đưa vào scope,
B bị loại với lý do “in progress”, và state của B không thay đổi.

### A7 — Không review trùng

Given range X..Y đã approved và không đổi, when user không yêu cầu re-review, then Bee không dispatch
reviewer lại cho X..Y.

### A8 — Coverage stale sau thay đổi mới

Given X..Y đã reviewed, when commit Z thay đổi nội dung sau Y, then X..Y vẫn có audit trail nhưng trạng
thái tổng thể báo có unreviewed delta Y..Z; Z không thừa hưởng approval.

### A9 — Merge request không phải silent trigger

Given có unreviewed changes, when user nói “merge đi” nhưng chưa yêu cầu review, then Bee báo scope
unreviewed và hỏi có chạy review không; chưa có câu trả lời rõ ràng thì reviewer không chạy.

### A10 — Verification vẫn fail closed

Given một behavior-change cell thiếu evidence, when user gọi review batch chứa cell đó, then preflight
dừng trước reviewer spend và trả lỗi evidence; review không được dùng để bù cho verification bị thiếu.

### A11 — P1 vẫn block review approval

Given reviewer tìm thấy P1, when synthesis hoàn tất, then review session ở trạng thái blocked và không
được approved cho tới khi fix cùng delta re-review pass.

### A12 — Fix nhỏ không ép chạy lại toàn batch

Given một P1 có concrete localized fix, when fix pass và defect-class sweep hoàn tất, then relevant
delta được re-review; full panel chỉ chạy lại nếu risk/boundary mở rộng.

## 11. Migration từ workflow hiện tại

1. Tách “execution complete” khỏi “review approved”; không dùng review gate làm điều kiện để feature
   đi tiếp tới scribing/compounding.
2. Giữ dữ liệu review cũ làm audit history; mọi feature cũ đã qua Gate 4 vẫn là reviewed ở range cũ.
3. Feature đã hoàn thành nhưng không có review record được đánh dấu unreviewed, không tự tạo review giả.
4. Phiên đang ở phase reviewing khi nâng cấp không được tự bỏ qua. Nó tiếp tục theo contract cũ hoặc
   được người dùng chủ động hủy; migration không sửa lịch sử giữa chừng.
5. Status/preamble/next-action không còn luôn đề xuất `bee-reviewing` sau execution; nó báo số review
   candidates và chờ user intent.

## 12. Bề mặt triển khai dự kiến

Team triển khai phải xác nhận phạm vi thật trong planning/validation, nhưng tối thiểu cần rà soát:

- `skills/bee-reviewing/` — đổi từ automatic chain stage thành user-invoked inspection session.
- `skills/bee-hive/` — routing, phase/gate contract và recommended-next behavior.
- `skills/bee-swarming/` — handoff sau final slice không tự ép vào review.
- `skills/bee-scribing/` và `skills/bee-compounding/` — cho phép feature close với truthful unreviewed status.
- `.bee/bin/` cùng template nguồn — state/status helpers, review coverage và candidate reporting.
- `AGENTS.md` managed Bee block và các runtime projections — chain diagram và Gate 4 wording.
- Tests — tất cả acceptance scenarios A1–A12, đặc biệt zero-dispatch khi không có user intent và
  stale coverage khi có delta mới.

## 13. Definition of done

Thay đổi chỉ được coi là hoàn thành khi:

- A1–A12 đều có automated evidence hoặc, với UAT-only behavior, một kịch bản kiểm tra ghi được;
- một tiny, một standard và một high-risk fixture đều chứng minh không có reviewer dispatch trước
  explicit request;
- một batch gồm nhiều completed features được review bằng một immutable cumulative scope;
- status luôn phân biệt verified và reviewed;
- existing full-review quality contract vẫn hoạt động nguyên vẹn sau explicit request;
- onboarding/update đồng bộ contract mới sang repo đích mà không làm mất review history cũ;
- tài liệu workflow và managed AGENTS block không còn nói review tự chạy sau mọi final swarm slice.

