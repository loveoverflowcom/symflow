<script lang="ts">
  import '../app.css';
  import { setAuthUser } from '$lib/auth/session';
  import type { AuthUser } from '$lib/auth/types';
  import { theme } from '$lib/theme';

  let { children, data } = $props<{
    children?: import('svelte').Snippet;
    data: { user: AuthUser | null };
  }>();

  // Áp dụng data-theme lên <html> ngay từ đầu để tránh flash khi load
  $effect(() => {
    document.documentElement.setAttribute('data-theme', $theme);
  });

  $effect(() => {
    setAuthUser(data.user);
  });
</script>

{@render children?.()}
