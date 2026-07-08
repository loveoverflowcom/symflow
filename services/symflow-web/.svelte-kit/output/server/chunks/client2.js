//#region src/lib/api/mock.ts
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var flows = /* @__PURE__ */ new Map([["demo-flow", {
	id: "demo-flow",
	name: "demo-flow",
	created_at: now(),
	dsl_script: `name: demo-flow
steps:
  - id: read_manual_trigger
    kind: manual_trigger
  - id: scrape_page
    kind: web_scraper
    inputs:
      url: "https://example.com"`
}]]);
var runs = /* @__PURE__ */ new Map();
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
async function getFlowMock(id) {
	await delay();
	const flow = flows.get(id);
	if (!flow) throw new Error(`Flow ${id} not found`);
	return flow;
}
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
//#endregion
//#region src/lib/api/client.ts
var apiBaseUrl = "http://127.0.0.1:8787";
var useMockApi = String("").toLowerCase() === "true";
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
	return new URL(path, `${apiBaseUrl}/`).toString();
}
async function listFlows(fetchImpl = fetch) {
	if (useMockApi) return listFlowsMock();
	return parseResponse(await fetchImpl(createUrl("/api/flows")));
}
async function getFlow(id, fetchImpl = fetch) {
	if (useMockApi) return getFlowMock(id);
	return parseResponse(await fetchImpl(createUrl(`/api/flows/${id}`)));
}
async function getRun(runId, fetchImpl = fetch) {
	if (useMockApi) return getRunMock(runId);
	return parseResponse(await fetchImpl(createUrl(`/api/runs/${runId}`)));
}
function getRunLogsWebSocketUrl(runId) {
	if (useMockApi) return "";
	const url = new URL(createUrl(`/api/runs/${runId}/logs`));
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	return url.toString();
}
function parseLogMessage(data) {
	return JSON.parse(data);
}
//#endregion
export { parseLogMessage as a, listFlows as i, getRun as n, getRunLogsWebSocketUrl as r, getFlow as t };
