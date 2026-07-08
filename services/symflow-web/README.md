# Symflow Web (SvelteKit + TypeScript)

Web UI for managing flows, editing DSL, and watching run execution/logs.

## Features

- `GET /flows`: list flow definitions
- `GET /flows/new`: create a flow
- `GET /flows/[id]`: edit a flow DSL and trigger run
- `GET /runs/[id]`: inspect run status, steps, and ReAct logs

## Run (real backend)

1. Copy env:
   - `cp .env.example .env`
2. Ensure `PUBLIC_USE_MOCK_API=false`
3. Start app:
   - `npm install`
   - `npm run dev`

Backend default target is `PUBLIC_API_BASE_URL=http://127.0.0.1:8787`.

## Run (mock mode)

Use this if the API server is not ready yet:

- `npm run dev:mock`

This uses in-memory mocked flows/runs so you can test full UI navigation and interactions.

## Checks

- `npm run check`
- `npm run build`
