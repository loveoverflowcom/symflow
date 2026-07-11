import { initialize, transform } from 'esbuild-wasm';
import wasmUrl from 'esbuild-wasm/esbuild.wasm?url';
import { registry } from './registry';
import { taskBindings } from './declarations';
import type { ExecutionLog, ExecutionResult } from './types';

let initializePromise: Promise<void> | undefined;

async function ensureEsbuild(): Promise<void> {
  initializePromise ??= initialize({ wasmURL: wasmUrl, worker: true });
  await initializePromise;
}

export async function transpileTypeScript(source: string): Promise<string> {
  await ensureEsbuild();
  const withoutRuntimeImport = stripRuntimeImports(source);
  const result = await transform(withoutRuntimeImport, {
    loader: 'ts',
    target: 'es2022',
    format: 'esm',
    sourcemap: 'inline'
  });
  return result.code;
}

export function stripRuntimeImports(source: string): string {
  return source.replace(
    /(^|\n)\s*import\s+[\s\S]*?\s+from\s+['"]@symflow\/runtime['"];?/g,
    '$1'
  );
}

async function importDefaultFromModuleSource(source: string): Promise<unknown> {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));

  try {
    const module = (await import(/* @vite-ignore */ url)) as { default?: unknown };
    if (!Object.prototype.hasOwnProperty.call(module, 'default')) {
      throw new Error('Run input module must export default input');
    }
    return module.default;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function evaluateTypeScriptDefault(source: string): Promise<unknown> {
  const code = await transpileTypeScript(source);
  return importDefaultFromModuleSource(code);
}

export async function executeWorkflow(source: string, initialInput: unknown = {}): Promise<ExecutionResult> {
  const code = await transpileTypeScript(source);
  const logs: ExecutionLog[] = [];
  const worker = new Worker(new URL('./workflow.worker.ts', import.meta.url), { type: 'module' });

  return new Promise((resolve, reject) => {
    worker.onmessage = async (event: MessageEvent<Record<string, unknown>>) => {
      const message = event.data;
      if (message.type === 'task_request') {
        const id = message.id as number;
        const name = message.name as string;
        const input = message.input;
        logs.push({ type: 'task_start', name, input, timestamp: Date.now() });
        try {
          const output = await registry.get(name)(input);
          logs.push({ type: 'task_done', name, output, timestamp: Date.now() });
          worker.postMessage({ type: 'task_result', id, output });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          logs.push({ type: 'task_error', name, error: detail, timestamp: Date.now() });
          worker.postMessage({ type: 'task_result', id, error: detail });
        }
        return;
      }

      worker.terminate();
      if (message.type === 'complete') {
        logs.push({ type: 'success', output: message.output, timestamp: Date.now() });
        resolve({ output: message.output, logs });
      } else {
        const detail = String(message.error ?? 'Workflow execution failed');
        logs.push({ type: 'error', error: detail, timestamp: Date.now() });
        const error = new Error(detail) as Error & { logs?: ExecutionLog[] };
        error.logs = logs;
        reject(error);
      }
    };

    worker.onerror = (event) => {
      worker.terminate();
      const detail =
        event.error instanceof Error
          ? [event.message, event.error.stack].filter(Boolean).join('\n')
          : event.message || 'Workflow worker crashed';
      logs.push({ type: 'error', error: detail, timestamp: Date.now() });
      const error = new Error(detail) as Error & { logs?: ExecutionLog[] };
      error.logs = logs;
      reject(error);
    };

    worker.postMessage({
      type: 'execute',
      source: code,
      input: initialInput,
      bindings: taskBindings(registry.list())
    });
  });
}
