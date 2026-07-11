type RequestMessage = {
  type: 'execute';
  source: string;
  input: unknown;
  bindings: Array<{ name: string; alias: string }>;
};
type TaskResultMessage = { type: 'task_result'; id: number; output?: unknown; error?: string };

const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
let nextTaskId = 0;

function workerTask(name: string, input: unknown): Promise<unknown> {
  const id = ++nextTaskId;
  postMessage({ type: 'task_request', id, name, input });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function execute(
  source: string,
  input: unknown,
  bindings: Array<{ name: string; alias: string }>
): Promise<void> {
  const aliases = bindings
    .map(({ name, alias }) => `const ${alias} = input => task(${JSON.stringify(name)}, input);`)
    .join('\n');
  const moduleSource = `const task = globalThis.__symflowTask;\n${aliases}\n${source}`;
  const url = URL.createObjectURL(new Blob([moduleSource], { type: 'text/javascript' }));

  try {
    (globalThis as typeof globalThis & { __symflowTask?: typeof workerTask }).__symflowTask = workerTask;
    const workflow = (await import(/* @vite-ignore */ url)) as { main?: (input: unknown) => Promise<unknown> };
    if (typeof workflow.main !== 'function') {
      throw new Error('Workflow must export an async function named main');
    }
    postMessage({ type: 'complete', output: await workflow.main(input) });
  } catch (error) {
    postMessage({ type: 'failed', error: error instanceof Error ? error.message : String(error) });
  } finally {
    URL.revokeObjectURL(url);
  }
}

self.onerror = (event) => {
  const error = event.error instanceof Error ? event.error : new Error(event.message || 'Workflow worker crashed');
  postMessage({
    type: 'failed',
    error: [error.message, error.stack].filter(Boolean).join('\n')
  });
  return true;
};

self.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
  postMessage({
    type: 'failed',
    error: [reason.message, reason.stack].filter(Boolean).join('\n')
  });
  return true;
};

self.onmessage = (event: MessageEvent<RequestMessage | TaskResultMessage>) => {
  const message = event.data;
  if (message.type === 'execute') {
    void execute(message.source, message.input, message.bindings);
    return;
  }

  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error));
  else request.resolve(message.output);
};
