# Guide: Username/Password Authentication (symflow-api + symflow-web)

> Implementation plan for sign-up, sign-in, and session-based auth with room to add Google/GitHub later.
>
> Scope: **username + password** → hashed in Postgres → **session id** cookie.
>
> Target crates: `packages/symflow-store`, `services/symflow-api`, `services/symflow-web`

---

## Goals

| In scope (v1) | Out of scope (later) |
|---------------|----------------------|
| Register with username + password | Google OAuth |
| Sign in / sign out | GitHub OAuth |
| Session cookie (`HttpOnly`) | Email verification |
| `GET /api/auth/me` | Password reset / MFA |
| Protect flow/run API routes | RBAC / orgs |
| Svelte login + register pages | JWT access tokens |

Design for extensibility: one **user** can have multiple **auth identities** (`password`, `google`, `github`) and multiple **sessions**.

---

## Validation rules

Apply the same rules on **API** (authoritative) and **web** (UX). Regex below is the contract.

### Username

```regex
^[a-zA-Z0-9._-]{3,20}$
```

| Rule | Detail |
|------|--------|
| Length | 3–20 characters |
| Allowed | `a-z`, `A-Z`, `0-9`, `.`, `_`, `-` |
| Disallowed | spaces, unicode letters, `@`, `/`, etc. |
| Case | Store **lowercase** in DB; compare case-insensitively on login |

Rust: `once_cell::Lazy<Regex>` or `regex` crate in `auth/validation.rs`.

TypeScript: duplicate in `$lib/auth/validation.ts` for instant form feedback.

### Password

```regex
^\S{8,32}$
```

| Rule | Detail |
|------|--------|
| Length | 8–32 characters |
| Allowed | any non-whitespace Unicode character |
| Disallowed | spaces, tabs, newlines |

Do **not** return password validation hints that help enumeration beyond “invalid username or password” on login.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│ symflow-web (SvelteKit, SSR off)                                │
│  /login /register  →  auth API client (credentials: include)    │
│  auth store        →  GET /api/auth/me on load                  │
│  route guards      →  redirect unauthenticated users            │
└────────────────────────────┬────────────────────────────────────┘
                             │ Cookie: symflow_session=<uuid>
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ symflow-api (axum)                                              │
│  auth/routes.rs    POST register | login | logout               │
│                    GET  me                                      │
│  auth/service.rs   orchestration                                │
│  auth/session.rs   create / revoke / lookup                     │
│  auth/password.rs  argon2 hash + verify                         │
│  auth/extractor.rs OptionalUser / AuthUser from cookie          │
└────────────────────────────┬────────────────────────────────────┘
                             │ sqlx
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Postgres (symflow-store migrations)                             │
│  users            core profile                                  │
│  auth_identities  password | google | github (extensible)       │
│  sessions         session id, expiry, metadata                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why `auth_identities` instead of `users.password_hash`?

Future OAuth users may have **no password** and **no username** at first sign-in. Model:

- `users` — internal id + display username (nullable later for OAuth-only accounts).
- `auth_identities` — one row per login method; unique on `(provider, provider_subject)`.

| provider | `provider_subject` | `password_hash` |
|----------|------------------|-----------------|
| `password` | normalized username | argon2 hash |
| `google` | Google `sub` | `NULL` |
| `github` | GitHub user id | `NULL` |

Linking Google to an existing password account later = insert another `auth_identities` row with same `user_id`.

---

## Database schema

Add migration `packages/symflow-store/migrations/0004_create_auth.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username   VARCHAR(20)  UNIQUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_identities (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider          VARCHAR(32)  NOT NULL,
    provider_subject  VARCHAR(255) NOT NULL,
    password_hash     TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS auth_identities_user_id_idx ON auth_identities(user_id);

CREATE TABLE IF NOT EXISTS sessions (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ  NOT NULL,
    last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    user_agent   TEXT,
    ip_address   INET
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
```

**Notes**

- `sessions.id` **is** the session token sent in the cookie (UUID v4). Alternative: random 32-byte token stored hashed — UUID is fine for v1 behind `HttpOnly` + TLS.
- Session TTL: default **14 days**; configurable via `SYMFLOW_SESSION_TTL_SECS`.
- Add periodic job later to `DELETE FROM sessions WHERE expires_at < now()` (not required for v1).

### Optional v2: scope flows to users

Defer to a follow-up migration unless you want auth enforced on data immediately:

```sql
ALTER TABLE flows ADD COLUMN owner_user_id UUID REFERENCES users(id);
CREATE INDEX flows_owner_user_id_idx ON flows(owner_user_id);
```

For v1, auth can gate **all** API access without per-row ownership.

---

## symflow-store changes

Follow the existing repository pattern (`repositories/flows.rs`, `models.rs`, `pg_store.rs`).

### New files

| File | Responsibility |
|------|----------------|
| `src/repositories/users.rs` | insert user, find by username |
| `src/repositories/auth_identities.rs` | insert password identity, find by provider + subject |
| `src/repositories/sessions.rs` | create, get valid, touch, delete |
| `src/models/auth.rs` | `UserRow`, `SessionRow`, `AuthIdentityRow` |

### New trait (keep separate from flow `Store`)

Do **not** overload `symflow_core::store::Store` with auth methods. Add a dedicated trait in `symflow-store` or `symflow-api`:

```rust
// packages/symflow-store/src/auth_store.rs (suggested)
#[async_trait]
pub trait AuthStore: Send + Sync {
    async fn create_user_with_password(
        &self,
        username: &str,
        password_hash: &str,
    ) -> Result<UserRecord, AuthStoreError>;

    async fn find_password_identity(
        &self,
        username: &str,
    ) -> Result<Option<PasswordIdentityRecord>, AuthStoreError>;

    async fn create_session(
        &self,
        user_id: Uuid,
        expires_at: DateTime<Utc>,
        user_agent: Option<&str>,
        ip_address: Option<&str>,
    ) -> Result<SessionRecord, AuthStoreError>;

    async fn get_session(&self, session_id: Uuid) -> Result<Option<SessionRecord>, AuthStoreError>;

    async fn delete_session(&self, session_id: Uuid) -> Result<bool, AuthStoreError>;

    async fn get_user(&self, user_id: Uuid) -> Result<Option<UserRecord>, AuthStoreError>;
}
```

Implement on `PgStore` (new `impl AuthStore for PgStore`).

For API integration tests, add `MemoryAuthStore` in `symflow-api` tests only — **production auth requires `DATABASE_URL`**.

---

## symflow-api changes

### Module layout

```
services/symflow-api/src/
  auth/
    mod.rs
    dto.rs          # RegisterRequest, LoginRequest, UserResponse
    routes.rs       # axum handlers
    service.rs      # register, login, logout, me
    password.rs     # hash_password, verify_password (argon2)
    session.rs      # cookie name, TTL, build Set-Cookie
    validation.rs   # username/password regex
    extractor.rs    # AuthUser, OptionalUser
  app.rs            # extend AppState
  main.rs           # mount auth routes, CORS credentials
```

### Extend `AppState`

```rust
pub struct AppState {
    pub store: Arc<dyn Store>,
    pub auth_store: Arc<dyn AuthStore>,  // new
    pub bus: EventBus,
    pub sandbox_dir: PathBuf,
}
```

When `DATABASE_URL` is missing, either:

- **Recommended:** refuse to start API unless `SYMFLOW_AUTH_DISABLED=1` for local flow-only dev, **or**
- start with `MemoryAuthStore` and log a warning (only for tests).

### Dependencies (`Cargo.toml`)

```toml
argon2   = "0.5"
regex    = { workspace = true }
axum-extra = { version = "0.9", features = ["cookie"] }
```

Use **Argon2id** with OS-random salt per password (default params from `argon2` crate).

### API endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| `POST` | `/api/auth/register` | none | `{ "username", "password" }` | `201` + `UserResponse` + `Set-Cookie` |
| `POST` | `/api/auth/login` | none | `{ "username", "password" }` | `200` + `UserResponse` + `Set-Cookie` |
| `POST` | `/api/auth/logout` | session | — | `204` + `Clear-Cookie` |
| `GET` | `/api/auth/me` | session | — | `200` + `UserResponse` or `401` |

#### `UserResponse` (never include password fields)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "alice"
}
```

### Status codes & errors

| Case | Status | Message (plain text or JSON — match existing `ApiError` style) |
|------|--------|----------------------------------------------------------------|
| Validation failed | `400` | `username must be 3-20 characters: letters, numbers, . _ -` |
| Username taken | `409` | `username already exists` |
| Bad login | `401` | `invalid username or password` (same message for unknown user vs wrong password) |
| No / expired session | `401` | `not authenticated` |
| DB error | `500` | generic internal |

Extend `ApiError` with `conflict()` → `409`.

### Register flow (`auth/service.rs`)

1. `validate_username` / `validate_password`
2. Normalize username to lowercase
3. `hash_password(password)` → argon2 string
4. Transaction:
   - `INSERT users (username)`
   - `INSERT auth_identities (provider='password', provider_subject=username, password_hash=...)`
5. Create session row
6. Return user + `Set-Cookie: symflow_session=<session.id>; HttpOnly; Path=/; SameSite=Lax; Max-Age=...`

### Login flow

1. Validate input format (not existence)
2. Load identity `provider='password', provider_subject=normalized_username`
3. `verify_password(hash, password)` — constant-time via argon2
4. On failure → `401` with generic message
5. Create new session (optionally revoke old sessions — skip for v1)
6. Set cookie

### Logout flow

1. Read session id from cookie
2. `DELETE FROM sessions WHERE id = $1`
3. Clear cookie (`Max-Age=0`)

### Session extractor (`auth/extractor.rs`)

```rust
pub struct AuthUser {
    pub user_id: Uuid,
    pub username: String,
    pub session_id: Uuid,
}

// Axum extractor:
// 1. Read Cookie header `symflow_session`
// 2. Parse UUID
// 3. auth_store.get_session(id) — must exist and expires_at > now()
// 4. Optionally UPDATE last_seen_at (throttle to once per 5 min)
// 5. Load user
```

Use `AuthUser` on routes that require login. Use `Option<AuthUser>` where optional.

### Protect existing routes (phase after auth works)

Apply `AuthUser` extractor to:

- `POST/PUT/DELETE /api/flows*`
- `POST /api/flows/:id/runs`
- `GET /api/runs*` (if runs should be private)

Leave `GET /health` public. Decide whether `GET /api/flows` is public in v1 — **recommend require auth** for consistency.

Example:

```rust
pub async fn list_flows(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> { ... }
```

### CORS & cookies

Current `main.rs` uses `CorsLayer::allow_origin(Any)` — **incompatible** with `credentials: true` in browsers.

Update when auth ships:

```rust
// Dev example — tighten for production
CorsLayer::new()
    .allow_origin("http://localhost:5173".parse::<HeaderValue>().unwrap())
    .allow_credentials(true)
    .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
    .allow_headers([CONTENT_TYPE, COOKIE, AUTHORIZATION])
```

When the web app uses the Vite `/api` proxy (no `PUBLIC_API_BASE_URL`), the browser talks to **same origin** (`localhost:5173`) and cookies work without CORS changes. Still set cookie `Path=/` and **do not** set `Domain` in dev.

Env vars:

| Variable | Default | Purpose |
|----------|---------|---------|
| `SYMFLOW_SESSION_COOKIE` | `symflow_session` | Cookie name |
| `SYMFLOW_SESSION_TTL_SECS` | `1209600` (14d) | Session lifetime |
| `SYMFLOW_COOKIE_SECURE` | `false` in dev | Set `Secure` flag in production |

### Wire router

In `routes.rs` or `auth/routes.rs`:

```rust
pub fn auth_router() -> Router<AppState> {
    Router::new()
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/me", get(me))
}
```

Merge in `main.rs`: `router(state).merge(auth_router())` or nest appropriately.

---

## symflow-web changes

### File layout

```
services/symflow-web/src/
  lib/
    auth/
      validation.ts      # USERNAME_RE, PASSWORD_RE, validateUsername(), validatePassword()
      types.ts           # AuthUser, LoginPayload, RegisterPayload
      session.ts         # readable auth store (writable)
    api/
      auth.ts            # register, login, logout, me
      http.ts            # add credentials + cookie forwarding
  routes/
    login/+page.svelte
    register/+page.svelte
    (app)/               # optional group for protected routes
      +layout.ts         # auth guard
      flows/...
```

### API client (`lib/api/auth.ts`)

```typescript
export async function register(payload: RegisterPayload, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(createUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return parseResponse<AuthUser>(response);
}

// Same pattern for login, logout, me
```

### Update existing HTTP client

In `lib/api/http.ts`, add `credentials: 'include'` to **every** `fetch` call so session cookies flow on flow/run endpoints too.

### Auth store (`lib/auth/session.ts`)

```typescript
import { writable } from 'svelte/store';
import { getMe } from '$lib/api/auth';

export const authUser = writable<AuthUser | null>(null);
export const authLoading = writable(true);

export async function refreshAuth(fetchImpl?: typeof fetch) {
  authLoading.set(true);
  try {
    authUser.set(await getMe(fetchImpl));
  } catch {
    authUser.set(null);
  } finally {
    authLoading.set(false);
  }
}

export function clearAuth() {
  authUser.set(null);
}
```

Call `refreshAuth()` from root layout on mount.

### Route guards

`src/routes/(app)/+layout.ts` (or `+layout.svelte`):

```typescript
import { redirect } from '@sveltejs/kit';
import { getMe } from '$lib/api/auth';

export async function load({ fetch }) {
  try {
    const user = await getMe(fetch);
    return { user };
  } catch {
    throw redirect(303, '/login');
  }
}
```

Public routes: `/login`, `/register`, maybe `/` marketing page.

Redirect authenticated users away from `/login` → `/flows`.

### UI pages

#### `/register`

- Fields: username, password, confirm password
- Client-side: run `validation.ts` before submit
- Confirm password must match (client only)
- On success: auth store updated → `goto('/flows')`
- Show API errors (`409` username taken, `400` validation)

#### `/login`

- Fields: username, password
- On success → `goto('/flows')` or `redirect` query param
- Link to register

Reuse existing styles: `.card`, `.primary-button`, `.error-message` from `app.css`.

### Update `AppShell.svelte`

- Show `authUser.username` in profile area instead of hardcoded `userName` i18n string
- Add **Sign out** menu item → `logout()` → `clearAuth()` → `goto('/login')`

### i18n (`lib/i18n.ts`)

Add keys: `signIn`, `signUp`, `signOut`, `username`, `password`, `confirmPassword`, `usernameRules`, `passwordRules`, `invalidCredentials`, `usernameTaken`, etc. (EN + VI to match existing pattern).

### Mock mode

Extend `lib/api/mock.ts` with a fake user and in-memory “logged in” flag, or document that **mock mode skips auth** with a stub user. Keep `client.ts` adapter pattern consistent.

### `hooks.server.ts`

SSR is off (`+layout.ts` exports `ssr = false`), so `handleFetch` is rarely used. If SSR is enabled later, forward `cookie` header from the browser request to the API origin.

---

## Security checklist

- [ ] Passwords hashed with **Argon2id**; never log or persist plaintext
- [ ] Login errors are generic (`invalid username or password`)
- [ ] Session cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production
- [ ] Regenerate session id on login (session fixation mitigation) — new row each login satisfies this
- [ ] Validate username/password on server even if client validated
- [ ] Rate-limit `/api/auth/login` and `/api/auth/register` (future: tower-governor or reverse proxy)
- [ ] Use DB transaction for register (user + identity atomic)
- [ ] Username uniqueness enforced by DB `UNIQUE` constraint

---

## Future OAuth extension (do not implement in v1)

Reserve these hooks:

### `auth/providers/mod.rs`

```rust
pub enum AuthProvider {
    Password,
    Google,
    GitHub,
}

pub trait OAuthProvider {
    fn name(&self) -> &'static str;
    fn authorize_url(&self, state: &str) -> String;
    async fn exchange_code(&self, code: &str) -> Result<OAuthProfile, AuthError>;
}

pub struct OAuthProfile {
    pub subject: String,
    pub email: Option<String>,
    pub display_name: Option<String>,
}
```

### Endpoints to add later

| Method | Path |
|--------|------|
| `GET` | `/api/auth/oauth/:provider/start` |
| `GET` | `/api/auth/oauth/:provider/callback` |

Callback flow: exchange code → find `auth_identities(provider, subject)` → or create user + identity → create session → set cookie (same as password login).

### Web

- Add “Continue with Google/GitHub” buttons on `/login`
- No password fields for OAuth users

---

## Implementation tasks (ordered)

### Phase 1 — Database & store

- [ ] **1.1** Add migration `0004_create_auth.sql`
- [ ] **1.2** Add `models/auth.rs` row types
- [ ] **1.3** Implement `repositories/users.rs`, `auth_identities.rs`, `sessions.rs`
- [ ] **1.4** Add `AuthStore` trait + `PgStore` impl
- [ ] **1.5** Unit tests for repositories (use test DB or `sqlx::test`)

### Phase 2 — API auth core

- [ ] **2.1** Add `auth/validation.rs` with username/password regex tests
- [ ] **2.2** Add `auth/password.rs` with argon2 hash/verify tests
- [ ] **2.3** Add `auth/session.rs` (TTL, cookie builder)
- [ ] **2.4** Add `auth/service.rs` (register, login, logout, me)
- [ ] **2.5** Add `auth/dto.rs` and `auth/routes.rs`
- [ ] **2.6** Add `auth/extractor.rs` (`AuthUser`)
- [ ] **2.7** Extend `AppState` with `auth_store`
- [ ] **2.8** Wire routes in `main.rs`; require `DATABASE_URL` for auth (or document bypass flag)

### Phase 3 — API tests

- [ ] **3.1** Register happy path → `201`, cookie set, `me` returns user
- [ ] **3.2** Duplicate username → `409`
- [ ] **3.3** Invalid username/password format → `400`
- [ ] **3.4** Login wrong password → `401`
- [ ] **3.5** Logout clears session → `me` returns `401`
- [ ] **3.6** Expired session → `401`

### Phase 4 — Protect resource routes

- [ ] **4.1** Add `AuthUser` to flow/run mutating handlers
- [ ] **4.2** Integration test: unauthenticated `POST /api/flows` → `401`
- [ ] **4.3** Authenticated flow create still works

### Phase 5 — Web UI

- [ ] **5.1** `lib/auth/validation.ts` + tests (vitest)
- [ ] **5.2** `lib/api/auth.ts` + extend `client.ts`
- [ ] **5.3** Add `credentials: 'include'` to `http.ts`
- [ ] **5.4** Build `/login` and `/register` pages
- [ ] **5.5** Auth store + root layout `refreshAuth`
- [ ] **5.6** Route guard for `/flows`, `/runs`
- [ ] **5.7** Update `AppShell` profile + sign out
- [ ] **5.8** i18n strings (EN + VI)

### Phase 6 — Docs & env

- [ ] **6.1** Update `symflow-api/README.md` and `symflow-web/README.md`
- [ ] **6.2** Add env vars to `.env.example` files
- [ ] **6.3** Note CORS / `PUBLIC_API_BASE_URL` + credentials behavior

---

## Test examples

### Rust — validation

```rust
#[test]
fn username_allows_dots_and_underscores() {
    assert!(validate_username("alice.dev_1").is_ok());
}

#[test]
fn username_rejects_spaces() {
    assert!(validate_username("alice bob").is_err());
}

#[test]
fn password_rejects_whitespace() {
    assert!(validate_password("pass word123").is_err());
}
```

### Rust — API register

```rust
#[tokio::test]
async fn register_sets_session_cookie() {
    let app = test_router_with_db().await;
    let (status, headers, body) = post_json(
        app,
        "/api/auth/register",
        json!({ "username": "alice", "password": "secret123" }),
    ).await;
    assert_eq!(status, StatusCode::CREATED);
    assert!(headers.get("set-cookie").unwrap().to_str().unwrap().contains("symflow_session="));
}
```

### TypeScript — validation

```typescript
import { describe, expect, it } from 'vitest';
import { validateUsername, validatePassword } from '$lib/auth/validation';

describe('auth validation', () => {
  it('accepts valid username', () => {
    expect(validateUsername('user_01')).toEqual({ ok: true });
  });

  it('rejects short password', () => {
    expect(validatePassword('short')).toMatchObject({ ok: false });
  });
});
```

---

## Acceptance criteria

- [ ] User can register with username/password matching regex rules
- [ ] Password stored as argon2 hash; never returned in API
- [ ] User can sign in and receive `symflow_session` cookie
- [ ] `GET /api/auth/me` returns current user when cookie valid
- [ ] Sign out revokes session and clears cookie
- [ ] Protected API routes reject unauthenticated requests with `401`
- [ ] Web redirects unauthenticated users to `/login`
- [ ] `auth_identities` schema supports future `google` / `github` providers without migration redesign
- [ ] Validation rules match exactly: username `^[a-zA-Z0-9._-]{3,20}$`, password `^\S{8,32}$`

---

## Related files (current codebase)

| Path | Relevance |
|------|-----------|
| `services/symflow-api/src/main.rs` | Server bootstrap, CORS, migrations |
| `services/symflow-api/src/app.rs` | `AppState` |
| `services/symflow-api/src/routes.rs` | Existing route patterns, test helpers |
| `services/symflow-api/src/error.rs` | `ApiError` variants |
| `packages/symflow-store/migrations/` | New `0004_create_auth.sql` |
| `packages/symflow-store/src/repositories/flows.rs` | Repository pattern reference |
| `services/symflow-web/src/lib/api/http.ts` | Fetch wrapper to extend |
| `services/symflow-web/src/lib/api/client.ts` | Production/mock adapter |
| `services/symflow-web/vite.config.ts` | `/api` dev proxy |
| `services/symflow-web/src/lib/components/AppShell.svelte` | Profile / sign-out UI |
