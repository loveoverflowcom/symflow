import type { ImageSource, OcrProvider, OcrResult } from '../types';
import { postRemoteOcrRequest } from './shared';

export interface AzureDocumentProviderOptions {
  endpoint: string;
}

export class AzureDocumentProvider implements OcrProvider {
  readonly engineName = 'azure';

  constructor(private readonly options: AzureDocumentProviderOptions) {}

  async recognize(image: ImageSource, lang = 'vie+eng'): Promise<OcrResult> {
    if (!this.options.endpoint) {
      throw new Error('AzureDocumentProvider requires an endpoint');
    }
    return postRemoteOcrRequest(this.options.endpoint, image, lang, 'azure');
  }
}
