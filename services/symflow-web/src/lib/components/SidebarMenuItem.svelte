<script lang="ts">
  let {
    href,
    label,
    icon,
    active = false,
    expandable = false,
    collapsed = false
  } = $props<{
    href: string;
    label: string;
    icon: 'home' | 'agents' | 'connectors' | 'workflows' | 'settings';
    active?: boolean;
    expandable?: boolean;
    collapsed?: boolean;
  }>();
</script>

<a
  class:active
  class:icon-only={collapsed}
  class="sidebar-menu-item"
  {href}
  aria-current={active ? 'page' : undefined}
  title={collapsed ? label : undefined}
>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {#if icon === 'home'}
      <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
    {:else if icon === 'agents'}
      <circle cx="12" cy="12" r="8" />
      <path d="M9.5 9.5h.01M14.5 9.5h.01M9 14.5c1.8 1.4 4.2 1.4 6 0" />
    {:else if icon === 'connectors'}
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <path d="M10 6.5h4a3.5 3.5 0 0 1 3.5 3.5v4M6.5 10v4A3.5 3.5 0 0 0 10 17.5h4" />
    {:else if icon === 'workflows'}
      <path d="M5 4h14a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2Z" />
      <path d="M3 9v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9M7 13h4M7 16h8" />
    {:else if icon === 'settings'}
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.95 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.95 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.05 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.62.76 1.03 1.4 1H21v4h-.08A1.7 1.7 0 0 0 19.4 15z" />
    {:else}
      <path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z" />
    {/if}
  </svg>
  {#if !collapsed}
    <span>{label}</span>
    {#if expandable}
      <svg class="menu-chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 10 3 3 3-3" />
      </svg>
    {/if}
  {/if}
</a>
