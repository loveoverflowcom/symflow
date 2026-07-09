# Symflow API local/container setup

Use `cargo-make` from `services/symflow-api` for local development.

## 1. Install cargo-make

```bash
cargo install --force cargo-make
```

## 2. Run local development

This starts Postgres with Compose and runs `symflow-api` on the host with `cargo`. The task auto-detects `docker compose`, `podman-compose`, or `podman compose`.

```bash
cd services/symflow-api
cargo make api-dev
```

Check health:

```bash
curl http://localhost:8787/health
```

## Container mode

Use this only when you want to build and run the API container too.

### 1. Copy environment file

```bash
cp services/symflow-api/container/.env.example services/symflow-api/container/.env
```

### 2. Start services

```bash
cd services/symflow-api
cargo make api-container-up
```

### 3. Stop services

```bash
cd services/symflow-api
cargo make api-container-down
```
