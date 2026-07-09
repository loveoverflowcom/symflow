import type { AgentLogEvent, FlowDetail, FlowRun, FlowSummary, FlowUpsertPayload, StepExecution } from '$lib/types/symflow';
import type { AuthUser, LoginPayload, RegisterPayload } from '$lib/auth/types';
import { formatJsonDsl } from '$lib/utils/dsl';
import { slugFromName } from '$lib/utils/format';

const now = () => new Date().toISOString();

const flows = new Map<string, FlowDetail>([
  [
    'demo-flow',
    {
      id: 'demo-flow',
      name: 'demo-flow',
      created_at: now(),
      dsl_script: JSON.stringify(
        {
          flow_id: 'demo-flow',
          name: 'Demo flow',
          steps: [
            {
              id: 'read_manual_trigger',
              type: 'manual_trigger',
              with: { message: 'Demo input' }
            },
            {
              id: 'scrape_page',
              type: 'web_scraper',
              needs: ['read_manual_trigger'],
              with: { url: 'https://example.com' }
            }
          ]
        },
        null,
        2
      )
    }
  ]
]);

const runs = new Map<string, FlowRun>();
let currentUser: AuthUser | null = {
  id: '00000000-0000-0000-0000-000000000001',
  username: 'mock-user'
};

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
    dsl_script: formatJsonDsl(payload.dsl_script),
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

export async function registerUserMock(payload: RegisterPayload): Promise<AuthUser> {
  await delay();
  currentUser = {
    id: `mock-user-${Math.random().toString(36).slice(2, 10)}`,
    username: payload.username.toLowerCase()
  };
  return currentUser;
}

export const registerUser = registerUserMock;

export async function loginUserMock(payload: LoginPayload): Promise<AuthUser> {
  await delay();
  currentUser = {
    id: currentUser?.id ?? '00000000-0000-0000-0000-000000000001',
    username: payload.username.toLowerCase()
  };
  return currentUser;
}

export const loginUser = loginUserMock;

export async function logoutUserMock(): Promise<void> {
  await delay();
  currentUser = null;
}

export const logoutUser = logoutUserMock;

export async function getMeMock(): Promise<AuthUser> {
  await delay(20);
  if (!currentUser) throw new Error('not authenticated');
  return currentUser;
}

export const getMe = getMeMock;
