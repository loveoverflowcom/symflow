<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { ApiError, loginUser } from '$lib/api/client';
  import { setAuthUser } from '$lib/auth/session';
  import { validatePassword, validateUsername } from '$lib/auth/validation';
  import { language, t } from '$lib/i18n';

  let username = $state('');
  let password = $state('');
  let errorMessage = $state('');
  let submitting = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = '';

    if (!validateUsername(username).ok || !validatePassword(password).ok) {
      errorMessage = t($language, 'invalidCredentials');
      return;
    }

    submitting = true;
    try {
      const user = await loginUser({ username, password });
      setAuthUser(user);
      const redirectTo = page.url.searchParams.get('redirect');
      await goto(redirectTo?.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/');
    } catch (error) {
      errorMessage =
        error instanceof ApiError && error.status === 401
          ? t($language, 'invalidCredentials')
          : error instanceof Error
            ? error.message
            : t($language, 'signInFailed');
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>{t($language, 'signIn')} | {t($language, 'appName')}</title>
</svelte:head>

<main class="auth-page">
  <section class="card auth-card stack">
    <div class="stack-sm">
      <div class="auth-brand"><span class="brand-mark">S</span>{t($language, 'appName')}</div>
      <h1>{t($language, 'signIn')}</h1>
      <p class="muted">{t($language, 'signInDescription')}</p>
    </div>

    <form class="stack" onsubmit={submit}>
      <label class="stack-sm">
        <span>{t($language, 'username')}</span>
        <input bind:value={username} autocomplete="username" required />
      </label>
      <label class="stack-sm">
        <span>{t($language, 'password')}</span>
        <input bind:value={password} type="password" autocomplete="current-password" required />
      </label>

      {#if errorMessage}<p class="error-message">{errorMessage}</p>{/if}

      <button class="primary-button" type="submit" disabled={submitting}>
        {submitting ? t($language, 'signingIn') : t($language, 'signIn')}
      </button>
    </form>

    <p class="auth-switch">
      {t($language, 'needAccount')} <a href="/register">{t($language, 'signUp')}</a>
    </p>
  </section>
</main>
