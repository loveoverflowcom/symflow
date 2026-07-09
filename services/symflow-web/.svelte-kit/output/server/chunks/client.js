import { t as __exportAll } from "./rolldown-runtime.js";
//#region src/lib/api/url.ts
var ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
function resolveApiBaseUrl(env = {
	"BASE_URL": "/",
	"DEV": false,
	"MODE": "production",
	"PROD": true,
	"SSR": true
}) {
	return String(env.PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");
}
function assertAbsoluteBaseUrl(baseUrl) {
	if (baseUrl && !ABSOLUTE_URL_PATTERN.test(baseUrl)) throw new Error(`PUBLIC_API_BASE_URL must be an absolute URL, received "${baseUrl}"`);
}
function createApiUrl(path, baseUrl = resolveApiBaseUrl()) {
	assertAbsoluteBaseUrl(baseUrl);
	if (!baseUrl) return path;
	return new URL(path, `${baseUrl}/`).toString();
}
function createWebSocketUrl(path, baseUrl = resolveApiBaseUrl(), locationOrigin = typeof window !== "undefined" ? window.location.origin : "") {
	assertAbsoluteBaseUrl(baseUrl);
	const targetOrigin = baseUrl || locationOrigin;
	if (!targetOrigin) return "";
	const url = new URL(path, baseUrl ? `${baseUrl}/` : targetOrigin);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	return url.toString();
}
//#endregion
//#region src/lib/api/http.ts
var http_exports = /* @__PURE__ */ __exportAll({
	ApiError: () => ApiError,
	createUrl: () => createUrl,
	getFlow: () => getFlow$2,
	getRun: () => getRun$2,
	getRunLogsWebSocketUrl: () => getRunLogsWebSocketUrl$2,
	listFlows: () => listFlows$2,
	parseLogMessage: () => parseLogMessage$2,
	parseResponse: () => parseResponse,
	saveFlow: () => saveFlow$1,
	triggerRun: () => triggerRun$1
});
var apiBaseUrl = resolveApiBaseUrl();
var ApiError = class extends Error {
	status;
	details;
	constructor(status, message, details = "") {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.details = details;
	}
};
async function parseResponse(response) {
	if (response.ok) {
		if (response.status === 204) return;
		return await response.json();
	}
	const details = (await response.text()).trim();
	const message = details || `Request failed with status ${response.status}`;
	throw new ApiError(response.status, message, details);
}
function createUrl(path) {
	return createApiUrl(path, apiBaseUrl);
}
async function listFlows$2(fetchImpl = fetch) {
	return parseResponse(await fetchImpl(createUrl("/api/flows"), { credentials: "include" }));
}
async function getFlow$2(id, fetchImpl = fetch) {
	return parseResponse(await fetchImpl(createUrl(`/api/flows/${id}`), { credentials: "include" }));
}
async function saveFlow$1(payload, fetchImpl = fetch) {
	const isCreate = !payload.id;
	return parseResponse(await fetchImpl(createUrl(isCreate ? "/api/flows" : `/api/flows/${payload.id}`), {
		method: isCreate ? "POST" : "PUT",
		headers: { "content-type": "application/json" },
		credentials: "include",
		body: JSON.stringify(payload)
	}));
}
async function triggerRun$1(flowId, inputs, fetchImpl = fetch) {
	return parseResponse(await fetchImpl(createUrl(`/api/flows/${flowId}/runs`), {
		method: "POST",
		headers: { "content-type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ inputs })
	}));
}
async function getRun$2(runId, fetchImpl = fetch) {
	return parseResponse(await fetchImpl(createUrl(`/api/runs/${runId}`), { credentials: "include" }));
}
function getRunLogsWebSocketUrl$2(runId) {
	return createWebSocketUrl(`/api/runs/${runId}/logs`, apiBaseUrl);
}
function parseLogMessage$2(data) {
	return JSON.parse(data);
}
//#endregion
//#region src/lib/api/auth.ts
var auth_exports = /* @__PURE__ */ __exportAll({
	getMe: () => getMe$2,
	loginUser: () => loginUser$1,
	logoutUser: () => logoutUser$1,
	registerUser: () => registerUser$1
});
async function registerUser$1(payload, fetchImpl = fetch) {
	return parseResponse(await fetchImpl(createUrl("/api/auth/register"), {
		method: "POST",
		headers: { "content-type": "application/json" },
		credentials: "include",
		body: JSON.stringify(payload)
	}));
}
async function loginUser$1(payload, fetchImpl = fetch) {
	return parseResponse(await fetchImpl(createUrl("/api/auth/login"), {
		method: "POST",
		headers: { "content-type": "application/json" },
		credentials: "include",
		body: JSON.stringify(payload)
	}));
}
async function logoutUser$1(fetchImpl = fetch) {
	return parseResponse(await fetchImpl(createUrl("/api/auth/logout"), {
		method: "POST",
		credentials: "include"
	}));
}
async function getMe$2(fetchImpl = fetch) {
	return parseResponse(await fetchImpl(createUrl("/api/auth/me"), { credentials: "include" }));
}
//#endregion
//#region src/lib/utils/dsl.ts
var DEFAULT_FLOW_DSL = JSON.stringify({
	flow_id: "new-flow",
	name: "New flow",
	steps: [{
		id: "receive_input",
		type: "manual_trigger",
		with: { message: "Hello from Symflow" }
	}]
}, null, 2);
function parseJsonDsl(source) {
	return JSON.parse(source);
}
function formatJsonDsl(source) {
	return JSON.stringify(parseJsonDsl(source), null, 2);
}
//#endregion
//#region src/lib/utils/format.ts
function formatDate(value) {
	if (!value) return "N/A";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat(void 0, {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(date);
}
function prettyJson(value) {
	if (value === void 0) return "";
	return JSON.stringify(value, null, 2);
}
function normalizeLogEntries(raw) {
	if (!Array.isArray(raw)) return [];
	return raw.filter((item) => typeof item === "object" && item !== null);
}
function slugFromName(name) {
	return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
//#endregion
//#region src/lib/api/mock.ts
var mock_exports = /* @__PURE__ */ __exportAll({
	getFlow: () => getFlow$1,
	getFlowMock: () => getFlowMock,
	getMe: () => getMe$1,
	getMeMock: () => getMeMock,
	getRun: () => getRun$1,
	getRunLogsWebSocketUrl: () => getRunLogsWebSocketUrl$1,
	getRunMock: () => getRunMock,
	listFlows: () => listFlows$1,
	listFlowsMock: () => listFlowsMock,
	loginUser: () => loginUser,
	loginUserMock: () => loginUserMock,
	logoutUser: () => logoutUser,
	logoutUserMock: () => logoutUserMock,
	parseLogMessage: () => parseLogMessage$1,
	registerUser: () => registerUser,
	registerUserMock: () => registerUserMock,
	saveFlow: () => saveFlow,
	saveFlowMock: () => saveFlowMock,
	triggerRun: () => triggerRun,
	triggerRunMock: () => triggerRunMock
});
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var flows = /* @__PURE__ */ new Map([["demo-flow", {
	id: "demo-flow",
	name: "demo-flow",
	created_at: now(),
	dsl_script: JSON.stringify({
		flow_id: "demo-flow",
		name: "Demo flow",
		steps: [{
			id: "read_manual_trigger",
			type: "manual_trigger",
			with: { message: "Demo input" }
		}, {
			id: "scrape_page",
			type: "web_scraper",
			needs: ["read_manual_trigger"],
			with: { url: "https://example.com" }
		}]
	}, null, 2)
}]]);
var runs = /* @__PURE__ */ new Map();
var currentUser = {
	id: "00000000-0000-0000-0000-000000000001",
	username: "mock-user"
};
var delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));
function toSummary(flow) {
	return {
		id: flow.id,
		name: flow.name,
		created_at: flow.created_at
	};
}
function newRun(flowId) {
	const id = `run-${Math.random().toString(36).slice(2, 10)}`;
	const created_at = now();
	return {
		id,
		flow_id: flowId,
		status: "RUNNING",
		initial_inputs: { input: "example" },
		created_at,
		finished_at: null,
		steps: [{
			run_id: id,
			step_id: "read_manual_trigger",
			status: "COMPLETED",
			resolved_inputs: { prompt: "Demo input" },
			outputs: { prompt: "Demo input" },
			agent_logs: [{
				type: "thought",
				text: "Received user prompt.",
				stepId: "read_manual_trigger",
				iter: 1,
				timestamp: created_at
			}],
			executed_at: created_at
		}, {
			run_id: id,
			step_id: "scrape_page",
			status: "RUNNING",
			resolved_inputs: { url: "https://example.com" },
			outputs: null,
			error: null,
			agent_logs: [{
				type: "action",
				tool: "web_scraper",
				text: "Fetching https://example.com",
				stepId: "scrape_page",
				iter: 2,
				timestamp: created_at
			}],
			executed_at: created_at
		}]
	};
}
async function listFlowsMock() {
	await delay();
	return Array.from(flows.values()).map(toSummary);
}
var listFlows$1 = listFlowsMock;
async function getFlowMock(id) {
	await delay();
	const flow = flows.get(id);
	if (!flow) throw new Error(`Flow ${id} not found`);
	return flow;
}
var getFlow$1 = getFlowMock;
async function saveFlowMock(payload) {
	await delay();
	const id = payload.id || slugFromName(payload.name) || `flow-${Math.random().toString(36).slice(2, 8)}`;
	const existing = flows.get(id);
	const saved = {
		id,
		name: payload.name,
		dsl_script: formatJsonDsl(payload.dsl_script),
		created_at: existing?.created_at ?? now()
	};
	flows.set(id, saved);
	return saved;
}
var saveFlow = saveFlowMock;
async function triggerRunMock(flowId) {
	await delay();
	const run = newRun(flowId);
	runs.set(run.id, run);
	return run;
}
var triggerRun = triggerRunMock;
async function getRunMock(runId) {
	await delay(120);
	const run = runs.get(runId);
	if (!run) throw new Error(`Run ${runId} not found`);
	if (run.status === "RUNNING" && run.steps?.[1]?.status === "RUNNING") {
		run.steps[1] = {
			...run.steps[1],
			status: "COMPLETED",
			outputs: {
				title: "Example Domain",
				word_count: 32
			},
			executed_at: now(),
			agent_logs: [
				...Array.isArray(run.steps[1].agent_logs) ? run.steps[1].agent_logs : [],
				{
					type: "observation",
					text: "Page fetched successfully.",
					stepId: "scrape_page",
					iter: 3,
					timestamp: now()
				},
				{
					type: "finalAnswer",
					text: "Completed all steps.",
					stepId: "scrape_page",
					iter: 4,
					timestamp: now()
				}
			]
		};
		run.status = "SUCCESS";
		run.finished_at = now();
		runs.set(runId, run);
	}
	return run;
}
var getRun$1 = getRunMock;
function getRunLogsWebSocketUrl$1(_runId) {
	return "";
}
function parseLogMessage$1(data) {
	return JSON.parse(data);
}
async function registerUserMock(payload) {
	await delay();
	currentUser = {
		id: `mock-user-${Math.random().toString(36).slice(2, 10)}`,
		username: payload.username.toLowerCase()
	};
	return currentUser;
}
var registerUser = registerUserMock;
async function loginUserMock(payload) {
	await delay();
	currentUser = {
		id: currentUser?.id ?? "00000000-0000-0000-0000-000000000001",
		username: payload.username.toLowerCase()
	};
	return currentUser;
}
var loginUser = loginUserMock;
async function logoutUserMock() {
	await delay();
	currentUser = null;
}
var logoutUser = logoutUserMock;
async function getMeMock() {
	await delay(20);
	if (!currentUser) throw new Error("not authenticated");
	return currentUser;
}
var getMe$1 = getMeMock;
//#endregion
//#region src/lib/api/mode.ts
function resolveApiMode(env = {
	"BASE_URL": "/",
	"DEV": false,
	"MODE": "production",
	"PROD": true,
	"SSR": true
}) {
	const explicitMode = normalizeMode(env.PUBLIC_API_MODE);
	if (explicitMode) return explicitMode;
	return String(env.PUBLIC_USE_MOCK_API || "").toLowerCase() === "true" ? "mock" : "production";
}
function normalizeMode(value) {
	const normalized = String(value || "").trim().toLowerCase();
	if (normalized === "mock") return "mock";
	if (normalized === "production" || normalized === "prod") return "production";
	return null;
}
//#endregion
//#region src/lib/api/client.ts
var apiClients = {
	production: {
		...http_exports,
		...auth_exports
	},
	mock: mock_exports
};
function createApiClient(mode = resolveApiMode({
	"BASE_URL": "/",
	"DEV": false,
	"MODE": "production",
	"PROD": true,
	"SSR": true
})) {
	return apiClients[mode];
}
var api = createApiClient();
async function listFlows(fetchImpl = fetch) {
	return api.listFlows(fetchImpl);
}
async function getFlow(id, fetchImpl = fetch) {
	return api.getFlow(id, fetchImpl);
}
async function getRun(runId, fetchImpl = fetch) {
	return api.getRun(runId, fetchImpl);
}
function getRunLogsWebSocketUrl(runId) {
	return api.getRunLogsWebSocketUrl(runId);
}
function parseLogMessage(data) {
	return api.parseLogMessage(data);
}
async function getMe(fetchImpl = fetch) {
	return api.getMe(fetchImpl);
}
//#endregion
export { listFlows as a, normalizeLogEntries as c, parseJsonDsl as d, ApiError as f, getRunLogsWebSocketUrl as i, prettyJson as l, getMe as n, parseLogMessage as o, getRun as r, formatDate as s, getFlow as t, DEFAULT_FLOW_DSL as u };
