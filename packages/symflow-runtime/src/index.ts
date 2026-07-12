import { task } from './registry';

export { evaluateTypeScriptDefault, executeWorkflow, stripRuntimeImports, transpileTypeScript } from './executor';
export { generateTaskDeclarations, taskAlias, taskBindings } from './declarations';
export {
  compileWorkflowGraph,
  workflowPortDataType,
  workflowPortSchema,
  workflowPortTypesAreCompatible
} from './graph-compiler';
export { inferInputSchema } from './input-schema';
export { isWorkflowFile, resolveFileAsBlob, resolveFileAsUrl } from './file';
export { registry, TaskRegistry } from './registry';
export { csvCreate, csvCreateMeta, docxFillFields, docxFillFieldsMeta } from './tasks/local';
export type { FieldSchema, WorkflowInputSchema } from './input-schema';
export type { WorkflowFile } from './file';
export type {
  GraphCompileError,
  GraphCompileResult,
  WorkflowGraph,
  WorkflowGraphEdge,
  WorkflowGraphInput,
  WorkflowGraphInputPort,
  WorkflowGraphNode,
  WorkflowGraphPort,
  WorkflowGraphPortDefinition,
  WorkflowGraphPosition,
  WorkflowGraphSource,
  WorkflowPortDataType
} from './graph-compiler';
export type { ExecutionLog, ExecutionResult, JsonSchema, TaskFn, TaskMeta } from './types';

export const webScraper = (input: unknown) => task('web_scraper', input);
export const localFileReader = (input: unknown) => task('local_file_reader', input);
export const aiAgent = (input: unknown) => task('ai_agent', input);
export const pdfReport = (input: unknown) => task('pdf_report', input);
export const docxFill = (input: unknown) => task('docx_fill_fields', input);
