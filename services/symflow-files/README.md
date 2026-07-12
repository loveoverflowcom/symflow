# symflow-files

Minimal file upload and static file serving service for Symflow.

## What it does

- `POST /upload` accepts `multipart/form-data` with a `file` field.
- Uploaded files are written to `UPLOADS_DIR`.
- `GET /files/<filename>` serves files directly from disk.

## Configuration

- `FILES_PORT` defaults to `3200`
- `UPLOADS_DIR` defaults to `./uploads`
- `PUBLIC_BASE_URL` defaults to `http://localhost:<port>`

## Run locally

```bash
cd services/symflow-files
cargo run
```
