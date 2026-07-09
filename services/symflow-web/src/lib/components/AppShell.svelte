<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { logoutUser } from '$lib/api/client';
  import { authUser, clearAuth } from '$lib/auth/session';
  import SidebarMenuItem from './SidebarMenuItem.svelte';
  import { language, t, setLanguage, type Language } from '$lib/i18n';
  import { theme, setTheme, type Theme } from '$lib/theme';

  let { actions, children } = $props<{
    actions?: import('svelte').Snippet;
    children?: import('svelte').Snippet;
  }>();

  let profileOpen = $state(false);
  let signingOut = $state(false);
  let sidebarCollapsed = $state(false);
  const currentPath = $derived(page.url.pathname);

  async function handleSignOut() {
    signingOut = true;
    try {
      await logoutUser();
    } finally {
      clearAuth();
      signingOut = false;
      await goto('/login');
    }
  }
</script>

<div class="page-shell" class:sidebar-collapsed={sidebarCollapsed}>
  <aside class="sidebar" class:collapsed={sidebarCollapsed}>
    <div class="sidebar-brand">
      <span class="brand-mark" aria-hidden="true">S</span>
      {#if !sidebarCollapsed}
        <span>{t($language, 'appName')}</span>
      {/if}
      <button
        class="collapse-toggle"
        type="button"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {#if sidebarCollapsed}
            <path d="M9 18l6-6-6-6" />
          {:else}
            <path d="M15 18l-6-6 6-6" />
          {/if}
        </svg>
      </button>
    </div>

    {#if !sidebarCollapsed}
      <a class="new-chat-button" href="/">{t($language, 'newChat')}</a>
    {/if}

    <nav class="sidebar-nav" aria-label={t($language, 'mainNavigation')}>
      <SidebarMenuItem href="/" label={t($language, 'home')} icon="home" active={currentPath === '/'} collapsed={sidebarCollapsed} />
      <SidebarMenuItem href="/agents" label={t($language, 'agents')} icon="agents" active={currentPath.startsWith('/agents')} collapsed={sidebarCollapsed} />
      <SidebarMenuItem href="/skills" label={t($language, 'skills')} icon="skills" active={currentPath.startsWith('/skills')} collapsed={sidebarCollapsed} />
      <SidebarMenuItem href="/#artifacts" label={t($language, 'artifacts')} icon="artifacts" collapsed={sidebarCollapsed} />
      <SidebarMenuItem href="/connectors" label={t($language, 'connectors')} icon="connectors" active={currentPath.startsWith('/connectors')} collapsed={sidebarCollapsed} />
      <SidebarMenuItem href="/flows" label={t($language, 'workflows')} icon="workflows" active={currentPath.startsWith('/flows') || currentPath.startsWith('/runs')} collapsed={sidebarCollapsed} />
    </nav>

    <div class="sidebar-footer">
      <nav class="sidebar-support" aria-label={t($language, 'supportNavigation')}>
        <SidebarMenuItem href="/#settings" label={t($language, 'settings')} icon="settings" collapsed={sidebarCollapsed} />
      </nav>

      <div class="profile-menu">
        <button
          class="profile-trigger"
          type="button"
          aria-expanded={profileOpen}
          aria-haspopup="menu"
          onclick={() => (profileOpen = !profileOpen)}
        >
          <span class="profile-avatar" aria-hidden="true">
            {$authUser?.username.charAt(0).toUpperCase() || 'U'}
          </span>
          {#if !sidebarCollapsed}
            <span class="profile-name">{$authUser?.username || t($language, 'userName')}</span>
            <span class="profile-more" aria-hidden="true">•••</span>
          {/if}
        </button>

        {#if profileOpen}
          <div class="profile-dropdown" role="menu">
            <div class="dropdown-item">
              <label for="language-select">
                <span>{t($language, 'language')}</span>
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

            <div class="dropdown-item">
              <label for="theme-select">
                <span>{t($language, 'theme')}</span>
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
      </div>
    </div>
  </aside>

  <div class="content-area">
    {#if actions}
      <header class="content-header">
        <div class="actions">
          {@render actions()}
        </div>
      </header>
    {/if}

    <main class="page-content">
      {#if children}
        {@render children()}
      {/if}
    </main>
  </div>
</div>

<style>
  .dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 10px;
    border-radius: 7px;
    font-size: 0.88rem;
    color: var(--text-secondary);
  }

  .dropdown-item:hover {
    background: var(--border-default);
  }

  .dropdown-item label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: default;
    font-size: 0.88rem;
    color: var(--text-secondary);
  }

  .settings-select {
    width: auto;
    min-width: 110px;
    border: 1px solid var(--border-select);
    border-radius: 7px;
    background: var(--bg-select);
    color: var(--text-secondary);
    padding: 4px 8px;
    font-size: 0.82rem;
    font-weight: 580;
    cursor: pointer;
    outline: none;
  }

  .settings-select:focus {
    border-color: #159deb;
    box-shadow: 0 0 0 2px rgba(21, 157, 235, 0.14);
  }

  .sign-out-button {
    width: 100%;
    justify-content: flex-start;
    background: transparent;
    color: #c33b3b;
  }
</style>
