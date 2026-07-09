<script lang="ts">
  import AppShell from '$lib/components/AppShell.svelte';
  import { language, t } from '$lib/i18n';

  let activeTab = $state<'agents' | 'workflows'>('agents');
</script>

<svelte:head>
  <title>{t($language, 'home')} | {t($language, 'appName')}</title>
</svelte:head>

<AppShell>
  {#snippet actions()}
    <a class="secondary-button header-action" href="/#updates">{t($language, 'recentUpdates')}</a>
    <a class="primary-button header-action create-agent-button" href="/#create-agent">
      <span>{t($language, 'createAgent')}</span>
      <span class="action-chevron" aria-hidden="true">⌄</span>
    </a>
  {/snippet}

  <section class="home-dashboard">
    <div class="home-primary">
      <h1>{t($language, 'welcomeBack')}</h1>
      <article class="dashboard-empty-card recent-card">
        <div>
          <h2>{t($language, 'noRecentActivity')}</h2>
          <p>{t($language, 'recentActivityDescription')}</p>
        </div>
      </article>
    </div>

    <div class="home-secondary">
      <div class="triggers-heading">
        <h2>{t($language, 'upcomingTriggers')}</h2>
        <div class="tabs" role="tablist" aria-label={t($language, 'upcomingTriggers')}>
          <button class:active={activeTab === 'agents'} type="button" role="tab" aria-selected={activeTab === 'agents'} onclick={() => (activeTab = 'agents')}>
            {t($language, 'agents')}
          </button>
          <button class:active={activeTab === 'workflows'} type="button" role="tab" aria-selected={activeTab === 'workflows'} onclick={() => (activeTab = 'workflows')}>
            {t($language, 'workflows')}
          </button>
        </div>
      </div>

      <article class="dashboard-empty-card trigger-card">
        <div class="trigger-copy">
          <h3>{t($language, 'noUpcomingTriggers')}</h3>
          <p>{t($language, activeTab === 'agents' ? 'agentTriggerDescription' : 'workflowTriggerDescription')}</p>
          <a href="/#agent-triggers">
            {t($language, 'whatAreAgentTriggers')}
            <span aria-hidden="true">→</span>
          </a>
        </div>
        <div class="ghost-mark" aria-hidden="true">
          <span></span><span></span>
        </div>
      </article>
    </div>
  </section>
</AppShell>
