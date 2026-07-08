# Continue plan cho Symflow

Tài liệu này tóm tắt các phần đang là mock, TODO hoặc còn thiếu để tiếp tục phát triển.

## 1. Các phần đang dùng mock / giả lập

- Frontend web đã tách rõ adapter production và adapter mock:
  - Production ở [services/symflow-web/src/lib/api/http.ts](services/symflow-web/src/lib/api/http.ts)
  - Mock ở [services/symflow-web/src/lib/api/mock.ts](services/symflow-web/src/lib/api/mock.ts)
  - Bộ chọn mode ở [services/symflow-web/src/lib/api/client.ts](services/symflow-web/src/lib/api/client.ts) và [services/symflow-web/src/lib/api/mode.ts](services/symflow-web/src/lib/api/mode.ts)
  - Dùng để demo UI và navigation khi bật `PUBLIC_API_MODE=mock`
- Mock data hiện có một flow demo hardcoded và dữ liệu run giả lập.
  - Dễ dùng cho thử nghiệm giao diện, nhưng chưa đại diện cho hệ thống thật.

## 2. Các TODO / phần cần hoàn thiện

- README API ghi rõ cần hoàn thiện persistence/hydration cho history run trong [services/symflow-api/README.md](services/symflow-api/README.md).
- Desktop app vẫn là placeholder trong [services/symflow-desktop/README.md](services/symflow-desktop/README.md).
- CORS hiện đang cho phép mọi origin trong API; cần tighten trước khi expose ra mạng.
- API server còn có TODO nhẹ về bảo mật và hardening trong [services/symflow-api/src/main.rs](services/symflow-api/src/main.rs).

## 3. Điểm thiếu sót đáng ưu tiên

- Chưa có logic persistence đầy đủ cho run history và replay log.
- Cần thêm unit test cho các luồng backend chính: lưu flow, trigger run, lấy run detail, và parse log realtime.
- Cần cân nhắc thêm test tích hợp cho API client HTTP nếu muốn khóa chặt contract request/response hơn.

## 4. Gợi ý ưu tiên tiếp theo

1. Tách riêng mock mode và production mode cho web.
2. Hoàn thiện persistence cho runs và logs.
3. Thêm unit test cho API client, mock layer và flow execution flow.
4. Xác định rõ scope cho desktop app hoặc bỏ placeholder.
5. Củng cố bảo mật và CORS trước khi expose dịch vụ ra mạng.

## 5. Ghi chú

- File [.gitignore](.gitignore) đã được cập nhật để bỏ qua các artifact build, cache và file môi trường không nên commit.
- Web package đã thêm test coverage ban đầu cho mode resolver và mock API layer.
