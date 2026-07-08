<script lang="ts">
  let { title, subtitle, actions, children } = $props<{
    title: string;
    subtitle?: string;
    actions?: import('svelte').Snippet;
    children?: import('svelte').Snippet;
  }>();
</script>

<div class="page-shell">
  <header class="page-header">
    <div>
      <p class="eyebrow">FlowAgent Engine</p>
      <h1>{title}</h1>
      {#if subtitle}
        <p class="subtitle">{subtitle}</p>
      {/if}
    </div>

    {#if actions}
      <div class="actions">
        {@render actions()}
      </div>
    {/if}
  </header>

  {#if children}
    {@render children()}
  {/if}
</div>
