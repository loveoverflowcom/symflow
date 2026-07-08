# symflow-api

HTTP API server cho Symflow.

## Hiện tại

- Chạy bằng `axum`
- Lưu trạng thái bằng `MemoryStore`
- Validate DSL trước khi lưu
- Trigger run nền bằng `symflow-core`
- Stream log realtime qua WebSocket

## Endpoints chính

- `GET /health`
- `GET /api/flows`
- `POST /api/flows`
- `GET /api/flows/:id`
- `PUT /api/flows/:id`
- `DELETE /api/flows/:id`
- `POST /api/flows/:id/runs`
- `GET /api/runs`
- `GET /api/runs/:id`
- `GET /api/runs/:id/steps/:step_id`
- `GET /api/runs/:id/logs`
- `GET /api/agents`
- `GET /api/agents/:id`

## Database

- Nếu có `DATABASE_URL`, service sẽ dùng PostgreSQL và tự chạy migrations trong `packages/symflow-store/migrations`
- Nếu không có `DATABASE_URL`, service fallback về `MemoryStore`

## TODO

- Thêm auth/authorization nếu service được expose ra ngoài localhost.
- Hoàn thiện lớp persistence/hydration cho run history đầy đủ hơn.

## Chạy local

Mặc định bind `127.0.0.1:8787`.
Có thể đổi bằng `SYMFLOW_API_ADDR` hoặc `BIND_ADDR`.
