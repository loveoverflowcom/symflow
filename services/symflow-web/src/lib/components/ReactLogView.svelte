<script lang="ts">
  import { onMount } from 'svelte';
  import { getRunLogsWebSocketUrl, parseLogMessage } from '$lib/api/client';
  import { language, t } from '$lib/i18n';
  import type { AgentLogEvent } from '$lib/types/symflow';
  import { formatDate, prettyJson } from '$lib/utils/format';

  let {
    runId,
    initialLogs = []
  } = $props<{
    runId: string;
    initialLogs?: AgentLogEvent[];
  }>();

  let initialized = $state(false);
  let logs = $state<AgentLogEvent[]>([]);
  let wsStateKey = $state('connecting');

  $effect(() => {
    if (initialized) return;
    logs = initialLogs.slice();
    initialized = true;
  });

  function pushLog(log: AgentLogEvent) {
    const fingerprint = JSON.stringify(log);
    const exists = logs.some((entry) => JSON.stringify(entry) === fingerprint);
    if (!exists) {
      logs = [...logs, log];
    }
  }

  onMount(() => {
    let socket: WebSocket | null = null;
    const wsUrl = getRunLogsWebSocketUrl(runId);

    if (!wsUrl) {
      wsStateKey = 'mockMode';
      return;
    }

    try {
      socket = new WebSocket(wsUrl);
      socket.onopen = () => {
        wsStateKey = 'live';
      };
      socket.onerror = () => {
        wsStateKey = 'unavailable';
      };
      socket.onclose = () => {
        wsStateKey = 'disconnected';
      };
      socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            pushLog(parseLogMessage(event.data));
          } catch {
            wsStateKey = 'invalidLogPayload';
          }
        }
      };
    } catch {
      wsStateKey = 'unavailable';
    }

    return () => {
      socket?.close();
    };
  });
</script>

<section class="stack card">
  <div class="row-between">
    <h2>{t($language, 'reactLog')}</h2>
    <span class="muted">{t($language, wsStateKey)}</span>
  </div>

  {#if logs.length === 0}
    <p class="muted">{t($language, 'noLogEvents')}</p>
  {:else}
    <div class="stack">
      {#each logs as log, index}
        <article class="log-entry">
          <div class="row-between log-meta">
            <strong>{log.type ?? t($language, 'event')}</strong>
            <span class="muted">
              #{index + 1}
              {#if log.iter !== undefined}
                · {t($language, 'iter')} {log.iter}
              {/if}
              {#if log.timestamp}
                · {formatDate(log.timestamp)}
              {/if}
            </span>
          </div>

          {#if log.stepId}
            <p><strong>{t($language, 'step')}:</strong> {log.stepId}</p>
          {/if}

          {#if log.tool}
            <p><strong>{t($language, 'tool')}:</strong> {log.tool}</p>
          {/if}

          {#if log.text}
            <p>{log.text}</p>
          {/if}

          {#if log.arguments !== undefined}
            <pre>{prettyJson(log.arguments)}</pre>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</section>
