import type { AgentLogEvent, FlowDetail, FlowRun, FlowSummary, FlowUpsertPayload, SaveRunPayload, TaskMeta } from '$lib/types/symflow';
import type { AuthUser, LoginPayload, RegisterPayload } from '$lib/auth/types';
import { slugFromName } from '$lib/utils/format';

const now = () => new Date().toISOString();

const flows = new Map<string, FlowDetail>([
  [
    'demo-flow',
    {
      id: 'demo-flow',
      name: 'demo-flow',
      created_at: now(),
      dsl_script: `import { task } from '@symflow/runtime';

export async function main(input: { url?: string }) {
  return task('web_scraper', { url: input.url ?? 'https://example.com' });
}`
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

export async function saveRunMock(payload: SaveRunPayload): Promise<FlowRun> {
  await delay();
  const run: FlowRun = {
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

export const saveRun = saveRunMock;

export async function getRunMock(runId: string): Promise<FlowRun> {
  await delay(120);
  const run = runs.get(runId);
  if (!run) throw new Error(`Run ${runId} not found`);
  return run;
}

export const getRun = getRunMock;

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

const mockTasks: TaskMeta[] = [
  {
    name: 'web_scraper',
    label: 'Web Scraper',
    description: 'Fetch a web page.',
    category: 'data',
    runtime: 'remote',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url']
    },
    output_schema: {
      type: 'object',
      properties: { html: { type: 'string' }, raw_text: { type: 'string' } },
      required: ['html', 'raw_text']
    }
  },
  {
    name: 'local_file_reader',
    label: 'Local File Reader',
    description: 'Read a sandbox file.',
    category: 'storage',
    runtime: 'remote',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path']
    },
    output_schema: {
      type: 'object',
      properties: { content: { type: 'string' } },
      required: ['content']
    }
  },
  {
    name: 'ai_agent',
    label: 'AI Agent',
    description: 'Complete a goal with an LLM.',
    category: 'ai',
    runtime: 'remote',
    input_schema: {
      type: 'object',
      properties: {
        model: { type: 'string' },
        goal: { type: 'string' },
        context: {}
      },
      required: ['goal']
    },
    output_schema: {
      type: 'object',
      properties: { result: { type: 'string' } },
      required: ['result']
    }
  },
  {
    name: 'pdf_report',
    label: 'PDF Report',
    description: 'Create a small PDF file.',
    category: 'documents',
    runtime: 'remote',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        rows: { type: 'array', items: { type: 'object' } },
        csv: { type: 'string' },
        filename: { type: 'string' }
      },
      required: ['title']
    },
    output_schema: {
      type: 'object',
      properties: {
        filename: { type: 'string' },
        path: { type: 'string' },
        size_bytes: { type: 'integer' },
        content_base64: { type: 'string' }
      },
      required: ['filename', 'path', 'size_bytes', 'content_base64']
    }
  }
];

export async function listTasksMock(): Promise<TaskMeta[]> {
  await delay(20);
  return mockTasks;
}

export const listTasks = listTasksMock;

export async function executeTask(name: string, input: unknown): Promise<unknown> {
  await delay(20);
  if (name === 'web_scraper') return { url: (input as { url?: string }).url, raw_text: 'Mock page', html: '<p>Mock page</p>' };
  if (name === 'local_file_reader') return { path: (input as { path?: string }).path, content: 'Mock file', size: 9 };
  if (name === 'ai_agent') {
    return {
      result: JSON.stringify({
        title: 'Mock article',
        summary: 'Mock summary',
        author: 'Mock author',
        published_at: new Date().toISOString(),
        category: 'Mock category'
      })
    };
  }
  if (name === 'pdf_report') {
    return {
      filename: (input as { filename?: string }).filename ?? 'report.pdf',
      path: '/tmp/report.pdf',
      size_bytes: 1024,
      content_base64:
        'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAxMDEgPj4Kc3RyZWFtCkJUCi9GMSAxOCBUZgo3MiA3NjAgVGQKKE1vY2sgUERGIHJlcG9ydCkgVGoKRVQKQlQKL0YxIDExIFRmCjcyIDc0MCBUZAooR2VuZXJhdGVkIGluIG1vY2sgbW9kZSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQxIDAwMDAwIG4gCjAwMDAwMDAzOTIgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo0NjIKJSVFT0YK'
    };
  }
  throw new Error(`Task ${name} not found`);
}
