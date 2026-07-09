<script lang="ts">
  import { goto } from '$app/navigation';
  import { ApiError, registerUser } from '$lib/api/client';
  import { setAuthUser } from '$lib/auth/session';
  import { validatePassword, validateUsername } from '$lib/auth/validation';
  import { language, t } from '$lib/i18n';

  let username = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let errorMessage = $state('');
  let submitting = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = '';

    const usernameResult = validateUsername(username);
    if (!usernameResult.ok) {
      errorMessage = t($language, usernameResult.message);
      return;
    }
    const passwordResult = validatePassword(password);
    if (!passwordResult.ok) {
      errorMessage = t($language, passwordResult.message);
      return;
    }
    if (password !== confirmPassword) {
      errorMessage = t($language, 'passwordsDoNotMatch');
      return;
    }

    submitting = true;
    try {
      const user = await registerUser({ username, password });
      setAuthUser(user);
      await goto('/');
    } catch (error) {
      errorMessage =
        error instanceof ApiError && error.status === 409
          ? t($language, 'usernameTaken')
          : error instanceof Error
            ? error.message
            : t($language, 'signUpFailed');
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>{t($language, 'signUp')} | {t($language, 'appName')}</title>
</svelte:head>

<main class="auth-page">
  <section class="card auth-card stack">
    <div class="stack-sm">
      <div class="auth-brand"><span class="brand-mark">S</span>{t($language, 'appName')}</div>
      <h1>{t($language, 'signUp')}</h1>
      <p class="muted">{t($language, 'signUpDescription')}</p>
    </div>

    <form class="stack" onsubmit={submit}>
      <label class="stack-sm">
        <span>{t($language, 'username')}</span>
        <input bind:value={username} autocomplete="username" required />
        <small class="muted">{t($language, 'usernameRules')}</small>
      </label>
      <label class="stack-sm">
        <span>{t($language, 'password')}</span>
        <input bind:value={password} type="password" autocomplete="new-password" required />
        <small class="muted">{t($language, 'passwordRules')}</small>
      </label>
      <label class="stack-sm">
        <span>{t($language, 'confirmPassword')}</span>
        <input bind:value={confirmPassword} type="password" autocomplete="new-password" required />
      </label>

      {#if errorMessage}<p class="error-message">{errorMessage}</p>{/if}

      <button class="primary-button" type="submit" disabled={submitting}>
        {submitting ? t($language, 'signingUp') : t($language, 'signUp')}
      </button>
    </form>

    <p class="auth-switch">
      {t($language, 'haveAccount')} <a href="/login">{t($language, 'signIn')}</a>
    </p>
  </section>
</main>
