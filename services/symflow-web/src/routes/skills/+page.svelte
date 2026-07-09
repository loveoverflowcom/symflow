<script lang="ts">
  import AppShell from '$lib/components/AppShell.svelte';
  import { language, t } from '$lib/i18n';
</script>

<svelte:head>
  <title>{t($language, 'skills')} | {t($language, 'appName')}</title>
</svelte:head>

<AppShell>
  <div class="page-title-block">
    <h1>{t($language, 'skills')}</h1>
    <p class="subtitle">{t($language, 'skillsSubtitle')}</p>
  </div>

  <section class="placeholder-section">
    <div class="placeholder-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="m13 2-9 12h7l-1 8 10-13h-7z" />
      </svg>
    </div>
    <h2>{t($language, 'noSkillsYet')}</h2>
    <p>{t($language, 'noSkillsDescription')}</p>

    <div class="placeholder-features">
      <div class="feature-card">
        <span class="feature-icon">🧩</span>
        <strong>{t($language, 'skillFeatureFunction')}</strong>
        <p>{t($language, 'skillFeatureFunctionDesc')}</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">🎯</span>
        <strong>{t($language, 'skillFeaturePrecision')}</strong>
        <p>{t($language, 'skillFeaturePrecisionDesc')}</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">🔄</span>
        <strong>{t($language, 'skillFeatureCompose')}</strong>
        <p>{t($language, 'skillFeatureComposeDesc')}</p>
      </div>
    </div>

    <div class="concept-note">
      <p>{t($language, 'skillsConceptNote')}</p>
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

  .concept-note {
    margin-top: 8px;
    padding: 14px 20px;
    border-radius: 12px;
    border: 1px solid var(--border-card);
    background: var(--bg-badge-muted);
    max-width: 520px;
  }

  .concept-note p {
    font-size: 0.88rem;
    color: var(--text-muted);
    line-height: 1.55;
    margin: 0;
    font-style: italic;
  }
</style>
