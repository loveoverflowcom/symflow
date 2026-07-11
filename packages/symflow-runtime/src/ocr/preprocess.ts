import type { ImageSource } from './types';

export interface PreprocessOptions {
  maxDimension?: number;
  grayscale?: boolean;
  contrastBoost?: number;
}

export async function preprocessImage(
  file: ImageSource,
  opts: PreprocessOptions = {}
): Promise<Blob> {
  const { maxDimension = 1600, grayscale = true, contrastBoost = 1.4 } = opts;
  const blob = await toBlob(file);

  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    throw new Error('preprocessImage is only available in the browser');
  }

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  if (grayscale) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const boosted = Math.min(255, luminance * contrastBoost);
      data[i] = boosted;
      data[i + 1] = boosted;
      data[i + 2] = boosted;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('Could not serialize preprocessed image'));
        return;
      }
      resolve(result);
    }, 'image/png');
  });
}

export async function toBlob(source: ImageSource): Promise<Blob> {
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    return source;
  }

  if (typeof source !== 'string') {
    throw new Error('Image source must be a Blob, File, or URL/data URL string');
  }

  const response = await fetchImageSource(source);
  if (!response.ok) {
    throw new Error(`Could not load image source: HTTP ${response.status}`);
  }
  return response.blob();
}

async function fetchImageSource(source: string): Promise<Response> {
  if (!/^https?:/i.test(source)) {
    return fetch(source, { credentials: 'include' });
  }

  try {
    const direct = await fetch(source, { credentials: 'include' });
    if (direct.ok) return direct;
  } catch {
    // Browser CORS failures surface as network errors; fall back to the same-origin proxy.
  }

  return fetch(`/api/files/proxy?url=${encodeURIComponent(source)}`, { credentials: 'include' });
}
