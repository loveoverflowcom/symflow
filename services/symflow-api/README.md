# symflow-api

HTTP API server cho Symflow.

## Hiện tại

- Chạy bằng `axum`
- Lưu flow/run và tài khoản/session trong PostgreSQL
- Đăng ký, đăng nhập và đăng xuất bằng session cookie `HttpOnly`
- Validate JSON DSL trước khi lưu
- Chuẩn hóa `dsl_script` thành pretty-printed JSON trước khi lưu
- Trigger run nền bằng `symflow-core`
- Stream log realtime qua WebSocket

## Endpoints chính

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
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

- `DATABASE_URL` là bắt buộc khi authentication được bật. Service tự chạy migrations trong `packages/symflow-store/migrations`.
- Chỉ local flow-only dev mới dùng `SYMFLOW_AUTH_DISABLED=1`; chế độ này dùng memory store và bỏ qua auth.
- Các route flow/run yêu cầu session hợp lệ. `GET /health` và auth register/login vẫn public.

### Authentication

Username phải khớp `^[a-zA-Z0-9._-]{3,20}$`; password phải khớp `^\S{8,32}$`. Username được lưu lowercase, password được hash bằng Argon2id và không bao giờ được trả về API.

Session mặc định sống 14 ngày. Các biến cấu hình:

- `SYMFLOW_SESSION_COOKIE` — mặc định `symflow_session`
- `SYMFLOW_SESSION_TTL_SECS` — mặc định `1209600`
- `SYMFLOW_COOKIE_SECURE` — đặt `true` khi chạy HTTPS production
- `SYMFLOW_WEB_ORIGIN` — origin được phép gửi credential qua CORS, mặc định `http://localhost:5173`

### Định dạng DSL

`dsl_script` là chuỗi JSON. API tạm thời nhận flow YAML cũ để hỗ trợ chuyển đổi, nhưng mọi lần lưu đều ghi lại dưới dạng JSON:

```json
{
  "name": "Manual Echo",
  "dsl_script": "{\n  \"flow_id\": \"manual-echo\",\n  \"name\": \"Manual Echo\",\n  \"steps\": [\n    {\n      \"id\": \"receive_input\",\n      \"type\": \"manual_trigger\",\n      \"with\": {\n        \"message\": \"Hello\"\n      }\n    }\n  ]\n}"
}
```

### Chuyển dữ liệu YAML trong PostgreSQL

Sao lưu và chuyển đổi một lần trước khi tắt hỗ trợ YAML:

```bash
cd services/symflow-api
DATABASE_URL=postgres://... \
  cargo test --test migrate_flow_dsl_json migrate_flow_dsl_json -- --ignored --exact --nocapture
```

Ignored migration test tạo bảng backup có timestamp `flows_dsl_script_backup_<timestamp>` trước khi cập nhật. Để rollback, lấy tên bảng được in ra và chạy:

```sql
UPDATE flows AS f
SET dsl_script = b.dsl_script
FROM flows_dsl_script_backup_<timestamp> AS b
WHERE f.id = b.id;
```

## TODO

- Thêm rate limiting cho register/login.
- Hoàn thiện lớp persistence/hydration cho run history đầy đủ hơn.

## Chạy local

Mặc định bind `127.0.0.1:8787`.
Có thể đổi bằng `SYMFLOW_API_ADDR` hoặc `BIND_ADDR`.

### Dev với cargo-make

Cài task runner một lần:

```bash
cargo install --force cargo-make
```

Chạy API local và tự bật Postgres bằng Compose. Task tự nhận `docker compose`, `podman-compose`, hoặc `podman compose`:

```bash
cd services/symflow-api
cargo make api-dev
```

Task này dùng database local mặc định `postgres://symflow:symflow@127.0.0.1:5432/symflow?sslmode=disable`. Nếu cần đổi riêng cho dev, set `SYMFLOW_API_DEV_DATABASE_URL`.

Nếu muốn chạy flow-only bằng `MemoryStore`, không cần Postgres và auth sẽ bị tắt rõ ràng:

```bash
cd services/symflow-api
cargo make api-memory
```
