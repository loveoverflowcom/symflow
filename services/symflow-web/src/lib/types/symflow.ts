export type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
export type LogType = 'thought' | 'action' | 'observation' | 'finalAnswer' | 'runStatus' | string;

export interface FlowSummary {
  id: string;
  name: string;
  created_at: string;
}

export interface FlowDetail extends FlowSummary {
  dsl_script: string;
}

export interface FlowRun {
  id: string;
  flow_id: string;
  status: RunStatus;
  initial_inputs?: unknown;
  output?: unknown;
  execution_logs?: ExecutionLog[];
  error?: string | null;
  created_at: string;
  finished_at?: string | null;
}

export interface ExecutionLog {
  type: 'task_start' | 'task_done' | 'task_error' | 'success' | 'error';
  name?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  timestamp: number;
}

export interface SaveRunPayload {
  flow_id: string;
  initial_input: unknown;
  status: 'SUCCESS' | 'FAILED';
  output?: unknown;
  logs: ExecutionLog[];
  error?: string;
}

export interface TaskMeta {
  name: string;
  label: string;
  description: string;
  category: string;
  runtime: 'local' | 'remote';
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
}

export interface AgentLogEvent {
  runId?: string;
  stepId?: string;
  iter?: number;
  type?: LogType;
  text?: string;
  tool?: string;
  arguments?: unknown;
  status?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface FlowUpsertPayload {
  id?: string;
  name: string;
  dsl_script: string;
}
