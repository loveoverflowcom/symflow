import type { ImageSource, OcrResult, OcrWord } from '../types';
import { toBlob } from '../preprocess';

export async function sourceToRecognizeInput(source: ImageSource): Promise<string | Blob> {
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    return source;
  }
  if (typeof source !== 'string') {
    throw new Error('OCR source must be a Blob, File, or URL/data URL string');
  }
  if (/^data:/i.test(source) || /^https?:/i.test(source) || /^blob:/i.test(source)) {
    return source;
  }
  return toBlob(source);
}

export function normalizeRemoteResult(data: unknown, engine: OcrResult['engine']): OcrResult {
  const value = (data ?? {}) as Record<string, unknown>;
  const words = Array.isArray(value.words) ? value.words.map(normalizeWord).filter(Boolean) as OcrWord[] : [];
  const rawText = typeof value.rawText === 'string'
    ? value.rawText
    : typeof value.text === 'string'
      ? value.text
      : '';
  const averageConfidence = typeof value.averageConfidence === 'number'
    ? value.averageConfidence
    : typeof value.confidence === 'number'
      ? value.confidence
      : words.length > 0
        ? words.reduce((sum, word) => sum + word.confidence, 0) / words.length
        : 0;

  return {
    rawText,
    words,
    averageConfidence,
    engine
  };
}

export async function imageToFormData(image: ImageSource, lang?: string): Promise<FormData> {
  const blob = await toBlob(image);
  const form = new FormData();
  form.append('image', blob, 'ocr-image.png');
  if (lang) form.append('lang', lang);
  return form;
}

export async function postRemoteOcrRequest(
  endpoint: string,
  image: ImageSource,
  lang: string | undefined,
  engine: OcrResult['engine']
): Promise<OcrResult> {
  const response = await fetch(endpoint, {
    method: 'POST',
    body: await imageToFormData(image, lang)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OCR fallback failed (${response.status}): ${detail.trim() || response.statusText}`);
  }

  const data = await response.json().catch(() => ({}));
  return normalizeRemoteResult(data, engine);
}

function normalizeWord(value: unknown): OcrWord | null {
  if (!value || typeof value !== 'object') return null;
  const word = value as Record<string, unknown>;
  const text = typeof word.text === 'string' ? word.text : '';
  const confidence = typeof word.confidence === 'number'
    ? word.confidence
    : typeof word.confidence === 'string'
      ? Number(word.confidence)
      : 0;
  const bboxValue = (word.bbox ?? {}) as Record<string, unknown>;
  const x = Number(bboxValue.x ?? 0);
  const y = Number(bboxValue.y ?? 0);
  const w = Number(bboxValue.w ?? bboxValue.width ?? 0);
  const h = Number(bboxValue.h ?? bboxValue.height ?? 0);

  return {
    text,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    bbox: { x, y, w, h }
  };
}
