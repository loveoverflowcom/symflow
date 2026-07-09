import type { AgentLogEvent, FlowDetail, FlowRun, FlowSummary, FlowUpsertPayload } from '$lib/types/symflow';
import { createApiUrl, createWebSocketUrl, resolveApiBaseUrl } from '$lib/api/url';

const apiBaseUrl = resolveApiBaseUrl();

export class ApiError extends Error {
  status: number;
  details: string;

  constructor(status: number, message: string, details = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  const body = await response.text();
  const details = body.trim();
  const message = details || `Request failed with status ${response.status}`;
  throw new ApiError(response.status, message, details);
}

export function createUrl(path: string): string {
  return createApiUrl(path, apiBaseUrl);
}

export async function listFlows(fetchImpl: typeof fetch = fetch): Promise<FlowSummary[]> {
  const response = await fetchImpl(createUrl('/api/flows'), { credentials: 'include' });
  return parseResponse<FlowSummary[]>(response);
}

export async function getFlow(id: string, fetchImpl: typeof fetch = fetch): Promise<FlowDetail> {
  const response = await fetchImpl(createUrl(`/api/flows/${id}`), { credentials: 'include' });
  return parseResponse<FlowDetail>(response);
}

export async function saveFlow(payload: FlowUpsertPayload, fetchImpl: typeof fetch = fetch): Promise<FlowDetail> {
  const isCreate = !payload.id;
  const response = await fetchImpl(createUrl(isCreate ? '/api/flows' : `/api/flows/${payload.id}`), {
    method: isCreate ? 'POST' : 'PUT',
    headers: {
      'content-type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  return parseResponse<FlowDetail>(response);
}

export async function triggerRun(
  flowId: string,
  inputs: unknown,
  fetchImpl: typeof fetch = fetch
): Promise<FlowRun> {
  const response = await fetchImpl(createUrl(`/api/flows/${flowId}/runs`), {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ inputs })
  });

  return parseResponse<FlowRun>(response);
}

export async function getRun(runId: string, fetchImpl: typeof fetch = fetch): Promise<FlowRun> {
  const response = await fetchImpl(createUrl(`/api/runs/${runId}`), { credentials: 'include' });
  return parseResponse<FlowRun>(response);
}

export function getRunLogsWebSocketUrl(runId: string): string {
  return createWebSocketUrl(`/api/runs/${runId}/logs`, apiBaseUrl);
}

export function parseLogMessage(data: string): AgentLogEvent {
  return JSON.parse(data) as AgentLogEvent;
}
