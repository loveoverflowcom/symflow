<script lang="ts">
  import { onMount } from 'svelte';
  import { getRunLogsWebSocketUrl, parseLogMessage } from '$lib/api/client';
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
  let wsState = $state('Connecting...');

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
      wsState = 'Mock mode';
      return;
    }

    try {
      socket = new WebSocket(wsUrl);
      socket.onopen = () => {
        wsState = 'Live';
      };
      socket.onerror = () => {
        wsState = 'Unavailable';
      };
      socket.onclose = () => {
        wsState = 'Disconnected';
      };
      socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            pushLog(parseLogMessage(event.data));
          } catch {
            wsState = 'Invalid log payload';
          }
        }
      };
    } catch {
      wsState = 'Unavailable';
    }

    return () => {
      socket?.close();
    };
  });
</script>

<section class="stack card">
  <div class="row-between">
    <h2>ReAct log</h2>
    <span class="muted">{wsState}</span>
  </div>

  {#if logs.length === 0}
    <p class="muted">No log events yet.</p>
  {:else}
    <div class="stack">
      {#each logs as log, index}
        <article class="log-entry">
          <div class="row-between log-meta">
            <strong>{log.type ?? 'event'}</strong>
            <span class="muted">
              #{index + 1}
              {#if log.iter !== undefined}
                · iter {log.iter}
              {/if}
              {#if log.timestamp}
                · {formatDate(log.timestamp)}
              {/if}
            </span>
          </div>

          {#if log.stepId}
            <p><strong>Step:</strong> {log.stepId}</p>
          {/if}

          {#if log.tool}
            <p><strong>Tool:</strong> {log.tool}</p>
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
