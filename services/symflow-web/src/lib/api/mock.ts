import type { AgentLogEvent, FlowDetail, FlowRun, FlowSummary, FlowUpsertPayload, StepExecution } from '$lib/types/symflow';
import { slugFromName } from '$lib/utils/format';

const now = () => new Date().toISOString();

const flows = new Map<string, FlowDetail>([
  [
    'demo-flow',
    {
      id: 'demo-flow',
      name: 'demo-flow',
      created_at: now(),
      dsl_script: `name: demo-flow
steps:
  - id: read_manual_trigger
    kind: manual_trigger
  - id: scrape_page
    kind: web_scraper
    inputs:
      url: "https://example.com"`
    }
  ]
]);

const runs = new Map<string, FlowRun>();

const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

function toSummary(flow: FlowDetail): FlowSummary {
  return {
    id: flow.id,
    name: flow.name,
    created_at: flow.created_at
  };
}

function newRun(flowId: string): FlowRun {
  const id = `run-${Math.random().toString(36).slice(2, 10)}`;
  const created_at = now();
  const steps: StepExecution[] = [
    {
      run_id: id,
      step_id: 'read_manual_trigger',
      status: 'COMPLETED',
      resolved_inputs: { prompt: 'Demo input' },
      outputs: { prompt: 'Demo input' },
      agent_logs: [
        {
          type: 'thought',
          text: 'Received user prompt.',
          stepId: 'read_manual_trigger',
          iter: 1,
          timestamp: created_at
        }
      ],
      executed_at: created_at
    },
    {
      run_id: id,
      step_id: 'scrape_page',
      status: 'RUNNING',
      resolved_inputs: { url: 'https://example.com' },
      outputs: null,
      error: null,
      agent_logs: [
        {
          type: 'action',
          tool: 'web_scraper',
          text: 'Fetching https://example.com',
          stepId: 'scrape_page',
          iter: 2,
          timestamp: created_at
        }
      ],
      executed_at: created_at
    }
  ];

  return {
    id,
    flow_id: flowId,
    status: 'RUNNING',
    initial_inputs: { input: 'example' },
    created_at,
    finished_at: null,
    steps
  };
}

export async function listFlowsMock(): Promise<FlowSummary[]> {
  await delay();
  return Array.from(flows.values()).map(toSummary);
}

export const listFlows = listFlowsMock;

export async function getFlowMock(id: string): Promise<FlowDetail> {
  await delay();
  const flow = flows.get(id);
  if (!flow) throw new Error(`Flow ${id} not found`);
  return flow;
}

export const getFlow = getFlowMock;

export async function saveFlowMock(payload: FlowUpsertPayload): Promise<FlowDetail> {
  await delay();
  const id = payload.id || slugFromName(payload.name) || `flow-${Math.random().toString(36).slice(2, 8)}`;
  const existing = flows.get(id);
  const saved: FlowDetail = {
    id,
    name: payload.name,
    dsl_script: payload.dsl_script,
    created_at: existing?.created_at ?? now()
  };
  flows.set(id, saved);
  return saved;
}

export const saveFlow = saveFlowMock;

export async function triggerRunMock(flowId: string): Promise<FlowRun> {
  await delay();
  const run = newRun(flowId);
  runs.set(run.id, run);
  return run;
}

export const triggerRun = triggerRunMock;

export async function getRunMock(runId: string): Promise<FlowRun> {
  await delay(120);
  const run = runs.get(runId);
  if (!run) throw new Error(`Run ${runId} not found`);

  if (run.status === 'RUNNING' && run.steps?.[1]?.status === 'RUNNING') {
    run.steps[1] = {
      ...run.steps[1],
      status: 'COMPLETED',
      outputs: { title: 'Example Domain', word_count: 32 },
      executed_at: now(),
      agent_logs: [
        ...(Array.isArray(run.steps[1].agent_logs) ? (run.steps[1].agent_logs as AgentLogEvent[]) : []),
        {
          type: 'observation',
          text: 'Page fetched successfully.',
          stepId: 'scrape_page',
          iter: 3,
          timestamp: now()
        },
        {
          type: 'finalAnswer',
          text: 'Completed all steps.',
          stepId: 'scrape_page',
          iter: 4,
          timestamp: now()
        }
      ]
    };
    run.status = 'SUCCESS';
    run.finished_at = now();
    runs.set(runId, run);
  }

  return run;
}

export const getRun = getRunMock;

export function getRunLogsWebSocketUrl(_runId: string): string {
  return '';
}

export function parseLogMessage(data: string): AgentLogEvent {
  return JSON.parse(data) as AgentLogEvent;
}
