export type DownloadArtifact =
  | {
      kind: 'csv';
      filename: string;
      csv: string;
    }
  | {
      kind: 'pdf';
      filename: string;
      contentBase64: string;
    }
  | {
      kind: 'docx';
      filename: string;
      contentBase64: string;
    };

export function collectDownloadArtifacts(value: unknown): DownloadArtifact[] {
  const artifacts: DownloadArtifact[] = [];
  const seen = new Set<string>();

  walk(value, 'output');
  return artifacts;

  function walk(current: unknown, path: string): void {
    if (!current || typeof current !== 'object') return;

    if (Array.isArray(current)) {
      current.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }

    const record = current as Record<string, unknown>;
    const filename = typeof record.filename === 'string' ? record.filename.trim() : '';

    if (typeof record.csv === 'string' && record.csv.trim()) {
      const artifact: DownloadArtifact = {
        kind: 'csv',
        filename: normalizeFilename(filename, path, 'csv'),
        csv: record.csv
      };
      pushArtifact(artifact);
    }

    const docxBase64 = typeof record.docx_base64 === 'string' && record.docx_base64.trim()
      ? record.docx_base64
      : typeof record.docx === 'string' && record.docx.trim()
        ? record.docx
        : '';

    if (docxBase64) {
      const artifact: DownloadArtifact = {
        kind: 'docx',
        filename: normalizeFilename(filename, path, 'docx'),
        contentBase64: docxBase64
      };
      pushArtifact(artifact);
    }

    if (typeof record.content_base64 === 'string' && record.content_base64.trim()) {
      const kind = isDocxArtifact(record) ? 'docx' : 'pdf';
      const artifact: DownloadArtifact = {
        kind,
        filename: normalizeFilename(filename, path, kind),
        contentBase64: record.content_base64
      };
      pushArtifact(artifact);
    }

    for (const [key, child] of Object.entries(record)) {
      walk(child, `${path}.${key}`);
    }
  }

  function pushArtifact(artifact: DownloadArtifact): void {
    const content = artifact.kind === 'csv' ? artifact.csv : artifact.contentBase64;
    const key = `${artifact.kind}:${artifact.filename}:${content}`;
    if (seen.has(key)) return;
    seen.add(key);
    artifacts.push(artifact);
  }
}

function isDocxArtifact(record: Record<string, unknown>): boolean {
  const filename = typeof record.filename === 'string' ? record.filename : '';
  const mimeType = typeof record.mime_type === 'string'
    ? record.mime_type
    : typeof record.content_type === 'string'
      ? record.content_type
      : '';
  return /\.docx$/i.test(filename) || /wordprocessingml\.document/i.test(mimeType);
}

function normalizeFilename(filename: string, path: string, extension: string): string {
  if (filename) return filename;
  const segments = path.split(/[\.\[\]]+/).filter(Boolean);
  const base = segments[segments.length - 1] || 'output';
  return `${base}.${extension}`;
}
