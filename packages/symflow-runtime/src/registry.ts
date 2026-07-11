import type { TaskFn, TaskMeta } from './types';

export class TaskRegistry {
  private readonly entries = new Map<string, { meta: TaskMeta; fn: TaskFn }>();

  register<I, O>(meta: TaskMeta, fn: TaskFn<I, O>): void {
    this.entries.set(meta.name, { meta, fn: fn as TaskFn });
  }

  get(name: string): TaskFn {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`Task not found: "${name}"`);
    return entry.fn;
  }

  list(): TaskMeta[] {
    return Array.from(this.entries.values(), ({ meta }) => meta);
  }

  clear(): void {
    this.entries.clear();
  }
}

export const registry = new TaskRegistry();

export async function task<I, O>(name: string, input: I): Promise<O> {
  return registry.get(name)(input) as Promise<O>;
}
