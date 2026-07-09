import * as httpApi from '$lib/api/http';
import * as authHttpApi from '$lib/api/auth';
import * as mockApi from '$lib/api/mock';
import { resolveApiMode, type ApiEnv, type ApiMode } from '$lib/api/mode';
import type { AgentLogEvent, FlowDetail, FlowRun, FlowSummary, FlowUpsertPayload } from '$lib/types/symflow';
import type { AuthUser, LoginPayload, RegisterPayload } from '$lib/auth/types';

export type { ApiMode } from '$lib/api/mode';
export { ApiError } from '$lib/api/http';

type ApiClient = {
  listFlows: typeof httpApi.listFlows;
  getFlow: typeof httpApi.getFlow;
  saveFlow: typeof httpApi.saveFlow;
  triggerRun: typeof httpApi.triggerRun;
  getRun: typeof httpApi.getRun;
  getRunLogsWebSocketUrl: typeof httpApi.getRunLogsWebSocketUrl;
  parseLogMessage: typeof httpApi.parseLogMessage;
  registerUser: typeof authHttpApi.registerUser;
  loginUser: typeof authHttpApi.loginUser;
  logoutUser: typeof authHttpApi.logoutUser;
  getMe: typeof authHttpApi.getMe;
};

const apiClients: Record<ApiMode, ApiClient> = {
  production: { ...httpApi, ...authHttpApi },
  mock: mockApi,
};

export function createApiClient(mode: ApiMode = resolveApiMode(import.meta.env as unknown as ApiEnv)): ApiClient {
  return apiClients[mode];
}

const api = createApiClient();

export async function listFlows(fetchImpl: typeof fetch = fetch): Promise<FlowSummary[]> {
  return api.listFlows(fetchImpl);
}

export async function getFlow(id: string, fetchImpl: typeof fetch = fetch): Promise<FlowDetail> {
  return api.getFlow(id, fetchImpl);
}

export async function saveFlow(payload: FlowUpsertPayload, fetchImpl: typeof fetch = fetch): Promise<FlowDetail> {
  return api.saveFlow(payload, fetchImpl);
}

export async function triggerRun(
  flowId: string,
  inputs: unknown,
  fetchImpl: typeof fetch = fetch
): Promise<FlowRun> {
  return api.triggerRun(flowId, inputs, fetchImpl);
}

export async function getRun(runId: string, fetchImpl: typeof fetch = fetch): Promise<FlowRun> {
  return api.getRun(runId, fetchImpl);
}

export function getRunLogsWebSocketUrl(runId: string): string {
  return api.getRunLogsWebSocketUrl(runId);
}

export function parseLogMessage(data: string): AgentLogEvent {
  return api.parseLogMessage(data);
}

export async function registerUser(
  payload: RegisterPayload,
  fetchImpl: typeof fetch = fetch
): Promise<AuthUser> {
  return api.registerUser(payload, fetchImpl);
}

export async function loginUser(
  payload: LoginPayload,
  fetchImpl: typeof fetch = fetch
): Promise<AuthUser> {
  return api.loginUser(payload, fetchImpl);
}

export async function logoutUser(fetchImpl: typeof fetch = fetch): Promise<void> {
  return api.logoutUser(fetchImpl);
}

export async function getMe(fetchImpl: typeof fetch = fetch): Promise<AuthUser> {
  return api.getMe(fetchImpl);
}
