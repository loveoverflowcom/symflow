import { describe, expect, it, vi } from 'vitest';
import { generateTaskDeclarations, inferInputSchema, stripRuntimeImports, TaskRegistry } from '@symflow/runtime';
import { csvCreate, docxFillFieldsMeta } from '@symflow/runtime/tasks/local';
import { extractIdCardFields, GeminiVisionProvider, parseModelResponse } from '@symflow/runtime/ocr';
import { defaultTaskConfig } from '$lib/utils/dsl-tree';
import { collectDownloadArtifacts } from '$lib/utils/artifacts';

describe('TypeScript runtime tasks', () => {
  it('registers and dispatches tasks through one interface', async () => {
    const registry = new TaskRegistry();
    registry.register(
      {
        name: 'echo',
        label: 'Echo',
        description: 'Echo input',
        category: 'util',
        runtime: 'local',
        input_schema: {},
        output_schema: {}
      },
      async (input: { value: string }) => ({ value: input.value })
    );

    await expect(registry.get('echo')({ value: 'hello' })).resolves.toEqual({ value: 'hello' });
    expect(() => registry.get('missing')).toThrow('Task not found');
  });

  it('creates escaped CSV locally', async () => {
    await expect(
      csvCreate({ rows: [{ name: 'Ada', note: 'hello, "world"' }] })
    ).resolves.toEqual({ csv: 'name,note\nAda,"hello, ""world"""' });
  });

  it('generates typed task names, inputs, outputs and callable aliases', () => {
    const declarations = generateTaskDeclarations([
      {
        name: 'article.summary',
        label: 'Article Summary',
        description: 'Summarize an article.',
        category: 'ai',
        runtime: 'remote',
        input_schema: {
          type: 'object',
          properties: {
            article: {
              type: 'object',
              properties: { title: { type: 'string' }, body: { type: 'string' } },
              required: ['title', 'body']
            },
            maxLength: { type: 'integer' }
          },
          required: ['article']
        },
        output_schema: {
          type: 'object',
          properties: { text: { type: 'string' }, score: { type: 'number' } },
          required: ['text', 'score']
        }
      }
    ]);

    expect(declarations).toContain('"article.summary": ArticleSummaryInput');
    expect(declarations).toContain('article: { title: string; body: string; }');
    expect(declarations).toContain('maxLength?: number');
    expect(declarations).toContain('export function articleSummary(input: ArticleSummaryInput)');
    expect(declarations).toContain('Promise<ArticleSummaryOutput>');
  });

  it('strips multiline runtime imports before browser execution', () => {
    const source = `
      import {
        csvCreate,
        idCardOcr,
        pdfReport,
      } from '@symflow/runtime';

      export async function main(input: { image: string }) {
        return idCardOcr({ image: input.image });
      }
    `;

    const stripped = stripRuntimeImports(source);
    expect(stripped).not.toContain("from '@symflow/runtime'");
    expect(stripped).toContain('export async function main');
    expect(stripped).toContain('idCardOcr({ image: input.image })');
  });

  it('infers a form schema from main input object types', () => {
    const schema = inferInputSchema(`
      export async function main(input: {
        url?: string;
        count: number;
        enabled: boolean;
        tags: string[];
        image: File;
      }) {
        return input;
      }
    `);

    expect(schema).toEqual({
      type: 'object',
      required: ['count', 'enabled', 'tags', 'image'],
      properties: {
        url: { type: 'string', format: 'uri' },
        count: { type: 'number' },
        enabled: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string' } },
        image: { type: 'string', format: 'binary' }
      }
    });
  });

  it('infers a form schema from named type aliases and interfaces', () => {
    expect(inferInputSchema(`
      type WorkflowInput = {
        query: string;
        image?: Blob;
      };
      export async function main(input: WorkflowInput) {
        return input;
      }
    `)).toEqual({
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string' },
        image: { type: 'string', format: 'binary' }
      }
    });

    expect(inferInputSchema(`
      interface WorkflowInput {
        url: string;
        limit?: number;
      }
      export async function main(input: WorkflowInput) {
        return input;
      }
    `)).toEqual({
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string', format: 'uri' },
        limit: { type: 'number' }
      }
    });
  });

  it('skips optional complex inputs so URL form fields stay available', () => {
    const schema = inferInputSchema(`
      export interface Input {
        image: string;
        template: string;
        mapping?: Record<string, string>;
      }
      export async function main(input: Input) {
        return input;
      }
    `);

    expect(schema).toEqual({
      type: 'object',
      required: ['image', 'template'],
      properties: {
        image: { type: 'string', format: 'uri' },
        template: { type: 'string', format: 'uri' }
      }
    });
  });

  it('returns null for complex input types that should use the code editor', () => {
    expect(inferInputSchema(`
      type WorkflowInput = { kind: 'url' | 'file' };
      export async function main(input: WorkflowInput) {
        return input;
      }
    `)).toBeNull();
  });

  it('extracts common fields from CCCD-like text', () => {
    const rawText = [
      'CĂN CƯỚC CÔNG DÂN',
      'Họ và tên',
      'NGUYỄN VĂN AN',
      'Ngày sinh 01/01/1990',
      'Giới tính Nam',
      'Quốc tịch Việt Nam',
      'Quê quán Hà Nội',
      'Nơi thường trú 123 Đường ABC, Quận 1, TP.HCM',
      'Số 012345678901',
      'Ngày cấp 01/06/2021',
      'Có giá trị đến 01/01/2031'
    ].join('\n');

    const fields = extractIdCardFields(rawText);

    expect(fields.id_type).toBe('CCCD');
    expect(fields.full_name).toBe('NGUYỄN VĂN AN');
    expect(fields.dob).toBe('1990-01-01');
    expect(fields.gender).toBe('Nam');
    expect(fields.nationality).toBe('Việt Nam');
    expect(fields.hometown).toBe('Hà Nội');
    expect(fields.address).toBe('123 Đường ABC, Quận 1, TP.HCM');
    expect(fields.id_number).toBe('012345678901');
    expect(fields.issue_date).toBe('2021-06-01');
    expect(fields.expiry_date).toBe('2031-01-01');
  });

  it('parses Gemini vision JSON from markdown fences', () => {
    const fields = parseModelResponse([
      '```json',
      '{',
      '  "full_name": "Nguyễn Văn An",',
      '  "dob": "01/01/1990",',
      '  "gender": "Male",',
      '  "id_number": "012345678901",',
      '  "id_type": "CCCD"',
      '}',
      '```'
    ].join('\n'));

    expect(fields).toMatchObject({
      full_name: 'Nguyễn Văn An',
      dob: '01/01/1990',
      gender: 'Nam',
      id_number: '012345678901',
      id_type: 'CCCD'
    });
  });

  it('sends OCR images with the Gemini generateContent payload shape', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                { text: '{"full_name":"Nguyễn Văn An","id_type":"CCCD"}' }
              ]
            }
          }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const provider = new GeminiVisionProvider({ apiKey: 'test-key' });
      const result = await provider.recognize(new Blob(['abc'], { type: 'image/png' }));
      const [url, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(String(init?.body));

      expect(String(url)).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent'
      );
      expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
      expect(body.contents[0].parts[1].inline_data).toEqual({
        mime_type: 'image/png',
        data: 'YWJj'
      });
      expect(result.engine).toBe('gemini-vision');
      expect(result.fields?.full_name).toBe('Nguyễn Văn An');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('derives defaults from nested JSON schema properties', () => {
    const config = defaultTaskConfig({
      name: 'id_card_ocr',
      label: 'ID Card OCR',
      input_schema: {
        type: 'object',
        properties: {
          image: { type: 'string' },
          fields: { type: 'array' },
          enabled: { type: 'boolean' }
        }
      },
      output_schema: {}
    });

    expect(config).toEqual({
      image: '',
      fields: [],
      enabled: false
    });
  });

  it('exposes DOCX fill fields task inputs for workflow config', () => {
    const config = defaultTaskConfig(docxFillFieldsMeta);

    expect(docxFillFieldsMeta.name).toBe('docx_fill_fields');
    expect(config).toEqual({
      template: '',
      values: {},
      mapping: {}
    });
  });

  it('collects DOCX base64 outputs as downloadable artifacts', () => {
    expect(collectDownloadArtifacts({
      docx: 'UEsDBAoAAAAA',
      nested: {
        docx_base64: 'UEsDBAoBBBBB'
      }
    })).toEqual([
      {
        kind: 'docx',
        filename: 'output.docx',
        contentBase64: 'UEsDBAoAAAAA'
      },
      {
        kind: 'docx',
        filename: 'nested.docx',
        contentBase64: 'UEsDBAoBBBBB'
      }
    ]);
  });
});
