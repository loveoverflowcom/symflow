# Symflow Test Data

Flow DSL examples live in `test-data/flows`.

Use them from the web UI by creating a new flow and pasting the JSON as the DSL script, or save them through the API.

For local-file examples, run the API from `services/symflow-api` with this sandbox directory:

```bash
cd services/symflow-api
SANDBOX_DIR=../../test-data/sandbox cargo make api-dev
```

Agent examples require an OpenAI-compatible LLM endpoint:

```bash
export LLM_API_KEY=...
export LLM_BASE_URL=https://api.openai.com/v1
```
