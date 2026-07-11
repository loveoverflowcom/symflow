import { generateTaskDeclarations, registry } from '@symflow/runtime';
import type { TaskMeta } from '@symflow/runtime';
import { csvCreate, csvCreateMeta, docxFillFields, docxFillFieldsMeta } from '@symflow/runtime/tasks/local';
import { executeTask, listTasks } from '$lib/api/client';

let initialized = false;
let initialization: Promise<void> | undefined;

export async function initializeTaskRegistry(): Promise<void> {
  if (initialized) return;
  initialization ??= (async () => {
    registry.register(csvCreateMeta, csvCreate);
    registry.register(docxFillFieldsMeta, docxFillFields);
    const { idCardOcr, idCardOcrMeta } = await import('@symflow/runtime/ocr');
    registry.register(idCardOcrMeta, idCardOcr);
    const remoteTasks = await listTasks();
    for (const meta of remoteTasks) {
      registry.register(meta, (input) => executeTask(meta.name, input));
    }
    initialized = true;
  })();
  await initialization;
}

export async function taskDeclarations(): Promise<string> {
  await initializeTaskRegistry();
  return generateTaskDeclarations(registry.list());
}

export async function taskCatalog(): Promise<TaskMeta[]> {
  await initializeTaskRegistry();
  return registry.list();
}
