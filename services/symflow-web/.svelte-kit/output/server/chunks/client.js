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
//#endregion
//#region src/lib/api/http.ts
var http_exports = /* @__PURE__ */ __exportAll({
	ApiError: () => ApiError,
	createUrl: () => createUrl,
	executeTask: () => executeTask$2,
	getFlow: () => getFlow$2,
	getRun: () => getRun$2,
	listFlows: () => listFlows$2,
	listTasks: () => listTasks$2,
	parseLogMessage: () => parseLogMessage$1,
	parseResponse: () => parseResponse,
	saveFlow: () => saveFlow$1,
	saveRun: () => saveRun$1
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
async function saveRun$1(payload, fetchImpl = fetch) {
	return parseResponse(await fetchImpl(createUrl("/api/runs"), {
		method: "POST",
		headers: { "content-type": "application/json" },
		credentials: "include",
		body: JSON.stringify(payload)
	}));
}
async function executeTask$2(name, input, fetchImpl = fetch) {
	return parseResponse(await fetchImpl(createUrl(`/api/tasks/${encodeURIComponent(name)}`), {
		method: "POST",
		headers: { "content-type": "application/json" },
		credentials: "include",
		body: JSON.stringify(input)
	}));
}
async function getRun$2(runId, fetchImpl = fetch) {
	return parseResponse(await fetchImpl(createUrl(`/api/runs/${runId}`), { credentials: "include" }));
}
async function listTasks$2(fetchImpl = fetch) {
	return parseResponse(await fetchImpl(createUrl("/api/tasks"), { credentials: "include" }));
}
function parseLogMessage$1(data) {
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
function slugFromName(name) {
	return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
//#endregion
//#region src/lib/api/mock.ts
var mock_exports = /* @__PURE__ */ __exportAll({
	executeTask: () => executeTask$1,
	getFlow: () => getFlow$1,
	getFlowMock: () => getFlowMock,
	getMe: () => getMe$1,
	getMeMock: () => getMeMock,
	getRun: () => getRun$1,
	getRunMock: () => getRunMock,
	listFlows: () => listFlows$1,
	listFlowsMock: () => listFlowsMock,
	listTasks: () => listTasks$1,
	listTasksMock: () => listTasksMock,
	loginUser: () => loginUser,
	loginUserMock: () => loginUserMock,
	logoutUser: () => logoutUser,
	logoutUserMock: () => logoutUserMock,
	parseLogMessage: () => parseLogMessage,
	registerUser: () => registerUser,
	registerUserMock: () => registerUserMock,
	saveFlow: () => saveFlow,
	saveFlowMock: () => saveFlowMock,
	saveRun: () => saveRun,
	saveRunMock: () => saveRunMock
});
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var flows = /* @__PURE__ */ new Map([["demo-flow", {
	id: "demo-flow",
	name: "demo-flow",
	created_at: now(),
	dsl_script: `import { task } from '@symflow/runtime';

export async function main(input: { url?: string }) {
  return task('web_scraper', { url: input.url ?? 'https://example.com' });
}`
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
		dsl_script: payload.dsl_script,
		created_at: existing?.created_at ?? now()
	};
	flows.set(id, saved);
	return saved;
}
var saveFlow = saveFlowMock;
async function saveRunMock(payload) {
	await delay();
	const run = {
		id: `run-${Math.random().toString(36).slice(2, 10)}`,
		flow_id: payload.flow_id,
		status: payload.status,
		initial_inputs: payload.initial_input,
		output: payload.output,
		execution_logs: payload.logs,
		error: payload.error,
		created_at: now(),
		finished_at: now()
	};
	runs.set(run.id, run);
	return run;
}
var saveRun = saveRunMock;
async function getRunMock(runId) {
	await delay(120);
	const run = runs.get(runId);
	if (!run) throw new Error(`Run ${runId} not found`);
	return run;
}
var getRun$1 = getRunMock;
function parseLogMessage(data) {
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
var mockTasks = [
	{
		name: "web_scraper",
		label: "Web Scraper",
		description: "Fetch a web page.",
		category: "data",
		runtime: "remote",
		input_schema: {
			type: "object",
			properties: { url: { type: "string" } },
			required: ["url"]
		},
		output_schema: {
			type: "object",
			properties: {
				html: { type: "string" },
				raw_text: { type: "string" }
			},
			required: ["html", "raw_text"]
		}
	},
	{
		name: "local_file_reader",
		label: "Local File Reader",
		description: "Read a sandbox file.",
		category: "storage",
		runtime: "remote",
		input_schema: {
			type: "object",
			properties: { path: { type: "string" } },
			required: ["path"]
		},
		output_schema: {
			type: "object",
			properties: { content: { type: "string" } },
			required: ["content"]
		}
	},
	{
		name: "ai_agent",
		label: "AI Agent",
		description: "Complete a goal with an LLM.",
		category: "ai",
		runtime: "remote",
		input_schema: {
			type: "object",
			properties: {
				model: { type: "string" },
				goal: { type: "string" },
				context: {}
			},
			required: ["goal"]
		},
		output_schema: {
			type: "object",
			properties: { result: { type: "string" } },
			required: ["result"]
		}
	},
	{
		name: "pdf_report",
		label: "PDF Report",
		description: "Create a small PDF file.",
		category: "documents",
		runtime: "remote",
		input_schema: {
			type: "object",
			properties: {
				title: { type: "string" },
				content: { type: "string" },
				rows: {
					type: "array",
					items: { type: "object" }
				},
				csv: { type: "string" },
				filename: { type: "string" }
			},
			required: ["title"]
		},
		output_schema: {
			type: "object",
			properties: {
				filename: { type: "string" },
				path: { type: "string" },
				size_bytes: { type: "integer" },
				content_base64: { type: "string" }
			},
			required: [
				"filename",
				"path",
				"size_bytes",
				"content_base64"
			]
		}
	}
];
async function listTasksMock() {
	await delay(20);
	return mockTasks;
}
var listTasks$1 = listTasksMock;
async function executeTask$1(name, input) {
	await delay(20);
	if (name === "web_scraper") return {
		url: input.url,
		raw_text: "Mock page",
		html: "<p>Mock page</p>"
	};
	if (name === "local_file_reader") return {
		path: input.path,
		content: "Mock file",
		size: 9
	};
	if (name === "ai_agent") return { result: JSON.stringify({
		title: "Mock article",
		summary: "Mock summary",
		author: "Mock author",
		published_at: (/* @__PURE__ */ new Date()).toISOString(),
		category: "Mock category"
	}) };
	if (name === "pdf_report") return {
		filename: input.filename ?? "report.pdf",
		path: "/tmp/report.pdf",
		size_bytes: 1024,
		content_base64: "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAxMDEgPj4Kc3RyZWFtCkJUCi9GMSAxOCBUZgo3MiA3NjAgVGQKKE1vY2sgUERGIHJlcG9ydCkgVGoKRVQKQlQKL0YxIDExIFRmCjcyIDc0MCBUZAooR2VuZXJhdGVkIGluIG1vY2sgbW9kZSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQxIDAwMDAwIG4gCjAwMDAwMDAzOTIgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo0NjIKJSVFT0YK"
	};
	throw new Error(`Task ${name} not found`);
}
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
async function executeTask(name, input, fetchImpl = fetch) {
	return api.executeTask(name, input, fetchImpl);
}
async function getRun(runId, fetchImpl = fetch) {
	return api.getRun(runId, fetchImpl);
}
async function listTasks(fetchImpl = fetch) {
	return api.listTasks(fetchImpl);
}
async function getMe(fetchImpl = fetch) {
	return api.getMe(fetchImpl);
}
//#endregion
export { listFlows as a, prettyJson as c, getRun as i, ApiError as l, getFlow as n, listTasks as o, getMe as r, formatDate as s, executeTask as t };
