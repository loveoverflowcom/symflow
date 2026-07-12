<script lang="ts">
  import type { ViewError } from '$lib/api/errors';
  import AppShell from '$lib/components/AppShell.svelte';
  import InlineError from '$lib/components/InlineError.svelte';
  import { language, t } from '$lib/i18n';
  import { ApiError, deleteFlow } from '$lib/api/client';
  import { formatDate } from '$lib/utils/format';
  import type { FlowSummary } from '$lib/types/symflow';

  let { data } = $props<{ data: { flows: FlowSummary[]; error: ViewError | null } }>();
  let flows = $state<FlowSummary[]>([]);
  let selectedFlow = $state<FlowSummary | null>(null);
  let openMenuId = $state<string | null>(null);
  let isDeleting = $state(false);
  let deleteError = $state('');

  function handleWindowClick(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.flow-menu')) {
      openMenuId = null;
    }
  }

  $effect(() => {
    flows = data.flows;
  });

  function openDeleteDialog(flow: FlowSummary) {
    openMenuId = null;
    selectedFlow = flow;
    deleteError = '';
  }

  function toggleMenu(flowId: string) {
    openMenuId = openMenuId === flowId ? null : flowId;
  }

  function closeDeleteDialog() {
    if (isDeleting) return;
    selectedFlow = null;
    deleteError = '';
  }

  async function confirmDelete() {
    if (!selectedFlow) return;
    isDeleting = true;
    deleteError = '';
    const flowId = selectedFlow.id;
    try {
      await deleteFlow(flowId);
      flows = flows.filter((flow) => flow.id !== flowId);
      selectedFlow = null;
    } catch (error) {
      deleteError = error instanceof ApiError ? error.message : t($language, 'failedDeleteFlow');
    } finally {
      isDeleting = false;
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<svelte:head>
  <title>{t($language, 'flowsTitle')} | {t($language, 'appName')}</title>
</svelte:head>

<AppShell>
  {#snippet actions()}
    <a class="primary-button" href="/flows/new">{t($language, 'newFlow')}</a>
  {/snippet}

  <div class="page-title-block">
    <h1>{t($language, 'flowsTitle')}</h1>
    <p class="subtitle">{t($language, 'flowsSubtitle')}</p>
  </div>

  {#if data.error}
    <InlineError error={{ ...data.error, title: t($language, 'unableLoadFlows') }} retryHref="/flows" />
  {:else if flows.length === 0}
    <section class="card empty-state">
      <h2>{t($language, 'noFlowsYet')}</h2>
      <p class="muted">{t($language, 'noFlowsDescription')}</p>
    </section>
  {:else}
    <section class="flow-list">
      {#each flows as flow}
        <article class="card flow-card">
          <a class="flow-link" href={`/flows/${flow.id}`}>
            <div class="flow-meta">
              <h2>{flow.name}</h2>
              <p class="mono">{flow.id}</p>
            </div>
            <p class="muted flow-created">{t($language, 'created', { date: formatDate(flow.created_at) })}</p>
          </a>
          <div class="flow-menu">
            <button
              class="more-button"
              type="button"
              onclick={() => toggleMenu(flow.id)}
              aria-label={`More options: ${flow.name}`}
              aria-expanded={openMenuId === flow.id}
              aria-haspopup="menu"
            >
              <span aria-hidden="true">•••</span>
            </button>
            {#if openMenuId === flow.id}
              <div class="flow-menu-popover" role="menu">
                <button class="menu-delete" type="button" role="menuitem" onclick={() => openDeleteDialog(flow)}>
                  {t($language, 'deleteFlow')}
                </button>
              </div>
            {/if}
          </div>
        </article>
      {/each}
    </section>
  {/if}

  {#if selectedFlow}
    <div class="dialog-backdrop" role="presentation" onclick={closeDeleteDialog}>
      <dialog
        open
        class="confirm-dialog card"
        aria-labelledby="delete-dialog-title"
        onclick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-dialog-title">{t($language, 'deleteFlow')}</h2>
        <p>{t($language, 'confirmDeleteFlow', { name: selectedFlow.name })}</p>
        {#if deleteError}<p class="error-message">{deleteError}</p>{/if}
        <div class="dialog-actions">
          <button class="secondary-button" type="button" onclick={closeDeleteDialog} disabled={isDeleting}>
            {t($language, 'cancel')}
          </button>
          <button class="danger-button" type="button" onclick={confirmDelete} disabled={isDeleting}>
            {isDeleting ? t($language, 'deleting') : t($language, 'deleteFlow')}
          </button>
        </div>
      </dialog>
    </div>
  {/if}
</AppShell>

<style>
  .flow-list { display: grid; gap: .6rem; }
  .flow-card { position: relative; display: flex; min-height: 58px; align-items: center; justify-content: space-between; gap: 1rem; padding: .7rem .85rem .7rem 1rem; border-radius: 12px; }
  .flow-link { display: flex; min-width: 0; flex: 1; align-items: center; justify-content: space-between; gap: 1rem; color: inherit; text-decoration: none; }
  .flow-meta { display: grid; min-width: 0; gap: .18rem; }
  .flow-meta h2 { overflow: hidden; margin: 0; text-overflow: ellipsis; white-space: nowrap; font-size: .92rem; }
  .flow-meta p, .flow-created { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .72rem; }
  .flow-created { flex: 0 0 auto; }
  .flow-menu { position: relative; flex: 0 0 auto; }
  .more-button { display: grid; width: 32px; height: 32px; place-items: center; border: 0; border-radius: 8px; background: transparent; color: var(--text-muted); font-size: 1rem; letter-spacing: .08em; line-height: 1; cursor: pointer; }
  .more-button:hover, .more-button[aria-expanded='true'] { background: var(--bg-input); color: var(--text-secondary); }
  .flow-menu-popover { position: absolute; z-index: 5; top: calc(100% + .35rem); right: 0; min-width: 130px; padding: .25rem; border: 1px solid var(--border-card); border-radius: 9px; background: var(--bg-card); box-shadow: var(--shadow-dropdown); }
  .menu-delete { display: block; width: 100%; border: 0; border-radius: 6px; padding: .5rem .6rem; background: transparent; color: #b52d3c; text-align: left; font: inherit; font-size: .8rem; cursor: pointer; }
  .menu-delete:hover { background: rgba(181, 45, 60, .08); }
  .danger-button { border: 1px solid rgba(181, 45, 60, .35); border-radius: 8px; padding: .5rem .7rem; background: rgba(181, 45, 60, .08); color: #b52d3c; font: inherit; cursor: pointer; }
  .danger-button:disabled { cursor: wait; opacity: .65; }
  .dialog-backdrop { position: fixed; z-index: 1000; inset: 0; isolation: isolate; display: grid; place-items: center; padding: 1rem; background: rgba(15, 20, 30, .48); }
  .confirm-dialog { width: min(420px, 100%); box-sizing: border-box; }
  .confirm-dialog h2 { margin-top: 0; }
  .confirm-dialog p { color: var(--text-muted); }
  .dialog-actions { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1.2rem; }
</style>
