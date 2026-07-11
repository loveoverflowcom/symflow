<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { logoutUser } from '$lib/api/client';
  import { authUser, clearAuth } from '$lib/auth/session';
  import SidebarMenuItem from './SidebarMenuItem.svelte';
  import { language, t } from '$lib/i18n';

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
      {#if !sidebarCollapsed}
        <span class="brand-mark" aria-hidden="true">S</span>
        <span>{t($language, 'appName')}</span>
      {/if}
      <button
        class="collapse-toggle"
        class:collapsed={sidebarCollapsed}
        type="button"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
      >
        <!-- Panel-left icon: outer rect + inner left stripe -->
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M9 3v18" />
        </svg>
      </button>
    </div>

    {#if !sidebarCollapsed}
      <a class="new-chat-button" href="/">{t($language, 'newChat')}</a>
    {/if}

    <nav class="sidebar-nav" aria-label={t($language, 'mainNavigation')}>
      <SidebarMenuItem href="/" label={t($language, 'home')} icon="home" active={currentPath === '/'} collapsed={sidebarCollapsed} />
      <SidebarMenuItem href="/agents" label={t($language, 'agents')} icon="agents" active={currentPath.startsWith('/agents')} collapsed={sidebarCollapsed} />
      <SidebarMenuItem href="/connectors" label={t($language, 'connectors')} icon="connectors" active={currentPath.startsWith('/connectors')} collapsed={sidebarCollapsed} />
      <SidebarMenuItem href="/flows" label={t($language, 'workflows')} icon="workflows" active={currentPath.startsWith('/flows') || currentPath.startsWith('/runs')} collapsed={sidebarCollapsed} />
    </nav>

    <div class="sidebar-footer">
      <nav class="sidebar-support" aria-label={t($language, 'supportNavigation')}>
        <SidebarMenuItem href="/settings" label={t($language, 'settings')} icon="settings" active={currentPath.startsWith('/settings')} collapsed={sidebarCollapsed} />
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
            <a
              class="dropdown-item dropdown-link"
              href="/settings"
              role="menuitem"
              onclick={() => (profileOpen = false)}
            >
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

  .dropdown-link {
    text-decoration: none;
    justify-content: flex-start;
  }

  .sign-out-button {
    width: 100%;
    justify-content: flex-start;
    background: transparent;
    color: #c33b3b;
  }
</style>
