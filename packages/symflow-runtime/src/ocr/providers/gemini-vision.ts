import type { IdCardFields, ImageSource, OcrProvider, OcrResult } from '../types';
import { toBlob } from '../preprocess';

const GEMINI_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-flash-latest';
const DEFAULT_PROXY_ENDPOINT = '/api/ocr/proxy';

const EXTRACTION_PROMPT = `This is a Vietnamese national ID card (CCCD/CMND). Extract every available value from the image and return one valid JSON object only, with no markdown or additional text.

The keys in the JSON object are the source of truth for fields. Always include every key below, including full_name. If a value cannot be read, use null. Do not rename full_name to fullname or name, and do not put extracted values in a separate raw_text object.

{
  "full_name": "...",
  "dob": "DD/MM/YYYY",
  "gender": "Male | Female",
  "nationality": "...",
  "hometown": "...",
  "address": "...",
  "id_number": "...",
  "issue_date": "DD/MM/YYYY",
  "expiry_date": "DD/MM/YYYY",
  "id_type": "CCCD | CMND"
}

Use the exact value from the card. Dates must use YYYY-MM-DD when possible. Normalize gender to Nam or Nữ and id_type to CCCD, CMND, PASSPORT, or UNKNOWN.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    full_name: { type: 'STRING', nullable: true },
    dob: { type: 'STRING', nullable: true },
    gender: { type: 'STRING', nullable: true },
    nationality: { type: 'STRING', nullable: true },
    hometown: { type: 'STRING', nullable: true },
    address: { type: 'STRING', nullable: true },
    id_number: { type: 'STRING', nullable: true },
    issue_date: { type: 'STRING', nullable: true },
    expiry_date: { type: 'STRING', nullable: true },
    id_type: {
      type: 'STRING',
      enum: ['CCCD', 'CMND', 'PASSPORT', 'UNKNOWN'],
      nullable: true
    }
  },
  required: ['full_name', 'dob', 'gender', 'nationality', 'hometown', 'address', 'id_number', 'issue_date', 'expiry_date', 'id_type']
};

export interface GeminiVisionProviderOptions {
  apiKey?: string;
  endpoint?: string;
  model?: string;
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: unknown;
      }>;
    };
  }>;
};

export class GeminiVisionProvider implements OcrProvider {
  readonly engineName = 'gemini-vision';
  private readonly endpoint: string;
  private readonly model: string;

  constructor(private readonly options: GeminiVisionProviderOptions = {}) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.endpoint = options.endpoint ?? (options.apiKey ? geminiEndpoint(this.model) : DEFAULT_PROXY_ENDPOINT);
  }

  async recognize(image: ImageSource): Promise<OcrResult> {
    const inlineData = await sourceToInlineData(image);
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.requestHeaders(),
      credentials: this.options.apiKey ? 'omit' : 'include',
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              { inline_data: inlineData }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0
        }
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Gemini vision OCR failed (${response.status}): ${detail.trim() || response.statusText}`);
    }

    const data = (await response.json().catch(() => ({}))) as GeminiGenerateContentResponse;
    const content = normalizeContent(data.candidates?.[0]?.content?.parts);
    const fields = parseModelResponse(content);

    return {
      rawText: content,
      words: [],
      averageConfidence: 0.95,
      engine: 'gemini-vision',
      fields: fields ?? undefined
    };
  }

  private requestHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'content-type': 'application/json'
    };

    if (this.options.apiKey) {
      headers['x-goog-api-key'] = this.options.apiKey;
    }

    return headers;
  }
}

export function parseModelResponse(content: string): IdCardFields | null {
  const direct = parseJsonObject(content);
  if (direct) return normalizeFields(direct);

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const parsed = parseJsonObject(fenced[1]);
    if (parsed) return normalizeFields(parsed);
  }

  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const parsed = parseJsonObject(content.slice(firstBrace, lastBrace + 1));
    if (parsed) return normalizeFields(parsed);
  }

  return null;
}

async function sourceToInlineData(source: ImageSource): Promise<{ mime_type: string; data: string }> {
  if (typeof source === 'string' && /^data:/i.test(source)) {
    return dataUrlToInlineData(source);
  }

  const blob = await toBlob(source);
  return {
    mime_type: blob.type || 'image/png',
    data: await blobToBase64(blob)
  };
}

function dataUrlToInlineData(dataUrl: string): { mime_type: string; data: string } {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;[^,]*)?,(.*)$/i);
  if (!match) {
    throw new Error('Invalid data URL image source');
  }
  return {
    mime_type: match[1] || 'image/png',
    data: match[2]
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(reader.error ?? new Error('Could not read image blob'));
      reader.readAsDataURL(blob);
    });
  }

  const buffer = await blob.arrayBuffer();
  return bytesToBase64(new Uint8Array(buffer));
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function normalizeContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return '';
        const value = item as Record<string, unknown>;
        return typeof value.text === 'string' ? value.text : '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

function geminiEndpoint(model: string): string {
  const modelId = model.replace(/^models\//, '');
  return `${GEMINI_ENDPOINT_BASE}/${modelId}:generateContent`;
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function normalizeFields(value: Record<string, unknown>): IdCardFields {
  const rawFields = parseEmbeddedObject(value.raw_text);
  const nestedFields = isRecord(value.fields) ? value.fields : {};
  const source = { ...rawFields, ...value, ...nestedFields };

  return {
    full_name: nullableString(source.full_name ?? source.fullName ?? source.fullname),
    dob: nullableString(source.dob),
    gender: normalizeGender(source.gender),
    nationality: nullableString(source.nationality),
    hometown: nullableString(source.hometown),
    address: nullableString(source.address),
    id_number: nullableString(source.id_number),
    issue_date: nullableString(source.issue_date),
    expiry_date: nullableString(source.expiry_date),
    id_type: normalizeIdType(source.id_type)
  };
}

function nullableString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return undefined;

  // Recover values accidentally returned as fragments such as `"": "VIỆT NAM",`.
  const malformedObjectValue = text.match(/:\s*["']([^"']+)["']\s*,?$/);
  return (malformedObjectValue?.[1] ?? text).trim() || undefined;
}

function parseEmbeddedObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {};
  const parsed = parseJsonObject(value.trim());
  return parsed ?? {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeGender(value: unknown): string | undefined {
  const text = nullableString(value);
  if (!text) return undefined;
  if (/^male$/i.test(text)) return 'Nam';
  if (/^female$/i.test(text)) return 'Nữ';
  return text;
}

function normalizeIdType(value: unknown): IdCardFields['id_type'] | undefined {
  const text = nullableString(value)?.toUpperCase();
  if (!text) return undefined;
  if (text === 'CCCD' || text === 'CMND' || text === 'PASSPORT' || text === 'UNKNOWN') return text;
  return undefined;
}
