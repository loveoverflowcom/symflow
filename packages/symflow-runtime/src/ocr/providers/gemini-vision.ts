import type { IdCardFields, ImageSource, OcrProvider, OcrResult } from '../types';
import { toBlob } from '../preprocess';

const GEMINI_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-flash-latest';
const DEFAULT_PROXY_ENDPOINT = '/api/ocr/proxy';

const EXTRACTION_PROMPT = `This is a Vietnamese national ID card (CCCD/CMND). Extract the following fields and return valid JSON only, with no additional text:

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

If a field cannot be read, set its value to null.`;

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
          response_mime_type: 'application/json'
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
      rawText: fields ? JSON.stringify(fields) : content,
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
  return {
    full_name: nullableString(value.full_name),
    dob: nullableString(value.dob),
    gender: normalizeGender(value.gender),
    nationality: nullableString(value.nationality),
    hometown: nullableString(value.hometown),
    address: nullableString(value.address),
    id_number: nullableString(value.id_number),
    issue_date: nullableString(value.issue_date),
    expiry_date: nullableString(value.expiry_date),
    id_type: normalizeIdType(value.id_type)
  };
}

function nullableString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
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
