import type { JsonSchema, TaskMeta } from './types';

export interface TaskBinding {
  name: string;
  alias: string;
}

export function taskAlias(name: string): string {
  const parts = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const value = parts
    .map((part, index) => {
      const normalized = part.replace(/^[0-9]+/, '');
      if (!normalized) return '';
      return index === 0
        ? normalized[0].toLowerCase() + normalized.slice(1)
        : normalized[0].toUpperCase() + normalized.slice(1);
    })
    .join('');
  return value && !RESERVED_WORDS.has(value) ? value : `run${toPascalCase(name)}`;
}

export function taskBindings(tasks: TaskMeta[]): TaskBinding[] {
  const aliases = new Set<string>();
  return tasks.map(({ name }) => {
    let alias = taskAlias(name);
    let suffix = 2;
    while (aliases.has(alias)) alias = `${taskAlias(name)}${suffix++}`;
    aliases.add(alias);
    return { name, alias };
  });
}

export function generateTaskDeclarations(tasks: TaskMeta[]): string {
  const bindings = taskBindings(tasks);
  const definitions: string[] = [];
  const inputEntries: string[] = [];
  const outputEntries: string[] = [];
  const functions: string[] = [];

  tasks.forEach((meta, index) => {
    const baseName = toPascalCase(meta.name) || `Task${index + 1}`;
    const inputName = `${baseName}Input`;
    const outputName = `${baseName}Output`;
    definitions.push(`export type ${inputName} = ${schemaToType(meta.input_schema)};`);
    definitions.push(`export type ${outputName} = ${schemaToType(meta.output_schema)};`);
    inputEntries.push(`    ${JSON.stringify(meta.name)}: ${inputName};`);
    outputEntries.push(`    ${JSON.stringify(meta.name)}: ${outputName};`);
    functions.push(
      `  /** ${escapeDoc(meta.description || meta.label)} */\n` +
        `  export function ${bindings[index].alias}(input: ${inputName}): Promise<${outputName}>;`
    );
  });

  return `// Generated from the SymFlow Task Registry. Do not edit.
declare module '@symflow/runtime' {
  ${definitions.join('\n  ')}

  export interface TaskInputs {
${inputEntries.join('\n')}
  }

  export interface TaskOutputs {
${outputEntries.join('\n')}
  }

  export type TaskName = keyof TaskInputs;
  export function task<N extends TaskName>(
    name: N,
    input: TaskInputs[N]
  ): Promise<TaskOutputs[N]>;

${functions.join('\n\n')}
}
`;
}

function schemaToType(schema: JsonSchema | unknown): string {
  if (!schema || typeof schema !== 'object') return 'unknown';
  const value = schema as Record<string, unknown>;

  if (Array.isArray(value.enum)) {
    return value.enum.map((entry) => JSON.stringify(entry)).join(' | ') || 'never';
  }
  if (Array.isArray(value.anyOf)) {
    return value.anyOf.map(schemaToType).join(' | ');
  }
  if (Array.isArray(value.oneOf)) {
    return value.oneOf.map(schemaToType).join(' | ');
  }

  const type = value.type;
  if (Array.isArray(type)) {
    return type.map((entry) => schemaToType({ ...value, type: entry })).join(' | ');
  }
  if (type === 'string') return 'string';
  if (type === 'number' || type === 'integer') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'null') return 'null';
  if (type === 'array') return `Array<${schemaToType(value.items)}>`;

  if (type === 'object' || value.properties) {
    const properties =
      value.properties && typeof value.properties === 'object'
        ? (value.properties as Record<string, unknown>)
        : {};
    const required = new Set(Array.isArray(value.required) ? value.required : []);
    const fields = Object.entries(properties).map(([key, property]) => {
      const propertySchema = property as Record<string, unknown>;
      const description =
        typeof propertySchema?.description === 'string'
          ? `/** ${escapeDoc(propertySchema.description)} */ `
          : '';
      return `${description}${propertyName(key)}${required.has(key) ? '' : '?'}: ${schemaToType(property)};`;
    });
    const additional =
      value.additionalProperties && value.additionalProperties !== false
        ? `[key: string]: ${value.additionalProperties === true ? 'unknown' : schemaToType(value.additionalProperties)};`
        : '';
    return `{ ${[...fields, additional].filter(Boolean).join(' ')} }`;
  }

  return 'unknown';
}

function toPascalCase(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
    .replace(/^[0-9]+/, '');
}

function propertyName(value: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(value) ? value : JSON.stringify(value);
}

function escapeDoc(value: string): string {
  return value.replace(/\*\//g, '*\\/').replace(/\s+/g, ' ').trim();
}

const RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'false', 'finally', 'for', 'function',
  'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super', 'switch',
  'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'
]);
