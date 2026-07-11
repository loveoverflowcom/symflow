import type { TaskFn } from '../types';

export interface RemoteTaskOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export function remoteTask(name: string, options: RemoteTaskOptions = {}): TaskFn {
  return async (input) => {
    const fetchImpl = options.fetch ?? fetch;
    const baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
    const response = await fetchImpl(`${baseUrl}/api/tasks/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(options.timeoutMs ?? 120_000)
    });

    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(`Task "${name}" failed (${response.status}): ${detail || response.statusText}`);
    }
    return response.json();
  };
}
