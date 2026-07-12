import { isWorkflowFile, resolveFileAsBlob } from '../file';
import type { TaskFn } from '../types';

export interface RemoteTaskOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Base URL of symflow-files. Defaults to `baseUrl`. */
  filesBaseUrl?: string;
}

export function remoteTask(name: string, options: RemoteTaskOptions = {}): TaskFn {
  return async (input) => {
    const fetchImpl = options.fetch ?? fetch;
    const baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
    const filesBaseUrl = (options.filesBaseUrl ?? baseUrl).replace(/\/$/, '');
    const serialisableInput = await uploadFileInputs(input, filesBaseUrl, fetchImpl);
    const response = await fetchImpl(`${baseUrl}/api/tasks/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(serialisableInput),
      signal: AbortSignal.timeout(options.timeoutMs ?? 120_000)
    });

    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(`Task "${name}" failed (${response.status}): ${detail || response.statusText}`);
    }
    return response.json();
  };
}

/** Replaces File and Blob leaves with their public symflow-files URLs. */
async function uploadFileInputs(
  input: unknown,
  filesBaseUrl: string,
  fetchImpl: typeof fetch
): Promise<unknown> {
  if (isWorkflowFile(input) && typeof input !== 'string') {
    const blob = await resolveFileAsBlob(input);
    const formData = new FormData();
    const filename = typeof File !== 'undefined' && input instanceof File ? input.name : 'upload';
    formData.append('file', blob, filename);

    const response = await fetchImpl(`${filesBaseUrl}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`symflow-files upload failed: ${response.status}`);
    }

    const { url } = await response.json() as { url?: unknown };
    if (typeof url !== 'string' || !url) {
      throw new Error('symflow-files upload returned no public URL');
    }
    return url;
  }

  if (Array.isArray(input)) {
    return Promise.all(input.map((item) => uploadFileInputs(item, filesBaseUrl, fetchImpl)));
  }

  if (input && typeof input === 'object') {
    const entries = await Promise.all(Object.entries(input).map(async ([key, value]) => [
      key,
      await uploadFileInputs(value, filesBaseUrl, fetchImpl)
    ]));
    return Object.fromEntries(entries);
  }

  return input;
}
