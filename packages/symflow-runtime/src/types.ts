export type JsonSchema = Record<string, unknown>;
export type TaskFn<I = unknown, O = unknown> = (input: I) => Promise<O>;

export interface TaskMeta {
  name: string;
  label: string;
  description: string;
  category: string;
  runtime: 'local' | 'remote';
  input_schema: JsonSchema;
  output_schema: JsonSchema;
}

export interface ExecutionLog {
  type: 'task_start' | 'task_done' | 'task_error' | 'success' | 'error';
  name?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  timestamp: number;
}

export interface ExecutionResult {
  output: unknown;
  logs: ExecutionLog[];
}
