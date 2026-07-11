import type { TaskFn, TaskMeta } from '../types';
import type { ImageSource, IdCardFields, IdCardOcrInput, IdCardOcrOutput, OcrProvider, OcrResult, OcrWord } from './types';
import { extractIdCardFields } from './extractor';
import { preprocessImage } from './preprocess';
import { AzureDocumentProvider } from './providers/azure';
import { GeminiVisionProvider, parseModelResponse } from './providers/gemini-vision';
import { GoogleVisionProvider } from './providers/vision-api';
import { runIdCardOcrPipeline, selectIdCardFields } from './pipeline';

export type { ImageSource, IdCardFields, IdCardOcrInput, IdCardOcrOutput, OcrProvider, OcrResult, OcrWord };

export type IdCardOcrTask = TaskFn<IdCardOcrInput | ImageSource, IdCardOcrOutput>;

const fieldNames: Array<keyof IdCardFields> = [
  'full_name',
  'dob',
  'gender',
  'nationality',
  'hometown',
  'address',
  'id_number',
  'issue_date',
  'expiry_date',
  'id_type'
];

export const idCardOcrMeta: TaskMeta = {
  name: 'id_card_ocr',
  label: 'ID Card OCR',
  description: 'Extract structured CCCD / CMND fields from an image using Gemini Vision.',
  category: 'vision',
  runtime: 'local',
  input_schema: {
    type: 'object',
    properties: {
      image: {
        type: 'string',
        description: 'Data URL, URL, or base64 image source. Blob/File are also supported at runtime. This image is sent to Gemini for processing.'
      },
      lang: { type: 'string', default: 'vie+eng' },
      fields: {
        type: 'array',
        items: { type: 'string', enum: fieldNames },
        default: []
      }
    },
    required: ['image']
  },
  output_schema: {
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        properties: {
          full_name: { type: 'string' },
          dob: { type: 'string' },
          gender: { type: 'string' },
          nationality: { type: 'string' },
          hometown: { type: 'string' },
          address: { type: 'string' },
          id_number: { type: 'string' },
          issue_date: { type: 'string' },
          expiry_date: { type: 'string' },
          id_type: {
            type: 'string',
            enum: ['CCCD', 'CMND', 'PASSPORT', 'UNKNOWN']
          }
        }
      },
      confidence: { type: 'number' },
      engine_used: { type: 'string' },
      raw_text: { type: 'string' },
      words: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            confidence: { type: 'number' },
            bbox: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                w: { type: 'number' },
                h: { type: 'number' }
              }
            }
          }
        }
      }
    },
    required: ['fields', 'confidence', 'engine_used', 'raw_text', 'words']
  }
};

export const idCardOcr: IdCardOcrTask = async (input) => {
  const normalized = normalizeInput(input);
  const result = await runIdCardOcrPipeline(normalized.image);
  return {
    ...result,
    fields: selectIdCardFields(result.fields, normalized.fields)
  };
};

export {
  AzureDocumentProvider,
  GeminiVisionProvider,
  GoogleVisionProvider,
  parseModelResponse,
  extractIdCardFields,
  preprocessImage,
  runIdCardOcrPipeline
};

function normalizeInput(input: IdCardOcrInput | ImageSource): IdCardOcrInput {
  if (typeof input === 'string' || isBlobLike(input)) {
    return {
      image: input,
      lang: 'vie+eng',
      fields: []
    };
  }

  return {
    image: input.image,
    lang: input.lang ?? 'vie+eng',
    fields: input.fields ?? []
  };
}

function isBlobLike(value: unknown): value is Blob | File {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}
