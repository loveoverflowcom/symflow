<script lang="ts">
  import { page } from '$app/state';
  import AppShell from '$lib/components/AppShell.svelte';
  import { authUser } from '$lib/auth/session';
  import { language, setLanguage, t, type Language } from '$lib/i18n';
  import { theme, setTheme, type Theme } from '$lib/theme';

  type SettingsTab = 'account' | 'preferences';
  let activeTab = $state<SettingsTab>('account');

  // React to tab query parameter changes to support deep linking
  $effect(() => {
    const tabParam = page.url.searchParams.get('tab');
    if (tabParam === 'preferences' || tabParam === 'account') {
      activeTab = tabParam;
    }
  });
</script>

<svelte:head>
  <title>{t($language, 'settings')} | {t($language, 'appName')}</title>
</svelte:head>

<AppShell>
  <div class="page-title-block">
    <h1>{t($language, 'settings')}</h1>
    <p class="subtitle">{t($language, 'settingsDescription')}</p>
  </div>

  <section class="settings-page stack">
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
          <div class="profile-hero">
            <span class="profile-avatar-lg" aria-hidden="true">
              {$authUser?.username?.charAt(0).toUpperCase() ?? 'U'}
            </span>

            <div class="stack-xs">
              <h2>{$authUser?.username ?? t($language, 'userName')}</h2>
              <p class="profile-desc">{t($language, 'profileDetailsDescription')}</p>
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
      {:else}
        <section class="preferences-detail card-subsection">
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
      {/if}
    </section>
  </section>
</AppShell>

<style>
  .settings-page {
    max-width: 680px;
    margin-top: 1.5rem;
  }

  .settings-tabs {
    margin-bottom: 0.5rem;
    width: fit-content;
  }

  /* Clear opacity on tab labels for crisp look */
  .settings-tabs :global(button) {
    color: var(--text-secondary) !important;
    opacity: 1 !important;
  }

  .settings-tabs :global(button.active) {
    color: var(--text-primary) !important;
    background: var(--bg-input) !important;
    opacity: 1 !important;
  }

  .card-subsection {
    animation: fadeIn 0.22s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Profile Tab Styles */
  .profile-detail {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .profile-hero {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--border-default);
  }

  .profile-avatar-lg {
    display: inline-grid;
    width: 64px;
    height: 64px;
    place-items: center;
    border-radius: 16px;
    background: linear-gradient(135deg, #a855f7, #6b21a8);
    color: white;
    font-size: 1.75rem;
    font-weight: 700;
    box-shadow: 0 4px 12px rgba(107, 33, 168, 0.25);
  }

  .profile-hero h2 {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .profile-desc {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .stack-xs {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .profile-meta {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    margin: 0;
  }

  @media (min-width: 480px) {
    .profile-meta {
      grid-template-columns: 1fr 1fr;
    }
  }

  .profile-meta > div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.88rem 1rem;
    border: 1px solid var(--border-default);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
  }

  .profile-meta dt {
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
  }

  .profile-meta dd {
    margin: 0;
    font-size: 0.94rem;
    font-weight: 650;
    color: var(--text-primary);
    word-break: break-all;
  }

  /* Preferences Tab Styles */
  .preferences-detail {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .setting-row {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.75rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--border-default);
  }

  .setting-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  @media (min-width: 540px) {
    .setting-row {
      flex-direction: row;
      align-items: center;
      gap: 2rem;
    }
  }

  .setting-row label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .setting-row label span {
    font-size: 0.96rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .setting-row label small {
    font-size: 0.84rem;
    color: var(--text-secondary);
  }

  .settings-select {
    width: 100%;
    max-width: 180px;
    border: 1px solid var(--border-select);
    border-radius: 8px;
    background: var(--bg-select);
    color: var(--text-primary);
    padding: 6px 12px;
    font-size: 0.88rem;
    font-weight: 550;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .settings-select:focus {
    border-color: #159deb;
    box-shadow: 0 0 0 2px rgba(21, 157, 235, 0.14);
  }
</style>
