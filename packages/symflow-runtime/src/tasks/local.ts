import type { TaskFn, TaskMeta } from '../types';
export { docxFillFields, docxFillFieldsMeta } from './docx-fill';

type CsvInput = { rows: Record<string, unknown>[] };

function escapeCsv(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const csvCreate: TaskFn<CsvInput, { csv: string }> = async ({ rows }) => {
  if (!Array.isArray(rows)) throw new Error('csv.create expects a rows array');
  if (rows.length === 0) return { csv: '' };

  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))
  ];
  return { csv: lines.join('\n') };
};

export const csvCreateMeta: TaskMeta = {
  name: 'csv.create',
  label: 'Create CSV',
  description: 'Create RFC-compatible CSV text from an array of objects.',
  category: 'data',
  runtime: 'local',
  input_schema: {
    type: 'object',
    properties: { rows: { type: 'array', items: { type: 'object' } } },
    required: ['rows']
  },
  output_schema: {
    type: 'object',
    properties: { csv: { type: 'string' } },
    required: ['csv']
  }
};
