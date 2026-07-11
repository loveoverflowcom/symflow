# Guide: Move Language and Theme into Settings, Show Profile Detail After Account Tabs

> Update **symflow-web** so **language** and **theme** no longer live in the profile dropdown. Instead, place them in a dedicated **Settings** view, and show a **profile detail panel** underneath an **Account tab bar**.
>
> Primary files:
> - `services/symflow-web/src/lib/components/AppShell.svelte`
> - `services/symflow-web/src/lib/i18n.ts`
> - `services/symflow-web/src/lib/auth/types.ts`
> - `services/symflow-web/src/routes/+layout.svelte`
> - `services/symflow-web/src/routes/settings/+page.svelte` (new)

---

## Goal

Create a cleaner account/settings UX:

1. Keep the sidebar profile trigger focused on account access and sign-out.
2. Move **Language** and **Theme** controls into a dedicated **Settings** page.
3. Add an **Account** tab section in Settings.
4. Show the **profile detail view below the account tab bar**.

The intended structure is:

```text
Settings page
├── page header
├── tab bar
│   ├── Account
│   └── Preferences
├── Account tab content
│   └── profile detail view
└── Preferences tab content
    ├── language selector
    └── theme selector
```

---

## Current State

Today, `services/symflow-web/src/lib/components/AppShell.svelte` mixes three responsibilities inside the profile dropdown:

- account entry point
- app preferences (`language`, `theme`)
- sign-out action

This is the relevant section today:

```svelte
{#if profileOpen}
  <div class="profile-dropdown" role="menu">
    <div class="dropdown-item">
      <label for="language-select">
        <span>{t($language, 'language')}</span>
      </label>
      <select ... />
    </div>

    <div class="dropdown-item">
      <label for="theme-select">
        <span>{t($language, 'theme')}</span>
      </label>
      <select ... />
    </div>

    <button class="dropdown-item sign-out-button" ...>
      {signingOut ? t($language, 'signingOut') : t($language, 'signOut')}
    </button>
  </div>
{/if}
```

That makes the account menu do too much, and there is no dedicated settings route yet. The sidebar "Settings" item points to `/#settings`, which also suggests a placeholder rather than a real page.

---

## Target UX

### Sidebar behavior

- Clicking **Settings** should go to a real route: `/settings`
- Clicking the **profile trigger** should open a simplified dropdown:
  - `Profile` or `Account settings`
  - `Sign out`
- The dropdown should no longer contain `Language` and `Theme`

### Settings page behavior

The new `/settings` page should contain:

1. A top-level header, for example:
   - title: `Settings`
   - subtitle: short description such as "Manage your account and app preferences."
2. A tab bar with at least:
   - `Account`
   - `Preferences`
3. The **Account** tab content should render first by default.
4. The **profile detail view** should appear directly **below the tab bar** when the `Account` tab is active.
5. The **Preferences** tab should contain:
   - language selector
   - theme selector

---

## Recommended Information Architecture

### Tab: Account

Use this section for identity-related information:

- avatar initial
- username
- user id
- optional future fields:
  - email
  - role
  - created date

Because the current `AuthUser` type only contains:

```ts
type AuthUser = {
  id: string;
  username: string;
};
```

the first version of the profile detail view can display:

- avatar derived from `username`
- username
- id

### Tab: Preferences

Use this section for client-side app preferences:

- language
- theme

This matches the current store ownership:

- `services/symflow-web/src/lib/i18n.ts`
- `services/symflow-web/src/lib/theme.ts`

No data model change is required for v1 because both preferences already live in local storage.

---

## Implementation Plan

### Phase 1: Create a real Settings route

Add a new file:

- `services/symflow-web/src/routes/settings/+page.svelte`

Responsibilities:

- render page title/subtitle
- manage local active tab state
- render account tab bar
- render profile detail view below the tab bar
- render preference controls in a separate tab

Suggested local state:

```ts
type SettingsTab = 'account' | 'preferences';
let activeTab = $state<SettingsTab>('account');
```

Suggested page structure:

```svelte
<script lang="ts">
  import { authUser } from '$lib/auth/session';
  import { language, setLanguage, t, type Language } from '$lib/i18n';
  import { theme, setTheme, type Theme } from '$lib/theme';

  type SettingsTab = 'account' | 'preferences';
  let activeTab = $state<SettingsTab>('account');
</script>

<section class="settings-page stack">
  <header class="card stack-sm">
    <h1>{t($language, 'settings')}</h1>
    <p class="muted">{t($language, 'settingsDescription')}</p>
  </header>

  <section class="card stack">
    <div class="tabs settings-tabs" role="tablist" aria-label={t($language, 'settings')}>
      <button
        type="button"
        role="tab"
        class:active={activeTab === 'account'}
        aria-selected={activeTab === 'account'}
        onclick={() => (activeTab = 'account')}
      >
        {t($language, 'account')}
      </button>
      <button
        type="button"
        role="tab"
        class:active={activeTab === 'preferences'}
        aria-selected={activeTab === 'preferences'}
        onclick={() => (activeTab = 'preferences')}
      >
        {t($language, 'preferences')}
      </button>
    </div>

    {#if activeTab === 'account'}
      <section class="profile-detail card-subsection">
        <!-- profile detail view below tab bar -->
      </section>
    {:else}
      <section class="preferences-detail card-subsection">
        <!-- language + theme -->
      </section>
    {/if}
  </section>
</section>
```

---

### Phase 2: Move Settings nav to `/settings`

Update `services/symflow-web/src/lib/components/AppShell.svelte`:

- change the sidebar settings link from `/#settings` to `/settings`

Replace:

```svelte
<SidebarMenuItem href="/#settings" label={t($language, 'settings')} icon="settings" collapsed={sidebarCollapsed} />
```

With:

```svelte
<SidebarMenuItem href="/settings" label={t($language, 'settings')} icon="settings" collapsed={sidebarCollapsed} />
```

This makes Settings a first-class route instead of a placeholder anchor.

---

### Phase 3: Simplify the profile dropdown

In `services/symflow-web/src/lib/components/AppShell.svelte`:

- remove the language selector block
- remove the theme selector block
- keep sign-out
- optionally add a link/button to `/settings` or `/settings?tab=account`

Recommended final dropdown:

```svelte
{#if profileOpen}
  <div class="profile-dropdown" role="menu">
    <a class="dropdown-link" href="/settings">
      {t($language, 'accountSettings')}
    </a>

    <button
      class="dropdown-item sign-out-button"
      type="button"
      role="menuitem"
      disabled={signingOut}
      onclick={handleSignOut}
    >
      {signingOut ? t($language, 'signingOut') : t($language, 'signOut')}
    </button>
  </div>
{/if}
```

If you want the account screen to open directly, use `/settings` with default tab `account`.

---

### Phase 4: Render the profile detail view

Inside the `Account` tab content, show a compact profile summary card.

Suggested fields for v1:

- avatar initial
- username
- user id

Suggested markup:

```svelte
<section class="profile-detail">
  <div class="profile-hero">
    <span class="profile-avatar-lg" aria-hidden="true">
      {$authUser?.username?.charAt(0).toUpperCase() ?? 'U'}
    </span>

    <div class="stack-xs">
      <h2>{$authUser?.username ?? t($language, 'userName')}</h2>
      <p class="muted">{t($language, 'profileDetailsDescription')}</p>
    </div>
  </div>

  <dl class="profile-meta">
    <div>
      <dt>{t($language, 'username')}</dt>
      <dd>{$authUser?.username ?? '-'}</dd>
    </div>
    <div>
      <dt>{t($language, 'userId')}</dt>
      <dd>{$authUser?.id ?? '-'}</dd>
    </div>
  </dl>
</section>
```

This satisfies the requirement to **show profile detail view after the tab account bar** because the detail panel is rendered immediately below the tabs when `activeTab === 'account'`.

---

### Phase 5: Move Language and Theme into Preferences

Re-use the existing stores:

- `language`, `setLanguage`
- `theme`, `setTheme`

Suggested markup:

```svelte
<section class="preferences-detail stack">
  <div class="setting-row">
    <label for="language-select">
      <span>{t($language, 'language')}</span>
      <small>{t($language, 'languageSettingDescription')}</small>
    </label>
    <select
      id="language-select"
      class="settings-select"
      value={$language}
      onchange={(e) => setLanguage((e.currentTarget as HTMLSelectElement).value as Language)}
    >
      <option value="en">{t($language, 'english')}</option>
      <option value="vi">{t($language, 'vietnamese')}</option>
    </select>
  </div>

  <div class="setting-row">
    <label for="theme-select">
      <span>{t($language, 'theme')}</span>
      <small>{t($language, 'themeSettingDescription')}</small>
    </label>
    <select
      id="theme-select"
      class="settings-select"
      value={$theme}
      onchange={(e) => setTheme((e.currentTarget as HTMLSelectElement).value as Theme)}
    >
      <option value="light">{t($language, 'themeLight')}</option>
      <option value="dark">{t($language, 'themeDark')}</option>
    </select>
  </div>
</section>
```

No backend API change is needed for v1.

---

## Translation Updates Needed

Add these keys to `services/symflow-web/src/lib/i18n.ts` in both `en` and `vi`:

- `settingsDescription`
- `account`
- `preferences`
- `accountSettings`
- `profileDetailsDescription`
- `userId`
- `languageSettingDescription`
- `themeSettingDescription`

Recommended English values:

```ts
settingsDescription: 'Manage your account details and app preferences.',
account: 'Account',
preferences: 'Preferences',
accountSettings: 'Account settings',
profileDetailsDescription: 'Your current signed-in profile information.',
userId: 'User ID',
languageSettingDescription: 'Choose the language used across the app.',
themeSettingDescription: 'Choose the color theme for the interface.',
```

Recommended Vietnamese values:

```ts
settingsDescription: 'Quản lý thông tin tài khoản và tuỳ chọn ứng dụng.',
account: 'Tài khoản',
preferences: 'Tuỳ chọn',
accountSettings: 'Cài đặt tài khoản',
profileDetailsDescription: 'Thông tin hồ sơ của tài khoản đang đăng nhập.',
userId: 'Mã người dùng',
languageSettingDescription: 'Chọn ngôn ngữ hiển thị cho toàn bộ ứng dụng.',
themeSettingDescription: 'Chọn giao diện màu cho ứng dụng.',
```

---

## Styling Notes

Most of the page can re-use existing global utility classes:

- `card`
- `stack`
- `stack-sm`
- `muted`
- `tabs`
- `settings-select`

Additional styles likely needed in either the page or `app.css`:

- `.settings-page`
- `.settings-tabs`
- `.card-subsection`
- `.profile-detail`
- `.profile-hero`
- `.profile-avatar-lg`
- `.profile-meta`
- `.setting-row`

Design guidance:

- keep the tab bar compact
- place profile detail content directly below tabs
- keep preferences rows aligned label-left / control-right
- preserve current visual language from home/workflow pages

---

## Optional Improvements

These are nice-to-have, not required for v1:

### 1. Deep-link active tab

Support `/settings?tab=preferences` so the profile dropdown can open the right section later.

### 2. Extract reusable settings components

If the page grows, create:

- `src/lib/components/settings/SettingsTabs.svelte`
- `src/lib/components/settings/ProfileDetailCard.svelte`
- `src/lib/components/settings/PreferenceRow.svelte`

### 3. Expand `AuthUser`

If the backend later returns more fields, extend:

```ts
type AuthUser = {
  id: string;
  username: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
};
```

Then surface them inside the Account tab without changing the overall page structure.

---

## Acceptance Criteria

- [ ] `Settings` in the sidebar navigates to `/settings`
- [ ] profile dropdown no longer shows language selector
- [ ] profile dropdown no longer shows theme selector
- [ ] `/settings` renders a tab bar with `Account` and `Preferences`
- [ ] `Account` is the default active tab
- [ ] profile detail view appears below the account tab bar
- [ ] `Preferences` contains language and theme controls
- [ ] language selection still updates `document.documentElement.lang`
- [ ] theme selection still updates `data-theme` and persists in local storage
- [ ] sign-out still works from the profile dropdown

---

## Suggested Order of Work

1. Add new translation keys in `i18n.ts`
2. Create `src/routes/settings/+page.svelte`
3. Update `AppShell.svelte` settings link to `/settings`
4. Remove language/theme controls from the profile dropdown
5. Add account profile detail section below tabs
6. Add or adjust styles
7. Run `npm run check` in `services/symflow-web`

---

## Summary

The cleanest implementation is to turn Settings into a real page with two tabs:

- `Account` for profile details
- `Preferences` for language and theme

This keeps the profile dropdown lightweight, gives Settings a real destination, and directly satisfies the requirement to **show the profile detail view immediately after the Account tab bar**.
