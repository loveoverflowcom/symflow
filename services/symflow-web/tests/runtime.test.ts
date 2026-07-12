import { describe, expect, it, vi } from 'vitest';
import {
  generateTaskDeclarations,
  compileWorkflowGraph,
  inferInputSchema,
  isWorkflowFile,
  resolveFileAsBlob,
  stripRuntimeImports,
  TaskRegistry
} from '@symflow/runtime';
import { csvCreate, docxFillFieldsMeta } from '@symflow/runtime/tasks/local';
import { remoteTask } from '@symflow/runtime/tasks/remote';
import { extractIdCardFields, GeminiVisionProvider, parseModelResponse } from '@symflow/runtime/ocr';
import { defaultTaskConfig } from '$lib/utils/dsl-tree';
import { collectDownloadArtifacts } from '$lib/utils/artifacts';
import type { TaskMeta } from '@symflow/runtime';

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

  it('compiles an acyclic task graph into a TypeScript workflow', () => {
    const tasks: TaskMeta[] = [
      {
        name: 'source', label: 'Source', description: '', category: 'test', runtime: 'local',
        input_schema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
        output_schema: { type: 'object', properties: { text: { type: 'string' } } }
      },
      {
        name: 'target', label: 'Target', description: '', category: 'test', runtime: 'local',
        input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
        output_schema: { type: 'object', properties: { result: { type: 'string' } } }
      }
    ];
    const compiled = compileWorkflowGraph({
      inputs: [{ name: 'string_1', schema: { type: 'string' } }],
      nodes: [
        { id: 'first', type: 'task', name: 'source' },
        { id: 'second', type: 'task', name: 'target' }
      ],
      edges: [
        { source: { input: 'string_1' }, target: { nodeId: 'first', port: 'value' } },
        { source: { nodeId: 'first', port: 'text' }, target: { nodeId: 'second', port: 'text' } }
      ],
      outputs: { final: { nodeId: 'second', port: 'result' } }
    }, tasks);

    expect(compiled.errors).toEqual([]);
    expect(compiled.source).toContain('const node1 = await task("source"');
    expect(compiled.source).toContain('"text": node1["text"]');
    expect(compiled.source).toContain('"final": node2["result"]');
  });

  it('compiles graph workflow inputs into main(input) and an inferred file form field', () => {
    const tasks: TaskMeta[] = [{
      name: 'ocr', label: 'OCR', description: '', category: 'test', runtime: 'local',
      input_schema: {
        type: 'object',
        properties: { image: { type: 'string', format: 'binary' } },
        required: ['image']
      },
      output_schema: { type: 'object', properties: { text: { type: 'string' } } }
    }];
    const compiled = compileWorkflowGraph({
      inputs: [{ name: 'card_image', schema: { type: 'string', format: 'binary' } }],
      nodes: [{ id: 'ocr_1', type: 'task', name: 'ocr' }],
      edges: [{ source: { input: 'card_image' }, target: { nodeId: 'ocr_1', port: 'image' } }]
    }, tasks);

    expect(compiled.errors).toEqual([]);
    expect(compiled.source).toContain('export async function main(input: WorkflowInput)');
    expect(compiled.source).toContain('"image": input["card_image"]');
    expect(inferInputSchema(compiled.source!)).toEqual({
      type: 'object',
      required: ['card_image'],
      properties: { card_image: { type: 'string', format: 'binary' } }
    });
  });

  it('rejects missing inputs, incompatible connections, and forward bindings in task graphs', () => {
    const tasks: TaskMeta[] = [{
      name: 'number_task', label: 'Number', description: '', category: 'test', runtime: 'local',
      input_schema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      output_schema: { type: 'object', properties: { count: { type: 'number' } } }
    }, {
      name: 'text_task', label: 'Text', description: '', category: 'test', runtime: 'local',
      input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      output_schema: { type: 'object', properties: { text: { type: 'string' } } }
    }];
    const compiled = compileWorkflowGraph({
      nodes: [
        { id: 'one', type: 'task', name: 'number_task' },
        { id: 'two', type: 'task', name: 'text_task' },
        { id: 'three', type: 'task', name: 'text_task' },
        { id: 'four', type: 'task', name: 'text_task' }
      ],
      edges: [
        { source: { nodeId: 'one', port: 'count' }, target: { nodeId: 'two', port: 'text' } },
        { source: { nodeId: 'two', port: 'text' }, target: { nodeId: 'one', port: 'value' } },
        { source: { nodeId: 'three', port: 'text' }, target: { nodeId: 'four', port: 'text' } },
        { source: { nodeId: 'four', port: 'text' }, target: { nodeId: 'three', port: 'text' } }
      ]
    }, tasks);

    expect(compiled.source).toBeUndefined();
    expect(compiled.errors.map((error) => error.code)).toContain('incompatible_ports');
    expect(compiled.errors.map((error) => error.code)).toContain('missing_input');
    expect(compiled.errors.map((error) => error.code)).toContain('invalid_binding_order');
  });

  it('allows an earlier output to bind multiple downstream task inputs', () => {
    const task: TaskMeta = {
      name: 'step', label: 'Step', description: '', category: 'test', runtime: 'local',
      input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      output_schema: { type: 'object', properties: { text: { type: 'string' } } }
    };
    const compiled = compileWorkflowGraph({
      inputs: [{ name: 'string_1', schema: { type: 'string' } }],
      nodes: [
        { id: 'a', type: 'task', name: 'step' },
        { id: 'b', type: 'task', name: 'step' },
        { id: 'c', type: 'task', name: 'step' }
      ],
      edges: [
        { source: { input: 'string_1' }, target: { nodeId: 'a', port: 'text' } },
        { source: { nodeId: 'a', port: 'text' }, target: { nodeId: 'b', port: 'text' } },
        { source: { nodeId: 'a', port: 'text' }, target: { nodeId: 'c', port: 'text' } }
      ]
    }, [task]);

    expect(compiled.errors).toEqual([]);
  });

  it('accepts compatible port aliases and rejects unsafe task port overrides', () => {
    const task: TaskMeta = {
      name: 'copy', label: 'Copy', description: '', category: 'test', runtime: 'local',
      input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      output_schema: { type: 'object', properties: { text: { type: 'string' } } }
    };

    const compatible = compileWorkflowGraph({
      inputs: [{ name: 'message', schema: { type: 'string' } }],
      nodes: [{
        id: 'copy_1', type: 'task', name: 'copy',
        inputs: [{ name: 'text', dataType: 'text', required: true }],
        outputs: [{ name: 'text', dataType: 'string' }]
      }],
      edges: [{ source: { input: 'message' }, target: { nodeId: 'copy_1', port: 'text' } }]
    }, [task]);
    expect(compatible.errors).toEqual([]);

    const unsafe = compileWorkflowGraph({
      nodes: [{
        id: 'copy_1', type: 'task', name: 'copy', configuration: { text: 'hello' },
        inputs: [{ name: 'text', dataType: 'number', required: true }]
      }]
    }, [task]);
    expect(unsafe.errors.map((error) => error.code)).toContain('incompatible_port_type');
  });

  it('allows multiple port bindings between ordered task nodes', () => {
    const task: TaskMeta = {
      name: 'pair', label: 'Pair', description: '', category: 'test', runtime: 'local',
      input_schema: {
        type: 'object',
        properties: { left: { type: 'string' }, right: { type: 'string' } },
        required: ['left', 'right']
      },
      output_schema: { type: 'object', properties: { left: { type: 'string' }, right: { type: 'string' } } }
    };
    const compiled = compileWorkflowGraph({
      inputs: [
        { name: 'string_1', schema: { type: 'string' } },
        { name: 'string_2', schema: { type: 'string' } }
      ],
      nodes: [
        { id: 'a', type: 'task', name: 'pair' },
        { id: 'b', type: 'task', name: 'pair' }
      ],
      edges: [
        { source: { input: 'string_1' }, target: { nodeId: 'a', port: 'left' } },
        { source: { input: 'string_2' }, target: { nodeId: 'a', port: 'right' } },
        { source: { nodeId: 'a', port: 'left' }, target: { nodeId: 'b', port: 'left' } },
        { source: { nodeId: 'a', port: 'right' }, target: { nodeId: 'b', port: 'right' } }
      ]
    }, [task]);
    expect(compiled.errors).toEqual([]);
  });

  it('requires explicit bindings even when configuration contains a required input', () => {
    const task: TaskMeta = {
      name: 'step', label: 'Step', description: '', category: 'test', runtime: 'local',
      input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      output_schema: { type: 'string' }
    };
    const compiled = compileWorkflowGraph({
      nodes: [{ id: 'step_1', type: 'task', name: 'step', configuration: { text: 'hidden literal' } }]
    }, [task]);

    expect(compiled.errors.map((error) => error.code)).toContain('missing_input');
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

  it('infers WorkflowFile fields as binary inputs without needing its source alias', () => {
    expect(inferInputSchema(`
      import type { WorkflowFile } from '@symflow/runtime';
      export async function main(input: { image: WorkflowFile }) {
        return input;
      }
    `)).toEqual({
      type: 'object',
      required: ['image'],
      properties: { image: { type: 'string', format: 'binary' } }
    });
  });

  it('resolves WorkflowFile blobs and rejects empty values', async () => {
    const blob = new Blob(['template']);
    await expect(resolveFileAsBlob(blob)).resolves.toBe(blob);
    expect(isWorkflowFile(blob)).toBe(true);
    expect(isWorkflowFile('')).toBe(false);
  });

  it('uploads Blob inputs before calling a remote task', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === 'https://files.example/upload') {
        expect(init?.method).toBe('POST');
        expect(init?.body).toBeInstanceOf(FormData);
        return new Response(JSON.stringify({ url: 'https://files.example/files/template.docx' }));
      }
      expect(String(url)).toBe('https://api.example/api/tasks/fill');
      expect(JSON.parse(String(init?.body))).toEqual({ template: 'https://files.example/files/template.docx' });
      return new Response(JSON.stringify({ ok: true }));
    });

    await expect(remoteTask('fill', {
      baseUrl: 'https://api.example',
      filesBaseUrl: 'https://files.example',
      fetch: fetchMock as typeof fetch
    })({ template: new Blob(['docx']) })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it('merges fields from a Gemini wrapper response with raw_text', () => {
    const fields = parseModelResponse(JSON.stringify({
      fields: {
        dob: '1990-01-01',
        gender: 'Nam',
        id_number: '012345678901',
        id_type: 'CCCD',
        nationality: '\"\": \"VIỆT NAM\",'
      },
      raw_text: JSON.stringify({
        full_name: 'NGUYỄN VĂN A',
        address: '123 PHỐ HUẾ, HÀ NỘI',
        nationality: 'VIỆT NAM'
      })
    }));

    expect(fields).toMatchObject({
      full_name: 'NGUYỄN VĂN A',
      address: '123 PHỐ HUẾ, HÀ NỘI',
      nationality: 'VIỆT NAM',
      id_number: '012345678901'
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
      expect(body.generationConfig.responseMimeType).toBe('application/json');
      expect(body.generationConfig.responseSchema.properties.full_name).toMatchObject({
        type: 'STRING',
        nullable: true
      });
      expect(body.generationConfig.responseSchema.required).toContain('full_name');
      expect(body.generationConfig.temperature).toBe(0);
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
