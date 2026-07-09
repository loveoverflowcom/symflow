<script lang="ts">
  import AppShell from '$lib/components/AppShell.svelte';
  import { language, t } from '$lib/i18n';
</script>

<svelte:head>
  <title>{t($language, 'connectors')} | {t($language, 'appName')}</title>
</svelte:head>

<AppShell>
  <div class="page-title-block">
    <h1>{t($language, 'connectors')}</h1>
    <p class="subtitle">{t($language, 'connectorsSubtitle')}</p>
  </div>

  <section class="placeholder-section">
    <div class="placeholder-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <path d="M10 6.5h4a3.5 3.5 0 0 1 3.5 3.5v4M6.5 10v4A3.5 3.5 0 0 0 10 17.5h4" />
      </svg>
    </div>
    <h2>{t($language, 'noConnectorsYet')}</h2>
    <p>{t($language, 'noConnectorsDescription')}</p>

    <div class="placeholder-features">
      <div class="feature-card">
        <span class="feature-icon">🔌</span>
        <strong>{t($language, 'connectorFeatureApis')}</strong>
        <p>{t($language, 'connectorFeatureApisDesc')}</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">🔐</span>
        <strong>{t($language, 'connectorFeatureAuth')}</strong>
        <p>{t($language, 'connectorFeatureAuthDesc')}</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">♻️</span>
        <strong>{t($language, 'connectorFeatureReuse')}</strong>
        <p>{t($language, 'connectorFeatureReuseDesc')}</p>
      </div>
    </div>
  </section>
</AppShell>

<style>
  .placeholder-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 48px 24px 64px;
    gap: 16px;
    max-width: 680px;
    margin: 0 auto;
  }

  .placeholder-icon {
    display: inline-grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: var(--bg-badge-muted);
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .placeholder-icon svg {
    width: 30px;
    height: 30px;
  }

  .placeholder-section h2 {
    font-size: 1.25rem;
    font-weight: 660;
    color: var(--text-primary);
  }

  .placeholder-section > p {
    color: var(--text-muted);
    line-height: 1.55;
    max-width: 440px;
    font-size: 0.97rem;
  }

  .placeholder-features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 14px;
    width: 100%;
    margin: 16px 0 8px;
  }

  .feature-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 18px 16px;
    border: 1px solid var(--border-card);
    border-radius: 14px;
    background: var(--bg-card);
    text-align: left;
  }

  .feature-icon {
    font-size: 1.4rem;
    margin-bottom: 4px;
  }

  .feature-card strong {
    font-size: 0.92rem;
    font-weight: 660;
    color: var(--text-primary);
  }

  .feature-card p {
    font-size: 0.86rem;
    color: var(--text-muted);
    line-height: 1.45;
    margin: 0;
  }
</style>
