export type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
export type StepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
export type LogType = 'thought' | 'action' | 'observation' | 'finalAnswer' | 'runStatus' | string;

export interface FlowSummary {
  id: string;
  name: string;
  created_at: string;
}

export interface FlowDetail extends FlowSummary {
  dsl_script: string;
}

export interface StepExecution {
  run_id: string;
  step_id: string;
  status: StepStatus;
  resolved_inputs?: unknown;
  outputs?: unknown;
  agent_logs?: unknown;
  error?: string | null;
  executed_at: string;
}

export interface FlowRun {
  id: string;
  flow_id: string;
  status: RunStatus;
  initial_inputs?: unknown;
  created_at: string;
  finished_at?: string | null;
  steps?: StepExecution[];
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
