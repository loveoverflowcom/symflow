# Symflow Web (SvelteKit + TypeScript)

Web UI with username/password authentication for managing flows, editing and formatting the JSON DSL, and watching run execution/logs.

## Features

- `GET /flows`: list flow definitions
- `GET /flows/new`: create a flow
- `GET /flows/[id]`: edit a flow DSL and trigger run
- `GET /runs/[id]`: inspect run status, steps, and ReAct logs
- `GET /login`: sign in
- `GET /register`: create an account

## Run (real backend)

1. Copy env:
   - `cp .env.example .env`
2. Ensure `PUBLIC_USE_MOCK_API=false`
3. Start app:
   - `npm install`
   - `npm run dev`

By default the app calls `/api/*` on the same origin. In local dev, Vite proxies that traffic and WebSockets to `http://127.0.0.1:8787`.

All API requests include credentials so the `HttpOnly` session cookie is sent. Set `PUBLIC_API_BASE_URL` only when the browser should call a different absolute backend URL directly, for example `http://localhost:8787`. Configure that frontend origin as `SYMFLOW_WEB_ORIGIN` on the API; production requires HTTPS with `SYMFLOW_COOKIE_SECURE=true`.

## Run (mock mode)

Use this if the API server is not ready yet:

- `npm run dev:mock`

This uses an authenticated stub user plus in-memory mocked flows/runs so you can test full UI navigation and interactions.

## Checks

- `npm run check`
- `npm run build`
