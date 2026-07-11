import { extractIdCardFields } from './extractor';
import { GeminiVisionProvider } from './providers/gemini-vision';
import type { IdCardFields, IdCardOcrInput, IdCardOcrOutput } from './types';

export interface PipelineOptions {
  onProgress?: (stage: string) => void;
}

export async function runIdCardOcrPipeline(
  file: IdCardOcrInput['image'],
  opts: PipelineOptions = {}
): Promise<IdCardOcrOutput> {
  const { onProgress } = opts;

  onProgress?.('gemini-vision-ocr');
  const provider = new GeminiVisionProvider();
  const ocrResult = await provider.recognize(file);

  onProgress?.('extract');
  const fields = ocrResult.fields ?? extractIdCardFields(ocrResult.rawText);

  return {
    fields,
    confidence: ocrResult.averageConfidence,
    engine_used: ocrResult.engine,
    raw_text: ocrResult.rawText,
    words: ocrResult.words
  };
}

export function selectIdCardFields(fields: IdCardFields, keys?: Array<keyof IdCardFields>): IdCardFields {
  if (!keys || keys.length === 0) return fields;
  return keys.reduce<IdCardFields>((acc, key) => {
    const value = fields[key];
    if (value !== undefined) {
      acc[key] = value as never;
    }
    return acc;
  }, {});
}
