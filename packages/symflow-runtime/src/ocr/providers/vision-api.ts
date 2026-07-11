import type { ImageSource, OcrProvider, OcrResult } from '../types';
import { postRemoteOcrRequest } from './shared';

export interface GoogleVisionProviderOptions {
  endpoint: string;
}

export class GoogleVisionProvider implements OcrProvider {
  readonly engineName = 'vision-api';

  constructor(private readonly options: GoogleVisionProviderOptions) {}

  async recognize(image: ImageSource, lang = 'vie+eng'): Promise<OcrResult> {
    if (!this.options.endpoint) {
      throw new Error('GoogleVisionProvider requires an endpoint');
    }
    return postRemoteOcrRequest(this.options.endpoint, image, lang, 'vision-api');
  }
}
