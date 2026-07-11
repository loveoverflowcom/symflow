export type ImageSource = Blob | File | string;

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface OcrResult {
  rawText: string;
  words: OcrWord[];
  averageConfidence: number;
  engine: 'gemini-vision' | 'vision-api' | 'azure' | 'google-doc-ai';
  fields?: IdCardFields;
}

export interface IdCardFields {
  full_name?: string;
  dob?: string;
  gender?: string;
  nationality?: string;
  hometown?: string;
  address?: string;
  id_number?: string;
  issue_date?: string;
  expiry_date?: string;
  id_type?: 'CCCD' | 'CMND' | 'PASSPORT' | 'UNKNOWN';
}

export interface IdCardOcrInput {
  image: ImageSource;
  lang?: string;
  fields?: Array<keyof IdCardFields>;
}

export interface IdCardOcrOutput {
  fields: IdCardFields;
  confidence: number;
  engine_used: string;
  raw_text: string;
  words: OcrWord[];
}

export interface OcrProvider {
  readonly engineName: string;
  recognize(image: ImageSource, lang?: string): Promise<OcrResult>;
}
