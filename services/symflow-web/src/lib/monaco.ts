import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

let configured = false;

export function configureMonacoWorkers(): void {
  if (configured) return;
  configured = true;

  const scope = globalThis as typeof globalThis & {
    MonacoEnvironment?: {
      getWorker: (_moduleId: string, label: string) => Worker;
    };
  };
  scope.MonacoEnvironment = {
    getWorker(_moduleId, label) {
      if (label === 'typescript' || label === 'javascript') {
        return new TypeScriptWorker();
      }
      return new EditorWorker();
    }
  };
}
